/**
 * Database API Route — v2 (clean)
 * GET /api/db?table=options_volatility_log
 * GET /api/db?sql=SELECT+*+FROM+tracked_tickers
 */

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";

const SCRIPT = "/home/lemon/lemons-ai-agent/scripts/db_query.py";

async function runQuery(sql: string): Promise<unknown> {
  return new Promise((resolve) => {
    const proc = spawn("python3", [SCRIPT, sql], { timeout: 8000 });
    let out = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.on("close", () => {
      try { resolve(JSON.parse(out)); }
      catch { resolve({ error: "Parse error", raw: out.slice(0, 300) }); }
    });
    proc.on("error", (e) => resolve({ error: e.message }));
  });
}

const SAFE_TABLES = ["options_volatility_log", "macro_economic_events", "tracked_tickers"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const table = searchParams.get("table");
  const rawSql = searchParams.get("sql");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

  let sql: string;

  if (rawSql) {
    if (!rawSql.toUpperCase().trimStart().startsWith("SELECT")) {
      return NextResponse.json({ error: "Only SELECT allowed" }, { status: 400 });
    }
    sql = rawSql;
  } else if (table && SAFE_TABLES.includes(table)) {
    sql = `SELECT * FROM ${table} ORDER BY rowid DESC LIMIT ${limit}`;
  } else {
    sql = `SELECT 'options_volatility_log' AS tbl, COUNT(*) AS rows FROM options_volatility_log UNION ALL SELECT 'macro_economic_events', COUNT(*) FROM macro_economic_events UNION ALL SELECT 'tracked_tickers', COUNT(*) FROM tracked_tickers`;
  }

  const result = await runQuery(sql);
  return NextResponse.json(result);
}
