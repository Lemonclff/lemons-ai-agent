/**
 * Shared project configuration — centralized paths and constants.
 * All API routes import from here instead of hardcoding paths.
 *
 * Edit PROJECT_ROOT once, every route follows.
 */
import path from "path";
import fs from "fs";

// Detect project root: go up from frontend/ to repo root
export const PROJECT_ROOT = path.resolve(process.cwd(), "..");

// Python venv
export const PYTHON_BIN = path.join(PROJECT_ROOT, "venv", "bin", "python3");
export const SCRIPTS_DIR = path.join(PROJECT_ROOT, "scripts");

// Hermes CLI (for cron job control)
export const HERMES_DIR = path.join(
  process.env.HOME || "/home",
  ".hermes",
  "hermes-agent"
);
export const HERMES_PYTHON = path.join(HERMES_DIR, "venv", "bin", "python3");
export const HERMES_CLI = path.join(HERMES_DIR, "hermes_cli", "main.py");

// Next.js frontend
export const FRONTEND_DIR = path.join(PROJECT_ROOT, "frontend");

// Helper: build script path
export function scriptPath(name: string): string {
  return path.join(SCRIPTS_DIR, name);
}

// Helper: spawn Python script with standard env
export function spawnPythonEnv(): Record<string, string> {
  return {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL || "",
    NVIDIA_API_KEY: process.env.NVIDIA_API_KEY || "",
    NVIDIA_MODEL: process.env.NVIDIA_MODEL || "",
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || "",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
    PYTHONPATH: SCRIPTS_DIR,
  } as Record<string, string>;
}

// Validate on import (dev-time check)
if (!fs.existsSync(PYTHON_BIN)) {
  console.warn(`[config] WARNING: Python not found at ${PYTHON_BIN}`);
}
if (!fs.existsSync(SCRIPTS_DIR)) {
  console.warn(`[config] WARNING: Scripts dir not found at ${SCRIPTS_DIR}`);
}
