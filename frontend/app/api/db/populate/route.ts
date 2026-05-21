import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { PYTHON_BIN, scriptPath, spawnPythonEnv } from "@/lib/config";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const input = JSON.stringify(data);
    const result = await new Promise<string>((resolve, reject) => {
      const proc = spawn(PYTHON_BIN, [scriptPath("db_populate.py")], {
        timeout: 15000,
        env: spawnPythonEnv(),
      });
      let out = "";
      proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
      proc.on("close", () => resolve(out));
      proc.on("error", (e) => reject(e));
      proc.stdin.write(input);
      proc.stdin.end();
    });
    return NextResponse.json({ ok: true, output: result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
