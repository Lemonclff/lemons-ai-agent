"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, Activity, Shield, AlertTriangle, Target,
  Copy, Check, Loader2, Search, Zap, BarChart3, ChevronRight,
  Plus, RefreshCw, X, Trash2, Clock, Download, CheckCircle2,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ===== Types ===== */
interface AnalysisResult {
  status: string; ticker: string; generated_at: string; fetched_at?: string;
  data: { price: number | null; iv: number; hv: number; iv_hv_spread: number; iv_rank: number; pcr: number; call_volume: number; put_volume: number; total_volume: number; unusual_activity: boolean; ai_risk_alert: string; };
  technical: { rsi: number | null; bollinger: { upper: number; middle: number; lower: number; pct_b: number; current: number } | null; support_resistance: { support: number; resistance: number } | null; };
  diagnostics: string[]; iv_regime: string; pcr_signal: string;
  alert_review: string | null;
  strategies: { name: string; rationale: string; max_profit: string; max_loss: string; risk_level: string }[];
  llm_prompt: string;
}

/* ===== localStorage ===== */
const STORAGE_KEY = "quant_watchlist";
const DEFAULT_TICKERS = ["NVDA", "TSLA", "AAPL", "AMD", "MSTR", "COIN"];

function loadWatchlist(): string[] {
  try { const v = localStorage.getItem(STORAGE_KEY); return v ? JSON.parse(v) : [...DEFAULT_TICKERS]; }
  catch { return [...DEFAULT_TICKERS]; }
}
function saveWatchlist(list: string[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }

/* ===== Labels ===== */
const regimeLabel: Record<string, string> = { extreme_high: "極端擴張", elevated: "偏高", normal: "正常", compressed: "收斂" };
const pcrLabel: Record<string, string> = { bullish: "過度看漲", bearish: "看跌情緒", neutral: "中性" };

/* ===== Page ===== */
export default function QuantAnalysisPage() {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [results, setResults] = useState<Record<string, AnalysisResult>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [fetching, setFetching] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchInput, setSearchInput] = useState("");
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [searchError, setSearchError] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [copiedTicker, setCopiedTicker] = useState<string | null>(null);

  // Init watchlist
  useEffect(() => { setWatchlist(loadWatchlist()); }, []);

  // Fetch analysis for a ticker (from DB only, no live fetch)
  const fetchAnalysis = useCallback(async (t: string) => {
    setLoading((p) => ({ ...p, [t]: true }));
    setErrors((p) => { const n = { ...p }; delete n[t]; return n; });
    try {
      const res = await fetch(`/api/quant/analyze?ticker=${t}`);
      const data = await res.json();
      if (data.status === "ok") {
        setResults((p) => ({ ...p, [t]: data }));
      } else {
        // No data in DB — trigger auto live fetch
        setErrors((p) => ({ ...p, [t]: data.message || "無數據" }));
        // Auto-fetch if no data exists
        if (data.status === "no_data") {
          fetchLive(t);
        }
      }
    } catch {
      setErrors((p) => ({ ...p, [t]: "連線失敗" }));
    } finally {
      setLoading((p) => ({ ...p, [t]: false }));
    }
  }, []);

  // Fetch live yfinance data → DB → then analyze
  const fetchLive = useCallback(async (t: string) => {
    setFetching((p) => ({ ...p, [t]: true }));
    try {
      // Step 1: Fetch live options data via options_api + populate DB
      const fetchRes = await fetch("/api/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: [t] }),
      });
      const fetchJson = await fetchRes.json();
      if (fetchJson._source !== "yfinance") {
        setErrors((p) => ({ ...p, [t]: "yfinance 數據擷取失敗" }));
        setFetching((p) => ({ ...p, [t]: false }));
        return;
      }
      // Also ensure price data exists
      await fetch(`/api/quant/ensure-prices?ticker=${t}`);
      // Step 2: Re-analyze from fresh DB data
      await fetchAnalysis(t);
    } catch {
      setErrors((p) => ({ ...p, [t]: "Fetch 失敗" }));
    } finally {
      setFetching((p) => ({ ...p, [t]: false }));
    }
  }, [fetchAnalysis]);

  // Load all on mount
  useEffect(() => {
    if (watchlist.length > 0) {
      watchlist.forEach((t) => fetchAnalysis(t));
    }
  }, [watchlist.length]);

  // Search
  function handleSearch(input: string) {
    const upper = input.toUpperCase().trim();
    setSearchInput(upper);
    if (!upper) { setSearchResult(null); setSearchError(""); return; }
    if (/^[A-Z]{1,5}$/.test(upper) || /^[A-Z]{1,5}\.[A-Z]{2}$/.test(upper)) {
      setSearchResult(upper); setSearchError("");
    } else {
      setSearchResult(null); setSearchError("格式: 1-5 字母 (如 MSFT)");
    }
  }

  function addTicker(t: string) {
    const upper = t.toUpperCase().trim();
    if (!upper || watchlist.includes(upper)) return;
    const updated = [...watchlist, upper];
    setWatchlist(updated); saveWatchlist(updated);
    setSearchInput(""); setSearchResult(null);
    fetchAnalysis(upper);
  }

  function deleteTicker(t: string) {
    const updated = watchlist.filter((x) => x !== t);
    setWatchlist(updated); saveWatchlist(updated);
    setResults((p) => { const n = { ...p }; delete n[t]; return n; });
    setErrors((p) => { const n = { ...p }; delete n[t]; return n; });
  }

  function toggleExpand(t: string) {
    setExpanded((p) => ({ ...p, [t]: !p[t] }));
  }

  function copyPrompt(ticker: string, prompt: string) {
    navigator.clipboard.writeText(prompt);
    setCopiedTicker(ticker);
    setTimeout(() => setCopiedTicker(null), 2000);
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between max-sm:flex-col max-sm:gap-3 max-sm:items-start">
        <div>
          <h1 className="text-2xl font-bold">Quant Analysis — 波動率診斷</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Hermes AI 量化引擎 · IV/HV · PCR · RSI · Bollinger · 策略推演
          </p>
        </div>
      </div>

      {/* Search + Add Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text" value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Add ticker... (e.g. MSFT, INTC, GOOGL)"
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
              onKeyDown={(e) => { if (e.key === "Enter" && searchResult) addTicker(searchResult); }}
            />
            {searchResult && <CheckCircle2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400" />}
          </div>
          <Button onClick={() => searchResult && addTicker(searchResult)} disabled={!searchResult || watchlist.includes(searchResult || "")} size="md">
            <Plus size={14} /> Add {searchResult || ""}
          </Button>
          {watchlist.length > DEFAULT_TICKERS.length && (
            <Button variant="ghost" size="sm" onClick={() => { setWatchlist([...DEFAULT_TICKERS]); saveWatchlist([...DEFAULT_TICKERS]); }}>
              Reset
            </Button>
          )}
        </div>
        {searchError && <p className="text-xs text-red-400 mt-2 ml-1">{searchError}</p>}
      </Card>

      {/* Watchlist chips + Fetch All */}
      <div className="flex items-center gap-2 flex-wrap">
        {watchlist.map((t) => (
          <button
            key={t}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all group",
              results[t] ? "bg-indigo-500/10 text-indigo-400" : "bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)]"
            )}
          >
            <span>{t}</span>
            <X size={12} className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity" onClick={(e) => { e.stopPropagation(); deleteTicker(t); }} />
          </button>
        ))}
      </div>

      {/* Results */}
      {watchlist.length === 0 && (
        <p className="text-center py-16 text-[var(--color-text-muted)]">Search a ticker above to start analysis</p>
      )}

      <div className="space-y-4">
        {watchlist.map((t) => {
          const r = results[t];
          const load = loading[t];
          const fetch = fetching[t];
          const err = errors[t];
          const exp = expanded[t];

          return (
            <Card key={t} className={cn("transition-all", exp && "border-[var(--color-accent)]/50")}>
              {/* Summary Row */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer"
                onClick={() => r && toggleExpand(t)}
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-500/10 shrink-0">
                  <TrendingUp size={18} className="text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{t}</span>
                    {r && (
                      <>
                        <Badge variant={r.iv_regime === "extreme_high" ? "danger" : r.iv_regime === "compressed" ? "info" : "default"} size="sm">
                          {regimeLabel[r.iv_regime] || r.iv_regime}
                        </Badge>
                        <Badge variant={r.pcr_signal === "bearish" ? "danger" : r.pcr_signal === "bullish" ? "warning" : "default"} size="sm">
                          PCR {r.data.pcr?.toFixed(2)}
                        </Badge>
                      </>
                    )}
                    {err && <Badge variant="danger" size="sm">Error</Badge>}
                  </div>
                  {r ? (
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      IV: {r.data.iv?.toFixed(1)}% · HV: {r.data.hv?.toFixed(1)}% · Spread: {r.data.iv_hv_spread?.toFixed(1)}% · RSI(14d): {r.technical.rsi?.toFixed(1) || "N/A"} · BB(20d,2σ) · {new Date(r.generated_at).toLocaleTimeString()}
                    </p>
                  ) : load ? (
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5 flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Loading...</p>
                  ) : fetch ? (
                    <p className="text-xs text-amber-400 mt-0.5 flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Fetching live data from yfinance...</p>
                  ) : (
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">No data — click <RefreshCw size={10} className="inline" /> to fetch</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" onClick={() => fetchLive(t)} disabled={fetch} title="Fetch live from yfinance">
                    {fetch ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteTicker(t)} title="Remove">
                    <Trash2 size={14} className="text-red-400" />
                  </Button>
                  {r && (
                    <Button variant="ghost" size="sm" onClick={() => toggleExpand(t)}>
                      <ChevronRight size={14} className={cn("transition-transform", exp && "rotate-90")} />
                    </Button>
                  )}
                </div>
              </div>

              {/* Expanded Analysis */}
              {exp && r && (
                <div className="px-4 pb-4 space-y-4 border-t border-[var(--color-border)] pt-4">
                  {/* Data Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[["Price", `$${r.data.price?.toFixed(2) || "—"}`], ["IV (straddle)", `${r.data.iv?.toFixed(1)}%`], ["HV (20d)", `${r.data.hv?.toFixed(1)}%`], ["Spread", `${r.data.iv_hv_spread?.toFixed(1)}%`], ["IV Rank (1y)", `${r.data.iv_rank?.toFixed(0)}%`], ["PCR", r.data.pcr?.toFixed(2)], ["RSI (14d close)", r.technical.rsi?.toFixed(1) || "N/A"], ["%B (20d,2σ)", r.technical.bollinger ? `${r.technical.bollinger.pct_b}%` : "N/A"]].map(([l, v]) => (
                      <div key={l} className="px-2 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                        <p className="text-[10px] uppercase text-[var(--color-text-muted)]">{l}</p>
                        <p className="text-xs font-mono font-medium">{v}</p>
                      </div>
                    ))}
                  </div>

                  {/* Diagnostics */}
                  <div className="space-y-1">
                    {r.diagnostics.map((d, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-[var(--color-text-secondary)]">
                        <ChevronRight size={12} className="text-[var(--color-accent)] mt-0.5 shrink-0" />{d}
                      </div>
                    ))}
                  </div>

                  {r.alert_review && (
                    <div className={cn("p-3 rounded-xl text-xs border", r.alert_review.includes("駁回") ? "bg-red-500/5 border-red-500/20 text-red-400" : "bg-amber-500/5 border-amber-500/20 text-amber-400")}>
                      {r.alert_review}
                    </div>
                  )}

                  {/* Technical + Strategies */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      {r.technical.rsi && (
                        <div className="p-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                          <span className="text-xs text-[var(--color-text-muted)]">RSI(14): </span>
                          <span className={cn("text-sm font-bold", r.technical.rsi > 70 ? "text-red-400" : r.technical.rsi < 30 ? "text-emerald-400" : "")}>{r.technical.rsi}</span>
                          <Badge variant={r.technical.rsi > 70 ? "danger" : r.technical.rsi < 30 ? "success" : "default"} size="sm" className="ml-2">
                            {r.technical.rsi > 70 ? "超買" : r.technical.rsi < 30 ? "超賣" : "正常"}
                          </Badge>
                        </div>
                      )}
                      {r.technical.bollinger && (
                        <div className="p-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-xs">
                          <span className="text-[var(--color-text-muted)]">BB(20,2): </span>
                          上{r.technical.bollinger.upper} · 中{r.technical.bollinger.middle} · 下{r.technical.bollinger.lower} · %B={r.technical.bollinger.pct_b}%
                        </div>
                      )}
                      {r.technical.support_resistance && (
                        <div className="p-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-xs">
                          🟢 S: ${r.technical.support_resistance.support} · 🔴 R: ${r.technical.support_resistance.resistance}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      {r.strategies.map((s, i) => (
                        <div key={i} className="p-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold">{s.name}</span>
                            <Badge variant={s.risk_level === "high" ? "danger" : s.risk_level === "medium" ? "warning" : "success"} size="sm">
                              {s.risk_level === "high" ? "高" : s.risk_level === "medium" ? "中" : "低"}風險
                            </Badge>
                          </div>
                          <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">{s.rationale}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* LLM Prompt */}
                  <div className="relative">
                    <pre className="p-3 text-[11px] font-mono text-[var(--color-text-secondary)] bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">{r.llm_prompt}</pre>
                    <Button variant="ghost" size="sm" className="absolute top-2 right-2" onClick={() => copyPrompt(t, r.llm_prompt)}>
                      {copiedTicker === t ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-center text-[var(--color-text-muted)]">
        ⚠️ 以上分析基於公開市場數據與數學模型推演，不構成投資建議。選擇權交易存在重大風險，可能導致本金全部損失。
      </p>
    </div>
  );
}
