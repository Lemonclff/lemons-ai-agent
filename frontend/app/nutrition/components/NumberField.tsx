"use client";

/* ================================================================
   NumberField — controlled number input that defers commit
   until blur or Enter. Prevents losing intermediate digits on
   mobile keyboards (iOS Safari, Gboard) where each keystroke
   re-renders the parent and the cursor jumps out of the field.

   Usage:
   <NumberField
     value={profile.age}
     onCommit={(v) => setProfile(p => ({ ...p, age: v }))}
     min={1} max={120}
   />
   ================================================================ */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface NumberFieldProps {
  value: number | null | undefined;
  onCommit: (next: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  minLength?: number;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowEmpty?: boolean;
  emptyValue?: number | null;
  /** When true, commits null on empty rather than falling back to min */
  nullable?: boolean;
}

export function NumberField({
  value,
  onCommit,
  min,
  max,
  step = 1,
  minLength,
  placeholder,
  disabled,
  className,
  allowEmpty = false,
  emptyValue,
  nullable = false,
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string>(formatValue(value));
  const lastExternal = useRef<number | null | undefined>(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value changes (e.g. after API refetch) without nuking user typing.
  // Only re-sync when the external value actually differs from what we last saw.
  useEffect(() => {
    if (value === lastExternal.current) return;
    if (document.activeElement === inputRef.current) {
      // User is currently editing — don't stomp their draft
      lastExternal.current = value;
      return;
    }
    setDraft(formatValue(value));
    lastExternal.current = value;
  }, [value]);

  const commit = () => {
    if (draft === "" || draft === "-") {
      if (allowEmpty) onCommit(nullable ? null : (emptyValue ?? null));
      return;
    }
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      // Restore from external on invalid input
      setDraft(formatValue(value));
      return;
    }
    let clamped = parsed;
    if (typeof min === "number" && clamped < min) clamped = min;
    if (typeof max === "number" && clamped > max) clamped = max;
    if (clamped !== value) onCommit(clamped);
    setDraft(formatValue(clamped));
  };

  return (
    <input
      ref={inputRef}
      type="number"
      inputMode="decimal"
      value={draft}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      minLength={minLength}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
      className={cn(
        "w-full min-h-[42px] px-3 text-[16px] tabular-nums",
        "bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl",
        "outline-none focus:border-[var(--color-accent)]/50",
        "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50",
        "transition-colors",
        "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        className
      )}
      style={{ fontSize: "16px" }}
    />
  );
}

function formatValue(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "";
  return String(v);
}
