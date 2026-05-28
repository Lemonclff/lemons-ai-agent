/**
 * Speech-to-Text API Routes v2
 *
 * GET  ?sub=scan             → list audio files
 * GET  ?sub=list-transcripts  → list transcript files
 * GET  ?sub=list-summaries    → list summary files
 * GET  ?sub=tasks             → list task history
 * POST {action:"read-file"}   → read file content
 * POST {action:"upload"}      → upload audio file
 * POST {action:"transcribe"}  → start transcription (async)
 * POST {action:"status"}      → poll task progress
 * POST {action:"result"}      → get transcript result
 * POST {action:"analyze"}     → AI summary of transcript
 */

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { verifyToken } from "@/lib/auth";
import { PYTHON_BIN, scriptPath, spawnPythonEnv } from "@/lib/config";
import * as fs from "fs";
import * as path from "path";

const SCRIPT = scriptPath("transcribe_backend.py");

function runPython(args: string[], stdin?: string): Promise<unknown> {
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

// ── GET ──
export async function GET(req: NextRequest) {
  const auth = getAuth(req);
  if (!auth) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sub = searchParams.get("sub") || "scan";

  // Admin-only: scan audio files, list all transcripts/summaries
  const adminSubs = ["scan", "list-transcripts", "list-summaries"];
  if (adminSubs.includes(sub) && !auth.isAdmin) {
    return NextResponse.json({ error: "需管理員權限" }, { status: 403 });
  }

  if (sub === "scan")              return NextResponse.json(await runPython(["scan"]));
  if (sub === "list-transcripts")  return NextResponse.json(await runPython(["list-transcripts"]));
  if (sub === "list-summaries")    return NextResponse.json(await runPython(["list-summaries"]));
  if (sub === "tasks")             return NextResponse.json(await runPython(["tasks"]));

  // ── DOWNLOAD file ──
  if (sub === "download") {
    const filePath = searchParams.get("path");
    if (!filePath) return NextResponse.json({ error: "Missing path" }, { status: 400 });

    // Security: only allow paths under TempRecords
    const resolved = path.resolve(filePath);
    const allowedRoot = path.resolve(`${process.env.HOME || "/home/lemon"}/TempRecords`);
    if (!resolved.startsWith(allowedRoot)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!fs.existsSync(resolved)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const content = fs.readFileSync(resolved);
    const fileName = path.basename(resolved);
    const ext = path.extname(resolved).toLowerCase();

    const mimeTypes: Record<string, string> = {
      ".txt": "text/plain; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".m4a": "audio/mp4",
      ".mp4": "video/mp4",
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
      ".webm": "audio/webm",
    };
    const contentType = mimeTypes[ext] || "application/octet-stream";

    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Content-Length": String(content.length),
      },
    });
  }

  return NextResponse.json({ error: "Unknown sub-action" }, { status: 400 });
}

// ── POST ──
export async function POST(req: NextRequest) {
  const auth = getAuth(req);
  if (!auth) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const body = await req.json();
  const action = body.action || "transcribe";

  // Admin-only actions
  const adminActions = ["transcribe", "upload", "analyze"];
  if (adminActions.includes(action) && !auth.isAdmin) {
    return NextResponse.json({ error: "需管理員權限" }, { status: 403 });
  }

  // ── READ-FILE (any auth user) ──
  if (action === "read-file") {
    const filePath = body.file_path;
    if (!filePath) return NextResponse.json({ error: "Missing file_path" }, { status: 400 });
    const result = await runPython(["read-file", filePath]);
    return NextResponse.json(result);
  }

  // ── UPLOAD ──
  if (action === "upload") {
    const { fileName, content } = body;
    if (!fileName || !content) return NextResponse.json({ error: "Missing fileName or content" }, { status: 400 });
    const buf = Buffer.from(content, "base64");
    const destDir = `${process.env.HOME || "/home/lemon"}/TempRecords/audio`;
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(path.join(destDir, path.basename(fileName)), buf);
    return NextResponse.json({ success: true, path: path.join(destDir, path.basename(fileName)), size: buf.length });
  }

  // ── TRANSCRIBE ──
  if (action === "transcribe") {
    const filePath = body.file_path;
    if (!filePath) return NextResponse.json({ error: "Missing file_path" }, { status: 400 });
    const args = ["transcribe", filePath, "--model", body.model || "large-v3", "--language", body.language || "yue"];
    if (body.diarize) { args.push("--diarize"); if (body.num_speakers > 0) args.push("--speakers", String(body.num_speakers)); }
    return NextResponse.json(await runPython(args));
  }

  // ── ANALYZE (AI summary) ──
  if (action === "analyze") {
    const filePath = body.file_path;
    if (!filePath) return NextResponse.json({ error: "Missing file_path" }, { status: 400 });
    const args = ["analyze", filePath, "--provider", body.provider || "nvidia"];
    if (body.llm_model) args.push("--model", body.llm_model);
    if (body.recording_type && body.recording_type !== "auto") {
      args.push("--recording-type", body.recording_type);
    }
    return NextResponse.json(await runPython(args));
  }

  // ── STATUS / RESULT ──
  if (action === "status") {
    if (!body.task_id) return NextResponse.json({ error: "Missing task_id" }, { status: 400 });
    return NextResponse.json(await runPython(["status", body.task_id]));
  }
  if (action === "result") {
    if (!body.task_id) return NextResponse.json({ error: "Missing task_id" }, { status: 400 });
    return NextResponse.json(await runPython(["result", body.task_id]));
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
