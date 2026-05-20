import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";

const PYTHON = "/home/lemon/lemons-ai-agent/venv/bin/python3";
const SCRIPT = "/home/lemon/lemons-ai-agent/scripts/quant_analyzer.py";

function runAnalyzer(ticker: string): Promise<unknown> {
  return new Promise((resolve) => {
    const proc = spawn(PYTHON, [SCRIPT, ticker], {
      timeout: 30000,
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || "" },
    });
    let out = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.on("close", () => {
      try { resolve(JSON.parse(out)); }
      catch { resolve({ status: "error", message: "Parse error", raw: out.slice(0, 300) }); }
    });
    proc.on("error", (e) => resolve({ status: "error", message: e.message }));
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = (searchParams.get("ticker") || "NVDA").toUpperCase();

  const result = await runAnalyzer(ticker);
  return NextResponse.json(result);
}
