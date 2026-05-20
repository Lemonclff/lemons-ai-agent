/**
 * Auth token utilities — HMAC-signed session tokens.
 * Stateless: no database lookup per request.
 */
import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.ACCESS_PASSWORD || "change-me-in-env-local";
const TOKEN_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface TokenPayload {
  userId: number;
  username: string;
  isAdmin: boolean;
  exp: number;
}

export function signToken(payload: Omit<TokenPayload, "exp">): string {
  const exp = Date.now() + TOKEN_TTL;
  const data = JSON.stringify({ ...payload, exp });
  const b64 = Buffer.from(data).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(b64).digest("base64url");
  return `${b64}.${sig}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const [b64, sig] = token.split(".");
    if (!b64 || !sig) return null;

    const expectedSig = createHmac("sha256", SECRET)
      .update(b64)
      .digest("base64url");

    if (
      sig.length !== expectedSig.length ||
      !timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
    ) {
      return null;
    }

    const payload: TokenPayload = JSON.parse(
      Buffer.from(b64, "base64url").toString()
    );

    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
