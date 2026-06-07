import { NextRequest, NextResponse } from "next/server";

/* ================================================================
   FRED Inflation API → CPIAUCSL monthly CPI data
   Returns derived inflation metrics + annual table since 1914
   ================================================================ */

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";
const SERIES_ID = "CPIAUCNS"; // CPI-U Not Seasonally Adjusted (BLS headline 12-month rate)

interface MonthlyPoint {
  date: string;    // YYYY-MM-DD
  value: number;   // CPI index level
}

async function fetchCPI(apiKey: string): Promise<MonthlyPoint[]> {
  const url = `${FRED_BASE}?series_id=${SERIES_ID}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=500`;
  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) return [];
  const body = await resp.json();
  return (body.observations ?? [])
    .map((o: { date: string; value: string }) => ({
      date: o.date,
      value: parseFloat(o.value),
    }))
    .filter((p: MonthlyPoint) => !isNaN(p.value) && p.value > 0)
    .reverse(); // chronological order
}

function yoyRate(current: number, prevYear: number): number {
  return ((current - prevYear) / prevYear) * 100;
}

function momRate(current: number, prevMonth: number): number {
  return ((current - prevMonth) / prevMonth) * 100;
}

/** Shift a YYYY-MM-DD date string by N months using UTC to avoid timezone drift. */
function dateOffset(dateStr: string, months: number): string {
  const parts = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  d.setUTCMonth(d.getUTCMonth() + months);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(_req: NextRequest) {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "FRED_API_KEY not configured" }, { status: 500 });
  }

  try {
    const points = await fetchCPI(apiKey);
    if (points.length < 2) {
      return NextResponse.json({ error: "Insufficient CPI data" }, { status: 500 });
    }

    // Latest data point
    const latest = points[points.length - 1];
    const latestDate = latest.date;

    // Build date→value map for gap-safe lookups (FRED may have missing months)
    const pointMap = new Map<string, number>(points.map((p) => [p.date, p.value]));

    // Annual CPI by year (for historical table + yearly chart)
    const byYear = new Map<number, { sum: number; count: number; months: number[] }>();
    for (const p of points) {
      const year = new Date(p.date + "T00:00:00").getFullYear();
      if (!byYear.has(year)) byYear.set(year, { sum: 0, count: 0, months: [] });
      const entry = byYear.get(year)!;
      entry.sum += p.value;
      entry.count++;
      entry.months.push(p.value);
    }

    // Annual average inflation rates
    const annualRates: { year: number; value: number; avg_cpi: number }[] = [];
    const years = [...byYear.keys()].sort((a, b) => a - b);
    for (let i = 0; i < years.length; i++) {
      const yr = years[i];
      const entry = byYear.get(yr)!;
      const avgCPI = entry.sum / entry.count;
      let value = 0;
      if (i > 0) {
        const prevYr = years[i - 1];
        const prevEntry = byYear.get(prevYr)!;
        const prevAvg = prevEntry.sum / prevEntry.count;
        value = ((avgCPI - prevAvg) / prevAvg) * 100;
      }
      annualRates.push({ year: yr, value: parseFloat(value.toFixed(2)), avg_cpi: parseFloat(avgCPI.toFixed(1)) });
    }

    // Trailing 12 months YoY rates — gap-safe (match by actual date, not array index)
    const monthly: { month: string; rate: number }[] = [];
    for (const p of points) {
      const prevKey = dateOffset(p.date, -12);
      const prevVal = pointMap.get(prevKey);
      if (prevVal === undefined) continue; // skip if 12 months ago data is missing
      monthly.push({
        month: p.date.substring(0, 7),
        rate: parseFloat(yoyRate(p.value, prevVal).toFixed(2)),
      });
    }

    // Month-to-month changes (last 24 months) — gap-safe
    const mom: { month: string; change: number }[] = [];
    const momStart = Math.max(0, points.length - 25);
    for (let i = momStart; i < points.length; i++) {
      const curr = points[i];
      const prevKey = dateOffset(curr.date, -1);
      const prevVal = pointMap.get(prevKey);
      if (prevVal === undefined) continue; // skip if previous month data is missing
      mom.push({
        month: curr.date.substring(0, 7),
        change: parseFloat(momRate(curr.value, prevVal).toFixed(2)),
      });
    }

    // Historical table: annual rates from 1914 to present
    const historicalTable = annualRates.filter((r) => r.year >= 1914);

    // Latest summary
    const latestYoY = monthly.length > 0 ? monthly[monthly.length - 1].rate : null;
    const latestDateFormatted = (() => {
      const d = new Date(latestDate + "T00:00:00");
      return d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
    })();

    return NextResponse.json({
      latest: {
        date: latestDateFormatted,
        yoy_rate: latestYoY,
        cpi_level: latest.value,
      },
      monthly: monthly.slice(-24),     // last 24 months of YoY rates
      mom,                              // last ~24 months of MoM changes (gap-safe)
      yearly: annualRates.filter((r) => r.year >= 2013),  // last ~13 years for chart
      historical: historicalTable,      // all years for table
      fetched_at: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
