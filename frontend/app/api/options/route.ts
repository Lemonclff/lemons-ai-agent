/**
 * Options & Volatility Proxy API
 *
 * GET /api/options?ticker=TSLA
 * Returns options chain summary with IV/HV/PCR for tracked tickers.
 * Falls back to mock data when yfinance is unavailable.
 */

import { NextRequest, NextResponse } from "next/server";

function generateMockOptions(ticker?: string) {
  const all = [
    { ticker: "TSLA", name: "Tesla", price: 178.32, change_pct: 2.3, implied_volatility: 55.4, historical_volatility: 38.2, iv_hv_spread: 17.2, put_call_ratio: 1.35, call_volume: 342000, put_volume: 461700, total_volume: 803700, unusual_activity: false },
    { ticker: "NVDA", name: "NVIDIA", price: 942.17, change_pct: -1.2, implied_volatility: 62.1, historical_volatility: 45.8, iv_hv_spread: 16.3, put_call_ratio: 0.85, call_volume: 890000, put_volume: 756500, total_volume: 1646500, unusual_activity: false },
    { ticker: "AMD", name: "AMD", price: 156.44, change_pct: 0.8, implied_volatility: 58.7, historical_volatility: 42.1, iv_hv_spread: 16.6, put_call_ratio: 0.92, call_volume: 280000, put_volume: 257600, total_volume: 537600, unusual_activity: false },
    { ticker: "AAPL", name: "Apple", price: 189.95, change_pct: 0.5, implied_volatility: 32.1, historical_volatility: 28.3, iv_hv_spread: 3.8, put_call_ratio: 0.72, call_volume: 520000, put_volume: 374400, total_volume: 894400, unusual_activity: false },
    { ticker: "MSTR", name: "MicroStrategy", price: 1456.78, change_pct: 5.2, implied_volatility: 85.3, historical_volatility: 52.1, iv_hv_spread: 33.2, put_call_ratio: 1.82, call_volume: 180000, put_volume: 327600, total_volume: 507600, unusual_activity: true },
    { ticker: "COIN", name: "Coinbase", price: 234.56, change_pct: -3.1, implied_volatility: 78.5, historical_volatility: 55.0, iv_hv_spread: 23.5, put_call_ratio: 1.45, call_volume: 210000, put_volume: 304500, total_volume: 514500, unusual_activity: true },
    { ticker: "SMCI", name: "Super Micro", price: 812.34, change_pct: -2.4, implied_volatility: 72.3, historical_volatility: 48.9, iv_hv_spread: 23.4, put_call_ratio: 1.15, call_volume: 150000, put_volume: 172500, total_volume: 322500, unusual_activity: false },
    { ticker: "PLTR", name: "Palantir", price: 24.56, change_pct: 1.8, implied_volatility: 65.2, historical_volatility: 58.1, iv_hv_spread: 7.1, put_call_ratio: 0.68, call_volume: 380000, put_volume: 258400, total_volume: 638400, unusual_activity: false },
    { ticker: "ARM", name: "ARM Holdings", price: 132.45, change_pct: -0.9, implied_volatility: 52.8, historical_volatility: 41.2, iv_hv_spread: 11.6, put_call_ratio: 0.78, call_volume: 195000, put_volume: 152100, total_volume: 347100, unusual_activity: false },
    { ticker: "AVGO", name: "Broadcom", price: 1345.67, change_pct: 0.3, implied_volatility: 38.5, historical_volatility: 31.2, iv_hv_spread: 7.3, put_call_ratio: 0.81, call_volume: 310000, put_volume: 251100, total_volume: 561100, unusual_activity: false },
  ];

  if (ticker) {
    return all.filter((d) => d.ticker === ticker.toUpperCase());
  }
  return all;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker");

  // In production: call Python script or yfinance SDK
  // For now: return structured mock data matching the frontend schema
  const data = generateMockOptions(ticker || undefined);

  // Add AI alerts for unusual activity
  const enriched = data.map((d) => {
    if (d.unusual_activity) {
      const spreads = d.iv_hv_spread > 30 ? "極端擴張" : "顯著擴張";
      const pcrLabel = d.put_call_ratio > 1.5 ? "極度偏空" : "偏空";
      return {
        ...d,
        ai_alert: `⚠️ ${d.ticker} IV ${spreads}：IV-HV spread = ${d.iv_hv_spread}%，PCR = ${d.put_call_ratio} (${pcrLabel})。${d.iv_hv_spread > 30 ? "財報前避險情緒升溫，考慮做多波動率 (Long Straddle)。" : "關注期權異動，PCR 偏空暗示防禦性對沖需求增加。"}`,
      };
    }
    return d;
  });

  return NextResponse.json({
    data: enriched,
    total: enriched.length,
    generated_at: new Date().toISOString(),
    _source: "mock",
  });
}
