"use client";

import { useState } from "react";
import {
  Loader2, Utensils, Minus, Plus, X, Copy, Star,
  Flame, Zap, TrendingUp, TrendingDown, Dumbbell, Apple,
} from "lucide-react";
import { Ring } from "./Ring";
import { cn } from "@/lib/utils";

interface LogEntry {
  id: number; food_name: string; amount: number; serving_unit?: string;
  calories: number; protein: number; carbs: number; fat: number;
  meal_type: string; source: string;
}
interface DaySummary { calories: number; protein: number; carbs: number; fat: number; count: number; exercise_calories: number; }
interface FavoriteItem {
  id: number; name: string; calories: number;
  default_weight?: number; default_duration?: number;
  log_count?: number; avg_calories?: number; avg_weight?: number;
}
interface FavoritesData {
  in: FavoriteItem[];
  out: FavoriteItem[];
}
interface SuggestedData {
  in: FavoriteItem[];
  out: FavoriteItem[];
}

const MEALS = [
  { key: "", label: "All" },
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snack" },
];

const QUICK_MEAL_OPTIONS = [
  { key: "breakfast", label: "Brkfst" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snack" },
];

export function DashboardTab({
  summary, goals, loading, mealFilter, setMealFilter,
  filteredLogs, updateWeight, updateLog, deleteLog, copyYesterday,
  exercises, deleteExercise, updateExercise,
  favorites, suggested, quickAddIn, quickAddOut,
  addToFavorites, removeFavorite,
  servingUnits,
  userWeight,
}: {
  summary: DaySummary; goals: {calories:number,protein:number,carbs:number,fat:number};
  loading: boolean; mealFilter: string; setMealFilter: (v:string) => void;
  filteredLogs: LogEntry[]; updateWeight: (id:number,w:number) => void;
  updateLog: (id: number, fields: { amount?: number; serving_unit?: string; calories?: number; protein?: number; carbs?: number; fat?: number }) => void;
  deleteLog: (id:number) => void; copyYesterday: () => void;
  exercises: any[]; deleteExercise: (id:number) => void;
  updateExercise: (id: number, data: { duration_min?: number; calories_burned?: number }) => void;
  favorites: FavoritesData; suggested: SuggestedData;
  quickAddIn: (f: FavoriteItem) => void; quickAddOut: (f: FavoriteItem) => void;
  addToFavorites: (type: 'in'|'out', name: string, calories?: number, default_weight?: number, default_duration?: number, serving_unit?: string) => void;
  removeFavorite: (type: 'in'|'out', id: number) => void;
  servingUnits?: string[];
  userWeight?: number;
}) {
  const [favTab, setFavTab] = useState<'in'|'out'>('in');

  const calInPct = goals.calories > 0 ? Math.min(100, (summary.calories / goals.calories) * 100) : 0;
  const netCal = summary.calories - summary.exercise_calories;
  const netPct = goals.calories > 0 ? (netCal / goals.calories) * 100 : 0;
  const netStatus = netCal > goals.calories ? "over" : netCal < 0 ? "under" : "good";

  /* ==============================
     Quick Add Favorites renderer
     ============================== */
  const renderFavChips = (
    items: FavoriteItem[],
    type: 'in'|'out',
    curated: boolean,
    onQuickAdd: (f: FavoriteItem) => void,
  ) => {
    if (items.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1.5">
        {items.map((f, i) => (
          <div key={`${type}-${curated ? 'c' : 's'}-${i}`} className="group relative">
            <button
              onClick={() => onQuickAdd(f)}
              title={f.name}
              className={cn(
                "px-2.5 py-1.5 text-[12px] rounded-full border transition-all flex items-center gap-1.5",
                curated
                  ? "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/8 hover:bg-[var(--color-accent)]/15 hover:border-[var(--color-accent)]/60 text-[var(--color-accent)]"
                  : "border-dashed border-[var(--color-border)] bg-[var(--color-surface-elevated)]/20 hover:bg-[var(--color-surface-elevated)]/40 hover:border-[var(--color-text-muted)]/40 text-[var(--color-text-secondary)]"
              )}
            >
              <span className="max-w-[160px] truncate">{f.name}</span>
            </button>
            {curated ? (
              <button
                onClick={(e) => { e.stopPropagation(); removeFavorite(type, f.id); }}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={10} />
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addToFavorites(
                    type,
                    f.name,
                    type === 'in' ? (f.avg_calories || f.calories || 0) : (f.avg_calories || f.calories || 0),
                    type === 'in' ? (f.default_weight || f.avg_weight || 100) : undefined,
                    type === 'out' ? (f.default_duration || 30) : undefined,
                    type === 'in' ? (f.default_unit || 'g') : undefined,
                  );
                }}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--color-accent)]/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="Pin to favorites"
              >
                <Star size={9} />
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-2 md:pb-0">
      {/* ============================================
          Dual Calories Cards — modern card layout
          ============================================ */}
      <div className="grid grid-cols-2 gap-3">
        {/* Calories In */}
        <div className="relative overflow-hidden rounded-xl border border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-orange-500/[0.02] p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
              <Utensils size={15} className="text-orange-400" />
            </div>
            <div>
              <div className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Calories In</div>
              <div className="text-[22px] font-bold text-orange-400 tabular-nums leading-tight">
                {Math.round(summary.calories)}
                <span className="text-[11px] font-normal text-[var(--color-text-muted)] ml-1">/ {goals.calories}</span>
              </div>
            </div>
          </div>
          <div className="w-full bg-[var(--color-border)]/20 rounded-full h-1.5">
            <div className={cn("h-full rounded-full transition-all duration-500", calInPct >= 100 ? "bg-red-400" : "bg-orange-400")}
              style={{ width: `${Math.min(100, calInPct)}%` }} />
          </div>
          <div className="mt-1.5 text-[10px] text-[var(--color-text-muted)] tabular-nums">
            {Math.round(calInPct)}% of daily goal
          </div>
        </div>

        {/* Calories Out */}
        <div className="relative overflow-hidden rounded-xl border border-green-500/20 bg-gradient-to-br from-green-500/5 to-green-500/[0.02] p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center">
              <Zap size={15} className="text-green-400" />
            </div>
            <div>
              <div className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Calories Out</div>
              <div className="text-[22px] font-bold text-green-400 tabular-nums leading-tight">
                {Math.round(summary.exercise_calories)}
                <span className="text-[11px] font-normal text-[var(--color-text-muted)] ml-1">kcal</span>
              </div>
            </div>
          </div>
          <div className="w-full bg-[var(--color-border)]/20 rounded-full h-1.5">
            <div className="h-full rounded-full bg-green-400 transition-all duration-500"
              style={{ width: `${Math.min(100, summary.calories > 0 ? (summary.exercise_calories / summary.calories) * 100 : 0)}%` }} />
          </div>
          <div className="mt-1.5 text-[10px] text-[var(--color-text-muted)] tabular-nums">
            {summary.exercise_calories > 0 ? `${Math.round((summary.exercise_calories / Math.max(1, summary.calories)) * 100)}% of intake` : 'No exercise logged'}
          </div>
        </div>
      </div>

      {/* Net Calories — compact pill */}
      <div className={cn(
        "px-4 py-2.5 rounded-xl border flex items-center justify-between gap-3",
        netStatus === "over" && "border-red-500/25 bg-red-500/5",
        netStatus === "under" && "border-blue-500/25 bg-blue-500/5",
        netStatus === "good" && "border-green-500/25 bg-green-500/5",
      )}>
        <div className="flex items-center gap-2">
          {netStatus === "over" && <TrendingUp size={15} className="text-red-400" />}
          {netStatus === "under" && <TrendingDown size={15} className="text-blue-400" />}
          {netStatus === "good" && <Flame size={15} className="text-green-400" />}
          <span className="text-[12px] font-medium text-[var(--color-text-secondary)]">Net Calories</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn("text-[15px] font-bold tabular-nums",
            netStatus === "over" && "text-red-400",
            netStatus === "under" && "text-blue-400",
            netStatus === "good" && "text-green-400",
          )}>
            {Math.round(netCal)} kcal
          </span>
          <span className="text-[11px] text-[var(--color-text-muted)] tabular-nums bg-[var(--color-surface-elevated)]/50 px-2 py-0.5 rounded-full">
            {netPct > 0 ? `${Math.round(netPct)}%` : '0%'}
          </span>
        </div>
      </div>

      {/* ============================================
          Quick Add Favorites — In + Out tabs
          ============================================ */}
      <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
        {/* Tab header */}
        <div className="flex border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]/10">
          <button
            onClick={() => setFavTab('in')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-medium transition-colors",
              favTab === 'in'
                ? "text-orange-400 border-b-2 border-orange-400 bg-orange-500/5"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            )}
          >
            <Utensils size={13} />
            Calories In
          </button>
          <button
            onClick={() => setFavTab('out')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-medium transition-colors",
              favTab === 'out'
                ? "text-green-400 border-b-2 border-green-400 bg-green-500/5"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            )}
          >
            <Dumbbell size={13} />
            Calories Out
          </button>
        </div>

        {/* Tab content */}
        <div className="p-3 space-y-3">
          {favTab === 'in' ? (
            <>
              {/* Curated In favorites */}
              {favorites.in.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Star size={10} className="text-[var(--color-accent)]" /> Favorites
                  </div>
                  {renderFavChips(favorites.in, 'in', true, quickAddIn)}
                </div>
              )}

              {/* Suggested In (from logs) */}
              {suggested.in.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
                    Suggested
                  </div>
                  {renderFavChips(suggested.in, 'in', false, quickAddIn)}
                </div>
              )}

              {favorites.in.length === 0 && suggested.in.length === 0 && (
                <div className="text-center py-3 text-[12px] text-[var(--color-text-muted)]">
                  <Utensils size={24} className="mx-auto mb-1 opacity-20" />
                  Log some food to see favorites here
                </div>
              )}
            </>
          ) : (
            <>
              {/* Curated Out favorites */}
              {favorites.out.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Star size={10} className="text-[var(--color-accent)]" /> Favorites
                  </div>
                  {renderFavChips(favorites.out, 'out', true, quickAddOut)}
                </div>
              )}

              {/* Suggested Out (from exercise logs) */}
              {suggested.out.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
                    Suggested
                  </div>
                  {renderFavChips(suggested.out, 'out', false, quickAddOut)}
                </div>
              )}

              {favorites.out.length === 0 && suggested.out.length === 0 && (
                <div className="text-center py-3 text-[12px] text-[var(--color-text-muted)]">
                  <Dumbbell size={24} className="mx-auto mb-1 opacity-20" />
                  Log some exercise to see favorites here
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Macro Rings */}
      <div className="grid grid-cols-4 gap-2 max-md:grid-cols-2">
        <Ring value={summary.calories} max={goals.calories} color="#3b82f6" label="Calories" unit="kcal" />
        <Ring value={summary.protein} max={goals.protein} color="#22c55e" label="Protein" unit="g" />
        <Ring value={summary.carbs} max={goals.carbs} color="#eab308" label="Carbs" unit="g" />
        <Ring value={summary.fat} max={goals.fat} color="#f59e0b" label="Fat" unit="g" />
      </div>

      {/* Low protein warning */}
      {goals.calories > 0 && summary.protein < goals.protein * 0.7 && (
        <div className="text-[12px] text-[#f59e0b] px-3 py-2 rounded-xl border border-[#f59e0b]/20 bg-[#f59e0b]/5">
          ⚡ Protein is low today. Consider adding chicken breast, eggs, or tofu.
        </div>
      )}

      {/* Food Log */}
      <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]/20 flex items-center justify-between flex-wrap gap-2">
          <span className="text-[13px] font-semibold text-[var(--color-text-secondary)]">Today's Food Log</span>
          <div className="flex items-center gap-2">
            <button onClick={copyYesterday} className="flex items-center gap-1 text-[11px] text-[var(--color-accent)] hover:underline"><Copy size={12} />Copy Yesterday</button>
            <div className="flex gap-1">
              {MEALS.map(m => (
                <button key={m.key} onClick={() => setMealFilter(m.key)}
                  className={cn("px-2.5 py-1 text-[11px] rounded-full font-medium transition-colors",
                    mealFilter === m.key ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]")}
                >{m.label}</button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 size={20} className="animate-spin text-[var(--color-text-muted)]" /></div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-10 text-[13px] text-[var(--color-text-muted)]">
            <Utensils size={32} className="mx-auto mb-2 opacity-20" />
            No food logged yet. Search or take a photo to start.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-[13px] leading-none">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
                    <th className="text-left py-2 px-4">Food</th>
                    <th className="text-left py-2 px-2">Meal</th>
                    <th className="text-center py-2 px-2">Amount</th>
                    <th className="text-right py-2 px-2">Cal</th>
                    <th className="text-right py-2 px-2">P</th>
                    <th className="text-right py-2 px-2">C</th>
                    <th className="text-right py-2 px-2">F</th>
                    <th className="py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map(entry => (
                    <tr key={entry.id} className="border-b border-[var(--color-border)]/15 hover:bg-[var(--color-surface-elevated)]/20 transition-colors">
                      <td className="py-2 px-4 font-medium">{entry.food_name}</td>
                      <td className="py-2 px-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] capitalize">{entry.meal_type}</span>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center justify-center gap-0.5">
                          <button onClick={() => updateWeight(entry.id, Math.max(1, entry.amount - 10))} className="w-5 h-5 flex items-center justify-center rounded border border-[var(--color-border)] hover:bg-[var(--color-border)]/30 text-[var(--color-text-secondary)]"><Minus size={10} /></button>
                          <input type="number" defaultValue={entry.amount}
                            onBlur={e => { const v = Number(e.target.value); if (v > 0 && v !== entry.amount) updateWeight(entry.id, v); }}
                            className="w-[44px] text-center bg-transparent border border-[var(--color-border)] rounded py-0.5 text-[12px] tabular-nums outline-none"
                            inputMode="decimal"
                            style={{ fontSize: '16px' }} />

                          <button onClick={() => updateWeight(entry.id, entry.amount + 10)} className="w-5 h-5 flex items-center justify-center rounded border border-[var(--color-border)] hover:bg-[var(--color-border)]/30 text-[var(--color-text-secondary)]"><Plus size={10} /></button>
                          <select value={entry.serving_unit || 'g'}
                            onChange={e => updateLog(entry.id, { serving_unit: e.target.value })}
                            className="text-[11px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded px-1 py-0.5 outline-none text-[var(--color-text-muted)] cursor-pointer">
                            {(servingUnits || ["g","ml","份","碗","杯","罐","瓶","個","包","碟"]).map(u => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="text-right py-2 px-1 tabular-nums">
                        <div className="flex items-center justify-end gap-0.5">
                          <button onClick={() => updateLog(entry.id, { calories: Math.max(1, Math.round(entry.calories) - 10) })}
                            className="w-5 h-5 flex items-center justify-center rounded border border-[var(--color-border)] hover:bg-[var(--color-border)]/30 text-[var(--color-text-secondary)]"><Minus size={10} /></button>
                          <input type="number" value={Math.round(entry.calories)}
                            onChange={e => { const v = Number(e.target.value); if (v >= 0) updateLog(entry.id, { calories: v }); }}
                            className="w-[44px] text-center bg-transparent border border-[var(--color-border)] rounded py-0.5 text-[12px] tabular-nums outline-none text-orange-400 font-medium" inputMode="decimal" min="0" style={{ fontSize: '16px' }} />
                          <button onClick={() => updateLog(entry.id, { calories: Math.round(entry.calories) + 10 })}
                            className="w-5 h-5 flex items-center justify-center rounded border border-[var(--color-border)] hover:bg-[var(--color-border)]/30 text-[var(--color-text-secondary)]"><Plus size={10} /></button>
                        </div>
                      </td>
                      <td className="text-right py-2 px-1 tabular-nums">
                        <input type="number" value={Math.round(entry.protein * 10) / 10}
                          onChange={e => { const v = Number(e.target.value); if (v >= 0) updateLog(entry.id, { protein: v }); }}
                          className="w-[38px] text-center bg-transparent border border-[var(--color-border)] rounded py-0.5 text-[12px] tabular-nums outline-none hover:border-[var(--color-accent)]/30 focus:border-[var(--color-accent)]/50" inputMode="decimal" min="0" step="0.1" style={{ fontSize: '16px' }} />
                      </td>
                      <td className="text-right py-2 px-1 tabular-nums">
                        <input type="number" value={Math.round(entry.carbs * 10) / 10}
                          onChange={e => { const v = Number(e.target.value); if (v >= 0) updateLog(entry.id, { carbs: v }); }}
                          className="w-[38px] text-center bg-transparent border border-[var(--color-border)] rounded py-0.5 text-[12px] tabular-nums outline-none hover:border-[var(--color-accent)]/30 focus:border-[var(--color-accent)]/50" inputMode="decimal" min="0" step="0.1" style={{ fontSize: '16px' }} />
                      </td>
                      <td className="text-right py-2 px-1 tabular-nums">
                        <input type="number" value={Math.round(entry.fat * 10) / 10}
                          onChange={e => { const v = Number(e.target.value); if (v >= 0) updateLog(entry.id, { fat: v }); }}
                          className="w-[38px] text-center bg-transparent border border-[var(--color-border)] rounded py-0.5 text-[12px] tabular-nums outline-none hover:border-[var(--color-accent)]/30 focus:border-[var(--color-accent)]/50" inputMode="decimal" min="0" step="0.1" style={{ fontSize: '16px' }} />
                      </td>
                      <td className="py-2 px-2">
                        <button onClick={() => addToFavorites('in', entry.food_name, Math.round(entry.calories), entry.amount, undefined, entry.serving_unit || 'g')}
                          title="Add to Quick Favorites"
                          className="p-1 rounded hover:bg-[var(--color-accent)]/10 text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"><Star size={12} /></button>
                        <button onClick={() => deleteLog(entry.id)} className="p-1 rounded hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-400"><X size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-[var(--color-border)]/10">
              {filteredLogs.map(entry => (
                <div key={entry.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-[var(--color-text-primary)]">{entry.food_name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] capitalize">{entry.meal_type}</span>
                    </div>
                    <button onClick={() => addToFavorites('in', entry.food_name, Math.round(entry.calories), entry.amount, undefined, entry.serving_unit || 'g')}
                      title="Add to Quick Favorites"
                      className="p-2.5 rounded-lg hover:bg-[var(--color-accent)]/10 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] min-w-[44px] min-h-[44px] flex items-center justify-center"><Star size={16} /></button>
                    <button onClick={() => deleteLog(entry.id)} className="p-2.5 rounded-lg hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-400 min-w-[44px] min-h-[44px] flex items-center justify-center"><X size={16} /></button>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateWeight(entry.id, Math.max(1, entry.amount - 10))} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] active:bg-[var(--color-surface-elevated)]"><Minus size={16} /></button>
                      <input type="number" defaultValue={entry.amount}
                        onBlur={e => { const v = Number(e.target.value); if (v > 0 && v !== entry.amount) updateWeight(entry.id, v); }}
                        className="w-[48px] text-center bg-transparent border border-[var(--color-border)] rounded py-2 text-[13px] tabular-nums outline-none"
                        inputMode="decimal"
                        style={{ fontSize: '16px' }} />

                      <button onClick={() => updateWeight(entry.id, entry.amount + 10)} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] active:bg-[var(--color-surface-elevated)]"><Plus size={16} /></button>
                      <select value={entry.serving_unit || 'g'}
                        onChange={e => updateLog(entry.id, { serving_unit: e.target.value })}
                        className="text-[11px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded px-1.5 py-2 outline-none text-[var(--color-text-muted)]">
                        {(servingUnits || ["g","ml","份","碗","杯","罐","瓶","個","包","碟"]).map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2 text-[12px] tabular-nums ml-auto items-center flex-wrap">
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => updateLog(entry.id, { calories: Math.max(1, Math.round(entry.calories) - 10) })}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] active:bg-[var(--color-surface-elevated)]"><Minus size={16} /></button>
                        <input type="number" value={Math.round(entry.calories)}
                          onChange={e => { const v = Number(e.target.value); if (v >= 0) updateLog(entry.id, { calories: v }); }}
                          className="w-[44px] text-center bg-transparent border border-[var(--color-border)] rounded py-2 text-[12px] tabular-nums outline-none text-orange-400 font-semibold" inputMode="decimal" min="0" style={{ fontSize: '16px' }} />
                        <button onClick={() => updateLog(entry.id, { calories: Math.round(entry.calories) + 10 })}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] active:bg-[var(--color-surface-elevated)]"><Plus size={16} /></button>
                        <span className="text-[10px] text-[var(--color-text-muted)]">kcal</span>
                      </div>
                      <span className="text-[var(--color-text-muted)]">P:</span>
                      <input type="number" value={Math.round(entry.protein * 10) / 10}
                        onChange={e => { const v = Number(e.target.value); if (v >= 0) updateLog(entry.id, { protein: v }); }}
                        className="w-[36px] text-center bg-transparent border border-[var(--color-border)] rounded py-2 text-[12px] tabular-nums outline-none" inputMode="decimal" min="0" step="0.1" style={{ fontSize: '16px' }} />
                      <span className="text-[var(--color-text-muted)]">C:</span>
                      <input type="number" value={Math.round(entry.carbs * 10) / 10}
                        onChange={e => { const v = Number(e.target.value); if (v >= 0) updateLog(entry.id, { carbs: v }); }}
                        className="w-[36px] text-center bg-transparent border border-[var(--color-border)] rounded py-2 text-[12px] tabular-nums outline-none" inputMode="decimal" min="0" step="0.1" style={{ fontSize: '16px' }} />
                      <span className="text-[var(--color-text-muted)]">F:</span>
                      <input type="number" value={Math.round(entry.fat * 10) / 10}
                        onChange={e => { const v = Number(e.target.value); if (v >= 0) updateLog(entry.id, { fat: v }); }}
                        className="w-[36px] text-center bg-transparent border border-[var(--color-border)] rounded py-2 text-[12px] tabular-nums outline-none" inputMode="decimal" min="0" step="0.1" style={{ fontSize: '16px' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Exercise Section — editable duration + calories */}
      {exercises.length > 0 && (
        <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]/20 flex items-center gap-2">
            <Dumbbell size={14} className="text-green-400" />
            <span className="text-[13px] font-semibold text-[var(--color-text-secondary)]">Today's Exercise</span>
            {summary.exercise_calories > 0 && (
              <span className="ml-auto text-[12px] text-green-400 tabular-nums font-medium">{Math.round(summary.exercise_calories)} kcal burned</span>
            )}
          </div>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-[13px] leading-none">
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
                  <tr key={ex.id} className="border-b border-[var(--color-border)]/15 hover:bg-[var(--color-surface-elevated)]/20 transition-colors">
                    <td className="py-2 px-4 font-medium">{ex.exercise_name}</td>
                    <td className="py-2 px-2">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => updateExercise(ex.id, { duration_min: Math.max(1, ex.duration_min - 5) })}
                          className="w-6 h-6 flex items-center justify-center rounded border border-[var(--color-border)] hover:bg-[var(--color-border)]/30 text-[var(--color-text-secondary)]"><Minus size={12} /></button>
                        <input type="number" value={ex.duration_min}
                          onChange={e => { const v = Number(e.target.value); if (v > 0) updateExercise(ex.id, { duration_min: v }); }}
                          className="w-[42px] text-center bg-transparent border border-[var(--color-border)] rounded py-0.5 text-[12px] tabular-nums outline-none" inputMode="decimal" min="1" style={{ fontSize: '16px' }} />
                        <button onClick={() => updateExercise(ex.id, { duration_min: ex.duration_min + 5 })}
                          className="w-6 h-6 flex items-center justify-center rounded border border-[var(--color-border)] hover:bg-[var(--color-border)]/30 text-[var(--color-text-secondary)]"><Plus size={12} /></button>
                        <span className="text-[10px] text-[var(--color-text-muted)] ml-0.5">min</span>
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => updateExercise(ex.id, { calories_burned: Math.max(1, Math.round(Number(ex.calories_burned)) - 10) })}
                          className="w-6 h-6 flex items-center justify-center rounded border border-[var(--color-border)] hover:bg-[var(--color-border)]/30 text-[var(--color-text-secondary)]"><Minus size={12} /></button>
                        <input type="number" value={Math.round(Number(ex.calories_burned))}
                          onChange={e => { const v = Number(e.target.value); if (v > 0) updateExercise(ex.id, { calories_burned: v }); }}
                          className="w-[48px] text-center bg-transparent border border-[var(--color-border)] rounded py-0.5 text-[12px] tabular-nums outline-none text-green-400 font-medium" inputMode="decimal" min="1" style={{ fontSize: '16px' }} />
                        <button onClick={() => updateExercise(ex.id, { calories_burned: Math.round(Number(ex.calories_burned)) + 10 })}
                          className="w-6 h-6 flex items-center justify-center rounded border border-[var(--color-border)] hover:bg-[var(--color-border)]/30 text-[var(--color-text-secondary)]"><Plus size={12} /></button>
                        <span className="text-[10px] text-[var(--color-text-muted)] ml-0.5">kcal</span>
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <button onClick={() => deleteExercise(ex.id)} className="p-1 rounded hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-400"><X size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-[var(--color-border)]/10">
            {exercises.map((ex: any) => (
              <div key={ex.id} className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-[var(--color-text-primary)]">{ex.exercise_name}</span>
                  <button onClick={() => deleteExercise(ex.id)} className="p-1 rounded hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-400"><X size={14} /></button>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Duration */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-[var(--color-text-muted)]">Dur</span>
                    <button onClick={() => updateExercise(ex.id, { duration_min: Math.max(1, ex.duration_min - 5) })}
                      className="w-7 h-7 flex items-center justify-center rounded border border-[var(--color-border)] text-[var(--color-text-muted)]"><Minus size={14} /></button>
                    <input type="number" value={ex.duration_min}
                      onChange={e => { const v = Number(e.target.value); if (v > 0) updateExercise(ex.id, { duration_min: v }); }}
                      className="w-[42px] text-center bg-transparent border border-[var(--color-border)] rounded py-1 text-[13px] tabular-nums outline-none" inputMode="decimal" min="1" style={{ fontSize: '16px' }} />
                    <span className="text-[11px] text-[var(--color-text-muted)]">min</span>
                    <button onClick={() => updateExercise(ex.id, { duration_min: ex.duration_min + 5 })}
                      className="w-7 h-7 flex items-center justify-center rounded border border-[var(--color-border)] text-[var(--color-text-muted)]"><Plus size={14} /></button>
                  </div>
                  {/* Calories */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-[var(--color-text-muted)]">Cal</span>
                    <button onClick={() => updateExercise(ex.id, { calories_burned: Math.max(1, Math.round(Number(ex.calories_burned)) - 10) })}
                      className="w-7 h-7 flex items-center justify-center rounded border border-[var(--color-border)] text-[var(--color-text-muted)]"><Minus size={14} /></button>
                    <input type="number" value={Math.round(Number(ex.calories_burned))}
                      onChange={e => { const v = Number(e.target.value); if (v > 0) updateExercise(ex.id, { calories_burned: v }); }}
                      className="w-[52px] text-center bg-transparent border border-[var(--color-border)] rounded py-1 text-[13px] tabular-nums outline-none text-green-400 font-medium" inputMode="decimal" min="1" style={{ fontSize: '16px' }} />
                    <span className="text-[11px] text-[var(--color-text-muted)]">kcal</span>
                    <button onClick={() => updateExercise(ex.id, { calories_burned: Math.round(Number(ex.calories_burned)) + 10 })}
                      className="w-7 h-7 flex items-center justify-center rounded border border-[var(--color-border)] text-[var(--color-text-muted)]"><Plus size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mobile spacer — prevents BottomNav from covering last content */}
      <div className="md:hidden h-28" />
    </div>
  );
}
