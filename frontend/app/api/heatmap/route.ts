import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { PYTHON_BIN, scriptPath } from "@/lib/config";

function runFetcher(category: string): Promise<unknown> {
  return new Promise((resolve) => {
    const proc = spawn(PYTHON_BIN, [scriptPath("heatmap_fetcher.py"), category], { timeout: 30000 });
    let out = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.on("close", () => {
      try { resolve(JSON.parse(out)); }
      catch { resolve({ error: "Parse error", raw: out.slice(0, 200) }); }
    });
    proc.on("error", (e) => resolve({ error: e.message }));
  });
}

// Per-category cache (TTL 2 min — mirrors QuantDinger)
const cache: Record<string, { data: unknown; time: number }> = {};
const TTL = 2 * 60 * 1000;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("type") || "commodities";

  const now = Date.now();
  const entry = cache[category];
  if (entry && (now - entry.time) < TTL) {
    return NextResponse.json(entry.data);
  }

  const result = await runFetcher(category);
  if (Array.isArray(result)) {
    cache[category] = { data: result, time: now };
  }
  return NextResponse.json(result);
}
