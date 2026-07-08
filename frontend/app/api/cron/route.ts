import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { verifyToken } from "@/lib/auth";
import { PYTHON_BIN, scriptPath, HERMES_PYTHON, HERMES_CLI, spawnPythonEnv } from "@/lib/config";

function runScript(args: string[]): Promise<unknown> {
  return new Promise((resolve) => {
    const proc = spawn(PYTHON_BIN, [scriptPath("cron_control.py"), ...args], { timeout: 10000 });
    let out = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.on("close", () => {
      try { resolve(JSON.parse(out)); }
      catch { resolve({ ok: false, error: "Parse error", raw: out.slice(0, 300) }); }
    });
    proc.on("error", (e) => resolve({ ok: false, error: e.message }));
  });
}

function controlHermesJob(jobId: string, action: string): Promise<{ ok: boolean; message: string }> {
  return new Promise((resolve) => {
    const proc = spawn(HERMES_PYTHON, [HERMES_CLI, "cron", action, jobId], { timeout: 15000 });
    let out = "", errOut = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { errOut += d.toString(); });
    proc.on("close", (code) => {
      resolve({ ok: code === 0, message: errOut || out || `Exit ${code}` });
    });
    proc.on("error", (e) => resolve({ ok: false, message: e.message }));
  });
}

function updateHermesJob(jobId: string, update: { schedule?: string; deliver?: string }): Promise<{ ok: boolean; message: string }> {
  return new Promise((resolve) => {
    const parts: string[] = [HERMES_CLI, "cron", "edit", jobId];
    if (update.schedule) {
      parts.push("--schedule", update.schedule);
    }
    if (update.deliver !== undefined && update.deliver !== "") {
      parts.push("--deliver", update.deliver);
    } else if (update.deliver === "") {
      parts.push("--deliver", "origin");
    }
    const proc = spawn(HERMES_PYTHON, parts, { timeout: 15000 });
    let out = "", errOut = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { errOut += d.toString(); });
    proc.on("close", (code) => {
      resolve({ ok: code === 0, message: errOut || out || `Exit ${code}` });
    });
    proc.on("error", (e) => resolve({ ok: false, message: e.message }));
  });
}

function cronLabel(schedule: string): string {
  const parts = schedule.split(" ");
  if (parts.length < 5) return schedule;
  const [min, hour, _day, _mon, dow] = parts;
  const parts2: string[] = [];
  if (min.startsWith("*/")) parts2.push(`Every ${min.slice(2)} min`);
  else if (min === "0") parts2.push("On the hour");
  else parts2.push(`:${min}`);
  if (hour === "*") parts2.push("every hour");
  else if (hour === "*/60") parts2.push("disabled");
  else parts2.push(`${hour}:00`);
  if (dow === "1-5") parts2.push("Weekdays");
  return parts2.join(" ");
}

export async function GET(req: NextRequest) {
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

  if (!payload.isAdmin) {
    return NextResponse.json({ error: "需管理員權限" }, { status: 403 });
  }

  // --- macro-economic: special bridge between local state + Hermes cron ---
  if (jobId === "macro-economic") {
    if (action === "update_schedule") {
      const newSchedule = searchParams.get("schedule");
      if (!newSchedule) return NextResponse.json({ error: "Missing schedule" }, { status: 400 });

      const localStatus = searchParams.get("local_status") || "active";
      await runScript([localStatus === "paused" ? "pause" : "resume", "macro-economic"]);
      const hermesResult = await updateHermesJob("06d4f59389c5", { schedule: newSchedule });

      return NextResponse.json({
        ok: hermesResult.ok,
        job_id: "macro-economic",
        action,
        schedule: newSchedule,
        schedule_label: cronLabel(newSchedule),
        hermes: hermesResult.message,
      });
    }

    if (action === "update_deliver") {
      const deliverTarget = searchParams.get("deliver");
      if (deliverTarget === null) return NextResponse.json({ error: "Missing deliver" }, { status: 400 });

      const hermesResult = await updateHermesJob("06d4f59389c5", { deliver: deliverTarget });
      return NextResponse.json({
        ok: hermesResult.ok,
        job_id: "macro-economic",
        action,
        deliver: deliverTarget,
        hermes: hermesResult.message,
      });
    }

    if (action === "pause" || action === "resume" || action === "run") {
      const hermesAction = action === "pause" ? "pause" : action === "resume" ? "resume" : "run";
      const hermesResult = await controlHermesJob("06d4f59389c5", hermesAction);
      const localStatus = action === "pause" ? "paused" : action === "resume" ? "active" : "running";
      await runScript([localStatus === "paused" ? "pause" : localStatus === "active" ? "resume" : "run", "macro-economic"]);
      return NextResponse.json({ ok: hermesResult.ok, job_id: "macro-economic", action, hermes: hermesResult.message });
    }
  }

  // --- Generic pause/resume/run for other jobs ---
  if (action === "pause" || action === "resume" || action === "run") {
    const result = await runScript([action, jobId]);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
