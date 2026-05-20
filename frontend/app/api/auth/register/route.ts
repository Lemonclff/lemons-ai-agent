import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { queryOne } from "@/lib/db";
import { signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (
      !username ||
      !password ||
      typeof username !== "string" ||
      typeof password !== "string"
    ) {
      return NextResponse.json({ error: "請填寫使用者名稱和密碼" }, { status: 400 });
    }

    const name = username.trim().toLowerCase();
    if (name.length < 3 || name.length > 30) {
      return NextResponse.json({ error: "使用者名稱需 3-30 字元" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "密碼需至少 6 字元" }, { status: 400 });
    }

    // Check if username exists
    const existing = await queryOne(
      "SELECT id FROM users WHERE username = $1",
      [name]
    );
    if (existing) {
      return NextResponse.json({ error: "此使用者名稱已被使用" }, { status: 409 });
    }

    // Hash and insert
    const passwordHash = await hash(password, 10);
    const row = await queryOne<{ id: number }>(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id",
      [name, passwordHash]
    );

    if (!row) {
      return NextResponse.json({ error: "註冊失敗，請重試" }, { status: 500 });
    }

    // Sign token and set cookie
    const token = signToken({ userId: row.id, username: name, isAdmin: false });
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
    console.error("Register error:", e);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
