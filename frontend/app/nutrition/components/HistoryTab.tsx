"use client";

import { ChevronLeft, ChevronRight, History } from "lucide-react";
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

      {/* Calorie trend bar chart */}
      <div className="border border-[var(--color-border)] rounded-lg p-4">
        <h3 className="text-[13px] font-semibold text-[var(--color-text-secondary)] mb-3">7-Day Calorie Trend</h3>
        <div className="flex items-end gap-1 h-[140px]">
          {entries.length === 0 ? (
            <div className="text-[12px] text-[var(--color-text-muted)] w-full text-center">No data</div>
          ) : entries.map(([date, vals]) => {
            const maxVal = Math.max(...Object.values(weeklyData).map(v => v.calories), 100);
            const h = Math.max((vals.calories / maxVal) * 110, 2);
            const label = new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
            const overGoal = goals.calories > 0 && vals.calories > goals.calories;
            return (
              <button key={date} onClick={() => setCurrentDate(date)}
                className="flex-1 flex flex-col items-center gap-1 group cursor-pointer">
                <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums group-hover:text-[var(--color-accent)] transition-colors">{vals.calories}</span>
                <div className="w-full rounded-t transition-all group-hover:opacity-80"
                  style={{ height: Math.max(h, 3), background: overGoal ? "#ef4444" : date === currentDate ? "var(--color-accent)" : "#3b82f6", opacity: date === currentDate ? 1 : 0.45 }} />
                <span className="text-[10px] text-[var(--color-text-muted)]">{label}</span>
              </button>
            );
          })}
        </div>
        {goals.calories > 0 && (
          <div className="mt-2 flex items-center gap-3 text-[10px] text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Over target</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Under target</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--color-accent)] inline-block" />Selected</span>
          </div>
        )}
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
