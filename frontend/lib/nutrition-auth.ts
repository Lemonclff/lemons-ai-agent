/**
 * Shared auth helper for nutrition API routes.
 * Reads the HMAC-signed token cookie to get the real userId.
 */
import { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";

export function getUserId(req: NextRequest): number {
  try {
    const token = req.cookies.get("token")?.value;
    if (token) {
      const payload = verifyToken(token);
      if (payload) return payload.userId;
    }
  } catch {}
  // Fallback for unauthenticated access — still isolate to user 1
  // but require explicit auth for multi-user safety
  return 1;
}

export function requireAuth(req: NextRequest): { userId: number } | null {
  try {
    const token = req.cookies.get("token")?.value;
    if (token) {
      const payload = verifyToken(token);
      if (payload) return { userId: payload.userId };
    }
  } catch {}
  return null;
}
