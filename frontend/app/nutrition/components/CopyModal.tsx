"use client";

import { useState, useEffect } from "react";
import {
  Calendar, X, Check, Loader2, Copy,
  UtensilsCrossed, Dumbbell, ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyItem {
  food_name?: string;
  exercise_name?: string;
  meal_type?: string;
  calories: number;
  duration_min?: number;
  calories_burned?: number;
}

interface CopyModalProps {
  open: boolean;
  onClose: () => void;
  copySourceDate: string;
  setCopySourceDate: (d: string) => void;
  copyFood: boolean;
  setCopyFood: (v: boolean) => void;
  copyExercise: boolean;
  setCopyExercise: (v: boolean) => void;
  previewItems: { foods: CopyItem[]; exercises: CopyItem[] };
  previewLoaded: boolean;
  selectedFoods: Set<string>;
  setSelectedFoods: (s: Set<string>) => void;
  selectedExercises: Set<string>;
  setSelectedExercises: (s: Set<string>) => void;
  copying: boolean;
  onCopy: () => void;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CopyModal({
  open, onClose,
  copySourceDate, setCopySourceDate,
  copyFood, setCopyFood,
  copyExercise, setCopyExercise,
  previewItems, previewLoaded,
  selectedFoods, setSelectedFoods,
  selectedExercises, setSelectedExercises,
  copying, onCopy,
}: CopyModalProps) {
  const [mounted, setMounted] = useState(false);
  const today = todayStr();

  useEffect(() => {
    if (open) setMounted(true);
    else {
      const t = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!mounted && !open) return null;

  const total = selectedFoods.size + selectedExercises.size;

  const dateDisplay = () => {
    const d = new Date(copySourceDate + "T12:00:00");
    const t = new Date();
    if (copySourceDate === todayStr()) return "Today";
    const y = new Date(t); y.setDate(y.getDate() - 1);
    if (copySourceDate === `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const changeDate = (delta: number) => {
    const d = new Date(copySourceDate + "T12:00:00");
    d.setDate(d.getDate() + delta);
    const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (s <= today) setCopySourceDate(s);
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex flex-col justify-end md:items-center md:justify-center",
        open ? "" : "pointer-events-none"
      )}
      role="dialog"
      aria-modal="true"
    >
      {/* Scrim */}
      <div
        className={cn(
          "absolute inset-0 transition-all duration-[400ms]",
          open ? "bg-black/50 backdrop-blur-sm" : "bg-transparent backdrop-blur-none"
        )}
        style={{ transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)" }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className={cn(
          "relative w-full md:max-w-sm transition-all duration-[500ms] overflow-hidden",
          "bg-[var(--color-surface)] md:rounded-2xl md:border md:border-[var(--color-border)] md:shadow-xl",
          open
            ? "translate-y-0 opacity-100"
            : "translate-y-[20px] opacity-0"
        )}
        style={{
          borderTopLeftRadius: "1.5rem",
          borderTopRightRadius: "1.5rem",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {/* Drag handle (mobile) */}
        <div className="md:hidden flex justify-center pt-3 pb-1" aria-hidden="true">
          <span className="w-10 h-1 rounded-full bg-[var(--color-border-strong)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-0 md:pt-4">
          <h2 className="text-[17px] font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <Calendar size={18} className="text-[var(--color-accent)]" />
            Copy From
          </h2>
          <button onClick={onClose}
            className="p-2 -mr-1 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] transition-colors active:scale-[0.92]">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto overscroll-contain">
          {/* ── Date Picker — iOS inline pill ── */}
          <div>
            <label className="block text-[12px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
              Source Date
            </label>
            <div className="flex items-center gap-2 relative">
              <button onClick={() => changeDate(-1)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[var(--color-surface-elevated)]/60 border border-[var(--color-border)]/40 text-[var(--color-text-muted)] active:scale-[0.92] transition-all">
                <ChevronLeft size={18} />
              </button>
              <div className="flex-1 text-center">
                <span className="text-[15px] font-semibold text-[var(--color-text-primary)] tabular-nums">{dateDisplay()}</span>
              </div>
              <button onClick={() => changeDate(1)} disabled={copySourceDate >= today}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[var(--color-surface-elevated)]/60 border border-[var(--color-border)]/40 text-[var(--color-text-muted)] active:scale-[0.92] transition-all disabled:opacity-20">
                <ChevronRight size={18} />
              </button>
              <input type="date" value={copySourceDate}
                onChange={e => setCopySourceDate(e.target.value)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
            </div>
          </div>

          {/* ── Type Toggles — pill buttons ── */}
          <div>
            <label className="block text-[12px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
              Copy What
            </label>
            <div className="flex gap-2.5">
              <button onClick={() => setCopyFood(!copyFood)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all duration-[400ms] min-h-[48px] active:scale-[0.96]",
                  copyFood
                    ? "border-orange-400/50 bg-orange-400/10 text-orange-400"
                    : "border-[var(--color-border)]/40 bg-[var(--color-surface-elevated)]/30 text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]"
                )}
                style={{ transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)" }}>
                <UtensilsCrossed size={16} strokeWidth={copyFood ? 2.5 : 1.75} />
                <span className="text-[13px] font-semibold">Food</span>
                <span className={cn(
                  "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0",
                  copyFood ? "border-orange-400 bg-orange-400 text-white" : "border-[var(--color-border-strong)]"
                )}>
                  {copyFood && <Check size={12} strokeWidth={3} />}
                </span>
              </button>
              <button onClick={() => setCopyExercise(!copyExercise)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all duration-[400ms] min-h-[48px] active:scale-[0.96]",
                  copyExercise
                    ? "border-green-400/50 bg-green-400/10 text-green-400"
                    : "border-[var(--color-border)]/40 bg-[var(--color-surface-elevated)]/30 text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]"
                )}
                style={{ transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)" }}>
                <Dumbbell size={16} strokeWidth={copyExercise ? 2.5 : 1.75} />
                <span className="text-[13px] font-semibold">Exercise</span>
                <span className={cn(
                  "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0",
                  copyExercise ? "border-green-400 bg-green-400 text-white" : "border-[var(--color-border-strong)]"
                )}>
                  {copyExercise && <Check size={12} strokeWidth={3} />}
                </span>
              </button>
            </div>
          </div>

          {/* ── Item List ── */}
          {!previewLoaded ? (
            <div className="rounded-xl border border-[var(--color-border)]/30 px-4 py-4">
              <div className="flex items-center gap-2.5 text-[13px] text-[var(--color-text-muted)]">
                <div className="w-5 h-5 rounded-full border-2 border-[var(--color-accent)]/30 border-t-transparent animate-spin" />
                Checking records...
              </div>
            </div>
          ) : previewItems.foods.length === 0 && previewItems.exercises.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border)]/30 px-4 py-6">
              <div className="text-center">
                <Calendar size={24} className="mx-auto mb-2 opacity-30 text-[var(--color-text-muted)]" />
                <p className="text-[13px] text-[var(--color-text-muted)]">No items found for this date</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Food items */}
              {copyFood && previewItems.foods.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-400/10 text-orange-400 text-[11px] font-semibold">
                      <UtensilsCrossed size={12} />
                      Food
                    </div>
                    <span className="text-[11px] text-[var(--color-text-muted)]">
                      {selectedFoods.size}/{previewItems.foods.length}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {previewItems.foods.map((item) => {
                      const key = item.food_name!;
                      const checked = selectedFoods.has(key);
                      return (
                        <button key={key} onClick={() => {
                          const next = new Set(selectedFoods);
                          checked ? next.delete(key) : next.add(key);
                          setSelectedFoods(next);
                        }}
                          className={cn(
                            "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all duration-[300ms] text-left active:scale-[0.98]",
                            checked
                              ? "border-orange-400/30 bg-orange-400/5"
                              : "border-[var(--color-border)]/25 bg-[var(--color-surface-elevated)]/30 hover:border-[var(--color-border)]/50"
                          )}
                          style={{ transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)" }}>
                          <div className={cn(
                            "w-[18px] h-[18px] rounded border-2 flex items-center justify-center shrink-0 transition-all duration-[300ms]",
                            checked ? "border-orange-400 bg-orange-400" : "border-[var(--color-border-strong)]"
                          )}>
                            {checked && <Check size={10} strokeWidth={3} className="text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-medium text-[var(--color-text-primary)] truncate">{item.food_name}</span>
                              <span className="text-[10px] text-[var(--color-text-muted)] capitalize bg-[var(--color-surface)] px-1.5 py-0.5 rounded-md">{item.meal_type}</span>
                            </div>
                          </div>
                          <span className="text-[12px] font-bold tabular-nums text-orange-400 shrink-0">{Math.round(item.calories)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Exercise items */}
              {copyExercise && previewItems.exercises.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-400/10 text-green-400 text-[11px] font-semibold">
                      <Dumbbell size={12} />
                      Exercise
                    </div>
                    <span className="text-[11px] text-[var(--color-text-muted)]">
                      {selectedExercises.size}/{previewItems.exercises.length}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {previewItems.exercises.map((item) => {
                      const key = item.exercise_name!;
                      const checked = selectedExercises.has(key);
                      return (
                        <button key={key} onClick={() => {
                          const next = new Set(selectedExercises);
                          checked ? next.delete(key) : next.add(key);
                          setSelectedExercises(next);
                        }}
                          className={cn(
                            "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all duration-[300ms] text-left active:scale-[0.98]",
                            checked
                              ? "border-green-400/30 bg-green-400/5"
                              : "border-[var(--color-border)]/25 bg-[var(--color-surface-elevated)]/30 hover:border-[var(--color-border)]/50"
                          )}
                          style={{ transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)" }}>
                          <div className={cn(
                            "w-[18px] h-[18px] rounded border-2 flex items-center justify-center shrink-0 transition-all duration-[300ms]",
                            checked ? "border-green-400 bg-green-400" : "border-[var(--color-border-strong)]"
                          )}>
                            {checked && <Check size={10} strokeWidth={3} className="text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-medium text-[var(--color-text-primary)] truncate">{item.exercise_name}</span>
                              <span className="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-surface)] px-1.5 py-0.5 rounded-md">{item.duration_min} min</span>
                            </div>
                          </div>
                          <span className="text-[12px] font-bold tabular-nums text-green-400 shrink-0">{Math.round(item.calories_burned || 0)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Actions ── */}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 px-4 py-3 text-sm font-semibold rounded-xl border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)] transition-all active:scale-[0.97] min-h-[48px]">
              Cancel
            </button>
            <button onClick={onCopy}
              disabled={copying || total === 0}
              className={cn(
                "flex-1 px-4 py-3 text-sm font-semibold rounded-xl text-white transition-all min-h-[48px] flex items-center justify-center gap-2 shadow-glow-sm active:scale-[0.97]",
                "bg-gradient-to-br from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400",
                "disabled:opacity-40 disabled:cursor-not-allowed"
              )}>
              {copying ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Copy size={16} />
              )}
              {copying ? "Copying..." : `Copy ${total}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
