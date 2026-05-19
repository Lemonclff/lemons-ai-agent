"use client";

import { useEffect, useState, useMemo } from "react";
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
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ===== Types ===== */
type SurpriseFlag = "BEAT" | "MISS" | "INLINE" | "PENDING";

interface MacroEvent {
  id: string;
  event_name: string;
  event_time: string;        // ISO timestamp
  expected_value: number | null;
  actual_value: number | null;
  previous_value: number | null;
  deviation: number | null;  // actual - expected
  surprise_flag: SurpriseFlag;
  ai_impact_tech?: string;
  ai_impact_financial?: string;
  ai_impact_broad?: string;
  ai_impact_summary?: string;
  importance: "high" | "medium" | "low";
}

/* ===== Mock Data ===== */
function generateMockEvents(): MacroEvent[] {
  const now = new Date();
  const events: MacroEvent[] = [
    {
      id: "cpi-yoy",
      event_name: "US Core CPI YoY",
      event_time: new Date(now.getTime() + 1 * 86400000).toISOString(),
      expected_value: 3.1,
      actual_value: null,
      previous_value: 3.2,
      deviation: null,
      surprise_flag: "PENDING",
      importance: "high",
    },
    {
      id: "ppi-mom",
      event_name: "US PPI MoM",
      event_time: new Date(now.getTime() + 2 * 86400000).toISOString(),
      expected_value: 0.2,
      actual_value: null,
      previous_value: 0.1,
      deviation: null,
      surprise_flag: "PENDING",
      importance: "high",
    },
    {
      id: "nfp",
      event_name: "Non-Farm Payrolls",
      event_time: new Date(now.getTime() - 2 * 86400000).toISOString(),
      expected_value: 180,
      actual_value: 228,
      previous_value: 151,
      deviation: 48,
      surprise_flag: "BEAT",
      importance: "high",
      ai_impact_tech:
        "強勁就業 → 工資壓力上升 → 科技公司人力成本增加。但消費支出韌性支撐雲端/AI 需求。短期中性偏多。",
      ai_impact_financial:
        "就業超預期 → 聯儲局推遲減息 → 淨息差受壓。但信貸需求回升有利銀行手續費收入。短期中性。",
      ai_impact_broad:
        "強就業數據削弱減息預期，短期股市波動。但軟著陸信心增強，中期支撐估值。防禦型板塊可能轉強。",
      ai_impact_summary:
        "勞動市場韌性超預期 → 短期減息預期降溫 → 科技股估值承壓但基本面穩健 → 資金可能從高估值成長股輪動至價值/金融板塊。",
    },
    {
      id: "retail-sales",
      event_name: "US Retail Sales MoM",
      event_time: new Date(now.getTime() - 4 * 86400000).toISOString(),
      expected_value: 0.3,
      actual_value: 0.1,
      previous_value: 0.4,
      deviation: -0.2,
      surprise_flag: "MISS",
      importance: "medium",
      ai_impact_tech:
        "消費放緩 → iPhone/Mac 等硬體銷售可能受壓，但軟體 SaaS 訂閱相對抗跌。關注 AAPL 供應鏈。",
      ai_impact_financial:
        "消費信貸放緩 → 信用卡業務收入承壓。但利率居高支撐淨息差，大型銀行相對穩健。",
      ai_impact_broad:
        "消費疲軟 → 經濟降溫訊號 → 防禦性板塊（必需消費、公用事業）可能吸引資金流入。",
      ai_impact_summary:
        "零售數據低於預期 → 消費者信心轉弱 → 可選消費板塊資金流出風險 → 資金可能轉向防禦型資產。",
    },
    {
      id: "ism-mfg",
      event_name: "ISM Manufacturing PMI",
      event_time: new Date(now.getTime() - 5 * 86400000).toISOString(),
      expected_value: 49.5,
      actual_value: 50.3,
      previous_value: 49.1,
      deviation: 0.8,
      surprise_flag: "BEAT",
      importance: "medium",
      ai_impact_tech:
        "製造業重返擴張 → 半導體設備、工業軟體需求回升。NVDA/AMD 的 HPC/資料中心訂單持續強勁。",
      ai_impact_financial:
        "製造業擴張 → 商業貸款需求增加 → 地區銀行信貸組合改善 → 利好金融板塊。",
      ai_impact_broad: "PMI 重返擴張區間 → 經濟韌性確認 → 周期性板塊（工業、材料）可能跑贏大盤。",
    },
    {
      id: "fomc-minutes",
      event_name: "FOMC Meeting Minutes",
      event_time: new Date(now.getTime() - 6 * 86400000).toISOString(),
      expected_value: null,
      actual_value: null,
      previous_value: null,
      deviation: null,
      surprise_flag: "INLINE",
      importance: "high",
      ai_impact_summary:
        "會議紀要符合預期 → 維持數據依賴態度 → 市場已消化 → 無重大方向性影響。關注下次會議點陣圖更新。",
    },
    {
      id: "gdp-q2",
      event_name: "US GDP QoQ (2nd Est.)",
      event_time: new Date(now.getTime() + 3 * 86400000).toISOString(),
      expected_value: 2.4,
      actual_value: null,
      previous_value: 2.8,
      deviation: null,
      surprise_flag: "PENDING",
      importance: "high",
    },
    {
      id: "claims",
      event_name: "Initial Jobless Claims",
      event_time: new Date(now.getTime() + 1 * 86400000 - 12 * 3600000).toISOString(),
      expected_value: 218,
      actual_value: null,
      previous_value: 215,
      deviation: null,
      surprise_flag: "PENDING",
      importance: "low",
    },
  ];

  return events.sort(
    (a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime()
  );
}

/* ===== Components ===== */

function SurpriseBadge({ flag }: { flag: SurpriseFlag }) {
  const config = {
    BEAT: { variant: "success" as const, label: "▲ Beat", icon: TrendingUp },
    MISS: { variant: "danger" as const, label: "▼ Miss", icon: TrendingDown },
    INLINE: { variant: "default" as const, label: "— Inline", icon: Minus },
    PENDING: { variant: "info" as const, label: "⏳ Pending", icon: Clock },
  };
  const c = config[flag];
  return (
    <Badge variant={c.variant} size="sm">
      <c.icon size={10} />
      {c.label}
    </Badge>
  );
}

function ImportanceBadge({ level }: { level: "high" | "medium" | "low" }) {
  const config = {
    high: { label: "★★★", className: "text-red-400 bg-red-500/10" },
    medium: { label: "★★☆", className: "text-amber-400 bg-amber-500/10" },
    low: { label: "★☆☆", className: "text-[var(--color-text-muted)] bg-[var(--color-surface-elevated)]" },
  };
  const c = config[level];
  return <span className={cn("px-1.5 py-0.5 text-[10px] rounded-md font-medium", c.className)}>{c.label}</span>;
}

function EventRow({ event }: { event: MacroEvent }) {
  const [expanded, setExpanded] = useState(false);
  const hasAI = event.ai_impact_summary || event.ai_impact_tech;

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
          <ImportanceBadge level={event.importance} />
        </td>
        <td className="py-3 px-3">
          <span className="text-sm font-medium">{event.event_name}</span>
        </td>
        <td className="py-3 px-3 text-xs text-[var(--color-text-muted)] hidden sm:table-cell">
          {new Date(event.event_time).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </td>
        <td className="py-3 px-3 text-sm font-mono text-right">
          {event.expected_value != null ? event.expected_value.toFixed(1) : "—"}
        </td>
        <td className="py-3 px-3 text-sm font-mono text-right">
          <span
            className={cn(
              event.surprise_flag === "BEAT" && "text-emerald-400",
              event.surprise_flag === "MISS" && "text-red-400"
            )}
          >
            {event.actual_value != null ? event.actual_value.toFixed(1) : "—"}
          </span>
        </td>
        <td className="py-3 px-3 text-sm font-mono text-right hidden sm:table-cell">
          {event.previous_value != null ? event.previous_value.toFixed(1) : "—"}
        </td>
        <td className="py-3 px-3">
          <SurpriseBadge flag={event.surprise_flag} />
        </td>
        <td className="py-3 px-1">
          {hasAI && (expanded ? <ChevronUp size={14} className="text-[var(--color-accent)]" /> : <ChevronDown size={14} className="text-[var(--color-text-muted)]" />)}
        </td>
      </tr>
      {expanded && hasAI && (
        <tr className="bg-[var(--color-surface)]">
          <td colSpan={8} className="p-4">
            <div className="space-y-3">
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                🤖 AI Impact Analysis — Sector Flow Projections
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { label: "Technology", icon: Cpu, content: event.ai_impact_tech, color: "border-indigo-500/20 bg-indigo-500/5" },
                  { label: "Financials", icon: Landmark, content: event.ai_impact_financial, color: "border-emerald-500/20 bg-emerald-500/5" },
                  { label: "Broad Market", icon: Layers, content: event.ai_impact_broad, color: "border-amber-500/20 bg-amber-500/5" },
                ].map((sector) => (
                  <div
                    key={sector.label}
                    className={cn("p-3 rounded-xl border text-xs", sector.color)}
                  >
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
              {event.ai_impact_summary && (
                <div className="p-3 rounded-xl bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/20 text-xs">
                  <span className="font-semibold text-[var(--color-accent)]">📋 Summary:</span>{" "}
                  <span className="text-[var(--color-text-secondary)]">{event.ai_impact_summary}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
                <Info size={10} />
                Analysis generated by LLM based on historical patterns. Not financial advice. Cross-reference with multiple sources.
              </div>
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

  const fetchData = () => {
    setLoading(true);
    setTimeout(() => {
      setEvents(generateMockEvents());
      setLoading(false);
    }, 400);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    if (filter === "high") return events.filter((e) => e.importance === "high");
    if (filter === "beat-miss") return events.filter((e) => e.surprise_flag === "BEAT" || e.surprise_flag === "MISS");
    return events;
  }, [events, filter]);

  const beatCount = events.filter((e) => e.surprise_flag === "BEAT").length;
  const missCount = events.filter((e) => e.surprise_flag === "MISS").length;
  const pendingCount = events.filter((e) => e.surprise_flag === "PENDING").length;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-[slideIn_0.4s_ease-out]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Macro Impact Matrix</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Economic calendar with expected vs. actual values, and AI-generated sector flow impact analysis.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
          <a
            href="https://fred.stlouisfed.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="ghost" size="sm">
              <ExternalLink size={14} />
              FRED
            </Button>
          </a>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {[
          { label: "Upcoming", value: String(pendingCount), sub: "Pending releases", icon: Calendar, color: "text-sky-400", bg: "bg-sky-500/10" },
          { label: "Beat Expectations", value: String(beatCount), sub: "Data above forecast", icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Missed Expectations", value: String(missCount), sub: "Data below forecast", icon: TrendingDown, color: "text-red-400", bg: "bg-red-500/10" },
          { label: "AI Analyzed", value: String(beatCount + missCount + 1), sub: "LLM impact generated", icon: Cpu, color: "text-indigo-400", bg: "bg-indigo-500/10" },
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
          { key: "all", label: "All Events" },
          { key: "high", label: "High Impact" },
          { key: "beat-miss", label: "Surprises" },
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
          {filtered.length} events
        </span>
      </div>

      {/* Event Calendar Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                {["", "Event", "Date", "Expected", "Actual", "Prev", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className={cn(
                      "text-left py-3 px-3 text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider",
                      h === "Date" && "hidden sm:table-cell",
                      h === "Prev" && "hidden sm:table-cell",
                      (h === "Expected" || h === "Actual") && "text-right"
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((evt) => (
                <EventRow key={evt.id} event={evt} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Prompt Template Preview */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info size={16} className="text-[var(--color-accent)]" />
            <CardTitle>LLM Analysis Prompt Template</CardTitle>
          </div>
          <Badge variant="accent" size="sm">Auto-generated</Badge>
        </CardHeader>
        <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] font-mono text-xs leading-relaxed">
          <p className="text-[var(--color-text-muted)] mb-2">
            # Trigger: When actual economic data is published
          </p>
          <p className="text-[var(--color-text-secondary)]">
            You are a macro-economic analyst. Analyze the impact of the following data release:
            <br /><br />
            <span className="text-[var(--color-accent)]">Event:</span> {"{event_name}"}<br />
            <span className="text-[var(--color-accent)]">Expected:</span> {"{expected_value}"}<br />
            <span className="text-[var(--color-accent)]">Actual:</span> {"{actual_value}"}<br />
            <span className="text-[var(--color-accent)]">Previous:</span> {"{previous_value}"}<br />
            <span className="text-[var(--color-accent)]">Deviation:</span> {"{deviation}"}<br />
            <br />
            Generate 3 brief summaries (2-3 sentences each):<br />
            1. Impact on <span className="text-indigo-400">US Technology Sector</span> (semis, SaaS, hardware)<br />
            2. Impact on <span className="text-emerald-400">US Financial Sector</span> (banks, fintech, insurance)<br />
            3. Impact on <span className="text-amber-400">Broad Market Indices</span> (S&P 500, Nasdaq)<br />
            4. Overall capital flow prediction (rotation direction)<br />
            <br />
            Be specific. Reference historical patterns. Avoid generic advice.
          </p>
        </div>
      </Card>
    </div>
  );
}
