"use client";

/* ================================================================
   Progress Ring — shared by Dashboard
   ================================================================ */

export function Ring({ value, max, color, label, unit }: {
  value: number; max: number; color: string; label: string; unit: string;
}) {
  const r = 32; const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1.2) : 0;
  const offset = circ * (1 - pct);
  const ringColor = pct >= 0.8 ? "#22c55e" : pct >= 0.5 ? "#eab308" : "#ef4444";
  return (
    <div className="flex flex-col items-center p-3 rounded-lg bg-[var(--color-surface-elevated)]/30 border border-[var(--color-border)]/20">
      <div className="relative w-[70px] h-[70px]">
        <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90">
          <circle cx="36" cy="36" r={r} fill="none" stroke="var(--color-border)" strokeWidth="6" />
          <circle cx="36" cy="36" r={r} fill="none" stroke={ringColor} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 0.4s" }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[13px] font-bold text-[var(--color-text-primary)]">{Math.round(pct * 100)}%</span>
        </div>
      </div>
      <div className="text-[18px] font-bold text-[var(--color-text-primary)] tabular-nums mt-1">{Math.round(value)}</div>
      <div className="text-[10px] text-[var(--color-text-muted)]">{unit}</div>
      <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{label}</div>
    </div>
  );
}
