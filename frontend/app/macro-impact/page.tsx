"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Landmark,
  Cpu,
  Layers,
  RefreshCw,
  ExternalLink,
  Clock,
  ChevronDown,
  ChevronUp,
  Info,
  Zap,
  Flame,
  ShoppingCart,
  Factory,
  ArrowLeftRight,
  Gauge,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ===== Types ===== */
type SurpriseFlag = "BEAT" | "MISS" | "INLINE" | "PENDING";

interface MacroEvent {
  id: number;
  event_name: string;
  event_name_zh: string | null;
  event_time: string;
  expected_value: number | null;
  actual_value: number | null;
  previous_value: number | null;
  deviation: number | null;
  surprise_flag: SurpriseFlag;
  unit: string | null;
  importance: string;
  api_source?: string;
  ai_impact_tech?: string;
  ai_impact_financial?: string;
  ai_impact_broad?: string;
  ai_impact_energy?: string;
  ai_impact_consumer?: string;
  ai_impact_industrial?: string;
  ai_impact_summary?: string;
  capital_flow?: string;
  volatility_outlook?: string;
}

/* ===== Helpers ===== */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/New_York",
  }) + " ET";
}

function isPast(iso: string): boolean {
  return new Date(iso) < new Date();
}

/* ===== Components ===== */

function SurpriseBadge({ flag }: { flag: SurpriseFlag }) {
  const config = {
    BEAT: { variant: "success" as const, label: "▲ Beat", icon: TrendingUp },
    MISS: { variant: "danger" as const, label: "▼ Miss", icon: TrendingDown },
    INLINE: { variant: "default" as const, label: "— Inline", icon: Minus },
    PENDING: { variant: "info" as const, label: "⏳ 待發布", icon: Clock },
  };
  const c = config[flag];
  return (
    <Badge variant={c.variant} size="sm">
      <c.icon size={10} />
      <span className="ml-1">{c.label}</span>
    </Badge>
  );
}

function ImportanceStars({ level }: { level: string }) {
  const config: Record<string, { label: string; className: string }> = {
    high: { label: "★★★", className: "text-red-400 bg-red-500/10" },
    medium: { label: "★★☆", className: "text-amber-400 bg-amber-500/10" },
    low: { label: "★☆☆", className: "text-[var(--color-text-muted)] bg-[var(--color-surface-elevated)]" },
  };
  const c = config[level] || config.medium;
  return <span className={cn("px-1.5 py-0.5 text-[10px] rounded-md font-medium", c.className)}>{c.label}</span>;
}

function EventRow({ event }: { event: MacroEvent }) {
  const [expanded, setExpanded] = useState(false);
  const hasAI = !!(event.ai_impact_summary || event.ai_impact_tech || event.ai_impact_energy || event.capital_flow);

  const displayName = event.event_name_zh || event.event_name;
  const past = isPast(event.event_time);

  return (
    <>
      <tr
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "border-b border-[var(--color-border)]/50 cursor-pointer transition-colors",
          "hover:bg-[var(--color-surface-elevated)]/50",
          event.surprise_flag === "MISS" && "bg-red-500/5",
          event.surprise_flag === "BEAT" && "bg-emerald-500/5"
        )}
      >
        <td className="py-3 px-3">
          <ImportanceStars level={event.importance} />
        </td>
        <td className="py-3 px-3">
          <div>
            <span className="text-sm font-medium">{displayName}</span>
            {event.event_name_zh && event.event_name_zh !== event.event_name && (
              <span className="text-[10px] text-[var(--color-text-muted)] ml-1.5">
                {event.event_name}
              </span>
            )}
          </div>
        </td>
        <td className="py-3 px-3 text-xs text-[var(--color-text-muted)] hidden sm:table-cell">
          {formatDate(event.event_time)}
        </td>
        <td className="py-3 px-3 text-sm font-mono text-right">
          {event.expected_value != null
            ? Number(event.expected_value).toFixed(event.unit?.includes("%") ? 1 : 0)
            : "—"}
          {event.unit && <span className="text-[10px] text-[var(--color-text-muted)] ml-0.5">{event.unit}</span>}
        </td>
        <td className="py-3 px-3 text-sm font-mono text-right">
          <span
            className={cn(
              event.surprise_flag === "BEAT" && "text-emerald-400",
              event.surprise_flag === "MISS" && "text-red-400"
            )}
          >
            {event.actual_value != null
              ? Number(event.actual_value).toFixed(event.unit?.includes("%") ? 1 : 0)
              : "—"}
          </span>
        </td>
        <td className="py-3 px-3 text-sm font-mono text-right hidden sm:table-cell">
          {event.previous_value != null
            ? Number(event.previous_value).toFixed(event.unit?.includes("%") ? 1 : 0)
            : "—"}
        </td>
        <td className="py-3 px-3">
          <SurpriseBadge flag={event.surprise_flag} />
        </td>
        <td className="py-3 px-1">
          {hasAI && (
            expanded ? <ChevronUp size={14} className="text-[var(--color-accent)]" /> : <ChevronDown size={14} className="text-[var(--color-text-muted)]" />
          )}
        </td>
      </tr>
      {expanded && hasAI && (
        <tr className="bg-[var(--color-surface)]">
          <td colSpan={8} className="p-4">
            <div className="space-y-3">
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                🤖 AI Impact Analysis — Sector Flow Projections (NVIDIA NIM · DeepSeek V4 Pro)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { label: "科技板塊", icon: Cpu, content: event.ai_impact_tech, color: "border-indigo-500/20 bg-indigo-500/5" },
                  { label: "金融板塊", icon: Landmark, content: event.ai_impact_financial, color: "border-emerald-500/20 bg-emerald-500/5" },
                  { label: "大盤指數", icon: Layers, content: event.ai_impact_broad, color: "border-amber-500/20 bg-amber-500/5" },
                  { label: "能源板塊", icon: Flame, content: event.ai_impact_energy, color: "border-orange-500/20 bg-orange-500/5" },
                  { label: "消費板塊", icon: ShoppingCart, content: event.ai_impact_consumer, color: "border-pink-500/20 bg-pink-500/5" },
                  { label: "工業/原材料", icon: Factory, content: event.ai_impact_industrial, color: "border-gray-400/20 bg-gray-500/5" },
                ].map((sector) => (
                  <div key={sector.label} className={cn("p-3 rounded-xl border text-xs", sector.color)}>
                    <div className="flex items-center gap-2 mb-1">
                      <sector.icon size={12} />
                      <span className="font-semibold">{sector.label}</span>
                    </div>
                    <p className="text-[var(--color-text-secondary)] leading-relaxed">
                      {sector.content || "Awaiting data release for AI analysis..."}
                    </p>
                  </div>
                ))}
              </div>
              {/* Capital Flow & Volatility */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {event.capital_flow && (
                  <div className="p-3 rounded-xl border border-purple-500/20 bg-purple-500/5 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <ArrowLeftRight size={12} className="text-purple-400" />
                      <span className="font-semibold text-purple-300">資金流向</span>
                    </div>
                    <p className="text-[var(--color-text-secondary)] leading-relaxed">{event.capital_flow}</p>
                  </div>
                )}
                {event.volatility_outlook && (
                  <div className="p-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <Gauge size={12} className="text-cyan-400" />
                      <span className="font-semibold text-cyan-300">波動率展望</span>
                    </div>
                    <p className="text-[var(--color-text-secondary)] leading-relaxed">{event.volatility_outlook}</p>
                  </div>
                )}
              </div>
              {event.ai_impact_summary && (
                <div className="p-3 rounded-xl bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/20 text-xs">
                  <span className="font-semibold text-[var(--color-accent)]">📋 總結：</span>{" "}
                  <span className="text-[var(--color-text-secondary)]">{event.ai_impact_summary}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
                <Info size={10} />
                以上分析由 NVIDIA NIM (DeepSeek V4 Pro) 根據歷史規律與市場聯動關係生成，僅供參考，不構成投資建議。
              </div>
              {event.api_source && (
                <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
                  <ExternalLink size={10} />
                  數據來源：{event.api_source}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ===== Main Page ===== */
export default function MacroImpactPage() {
  const [events, setEvents] = useState<MacroEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "high" | "beat-miss">("all");
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/macro?days=30");
      const json = await res.json();
      setEvents(json.data || []);
    } catch {
      setError("無法載入經濟日曆");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filtered = useMemo(() => {
    if (filter === "high") return events.filter((e) => e.importance === "high");
    if (filter === "beat-miss")
      return events.filter((e) => e.surprise_flag === "BEAT" || e.surprise_flag === "MISS");
    return events;
  }, [events, filter]);

  const beatCount = events.filter((e) => e.surprise_flag === "BEAT").length;
  const missCount = events.filter((e) => e.surprise_flag === "MISS").length;
  const pendingCount = events.filter((e) => e.surprise_flag === "PENDING").length;
  const aiAnalyzedCount = events.filter((e) => e.ai_impact_summary || e.ai_impact_tech).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-[slideIn_0.4s_ease-out]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Macro Impact Matrix</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Real economic calendar · auto-updating status · AI-generated sector flow projections
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {[
          { label: "即將發布", value: String(pendingCount), sub: "Pending releases", icon: Calendar, color: "text-sky-400", bg: "bg-sky-500/10" },
          { label: "優於預期", value: String(beatCount), sub: "Data above forecast", icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "遜於預期", value: String(missCount), sub: "Data below forecast", icon: TrendingDown, color: "text-red-400", bg: "bg-red-500/10" },
          { label: "AI 已分析", value: String(aiAnalyzedCount), sub: "NVIDIA NIM generated", icon: Cpu, color: "text-indigo-400", bg: "bg-indigo-500/10" },
        ].map((card) => (
          <Card key={card.label} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">{card.label}</p>
              <div className={card.bg + " p-1.5 rounded-lg"}>
                <card.icon size={14} className={card.color} />
              </div>
            </div>
            <p className="text-xl font-bold">{card.value}</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">{card.sub}</p>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {([
          { key: "all", label: "全部事件" },
          { key: "high", label: "高重要性" },
          { key: "beat-miss", label: "驚喜事件" },
        ] as const).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-3 py-1.5 text-xs rounded-lg transition-all",
              filter === f.key
                ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            )}
          >
            {f.label}
          </button>
        ))}
        <span className="text-xs text-[var(--color-text-muted)] ml-auto">
          {filtered.length} 個事件 · auto-refresh 5min
        </span>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Event Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                {["", "事件", "日期", "預期", "實際", "前期", "狀態", ""].map((h) => (
                  <th
                    key={h}
                    className={cn(
                      "text-left py-3 px-3 text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider",
                      h === "日期" && "hidden sm:table-cell",
                      h === "前期" && "hidden sm:table-cell",
                      (h === "預期" || h === "實際") && "text-right"
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[var(--color-text-muted)] text-sm">
                    No economic events found. Try refreshing.
                  </td>
                </tr>
              )}
              {filtered.map((evt) => (
                <EventRow key={evt.id} event={evt} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Data Source */}
      <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)]">
        <div className="flex items-center gap-2">
          <Zap size={10} className="text-amber-400" />
          <span>Data: FRED (Federal Reserve) · ForexFactory Calendar · Auto-update every 5 min</span>
        </div>
        <a href="https://fred.stlouisfed.org" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-accent)] transition-colors">
          <ExternalLink size={10} className="inline mr-0.5" />FRED
        </a>
      </div>
    </div>
  );
}
