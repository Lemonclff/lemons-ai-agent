import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { PYTHON_BIN, scriptPath, spawnPythonEnv } from "@/lib/config";

function queryEvents(days: number): Promise<unknown> {
  return new Promise((resolve) => {
    const proc = spawn(PYTHON_BIN, [scriptPath("economic_calendar.py"), "--query", "--days", String(days)], {
      timeout: 30000,
      env: spawnPythonEnv(),
    });
    let out = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.on("close", () => {
      try { resolve(JSON.parse(out)); }
      catch { resolve([]); }
    });
    proc.on("error", () => resolve([]));
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = Math.min(parseInt(searchParams.get("days") || "30", 10), 60);
  const events = await queryEvents(days);
  const eventsArr = Array.isArray(events) ? events : [];
  return NextResponse.json({ data: eventsArr, total: eventsArr.length, generated_at: new Date().toISOString(), _source: "postgresql" });
}
