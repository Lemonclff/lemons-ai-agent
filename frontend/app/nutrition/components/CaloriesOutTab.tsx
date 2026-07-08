"use client";

import { X, TrendingUp } from "lucide-react";

export function CaloriesOutTab({
  summary, exercises, exName, setExName, exDuration, setExDuration,
  exDropdown, setExDropdown, exList, exSearch, setExSearch,
  exCustom, setExCustom, exCustomName, setExCustomName, exCustomCal, setExCustomCal,
  addExercise, deleteExercise,
}: {
  summary: { exercise_calories: number; calories: number };
  exercises: any[]; exName: string; setExName: (v:string) => void;
  exDuration: number; setExDuration: (v:number) => void;
  exDropdown: boolean; setExDropdown: (v:boolean) => void;
  exList: {name:string,met:number,category:string}[];
  exSearch: string; setExSearch: (v:string) => void;
  exCustom: boolean; setExCustom: (v:boolean) => void;
  exCustomName: string; setExCustomName: (v:string) => void;
  exCustomCal: string; setExCustomCal: (v:string) => void;
  addExercise: () => void; deleteExercise: (id:number) => void;
}) {
  const totalBurned = exercises.reduce((s: number, e: any) => s + (Number(e.calories_burned)||0), 0);

  return (
    <div className="grid gap-4 max-w-[640px]">
      {/* Stats card */}
      <div className="border border-[var(--color-border)] rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={18} className="text-green-400" />
          <h3 className="text-[13px] font-semibold text-[var(--color-text-secondary)]">Calories Out</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/10 text-center">
            <div className="text-[28px] font-bold text-green-400 tabular-nums">{Math.round(totalBurned)}</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">kcal burned today</div>
          </div>
          <div className="p-3 rounded-lg bg-[var(--color-surface-elevated)]/20 border border-[var(--color-border)]/20 text-center">
            <div className="text-[28px] font-bold text-[var(--color-text-primary)] tabular-nums">{exercises.length}</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">activities logged</div>
          </div>
        </div>
        {summary.calories > 0 && totalBurned > 0 && (
          <div className="mt-3 text-[11px] text-[var(--color-text-muted)] text-center">
            Burned {Math.round((totalBurned / summary.calories) * 100)}% of calories consumed
          </div>
        )}
      </div>

      {/* Add exercise */}
      <div className="border border-[var(--color-border)] rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-semibold text-[var(--color-text-secondary)]">Log Exercise</h3>
          <button onClick={() => setExCustom(!exCustom)}
            className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${exCustom ? "border-[var(--color-accent)]/40 text-[var(--color-accent)] bg-[var(--color-accent)]/5" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
            {exCustom ? "Custom" : "Template"}
          </button>
        </div>

        {exCustom ? (
          /* Custom mode */
          <div className="flex items-center gap-2 flex-wrap">
            <input value={exCustomName} onChange={e => setExCustomName(e.target.value)}
              placeholder="Exercise name" className="flex-1 min-w-[120px] px-3 py-1.5 text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none" />
            <input type="number" value={exCustomCal} onChange={e => setExCustomCal(e.target.value)}
              placeholder="kcal" className="w-[80px] text-center text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded px-1 py-1.5 outline-none tabular-nums" />
            <span className="text-[11px] text-[var(--color-text-muted)]">kcal</span>
            <button onClick={addExercise} disabled={!exCustomName || !exCustomCal}
              className="px-3 py-1.5 text-[13px] font-medium rounded-lg bg-green-600 text-white hover:bg-green-500 disabled:opacity-40">Add</button>
          </div>
        ) : (
          /* Template mode — search + duration */
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[160px]">
              <input value={exSearch || exName} onChange={e => { setExSearch(e.target.value); setExName(""); setExDropdown(true); }}
                onFocus={() => setExDropdown(true)}
                placeholder="Search exercise..." className="w-full px-3 py-1.5 text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none" />
              {exDropdown && (<>
                <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
                  {exList.filter(e => !exSearch || e.name.toLowerCase().includes(exSearch.toLowerCase())).map(e => (
                    <button key={e.name} onClick={() => { setExName(e.name); setExSearch(""); setExDropdown(false); }}
                      onMouseDown={e => e.preventDefault()}
                      className="w-full text-left px-3 py-2 text-[12px] hover:bg-[var(--color-surface)]/50 border-b border-[var(--color-border)]/10 last:border-0">
                      <span className="font-medium">{e.name}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)] ml-2">{e.category} · MET {e.met}</span>
                    </button>
                  ))}
                </div>
              </>)}
            </div>
            <input type="number" value={exDuration} onChange={e => setExDuration(Number(e.target.value)||1)} min={1}
              className="w-[60px] text-center text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded px-1 py-1.5 outline-none tabular-nums" />
            <span className="text-[11px] text-[var(--color-text-muted)]">min</span>
            <button onClick={addExercise} disabled={!exName}
              className="px-3 py-1.5 text-[13px] font-medium rounded-lg bg-green-600 text-white hover:bg-green-500 disabled:opacity-40">Add</button>
          </div>
        )}
      </div>

      {/* Exercise list */}
      {exercises.length > 0 && (
        <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]/20">
            <span className="text-[13px] font-semibold text-[var(--color-text-secondary)]">Today's Exercise</span>
            <span className="ml-2 text-[12px] text-green-400 tabular-nums">{Math.round(totalBurned)} kcal burned</span>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
                <th className="text-left py-2 px-4">Exercise</th>
                <th className="text-center py-2 px-2">Duration</th>
                <th className="text-right py-2 px-2">Calories</th>
                <th className="py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {exercises.map((ex: any) => (
                <tr key={ex.id} className="border-b border-[var(--color-border)]/15 hover:bg-[var(--color-surface-elevated)]/20 transition-colors group">
                  <td className="py-2 px-4 font-medium">{ex.exercise_name}</td>
                  <td className="py-2 px-2 text-center tabular-nums">{ex.duration_min} min</td>
                  <td className="py-2 px-2 text-right tabular-nums text-green-400 font-medium">{Math.round(ex.calories_burned)}</td>
                  <td className="py-2 px-2">
                    <button onClick={() => deleteExercise(ex.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-400 transition-all"><X size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {exercises.length === 0 && (
        <div className="text-center py-10 text-[13px] text-[var(--color-text-muted)] border border-[var(--color-border)] rounded-lg">
          <TrendingUp size={32} className="mx-auto mb-2 opacity-20" />
          No exercise logged today. Search and add above.
        </div>
      )}
    </div>
  );
}
