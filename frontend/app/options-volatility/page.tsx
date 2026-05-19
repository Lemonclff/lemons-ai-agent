"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
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
  Search,
  Plus,
  X,
  Download,
  Clock,
  Trash2,
  CheckCircle2,
  Filter,
  Timer,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, fmtNum } from "@/lib/utils";

/* ============================================================================
   Types & Constants
   ============================================================================ */

interface OptionsSnapshot {
  ticker: string;
  name: string;
  price: number;
  change_pct: number;
  implied_volatility: number | null;
  historical_volatility: number | null;
  iv_hv_spread: number | null;
  put_call_ratio: number | null;
  call_volume: number;
  put_volume: number;
  total_volume: number;
  unusual_activity: boolean;
  ai_alert?: string;
  last_updated?: string;
}

type FilterMode = "all" | "alerts" | "high_iv" | "high_pcr";
type SortMode = "iv_spread" | "pcr" | "volume" | "ticker";

const DEFAULT_TICKERS = [
  "TSLA", "NVDA", "AMD", "AAPL", "MSTR", "COIN", "SMCI", "PLTR", "ARM", "AVGO",
];

const STORAGE_KEY = "lemons_options_watchlist";
const REFRESH_INTERVAL = 60; // seconds

/* ============================================================================
   Helpers
   ============================================================================ */

function loadWatchlist(): string[] {
  if (typeof window === "undefined") return DEFAULT_TICKERS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_TICKERS;
}

function saveWatchlist(tickers: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickers));
}

/* ============================================================================
   Mock Data
   ============================================================================ */

const TICKER_NAMES: Record<string, string> = {
  TSLA: "Tesla", NVDA: "NVIDIA", AMD: "AMD", AAPL: "Apple",
  MSTR: "MicroStrategy", COIN: "Coinbase", SMCI: "Super Micro",
  PLTR: "Palantir", ARM: "ARM Holdings", AVGO: "Broadcom",
  MSFT: "Microsoft", GOOGL: "Alphabet", META: "Meta",
  AMZN: "Amazon", NFLX: "Netflix", INTC: "Intel",
  QCOM: "Qualcomm", MU: "Micron", SNOW: "Snowflake",
};

function generateDataForTicker(ticker: string): OptionsSnapshot {
  const price = 50 + Math.random() * 1400;
  const iv = 25 + Math.random() * 80;
  const hv = 20 + Math.random() * 55;
  const spread = iv - hv;
  const pcr = 0.3 + Math.random() * 2.5;
  const unusual = spread > 28 || pcr > 1.8;
  return {
    ticker,
    name: TICKER_NAMES[ticker] || ticker,
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
      ? `⚠️ ${ticker} IV 異常：spread=${spread.toFixed(1)}%，PCR=${pcr.toFixed(2)}。${spread > 35 ? "極端擴張，考慮 Long Straddle。" : "顯著偏離，監控財報催化劑。"}`
      : undefined,
    last_updated: new Date().toISOString(),
  };
}

function generateMockData(tickers: string[]): OptionsSnapshot[] {
  return tickers.map(generateDataForTicker);
}

/* ============================================================================
   Sub-Components
   ============================================================================ */

function IVSpreadGauge({ spread }: { spread: number }) {
  const isWarning = spread > 20;
  const isDanger = spread > 35;
  return (
    <div className="relative w-[100px]">
      <div className="h-2 rounded-full bg-[var(--color-surface)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(Math.max((spread + 5) / 50, 0.05), 1) * 100}%`,
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
        {spread > 0 ? "+" : ""}{spread.toFixed(0)}%
      </span>
    </div>
  );
}

function TickerRow({
  data,
  onDelete,
}: {
  data: OptionsSnapshot;
  onDelete: (ticker: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        onClick={(e) => {
          // Don't expand when clicking delete button
          if ((e.target as HTMLElement).closest(".delete-btn")) return;
          setExpanded(!expanded);
        }}
        className={cn(
          "border-b border-[var(--color-border)]/50 cursor-pointer transition-colors group",
          "hover:bg-[var(--color-surface-elevated)]/50",
          data.unusual_activity && "bg-red-500/5"
        )}
      >
        <td className="py-3 pl-3 pr-1 w-8">
          <button
            className="delete-btn p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-400 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(data.ticker);
            }}
            title={`Remove ${data.ticker}`}
          >
            <X size={14} />
          </button>
        </td>
        <td className="py-3 px-2">
          <div className="flex items-center gap-2">
            {data.unusual_activity && (
              <AlertTriangle size={12} className="text-red-400 animate-pulse shrink-0" />
            )}
            <span className="font-semibold text-sm">{data.ticker}</span>
          </div>
        </td>
        <td className="py-3 px-2 text-sm text-[var(--color-text-secondary)] hidden sm:table-cell">
          {data.name}
        </td>
        <td className="py-3 px-2 text-sm font-mono text-right">
          <span className={data.change_pct >= 0 ? "text-emerald-400" : "text-red-400"}>
            ${data.price.toFixed(1)}
          </span>
        </td>
        <td className="py-3 px-2 text-right">
          <span
            className={cn(
              "text-xs font-mono",
              data.change_pct >= 0 ? "text-emerald-400" : "text-red-400"
            )}
          >
            {data.change_pct >= 0 ? "+" : ""}
            {data.change_pct.toFixed(1)}%
          </span>
        </td>
        <td className="py-3 px-2">
          <IVSpreadGauge spread={data.iv_hv_spread ?? 0} />
        </td>
        <td className="py-3 px-2 text-sm font-mono text-center">
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
        <td className="py-3 px-2 text-xs text-[var(--color-text-muted)] hidden lg:table-cell text-right">
          {fmtNum(data.total_volume, 0)}
        </td>
        <td className="py-3 px-2 text-center w-8">
          {expanded ? (
            <ChevronUp size={14} className="text-[var(--color-accent)]" />
          ) : (
            <ChevronDown size={14} className="text-[var(--color-text-muted)]" />
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-[var(--color-surface)]">
          <td colSpan={10} className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="space-y-2">
                <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium">
                  IV / HV Breakdown
                </p>
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-[var(--color-text-muted)] text-[10px]">IV</span>
                    <p className="font-mono text-sm">{data.implied_volatility?.toFixed(1) ?? "N/A"}%</p>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)] text-[10px]">HV(20d)</span>
                    <p className="font-mono text-sm">{data.historical_volatility?.toFixed(1) ?? "N/A"}%</p>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)] text-[10px]">Spread</span>
                    <p
                      className={cn(
                        "font-mono text-sm",
                        (data.iv_hv_spread ?? 0) > 20 ? "text-red-400" : "text-emerald-400"
                      )}
                    >
                      {(data.iv_hv_spread ?? 0) > 0 ? "+" : ""}
                      {data.iv_hv_spread?.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-medium">
                  Options Flow
                </p>
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-[var(--color-text-muted)] text-[10px]">Calls</span>
                    <p className="font-mono text-sm text-emerald-400">{fmtNum(data.call_volume, 0)}</p>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)] text-[10px]">Puts</span>
                    <p className="font-mono text-sm text-red-400">{fmtNum(data.put_volume, 0)}</p>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)] text-[10px]">PCR</span>
                    <p className="font-mono text-sm">{data.put_call_ratio?.toFixed(2)}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={data.unusual_activity ? "danger" : "success"} size="md">
                  {data.unusual_activity ? "⚠ Alert" : "✓ Normal"}
                </Badge>
                {data.last_updated && (
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    Updated {new Date(data.last_updated).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
            {data.ai_alert && (
              <div className="mt-3 p-3 rounded-xl bg-red-500/5 border border-red-500/10 text-xs text-red-400/90 leading-relaxed">
                <span className="font-semibold">🤖 AI Risk Alert:</span> {data.ai_alert}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/* ============================================================================
   Main Page
   ============================================================================ */

export default function OptionsVolatilityPage() {
  const [data, setData] = useState<OptionsSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [searchError, setSearchError] = useState("");
  const [validating, setValidating] = useState(false);

  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [sortMode, setSortMode] = useState<SortMode>("iv_spread");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Init: load watchlist from localStorage ---
  useEffect(() => {
    setWatchlist(loadWatchlist());
  }, []);

  // --- Fetch data when watchlist changes ---
  const fetchData = useCallback(() => {
    setLoading(true);
    const tickers = loadWatchlist();
    // In production: POST /api/options with body { tickers }
    setTimeout(() => {
      setData(generateMockData(tickers));
      setLoading(false);
      setCountdown(REFRESH_INTERVAL);
    }, 400);
  }, []);

  useEffect(() => {
    if (watchlist.length > 0) {
      fetchData();
    }
  }, [watchlist, fetchData]);

  // --- Auto-refresh countdown ---
  useEffect(() => {
    if (!autoRefresh) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchData();
          return REFRESH_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefresh, fetchData]);

  // --- Add ticker ---
  const addTicker = (ticker: string) => {
    const upper = ticker.toUpperCase().trim();
    if (!upper || watchlist.includes(upper)) {
      setSearchError(watchlist.includes(upper) ? "Already in watchlist" : "");
      return;
    }
    const updated = [...watchlist, upper];
    setWatchlist(updated);
    saveWatchlist(updated);
    setSearchInput("");
    setSearchResult(null);
    setSearchError("");
  };

  // --- Delete ticker ---
  const deleteTicker = (ticker: string) => {
    const updated = watchlist.filter((t) => t !== ticker);
    setWatchlist(updated);
    saveWatchlist(updated);
  };

  // --- Search / validate ticker ---
  const validateTicker = async (input: string) => {
    const upper = input.toUpperCase().trim();
    if (!upper) {
      setSearchResult(null);
      setSearchError("");
      return;
    }
    setSearchInput(upper);
    setValidating(true);
    setSearchError("");

    // Check against known tickers (production: call yfinance API)
    await new Promise((r) => setTimeout(r, 300));
    const knownTickers = Object.keys(TICKER_NAMES);
    if (knownTickers.includes(upper) || /^[A-Z]{1,5}$/.test(upper)) {
      setSearchResult(upper);
      setSearchError("");
    } else {
      setSearchResult(null);
      setSearchError("Invalid ticker format");
    }
    setValidating(false);
  };

  // --- Reset watchlist ---
  const resetWatchlist = () => {
    setWatchlist(DEFAULT_TICKERS);
    saveWatchlist(DEFAULT_TICKERS);
  };

  // --- Filter & Sort ---
  const filtered = useMemo(() => {
    let result = [...data];
    if (filterMode === "alerts") result = result.filter((d) => d.unusual_activity);
    if (filterMode === "high_iv") result = result.filter((d) => (d.implied_volatility ?? 0) > 50);
    if (filterMode === "high_pcr") result = result.filter((d) => (d.put_call_ratio ?? 0) > 1.3);
    result.sort((a, b) => {
      switch (sortMode) {
        case "iv_spread": return (b.iv_hv_spread ?? 0) - (a.iv_hv_spread ?? 0);
        case "pcr": return (b.put_call_ratio ?? 0) - (a.put_call_ratio ?? 0);
        case "volume": return b.total_volume - a.total_volume;
        case "ticker": return a.ticker.localeCompare(b.ticker);
        default: return 0;
      }
    });
    return result;
  }, [data, filterMode, sortMode]);

  // --- CSV Export ---
  const exportCSV = () => {
    const headers = ["Ticker", "Name", "Price", "Chg%", "IV%", "HV%", "Spread", "PCR", "Call Vol", "Put Vol", "Alert"];
    const rows = filtered.map((d) => [
      d.ticker, d.name, d.price, d.change_pct,
      d.implied_volatility ?? "", d.historical_volatility ?? "",
      d.iv_hv_spread ?? "", d.put_call_ratio ?? "",
      d.call_volume, d.put_volume, d.unusual_activity ? "YES" : "NO",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `options_volatility_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const unusualCount = data.filter((d) => d.unusual_activity).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-[slideIn_0.4s_ease-out]">
      {/* ================================================================
          Header
          ================================================================ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Options & Volatility Monitor</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Track IV/HV spreads, Put/Call ratios, and unusual options activity.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
          <Button variant="ghost" size="sm" onClick={exportCSV}>
            <Download size={14} />
            CSV
          </Button>
        </div>
      </div>

      {/* ================================================================
          Search / Add Ticker Bar
          ================================================================ */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => validateTicker(e.target.value)}
              placeholder="Add ticker... (e.g. MSFT, GOOGL, META)"
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchResult) addTicker(searchResult);
              }}
            />
            {validating && (
              <RefreshCw size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--color-text-muted)]" />
            )}
            {searchResult && !validating && (
              <CheckCircle2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400" />
            )}
          </div>
          <Button
            onClick={() => searchResult && addTicker(searchResult)}
            disabled={!searchResult || watchlist.includes(searchResult)}
            size="md"
          >
            <Plus size={14} />
            Add {searchResult || ""}
          </Button>
          {watchlist.length > DEFAULT_TICKERS.length && (
            <Button variant="ghost" size="sm" onClick={resetWatchlist} title="Reset to default watchlist">
              Reset
            </Button>
          )}
        </div>
        {searchError && (
          <p className="text-xs text-red-400 mt-2 ml-1">{searchError}</p>
        )}
        {searchResult && TICKER_NAMES[searchResult] && (
          <p className="text-xs text-[var(--color-text-muted)] mt-2 ml-1">
            <span className="text-emerald-400">✓</span> {TICKER_NAMES[searchResult]} — Press Enter or click Add
          </p>
        )}
        {/* Current watchlist chips */}
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          {watchlist.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-lg bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] group/chip"
            >
              {t}
              <button
                onClick={() => deleteTicker(t)}
                className="opacity-0 group-hover/chip:opacity-100 hover:text-red-400 transition-all"
              >
                <X size={10} />
              </button>
            </span>
          ))}
          <span className="text-[10px] text-[var(--color-text-muted)] ml-1">
            {watchlist.length} ticker{watchlist.length > 1 ? "s" : ""}
          </span>
        </div>
      </Card>

      {/* ================================================================
          Summary Cards
          ================================================================ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "IV/HV Expansion",
            value: `${unusualCount} tickers`,
            sub: "Spread > 28% or PCR > 1.8",
            icon: Activity,
            color: "text-red-400",
            bg: "bg-red-500/10",
          },
          {
            label: "Avg Put/Call Ratio",
            value:
              data.length > 0
                ? (
                    data.reduce((s, d) => s + (d.put_call_ratio ?? 0), 0) / data.length
                  ).toFixed(2)
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
            label: "Auto Refresh",
            value: autoRefresh ? `${countdown}s` : "OFF",
            sub: autoRefresh ? "Next update" : "Click Refresh to update",
            icon: Timer,
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

      {/* ================================================================
          Filters + Sort
          ================================================================ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-[var(--color-text-muted)]" />
          {([
            { key: "all", label: "All" },
            { key: "alerts", label: `⚠ Alerts${unusualCount > 0 ? ` (${unusualCount})` : ""}` },
            { key: "high_iv", label: "High IV >50%" },
            { key: "high_pcr", label: "High PCR >1.3" },
          ] as { key: FilterMode; label: string }[]).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterMode(f.key)}
              className={cn(
                "px-3 py-1.5 text-xs rounded-lg transition-all",
                filterMode === f.key
                  ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--color-text-muted)]">Sort:</span>
          {([
            { key: "iv_spread", label: "IV Spread" },
            { key: "pcr", label: "P/C Ratio" },
            { key: "volume", label: "Volume" },
            { key: "ticker", label: "Ticker" },
          ] as { key: SortMode; label: string }[]).map((s) => (
            <button
              key={s.key}
              onClick={() => setSortMode(s.key)}
              className={cn(
                "px-2.5 py-1.5 text-xs rounded-lg transition-all",
                sortMode === s.key
                  ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              )}
            >
              {s.label}
            </button>
          ))}
          <span className="text-[10px] text-[var(--color-text-muted)] ml-2">
            {filtered.length} of {data.length}
          </span>
        </div>
      </div>

      {/* ================================================================
          Main Table
          ================================================================ */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                {[
                  "", "Ticker", "Name", "Price", "Chg%", "IV Spread", "P/C Ratio", "Volume", "",
                ].map((h, i) => (
                  <th
                    key={h + i}
                    className={cn(
                      "py-3 px-2 text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider",
                      h === "" && i === 0 && "pl-3 w-8",
                      h === "" && i === 8 && "w-8",
                      h === "Name" && "hidden sm:table-cell text-left",
                      h === "Volume" && "hidden lg:table-cell text-right",
                      (h === "Price" || h === "Chg%") && "text-right",
                      h === "P/C Ratio" && "text-center",
                      h === "Ticker" && "pl-2 text-left"
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && !loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[var(--color-text-muted)]">
                    <p className="text-sm">No tickers match the current filter.</p>
                    <button
                      onClick={() => setFilterMode("all")}
                      className="text-xs text-[var(--color-accent)] hover:underline mt-1"
                    >
                      Clear filter
                    </button>
                  </td>
                </tr>
              ) : (
                filtered.map((d) => (
                  <TickerRow key={d.ticker} data={d} onDelete={deleteTicker} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ================================================================
          Strategy Guide + Auto-Refresh Toggle
          ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Info size={16} className="text-[var(--color-accent)]" />
              <CardTitle>AI Volatility Strategy Guide</CardTitle>
            </div>
          </CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                title: "📈 IV Contraction",
                sub: "IV < HV",
                desc: "Market pricing in lower future vol than realized. Consider Short Straddle or Iron Condor to capture vol mean-reversion.",
                color: "border-emerald-500/20 bg-emerald-500/5",
                textColor: "text-emerald-400",
              },
              {
                title: "⚖️ Fair Value",
                sub: "IV ≈ HV",
                desc: "Options fairly priced. Directional plays recommended: Call/Put Spreads based on PCR skew and technical analysis.",
                color: "border-amber-500/20 bg-amber-500/5",
                textColor: "text-amber-400",
              },
              {
                title: "📉 IV Expansion",
                sub: "IV > HV",
                desc: "Elevated fear premium. Consider Long Straddle pre-earnings, or Calendar Spread to exploit term structure.",
                color: "border-red-500/20 bg-red-500/5",
                textColor: "text-red-400",
              },
            ].map((item) => (
              <div key={item.title} className={cn("p-3 rounded-xl border text-xs", item.color)}>
                <p className={cn("font-semibold mb-1", item.textColor)}>{item.title}</p>
                <p className="text-[10px] text-[var(--color-text-muted)] mb-2">{item.sub}</p>
                <p className="text-[var(--color-text-secondary)] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium">Auto Refresh</p>
                <p className="text-xs text-[var(--color-text-muted)]">Every {REFRESH_INTERVAL}s</p>
              </div>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={cn(
                  "relative w-10 h-6 rounded-full transition-colors",
                  autoRefresh ? "bg-[var(--color-accent)]" : "bg-[var(--color-surface-elevated)] border border-[var(--color-border)]"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform",
                    autoRefresh ? "left-[18px]" : "left-[2px]"
                  )}
                />
              </button>
            </label>

            <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-xs space-y-2">
              <p className="text-[var(--color-text-muted)]">Keyboard Shortcuts</p>
              <div className="flex justify-between text-[var(--color-text-secondary)]">
                <span>Focus search</span>
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-elevated)] text-[10px] border border-[var(--color-border)]">/</kbd>
              </div>
              <div className="flex justify-between text-[var(--color-text-secondary)]">
                <span>Manual refresh</span>
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-elevated)] text-[10px] border border-[var(--color-border)]">R</kbd>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
