"use client";

import { useEffect, useId, useState, useRef } from "react";
import { cn } from "@/lib/utils";

/* ================================================================
   AnimatedNumber — count-up animation using requestAnimationFrame
   ================================================================ */
function AnimatedNumber({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      // ease-out-expo
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <>{Math.round(display)}</>;
}

/* ================================================================
   Progress Ring — animated SVG with gradient stroke + glow
   ================================================================ */

export function Ring({
  value,
  max,
  color,
  label,
  unit,
  size = "md",
  className,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
  unit: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, [value, max]);

  const dims = {
    sm: { box: 64, r: 24, sw: 5, font: "text-[11px]", val: "text-[14px]" },
    md: { box: 78, r: 30, sw: 6, font: "text-[12px]", val: "text-[16px]" },
    lg: { box: 120, r: 48, sw: 8, font: "text-[14px]", val: "text-[22px]" },
  }[size];

  const r = dims.r;
  const circ = 2 * Math.PI * r;
  const rawPct = max > 0 ? value / max : 0;
  const pct = Math.min(rawPct, 1.25);
  const offset = mounted ? circ * (1 - Math.min(pct, 1)) : circ;
  const overGoal = rawPct > 1;

  // Status-aware color when not explicitly using fixed palette
  const strokeColor = overGoal
    ? "#ef4444"
    : rawPct >= 0.85
      ? "#22c55e"
      : rawPct >= 0.5
        ? color
        : color;

  const view = dims.box + 8;
  const c = view / 2;

  return (
    <div
      className={cn(
        "flex flex-col items-center p-3 rounded-2xl",
        "bg-[var(--color-surface-elevated)]/40 border border-[var(--color-border)]/40",
        "hover:border-[var(--color-border-strong)] transition-all duration-300",
        "nutri-card-hover cursor-pointer",
        className
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="relative"
        style={{ width: dims.box, height: dims.box }}
      >
        <svg
          viewBox={`0 0 ${view} ${view}`}
          className="w-full h-full -rotate-90"
          aria-hidden
        >
          <defs>
            <linearGradient id={`ng-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="1" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.55" />
            </linearGradient>
            <filter id={`gf-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Track */}
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={dims.sw}
            opacity={0.7}
          />

          {/* Soft glow ring */}
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={strokeColor}
            strokeWidth={dims.sw + 4}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            opacity={0.15}
            className="nutri-ring-progress"
          />

          {/* Main progress */}
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={`url(#ng-${uid})`}
            strokeWidth={dims.sw}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            filter={`url(#gf-${uid})`}
            className="nutri-ring-progress"
            style={{ color: strokeColor }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              "font-bold nutri-num text-[var(--color-text-primary)] leading-none transition-transform duration-300",
              hovered && "scale-110",
              dims.font
            )}
          >
            {mounted ? <AnimatedNumber value={Math.min(rawPct, 9.99) * 100} /> : 0}%
          </span>
        </div>
      </div>

      <div
        className={cn(
          "font-bold nutri-num text-[var(--color-text-primary)] mt-1.5 leading-none transition-all duration-300",
          hovered && "text-[var(--color-accent)]",
          dims.val
        )}
      >
        {mounted ? <AnimatedNumber value={Math.round(value)} /> : 0}
        {overGoal && (
          <span className="text-[10px] text-red-400 font-semibold ml-0.5">↑</span>
        )}
      </div>
      <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
        {unit}
        {max > 0 && (
          <span className="opacity-70"> / {Math.round(max)}</span>
        )}
      </div>
      <div className="text-[11px] font-medium text-[var(--color-text-secondary)] mt-0.5">
        {label}
      </div>
    </div>
  );
}

/* ================================================================
   CalorieHero — large dual-ring centerpiece (In / Goal)
   Enhanced with ambient mesh glow + animated numbers
   ================================================================ */

export function CalorieHero({
  caloriesIn,
  caloriesOut,
  goal,
}: {
  caloriesIn: number;
  caloriesOut: number;
  goal: number;
}) {
  const uid = useId().replace(/:/g, "");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, [caloriesIn, caloriesOut, goal]);

  const net = caloriesIn - caloriesOut;
  const rOuter = 58;
  const rInner = 44;
  const circO = 2 * Math.PI * rOuter;
  const circI = 2 * Math.PI * rInner;
  const inPct = goal > 0 ? Math.min(caloriesIn / goal, 1) : 0;
  const outPct = caloriesIn > 0 ? Math.min(caloriesOut / caloriesIn, 1) : 0;
  const offO = mounted ? circO * (1 - inPct) : circO;
  const offI = mounted ? circI * (1 - outPct) : circI;
  const netStatus =
    net > goal ? "over" : net < goal * 0.7 && caloriesIn > 0 ? "under" : "good";

  return (
    <div className="nutri-hero rounded-3xl border border-[var(--color-border)]/50 bg-[var(--color-surface-elevated)]/25 p-5 sm:p-6">
      {/* Ambient mesh blobs */}
      <div className="absolute top-0 left-0 w-32 h-32 rounded-full bg-orange-500/8 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-28 h-28 rounded-full bg-green-500/8 blur-3xl pointer-events-none" />

      <div className="relative z-[1] flex flex-col sm:flex-row items-center gap-5 sm:gap-8">
        {/* Dual ring */}
        <div className="relative w-[148px] h-[148px] shrink-0">
          <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
            <defs>
              <linearGradient id={`in-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#fb923c" />
                <stop offset="100%" stopColor="#f97316" />
              </linearGradient>
              <linearGradient id={`out-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#4ade80" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
            </defs>
            <circle cx="70" cy="70" r={rOuter} fill="none" stroke="var(--color-border)" strokeWidth="9" opacity="0.6" />
            <circle cx="70" cy="70" r={rInner} fill="none" stroke="var(--color-border)" strokeWidth="7" opacity="0.45" />
            <circle
              cx="70" cy="70" r={rOuter} fill="none"
              stroke={`url(#in-${uid})`} strokeWidth="9" strokeLinecap="round"
              strokeDasharray={circO} strokeDashoffset={offO}
              className="nutri-ring-progress"
              style={{ color: "#f97316" }}
            />
            <circle
              cx="70" cy="70" r={rInner} fill="none"
              stroke={`url(#out-${uid})`} strokeWidth="7" strokeLinecap="round"
              strokeDasharray={circI} strokeDashoffset={offI}
              className="nutri-ring-progress"
              style={{ color: "#22c55e" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Net
            </span>
            <span
              className={cn(
                "text-[22px] font-bold nutri-num leading-none",
                netStatus === "over" && "text-red-400",
                netStatus === "under" && "text-sky-400",
                netStatus === "good" && "text-emerald-400"
              )}
            >
              {mounted ? <AnimatedNumber value={Math.round(net)} /> : 0}
            </span>
            <span className="text-[10px] text-[var(--color-text-muted)]">kcal</span>
          </div>
        </div>

        {/* Legend + stats */}
        <div className="flex-1 w-full space-y-3 min-w-0">
          <div>
            <h3 className="text-[15px] font-bold text-[var(--color-text-primary)]">
              Today&apos;s Energy
            </h3>
            <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
              Outer = intake · Inner = burned
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl nutri-card-in px-3 py-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-orange-400/90">
                In
              </div>
              <div className="text-[20px] font-bold text-orange-400 nutri-num leading-tight">
                {mounted ? <AnimatedNumber value={Math.round(caloriesIn)} /> : 0}
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)]">
                of {goal} goal
              </div>
            </div>
            <div className="rounded-xl nutri-card-out px-3 py-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-green-400/90">
                Out
              </div>
              <div className="text-[20px] font-bold text-green-400 nutri-num leading-tight">
                {mounted ? <AnimatedNumber value={Math.round(caloriesOut)} /> : 0}
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)]">
                {caloriesIn > 0
                  ? `${Math.round((caloriesOut / caloriesIn) * 100)}% of intake`
                  : "no intake yet"}
              </div>
            </div>
          </div>

          {/* Goal track */}
          <div>
            <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mb-1">
              <span>Goal progress</span>
              <span className="nutri-num">
                {goal > 0 ? Math.round((caloriesIn / goal) * 100) : 0}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-[var(--color-border)]/40 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full nutri-bar-fill bg-gradient-to-r",
                  caloriesIn > goal ? "bg-red-400" : "from-orange-400 to-amber-400"
                )}
                style={{ width: `${Math.min(100, goal > 0 ? (caloriesIn / goal) * 100 : 0)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   MacroBars — horizontal animated macro progress
   Enhanced with gradient fills + refined shimmer
   ================================================================ */

export function MacroBars({
  protein,
  carbs,
  fat,
  goals,
}: {
  protein: number;
  carbs: number;
  fat: number;
  goals: { protein: number; carbs: number; fat: number };
}) {
  const rows = [
    { key: "protein", label: "Protein", value: protein, max: goals.protein, color: "var(--nutri-protein)", bar: "from-sky-400 to-blue-500", text: "text-sky-400" },
    { key: "carbs", label: "Carbs", value: carbs, max: goals.carbs, color: "var(--nutri-carbs)", bar: "from-amber-400 to-yellow-500", text: "text-amber-400" },
    { key: "fat", label: "Fat", value: fat, max: goals.fat, color: "var(--nutri-fat)", bar: "from-pink-400 to-rose-500", text: "text-pink-400" },
  ];

  return (
    <div className="rounded-2xl border border-[var(--color-border)]/50 bg-[var(--color-surface-elevated)]/25 p-4 space-y-3.5">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">
          Macro Balance
        </h3>
        <span className="text-[10px] text-[var(--color-text-muted)]">vs daily goal</span>
      </div>
      {rows.map((row) => {
        const pct = row.max > 0 ? (row.value / row.max) * 100 : 0;
        const over = pct > 100;
        return (
          <div key={row.key}>
            <div className="flex items-baseline justify-between mb-1.5 gap-2">
              <span className={cn("text-[12px] font-semibold", row.text)}>
                {row.label}
              </span>
              <span className="text-[12px] nutri-num text-[var(--color-text-secondary)]">
                <span className="font-bold text-[var(--color-text-primary)]">
                  {Math.round(row.value)}
                </span>
                <span className="text-[var(--color-text-muted)]">
                  {" "}
                  / {Math.round(row.max)}g
                </span>
                <span className={cn("ml-1.5 text-[10px] font-semibold", over ? "text-red-400" : "text-[var(--color-text-muted)]")}>
                  {Math.round(pct)}%
                </span>
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-[var(--color-border)]/35 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full nutri-bar-fill bg-gradient-to-r",
                  over ? "from-red-400 to-red-500" : row.bar
                )}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
