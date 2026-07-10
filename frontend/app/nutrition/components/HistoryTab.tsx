"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, History } from "lucide-react";
import { cn } from "@/lib/utils";

interface Goals { calories: number; protein: number; carbs: number; fat: number; }

/** Load G2 from CDN once */
let g2Promise: Promise<any> | null = null;
function loadG2(): Promise<any> {
  if (g2Promise) return g2Promise;
  g2Promise = new Promise((resolve, reject) => {
    if ((window as any).G2) return resolve((window as any).G2);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/@antv/g2@5/dist/g2.min.js";
    script.onload = () => resolve((window as any).G2);
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return g2Promise;
}

function G2Chart({ data, goal, type }: { data: { date: string; value: number }[]; goal: number; type: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;
    let cancelled = false;

    loadG2().then((G2) => {
      if (cancelled || !containerRef.current) return;
      if (chartRef.current) chartRef.current.destroy();

      const colors: Record<string, string> = { calories: "#f97316", protein: "#22c55e", carbs: "#eab308", fat: "#ef4444" };
      const color = colors[type] || "#3b82f6";
      const unit = type === "calories" ? "kcal" : "g";

      const chart = new G2.Chart({
        container: containerRef.current,
        autoFit: true,
        height: 200,
        padding: 8,
        paddingLeft: 48,
        paddingRight: 16,
        paddingBottom: 32,
      });

      const marks: any[] = [
        {
          type: "interval",
          data,
          encode: { x: "date", y: "value" },
          style: { fill: color, radius: 4, fillOpacity: 0.85, maxWidth: 32 },
          labels: [{
            text: (d: any) => d.value > 0 ? String(d.value) : "",
            position: "top",
            style: { fontSize: 10, fill: color, fontWeight: 600, dy: -4 },
          }],
        },
      ];

      // Goal line
      if (type === "calories" && goal > 0) {
        marks.push({
          type: "lineY",
          data: [{ y: goal }],
          encode: { y: "y" },
          style: { stroke: "#ef4444", lineWidth: 1, lineDash: [4, 3], opacity: 0.7 },
          labels: [{ text: `Goal ${goal}`, position: "right", style: { fontSize: 9, fill: "#ef4444", dx: 4 } }],
        });
      }

      chart.options({
        type: "view",
        data,
        children: marks,
        scale: { y: { domainMin: 0 } },
        axis: {
          x: { title: false, labelFontSize: 11, labelFill: "#888", tick: false, line: false },
          y: { title: false, labelFontSize: 10, labelFill: "#666", grid: true, gridStroke: "rgba(128,128,128,0.1)", tick: false, line: false },
        },
        interaction: { tooltip: { shared: true } },
      });

      chart.render();
      chartRef.current = chart;
    });

    return () => { cancelled = true; };
  }, [data, goal, type]);

  return <div ref={containerRef} className="w-full" />;
}

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

  // Build chart data
  const chartData = entries.map(([date, vals]) => ({
    date: new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" }),
    value: chartType === "calories" ? (vals.calories || 0) : chartType === "protein" ? (vals.protein || 0) : chartType === "carbs" ? (vals.carbs || 0) : (vals.fat || 0),
    raw: date,
  }));

  return (
    <div className="grid gap-4 max-w-[700px]">
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
        <div className="p-3">
          {chartData.length > 0 ? (
            <G2Chart data={chartData} goal={goals.calories} type={chartType} />
          ) : (
            <div className="h-[200px] flex items-center justify-center text-[12px] text-[var(--color-text-muted)]/50">No data</div>
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
