/**
 * Langfuse API Client (Server-side only)
 *
 * 所有 Langfuse API 調用均通過 Next.js API Routes 代理，
 * Public/Secret Keys 永遠保留在伺服器端，不會暴露給客戶端。
 *
 * Langfuse API Docs: https://api.reference.langfuse.com
 */

const LANGFUSE_BASE =
  process.env.LANGFUSE_HOST || "https://cloud.langfuse.com";
const LANGFUSE_PUBLIC_KEY = process.env.LANGFUSE_PUBLIC_KEY || "";
const LANGFUSE_SECRET_KEY = process.env.LANGFUSE_SECRET_KEY || "";

interface LangfuseTrace {
  id: string;
  name: string;
  userId?: string;
  sessionId?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  release?: string;
  version?: string;
  // Computed from observations
  latency?: number;
  totalTokens?: number;
  totalCost?: number;
  observationCount?: number;
}

interface LangfuseObservation {
  id: string;
  traceId: string;
  name: string;
  type: "GENERATION" | "SPAN" | "EVENT";
  startTime: string;
  endTime?: string;
  latency?: number;
  model?: string;
  usage?: {
    input?: number;
    output?: number;
    total?: number;
  };
  costDetails?: Record<string, number>;
  input?: string;
  output?: string;
  metadata?: Record<string, unknown>;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

async function fetchLangfuse(
  endpoint: string,
  params?: Record<string, string>
): Promise<unknown> {
  const url = new URL(`${LANGFUSE_BASE}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    });
  }

  const auth = Buffer.from(
    `${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}`
  ).toString("base64");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `Langfuse API error: ${res.status} ${res.statusText}`
    );
  }

  return res.json();
}

/** Fetch traces with pagination */
export async function getTraces(
  page = 1,
  limit = 50,
  filters?: {
    userId?: string;
    name?: string;
    tags?: string;
    fromTimestamp?: string;
    toTimestamp?: string;
  }
): Promise<PaginatedResponse<LangfuseTrace>> {
  return fetchLangfuse("/api/public/traces", {
    page: String(page),
    limit: String(limit),
    ...filters,
  }) as Promise<PaginatedResponse<LangfuseTrace>>;
}

/** Fetch a single trace with observations */
export async function getTraceById(
  traceId: string
): Promise<LangfuseTrace & { observations: LangfuseObservation[] }> {
  return fetchLangfuse(
    `/api/public/traces/${traceId}`
  ) as Promise<LangfuseTrace & { observations: LangfuseObservation[] }>;
}

/** Fetch aggregated metrics */
export async function getMetrics(
  fromTimestamp: string,
  toTimestamp: string
): Promise<{
  totalTraces: number;
  totalTokens: number;
  totalCost: number;
  avgLatency: number;
}> {
  const traces = await getTraces(1, 100, { fromTimestamp, toTimestamp });

  let totalTokens = 0;
  let totalCost = 0;
  let totalLatency = 0;

  for (const trace of traces.data) {
    totalTokens += trace.totalTokens || 0;
    totalCost += trace.totalCost || 0;
    totalLatency += trace.latency || 0;
  }

  const count = traces.data.length || 1;
  return {
    totalTraces: traces.meta.totalItems,
    totalTokens,
    totalCost,
    avgLatency: totalLatency / count,
  };
}

/** Check if Langfuse is configured */
export function isLangfuseConfigured(): boolean {
  return Boolean(LANGFUSE_PUBLIC_KEY && LANGFUSE_SECRET_KEY);
}
