"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, TrendingDown, Minus, Loader2, Search,
  Zap, Target, Shield, AlertTriangle, BarChart3,
  ChevronRight, Clock, Brain, Sparkles, Gauge,
  Calendar, ChevronDown, ChevronUp, RefreshCw, Star, X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ========================================================================
   Types
   ======================================================================== */

interface Opportunity {
  symbol: string; name: string; price: number; change_24h: number;
  signal: string; strength: string; reason: string; impact: string; market: string;
}

interface SentimentData {
  generated_at?: string;
  fear_greed?: { value: number; classification: string; signal?: string };
  vix?: { price: number; change_pct: number; change_display: string; signal?: string };
  dxy?: { price: number; change_pct: number; change_display: string; signal?: string };
  us10y?: { price: number; change_pct: number; change_display: string };
}

interface CalendarEvent {
  id: number;
  name: string; name_en: string;
  country: string;
  date: string; time: string;
  importance: string;
  actual: string; forecast: string; previous: string;
  impact_if_above: string; impact_if_below: string;
  actual_impact: string;
}

interface AnalysisResult {
  status: string; ticker: string; provider?: string; model?: string;
  analysis?: Record<string, unknown>;
  market_data?: Record<string, unknown>;
  analysis_time_ms?: number; generated_at?: string;
  message?: string;
}

interface HeatmapItem {
  symbol: string; name: string; name_zh?: string;
  price: number; change_pct: number; change_display: string;
}

/* ========================================================================
   Helpers
   ======================================================================== */

function decisionIcon(d: string) {
  if (d === "BUY") return <TrendingUp size={28} className="text-emerald-400" />;
  if (d === "SELL") return <TrendingDown size={28} className="text-red-400" />;
  return <Minus size={28} className="text-yellow-400" />;
}

function decisionBadge(d: string) {
  const m: Record<string, { l: string; v: "success" | "danger" | "default" }> = {
    BUY: { l: "買入", v: "success" }, SELL: { l: "賣出", v: "danger" }, HOLD: { l: "觀望", v: "default" },
  };
  const b = m[d] || { l: d, v: "default" as const };
  return <Badge variant={b.v}>{b.l}</Badge>;
}

function scoreColor(s: number) {
  if (s >= 30) return "text-emerald-400";
  if (s >= 15) return "text-emerald-300";
  if (s <= -30) return "text-red-400";
  if (s <= -15) return "text-red-300";
  return "text-yellow-400";
}

function confidenceRing(v: number) {
  const pct = Math.min(100, Math.max(0, v));
  const color = pct >= 70 ? "#34d399" : pct >= 50 ? "#fbbf24" : "#f87171";
  const r = 28, circ = 2 * Math.PI * r, offset = circ - (pct / 100) * circ;
  return (
    <svg width="72" height="72" className="shrink-0">
      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--color-border)" strokeWidth="5" />
      <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform="rotate(-90 36 36)" className="transition-all duration-700" />
      <text x="36" y="36" textAnchor="middle" dominantBaseline="central"
        className="text-sm font-bold" fill="currentColor">{pct}%</text>
    </svg>
  );
}

function countryFlag(c: string) {
  const m: Record<string, string> = { US: "🇺🇸", EU: "🇪🇺", CN: "🇨🇳", JP: "🇯🇵", GB: "🇬🇧", OPEC: "🛢️" };
  return m[c] || "🌐";
}

/* ========================================================================
   Economic Calendar (template — mirrors QuantDinger)
   ======================================================================== */

const SAMPLE_CALENDAR: CalendarEvent[] = [
  { id: 1, name: "美國非農就業數據", name_en: "US Non-Farm Payrolls", country: "US", date: "", time: "08:30", importance: "high", actual: "", forecast: "180K", previous: "175K", impact_if_above: "bullish", impact_if_below: "bearish", actual_impact: "" },
  { id: 2, name: "美聯儲利率決議", name_en: "Fed Interest Rate Decision", country: "US", date: "", time: "14:00", importance: "high", actual: "", forecast: "5.50%", previous: "5.50%", impact_if_above: "bearish", impact_if_below: "bullish", actual_impact: "" },
  { id: 3, name: "美國 CPI 消費者物價指數", name_en: "US CPI (MoM)", country: "US", date: "", time: "08:30", importance: "high", actual: "", forecast: "0.2%", previous: "0.3%", impact_if_above: "bearish", impact_if_below: "bullish", actual_impact: "" },
  { id: 4, name: "美國初請失業金", name_en: "US Initial Jobless Claims", country: "US", date: "", time: "08:30", importance: "medium", actual: "", forecast: "220K", previous: "215K", impact_if_above: "bearish", impact_if_below: "bullish", actual_impact: "" },
  { id: 5, name: "美國零售銷售 (MoM)", name_en: "US Retail Sales (MoM)", country: "US", date: "", time: "08:30", importance: "medium", actual: "", forecast: "0.3%", previous: "0.1%", impact_if_above: "bullish", impact_if_below: "bearish", actual_impact: "" },
  { id: 6, name: "歐洲央行利率決議", name_en: "ECB Rate Decision", country: "EU", date: "", time: "14:15", importance: "high", actual: "", forecast: "4.50%", previous: "4.50%", impact_if_above: "bearish", impact_if_below: "bullish", actual_impact: "" },
  { id: 7, name: "日本央行利率決議", name_en: "BOJ Rate Decision", country: "JP", date: "", time: "11:00", importance: "high", actual: "", forecast: "0.10%", previous: "0.10%", impact_if_above: "bullish", impact_if_below: "bearish", actual_impact: "" },
  { id: 8, name: "英國央行利率決議", name_en: "BOE Rate Decision", country: "GB", date: "", time: "12:00", importance: "high", actual: "", forecast: "5.25%", previous: "5.25%", impact_if_above: "bearish", impact_if_below: "bullish", actual_impact: "" },
  { id: 9, name: "OPEC 月度報告", name_en: "OPEC Monthly Report", country: "OPEC", date: "", time: "12:30", importance: "medium", actual: "", forecast: "", previous: "", impact_if_above: "", impact_if_below: "", actual_impact: "" },
];

function generateCalendar(): CalendarEvent[] {
  const today = new Date();
  return SAMPLE_CALENDAR.map((evt, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + (i % 14) - 5);
    const dateStr = d.toISOString().slice(0, 10);
    const isPast = d < today;
    let actual = "";
    let impact = "";
    if (isPast && evt.forecast && evt.impact_if_above) {
      const rand = Math.random() * 0.3 - 0.15;
      const fVal = parseFloat(evt.forecast) || 0;
      const aVal = fVal * (1 + rand);
      actual = evt.forecast.includes("%") ? `${aVal.toFixed(1)}%` : evt.forecast.includes("K") ? `${Math.round(aVal)}K` : `${aVal.toFixed(2)}`;
      impact = rand >= 0 ? evt.impact_if_above : evt.impact_if_below;
    }
    const hour = ((8 + i * 3) % 24);
    const time = `${hour.toString().padStart(2, "0")}:30`;
    return { ...evt, date: dateStr, time, actual, actual_impact: impact };
  });
}

/* ========================================================================
   Quick Watchlist (localStorage)
   ======================================================================== */
const WL_KEY = "ai_watchlist";
const DEFAULT_WL = ["AAPL", "TSLA", "NVDA", "MSFT", "AMD", "COIN", "MSTR", "QQQ"];

function loadWl(): string[] {
  try { const v = localStorage.getItem(WL_KEY); return v ? JSON.parse(v) : [...DEFAULT_WL]; }
  catch { return [...DEFAULT_WL]; }
}
function saveWl(l: string[]) { localStorage.setItem(WL_KEY, JSON.stringify(l)); }

/* ========================================================================
   Page
   ======================================================================== */

export default function AIAnalysisPage() {
  // ── State ──
  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [sentimentLoading, setSentimentLoading] = useState(true);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [radarPaused, setRadarPaused] = useState(false);
  const [heatmapType, setHeatmapType] = useState("crypto");
  const [heatmapData, setHeatmapData] = useState<HeatmapItem[]>([]);
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [calendar, setCalendar] = useState<CalendarEvent[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [selectedTicker, setSelectedTicker] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    trend: true, scores: true, details: true, reasons: true, indicators: false,
  });

  // Fetch sentiment + radar + heatmap on mount
  useEffect(() => {
    setWatchlist(loadWl());
    setCalendar(generateCalendar());
    fetch("/api/sentiment").then(r => r.json()).then(d => { setSentiment(d); setSentimentLoading(false); }).catch(() => setSentimentLoading(false));
    fetch("/api/radar").then(r => r.json()).then((d: Opportunity[]) => { if (Array.isArray(d)) setOpportunities(d); }).catch(() => {});
    fetchHeatmap("crypto");
  }, []);

  const fetchHeatmap = (type: string) => {
    setHeatmapLoading(true);
    fetch(`/api/heatmap?type=${type}`)
      .then(r => r.json())
      .then((d: HeatmapItem[]) => { if (Array.isArray(d)) setHeatmapData(d); })
      .catch(() => {})
      .finally(() => setHeatmapLoading(false));
  };

  // ── Analyze ──
  const analyze = useCallback(async (t: string) => {
    if (!t.trim()) return;
    const tick = t.toUpperCase().trim();
    setSelectedTicker(tick);
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: tick }),
      });
      const data = await res.json();
      if (data.status === "ok") setResult(data);
      else { setError(data.message || "分析失敗"); setResult(data); }
    } catch { setError("API 連線失敗"); }
    finally { setLoading(false); }
  }, []);

  // ── Watchlist ──
  const addToWl = (t: string) => {
    const tick = t.toUpperCase().trim();
    if (!tick || watchlist.includes(tick)) return;
    const n = [tick, ...watchlist].slice(0, 15);
    setWatchlist(n); saveWl(n);
  };
  const removeFromWl = (t: string) => {
    const n = watchlist.filter(x => x !== t);
    setWatchlist(n); saveWl(n);
  };

  const toggleSection = (k: string) => setExpandedSections(p => ({ ...p, [k]: !p[k] }));

  const a = result?.analysis as Record<string, unknown> | undefined;

  // ── UI ──
  return (
    <div className="space-y-4">
      {/* ═══════════════════════ TOP INDEX BAR ═══════════════════════ */}
      <div className="flex items-center gap-2 p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        {/* Fear & Greed */}
        <div className={cn("flex flex-col items-center px-3 py-1 rounded min-w-[64px] shrink-0",
          (sentiment?.fear_greed?.value ?? 50) <= 25 ? "bg-red-500/10 text-red-400" :
          (sentiment?.fear_greed?.value ?? 50) <= 45 ? "bg-orange-500/10 text-orange-400" :
          (sentiment?.fear_greed?.value ?? 50) <= 55 ? "bg-yellow-500/10 text-yellow-400" :
          "bg-emerald-500/10 text-emerald-400"
        )}>
          <span className="text-[10px] opacity-70">恐貪</span>
          <span className="text-lg font-bold">{sentiment?.fear_greed?.value ?? "--"}</span>
        </div>
        {/* VIX */}
        <div className={cn("flex flex-col items-center px-3 py-1 rounded min-w-[64px] shrink-0",
          (sentiment?.vix?.price ?? 20) < 15 ? "bg-emerald-500/10 text-emerald-400" :
          (sentiment?.vix?.price ?? 20) < 20 ? "bg-yellow-500/10 text-yellow-400" :
          (sentiment?.vix?.price ?? 20) < 30 ? "bg-orange-500/10 text-orange-400" :
          "bg-red-500/10 text-red-400"
        )}>
          <span className="text-[10px] opacity-70">VIX</span>
          <span className="text-lg font-bold">{sentiment?.vix?.price?.toFixed(2) ?? "--"}</span>
        </div>
        {/* DXY */}
        <div className={cn("flex flex-col items-center px-3 py-1 rounded min-w-[64px] shrink-0",
          (sentiment?.dxy?.price ?? 100) < 100 ? "bg-emerald-500/10 text-emerald-400" :
          (sentiment?.dxy?.price ?? 100) < 105 ? "bg-yellow-500/10 text-yellow-400" :
          "bg-orange-500/10 text-orange-400"
        )}>
          <span className="text-[10px] opacity-70">DXY</span>
          <span className="text-lg font-bold">{sentiment?.dxy?.price?.toFixed(2) ?? "--"}</span>
        </div>
        {/* Divider */}
        <div className="w-px h-8 bg-[var(--color-border)] shrink-0" />
        {/* Refresh */}
        <button onClick={() => { fetch("/api/sentiment").then(r => r.json()).then(setSentiment); setCalendar(generateCalendar()); }}
          className="p-1.5 rounded hover:bg-[var(--color-surface-elevated)] shrink-0">
          <RefreshCw size={14} className="text-[var(--color-text-muted)]" />
        </button>
      </div>

      {/* ═══ AI Trading Radar ═══ */}
      {opportunities.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-amber-400" />
              <span className="text-xs font-semibold">AI 交易機會雷達</span>
              <span className="text-[10px] text-[var(--color-text-muted)]">每小時更新</span>
            </div>
            <button onClick={() => fetch("/api/radar").then(r => r.json()).then((d: Opportunity[]) => { if (Array.isArray(d)) setOpportunities(d); })}
              className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] flex items-center gap-1">
              <RefreshCw size={11} /> 刷新
            </button>
          </div>
          <div className="relative py-2 overflow-hidden"
            onMouseEnter={() => setRadarPaused(true)}
            onMouseLeave={() => setRadarPaused(false)}>
            <div className={cn("flex gap-3 px-3", radarPaused ? "" : "animate-marquee")}
              style={radarPaused ? { overflowX: "auto" } : { width: "max-content" }}>
              {[...opportunities, ...opportunities].map((opp, i) => (
                <div key={`${opp.symbol}-${i}`}
                  onClick={() => { setSelectedTicker(opp.symbol); analyze(opp.symbol); }}
                  className={cn(
                    "shrink-0 w-[180px] p-2.5 rounded-lg cursor-pointer border transition-colors hover:scale-[1.02]",
                    opp.impact === "bullish" ? "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10" :
                    opp.impact === "bearish" ? "border-red-500/30 bg-red-500/5 hover:bg-red-500/10" :
                    "border-[var(--color-border)] bg-[var(--color-surface-elevated)]"
                  )}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono font-bold text-sm">{opp.symbol}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface)]">
                      {opp.market === "USStock" ? "📈 美股" : opp.market}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-center mb-1.5">
                    <div>
                      <p className="text-[10px] text-[var(--color-text-muted)]">價格</p>
                      <p className="text-xs font-mono font-bold">${typeof opp.price === 'number' ? (opp.price >= 1000 ? (opp.price/1000).toFixed(1)+"K" : opp.price.toFixed(2)) : opp.price}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--color-text-muted)]">24h</p>
                      <p className={cn("text-xs font-mono font-bold", opp.change_24h >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {opp.change_24h >= 0 ? "+" : ""}{opp.change_24h?.toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--color-text-muted)]">訊號</p>
                      <p className={cn("text-xs font-bold",
                        opp.signal === "bullish_momentum" || opp.signal === "oversold" ? "text-emerald-400" :
                        opp.signal === "bearish_momentum" || opp.signal === "overbought" ? "text-red-400" :
                        "text-yellow-400"
                      )}>
                        {{overbought: "超買", oversold: "超賣", bullish_momentum: "看漲", bearish_momentum: "看跌", consolidation: "震盪"}[opp.signal] || opp.signal}
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-[var(--color-text-muted)]/70 leading-tight line-clamp-2">{opp.reason}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════ MAIN THREE-COLUMN ═══════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_220px] gap-4">

        {/* ── LEFT: Heatmap + Watchlist + Calendar ── */}
        <div className="space-y-3 order-2 lg:order-1">
          {/* Market Heatmap (mirrors QuantDinger) */}
          <Card className="p-3">
            <div className="flex items-center gap-1 mb-2">
              {[
                { key: "crypto", label: "加密貨幣" },
                { key: "commodities", label: "大宗商品" },
                { key: "forex", label: "外匯" },
              ].map(tab => (
                <button key={tab.key}
                  onClick={() => { setHeatmapType(tab.key); fetchHeatmap(tab.key); }}
                  className={cn(
                    "px-2 py-1 text-[10px] rounded font-medium transition-colors",
                    heatmapType === tab.key
                      ? "bg-indigo-500/20 text-indigo-400"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                  )}>
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1">
              {heatmapLoading ? (
                Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="h-10 rounded bg-[var(--color-surface-elevated)] animate-pulse" />
                ))
              ) : heatmapData.length > 0 ? (
                heatmapData.slice(0, 12).map(item => (
                  <div key={item.symbol} className={cn(
                    "px-2 py-1.5 rounded text-xs",
                    item.change_pct > 0 ? "bg-emerald-500/5" :
                    item.change_pct < 0 ? "bg-red-500/5" : "bg-[var(--color-surface-elevated)]"
                  )}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-medium text-[var(--color-text-secondary)] truncate">
                        {item.name_zh || item.name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[11px] font-mono font-bold">
                        ${item.price >= 1000 ? (item.price/1000).toFixed(1)+"K" : item.price.toFixed(2)}
                      </span>
                      <span className={cn("text-[10px] font-mono font-bold",
                        item.change_pct > 0 ? "text-emerald-400" :
                        item.change_pct < 0 ? "text-red-400" : "text-[var(--color-text-muted)]"
                      )}>
                        {item.change_display}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="col-span-2 text-xs text-[var(--color-text-muted)]/50 text-center py-4">暫無數據</p>
              )}
            </div>
          </Card>

          {/* Watchlist */}
          <Card className="p-3">
            <h3 className="text-xs font-semibold flex items-center gap-1.5 mb-2 text-[var(--color-text-muted)]">
              <Star size={12} /> 自選股
              <span className="text-[10px] text-[var(--color-text-muted)]/50 ml-auto">{watchlist.length} 檔</span>
            </h3>
            {/* Add ticker input */}
            <div className="flex gap-1 mb-2">
              <input
                type="text" value={selectedTicker}
                onChange={(e) => setSelectedTicker(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === "Enter") { addToWl(selectedTicker); } }}
                placeholder="添加代碼..."
                className="flex-1 px-2 py-1 text-[11px] rounded border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              />
              <button onClick={() => addToWl(selectedTicker)} disabled={!selectedTicker.trim()}
                className="px-2 py-1 text-[11px] rounded bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 disabled:opacity-30">
                +
              </button>
            </div>
            <div className="space-y-0.5 max-h-[180px] overflow-y-auto">
              {watchlist.map(t => (
                <div key={t} className={cn(
                  "group flex items-center justify-between px-2 py-1 rounded text-xs cursor-pointer transition-colors",
                  selectedTicker === t ? "bg-indigo-500/10 text-indigo-400" : "hover:bg-[var(--color-surface-elevated)]"
                )} onClick={() => { setSelectedTicker(t); analyze(t); }}>
                  <span className="font-mono font-medium">{t}</span>
                  <button onClick={(e) => { e.stopPropagation(); removeFromWl(t); }}
                    className="opacity-0 group-hover:opacity-100 text-[var(--color-text-muted)] hover:text-red-400 transition-opacity">
                    <X size={11} />
                  </button>
                </div>
              ))}
              {watchlist.length === 0 && (
                <p className="text-xs text-[var(--color-text-muted)]/50 text-center py-3">
                  在上方輸入代碼後按 + 添加
                </p>
              )}
            </div>
          </Card>

          {/* Economic Calendar */}
          <Card className="p-3">
            <h3 className="text-xs font-semibold flex items-center gap-1.5 mb-2 text-[var(--color-text-muted)]">
              <Calendar size={12} /> 財經日曆
            </h3>
            <div className="space-y-0.5 max-h-[360px] overflow-y-auto">
              {calendar.map(evt => (
                <div key={evt.id} className={cn(
                  "flex items-center gap-1.5 px-1.5 py-1 rounded text-xs",
                  evt.importance === "high" ? "bg-red-500/5" : ""
                )}>
                  <span className="text-[10px] text-[var(--color-text-muted)]/70 w-10 shrink-0">
                    {evt.date.slice(5)}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)]/50 w-8 shrink-0">{evt.time}</span>
                  <span className="text-xs mr-1">{countryFlag(evt.country)}</span>
                  <span className="flex-1 truncate text-[var(--color-text-secondary)]">{evt.name}</span>
                  <span className={cn("shrink-0 text-[10px] font-mono",
                    evt.actual_impact === "bullish" ? "text-emerald-400" :
                    evt.actual_impact === "bearish" ? "text-red-400" : "text-[var(--color-text-muted)]"
                  )}>
                    {evt.actual || evt.forecast || "--"}
                    {evt.actual_impact === "bullish" ? " ▲" : evt.actual_impact === "bearish" ? " ▼" : ""}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)]/40 text-center mt-2">
              ⚠️ 模板資料，非真實日曆
            </p>
          </Card>
        </div>

        {/* ── CENTER: Analysis ── */}
        <div className="space-y-4 order-1 lg:order-2">
          {/* Analysis Toolbar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="text" value={selectedTicker}
                onChange={(e) => setSelectedTicker(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && analyze(selectedTicker)}
                placeholder="輸入代碼，如 AAPL、TSLA、NVDA..."
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
            <Button onClick={() => analyze(selectedTicker)} disabled={loading || !selectedTicker.trim()} className="gap-1.5">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              {loading ? "分析中" : "AI 分析"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => addToWl(selectedTicker)} disabled={!selectedTicker.trim()}
              title="加入自選">
              <Star size={14} />
            </Button>
          </div>

          {/* Quick Picks */}
          <div className="flex flex-wrap gap-1">
            {["AAPL","TSLA","NVDA","MSFT","AMD","MSTR","COIN","QQQ","SPY"].map(t => (
              <button key={t} onClick={() => { setSelectedTicker(t); analyze(t); }}
                className="px-2 py-0.5 text-[11px] rounded-full border border-[var(--color-border)] hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-colors">
                {t}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">分析失敗</p>
                <p className="opacity-80">{error}</p>
                {result?.status === "no_api_key" && (
                  <p className="opacity-60 mt-1">請在 .env 設定 DEEPSEEK_API_KEY</p>
                )}
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <Card className="p-10 flex flex-col items-center gap-3">
              <Loader2 size={36} className="animate-spin text-indigo-400" />
              <p className="text-sm text-[var(--color-text-muted)]">AI 正在分析 {selectedTicker}...</p>
              <p className="text-xs text-[var(--color-text-muted)]/50">擷取數據 → 構建提示詞 → LLM 推理 → 驗證結果</p>
            </Card>
          )}

          {/* ═══ ANALYSIS RESULT ═══ */}
          {a && !loading && (
            <div className="space-y-3 animate-in fade-in">
              {/* Decision Card */}
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/10">
                      {decisionIcon(a.decision as string || "HOLD")}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold">{result?.ticker}</span>
                        {decisionBadge(a.decision as string || "HOLD")}
                        <Badge variant="info" size="sm">信心 {a.confidence as number}%</Badge>
                      </div>
                      <p className="text-[11px] text-[var(--color-text-muted)]">
                        {result?.provider} / {result?.model}
                        {result?.analysis_time_ms ? ` · ${(result.analysis_time_ms / 1000).toFixed(1)}s` : ""}
                      </p>
                    </div>
                  </div>
                  {confidenceRing(a.confidence as number || 50)}
                </div>
                <p className="text-sm leading-relaxed text-[var(--color-text-secondary)] mt-3 pt-3 border-t border-[var(--color-border)]">
                  {a.summary as string}
                </p>
              </Card>

              {/* Scores grid */}
              <button onClick={() => toggleSection("scores")} className="w-full flex items-center justify-between px-1 py-1 text-xs font-semibold text-[var(--color-text-muted)]">
                <span className="flex items-center gap-1.5"><BarChart3 size={12} /> 四維評分</span>
                {expandedSections.scores ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {expandedSections.scores ? (
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { l: "技術面", v: a.technical_score, c: "text-indigo-400" },
                    { l: "基本面", v: a.fundamental_score, c: "text-amber-400" },
                    { l: "情緒面", v: a.sentiment_score, c: "text-purple-400" },
                    { l: "綜合", v: a.overall_score, c: "text-emerald-400" },
                  ].map((s, i) => (
                    <Card key={i} className="p-2 text-center">
                      <p className="text-[10px] text-[var(--color-text-muted)]">{s.l}</p>
                      <p className={cn("text-sm font-mono font-bold", scoreColor(s.v as number || 0))}>
                        {(s.v as number) > 0 ? "+" : ""}{s.v as number}
                      </p>
                      {/* Progress bar */}
                      <div className="mt-1 h-1 rounded-full bg-[var(--color-border)]">
                        <div className={cn("h-full rounded-full transition-all", s.c)}
                          style={{ width: `${Math.min(100, Math.abs(s.v as number || 0))}%` }} />
                      </div>
                    </Card>
                  ))}
                </div>
              ) : null}

              {/* Trading Plan */}
              <Card className="p-3">
                <h3 className="text-xs font-semibold text-[var(--color-text-muted)] mb-2 flex items-center gap-1.5">
                  <Target size={12} /> 交易計畫
                </h3>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { l: "進場價", v: `$${(a.entry_price as number)?.toFixed(2) || "--"}`, c: "" },
                    { l: "止損", v: `$${(a.stop_loss as number)?.toFixed(2) || "--"}`, c: "text-red-400" },
                    { l: "止盈", v: `$${(a.take_profit as number)?.toFixed(2) || "--"}`, c: "text-emerald-400" },
                    { l: "建議倉位", v: `${a.position_size_pct as number || "--"}%`, c: "" },
                  ].map((s, i) => (
                    <div key={i}>
                      <p className="text-[10px] text-[var(--color-text-muted)]">{s.l}</p>
                      <p className={cn("text-sm font-mono font-bold", s.c)}>{s.v}</p>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Trend Outlook */}
              {a.trend_outlook && (
                <>
                  <button onClick={() => toggleSection("trend")} className="w-full flex items-center justify-between px-1 py-1 text-xs font-semibold text-[var(--color-text-muted)]">
                    <span className="flex items-center gap-1.5"><Clock size={12} /> 趨勢展望</span>
                    {expandedSections.trend ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {expandedSections.trend && (
                    <Card className="p-3">
                      <div className="grid grid-cols-2 gap-3">
                        {(a.trend_outlook as Record<string, string>)?.short_term && (
                          <div>
                            <p className="text-[10px] text-[var(--color-text-muted)]">短期 (1-3 天)</p>
                            <p className="text-xs text-[var(--color-text-secondary)]">{(a.trend_outlook as Record<string, string>).short_term}</p>
                          </div>
                        )}
                        {(a.trend_outlook as Record<string, string>)?.medium_term && (
                          <div>
                            <p className="text-[10px] text-[var(--color-text-muted)]">中期 (1-4 週)</p>
                            <p className="text-xs text-[var(--color-text-secondary)]">{(a.trend_outlook as Record<string, string>).medium_term}</p>
                          </div>
                        )}
                      </div>
                    </Card>
                  )}
                </>
              )}

              {/* Detailed Analysis */}
              <button onClick={() => toggleSection("details")} className="w-full flex items-center justify-between px-1 py-1 text-xs font-semibold text-[var(--color-text-muted)]">
                <span className="flex items-center gap-1.5"><Brain size={12} /> 詳細分析</span>
                {expandedSections.details ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {expandedSections.details && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {[
                    { l: "技術面", v: a.technical_analysis, i: <BarChart3 size={12} />, c: "text-indigo-400" },
                    { l: "基本面", v: a.fundamental_analysis, i: <Target size={12} />, c: "text-amber-400" },
                    { l: "市場情緒", v: a.sentiment_analysis, i: <Sparkles size={12} />, c: "text-purple-400" },
                  ].map((s, i) => (
                    <Card key={i} className="p-3">
                      <h4 className={cn("text-xs font-semibold mb-1.5 flex items-center gap-1", s.c)}>{s.i} {s.l}</h4>
                      <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">{s.v as string}</p>
                    </Card>
                  ))}
                </div>
              )}

              {/* Key Reasons & Risks */}
              <button onClick={() => toggleSection("reasons")} className="w-full flex items-center justify-between px-1 py-1 text-xs font-semibold text-[var(--color-text-muted)]">
                <span className="flex items-center gap-1.5"><Shield size={12} /> 理由與風險</span>
                {expandedSections.reasons ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {expandedSections.reasons && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Card className="p-3 border-emerald-500/10">
                    <p className="text-xs font-semibold text-emerald-400 mb-1.5">✅ 關鍵理由</p>
                    <ul className="space-y-1">
                      {(a.key_reasons as string[] || []).map((r, i) => (
                        <li key={i} className="text-xs text-[var(--color-text-secondary)] flex gap-1">
                          <span className="text-emerald-400 shrink-0">•</span> {r}
                        </li>
                      ))}
                    </ul>
                  </Card>
                  <Card className="p-3 border-red-500/10">
                    <p className="text-xs font-semibold text-red-400 mb-1.5">⚠️ 風險提示</p>
                    <ul className="space-y-1">
                      {(a.risks as string[] || []).map((r, i) => (
                        <li key={i} className="text-xs text-[var(--color-text-secondary)] flex gap-1">
                          <span className="text-red-400 shrink-0">•</span> {r}
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>
              )}

              {/* Market Data (raw) */}
              <details className="text-xs">
                <summary className="text-[var(--color-text-muted)]/50 cursor-pointer hover:text-[var(--color-text-muted)]">原始數據</summary>
                <pre className="mt-1 p-2 rounded bg-[var(--color-surface)] border border-[var(--color-border)] overflow-x-auto text-[10px] text-[var(--color-text-muted)] max-h-40">
                  {JSON.stringify(result?.market_data, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>

        {/* ── RIGHT: Info ── */}
        <div className="space-y-3 order-3">
          <Card className="p-3">
            <h3 className="text-xs font-semibold text-[var(--color-text-muted)] mb-2 flex items-center gap-1.5">
              <Sparkles size={12} /> AI 模型
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {result?.provider || "DeepSeek"} / {result?.model || "deepseek-chat"}
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)]/50 mt-1">
              繁體中文分析，基於即時市場數據
            </p>
          </Card>

          <Card className="p-3">
            <h3 className="text-xs font-semibold text-[var(--color-text-muted)] mb-2 flex items-center gap-1.5">
              <Gauge size={12} /> 數據來源
            </h3>
            <ul className="text-[10px] text-[var(--color-text-muted)]/70 space-y-1">
              <li>• yfinance — 價格/技術指標</li>
              <li>• alternative.me — 恐懼貪婪指數</li>
              <li>• PostgreSQL — 選擇權波動率</li>
              <li>• DeepSeek/OpenRouter — LLM</li>
            </ul>
          </Card>

          <p className="text-[10px] text-[var(--color-text-muted)]/40 text-center px-2">
            ⚠️ AI 分析僅供參考，不構成投資建議<br />
            投資有風險，交易需謹慎
          </p>
        </div>
      </div>
    </div>
  );
}
