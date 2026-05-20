"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  Activity,
  Shield,
  AlertTriangle,
  Target,
  Copy,
  Check,
  Loader2,
  Search,
  Zap,
  BarChart3,
  ChevronRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AnalysisResult {
  status: string;
  ticker: string;
  data: {
    price: number | null;
    iv: number;
    hv: number;
    iv_hv_spread: number;
    iv_rank: number;
    pcr: number;
    call_volume: number;
    put_volume: number;
    total_volume: number;
    unusual_activity: boolean;
    ai_risk_alert: string;
  };
  technical: {
    rsi: number | null;
    bollinger: { upper: number; middle: number; lower: number; pct_b: number; current: number } | null;
    support_resistance: { support: number; resistance: number } | null;
  };
  diagnostics: string[];
  iv_regime: string;
  pcr_signal: string;
  alert_review: string | null;
  strategies: { name: string; rationale: string; max_profit: string; max_loss: string; risk_level: string }[];
  llm_prompt: string;
}

const TRACKED_TICKERS = ["NVDA", "TSLA", "AAPL", "AMD", "MSTR", "COIN", "SMCI", "PLTR", "ARM", "AVGO"];

export default function QuantAnalysisPage() {
  const [ticker, setTicker] = useState("NVDA");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const fetchAnalysis = useCallback(async (t: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/quant/analyze?ticker=${t}`);
      const data = await res.json();
      if (data.status === "ok") {
        setResult(data);
      } else {
        setError(data.message || "分析失敗");
        setResult(null);
      }
    } catch {
      setError("連線失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalysis(ticker);
  }, []);

  function handleTickerChange(t: string) {
    setTicker(t);
    fetchAnalysis(t);
  }

  function copyPrompt() {
    if (result?.llm_prompt) {
      navigator.clipboard.writeText(result.llm_prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const regimeLabel: Record<string, string> = {
    extreme_high: "極端擴張",
    elevated: "偏高",
    normal: "正常",
    compressed: "收斂",
  };

  const pcrLabel: Record<string, string> = {
    bullish: "過度看漲",
    bearish: "看跌情緒",
    neutral: "中性",
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between max-sm:flex-col max-sm:gap-3 max-sm:items-start">
        <div>
          <h1 className="text-2xl font-bold">Quant Analysis — 波動率診斷</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Hermes AI 量化引擎：IV/HV 結構、PCR 籌碼、技術指標交叉驗證、策略推演
          </p>
        </div>
      </div>

      {/* Ticker selector */}
      <Card>
        <div className="flex items-center gap-3 flex-wrap">
          <Search size={16} className="text-[var(--color-text-muted)] shrink-0" />
          {TRACKED_TICKERS.map((t) => (
            <button
              key={t}
              onClick={() => handleTickerChange(t)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                ticker === t
                  ? "bg-indigo-500 text-white"
                  : "bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-indigo-400" />
          <span className="ml-3 text-sm text-[var(--color-text-muted)]">分析中...</span>
        </div>
      )}

      {error && (
        <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-center">
          <AlertTriangle size={32} className="mx-auto text-red-400 mb-2" />
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {result && !loading && (
        <>
          {/* ── 1. Data Status ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity size={18} className="text-indigo-400" />
                <CardTitle>系統數據狀態</CardTitle>
                <Badge variant="success" size="sm">{result.ticker}</Badge>
              </div>
            </CardHeader>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[
                ["Price", `$${result.data.price?.toFixed(2) || "—"}`],
                ["IV", `${result.data.iv?.toFixed(1)}%`],
                ["HV (20d)", `${result.data.hv?.toFixed(1)}%`],
                ["IV/HV Spread", `${result.data.iv_hv_spread?.toFixed(1)}%`],
                ["IV Rank", `${result.data.iv_rank?.toFixed(0)}%`],
                ["PCR", result.data.pcr?.toFixed(2)],
                ["RSI(14)", result.technical.rsi?.toFixed(1) || "N/A"],
                ["%B", result.technical.bollinger ? `${result.technical.bollinger.pct_b}%` : "N/A"],
              ].map(([label, value]) => (
                <div key={label} className="px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                  <p className="text-[10px] uppercase text-[var(--color-text-muted)]">{label}</p>
                  <p className="text-sm font-mono font-medium">{value}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* ── 2. Diagnostic ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-amber-400" />
                <CardTitle>波動率與籌碼診斷</CardTitle>
                <Badge variant={result.iv_regime === "extreme_high" ? "danger" : result.iv_regime === "compressed" ? "info" : "default"} size="sm">
                  IV: {regimeLabel[result.iv_regime] || result.iv_regime}
                </Badge>
                <Badge variant={result.pcr_signal === "bearish" ? "danger" : result.pcr_signal === "bullish" ? "warning" : "default"} size="sm">
                  PCR: {pcrLabel[result.pcr_signal] || result.pcr_signal}
                </Badge>
              </div>
            </CardHeader>
            <div className="space-y-2">
              {result.diagnostics.map((d, i) => (
                <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[var(--color-surface)]">
                  <ChevronRight size={14} className="text-[var(--color-accent)] mt-0.5 shrink-0" />
                  <p className="text-sm text-[var(--color-text-secondary)]">{d}</p>
                </div>
              ))}
            </div>

            {/* AI Alert Review */}
            {result.alert_review && (
              <div className={cn(
                "mt-4 p-4 rounded-xl border",
                result.alert_review.includes("駁回") ? "bg-red-500/5 border-red-500/20" : "bg-amber-500/5 border-amber-500/20"
              )}>
                <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">舊系統 AI 警示覆核</p>
                <p className="text-sm text-[var(--color-text-secondary)]">{result.alert_review}</p>
              </div>
            )}
          </Card>

          {/* ── 3. Technical ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BarChart3 size={18} className="text-sky-400" />
                  <CardTitle>技術指標</CardTitle>
                </div>
              </CardHeader>
              <div className="space-y-3">
                {result.technical.rsi && (
                  <div className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                    <p className="text-xs text-[var(--color-text-muted)] mb-1">RSI (14)</p>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-lg font-bold", result.technical.rsi > 70 ? "text-red-400" : result.technical.rsi < 30 ? "text-emerald-400" : "text-[var(--color-text-primary)]")}>
                        {result.technical.rsi}
                      </span>
                      <Badge variant={result.technical.rsi > 70 ? "danger" : result.technical.rsi < 30 ? "success" : "default"} size="sm">
                        {result.technical.rsi > 70 ? "超買" : result.technical.rsi < 30 ? "超賣" : "正常"}
                      </Badge>
                    </div>
                  </div>
                )}
                {result.technical.bollinger && (
                  <div className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                    <p className="text-xs text-[var(--color-text-muted)] mb-1">Bollinger Bands (20,2)</p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div><span className="text-[var(--color-text-muted)]">上軌</span><p className="font-mono">{result.technical.bollinger.upper}</p></div>
                      <div><span className="text-[var(--color-text-muted)]">中軌</span><p className="font-mono">{result.technical.bollinger.middle}</p></div>
                      <div><span className="text-[var(--color-text-muted)]">下軌</span><p className="font-mono">{result.technical.bollinger.lower}</p></div>
                    </div>
                    <p className="text-xs mt-2">
                      %B: <span className="font-mono">{result.technical.bollinger.pct_b}%</span>
                      {result.technical.bollinger.pct_b > 100 ? " — 突破上軌" : result.technical.bollinger.pct_b < 0 ? " — 跌破下軌" : ""}
                    </p>
                  </div>
                )}
                {result.technical.support_resistance && (
                  <div className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                    <p className="text-xs text-[var(--color-text-muted)] mb-1">支撐 / 壓力</p>
                    <div className="flex gap-4 text-sm">
                      <span>🟢 支撐 <span className="font-mono">${result.technical.support_resistance.support}</span></span>
                      <span>🔴 壓力 <span className="font-mono">${result.technical.support_resistance.resistance}</span></span>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* ── 4. Strategies ── */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Target size={18} className="text-emerald-400" />
                  <CardTitle>策略推演</CardTitle>
                </div>
              </CardHeader>
              <div className="space-y-3">
                {result.strategies.map((s, i) => (
                  <div key={i} className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-sm">{s.name}</p>
                      <Badge variant={s.risk_level === "high" ? "danger" : s.risk_level === "medium" ? "warning" : "success"} size="sm">
                        {s.risk_level === "high" ? "高風險" : s.risk_level === "medium" ? "中風險" : "低風險"}
                      </Badge>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] mb-2">{s.rationale}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-[var(--color-text-muted)]">最大獲利</span><p className="text-emerald-400">{s.max_profit}</p></div>
                      <div><span className="text-[var(--color-text-muted)]">最大虧損</span><p className="text-red-400">{s.max_loss}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* LLM Prompt */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap size={18} className="text-purple-400" />
                  <CardTitle>AI 分析提示詞</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={copyPrompt}>
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span className="ml-1">{copied ? "已複製" : "複製"}</span>
                </Button>
              </div>
            </CardHeader>
            <pre className="p-4 text-xs font-mono text-[var(--color-text-secondary)] bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
              {result.llm_prompt}
            </pre>
          </Card>

          {/* Disclaimer */}
          <p className="text-xs text-center text-[var(--color-text-muted)]">
            ⚠️ 以上分析基於公開市場數據與數學模型推演，不構成投資建議。選擇權交易存在重大風險，可能導致本金全部損失。請根據個人風險承受能力獨立決策。
          </p>
        </>
      )}
    </div>
  );
}
