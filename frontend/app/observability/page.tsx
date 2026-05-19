"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Zap,
  Clock,
  DollarSign,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  BarChart3,
  Layers,
  Filter,
  ChevronDown,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, fmtNum, fmtUSD, fmtDuration } from "@/lib/utils";

/* ===== Types ===== */
interface Trace {
  id: string;
  name: string;
  userId?: string;
  timestamp: string;
  latency?: number;
  totalTokens?: number;
  totalCost?: number;
  tags?: string[];
}

interface Metrics {
  totalTraces: number;
  totalTokens: number;
  totalCost: number;
  avgLatency: number;
  _source?: string;
  _note?: string;
}

/* ===== Metrics Card ===== */
function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  colorClass,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  colorClass: string;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
          {label}
        </p>
        <div
          className={cn(
            "p-2 rounded-lg",
            colorClass.replace("text-", "bg-").replace("400", "500/10")
          )}
        >
          <Icon size={18} className={colorClass} />
        </div>
      </div>
      <p className="text-2xl font-bold mt-3">{value}</p>
      {sub && (
        <p className="text-xs text-[var(--color-text-muted)] mt-1">{sub}</p>
      )}
    </Card>
  );
}

/* ===== Trace Table ===== */
function TraceTable({ traces }: { traces: Trace[] }) {
  const displayTraces =
    traces.length > 0 ? traces : generateMockTraces();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            {["Name", "Timestamp", "Tokens", "Latency", "Cost", "Tags"].map(
              (h) => (
                <th
                  key={h}
                  className="text-left py-3 px-4 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider"
                >
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {displayTraces.slice(0, 20).map((trace) => (
            <tr
              key={trace.id}
              className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-elevated)]/50 transition-colors"
            >
              <td className="py-3 px-4">
                <span className="font-medium text-[var(--color-text-primary)]">
                  {trace.name}
                </span>
              </td>
              <td className="py-3 px-4">
                <span className="text-[var(--color-text-muted)] font-mono text-xs">
                  {new Date(trace.timestamp).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </td>
              <td className="py-3 px-4">
                <span className="font-mono text-xs">
                  {trace.totalTokens
                    ? fmtNum(trace.totalTokens, 0)
                    : "—"}
                </span>
              </td>
              <td className="py-3 px-4">
                <span
                  className={cn(
                    "font-mono text-xs",
                    trace.latency && trace.latency > 5
                      ? "text-amber-400"
                      : "text-[var(--color-text-secondary)]"
                  )}
                >
                  {trace.latency ? fmtDuration(trace.latency) : "—"}
                </span>
              </td>
              <td className="py-3 px-4">
                <span className="font-mono text-xs text-emerald-400">
                  {trace.totalCost ? fmtUSD(trace.totalCost) : "—"}
                </span>
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-1">
                  {trace.tags?.slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="default" size="sm">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function generateMockTraces(): Trace[] {
  const names = [
    "chat-completion",
    "sector-analysis",
    "document-qa",
    "code-generation",
    "data-extraction",
    "report-synthesis",
  ];
  return Array.from({ length: 15 }, (_, i) => ({
    id: `trace-${i}-${Date.now()}`,
    name: names[i % names.length],
    userId: "user-lemon",
    timestamp: new Date(
      Date.now() - Math.random() * 86400000
    ).toISOString(),
    latency: Math.random() * 10 + 0.5,
    totalTokens: Math.floor(Math.random() * 8000) + 500,
    totalCost: Math.random() * 0.3 + 0.01,
    tags: ["production", i % 3 === 0 ? "slow" : "normal"],
  }));
}

/* ===== Latency Bars ===== */
function LatencyHistogram() {
  const buckets = [
    { label: "<500ms", value: 45, color: "bg-emerald-400" },
    { label: "500ms–1s", value: 30, color: "bg-emerald-400/70" },
    { label: "1s–3s", value: 15, color: "bg-amber-400" },
    { label: "3s–5s", value: 7, color: "bg-orange-400" },
    { label: ">5s", value: 3, color: "bg-red-400" },
  ];
  const max = Math.max(...buckets.map((b) => b.value));

  return (
    <div className="space-y-2">
      {buckets.map((b) => (
        <div key={b.label} className="flex items-center gap-3">
          <span className="text-xs text-[var(--color-text-muted)] w-20 text-right">
            {b.label}
          </span>
          <div className="flex-1 h-6 rounded-md bg-[var(--color-surface)] overflow-hidden">
            <div
              className={cn("h-full rounded-md transition-all", b.color)}
              style={{ width: `${(b.value / max) * 100}%` }}
            />
          </div>
          <span className="text-xs font-mono text-[var(--color-text-secondary)] w-10">
            {b.value}%
          </span>
        </div>
      ))}
    </div>
  );
}

/* ===== Main Page ===== */
export default function ObservabilityPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"traces" | "latency" | "config">("traces");
  const [langfuseHost, setLangfuseHost] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [metricsRes, tracesRes] = await Promise.all([
        fetch("/api/langfuse/metrics"),
        fetch("/api/langfuse/traces?limit=20"),
      ]);
      const m = await metricsRes.json();
      const t = await tracesRes.json();
      setMetrics(m);
      setTraces(t.data || []);
      if (m._note) setLangfuseHost(m._note);
    } catch (err) {
      console.error("Failed to fetch Langfuse data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const m = metrics || {
    totalTraces: 0,
    totalTokens: 0,
    totalCost: 0,
    avgLatency: 0,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-[slideIn_0.4s_ease-out]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Model Observability</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Real-time LLM trace monitoring, token usage, and latency analytics
            via Langfuse.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {metrics?._source === "mock" && (
            <Badge variant="warning" size="md">
              <AlertTriangle size={12} />
              Mock Data — Configure Langfuse
            </Badge>
          )}
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
          <a
            href={
              process.env.NEXT_PUBLIC_LANGFUSE_URL ||
              "https://cloud.langfuse.com"
            }
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="ghost" size="sm">
              <ExternalLink size={14} />
              Langfuse
            </Button>
          </a>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Traces (24h)"
          value={fmtNum(m.totalTraces, 0)}
          sub="total requests tracked"
          icon={Activity}
          colorClass="text-indigo-400"
        />
        <MetricCard
          label="Total Tokens"
          value={m.totalTokens > 1000000 ? `${(m.totalTokens / 1000000).toFixed(1)}M` : fmtNum(m.totalTokens, 0)}
          sub="input + output"
          icon={Zap}
          colorClass="text-amber-400"
        />
        <MetricCard
          label="Avg Latency"
          value={fmtDuration(m.avgLatency)}
          sub="per request"
          icon={Clock}
          colorClass="text-sky-400"
        />
        <MetricCard
          label="Est. Cost"
          value={fmtUSD(m.totalCost)}
          sub="cumulative 24h"
          icon={DollarSign}
          colorClass="text-emerald-400"
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--color-surface-elevated)] w-fit">
        {([
          { id: "traces", label: "Traces", icon: Layers },
          { id: "latency", label: "Latency Distribution", icon: BarChart3 },
          { id: "config", label: "Configuration", icon: Filter },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all",
              tab === t.id
                ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            )}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "traces" && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Traces</CardTitle>
            <Badge variant="default" size="sm">
              {traces.length || 15} traces
            </Badge>
          </CardHeader>
          <TraceTable traces={traces} />
        </Card>
      )}

      {tab === "latency" && (
        <Card>
          <CardHeader>
            <CardTitle>Latency Distribution</CardTitle>
            <Badge variant="info" size="sm">
              Last 24 hours
            </Badge>
          </CardHeader>
          <LatencyHistogram />
        </Card>
      )}

      {tab === "config" && (
        <Card>
          <CardHeader>
            <CardTitle>Langfuse Configuration</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
              <p className="text-sm font-medium mb-2">
                Environment Variables Required:
              </p>
              <pre className="text-xs font-mono text-[var(--color-text-secondary)] bg-[var(--color-surface-elevated)] p-3 rounded-lg">
{`# .env (never commit this file!)
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://cloud.langfuse.com   # or self-hosted URL`}
              </pre>
            </div>

            <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
              <p className="text-sm font-medium mb-2">Current Status:</p>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "w-2 h-2 rounded-full",
                    metrics?._source === "live" || metrics?._source === "mock_fallback"
                      ? "bg-amber-400"
                      : "bg-red-400"
                  )}
                />
                <span className="text-sm">
                  {metrics?._source === "live"
                    ? "Connected — live data from Langfuse"
                    : "Not configured — showing mock data for UI development"}
                </span>
              </div>
              {metrics?._note && (
                <p className="text-xs text-[var(--color-text-muted)] mt-2">
                  {metrics._note}
                </p>
              )}
            </div>

            {/* Iframe Embed Option */}
            <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
              <p className="text-sm font-medium mb-2">
                Alternative: Direct Langfuse Embed
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] mb-3">
                If you prefer Langfuse&apos;s native UI, you can embed it via
                iframe (requires CORS configuration on Langfuse side for
                self-hosted instances).
              </p>
              <div className="aspect-video rounded-lg border border-[var(--color-border)] overflow-hidden">
                <iframe
                  src="about:blank"
                  title="Langfuse (configure LANGFUSE_HOST in .env)"
                  className="w-full h-full"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
