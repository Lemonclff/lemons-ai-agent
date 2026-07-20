"use client";

import { X, TrendingUp, Dumbbell, Flame, Clock, Plus } from "lucide-react";
import { NumberField } from "./NumberField";

export function CaloriesOutTab({
  summary, exercises, exName, setExName, exDuration, setExDuration,
  exCalories, setExCalories,
  addExercise, deleteExercise,
}: {
  summary: { exercise_calories: number; calories: number };
  exercises: any[]; exName: string; setExName: (v:string) => void;
  exDuration: number; setExDuration: (v:number) => void;
  exCalories: string; setExCalories: (v:string) => void;
  addExercise: () => void; deleteExercise: (id:number) => void;
}) {
  const totalBurned = exercises.reduce((s: number, e: any) => s + (Number(e.calories_burned)||0), 0);

  const handleAdd = () => {
    if (!exName.trim()) return;
    addExercise();
  };

  const burnPct = summary.calories > 0 ? Math.min(100, (totalBurned / summary.calories) * 100) : 0;

  return (
    <div className="nutri-stagger space-y-3 max-w-[640px]">

      {/* ═══ Stats Banner ═══ */}
      <div className="relative overflow-hidden rounded-3xl nutri-card-out p-5">
        <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-green-400/10 blur-2xl pointer-events-none" />
        <div className="relative flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-2xl bg-green-500/20 flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.25)]">
            <Flame size={22} className="text-green-400" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-[var(--color-text-primary)]">Calories Burned</h3>
            <p className="text-[11px] text-[var(--color-text-muted)]">{exercises.length} activities today</p>
          </div>
        </div>
        <div className="relative flex items-end gap-2">
          <span className="text-[40px] font-bold text-green-400 nutri-num leading-none">{Math.round(totalBurned)}</span>
          <span className="text-[13px] text-[var(--color-text-muted)] pb-1.5">kcal</span>
          {summary.calories > 0 && totalBurned > 0 && (
            <span className="text-[12px] text-[var(--color-text-muted)] pb-1.5 ml-auto">{Math.round(burnPct)}% of intake</span>
          )}
        </div>
        <div className="relative mt-3 h-2 rounded-full bg-[var(--color-border)]/30 overflow-hidden">
          <div
            className="h-full rounded-full nutri-bar-fill bg-gradient-to-r from-emerald-400 to-green-500"
            style={{ width: `${burnPct}%` }}
          />
        </div>
      </div>

      {/* ═══ Log Exercise Form ═══ */}
      <div className="rounded-2xl border border-[var(--color-border)]/50 overflow-hidden bg-[var(--color-surface-elevated)]/20">
        <div className="px-4 py-3 border-b border-[var(--color-border)]/50">
          <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-green-500/15 flex items-center justify-center">
              <Plus size={14} className="text-green-400" />
            </div>
            Log Exercise
          </h3>
        </div>
        <div className="p-4">
          <div className="flex items-end gap-2 max-md:flex-wrap">
            <div className="flex-1 min-w-[120px]">
              <label className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1.5">Exercise</label>
              <input value={exName} onChange={e => setExName(e.target.value)}
                placeholder="Running, Walking, Yoga..."
                className="w-full px-4 py-3 text-[16px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl outline-none focus:border-green-500/50 transition-colors"
                onKeyDown={e => e.key === "Enter" && handleAdd()} autoFocus />
            </div>
            <div className="w-[100px] max-md:flex-1">
              <label className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1.5">Duration</label>
              <div className="flex items-center gap-1">
              <NumberField value={exDuration} onCommit={v => { setExDuration(v ?? 1); }}
                  min={1} className="w-full text-center py-3 font-semibold tabular-nums" />
                <span className="text-[11px] text-[var(--color-text-muted)] shrink-0">min</span>
              </div>
            </div>
            <div className="w-[90px] max-md:flex-1">
              <label className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1.5">Calories</label>
              <NumberField value={exCalories ? Number(exCalories) : null} onCommit={v => setExCalories(v?.toString() ?? "")}
                  placeholder="Auto" nullable allowEmpty className="w-full text-center py-3 font-semibold tabular-nums" />
            </div>
            <button onClick={handleAdd} disabled={!exName.trim()}
              className="min-h-[48px] px-6 text-[14px] font-semibold rounded-xl bg-green-500 text-white hover:bg-green-400 disabled:opacity-30 transition-all active:scale-95 shrink-0 max-md:w-full">
              Add
            </button>
          </div>
        </div>
      </div>

      {/* ═══ Exercise List ═══ */}
      {exercises.length > 0 && (
        <div className="rounded-2xl border border-[var(--color-border)]/50 overflow-hidden bg-[var(--color-surface-elevated)]/20">
          <div className="px-4 py-3 border-b border-[var(--color-border)]/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-green-500/15 flex items-center justify-center">
                <Dumbbell size={13} className="text-green-400" />
              </div>
              <span className="text-[14px] font-semibold text-[var(--color-text-primary)]">Today's Exercise</span>
            </div>
            <span className="text-[13px] font-bold text-green-400 tabular-nums">{Math.round(totalBurned)} kcal</span>
          </div>
          <div className="divide-y divide-[var(--color-border)]/10">
            {exercises.map((ex: any) => (
              <div key={ex.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-surface-elevated)]/20 transition-colors group">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                  <Flame size={14} className="text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[var(--color-text-primary)] truncate">{ex.exercise_name}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1">
                    <Clock size={10} /> {ex.duration_min} min
                  </p>
                </div>
                <span className="text-[14px] font-semibold text-green-400 tabular-nums">{Math.round(ex.calories_burned)} kcal</span>
                <button onClick={() => deleteExercise(ex.id)}
                  className="opacity-0 group-hover:opacity-100 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-400 transition-all">
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {exercises.length === 0 && (
        <div className="text-center py-12 text-[13px] text-[var(--color-text-muted)] rounded-2xl border border-dashed border-[var(--color-border)]/50">
          <TrendingUp size={36} className="mx-auto mb-2 opacity-15" />
          <p>No exercise logged today</p>
          <p className="text-[11px] mt-1">Enter an exercise name and duration above</p>
        </div>
      )}
    </div>
  );
}
