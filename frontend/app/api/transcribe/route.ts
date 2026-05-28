/**
 * Speech-to-Text Transcription API Routes
 *
 * GET  /api/transcribe?sub=scan          → List audio files in TempRecords
 * GET  /api/transcribe?sub=tasks         → List all transcription tasks
 * POST /api/transcribe                   → Start transcription (action=transcribe)
 * POST /api/transcribe (action=status)   → Check task progress
 * POST /api/transcribe (action=result)   → Get full transcription result
 * POST /api/transcribe (action=upload)   → Upload audio file
 */

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { verifyToken } from "@/lib/auth";
import { PYTHON_BIN, scriptPath, spawnPythonEnv } from "@/lib/config";

const SCRIPT = scriptPath("transcribe_backend.py");

function runTranscribe(args: string[], stdin?: string): Promise<unknown> {
  return new Promise((resolve) => {
    const proc = spawn(PYTHON_BIN, [SCRIPT, ...args], {
      timeout: 300000,
      env: spawnPythonEnv(),
      stdio: stdin ? ["pipe", "pipe", "pipe"] : undefined,
    });
    let out = "", errOut = "";
    proc.stdout?.on("data", (d: Buffer) => { out += d.toString(); });
    proc.stderr?.on("data", (d: Buffer) => { errOut += d.toString(); });
    if (stdin && proc.stdin) { proc.stdin.write(stdin); proc.stdin.end(); }
    proc.on("close", () => {
      try { resolve(JSON.parse(out)); }
      catch { resolve({ error: "Parse error", raw: out.slice(0, 500), stderr: errOut.slice(0, 300) }); }
    });
    proc.on("error", (e: Error) => resolve({ error: e.message }));
  });
}

function getAuth(req: NextRequest): { userId: number; isAdmin: boolean } | null {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  return { userId: payload.userId || 1, isAdmin: !!payload.isAdmin };
}

export async function GET(req: NextRequest) {
  const auth = getAuth(req);
  if (!auth) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sub = searchParams.get("sub") || "scan";

  if (sub === "scan") {
    if (!auth.isAdmin) return NextResponse.json({ error: "需管理員權限" }, { status: 403 });
    const result = await runTranscribe(["scan"]);
    return NextResponse.json(result);
  }

  if (sub === "tasks") {
    const result = await runTranscribe(["tasks"]);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unknown sub-action" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const auth = getAuth(req);
  if (!auth) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const body = await req.json();
  const action = body.action || "transcribe";

  if (action === "transcribe") {
    if (!auth.isAdmin) return NextResponse.json({ error: "需管理員權限" }, { status: 403 });
    const filePath = body.file_path;
    if (!filePath) return NextResponse.json({ error: "Missing file_path" }, { status: 400 });

    const model = body.model || "cantonese";
    const language = body.language || "yue";
    const diarize = body.diarize === true;
    const numSpeakers = body.num_speakers || 0;

    const args = ["transcribe", filePath, "--model", model, "--language", language];
    if (diarize) {
      args.push("--diarize");
      if (numSpeakers > 0) args.push("--speakers", String(numSpeakers));
    }

    const result = await runTranscribe(args);
    return NextResponse.json(result);
  }

  if (action === "status") {
    const taskId = body.task_id;
    if (!taskId) return NextResponse.json({ error: "Missing task_id" }, { status: 400 });
    const result = await runTranscribe(["status", taskId]);
    return NextResponse.json(result);
  }

  if (action === "result") {
    const taskId = body.task_id;
    if (!taskId) return NextResponse.json({ error: "Missing task_id" }, { status: 400 });
    const result = await runTranscribe(["result", taskId]);
    return NextResponse.json(result);
  }

  if (action === "upload") {
    if (!auth.isAdmin) return NextResponse.json({ error: "需管理員權限" }, { status: 403 });
    const { fileName, content } = body;
    if (!fileName || !content) return NextResponse.json({ error: "Missing fileName or content" }, { status: 400 });
    // For binary files, content should be base64
    const buf = Buffer.from(content, "base64");
    // Write tmp file then pass to Python via stdin
    const tmpPath = `/tmp/transcribe_upload_${Date.now()}_${fileName}`;
    const fs = await import("fs");
    fs.writeFileSync(tmpPath, buf);
    // Use upload subcommand via stdin
    const pythonArgs = ["upload", fileName];
    const result = await runTranscribe(pythonArgs, buf.toString("base64"));
    // Actually, let's just write to disk directly
    const homeDir = process.env.HOME || "/home/lemon";
    const destDir = `${homeDir}/TempRecords`;
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(`${destDir}/${fileName}`, buf);
    return NextResponse.json({ success: true, path: `${destDir}/${fileName}`, size: buf.length });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
