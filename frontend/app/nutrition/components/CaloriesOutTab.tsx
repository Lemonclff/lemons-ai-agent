"use client";

import { X, TrendingUp, Dumbbell, Flame, Clock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

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

  return (
    <div className="space-y-4 max-w-[640px]">
      {/* ═══ Stats Banner ═══ */}
      <div className="rounded-2xl bg-gradient-to-br from-green-500/8 to-emerald-500/3 border border-green-500/15 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center">
            <Flame size={22} className="text-green-400" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-[var(--color-text-primary)]">Calories Burned</h3>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              {exercises.length} activities today
            </p>
          </div>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-[36px] font-bold text-green-400 tabular-nums leading-none">{Math.round(totalBurned)}</span>
          <span className="text-[13px] text-[var(--color-text-muted)] pb-1">kcal</span>
          {summary.calories > 0 && totalBurned > 0 && (
            <span className="text-[12px] text-[var(--color-text-muted)] pb-1 ml-auto">
              {Math.round((totalBurned / summary.calories) * 100)}% of intake
            </span>
          )}
        </div>
      </div>

      {/* ═══ Log Exercise Form ═══ */}
      <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]/20">
          <h3 className="text-[13px] font-semibold text-[var(--color-text-secondary)] flex items-center gap-2">
            <Plus size={15} className="text-green-400" /> Log Exercise
          </h3>
        </div>
        <div className="p-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1.5">Exercise</label>
              <input
                value={exName}
                onChange={e => setExName(e.target.value)}
                placeholder="e.g. Running, Walking, Yoga..."
                className="w-full px-3 py-2.5 text-[14px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl outline-none focus:border-green-500/50 transition-colors"
                onKeyDown={e => e.key === "Enter" && handleAdd()}
                autoFocus
              />
            </div>
            <div className="w-[100px]">
              <label className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1.5">Duration</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={exDuration}
                  onChange={e => setExDuration(Number(e.target.value)||1)}
                  min={1}
                  className="w-full text-center py-2.5 text-[14px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl outline-none focus:border-green-500/50 transition-colors tabular-nums"
                  inputMode="numeric"
                  onKeyDown={e => e.key === "Enter" && handleAdd()}
                />
                <span className="text-[11px] text-[var(--color-text-muted)] shrink-0">min</span>
              </div>
            </div>
            <div className="w-[90px]">
              <label className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1.5">Calories</label>
              <input
                type="number"
                value={exCalories}
                onChange={e => setExCalories(e.target.value)}
                placeholder="Auto"
                className="w-full text-center py-2.5 text-[14px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl outline-none focus:border-green-500/50 transition-colors tabular-nums"
                inputMode="decimal"
                onKeyDown={e => e.key === "Enter" && handleAdd()}
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={!exName.trim()}
              className="px-5 py-2.5 text-[13px] font-semibold rounded-xl bg-green-500 text-white hover:bg-green-400 disabled:opacity-30 transition-all active:scale-[0.97] shrink-0"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* ═══ Exercise List ═══ */}
      {exercises.length > 0 && (
        <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]/20 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[var(--color-text-secondary)] flex items-center gap-2">
              <Dumbbell size={15} /> Today's Exercise
            </span>
            <span className="text-[12px] text-green-400 font-semibold tabular-nums">{Math.round(totalBurned)} kcal</span>
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
                <span className="text-[13px] font-semibold text-green-400 tabular-nums">{Math.round(ex.calories_burned)} kcal</span>
                <button
                  onClick={() => deleteExercise(ex.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-400 transition-all"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {exercises.length === 0 && (
        <div className="text-center py-12 text-[13px] text-[var(--color-text-muted)] rounded-2xl border border-dashed border-[var(--color-border)]">
          <TrendingUp size={36} className="mx-auto mb-2 opacity-15" />
          <p>No exercise logged today</p>
          <p className="text-[11px] mt-1">Enter an exercise name and duration above</p>
        </div>
      )}
    </div>
  );
}
