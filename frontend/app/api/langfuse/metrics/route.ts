/**
 * Langfuse Metrics Proxy API
 *
 * GET /api/langfuse/metrics?from=...&to=...
 * Returns aggregated metrics: total traces, tokens, cost, avg latency
 *
 * Falls back to mock data if Langfuse is not configured,
 * so the UI always has something to render during development.
 */

import { NextRequest, NextResponse } from "next/server";

const LANGFUSE_BASE =
  process.env.LANGFUSE_HOST || "https://cloud.langfuse.com";
const PUBLIC_KEY = process.env.LANGFUSE_PUBLIC_KEY || "";
const SECRET_KEY = process.env.LANGFUSE_SECRET_KEY || "";

function getMockMetrics() {
  return {
    totalTraces: 1247,
    totalTokens: 2450000,
    totalCost: 5.2,
    avgLatency: 1.34,
    // time-series for chart
    hourly: Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      traces: Math.floor(Math.random() * 80) + 10,
      tokens: Math.floor(Math.random() * 150000) + 50000,
      cost: +(Math.random() * 0.5 + 0.1).toFixed(2),
    })),
  };
}

export async function GET(req: NextRequest) {
  if (!PUBLIC_KEY || !SECRET_KEY) {
    return NextResponse.json({
      ...getMockMetrics(),
      _source: "mock",
      _note: "Configure LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY for live data",
    });
  }

  try {
    const auth = Buffer.from(`${PUBLIC_KEY}:${SECRET_KEY}`).toString("base64");
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";

    const tracesUrl = `${LANGFUSE_BASE}/api/public/traces?limit=100&page=1`;
    if (from) tracesUrl.concat(`&fromTimestamp=${from}`);
    if (to) tracesUrl.concat(`&toTimestamp=${to}`);

    const res = await fetch(tracesUrl, {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ ...getMockMetrics(), _source: "mock_fallback" });
    }

    const data = await res.json();
    const traces = data.data || [];

    let totalTokens = 0;
    let totalCost = 0;
    let totalLatency = 0;

    for (const t of traces) {
      totalTokens += t.totalTokens || 0;
      totalCost += t.totalCost || 0;
      totalLatency += t.latency || 0;
    }

    const count = traces.length || 1;
    return NextResponse.json({
      totalTraces: data.meta?.totalItems || traces.length,
      totalTokens,
      totalCost: +totalCost.toFixed(4),
      avgLatency: +(totalLatency / count).toFixed(3),
      hourly: getMockMetrics().hourly, // Mock chart data (Langfuse public API doesn't have time-series)
      _source: "live",
    });
  } catch {
    return NextResponse.json({ ...getMockMetrics(), _source: "mock_fallback" });
  }
}
