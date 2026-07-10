"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, History, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Goals { calories: number; protein: number; carbs: number; fat: number; }

export function HistoryTab({
  weeklyData, currentDate, setCurrentDate, todayStr, goals,
  historyMonth, setHistoryMonth,
}: {
  weeklyData: Record<string, Record<string, number>>; currentDate: string;
  setCurrentDate: (d:string) => void; todayStr: string;
  goals: Goals; historyMonth: Date; setHistoryMonth: (d:Date) => void;
}) {
  const entries = Object.entries(weeklyData);
  const [chartType, setChartType] = useState("calories");
  const [chartImg, setChartImg] = useState<string | null>(null);
  const [chartLoading, setChartLoading] = useState(false);

  useEffect(() => {
    setChartLoading(true);
    setChartImg(null);
    fetch(`/api/nutrition/charts/calorie-trend?days=7&type=${chartType}`)
      .then(r => r.json())
      .then(d => { if (d.imageUrl) setChartImg(d.imageUrl); })
      .catch(() => {})
      .finally(() => setChartLoading(false));
  }, [chartType]);

  return (
    <div className="grid gap-4 max-w-[700px]">
      {/* Weekly stats summary */}
      {entries.length === 0 ? (
        <div className="text-center py-10 text-[13px] text-[var(--color-text-muted)] border border-[var(--color-border)] rounded-lg">
          <History size={32} className="mx-auto mb-2 opacity-20" />
          No history data yet. Start logging food to see trends.
        </div>
      ) : (
        (() => {
          const totalCal = entries.reduce((s, [,v]) => s + (v.calories||0), 0);
          const totalP = entries.reduce((s, [,v]) => s + (v.protein||0), 0);
          const totalC = entries.reduce((s, [,v]) => s + (v.carbs||0), 0);
          const totalF = entries.reduce((s, [,v]) => s + (v.fat||0), 0);
          const days = entries.length;
          return (
            <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
              <div className="border border-[var(--color-border)] rounded-lg p-3 text-center">
                <div className="text-[20px] font-bold text-[var(--color-text-primary)] tabular-nums">{Math.round(totalCal/days)}</div>
                <div className="text-[10px] text-[var(--color-text-muted)]">Avg kcal/day</div>
              </div>
              <div className="border border-[var(--color-border)] rounded-lg p-3 text-center">
                <div className="text-[20px] font-bold text-green-400 tabular-nums">{totalP.toFixed(0)}</div>
                <div className="text-[10px] text-[var(--color-text-muted)]">Total Protein (g)</div>
              </div>
              <div className="border border-[var(--color-border)] rounded-lg p-3 text-center">
                <div className="text-[20px] font-bold text-amber-400 tabular-nums">{totalC.toFixed(0)}</div>
                <div className="text-[10px] text-[var(--color-text-muted)]">Total Carbs (g)</div>
              </div>
              <div className="border border-[var(--color-border)] rounded-lg p-3 text-center">
                <div className="text-[20px] font-bold text-red-400 tabular-nums">{totalF.toFixed(0)}</div>
                <div className="text-[10px] text-[var(--color-text-muted)]">Total Fat (g)</div>
              </div>
            </div>
          );
        })()
      )}

      {/* ═══ G2 Chart: 7-Day Trend ═══ */}
      <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-surface-elevated)]/30 border-b border-[var(--color-border)]/50">
          <History size={15} className="text-[var(--color-accent)]" />
          <span className="text-[13px] font-semibold text-[var(--color-text-secondary)]">7-Day Trend</span>
          <div className="ml-auto flex items-center gap-1">
            {[
              { key: "calories", label: "Cal", color: "bg-orange-400" },
              { key: "protein", label: "Prot", color: "bg-green-400" },
              { key: "carbs", label: "Carb", color: "bg-amber-400" },
              { key: "fat", label: "Fat", color: "bg-red-400" },
            ].map(t => (
              <button key={t.key} onClick={() => setChartType(t.key)}
                className={cn(
                  "px-2 py-1 text-[11px] rounded-md font-medium transition-all",
                  chartType === t.key
                    ? `${t.color} text-white shadow-sm`
                    : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)]"
                )}>{t.label}</button>
            ))}
          </div>
        </div>
        <div className="p-3 flex items-center justify-center min-h-[280px] bg-[var(--color-surface)]">
          {chartLoading ? (
            <Loader2 size={24} className="animate-spin text-[var(--color-text-muted)]/40" />
          ) : chartImg ? (
            <img src={chartImg} alt={`${chartType} trend`} className="w-full max-w-full h-auto rounded" />
          ) : (
            <span className="text-[12px] text-[var(--color-text-muted)]/50">No chart data</span>
          )}
        </div>
      </div>

      {/* Mini Calendar */}
      <div className="border border-[var(--color-border)] rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => { const d = new Date(historyMonth); d.setMonth(d.getMonth() - 1); setHistoryMonth(d); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--color-surface-elevated)]/50 border border-[var(--color-border)]/50 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-accent)] transition-all"><ChevronLeft size={14} /></button>
          <span className="text-[13px] font-semibold text-[var(--color-text-secondary)]">{historyMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
          <button onClick={() => { const d = new Date(historyMonth); d.setMonth(d.getMonth() + 1); setHistoryMonth(d); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--color-surface-elevated)]/50 border border-[var(--color-border)]/50 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-accent)] transition-all"><ChevronRight size={14} /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => <div key={d} className="text-[10px] text-[var(--color-text-muted)] py-1 font-medium">{d}</div>)}
          {(() => {
            const y = historyMonth.getFullYear(); const m = historyMonth.getMonth();
            const firstDay = new Date(y, m, 1).getDay();
            const daysInMonth = new Date(y, m + 1, 0).getDate();
            const loggedDates = new Set(Object.keys(weeklyData));
            const cells = [];
            for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} />);
            for (let d = 1; d <= daysInMonth; d++) {
              const ds = `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
              const isToday = ds === todayStr;
              const isSelected = ds === currentDate;
              const hasLog = loggedDates.has(ds);
              cells.push(
                <button key={d} onClick={() => setCurrentDate(ds)}
                  className={cn("relative py-1.5 text-[11px] rounded hover:bg-[var(--color-surface-elevated)] transition-colors",
                    isToday && "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent)] font-semibold",
                    isSelected && !isToday && "bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-semibold",
                    hasLog && !isToday && !isSelected && "text-[var(--color-text-primary)]"
                  )}>
                  {d}
                  {hasLog && !isToday && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                      style={{ background: isSelected ? "var(--color-accent)" : "#22c55e" }} />
                  )}
                </button>
              );
            }
            return cells;
          })()}
        </div>
        <div className="mt-2 flex items-center gap-3 text-[10px] text-[var(--color-text-muted)]">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />Food logged</span>
        </div>
      </div>
    </div>
  );
}
