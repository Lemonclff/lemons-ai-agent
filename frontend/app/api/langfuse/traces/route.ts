/**
 * Langfuse Traces Proxy API
 *
 * 此 API Route 作為 Langfuse 的安全代理層：
 * - API Keys 僅存在於伺服器端（環境變量）
 * - 客戶端無法直接訪問 Langfuse
 * - 可在此層加入自定義緩存、過濾、聚合邏輯
 *
 * GET /api/langfuse/traces?page=1&limit=50
 */

import { NextRequest, NextResponse } from "next/server";

const LANGFUSE_BASE =
  process.env.LANGFUSE_HOST || "https://cloud.langfuse.com";
const PUBLIC_KEY = process.env.LANGFUSE_PUBLIC_KEY || "";
const SECRET_KEY = process.env.LANGFUSE_SECRET_KEY || "";

export async function GET(req: NextRequest) {
  // 安全檢查：未配置 API Keys
  if (!PUBLIC_KEY || !SECRET_KEY) {
    return NextResponse.json(
      {
        error: "LANGFUSE_NOT_CONFIGURED",
        message:
          "Langfuse API keys not set. Please configure LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY in your .env file.",
        data: [],
        meta: { page: 1, limit: 50, totalItems: 0, totalPages: 0 },
      },
      { status: 200 } // Return 200 so UI can show "not configured" state
    );
  }

  const { searchParams } = new URL(req.url);
  const params = new URLSearchParams();
  // Forward pagination params
  const page = searchParams.get("page") || "1";
  const limit = searchParams.get("limit") || "50";
  params.set("page", page);
  params.set("limit", limit);

  // Forward optional filters
  const name = searchParams.get("name");
  const userId = searchParams.get("userId");
  const tags = searchParams.get("tags");
  const fromTimestamp = searchParams.get("fromTimestamp");
  const toTimestamp = searchParams.get("toTimestamp");

  if (name) params.set("name", name);
  if (userId) params.set("userId", userId);
  if (tags) params.set("tags", tags);
  if (fromTimestamp) params.set("fromTimestamp", fromTimestamp);
  if (toTimestamp) params.set("toTimestamp", toTimestamp);

  try {
    const auth = Buffer.from(`${PUBLIC_KEY}:${SECRET_KEY}`).toString(
      "base64"
    );
    const url = `${LANGFUSE_BASE}/api/public/traces?${params.toString()}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(
        `[Langfuse Proxy] API error: ${res.status} ${res.statusText}`
      );
      return NextResponse.json(
        {
          error: "LANGFUSE_API_ERROR",
          message: `Langfuse returned ${res.status}: ${res.statusText}`,
          data: [],
          meta: { page: 1, limit: 50, totalItems: 0, totalPages: 0 },
        },
        { status: 200 } // Return 200 so UI renders gracefully
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[Langfuse Proxy] Fetch error:", err);
    return NextResponse.json(
      {
        error: "NETWORK_ERROR",
        message: "Could not connect to Langfuse. Check your network and LANGFUSE_HOST setting.",
        data: [],
        meta: { page: 1, limit: 50, totalItems: 0, totalPages: 0 },
      },
      { status: 200 }
    );
  }
}
