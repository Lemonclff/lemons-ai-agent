import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { PYTHON_BIN, scriptPath } from "@/lib/config";

function runFetcher(): Promise<unknown> {
  return new Promise((resolve) => {
    const proc = spawn(PYTHON_BIN, [scriptPath("sentiment_fetcher.py")], { timeout: 30000 });
    let out = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.on("close", () => {
      try { resolve(JSON.parse(out)); }
      catch { resolve({ status: "error", message: "Parse error", raw: out.slice(0, 300) }); }
    });
    proc.on("error", (e) => resolve({ status: "error", message: e.message }));
  });
}

// Cache in memory (30 min TTL)
let cachedResult: unknown = null;
let cacheTime = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 min

export async function GET() {
  const now = Date.now();
  if (cachedResult && (now - cacheTime) < CACHE_TTL) {
    return NextResponse.json(cachedResult);
  }
  const result = await runFetcher();
  cachedResult = result;
  cacheTime = now;
  return NextResponse.json(result);
}
