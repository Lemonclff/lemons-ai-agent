import { NextRequest, NextResponse } from "next/server";

/* ================================================================
   Mortgage History API
   Returns 5 years of 30-Year Fixed Mortgage Rate weekly data
   from Freddie Mac (MORTGAGE30US) for the history chart.
   ================================================================ */

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

export async function GET(_req: NextRequest) {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "FRED_API_KEY not configured" }, { status: 500 });
  }

  try {
    const url = `${FRED_BASE}?series_id=MORTGAGE30US&api_key=${apiKey}&file_type=json&sort_order=desc&limit=300`;
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) {
      return NextResponse.json({ error: "FRED fetch failed" }, { status: 500 });
    }

    const body = await resp.json();
    const observations = (body.observations ?? [])
      .filter((o: { value: string }) => o.value !== ".")
      .map((o: { date: string; value: string }) => ({
        date: o.date,
        value: parseFloat(o.value),
      }))
      .filter((o: { value: number }) => !isNaN(o.value) && o.value > 0)
      .reverse(); // chronological

    if (observations.length < 2) {
      return NextResponse.json({ error: "Insufficient data" }, { status: 500 });
    }

    // Return last 5 years of weekly data
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const cutoff = fiveYearsAgo.toISOString().substring(0, 10);

    const recent = observations.filter((o: { date: string }) => o.date >= cutoff);

    return NextResponse.json({
      series: "MORTGAGE30US",
      label: "30-Year Fixed Mortgage Rate",
      data: recent.map((o: { date: string; value: number }) => ({
        date: o.date,
        value: parseFloat(o.value.toFixed(2)),
      })),
      fetched_at: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
