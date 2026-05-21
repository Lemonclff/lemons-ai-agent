import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { PYTHON_BIN, scriptPath, spawnPythonEnv } from "@/lib/config";

function runAnalyzer(ticker: string): Promise<unknown> {
  return new Promise((resolve) => {
    const proc = spawn(PYTHON_BIN, [scriptPath("ai_analyzer.py"), ticker], {
      timeout: 90000,
      env: spawnPythonEnv(),
    });
    let out = "";
    let errOut = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { errOut += d.toString(); });
    proc.on("close", () => {
      try { resolve(JSON.parse(out)); }
      catch {
        resolve({ status: "error", message: "Parse error", raw: out.slice(0, 500), stderr: errOut.slice(0, 300) });
      }
    });
    proc.on("error", (e) => resolve({ status: "error", message: e.message }));
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ticker = (body.ticker || "AAPL").toUpperCase().trim();
    if (!ticker || ticker.length > 10) {
      return NextResponse.json({ status: "error", message: "無效的股票代碼" }, { status: 400 });
    }
    const result = await runAnalyzer(ticker);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ status: "error", message: "請求處理失敗" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = (searchParams.get("ticker") || "AAPL").toUpperCase().trim();
  const result = await runAnalyzer(ticker);
  return NextResponse.json(result);
}
