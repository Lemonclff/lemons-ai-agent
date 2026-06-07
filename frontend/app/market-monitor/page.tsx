"use client";

import {
 useState, useEffect, useRef, useCallback } from "react";
import {
  ShieldAlert,
  Loader2, ArrowUp, ArrowDown, Landmark, DollarSign, Percent, Home,
  TrendingUp, Download, FileText, Image, FileSpreadsheet,
  Building2, RefreshCw,
  Brain,
  Cpu,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import {
 cn } from "@/lib/utils";

/* ================================================================
   Types
   ================================================================ */
interface FredItem {
  id: string; label: string; category: string;
  value: number | null; prev_close: number | null; change: number | null; date: string;
}

interface InflationData {
  latest: { date: string; yoy_rate: number | null; cpi_level: number };
  monthly: { month: string; rate: number }[];
  mom: { month: string; change: number }[];
  yearly: { year: number; value: number }[];
  historical: { year: number; value: number }[];
}

interface MortgageHistoryPoint {
  date: string;
  value: number;
}

/* ================================================================
   Page tabs
   ================================================================ */
const PAGE_TABS = [
  { key: "overview", label: "Overview" },
  { key: "treasury", label: "Treasury Yields" },
  { key: "mortgage", label: "Mortgage Rates" },
  { key: "bonds", label: "Bond Rates" },
  { key: "inflation", label: "US Inflation" },
];

/* ================================================================
   Format helpers
   ================================================================ */
function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

/* ================================================================
   Shared: Change badge
   ================================================================ */
function Chg({ value, unit }: { value: number | null; unit?: "bp" | "%" }) {
  if (value === null) return <span className="text-[var(--color-text-muted)]">--</span>;
  const up = value >= 0;
  const display = unit === "bp" ? `${(value * 100).toFixed(1)} bp` : `${up ? "+" : ""}${value.toFixed(2)}%`;
  return (
    <span className={cn("inline-flex items-center gap-[2px] tabular-nums font-mono text-[12px]", up ? "text-[#22c55e]" : "text-[#ef4444]")}>
      {up ? <ArrowUp size={10} /> : <ArrowDown size={10} />}{display}
    </span>
  );
}

/* ================================================================
   Shared: Data table (Product | Rate | Prev Close | Change)
   ================================================================ */
function DataTable({ title, icon, rows, source, changeUnit }: {
  title: string; icon: React.ReactNode; rows: FredItem[]; source?: string; changeUnit?: "bp" | "%";
}) {
  if (rows.length === 0) return null;
  return (
    <>
      <div className="flex items-center gap-2 mb-3 mt-3">
        <span className="text-[var(--color-text-muted)]">{icon}</span>
        <h2 className="text-[13px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">{title}</h2>
        <span className="text-[10px] text-[var(--color-text-muted)] ml-auto">{rows[0]?.date ?? ""}</span>
      </div>
      <div className="border border-[var(--color-border)] rounded overflow-hidden mb-5">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] leading-none">
            <thead>
              <tr className="border-b-2 border-[var(--color-border)] bg-[var(--color-surface-elevated)]/20">
                <th className="text-left py-[7px] px-3 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Product</th>
                <th className="text-right py-[7px] px-3 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Rate</th>
                <th className="text-right py-[7px] px-3 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Prev Close</th>
                <th className="text-right py-[7px] px-3 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={cn("border-b border-[var(--color-border)]/15 transition-colors hover:bg-[var(--color-surface-elevated)]/20", i % 2 === 0 ? "bg-[var(--color-surface)]/5" : "bg-transparent")}>
                  <td className="text-left py-[5px] px-3 font-medium text-[12px]">{r.label}</td>
                  <td className="text-right py-[5px] px-3 tabular-nums font-mono text-[13px] font-semibold">{r.value !== null ? `${r.value.toFixed(2)}%` : "--"}</td>
                  <td className="text-right py-[5px] px-3 tabular-nums font-mono text-[12px] text-[var(--color-text-muted)]">{r.prev_close !== null ? `${r.prev_close.toFixed(2)}%` : "--"}</td>
                  <td className="text-right py-[5px] px-3"><Chg value={r.change} unit={changeUnit} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {source && <div className="px-3 py-1.5 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)]">{source}</div>}
      </div>
    </>
  );
}

/* ================================================================
   Mortgage Rates: simplified table (Type | Rate | Change)
   ================================================================ */
function MortgageTable({ title, icon, rows, source }: {
  title: string; icon: React.ReactNode; rows: FredItem[]; source?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <>
      <div className="flex items-center gap-2 mb-3 mt-3">
        <span className="text-[var(--color-text-muted)]">{icon}</span>
        <h2 className="text-[13px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">{title}</h2>
        <span className="text-[10px] text-[var(--color-text-muted)] ml-auto">{rows[0]?.date ?? ""}</span>
      </div>
      <div className="border border-[var(--color-border)] rounded overflow-hidden mb-5">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] leading-none">
            <thead>
              <tr className="border-b-2 border-[var(--color-border)] bg-[var(--color-surface-elevated)]/20">
                <th className="text-left py-[7px] px-3 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Mortgage Type</th>
                <th className="text-right py-[7px] px-3 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Rate</th>
                <th className="text-right py-[7px] px-3 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={cn("border-b border-[var(--color-border)]/15 transition-colors hover:bg-[var(--color-surface-elevated)]/20", i % 2 === 0 ? "bg-[var(--color-surface)]/5" : "bg-transparent")}>
                  <td className="text-left py-[5px] px-3 font-medium text-[12px]">{r.label}</td>
                  <td className="text-right py-[5px] px-3 tabular-nums font-mono text-[13px] font-semibold">{r.value !== null ? `${r.value.toFixed(2)}%` : "--"}</td>
                  <td className="text-right py-[5px] px-3"><Chg value={r.change} unit="%" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {source && <div className="px-3 py-1.5 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)]">{source}</div>}
      </div>
    </>
  );
}

/* ================================================================
   Bond Rates: simplified table (Bond | Yield % | Change)
   ================================================================ */
function BondRatesTable({ title, icon, rows, source }: {
  title: string; icon: React.ReactNode; rows: FredItem[]; source?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <>
      <div className="flex items-center gap-2 mb-3 mt-3">
        <span className="text-[var(--color-text-muted)]">{icon}</span>
        <h2 className="text-[13px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">{title}</h2>
        <span className="text-[10px] text-[var(--color-text-muted)] ml-auto">{rows[0]?.date ?? ""}</span>
      </div>
      <div className="border border-[var(--color-border)] rounded overflow-hidden mb-5">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] leading-none">
            <thead>
              <tr className="border-b-2 border-[var(--color-border)] bg-[var(--color-surface-elevated)]/20">
                <th className="text-left py-[7px] px-3 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Bond</th>
                <th className="text-right py-[7px] px-3 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Yield %</th>
                <th className="text-right py-[7px] px-3 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={cn("border-b border-[var(--color-border)]/15 transition-colors hover:bg-[var(--color-surface-elevated)]/20", i % 2 === 0 ? "bg-[var(--color-surface)]/5" : "bg-transparent")}>
                  <td className="text-left py-[5px] px-3 font-medium text-[12px]">{r.label}</td>
                  <td className="text-right py-[5px] px-3 tabular-nums font-mono text-[13px] font-semibold">{r.value !== null ? `${r.value.toFixed(3)}` : "--"}</td>
                  <td className="text-right py-[5px] px-3"><Chg value={r.change} unit="%" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {source && <div className="px-3 py-1.5 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)]">{source}</div>}
      </div>
    </>
  );
}

/* ================================================================
   Download helpers
   ================================================================ */
function useChartDownload(ref: React.RefObject<HTMLDivElement | null>, filename: string) {
  const downloadSVG = useCallback(() => {
    const svg = ref.current?.querySelector("svg");
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const data = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([`<?xml version="1.0"?>\n${data}`], { type: "image/svg+xml" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${filename}.svg`; a.click();
  }, [ref, filename]);

  const downloadPNG = useCallback(() => {
    const svg = ref.current?.querySelector("svg");
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const data = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    const svgBlob = new Blob([data], { type: "image/svg+xml;charset=utf-8" });
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = svg.clientWidth * 2;
      canvas.height = svg.clientHeight * 2;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(2, 2);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--color-surface").trim() || "#0a0a0f";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((b) => {
        if (!b) return;
        const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `${filename}.png`; a.click();
      });
    };
    img.src = URL.createObjectURL(svgBlob);
  }, [ref, filename]);

  const downloadCSV = useCallback((rows: Record<string, unknown>[], cols: string[]) => {
    const header = cols.join(",");
    const body = rows.map((r) => cols.map((c) => {
      const v = r[c];
      return v === null || v === undefined ? "" : String(v).includes(",") ? `"${v}"` : String(v);
    }).join(","));
    const csv = [header, ...body].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${filename}.csv`; a.click();
  }, [filename]);

  return { downloadSVG, downloadPNG, downloadCSV };
}

/* ================================================================
   Chart section wrapper with download buttons
   ================================================================ */
function ChartSection({
  title, chartRef, download, csvData, csvCols, csvFilename, children,
}: {
  title: string;
  chartRef: React.RefObject<HTMLDivElement | null>;
  download: ReturnType<typeof useChartDownload>;
  csvData?: Record<string, unknown>[];
  csvCols?: string[];
  csvFilename?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-[var(--color-border)] rounded overflow-hidden mb-5">
      <div className="px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]/20 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">{title}</h3>
        <div className="flex items-center gap-1">
          <button onClick={download.downloadSVG} className="p-1 rounded hover:bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors" title="Download SVG"><Image size={13} /></button>
          <button onClick={download.downloadPNG} className="p-1 rounded hover:bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors" title="Download PNG"><Download size={13} /></button>
          {csvData && csvCols && (
            <button onClick={() => download.downloadCSV(csvData, csvCols)} className="p-1 rounded hover:bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors" title="Download CSV"><FileSpreadsheet size={13} /></button>
          )}
        </div>
      </div>
      <div ref={chartRef} className="px-2 py-3">
        {children}
      </div>
    </div>
  );
}

/* ================================================================
   Page
   ================================================================ */
export default function MarketMonitorPage() {
  const [activeTab, setActiveTab] = useState("overview");

  // FRED main
  const [treasury, setTreasury] = useState<FredItem[]>([]);
  const [mortgage, setMortgage] = useState<FredItem[]>([]);
  const [bonds, setBonds] = useState<FredItem[]>([]);
  const [others, setOthers] = useState<FredItem[]>([]);
  const [fredLoading, setFredLoading] = useState(true);
  const [fredError, setFredError] = useState("");

  // Inflation
  const [inflation, setInflation] = useState<InflationData | null>(null);
  const [infLoading, setInfLoading] = useState(false);
  const [infError, setInfError] = useState("");

  // Mortgage history
  const [mortgageHistory, setMortgageHistory] = useState<MortgageHistoryPoint[]>([]);
  const [mhLoading, setMhLoading] = useState(false);

  // Macro risk
  const [macroRisk, setMacroRisk] = useState<any>(null);
  const [mrLoading, setMrLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProvider, setAiProvider] = useState<string>("nvidia");

  // Refresh
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Chart refs
  const chartAnnualRef = useRef<HTMLDivElement>(null);
  const chartMomRef = useRef<HTMLDivElement>(null);
  const chartYearlyRef = useRef<HTMLDivElement>(null);
  const chartMortgageRef = useRef<HTMLDivElement>(null);
  const downloadAnnual = useChartDownload(chartAnnualRef, "us-inflation-annual-by-month");
  const downloadMom = useChartDownload(chartMomRef, "us-inflation-month-to-month");
  const downloadYearly = useChartDownload(chartYearlyRef, "us-inflation-by-year");
  const downloadMortgage = useChartDownload(chartMortgageRef, "us-30yr-mortgage-history");

  // Shared fetch function (reusable for initial load + refresh)
  const fetchFred = useCallback(() => {
    setFredLoading(true);
    setFredError("");
    return fetch("/api/fred")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) { setFredError(json.error); return; }
        setTreasury(json.treasury || []);
        setMortgage(json.mortgage || []);
        setBonds(json.bonds || []);
        setOthers(json.others || []);
      })
      .catch((e) => setFredError(String(e)))
      .finally(() => setFredLoading(false));
  }, []);

  const fetchInflation = useCallback(() => {
    setInfLoading(true);
    setInfError("");
    return fetch("/api/fred/inflation")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) { setInfError(json.error); return; }
        setInflation(json as InflationData);
      })
      .catch((e) => setInfError(String(e)))
      .finally(() => setInfLoading(false));
  }, []);

  const fetchMacroRisk = useCallback(() => {
    setMrLoading(true);
    return fetch('/api/macro-risk')
      .then(r => r.json())
      .then(json => { if (!json.error) setMacroRisk(json); })
      .catch(() => {})
      .finally(() => setMrLoading(false));
  }, []);

  const fetchMacroRiskAI = useCallback(async () => {
    setAiLoading(true);
    try {
      const r = await fetch(`/api/macro-risk?ai=true&provider=${aiProvider}`);
      const json = await r.json();
      if (!json.error) {
        setMacroRisk((prev: any) => ({ ...prev, ai_analysis: json.ai_analysis }));
      }
    } catch {}
    finally { setAiLoading(false); }
  }, [aiProvider]);

  const fetchMortgageHistory = useCallback(() => {
    setMhLoading(true);
    return fetch("/api/fred/mortgage-history")
      .then((r) => r.json())
      .then((json) => { if (!json.error) setMortgageHistory(json.data || []); })
      .catch(() => {})
      .finally(() => setMhLoading(false));
  }, []);

  // Refresh all data
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchFred(), fetchInflation(), fetchMortgageHistory(), fetchMacroRisk()]);
    setLastUpdated(new Date().toISOString());
    setRefreshing(false);
  }, [fetchFred, fetchInflation, fetchMortgageHistory, fetchMacroRisk]);

  // Initial load
  useEffect(() => {
    fetchMacroRisk();
    fetchFred().then(() => setLastUpdated(new Date().toISOString()));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load inflation on mount + refresh
  useEffect(() => { fetchInflation(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Macro risk: load on overview
  useEffect(() => {
    if (activeTab === 'overview' && !macroRisk && !mrLoading) fetchMacroRisk();
  }, [activeTab, macroRisk, mrLoading, fetchMacroRisk]);

  // Lazy load mortgage history when tab selected
  useEffect(() => {
    if (activeTab !== "mortgage" || mortgageHistory.length > 0) return;
    fetchMortgageHistory();
  }, [activeTab, mortgageHistory.length, fetchMortgageHistory]);

  const OTHER_ICONS: Record<string, React.ReactNode> = {
    inflation: <DollarSign size={12} />,
    bonds: <Percent size={12} />,
  };

  const corporateBonds = bonds.filter((r) => r.id === "AAA" || r.id === "BAA" || r.id === "BAA-AAA");

  return (
    <div className="w-full max-w-[1100px] mx-auto px-4 pb-10">
      {/* Title + tabs + refresh */}
      <div className="flex items-center justify-between flex-wrap gap-3 mt-4 mb-1">
        <div>
          <h1 className="text-[20px] font-bold text-[var(--color-text-primary)] tracking-tight">US Market Monitor</h1>
          <p className="text-[11px] text-[var(--color-text-muted)]">Treasury &middot; Mortgage &middot; Bonds &middot; Inflation &middot; Credit</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--color-surface-elevated)]/50">
            {PAGE_TABS.map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={cn("px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors whitespace-nowrap", activeTab === tab.key ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]")}>{tab.label}</button>
            ))}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing || fredLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] rounded-md transition-colors border border-[var(--color-border)] disabled:opacity-50"
            title="Refresh all data"
          >
            <RefreshCw size={13} className={cn(refreshing && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Last updated indicator */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] text-[var(--color-text-muted)]">
          Updated: {lastUpdated ? formatTime(lastUpdated) : "--"}
        </span>
        {refreshing && (
          <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-accent)]">
            <Loader2 size={10} className="animate-spin" />
            refreshing...
          </span>
        )}
      </div>

      {/* Loading / Error */}
      {fredLoading && activeTab !== "inflation" && (
        <div className="flex items-center justify-center py-10"><Loader2 size={20} className="animate-spin text-[var(--color-text-muted)]" /></div>
      )}
      {fredError && <p className="text-[12px] text-red-400 py-4">{fredError}</p>}

      {/* OVERVIEW */}
      {!fredLoading && !fredError && activeTab === "overview" && (
        <>

          {/* Macro Risk Assessment */}
          {macroRisk && !mrLoading && (
            <div className={cn(
              "mb-4 p-4 rounded border-2",
              macroRisk.built_in.risk_level === "RED" ? "border-[#ef4444] bg-[#ef4444]/5" :
              macroRisk.built_in.risk_level === "ORANGE" ? "border-[#f59e0b] bg-[#f59e0b]/5" :
              macroRisk.built_in.risk_level === "YELLOW" ? "border-[#eab308] bg-[#eab308]/5" :
              "border-[#22c55e] bg-[#22c55e]/5"
            )}>
              <div className="flex items-center gap-3 mb-2">
                <ShieldAlert size={18} className={cn(
                  macroRisk.built_in.risk_level === "RED" ? "text-[#ef4444]" :
                  macroRisk.built_in.risk_level === "ORANGE" ? "text-[#f59e0b]" :
                  macroRisk.built_in.risk_level === "YELLOW" ? "text-[#eab308]" :
                  "text-[#22c55e]"
                )} />
                <span className="text-[14px] font-bold text-[var(--color-text-primary)]">Macro Risk Assessment</span>
                <span className={cn(
                  "px-2 py-0.5 rounded text-[11px] font-bold",
                  macroRisk.built_in.risk_level === "RED" ? "bg-[#ef4444]/20 text-[#ef4444]" :
                  macroRisk.built_in.risk_level === "ORANGE" ? "bg-[#f59e0b]/20 text-[#f59e0b]" :
                  macroRisk.built_in.risk_level === "YELLOW" ? "bg-[#eab308]/20 text-[#eab308]" :
                  "bg-[#22c55e]/20 text-[#22c55e]"
                )}>{macroRisk.built_in.risk_level} ({macroRisk.built_in.score}/100)</span>
                <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] uppercase tracking-wider border border-[var(--color-border)]">Built-in Engine</span>
              </div>

              {/* AI controls */}
              {!macroRisk.ai_analysis ? (
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-[var(--color-border)]/30">
                  <Cpu size={12} className="text-[var(--color-text-muted)]" />
                  <select
                    value={aiProvider}
                    onChange={(e) => setAiProvider(e.target.value)}
                    className="text-[11px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded px-2 py-1 text-[var(--color-text-secondary)] outline-none"
                  >
                    <option value="nvidia">NVIDIA NIM (DeepSeek-V4)</option>
                    <option value="deepseek">DeepSeek (deepseek-chat)</option>
                    <option value="openrouter">OpenRouter (GPT-4o)</option>
                    <option value="openai">OpenAI (GPT-4o)</option>
                  </select>
                  <button
                    onClick={fetchMacroRiskAI}
                    disabled={aiLoading}
                    className="flex items-center gap-1 px-3 py-1 text-[11px] font-medium rounded bg-[var(--color-accent)]/15 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25 transition-colors disabled:opacity-50"
                  >
                    {aiLoading ? <Loader2 size={11} className="animate-spin" /> : <Brain size={11} />}
                    {aiLoading ? "Analyzing..." : "Run AI Analysis"}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-[var(--color-accent)]/20">
                  <Brain size={12} className="text-[var(--color-accent)]" />
                  <span className="text-[10px] text-[var(--color-accent)] uppercase tracking-wider font-semibold">AI Analysis</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[var(--color-accent)]/15 text-[var(--color-accent)] uppercase tracking-wider">
                    {macroRisk.ai_analysis._provider || "LLM"}
                  </span>
                  <button
                    onClick={() => setMacroRisk((prev: any) => ({ ...prev, ai_analysis: null }))}
                    className="ml-auto text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}
              <p className="text-[12px] text-[var(--color-text-secondary)] mb-2 font-medium">{macroRisk.built_in.risk_label}</p>
              <p className="text-[11px] text-[var(--color-text-muted)] mb-2">{macroRisk.built_in.data_summary}</p>
              <p className="text-[11px] text-[var(--color-text-muted)] mb-2 leading-relaxed">{macroRisk.built_in.scenario}</p>
              <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">Action:</span>
                <p className="text-[12px] text-[var(--color-text-primary)] mt-1 font-medium">{macroRisk.built_in.action}</p>
              </div>

              {/* AI result */}
              {macroRisk.ai_analysis && (
                <div className="mt-3 pt-3 border-t border-[var(--color-accent)]/20 bg-[var(--color-accent)]/[0.02] -mx-4 -mb-4 px-4 pb-4 rounded-b">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">Market Regime</span>
                    <span className="text-[12px] text-[var(--color-text-primary)] font-semibold">{macroRisk.ai_analysis.market_regime}</span>
                  </div>
                  <p className="text-[11px] text-[var(--color-text-secondary)] mb-2 leading-relaxed">{macroRisk.ai_analysis.actionable_insight}</p>
                  {macroRisk.ai_analysis.key_warning && (
                    <div className="mt-2 p-2 rounded border border-[#ef4444]/30 bg-[#ef4444]/5">
                      <span className="text-[10px] text-[#ef4444] uppercase tracking-wider font-semibold">⚠ Warning</span>
                      <p className="text-[11px] text-[#ef4444] mt-1">{macroRisk.ai_analysis.key_warning}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <DataTable title="US Treasury Yields" icon={<Landmark size={15} />} rows={treasury} source="Source: US Treasury" changeUnit="bp" />
          <DataTable title="Mortgage Rates" icon={<Home size={15} />} rows={mortgage} source="Source: Freddie Mac PMMS via FRED" changeUnit="%" />
          <DataTable title="US Corporate Bond Yields" icon={<Building2 size={15} />} rows={bonds} source="Source: Moody's via FRED" changeUnit="%" />

          {/* US Inflation Summary */}
          {inflation && (
            <div className="mt-0 mb-4 p-3 rounded border border-[var(--color-border)] bg-[var(--color-surface)]/30">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider">US Inflation</span>
                <span className="text-[22px] font-bold tabular-nums">{inflation.latest.yoy_rate !== null ? `${inflation.latest.yoy_rate.toFixed(2)}%` : "--"}</span>
                <span className="text-[11px] text-[var(--color-text-muted)]">As of {inflation.latest.date}</span>
                <span className="text-[10px] text-[var(--color-text-muted)]">CPI-U: {inflation.latest.cpi_level.toFixed(1)}</span>
              </div>
            </div>
          )}


          {others.length > 0 && (
            <div className="flex items-center gap-5 flex-wrap mb-5 py-2 px-3 rounded border border-[var(--color-border)]">
              {others.map((ind) => (
                <div key={ind.id} className="flex items-center gap-2">
                  <span className="text-[var(--color-text-muted)]">{OTHER_ICONS[ind.category]}</span>
                  <span className="text-[11px] text-[var(--color-text-muted)] whitespace-nowrap">{ind.label}</span>
                  <span className="text-[13px] font-bold tabular-nums">{ind.value !== null ? `${ind.value.toFixed(2)}%` : "--"}</span>
                  <Chg value={ind.change} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TREASURY */}
      {!fredLoading && !fredError && activeTab === "treasury" && (
        <>
          <DataTable title="US Treasury Yields" icon={<Landmark size={15} />} rows={treasury} source="Source: US Treasury" changeUnit="bp" />
          {others.length > 0 && (
            <div className="border border-[var(--color-border)] rounded overflow-hidden mb-5">
              <div className="px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]/20"><h3 className="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Other Indicators</h3></div>
              <div className="overflow-x-auto"><table className="w-full text-[12px] leading-none"><thead><tr className="border-b border-[var(--color-border)]/30"><th className="text-left py-[6px] px-3 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Indicator</th><th className="text-right py-[6px] px-3 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Value</th><th className="text-right py-[6px] px-3 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Prev</th><th className="text-right py-[6px] px-3 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Change</th></tr></thead><tbody>{others.map((ind, i) => (<tr key={ind.id} className={cn("border-b border-[var(--color-border)]/15 transition-colors hover:bg-[var(--color-surface-elevated)]/20", i % 2 === 0 ? "bg-[var(--color-surface)]/5" : "bg-transparent")}><td className="text-left py-[5px] px-3 font-medium text-[12px]">{ind.label}</td><td className="text-right py-[5px] px-3 tabular-nums font-mono text-[13px] font-semibold">{ind.value !== null ? `${ind.value.toFixed(2)}%` : "--"}</td><td className="text-right py-[5px] px-3 tabular-nums font-mono text-[12px] text-[var(--color-text-muted)]">{ind.prev_close !== null ? `${ind.prev_close.toFixed(2)}%` : "--"}</td><td className="text-right py-[5px] px-3"><Chg value={ind.change} /></td></tr>))}</tbody></table></div>
            </div>
          )}
        </>
      )}

      {/* MORTGAGE */}
      {!fredLoading && !fredError && activeTab === "mortgage" && (
        <>
          <MortgageTable title="Current Mortgage Rates" icon={<Home size={15} />} rows={mortgage} source="Source: Freddie Mac PMMS via FRED (weekly survey)" />

          {mhLoading && (
            <div className="flex items-center justify-center py-6"><Loader2 size={16} className="animate-spin text-[var(--color-text-muted)]" /></div>
          )}
          {!mhLoading && mortgageHistory.length > 0 && (
            <ChartSection title="30-Year Fixed Mortgage Rate — 5-Year History" chartRef={chartMortgageRef} download={downloadMortgage} csvData={mortgageHistory as unknown as Record<string,unknown>[]} csvCols={["date","value"]}>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={mortgageHistory} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} interval={Math.floor(mortgageHistory.length / 8)} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} tickFormatter={(v: number) => `${v}%`} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v.toFixed(2)}%`, "30Y Fixed"]} labelFormatter={(l: string) => `Date: ${l}`} />
                  <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartSection>
          )}
        </>
      )}

      {/* BOND RATES */}
      {!fredLoading && !fredError && activeTab === "bonds" && (
        <>
          <BondRatesTable title="US Treasury Bonds" icon={<Landmark size={15} />} rows={treasury} source="Source: US Treasury" />
          {corporateBonds.length > 0 && (
            <BondRatesTable title="US Corporate Bonds" icon={<Building2 size={15} />} rows={corporateBonds} source="Source: Moody's via FRED" />
          )}
        </>
      )}

      {/* US INFLATION */}
      {activeTab === "inflation" && (
        <>
          {infLoading && (<div className="flex items-center justify-center py-10"><Loader2 size={20} className="animate-spin text-[var(--color-text-muted)]" /></div>)}
          {infError && <p className="text-[12px] text-red-400 py-4">{infError}</p>}
          {!infLoading && !infError && inflation && (
            <>
              <div className="mt-3 mb-4 p-3 rounded border border-[var(--color-border)] bg-[var(--color-surface)]/30">
                <div className="flex items-baseline gap-3">
                  <span className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider">US Inflation Rate</span>
                  <span className="text-[28px] font-bold tabular-nums">
                    {inflation.latest.yoy_rate !== null ? `${inflation.latest.yoy_rate.toFixed(2)}%` : "--"}
                  </span>
                  <span className="text-[12px] text-[var(--color-text-muted)]">As of {inflation.latest.date}</span>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Consumer Price Index (CPI-U): {inflation.latest.cpi_level.toFixed(1)}</p>
              </div>

              <ChartSection title="Annual Inflation Rate by Month (Trailing 12 Months)" chartRef={chartAnnualRef} download={downloadAnnual} csvData={inflation.monthly as unknown as Record<string,unknown>[]} csvCols={["month","rate"]}>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={inflation.monthly.slice(-12)} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip contentStyle={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v.toFixed(2)}%`, "YoY Rate"]} />
                    <Line type="monotone" dataKey="rate" stroke="var(--color-accent)" strokeWidth={2} dot={{ fill: "var(--color-accent)", r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartSection>

              <ChartSection title="Month-to-Month Inflation" chartRef={chartMomRef} download={downloadMom} csvData={inflation.mom as unknown as Record<string,unknown>[]} csvCols={["month","change"]}>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={inflation.mom.slice(-24)} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} tickFormatter={(v: number) => `${v}%`} />
                    <ReferenceLine y={0} stroke="var(--color-border)" />
                    <Tooltip contentStyle={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v.toFixed(2)}%`, "MoM Change"]} />
                    <Bar dataKey="change" radius={[2, 2, 0, 0]}>
                      {inflation.mom.slice(-24).map((entry, i) => (
                        <Cell key={i} fill={(entry.change ?? 0) >= 0 ? "#22c55e" : "#ef4444"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartSection>

              <ChartSection title="Inflation Rate by Year (2013-2026)" chartRef={chartYearlyRef} download={downloadYearly} csvData={inflation.yearly as unknown as Record<string,unknown>[]} csvCols={["year","value"]}>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={inflation.yearly} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="year" tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip contentStyle={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v.toFixed(2)}%`, "Annual Rate"]} />
                    <Bar dataKey="value" radius={[2, 2, 0, 0]} fill="var(--color-accent)" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartSection>

              <div className="mb-3 p-3 rounded border border-[var(--color-border)]">
                <h3 className="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">Data Details</h3>
                <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                  Inflation data is based on the Consumer Price Index for All Urban Consumers (CPI-U), published by the <strong>U.S. Bureau of Labor Statistics (BLS)</strong>. Year-over-year rates are calculated as the percentage change in the CPI-U index level relative to the same month one year prior. Month-to-month changes reflect the percentage difference from the previous month. Annual rates are computed from the average CPI-U index level for each calendar year.
                </p>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={15} className="text-[var(--color-text-muted)]" />
                <h2 className="text-[13px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">United States -- Inflation by Year</h2>
                <span className="text-[10px] text-[var(--color-text-muted)] ml-auto">{inflation.historical[0]?.year}-{inflation.historical[inflation.historical.length - 1]?.year}</span>
              </div>
              <div className="border border-[var(--color-border)] rounded overflow-hidden mb-5 max-h-[60vh] overflow-y-auto">
                <table className="w-full text-[12px] leading-none">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b-2 border-[var(--color-border)] bg-[var(--color-surface-elevated)]/50">
                      <th className="text-left py-[7px] px-3 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Year</th>
                      <th className="text-right py-[7px] px-3 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Inflation Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...inflation.historical].reverse().map((r, i) => (
                      <tr key={r.year} className={cn("border-b border-[var(--color-border)]/15 transition-colors hover:bg-[var(--color-surface-elevated)]/20", i % 2 === 0 ? "bg-[var(--color-surface)]/5" : "bg-transparent")}>
                        <td className="text-left py-[5px] px-3 font-medium text-[12px]">{r.year}</td>
                        <td className="text-right py-[5px] px-3 tabular-nums font-mono text-[13px] font-semibold">{r.value.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
