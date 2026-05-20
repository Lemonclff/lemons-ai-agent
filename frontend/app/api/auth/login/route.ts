import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { queryOne } from "@/lib/db";
import { signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "請填寫使用者名稱和密碼" }, { status: 400 });
    }

    const name = username.trim().toLowerCase();
    const user = await queryOne<{ id: number; password_hash: string; is_admin: boolean }>(
      "SELECT id, password_hash, COALESCE(is_admin, false) as is_admin FROM users WHERE username = $1",
      [name]
    );

    if (!user) {
      return NextResponse.json({ error: "使用者不存在或密碼錯誤" }, { status: 401 });
    }

    const valid = await compare(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "使用者不存在或密碼錯誤" }, { status: 401 });
    }

    const token = signToken({ userId: user.id, username: name, isAdmin: !!user.is_admin });
    const res = NextResponse.json({ ok: true, username: name });

    res.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (e) {
    console.error("Login error:", e);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
