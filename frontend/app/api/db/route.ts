import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { PYTHON_BIN, scriptPath, spawnPythonEnv } from "@/lib/config";

async function runQuery(sql: string): Promise<unknown> {
  return new Promise((resolve) => {
    const proc = spawn(PYTHON_BIN, [scriptPath("db_query.py"), sql], { timeout: 8000, env: spawnPythonEnv() });
    let out = "", errOut = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { errOut += d.toString(); });
    proc.on("close", () => {
      try { resolve(JSON.parse(out)); }
      catch { resolve({ error: "Parse error", raw: out.slice(0, 300), stderr: errOut.slice(0, 200) }); }
    });
    proc.on("error", (e) => resolve({ error: e.message }));
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sql = searchParams.get("sql");
  if (!sql) return NextResponse.json({ error: "Missing sql param" }, { status: 400 });
  const result = await runQuery(sql);
  return NextResponse.json(result);
}
