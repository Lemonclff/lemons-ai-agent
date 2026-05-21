import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { PYTHON_BIN, scriptPath, spawnPythonEnv } from "@/lib/config";

function runAnalyzer(ticker: string): Promise<unknown> {
  return new Promise((resolve) => {
    const proc = spawn(PYTHON_BIN, [scriptPath("quant_analyzer.py"), ticker], {
      timeout: 30000,
      env: spawnPythonEnv(),
    });
    let out = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.on("close", () => { try { resolve(JSON.parse(out)); } catch { resolve({ error: "Parse error" }); } });
    proc.on("error", (e) => resolve({ error: e.message }));
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = (searchParams.get("ticker") || "").toUpperCase().trim();
  if (!ticker) return NextResponse.json({ error: "Missing ticker" }, { status: 400 });
  return NextResponse.json(await runAnalyzer(ticker));
}
