/**
 * Options & Volatility Proxy API
 *
 * GET  /api/options                  → all tracked tickers
 * GET  /api/options?ticker=TSLA      → single ticker
 * POST /api/options                  → batch query with body { tickers: [...] }
 * POST /api/options/validate         → validate a ticker symbol
 *
 * In production, connects to yfinance/Polygon.io for live options data.
 * Returns mock data with realistic IV/HV/PCR values for development.
 */

import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// Ticker Database (extended)
// ============================================================================
const VALID_TICKERS: Record<string, { name: string; exchange: string }> = {
  TSLA:  { name: "Tesla Inc.", exchange: "NASDAQ" },
  NVDA:  { name: "NVIDIA Corporation", exchange: "NASDAQ" },
  AMD:   { name: "Advanced Micro Devices", exchange: "NASDAQ" },
  AAPL:  { name: "Apple Inc.", exchange: "NASDAQ" },
  MSTR:  { name: "MicroStrategy Inc.", exchange: "NASDAQ" },
  COIN:  { name: "Coinbase Global Inc.", exchange: "NASDAQ" },
  SMCI:  { name: "Super Micro Computer Inc.", exchange: "NASDAQ" },
  PLTR:  { name: "Palantir Technologies", exchange: "NASDAQ" },
  ARM:   { name: "ARM Holdings", exchange: "NASDAQ" },
  AVGO:  { name: "Broadcom Inc.", exchange: "NASDAQ" },
  MSFT:  { name: "Microsoft Corporation", exchange: "NASDAQ" },
  GOOGL: { name: "Alphabet Inc.", exchange: "NASDAQ" },
  META:  { name: "Meta Platforms Inc.", exchange: "NASDAQ" },
  AMZN:  { name: "Amazon.com Inc.", exchange: "NASDAQ" },
  NFLX:  { name: "Netflix Inc.", exchange: "NASDAQ" },
  INTC:  { name: "Intel Corporation", exchange: "NASDAQ" },
  QCOM:  { name: "Qualcomm Inc.", exchange: "NASDAQ" },
  MU:    { name: "Micron Technology Inc.", exchange: "NASDAQ" },
  SNOW:  { name: "Snowflake Inc.", exchange: "NYSE" },
  CRM:   { name: "Salesforce Inc.", exchange: "NYSE" },
  UBER:  { name: "Uber Technologies Inc.", exchange: "NYSE" },
  SQ:    { name: "Block Inc.", exchange: "NYSE" },
  RBLX:  { name: "Roblox Corporation", exchange: "NYSE" },
  SNAP:  { name: "Snap Inc.", exchange: "NYSE" },
  DDOG:  { name: "Datadog Inc.", exchange: "NASDAQ" },
  CRWD:  { name: "CrowdStrike Holdings", exchange: "NASDAQ" },
  PANW:  { name: "Palo Alto Networks", exchange: "NASDAQ" },
  ZS:    { name: "Zscaler Inc.", exchange: "NASDAQ" },
  NET:   { name: "Cloudflare Inc.", exchange: "NYSE" },
  SHOP:  { name: "Shopify Inc.", exchange: "NYSE" },
  RIVN:  { name: "Rivian Automotive", exchange: "NASDAQ" },
  LCID:  { name: "Lucid Group Inc.", exchange: "NASDAQ" },
  SOFI:  { name: "SoFi Technologies", exchange: "NASDAQ" },
  AFRM:  { name: "Affirm Holdings", exchange: "NASDAQ" },
  HOOD:  { name: "Robinhood Markets", exchange: "NASDAQ" },
  GME:   { name: "GameStop Corp.", exchange: "NYSE" },
  AMC:   { name: "AMC Entertainment", exchange: "NYSE" },
  SPY:   { name: "SPDR S&P 500 ETF", exchange: "NYSE" },
  QQQ:   { name: "Invesco QQQ Trust", exchange: "NASDAQ" },
  IWM:   { name: "iShares Russell 2000", exchange: "NYSE" },
};

function generateOptionsData(ticker: string): object {
  const info = VALID_TICKERS[ticker] || { name: ticker, exchange: "UNKNOWN" };
  const price = 20 + Math.random() * 1400;
  const iv = 18 + Math.random() * 85;
  const hv = 15 + Math.random() * 55;
  const spread = iv - hv;
  const pcr = 0.3 + Math.random() * 2.5;
  const unusual = spread > 28 || pcr > 1.8;

  return {
    ticker,
    name: info.name,
    exchange: info.exchange,
    price: Math.round(price * 100) / 100,
    change_pct: Math.round((Math.random() * 10 - 4) * 100) / 100,
    implied_volatility: Math.round(iv * 100) / 100,
    historical_volatility: Math.round(hv * 100) / 100,
    iv_hv_spread: Math.round(spread * 100) / 100,
    put_call_ratio: Math.round(pcr * 100) / 100,
    call_volume: Math.floor(Math.random() * 500000) + 10000,
    put_volume: Math.floor(Math.random() * 300000) + 5000,
    total_volume: Math.floor(Math.random() * 800000) + 20000,
    unusual_activity: unusual,
    ai_alert: unusual
      ? `⚠️ ${ticker} IV anomaly: spread=${spread.toFixed(1)}%, PCR=${pcr.toFixed(2)}. ${
          spread > 35 ? "Extreme expansion — consider Long Straddle." : "Monitor earnings catalyst."
        }`
      : undefined,
    last_updated: new Date().toISOString(),
  };
}

// ============================================================================
// GET — single ticker or all
// ============================================================================
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker")?.toUpperCase();
  const validate = searchParams.get("validate");

  // Validate endpoint
  if (validate) {
    const upper = validate.toUpperCase().trim();
    const found = VALID_TICKERS[upper];
    return NextResponse.json({
      valid: !!found,
      ticker: upper,
      name: found?.name || null,
      exchange: found?.exchange || null,
      message: found
        ? `✓ ${found.name} (${found.exchange})`
        : `✗ Unknown ticker: ${upper}`,
    });
  }

  // Single ticker query
  if (ticker) {
    const data = generateOptionsData(ticker);
    return NextResponse.json({ data: [data], total: 1 });
  }

  // All tracked tickers (default 10)
  const defaultList = [
    "TSLA", "NVDA", "AMD", "AAPL", "MSTR",
    "COIN", "SMCI", "PLTR", "ARM", "AVGO",
  ];
  const results = defaultList.map(generateOptionsData);
  return NextResponse.json({
    data: results,
    total: results.length,
    generated_at: new Date().toISOString(),
  });
}

// ============================================================================
// POST — batch query with custom ticker list
// ============================================================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tickers: string[] = (body.tickers || [])
      .map((t: string) => t.toUpperCase().trim())
      .filter((t: string) => /^[A-Z]{1,5}$/.test(t));

    if (tickers.length === 0) {
      return NextResponse.json(
        { error: "No valid tickers provided", data: [] },
        { status: 400 }
      );
    }

    const results = tickers.map(generateOptionsData);

    return NextResponse.json({
      data: results,
      total: results.length,
      generated_at: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body", data: [] },
      { status: 400 }
    );
  }
}
