import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { verifyToken } from "@/lib/auth";

const PYTHON = "/home/lemon/lemons-ai-agent/venv/bin/python3";
const SCRIPT = "/home/lemon/lemons-ai-agent/scripts/cron_control.py";

function runScript(args: string[]): Promise<unknown> {
  return new Promise((resolve) => {
    const proc = spawn(PYTHON, [SCRIPT, ...args], { timeout: 10000 });
    let out = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.on("close", () => {
      try { resolve(JSON.parse(out)); }
      catch { resolve({ ok: false, error: "Parse error", raw: out.slice(0, 300) }); }
    });
    proc.on("error", (e) => resolve({ ok: false, error: e.message }));
  });
}

export async function GET(req: NextRequest) {
  // Admin check
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Token 無效" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "list";
  const jobId = searchParams.get("job_id") || "";

  if (action === "list") {
    const result = await runScript(["list"]);
    return NextResponse.json(result);
  }

  if (action === "pause" || action === "resume" || action === "run") {
    // Write ops require admin
    if (!payload.isAdmin) {
      return NextResponse.json({ error: "需管理員權限" }, { status: 403 });
    }
    const result = await runScript([action, jobId]);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
