"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight, History, TrendingUp, Droplets } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";

interface Goals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)]/95 backdrop-blur-md px-3 py-2 shadow-lg text-[12px]">
      <div className="font-semibold text-[var(--color-text-primary)] mb-1">
        {label}
      </div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-[var(--color-text-secondary)]">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: p.color || "var(--color-accent)" }}
          />
          <span className="capitalize">{p.name}</span>
          <span className="ml-auto font-bold nutri-num text-[var(--color-text-primary)]">
            {Math.round(Number(p.value) || 0)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function HistoryTab({
  weeklyData,
  currentDate,
  setCurrentDate,
  todayStr,
  goals,
  historyMonth,
  setHistoryMonth,
}: {
  weeklyData: Record<string, Record<string, number>>;
  currentDate: string;
  setCurrentDate: (d: string) => void;
  todayStr: string;
  goals: Goals;
  historyMonth: Date;
  setHistoryMonth: (d: Date) => void;
}) {
  const entries = Object.entries(weeklyData).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  const chartData = useMemo(
    () =>
      entries.map(([date, vals]) => {
        const d = new Date(date + "T12:00:00");
        return {
          date,
          label: d.toLocaleDateString("en-US", { weekday: "short" }),
          full: d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          calories: Math.round(vals.calories || 0),
          protein: Math.round(vals.protein || 0),
          carbs: Math.round(vals.carbs || 0),
          fat: Math.round(vals.fat || 0),
          water: Math.round(vals.water || 0),
          over: goals.calories > 0 && (vals.calories || 0) > goals.calories,
          selected: date === currentDate,
        };
      }),
    [entries, goals.calories, currentDate]
  );

  const stats = useMemo(() => {
    if (entries.length === 0) return null;
    const days = entries.length;
    const totalCal = entries.reduce((s, [, v]) => s + (v.calories || 0), 0);
    const totalP = entries.reduce((s, [, v]) => s + (v.protein || 0), 0);
    const totalC = entries.reduce((s, [, v]) => s + (v.carbs || 0), 0);
    const totalF = entries.reduce((s, [, v]) => s + (v.fat || 0), 0);
    const totalWater = entries.reduce((s, [, v]) => s + (v.water || 0), 0);
    return {
      avgCal: Math.round(totalCal / days),
      totalP: Math.round(totalP),
      totalC: Math.round(totalC),
      totalF: Math.round(totalF),
      avgWater: Math.round(totalWater / days),
      days,
    };
  }, [entries]);

  return (
    <div className="nutri-stagger grid gap-3 max-w-[700px]">
      {/* Weekly stats */}
      {!stats ? (
        <div className="text-center py-14 text-[13px] text-[var(--color-text-muted)] rounded-2xl border border-dashed border-[var(--color-border)]/50">
          <History size={36} className="mx-auto mb-3 opacity-20" />
          No history data yet. Start logging food to see trends.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {[
            {
              val: stats.avgCal,
              label: "Avg kcal/day",
              color: "text-[var(--color-text-primary)]",
              bg: "from-indigo-500/10 to-transparent",
            },
            {
              val: stats.totalP,
              label: "Protein (g)",
              color: "text-sky-400",
              bg: "from-sky-500/10 to-transparent",
            },
            {
              val: stats.totalC,
              label: "Carbs (g)",
              color: "text-amber-400",
              bg: "from-amber-500/10 to-transparent",
            },
            {
              val: stats.totalF,
              label: "Fat (g)",
              color: "text-pink-400",
              bg: "from-pink-500/10 to-transparent",
            },
            {
              val: stats.avgWater,
              label: "Avg water (ml)",
              color: "text-sky-400",
              bg: "from-sky-500/10 to-transparent",
              icon: Droplets,
            },
          ].map((s) => (
            <div
              key={s.label}
              className={cn(
                "rounded-2xl border border-[var(--color-border)]/50 p-3.5 text-center nutri-card-hover",
                "bg-gradient-to-b",
                s.bg
              )}
            >
              <div
                className={cn(
                  "text-[22px] sm:text-[24px] font-bold nutri-num",
                  s.color
                )}
              >
                {s.val}
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══ Area chart — calorie trend ═══ */}
      <div className="rounded-2xl border border-[var(--color-border)]/50 bg-[var(--color-surface-elevated)]/20 p-4 nutri-card-hover">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-accent-muted)] flex items-center justify-center nutri-icon-bounce">
              <TrendingUp size={15} className="text-[var(--color-accent)]" />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">
                7-Day Calorie Trend
              </h3>
              <p className="text-[10px] text-[var(--color-text-muted)]">
                Tap a day to jump · goal line dashed
              </p>
            </div>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="h-[160px] flex items-center justify-center text-[12px] text-[var(--color-text-muted)]">
            No data
          </div>
        ) : (
          <div className="h-[180px] w-full -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                onClick={(state: any) => {
                  const d = state?.activePayload?.[0]?.payload?.date;
                  if (d) setCurrentDate(d);
                }}
              >
                <defs>
                  <linearGradient id="calArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 6"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={<ChartTooltip />} />
                {goals.calories > 0 && (
                  <ReferenceLine
                    y={goals.calories}
                    stroke="var(--color-gold)"
                    strokeDasharray="4 4"
                    strokeOpacity={0.7}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="calories"
                  name="calories"
                  stroke="#818cf8"
                  strokeWidth={2.5}
                  fill="url(#calArea)"
                  activeDot={{
                    r: 5,
                    stroke: "#fff",
                    strokeWidth: 2,
                    fill: "#6366f1",
                  }}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ═══ Macro stacked bars ═══ */}
      {chartData.length > 0 && (
        <div className="rounded-2xl border border-[var(--color-border)]/50 bg-[var(--color-surface-elevated)]/20 p-4 nutri-card-hover">
          <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)] mb-1">
            Daily Macros
          </h3>
          <p className="text-[10px] text-[var(--color-text-muted)] mb-3">
            Protein · Carbs · Fat (grams)
          </p>
          <div className="h-[150px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 8, left: -18, bottom: 0 }}
                onClick={(state: any) => {
                  const d = state?.activePayload?.[0]?.payload?.date;
                  if (d) setCurrentDate(d);
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 6"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="protein"
                  name="protein"
                  stackId="m"
                  fill="#38bdf8"
                  radius={[0, 0, 0, 0]}
                  animationDuration={700}
                />
                <Bar
                  dataKey="carbs"
                  name="carbs"
                  stackId="m"
                  fill="#fbbf24"
                  animationDuration={700}
                />
                <Bar
                  dataKey="fat"
                  name="fat"
                  stackId="m"
                  fill="#f472b6"
                  radius={[4, 4, 0, 0]}
                  animationDuration={700}
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.date}
                      opacity={entry.selected ? 1 : 0.85}
                      stroke={entry.selected ? "var(--color-accent)" : "none"}
                      strokeWidth={entry.selected ? 1 : 0}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-sky-400" /> Protein
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> Carbs
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-pink-400" /> Fat
            </span>
          </div>
        </div>
      )}

      {/* ═══ Water bar chart ═══ */}
      {chartData.length > 0 && (
        <div className="rounded-2xl border border-[var(--color-border)]/50 bg-[var(--color-surface-elevated)]/20 p-4 nutri-card-hover">
          <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)] mb-1">
            Daily Water Intake
          </h3>
          <p className="text-[10px] text-[var(--color-text-muted)] mb-3">
            ml per day · dashed line = target
          </p>
          <div className="h-[160px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 8, left: -18, bottom: 0 }}
                onClick={(state: any) => {
                  const d = state?.activePayload?.[0]?.payload?.date;
                  if (d) setCurrentDate(d);
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 6"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceLine
                  y={goals.calories ? 2000 : 2000}
                  stroke="#38bdf8"
                  strokeDasharray="4 4"
                  strokeOpacity={0.5}
                />
                <Bar
                  dataKey="water"
                  name="water"
                  fill="#38bdf8"
                  radius={[4, 4, 0, 0]}
                  animationDuration={700}
                >
                  {chartData.map((entry: any) => (
                    <Cell
                      key={entry.date}
                      fill={entry.water > 0 ? "#38bdf8" : "#38bdf830"}
                      opacity={entry.selected ? 1 : 0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ══ Mini Calendar ═══ */}
      <div className="rounded-2xl border border-[var(--color-border)]/50 bg-[var(--color-surface-elevated)]/20 p-4 nutri-card-hover">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => {
              const d = new Date(historyMonth);
              d.setMonth(d.getMonth() - 1);
              setHistoryMonth(d);
            }}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)]/50 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] active:scale-95 transition-all nutri-press"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-[14px] font-semibold text-[var(--color-text-primary)]">
            {historyMonth.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </span>
          <button
            onClick={() => {
              const d = new Date(historyMonth);
              d.setMonth(d.getMonth() + 1);
              setHistoryMonth(d);
            }}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)]/50 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] active:scale-95 transition-all nutri-press"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div
              key={d}
              className="text-[11px] text-[var(--color-text-muted)] py-1.5 font-semibold"
            >
              {d}
            </div>
          ))}
          {(() => {
            const y = historyMonth.getFullYear();
            const m = historyMonth.getMonth();
            const firstDay = new Date(y, m, 1).getDay();
            const daysInMonth = new Date(y, m + 1, 0).getDate();
            const loggedDates = new Set(Object.keys(weeklyData));
            const waterDates = new Set(
              Object.entries(weeklyData)
                .filter(([, v]) => (v.water || 0) > 0)
                .map(([k]) => k)
            );
            const cells = [];
            for (let i = 0; i < firstDay; i++)
              cells.push(<div key={`e${i}`} />);
            for (let d = 1; d <= daysInMonth; d++) {
              const ds = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const isToday = ds === todayStr;
              const isSelected = ds === currentDate;
              const hasLog = loggedDates.has(ds);
              cells.push(
                <button
                  key={d}
                  onClick={() => setCurrentDate(ds)}
                  className={cn(
                    "min-h-[40px] text-[12px] rounded-xl hover:bg-[var(--color-surface-elevated)] active:scale-95 transition-all relative nutri-press",
                    isToday &&
                      "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent)] font-bold shadow-glow-sm",
                    isSelected &&
                      !isToday &&
                      "bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-semibold ring-1 ring-[var(--color-accent)]/40",
                    hasLog &&
                      !isToday &&
                      !isSelected &&
                      "text-[var(--color-text-primary)]"
                  )}
                >
                  {d}
                  <div className="flex items-center justify-center gap-0.5 mt-0.5">
                    {hasLog && <span className="w-1 h-1 rounded-full bg-green-400" />}
                    {waterDates.has(ds) && <span className="w-1 h-1 rounded-full bg-sky-400" />}
                  </div>
                </button>
              );
            }
            return cells;
          })()}
        </div>
        <div className="mt-3 flex items-center gap-3 text-[11px] text-[var(--color-text-muted)]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-400 nutri-day-dot inline-block" /> Food
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> Water
          </span>
        </div>
      </div>
    </div>
  );
}
