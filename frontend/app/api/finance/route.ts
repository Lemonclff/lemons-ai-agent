/**
 * Personal Finance API Routes
 *
 * GET  /api/finance/scan          → List TempRecords files
 * POST /api/finance/parse         → AI OCR parse a file
 * GET  /api/finance/transactions  → Query transactions (with admin override)
 * POST /api/finance/transactions  → Batch insert confirmed transactions
 * GET  /api/finance/stats         → Dashboard statistics
 * GET  /api/finance/admin-users   → List all users (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { verifyToken } from "@/lib/auth";
import { PYTHON_BIN, scriptPath, spawnPythonEnv } from "@/lib/config";

const SCRIPT = scriptPath("finance_backend.py");

function runFinance(args: string[], stdin?: string, script?: string): Promise<unknown> {
  return new Promise((resolve) => {
    const proc = spawn(PYTHON_BIN, [script || SCRIPT, ...args], {
      timeout: 180000,
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
  const sub = searchParams.get("sub") || "transactions";

  if (sub === "scan") {
    if (!auth.isAdmin) return NextResponse.json({ error: "需管理員權限" }, { status: 403 });
    const result = await runFinance(["scan"]);
    return NextResponse.json(result);
  }

  if (sub === "transactions") {
    const month = searchParams.get("month") || "";
    const viewUserId = searchParams.get("view_user_id");
    const adminView = auth.isAdmin && viewUserId;
    const args = ["query", "--user-id", String(auth.userId)];
    if (month) args.push("--month", month);
    if (adminView) { args.push("--admin", "--view-user-id", String(viewUserId)); }
    const result = await runFinance(args);
    return NextResponse.json(result);
  }

  if (sub === "stats") {
    const month = searchParams.get("month") || "";
    const viewUserId = searchParams.get("view_user_id");
    const adminView = auth.isAdmin && viewUserId;
    const args = ["stats", "--user-id", String(auth.userId)];
    if (month) args.push("--month", month);
    if (adminView) { args.push("--admin", "--view-user-id", String(viewUserId)); }
    const result = await runFinance(args);
    return NextResponse.json(result);
  }

  if (sub === "admin-users") {
    if (!auth.isAdmin) return NextResponse.json({ error: "需管理員權限" }, { status: 403 });
    const result = await runFinance(["admin-users"]);
    return NextResponse.json(result);
  }

  if (sub === "tasks") {
    const taskResult = await runFinance(["list"], undefined, scriptPath("task_queue.py"));
    return NextResponse.json(taskResult);
  }

  if (sub === "task-staging") {
    const taskId = searchParams.get("task_id");
    if (!taskId) return NextResponse.json({ error: "Missing task_id" }, { status: 400 });
    const taskResult = await runFinance(["staging", taskId], undefined, scriptPath("task_queue.py"));
    return NextResponse.json(taskResult);
  }

  if (sub === "staging-all") {
    const taskResult = await runFinance(["staging", "--all"], undefined, scriptPath("task_queue.py"));
    return NextResponse.json(taskResult);
  }

  return NextResponse.json({ error: "Unknown sub-action" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const auth = getAuth(req);
  if (!auth) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const body = await req.json();
  const action = body.action || "parse";

  if (action === "parse") {
    if (!auth.isAdmin) return NextResponse.json({ error: "需管理員權限" }, { status: 403 });
    const filePath = body.file_path;
    if (!filePath) return NextResponse.json({ error: "Missing file_path" }, { status: 400 });
    const provider = body.provider || "nvidia";
    // Use task_queue wrapper (immediate DB insert + stuck detection)
    const result = await runFinance(["parse-async", filePath, provider, String(auth.userId)], undefined, scriptPath("task_queue.py"));
    return NextResponse.json(result);
  }

  if (action === "parse-status") {
    const taskId = body.task_id;
    if (!taskId) return NextResponse.json({ error: "Missing task_id" }, { status: 400 });
    const result = await runFinance(["parse-status", taskId], undefined, scriptPath("task_queue.py"));
    return NextResponse.json(result);
  }

  if (action === "insert") {
    const transactions = body.transactions;
    if (!transactions || !Array.isArray(transactions)) {
      return NextResponse.json({ error: "Missing transactions array" }, { status: 400 });
    }
    const result = await runFinance(
      ["insert", "--user-id", String(auth.userId)],
      JSON.stringify(transactions),
    );
    return NextResponse.json(result);
  }

  if (action === "upload") {
    if (!auth.isAdmin) return NextResponse.json({ error: "需管理員權限" }, { status: 403 });
    const { fileName, content } = body;
    if (!fileName || !content) return NextResponse.json({ error: "Missing fileName or content" }, { status: 400 });
    const uploadResult = await runFinance(["upload", fileName], content);
    return NextResponse.json(uploadResult);
  }

  if (action === "update") {
    const { transaction_id, field, value } = body;
    if (!transaction_id || !field) return NextResponse.json({ error: "Missing transaction_id or field" }, { status: 400 });
    const result = await runFinance(["update", transaction_id, field, String(value)]);
    return NextResponse.json(result);
  }

  if (action === "delete") {
    const { transaction_id } = body;
    if (!transaction_id) return NextResponse.json({ error: "Missing transaction_id" }, { status: 400 });
    const result = await runFinance(["delete", transaction_id]);
    return NextResponse.json(result);
  }

  if (action === "confirm-task") {
    const taskId = body.task_id;
    if (!taskId) return NextResponse.json({ error: "Missing task_id" }, { status: 400 });
    const result = await runFinance(["confirm", taskId, String(auth.userId)], undefined, scriptPath("task_queue.py"));
    return NextResponse.json(result);
  }

  if (action === "cancel-task") {
    const taskId = body.task_id;
    if (!taskId) return NextResponse.json({ error: "Missing task_id" }, { status: 400 });
    const result = await runFinance(["cancel", taskId], undefined, scriptPath("task_queue.py"));
    return NextResponse.json(result);
  }

  if (action === "kill-task") {
    const taskId = body.task_id;
    if (!taskId) return NextResponse.json({ error: "Missing task_id" }, { status: 400 });
    const result = await runFinance(["kill", taskId], undefined, scriptPath("task_queue.py"));
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
