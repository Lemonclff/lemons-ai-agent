import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { verifyToken } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    // 1. Verify admin auth
    const token = req.cookies.get("auth_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }
    const payload = verifyToken(token);
    if (!payload || !payload.isAdmin) {
      return NextResponse.json({ error: "無管理員權限" }, { status: 403 });
    }

    // 2. Parse request
    const { username, new_password } = await req.json();
    if (!username || !new_password || new_password.length < 6) {
      return NextResponse.json(
        { error: "請提供使用者名稱和新密碼（至少 6 字元）" },
        { status: 400 }
      );
    }

    // 3. Check user exists
    const user = await queryOne<{ id: number }>(
      "SELECT id FROM users WHERE username = $1",
      [username.trim().toLowerCase()]
    );
    if (!user) {
      return NextResponse.json({ error: "使用者不存在" }, { status: 404 });
    }

    // 4. Hash and update
    const passwordHash = await hash(new_password, 10);
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      passwordHash,
      user.id,
    ]);

    return NextResponse.json({
      ok: true,
      message: `${username} 密碼已重置`,
    });
  } catch (e) {
    console.error("Admin reset error:", e);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
