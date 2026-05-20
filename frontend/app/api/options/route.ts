/**
 * Options & Volatility API Route (Live Data)
 *
 * POST /api/options  { tickers: ["NVDA","TSLA",...] }
 *
 * Spawns the Python options_api.py worker which fetches real-time
 * options chain data from Yahoo Finance (yfinance).
 *
 * Server-side cache: 60-second TTL per ticker set.
 * Falls back to deterministic mock data if Python is unavailable.
 */

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

const PYTHON = "/home/lemon/lemons-ai-agent/venv/bin/python3";
const SCRIPT = path.resolve(process.cwd(), "..", "scripts", "options_api.py");
const CACHE_TTL = 60_000; // 60 seconds

// Simple in-memory cache
let cache: { key: string; data: unknown; ts: number } | null = null;

async function callPythonWorker(tickers: string[]): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, [SCRIPT], {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 45_000, // 45s total timeout
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code: number) => {
      if (code !== 0) {
        console.error(`[options_api] exit ${code}: ${stderr.slice(0, 200)}`);
        return reject(new Error(`Python exited ${code}`));
      }
      try {
        const data = JSON.parse(stdout);
        resolve(data);
      } catch (e) {
        console.error(`[options_api] JSON parse error: ${stdout.slice(0, 200)}`);
        reject(e);
      }
    });

    proc.on("error", (err: Error) => {
      console.error(`[options_api] spawn error: ${err.message}`);
      reject(err);
    });

    // Send tickers as JSON via stdin
    proc.stdin.write(JSON.stringify(tickers));
    proc.stdin.end();
  });
}

function generateFallbackData(tickers: string[]): unknown[] {
  // Deterministic mock — same algorithm as frontend for consistency
  const BASE: Record<string, [number, number]> = {
    TSLA: [404, 38], NVDA: [223, 75], AMD: [155, 52], AAPL: [298, 20],
    MSTR: [450, 82], COIN: [310, 68], SMCI: [55, 72], PLTR: [115, 55],
    ARM: [165, 48], AVGO: [235, 35], MSFT: [480, 28], GOOGL: [205, 30],
    META: [595, 35], AMZN: [230, 30], NFLX: [980, 42], INTC: [42, 45],
  };

  function hash(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function rng(seed: number): () => number {
    let s = seed | 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const seed = Math.floor(Date.now() / 3600000);
  return tickers.map((t) => {
    const [basePrice, baseIV] = BASE[t] || [50 + hash(t) % 500, 30 + hash(t) % 50];
    const rand = rng(hash(t) ^ seed);
    const price = basePrice * (0.95 + rand() * 0.10);
    const iv = baseIV * (0.85 + rand() * 0.30);
    const hv = iv * (0.6 + rand() * 0.35);
    const spread = iv - hv;
    const pcr = 0.5 + rand() * 1.5;
    const unusual = spread > 28 || pcr > 1.8;
    return {
      ticker: t, name: t,
      price: Math.round(price * 100) / 100,
      change_pct: Math.round((rand() - 0.45) * 8 * 100) / 100,
      implied_volatility: Math.round(iv * 100) / 100,
      historical_volatility: Math.round(hv * 100) / 100,
      iv_hv_spread: Math.round(spread * 100) / 100,
      put_call_ratio: Math.round(pcr * 100) / 100,
      call_volume: Math.floor(100000 + rand() * 500000),
      put_volume: Math.floor(50000 + rand() * 300000),
      total_volume: 0,
      unusual_activity: unusual,
      ai_alert: unusual ? `⚠️ ${t} IV spread=${spread.toFixed(1)}%` : undefined,
      last_updated: new Date().toISOString(),
      _source: "mock",
    };
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawTickers: string[] = body.tickers || [];
    const tickers = rawTickers
      .map((t: string) => t.toUpperCase().trim())
      .filter((t: string) => /^[A-Z]{1,5}$/.test(t))
      .slice(0, 20);

    if (tickers.length === 0) {
      return NextResponse.json({ error: "No valid tickers", data: [] }, { status: 400 });
    }

    const cacheKey = tickers.sort().join(",");

    // Check cache
    if (cache && cache.key === cacheKey && Date.now() - cache.ts < CACHE_TTL) {
      return NextResponse.json({
        data: cache.data,
        total: (cache.data as unknown[]).length,
        cached: true,
        generated_at: new Date().toISOString(),
        _source: "cache",
      });
    }

    // Try live Python worker
    let data: unknown[];
    let source = "unknown";
    try {
      data = await callPythonWorker(tickers);
      source = "yfinance";
      // Update cache
      cache = { key: cacheKey, data, ts: Date.now() };
    } catch (err) {
      console.warn("[options_api] Python worker failed, using fallback:", String(err));
      data = generateFallbackData(tickers);
      source = "mock_fallback";
    }

    return NextResponse.json({
      data,
      total: data.length,
      cached: false,
      generated_at: new Date().toISOString(),
      _source: source,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request", data: [] }, { status: 400 });
  }
}
