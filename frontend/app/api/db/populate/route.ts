import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";

const PYTHON = "/home/lemon/lemons-ai-agent/venv/bin/python3";
const SCRIPT = "/home/lemon/lemons-ai-agent/scripts/db_populate.py";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const input = JSON.stringify(data);

    const result = await new Promise<string>((resolve, reject) => {
      const proc = spawn(PYTHON, [SCRIPT], {
        timeout: 15000,
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || "", PYTHONPATH: "/home/lemon/lemons-ai-agent/scripts" },
      });
      let out = "";
      proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
      proc.on("close", () => resolve(out));
      proc.on("error", (e) => reject(e));
      proc.stdin.write(input);
      proc.stdin.end();
    });

    return NextResponse.json({ ok: true, output: result.trim() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message });
  }
}
