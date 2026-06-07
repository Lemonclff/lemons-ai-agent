import { NextRequest, NextResponse } from "next/server";

/* ================================================================
   Economic Indicators API
   Treasury from US Treasury CSV  |  Mortgage from Optimal Blue (daily)
   Corporate Bonds / Credit from FRED
   ================================================================ */

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

interface Indicator {
  id: string;
  label: string;
  unit: string;
  category: string;
  sort: number;
  value: number | null;
  date: string;
  prev_close: number | null;
  change: number | null;
}

/* ---- Treasury: from US Treasury CSV (fresher than FRED) ---- */

const TREASURY_COLUMNS: { id: string; label: string; col: string; sort: number }[] = [
  { id: "DGS1MO",  label: "1 Month",  col: "1 Mo",  sort: 1 },
  { id: "DGS2MO",  label: "2 Month",  col: "2 Mo",  sort: 2 },
  { id: "DGS3MO",  label: "3 Month",  col: "3 Mo",  sort: 3 },
  { id: "DGS4MO",  label: "4 Month",  col: "4 Mo",  sort: 4 },
  { id: "DGS6MO",  label: "6 Month",  col: "6 Mo",  sort: 5 },
  { id: "DGS1",    label: "1 Year",   col: "1 Yr",  sort: 6 },
  { id: "DGS2",    label: "2 Year",   col: "2 Yr",  sort: 7 },
  { id: "DGS3",    label: "3 Year",   col: "3 Yr",  sort: 8 },
  { id: "DGS5",    label: "5 Year",   col: "5 Yr",  sort: 9 },
  { id: "DGS7",    label: "7 Year",   col: "7 Yr",  sort: 10 },
  { id: "DGS10",   label: "10 Year",  col: "10 Yr", sort: 11 },
  { id: "DGS20",   label: "20 Year",  col: "20 Yr", sort: 12 },
  { id: "DGS30",   label: "30 Year",  col: "30 Yr", sort: 13 },
];

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ""; continue; }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

async function fetchTreasuryFromCSV(): Promise<Indicator[]> {
  try {
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/all/${yyyymm}?field_tdr_date_value_month=${yyyymm}&type=daily_treasury_yield_curve&page&_format=csv`;

    const resp = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "lemons-ai-agent/1.0", "Accept": "text/csv" },
    });

    if (!resp.ok) return [];
    const text = await resp.text();
    if (!text || text.length < 10) return [];

    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 3) return [];

    const header = parseCSVLine(lines[0]);
    const latest = parseCSVLine(lines[1]);
    const previous = parseCSVLine(lines[2]);

    const colIndex = (col: string): number => header.findIndex((h) => h === col);
    const dateIdx = header.findIndex((h) => h === "Date");
    const date = dateIdx >= 0 ? latest[dateIdx] : "";

    const indicators: Indicator[] = [];
    for (const tc of TREASURY_COLUMNS) {
      const idx = colIndex(tc.col);
      if (idx < 0) continue;
      const raw = latest[idx];
      const rawPrev = previous[idx];
      const val = raw && raw !== "N/A" && raw !== "" ? parseFloat(raw) : null;
      const prevVal = rawPrev && rawPrev !== "N/A" && rawPrev !== "" ? parseFloat(rawPrev) : null;

      let change: number | null = null;
      if (val !== null && !isNaN(val) && prevVal !== null && !isNaN(prevVal)) {
        change = parseFloat((val - prevVal).toFixed(4));
      }

      indicators.push({
        id: tc.id, label: tc.label, unit: "%", category: "treasury", sort: tc.sort,
        value: val !== null && !isNaN(val) ? val : null,
        date, prev_close: prevVal !== null && !isNaN(prevVal) ? prevVal : null, change,
      });
    }
    return indicators.sort((a, b) => a.sort - b.sort);
  } catch (e) {
    console.error("Treasury CSV fetch failed:", e);
    return [];
  }
}

/* ---- FRED helpers ---- */

interface FredSeries {
  id: string;
  label: string;
  unit: string;
  category: "mortgage" | "bonds" | "inflation" | "treasury-fallback";
  sort: number;
}

const MORTGAGE_SERIES: FredSeries[] = [
  // Freddie Mac PMMS (weekly survey) — industry standard, closest to consumer rates
  { id: "MORTGAGE30US",   label: "30-Year Fixed",    unit: "%", category: "mortgage", sort: 1 },
  { id: "MORTGAGE15US",   label: "15-Year Fixed",    unit: "%", category: "mortgage", sort: 2 },
  // Jumbo from Optimal Blue (daily) — Freddie Mac doesn't publish Jumbo
  { id: "OBMMIJUMBO30YF", label: "30-Year Jumbo",   unit: "%", category: "mortgage", sort: 3 },
];

const BOND_SERIES: FredSeries[] = [
  { id: "AAA", label: "Moody's Aaa Corporate", unit: "%", category: "bonds", sort: 1 },
  { id: "BAA", label: "Moody's Baa Corporate", unit: "%", category: "bonds", sort: 2 },
];

const OTHER_SERIES: FredSeries[] = [
  { id: "T10YIE",       label: "10Y Breakeven Inflation", unit: "%", category: "inflation", sort: 1 },
  { id: "BAMLH0A0HYM2", label: "US High Yield OAS",       unit: "%", category: "bonds",   sort: 3 },
];

async function fetchFredSeries(series: FredSeries, apiKey: string): Promise<Indicator> {
  const base = `${FRED_BASE}?series_id=${series.id}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=2`;
  const resp = await fetch(base, { cache: "no-store" });
  if (!resp.ok) {
    return { id: series.id, label: series.label, unit: series.unit, category: series.category, sort: series.sort, value: null, date: "", prev_close: null, change: null };
  }
  const body = await resp.json();
  const obs = body.observations ?? [];
  const latest = obs[0];
  const previous = obs[1];
  const value = latest?.value === "." ? null : parseFloat(latest?.value ?? "");
  const prev = previous?.value === "." ? null : parseFloat(previous?.value ?? "");
  const date = latest?.date ?? "";
  let change: number | null = null;
  if (value !== null && !isNaN(value) && prev !== null && !isNaN(prev)) {
    change = parseFloat((value - prev).toFixed(4));
  }
  return { id: series.id, label: series.label, unit: series.unit, category: series.category, sort: series.sort, value: value !== null && !isNaN(value) ? value : null, date, prev_close: prev !== null && !isNaN(prev) ? prev : null, change };
}

export async function GET(_req: NextRequest) {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "FRED_API_KEY not configured" }, { status: 500 });
  }

  try {
    const [treasury, fredResults] = await Promise.all([
      fetchTreasuryFromCSV(),
      Promise.all([...MORTGAGE_SERIES, ...BOND_SERIES, ...OTHER_SERIES].map((s) => fetchFredSeries(s, apiKey))),
    ]);

    // Fallback to FRED DGS if Treasury CSV fails
    let finalTreasury = treasury;
    if (finalTreasury.length === 0) {
      console.warn("Treasury CSV empty, falling back to FRED DGS...");
      const dgsSeries: FredSeries[] = [
        { id: "DGS1MO", label: "1 Month", unit: "%", category: "treasury-fallback", sort: 1 },
        { id: "DGS3MO", label: "3 Month", unit: "%", category: "treasury-fallback", sort: 2 },
        { id: "DGS6MO", label: "6 Month", unit: "%", category: "treasury-fallback", sort: 3 },
        { id: "DGS1",   label: "1 Year",  unit: "%", category: "treasury-fallback", sort: 4 },
        { id: "DGS2",   label: "2 Year",  unit: "%", category: "treasury-fallback", sort: 5 },
        { id: "DGS3",   label: "3 Year",  unit: "%", category: "treasury-fallback", sort: 6 },
        { id: "DGS5",   label: "5 Year",  unit: "%", category: "treasury-fallback", sort: 7 },
        { id: "DGS7",   label: "7 Year",  unit: "%", category: "treasury-fallback", sort: 8 },
        { id: "DGS10",  label: "10 Year", unit: "%", category: "treasury-fallback", sort: 9 },
        { id: "DGS20",  label: "20 Year", unit: "%", category: "treasury-fallback", sort: 10 },
        { id: "DGS30",  label: "30 Year", unit: "%", category: "treasury-fallback", sort: 11 },
      ];
      const dgsResults = await Promise.all(dgsSeries.map((s) => fetchFredSeries(s, apiKey)));
      finalTreasury = dgsResults.map((r) => ({ ...r, category: "treasury" })).sort((a, b) => a.sort - b.sort);
    }

    const mortgage = fredResults.filter((r) => r.category === "mortgage").sort((a, b) => a.sort - b.sort);
    const bondsRaw = fredResults.filter((r) => r.category === "bonds").sort((a, b) => a.sort - b.sort);

    const baa = bondsRaw.find((r) => r.id === "BAA");
    const aaa = bondsRaw.find((r) => r.id === "AAA");
    let spread: Indicator | null = null;
    if (baa?.value !== null && aaa?.value !== null && !isNaN(baa.value) && !isNaN(aaa.value)) {
      const spreadVal = parseFloat((baa.value - aaa.value).toFixed(2));
      const spreadPrev = (baa.prev_close !== null && aaa.prev_close !== null && !isNaN(baa.prev_close) && !isNaN(aaa.prev_close))
        ? parseFloat((baa.prev_close - aaa.prev_close).toFixed(2)) : null;
      const spreadChange = spreadPrev !== null ? parseFloat((spreadVal - spreadPrev).toFixed(4)) : null;
      spread = {
        id: "BAA-AAA", label: "BAA\u2212AAA Spread", unit: "%", category: "bonds", sort: 4,
        value: spreadVal, date: baa.date, prev_close: spreadPrev, change: spreadChange,
      };
    }
    const bonds = spread ? [...bondsRaw, spread].sort((a, b) => a.sort - b.sort) : bondsRaw;

    const others = fredResults
      .filter((r) => r.category !== "mortgage" && r.category !== "bonds" && r.category !== "treasury-fallback")
      .sort((a, b) => a.sort - b.sort);

    return NextResponse.json({ treasury: finalTreasury, mortgage, bonds, others, fetched_at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
