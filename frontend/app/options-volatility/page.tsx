"use client";

import { useEffect, useState, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Zap,
  BarChart3,
  Activity,
  RefreshCw,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, fmtNum } from "@/lib/utils";

/* ===== Types ===== */
interface OptionsSnapshot {
  ticker: string;
  name: string;
  price: number;
  change_pct: number;
  implied_volatility: number | null;
  historical_volatility: number | null;
  iv_hv_spread: number | null;       // IV - HV
  put_call_ratio: number | null;
  call_volume: number;
  put_volume: number;
  total_volume: number;
  unusual_activity: boolean;
  ai_alert?: string;
}

/* ===== Mock Data ===== */
const TRACKED_TICKERS = [
  "TSLA", "NVDA", "AMD", "AAPL", "MSTR", "COIN", "SMCI", "PLTR", "ARM", "AVGO",
];

function generateMockData(): OptionsSnapshot[] {
  const names: Record<string, string> = {
    TSLA: "Tesla", NVDA: "NVIDIA", AMD: "AMD", AAPL: "Apple",
    MSTR: "MicroStrategy", COIN: "Coinbase", SMCI: "Super Micro",
    PLTR: "Palantir", ARM: "ARM Holdings", AVGO: "Broadcom",
  };
  return TRACKED_TICKERS.map((ticker) => {
    const price = 100 + Math.random() * 900;
    const iv = 30 + Math.random() * 70;
    const hv = 25 + Math.random() * 50;
    const spread = iv - hv;
    const pcr = 0.3 + Math.random() * 2.2;
    const unusual = Math.random() > 0.7;
    return {
      ticker,
      name: names[ticker] || ticker,
      price: Math.round(price * 100) / 100,
      change_pct: Math.round((Math.random() * 10 - 4) * 100) / 100,
      implied_volatility: Math.round(iv * 100) / 100,
      historical_volatility: Math.round(hv * 100) / 100,
      iv_hv_spread: Math.round(spread * 100) / 100,
      put_call_ratio: Math.round(pcr * 100) / 100,
      call_volume: Math.floor(Math.random() * 500000) + 10000,
      put_volume: Math.floor(Math.random() * 300000) + 5000,
      total_volume: Math.floor(Math.random() * 800000) + 20000,
      unusual_activity: unusual,
      ai_alert: unusual
        ? `⚠️ ${ticker} IV 異常擴張：IV-HV spread = ${spread.toFixed(1)}%，PCR = ${pcr.toFixed(2)}。財報前避險情緒升溫，考慮做多波動率 (Long Straddle) 策略。`
        : undefined,
    };
  });
}

/* ===== Components ===== */

function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  const width = 80;
  const height = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map(
      (v, i) =>
        `${(i / (values.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`
    )
    .join(" ");
  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={positive ? "#22c55e" : "#ef4444"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IVSpreadGauge({ spread }: { spread: number }) {
  const isWarning = spread > 20;
  const isDanger = spread > 35;
  const width = 120;
  const pct = Math.min(Math.max((spread + 10) / 60, 0.05), 0.95) * width;

  return (
    <div className="relative w-[120px]">
      <div className="h-2 rounded-full bg-[var(--color-surface)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${(pct / width) * 100}%`,
            background: isDanger
              ? "linear-gradient(90deg, #f59e0b, #ef4444)"
              : isWarning
              ? "linear-gradient(90deg, #22c55e, #f59e0b)"
              : "#22c55e",
          }}
        />
      </div>
      <span
        className={cn(
          "text-[10px] font-mono mt-0.5 block",
          isDanger ? "text-red-400" : isWarning ? "text-amber-400" : "text-emerald-400"
        )}
      >
        {spread > 0 ? "+" : ""}{spread.toFixed(1)}%
      </span>
    </div>
  );
}

function TickerRow({ data }: { data: OptionsSnapshot }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "border-b border-[var(--color-border)]/50 cursor-pointer transition-colors",
          "hover:bg-[var(--color-surface-elevated)]/50",
          data.unusual_activity && "bg-red-500/5"
        )}
      >
        <td className="py-3 px-3">
          <div className="flex items-center gap-2">
            {data.unusual_activity && (
              <AlertTriangle size={12} className="text-red-400 animate-pulse" />
            )}
            <span className="font-semibold text-sm">{data.ticker}</span>
          </div>
        </td>
        <td className="py-3 px-3 text-sm text-[var(--color-text-secondary)] hidden sm:table-cell">
          {data.name}
        </td>
        <td className="py-3 px-3 text-sm font-mono">
          <span className={data.change_pct >= 0 ? "text-emerald-400" : "text-red-400"}>
            ${data.price.toFixed(1)}
          </span>
        </td>
        <td className="py-3 px-3">
          <span className={cn("text-xs font-mono", data.change_pct >= 0 ? "text-emerald-400" : "text-red-400")}>
            {data.change_pct >= 0 ? "+" : ""}{data.change_pct.toFixed(1)}%
          </span>
        </td>
        <td className="py-3 px-3">
          <IVSpreadGauge spread={data.iv_hv_spread ?? 0} />
        </td>
        <td className="py-3 px-3 text-sm font-mono">
          <span
            className={cn(
              (data.put_call_ratio ?? 0) > 1.5
                ? "text-red-400"
                : (data.put_call_ratio ?? 0) > 1.0
                ? "text-amber-400"
                : "text-emerald-400"
            )}
          >
            {data.put_call_ratio?.toFixed(2) ?? "N/A"}
          </span>
        </td>
        <td className="py-3 px-3 text-xs text-[var(--color-text-muted)] hidden lg:table-cell">
          {fmtNum(data.total_volume, 0)}
        </td>
        <td className="py-3 px-1">
          {expanded ? <ChevronUp size={14} className="text-[var(--color-text-muted)]" /> : <ChevronDown size={14} className="text-[var(--color-text-muted)]" />}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-[var(--color-surface)]">
          <td colSpan={8} className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="space-y-2">
                <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                  IV / HV Breakdown
                </p>
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-[var(--color-text-muted)] text-xs">IV</span>
                    <p className="font-mono">{data.implied_volatility?.toFixed(1) ?? "N/A"}%</p>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)] text-xs">HV(20d)</span>
                    <p className="font-mono">{data.historical_volatility?.toFixed(1) ?? "N/A"}%</p>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)] text-xs">Spread</span>
                    <p className={cn("font-mono", (data.iv_hv_spread ?? 0) > 20 ? "text-red-400" : "text-emerald-400")}>
                      {(data.iv_hv_spread ?? 0) > 0 ? "+" : ""}{data.iv_hv_spread?.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                  Options Volume
                </p>
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-[var(--color-text-muted)] text-xs">Calls</span>
                    <p className="font-mono text-emerald-400">{fmtNum(data.call_volume, 0)}</p>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)] text-xs">Puts</span>
                    <p className="font-mono text-red-400">{fmtNum(data.put_volume, 0)}</p>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)] text-xs">PCR</span>
                    <p className="font-mono">{data.put_call_ratio?.toFixed(2)}</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                  Signal
                </p>
                <Badge variant={data.unusual_activity ? "danger" : "success"} size="md">
                  {data.unusual_activity ? "⚠ Unusual Activity" : "✓ Normal"}
                </Badge>
              </div>
            </div>
            {data.ai_alert && (
              <div className="mt-3 p-3 rounded-xl bg-red-500/5 border border-red-500/10 text-xs text-red-400/90">
                <span className="font-semibold">🤖 AI Risk Alert:</span> {data.ai_alert}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/* ===== Main Page ===== */
export default function OptionsVolatilityPage() {
  const [data, setData] = useState<OptionsSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"iv_spread" | "pcr" | "volume">("iv_spread");

  const fetchData = () => {
    setLoading(true);
    // In production, fetch from /api/options
    setTimeout(() => {
      setData(generateMockData());
      setLoading(false);
    }, 600);
  };

  useEffect(() => { fetchData(); }, []);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      if (sortBy === "iv_spread") return (b.iv_hv_spread ?? 0) - (a.iv_hv_spread ?? 0);
      if (sortBy === "pcr") return (b.put_call_ratio ?? 0) - (a.put_call_ratio ?? 0);
      return b.total_volume - a.total_volume;
    });
  }, [data, sortBy]);

  const unusualCount = data.filter((d) => d.unusual_activity).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-[slideIn_0.4s_ease-out]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Options & Volatility Monitor</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Real-time Put/Call ratio, IV vs HV spread, and unusual options activity detection for high-volatility tech stocks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unusualCount > 0 && (
            <Badge variant="danger" size="md">
              <AlertTriangle size={12} />
              {unusualCount} Alert{unusualCount > 1 ? "s" : ""}
            </Badge>
          )}
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "IV/HV Expansion",
            value: `${unusualCount} tickers`,
            sub: "Spread > 20% threshold",
            icon: Activity,
            color: "text-red-400",
            bg: "bg-red-500/10",
          },
          {
            label: "Avg Put/Call Ratio",
            value: data.length > 0
              ? (data.reduce((s, d) => s + (d.put_call_ratio ?? 0), 0) / data.length).toFixed(2)
              : "—",
            sub: ">1.5 = bearish skew",
            icon: TrendingDown,
            color: "text-amber-400",
            bg: "bg-amber-500/10",
          },
          {
            label: "Total Options Volume",
            value: fmtNum(data.reduce((s, d) => s + d.total_volume, 0), 0),
            sub: "Across all tracked tickers",
            icon: BarChart3,
            color: "text-indigo-400",
            bg: "bg-indigo-500/10",
          },
          {
            label: "Tracked Tickers",
            value: String(data.length),
            sub: "High-volatility tech stocks",
            icon: Zap,
            color: "text-sky-400",
            bg: "bg-sky-500/10",
          },
        ].map((card) => (
          <Card key={card.label}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                {card.label}
              </p>
              <div className={card.bg + " p-2 rounded-lg"}>
                <card.icon size={16} className={card.color} />
              </div>
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">{card.sub}</p>
          </Card>
        ))}
      </div>

      {/* Sort Controls */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--color-text-muted)]">Sort by:</span>
        {[
          { key: "iv_spread", label: "IV Spread" },
          { key: "pcr", label: "Put/Call Ratio" },
          { key: "volume", label: "Volume" },
        ].map((opt) => (
          <button
            key={opt.key}
            onClick={() => setSortBy(opt.key as typeof sortBy)}
            className={cn(
              "px-3 py-1.5 text-xs rounded-lg transition-all",
              sortBy === opt.key
                ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Ticker Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                {["Ticker", "Name", "Price", "Chg%", "IV Spread", "P/C Ratio", "Volume", ""].map(
                  (h, i) => (
                    <th
                      key={h}
                      className={cn(
                        "text-left py-3 px-3 text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider",
                        h === "Name" && "hidden sm:table-cell",
                        h === "Volume" && "hidden lg:table-cell"
                      )}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {sorted.map((d) => (
                <TickerRow key={d.ticker} data={d} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Strategy Guide */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info size={16} className="text-[var(--color-accent)]" />
            <CardTitle>AI-Powered Volatility Strategy Guide</CardTitle>
          </div>
        </CardHeader>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
            <p className="font-semibold text-emerald-400 mb-1">📈 IV Contraction (IV &lt; HV)</p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Market pricing in lower future volatility than realized. Consider
              <span className="text-emerald-400 font-mono"> Short Straddle </span>
              or
              <span className="text-emerald-400 font-mono"> Iron Condor </span>
              to capture volatility mean-reversion.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
            <p className="font-semibold text-amber-400 mb-1">⚖️ IV = HV (Fair Value)</p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Options are fairly priced. Directional plays recommended:
              <span className="text-amber-400 font-mono"> Call/Put Spreads </span>
              based on PCR skew and technical analysis.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
            <p className="font-semibold text-red-400 mb-1">📉 IV Expansion (IV &gt; HV)</p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Elevated fear premium. Consider
              <span className="text-red-400 font-mono"> Long Straddle </span>
              pre-earnings, or
              <span className="text-red-400 font-mono"> Calendar Spread </span>
              to exploit term structure.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
