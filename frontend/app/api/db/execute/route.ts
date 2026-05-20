import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST(req: NextRequest) {
  // Admin only
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return NextResponse.json({ error: "未登入" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload?.isAdmin) return NextResponse.json({ error: "需管理員權限" }, { status: 403 });

  try {
    const { sql, params } = await req.json();
    if (!sql) return NextResponse.json({ error: "SQL required" }, { status: 400 });

    const upper = sql.trim().toUpperCase();
    // Block DROP, TRUNCATE, ALTER for safety
    const blocked = ["DROP", "TRUNCATE", "ALTER", "CREATE", "GRANT", "REVOKE"];
    if (blocked.some((kw) => upper.startsWith(kw))) {
      return NextResponse.json({ error: `Blocked: ${upper.split(" ")[0]} not allowed via API` }, { status: 403 });
    }

    const result = await query(sql, params || []);
    return NextResponse.json({
      ok: true,
      rowCount: result.rowCount || 0,
      command: result.command,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message });
  }
}
