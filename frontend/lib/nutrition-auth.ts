/**
 * Shared auth helper for nutrition API routes.
 * Reads the HMAC-signed token cookie to get the real userId.
 * Returns 0 if no valid token — queries will naturally return empty results.
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
  // No valid token → userId 0 isolates the user from all data
  return 0;
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
