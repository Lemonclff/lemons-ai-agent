import { NextResponse } from "next/server";
import { spawn } from "child_process";

const PYTHON = "/home/lemon/lemons-ai-agent/venv/bin/python3";
const SCRIPT = "/home/lemon/lemons-ai-agent/scripts/opportunity_radar.py";

function runRadar(): Promise<unknown> {
  return new Promise((resolve) => {
    const proc = spawn(PYTHON, [SCRIPT], { timeout: 60000 });
    let out = "";
    let errOut = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { errOut += d.toString(); });
    proc.on("close", () => {
      try { resolve(JSON.parse(out)); }
      catch { resolve({ error: "Parse error", raw: out.slice(0, 300), stderr: errOut.slice(0, 200) }); }
    });
    proc.on("error", (e) => resolve({ error: e.message }));
  });
}

let cached: unknown = null;
let cacheTime = 0;
const TTL = 3 * 60 * 1000; // 3 min (mirrors QuantDinger)

export async function GET() {
  const now = Date.now();
  if (cached && (now - cacheTime) < TTL) {
    return NextResponse.json(cached);
  }
  const result = await runRadar();
  if (Array.isArray(result)) {
    cached = result;
    cacheTime = now;
  }
  return NextResponse.json(result);
}
