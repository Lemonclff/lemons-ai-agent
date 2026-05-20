import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Token 無效" }, { status: 401 });
  }

  return NextResponse.json({
    userId: payload.userId,
    username: payload.username,
    isAdmin: payload.isAdmin,
  });
}
