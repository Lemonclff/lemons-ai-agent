"use client";

import { useEffect, useState } from "react";
import {
  Database, RefreshCw, Table2, Terminal, ShieldAlert, Loader2,
  Plus, Trash2, Edit3, Check, X, Search, Download, Copy, ChevronDown, ChevronRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ===== Table metadata ===== */
const TABLE_META: Record<string, { desc: string; usedIn: string[]; icon: string }> = {
  options_volatility_log: {
    desc: "期權波動率日誌 — IV/HV/PCR/成交量",
    usedIn: ["Quant Analysis", "Options & Volatility", "Cron: options_api.py"],
    icon: "📈",
  },
  stock_price_daily: {
    desc: "股票日線價格 — O/H/L/C/Adj Close/Volume",
    usedIn: ["Quant Analysis (RSI/BB)", "Dashboard", "Cron: ensure-prices"],
    icon: "💹",
  },
  macro_economic_events: {
    desc: "宏觀經濟事件 — 預期/實際/偏差/AI 影響",
    usedIn: ["Macro Impact Matrix", "Cron: macro_economic.py"],
    icon: "🌐",
  },
  tracked_tickers: {
    desc: "監控標的清單",
    usedIn: ["Options & Volatility", "Quant Analysis", "Sidebar"],
    icon: "📋",
  },
  users: {
    desc: "使用者認證 — bcrypt hash + admin flag",
    usedIn: ["Login", "Register", "Admin Reset Password", "Middleware"],
    icon: "🔐",
  },
};

const EDITABLE_COLS: Record<string, string[]> = {
  tracked_tickers: ["ticker", "name", "sector", "is_active"],
  users: ["username", "is_admin"],
};

/* ===== Page ===== */
export default function DataPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [activeTable, setActiveTable] = useState("");
  const [data, setData] = useState<{ columns: string[]; rows: Record<string, unknown>[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sqlInput, setSqlInput] = useState("");
  const [sqlResult, setSqlResult] = useState<{ columns: string[]; rows: Record<string, unknown>[] } | null>(null);
  const [sqlError, setSqlError] = useState("");
  const [sqlLoading, setSqlLoading] = useState(false);

  // Edit state
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);

  // Check admin
  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setIsAdmin(!!d.isAdmin)).catch(() => setIsAdmin(false));
  }, []);

  // Fetch table list
  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/db").then((r) => r.json()).then((j) => {
      if (j.rows) {
        const names = j.rows.map((r: { tbl: string }) => r.tbl).filter(Boolean);
        setTables(names);
        if (names.length > 0 && !activeTable) setActiveTable(names[0]);
      }
    });
  }, [isAdmin]);

  // Fetch table data
  useEffect(() => {
    if (!activeTable) return;
    setLoading(true);
    setError("");
    fetch(`/api/db?table=${activeTable}&limit=200`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setData(j);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [activeTable]);

  // Run custom SQL
  async function runSql() {
    if (!sqlInput.trim()) return;
    setSqlLoading(true);
    setSqlError("");
    try {
      const res = await fetch(`/api/db?sql=${encodeURIComponent(sqlInput)}`);
      const j = await res.json();
      if (j.error) setSqlError(j.error);
      else setSqlResult(j);
    } catch (e) {
      setSqlError(String(e));
    } finally {
      setSqlLoading(false);
    }
  }

  // INSERT new row
  async function insertRow(cols: string[], values: string[]) {
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
    const sql = `INSERT INTO ${activeTable} (${cols.join(", ")}) VALUES (${placeholders})`;
    const res = await fetch("/api/db/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params: values }),
    });
    const j = await res.json();
    if (j.ok) {
      // Refresh
      fetch(`/api/db?table=${activeTable}&limit=200`).then((r) => r.json()).then(setData);
    } else {
      alert(j.error || "Insert failed");
    }
  }

  // UPDATE row
  async function updateRow(id: number, col: string, value: string) {
    const res = await fetch("/api/db/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql: `UPDATE ${activeTable} SET ${col} = $1 WHERE id = $2`, params: [value, id] }),
    });
    const j = await res.json();
    if (!j.ok) alert(j.error);
  }

  // DELETE row
  async function deleteRow(id: number) {
    if (!confirm(`Delete row id=${id} from ${activeTable}?`)) return;
    const res = await fetch("/api/db/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql: `DELETE FROM ${activeTable} WHERE id = $1`, params: [id] }),
    });
    const j = await res.json();
    if (j.ok) {
      setData((prev) => prev ? { ...prev, rows: prev.rows.filter((r) => r.id !== id) } : null);
    } else {
      alert(j.error || "Delete failed");
    }
  }

  // CSV export
  function exportCSV() {
    if (!data) return;
    const headers = data.columns.join(",");
    const rows = data.rows.map((r) => data.columns.map((c) => {
      const v = r[c];
      return v === null ? "" : typeof v === "string" && v.includes(",") ? `"${v}"` : String(v);
    }).join(","));
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${activeTable}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  // ── Loading / Access Denied ──
  if (isAdmin === null) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-[var(--color-text-muted)]" /></div>;
  }
  if (!isAdmin) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center">
        <ShieldAlert size={48} className="mx-auto text-amber-400 mb-4" />
        <h1 className="text-xl font-semibold mb-2">權限不足</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Database Explorer 僅限管理員使用</p>
      </div>
    );
  }

  const meta = activeTable ? TABLE_META[activeTable] : null;
  const editableCols = EDITABLE_COLS[activeTable] || [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between max-sm:flex-col max-sm:gap-3 max-sm:items-start">
        <div>
          <h1 className="text-2xl font-bold">Database Explorer</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            PostgreSQL · {tables.length} tables · Admin access
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setActiveTable((t) => { fetch(`/api/db?table=${t}&limit=200`).then((r) => r.json()).then(setData); return t; })}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      {/* Table Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {tables.map((t) => {
          const m = TABLE_META[t];
          const count = t === activeTable ? data?.rows.length : null;
          return (
            <Card
              key={t}
              hover
              onClick={() => setActiveTable(t)}
              className={cn("cursor-pointer", activeTable === t && "border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/30")}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{m?.icon || "📦"}</span>
                <p className="text-xs font-medium truncate">{t.replace(/_/g, " ")}</p>
              </div>
              <p className="text-xl font-bold">{count !== null && count !== undefined ? count : "—"}</p>
              <p className="text-[10px] text-[var(--color-text-muted)]">{m?.desc || ""}</p>
            </Card>
          );
        })}
      </div>

      {/* Table Usage Info */}
      {meta && (
        <div className="flex items-center gap-3 flex-wrap text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-elevated)] rounded-xl px-4 py-2.5">
          <span className="font-medium text-[var(--color-text-secondary)]">Used in:</span>
          {meta.usedIn.map((u) => (
            <Badge key={u} variant="default" size="sm">{u}</Badge>
          ))}
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--color-surface-elevated)] w-fit flex-wrap">
        {tables.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTable(t)}
            className={cn("px-3 py-1.5 text-xs rounded-lg transition-all whitespace-nowrap", activeTable === t ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm font-medium" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]")}
          >
            {t.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {/* Action Bar */}
      {activeTable && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={exportCSV}><Download size={14} /> CSV</Button>
          <Button variant="ghost" size="sm" onClick={() => {
            const cols = editableCols.filter((c) => c !== "id" && c !== "created_at");
            insertRow(cols, cols.map(() => ""));
          }}><Plus size={14} /> New Row</Button>
          <span className="text-xs text-[var(--color-text-muted)]">{data?.rows.length || 0} rows</span>
        </div>
      )}

      {/* Data Table */}
      {error && <Card className="p-6 text-center"><p className="text-red-400 text-sm">{error}</p></Card>}

      {data && data.columns && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)] sticky top-0 z-10">
                  <th className="text-left py-2 px-2 w-8">#</th>
                  {data.columns.map((col) => (
                    <th key={col} className="text-left py-2 px-2 text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider whitespace-nowrap">{col}</th>
                  ))}
                  <th className="text-right py-2 px-2 w-16">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => (
                  <tr key={i} className={cn("border-b border-[var(--color-border)]/30 hover:bg-[var(--color-surface-elevated)]/30", i % 2 === 1 && "bg-[var(--color-surface)]/20")}>
                    <td className="py-1.5 px-2 text-[var(--color-text-muted)]">{i + 1}</td>
                    {data.columns.map((col) => {
                      const val = row[col];
                      const isEditing = editingRow === i && editableCols.includes(col);
                      const str = val === null ? "NULL" : typeof val === "number" ? val.toLocaleString() : String(val);
                      return (
                        <td key={col} className={cn("py-1.5 px-2 whitespace-nowrap max-w-[180px] truncate", val === null && "text-[var(--color-text-muted)] italic", typeof val === "number" && "font-mono")}>
                          {isEditing ? (
                            <input
                              className="w-full px-1 py-0.5 text-xs rounded bg-[var(--color-surface)] border border-[var(--color-accent)] text-[var(--color-text-primary)]"
                              value={editValues[col] ?? String(val ?? "")}
                              onChange={(e) => setEditValues((p) => ({ ...p, [col]: e.target.value }))}
                              autoFocus
                            />
                          ) : (
                            str
                          )}
                        </td>
                      );
                    })}
                    <td className="py-1.5 px-2 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        {editingRow === i ? (
                          <>
                            <Button variant="ghost" size="sm" onClick={async () => {
                              for (const col of editableCols) {
                                if (editValues[col] !== undefined) {
                                  await updateRow(row.id as number, col, editValues[col]);
                                }
                              }
                              setEditingRow(null);
                              fetch(`/api/db?table=${activeTable}&limit=200`).then((r) => r.json()).then(setData);
                            }}><Check size={12} className="text-emerald-400" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => setEditingRow(null)}><X size={12} className="text-red-400" /></Button>
                          </>
                        ) : (
                          <>
                            {editableCols.length > 0 && (
                              <Button variant="ghost" size="sm" onClick={() => {
                                const vals: Record<string, string> = {};
                                for (const c of editableCols) vals[c] = String(row[c] ?? "");
                                setEditValues(vals);
                                setEditingRow(i);
                              }}><Edit3 size={12} /></Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => deleteRow(row.id as number)}><Trash2 size={12} className="text-red-400" /></Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* SQL Console */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Terminal size={16} className="text-[var(--color-accent)]" />
            <CardTitle>SQL Console (SELECT only)</CardTitle>
          </div>
        </CardHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={sqlInput}
              onChange={(e) => setSqlInput(e.target.value)}
              placeholder="SELECT * FROM stock_price_daily WHERE ticker='NVDA' ORDER BY trade_date DESC LIMIT 10"
              className="flex-1 px-3 py-2 text-xs font-mono rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
              onKeyDown={(e) => e.key === "Enter" && runSql()}
            />
            <Button size="sm" onClick={runSql} disabled={sqlLoading}>
              {sqlLoading ? <Loader2 size={14} className="animate-spin" /> : "Run"}
            </Button>
          </div>
          {sqlError && <p className="text-xs text-red-400">{sqlError}</p>}
          {sqlResult && sqlResult.columns && (
            <div className="overflow-x-auto max-h-48">
              <table className="w-full text-[11px] font-mono">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    {sqlResult.columns.map((c) => <th key={c} className="text-left py-1.5 px-2 text-[var(--color-text-muted)]">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {sqlResult.rows.map((r, i) => (
                    <tr key={i} className="border-b border-[var(--color-border)]/20">
                      {sqlResult.columns.map((c) => <td key={c} className="py-1 px-2">{String(r[c] ?? "NULL")}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
