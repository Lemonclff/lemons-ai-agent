"use client";

import { useState } from "react";
import {
  Loader2, Utensils, Minus, Plus, X, Copy, Star,
  Flame, Zap, Dumbbell,
} from "lucide-react";
import { Ring, CalorieHero, MacroBars } from "./Ring";
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
  serving_calories?: number; serving_protein?: number; serving_carbs?: number; serving_fat?: number;
  serving_unit?: string; default_unit?: string;
}
interface FavoritesData { in: FavoriteItem[]; out: FavoriteItem[]; }
interface SuggestedData { in: FavoriteItem[]; out: FavoriteItem[]; }

const MEALS = [
  { key: "", label: "All" },
  { key: "breakfast", label: "Breakfast" },
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
  const [logTab, setLogTab] = useState<'food'|'exercise'>('food');
  const [favTab, setFavTab] = useState<'in'|'out'>('in');

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
                "px-3 py-1.5 text-[12px] rounded-full border transition-all flex items-center gap-1.5 min-h-[32px] active:scale-95",
                curated
                  ? "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/8 hover:bg-[var(--color-accent)]/15 hover:border-[var(--color-accent)]/60 text-[var(--color-accent)]"
                  : "border-dashed border-[var(--color-border)] bg-[var(--color-surface-elevated)]/20 hover:bg-[var(--color-surface-elevated)]/40 hover:border-[var(--color-text-muted)]/40 text-[var(--color-text-secondary)]"
              )}
            >
              <span className="max-w-[140px] truncate">{f.name}</span>
            </button>
            {curated ? (
              <button
                onClick={(e) => { e.stopPropagation(); removeFavorite(type, f.id); }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              >
                <X size={11} />
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
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--color-accent)]/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                title="Pin to favorites"
              >
                <Star size={10} />
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="nutri-stagger space-y-3 pb-2 md:pb-0">

      {/* ═══ Hero energy ring ═══ */}
      <CalorieHero
        caloriesIn={summary.calories}
        caloriesOut={summary.exercise_calories}
        goal={goals.calories}
      />

      {/* ═══ Quick Add Favorites ═══ */}
      <div className="rounded-2xl border border-[var(--color-border)]/50 overflow-hidden bg-[var(--color-surface-elevated)]/20">
        <div className="flex border-b border-[var(--color-border)]/50">
          <button onClick={() => setFavTab('in')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-3 text-[13px] font-semibold transition-colors",
              favTab === 'in'
                ? "text-orange-400 border-b-2 border-orange-400 bg-orange-500/5"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            )}>
            <Utensils size={14} /> Calories In
          </button>
          <button onClick={() => setFavTab('out')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-3 text-[13px] font-semibold transition-colors",
              favTab === 'out'
                ? "text-green-400 border-b-2 border-green-400 bg-green-500/5"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            )}>
            <Dumbbell size={14} /> Calories Out
          </button>
        </div>
        <div className="p-3 space-y-3">
          {favTab === 'in' ? (
            <>
              {favorites.in.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Star size={10} className="text-[var(--color-accent)]" /> Favorites
                  </div>
                  {renderFavChips(favorites.in, 'in', true, quickAddIn)}
                </div>
              )}
              {suggested.in.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Suggested</div>
                  {renderFavChips(suggested.in, 'in', false, quickAddIn)}
                </div>
              )}
              {favorites.in.length === 0 && suggested.in.length === 0 && (
                <div className="text-center py-4 text-[12px] text-[var(--color-text-muted)]">
                  <Utensils size={24} className="mx-auto mb-1.5 opacity-20" />
                  Log some food to see favorites here
                </div>
              )}
            </>
          ) : (
            <>
              {favorites.out.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Star size={10} className="text-[var(--color-accent)]" /> Favorites
                  </div>
                  {renderFavChips(favorites.out, 'out', true, quickAddOut)}
                </div>
              )}
              {suggested.out.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Suggested</div>
                  {renderFavChips(suggested.out, 'out', false, quickAddOut)}
                </div>
              )}
              {favorites.out.length === 0 && suggested.out.length === 0 && (
                <div className="text-center py-4 text-[12px] text-[var(--color-text-muted)]">
                  <Dumbbell size={24} className="mx-auto mb-1.5 opacity-20" />
                  Log some exercise to see favorites here
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Macro Rings + Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Ring value={summary.calories} max={goals.calories} color="#f97316" label="Calories" unit="kcal" />
          <Ring value={summary.protein} max={goals.protein} color="#38bdf8" label="Protein" unit="g" />
          <Ring value={summary.carbs} max={goals.carbs} color="#fbbf24" label="Carbs" unit="g" />
          <Ring value={summary.fat} max={goals.fat} color="#f472b6" label="Fat" unit="g" />
        </div>
        <div className="lg:col-span-2">
          <MacroBars
            protein={summary.protein}
            carbs={summary.carbs}
            fat={summary.fat}
            goals={goals}
          />
        </div>
      </div>

      {/* Low protein warning */}
      {goals.calories > 0 && summary.protein < goals.protein * 0.7 && (
        <div className="text-[12px] text-amber-400 px-4 py-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 flex items-center gap-2 animate-[fade-up_0.4s_ease]">
          <Zap size={14} className="shrink-0" /> Protein is low today. Try chicken, eggs, or tofu.
        </div>
      )}
      {/* ═══ Mobile: Food + Exercise Tab ═══ */}
      <div className="md:hidden rounded-2xl border border-[var(--color-border)]/50 overflow-hidden bg-[var(--color-surface-elevated)]/20">
        {/* Tab bar */}
        <div className="flex border-b border-[var(--color-border)]/50">
          <button onClick={() => setLogTab("food")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[13px] font-semibold transition-colors ${
              logTab === "food"
                ? "text-orange-400 border-b-2 border-orange-400 bg-orange-500/5"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`}>
            <Utensils size={14} /> Food
            {summary.count > 0 && <span className="text-[10px] text-orange-400/70">({summary.count})</span>}
          </button>
          <button onClick={() => setLogTab("exercise")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[13px] font-semibold transition-colors ${
              logTab === "exercise"
                ? "text-green-400 border-b-2 border-green-400 bg-green-500/5"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`}>
            <Dumbbell size={14} /> Exercise
            {exercises.length > 0 && <span className="text-[10px] text-green-400/70">({exercises.length})</span>}
          </button>
        </div>

        {/* === Food tab content === */}
        {logTab === "food" && (<>
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--color-border)]/10">
            <button onClick={copyYesterday}
              className="flex items-center gap-1 text-[12px] text-[var(--color-accent)] hover:underline min-h-[36px] px-2">
              <Copy size={12} />Copy Yesterday
            </button>
            <div className="flex gap-1 ml-auto">
              {MEALS.map(m => (
                <button key={m.key} onClick={() => setMealFilter(m.key)}
                  className={cn("min-h-[32px] px-2.5 text-[12px] rounded-full font-medium transition-all active:scale-95",
                    mealFilter === m.key ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]")}
                >{m.label}</button>
              ))}
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 size={22} className="animate-spin text-[var(--color-text-muted)]" /></div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-[13px] text-[var(--color-text-muted)]">
              <Utensils size={32} className="mx-auto mb-2 opacity-20" />
              No food logged yet
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]/10">
              {filteredLogs.map(entry => (
                <div key={entry.id} className="px-4 py-3 space-y-2.5">{/* Food name + actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[14px] font-semibold text-[var(--color-text-primary)] truncate">{entry.food_name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] capitalize shrink-0">{entry.meal_type}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => addToFavorites('in', entry.food_name, Math.round(entry.calories), entry.amount, undefined, entry.serving_unit || 'g')}
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-[var(--color-accent)]/10 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] active:scale-95 transition-all">
                        <Star size={16} />
                      </button>
                      <button onClick={() => deleteLog(entry.id)}
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-400 active:scale-95 transition-all">
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)]/50">
                      <button onClick={() => updateWeight(entry.id, Math.max(1, entry.amount - 10))}
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center text-[var(--color-text-muted)] active:bg-[var(--color-surface-elevated)] rounded-l-xl transition-colors">
                        <Minus size={16} />
                      </button>
                      <input type="number" defaultValue={entry.amount}
                        onBlur={e => { const v = Number(e.target.value); if (v > 0 && v !== entry.amount) updateWeight(entry.id, v); }}
                        className="w-[48px] text-center bg-transparent py-2 text-[14px] font-semibold tabular-nums outline-none"
                        inputMode="decimal" style={{ fontSize: '16px' }} />
                      <button onClick={() => updateWeight(entry.id, entry.amount + 10)}
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center text-[var(--color-text-muted)] active:bg-[var(--color-surface-elevated)] rounded-r-xl transition-colors">
                        <Plus size={16} />
                      </button>
                    </div>
                    <select value={entry.serving_unit || 'g'}
                      onChange={e => updateLog(entry.id, { serving_unit: e.target.value })}
                      className="min-h-[40px] px-2 text-[13px] bg-[var(--color-surface)] border border-[var(--color-border)]/50 rounded-xl outline-none text-[var(--color-text-muted)]">
                      {(servingUnits || ["g","ml","份","碗","杯","罐","瓶","個","包","碟"]).map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 text-[13px] tabular-nums flex-wrap">
                    <div className="flex items-center bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)]/50">
                      <button onClick={() => updateLog(entry.id, { calories: Math.max(1, Math.round(entry.calories) - 10) })}
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center text-[var(--color-text-muted)] active:bg-[var(--color-surface-elevated)] rounded-l-xl transition-colors">
                        <Minus size={14} />
                      </button>
                      <input type="number" value={Math.round(entry.calories)}
                        onChange={e => { const v = Number(e.target.value); if (v >= 0) updateLog(entry.id, { calories: v }); }}
                        className="w-[48px] text-center bg-transparent py-1.5 text-[14px] font-bold tabular-nums outline-none text-orange-400"
                        inputMode="decimal" min="0" style={{ fontSize: '16px' }} />
                      <button onClick={() => updateLog(entry.id, { calories: Math.round(entry.calories) + 10 })}
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center text-[var(--color-text-muted)] active:bg-[var(--color-surface-elevated)] rounded-r-xl transition-colors">
                        <Plus size={14} />
                      </button>
                    </div>
                    <span className="text-[11px] text-[var(--color-text-muted)]">kcal</span>
                    <span className="text-blue-400 font-semibold">P</span>
                    <input type="number" value={Math.round(entry.protein * 10) / 10}
                      onChange={e => { const v = Number(e.target.value); if (v >= 0) updateLog(entry.id, { protein: v }); }}
                      className="w-[42px] text-center bg-[var(--color-surface)] border border-[var(--color-border)]/50 rounded-lg py-1.5 text-[13px] tabular-nums outline-none"
                      inputMode="decimal" min="0" step="0.1" style={{ fontSize: '16px' }} />
                    <span className="text-amber-400 font-semibold">C</span>
                    <input type="number" value={Math.round(entry.carbs * 10) / 10}
                      onChange={e => { const v = Number(e.target.value); if (v >= 0) updateLog(entry.id, { carbs: v }); }}
                      className="w-[42px] text-center bg-[var(--color-surface)] border border-[var(--color-border)]/50 rounded-lg py-1.5 text-[13px] tabular-nums outline-none"
                      inputMode="decimal" min="0" step="0.1" style={{ fontSize: '16px' }} />
                    <span className="text-red-400 font-semibold">F</span>
                    <input type="number" value={Math.round(entry.fat * 10) / 10}
                      onChange={e => { const v = Number(e.target.value); if (v >= 0) updateLog(entry.id, { fat: v }); }}
                      className="w-[42px] text-center bg-[var(--color-surface)] border border-[var(--color-border)]/50 rounded-lg py-1.5 text-[13px] tabular-nums outline-none"
                      inputMode="decimal" min="0" step="0.1" style={{ fontSize: '16px' }} />
                  </div></div>
              ))}
            </div>
          )}
        </>)}

        {/* === Exercise tab content === */}
        {logTab === "exercise" && (<>
          {exercises.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-green-500/5 border border-dashed border-green-500/20 flex items-center justify-center mb-4">
                <Dumbbell size={28} className="text-green-400/25" />
              </div>
              <p className="text-[14px] font-medium text-[var(--color-text-muted)]">No exercise logged</p>
              <p className="text-[12px] text-[var(--color-text-muted)]/50 mt-1 max-w-[240px]">Go to Calories Out tab to add workouts</p>
            </div>
          ) : (
            <>
            <div className="px-4 py-2.5 border-b border-[var(--color-border)]/10 flex items-center justify-between">
              <span className="text-[12px] text-[var(--color-text-muted)]">{exercises.length} activities</span>
              {summary.exercise_calories > 0 && (
                <span className="text-[13px] font-bold text-green-400 tabular-nums">{Math.round(summary.exercise_calories)} kcal</span>
              )}
            </div>
            <div className="divide-y divide-[var(--color-border)]/10">
              {exercises.map((ex) => (
                <div key={ex.id} className="flex items-center gap-3 px-4 py-3 group">
                  <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                    <Flame size={14} className="text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[var(--color-text-primary)] truncate">{ex.exercise_name}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">{ex.duration_min} min · {Math.round(ex.calories_burned)} kcal</p>
                  </div>
                  <span className="text-[14px] font-semibold text-green-400 tabular-nums shrink-0">{Math.round(ex.calories_burned)} kcal</span>
                  <button onClick={() => deleteExercise(ex.id)}
                    className="opacity-0 group-hover:opacity-100 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-400 transition-all">
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
            </>
          )}
        </>)}
      </div>

      {/* ═══ Food Log ═══ */}
      {/* ═══ Food Log ═══ */}
      <div className="hidden md:block rounded-2xl border border-[var(--color-border)]/50 overflow-hidden bg-[var(--color-surface-elevated)]/20">
        <div className="px-4 py-3 border-b border-[var(--color-border)]/50 flex items-center justify-between flex-wrap gap-2">
          <span className="text-[14px] font-semibold text-[var(--color-text-primary)]">Today's Food Log</span>
          <div className="flex items-center gap-2">
            <button onClick={copyYesterday}
              className="flex items-center gap-1 text-[12px] text-[var(--color-accent)] hover:underline min-h-[36px] px-2">
              <Copy size={12} />Copy Yesterday
            </button>
            <div className="flex gap-1">
              {MEALS.map(m => (
                <button key={m.key} onClick={() => setMealFilter(m.key)}
                  className={cn("min-h-[32px] px-3 text-[12px] rounded-full font-medium transition-all active:scale-95",
                    mealFilter === m.key ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]")}
                >{m.label}</button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={22} className="animate-spin text-[var(--color-text-muted)]" /></div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-[13px] text-[var(--color-text-muted)]">
            <Utensils size={32} className="mx-auto mb-2 opacity-20" />
            No food logged yet. Search or take a photo to start.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-[13px] leading-none">
                <thead>
                  <tr className="border-b border-[var(--color-border)]/50 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
                    <th className="text-left py-2.5 px-4">Food</th>
                    <th className="text-left py-2.5 px-2">Meal</th>
                    <th className="text-center py-2.5 px-2">Amount</th>
                    <th className="text-right py-2.5 px-2">Cal</th>
                    <th className="text-right py-2.5 px-2">P</th>
                    <th className="text-right py-2.5 px-2">C</th>
                    <th className="text-right py-2.5 px-2">F</th>
                    <th className="py-2.5 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map(entry => (
                    <tr key={entry.id} className="border-b border-[var(--color-border)]/10 hover:bg-[var(--color-surface-elevated)]/20 transition-colors">
                      <td className="py-2.5 px-4 font-medium">{entry.food_name}</td>
                      <td className="py-2.5 px-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] capitalize">{entry.meal_type}</span>
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center justify-center gap-0.5">
                          <button onClick={() => updateWeight(entry.id, Math.max(1, entry.amount - 10))}
                            className="w-6 h-6 flex items-center justify-center rounded border border-[var(--color-border)] hover:bg-[var(--color-border)]/30 text-[var(--color-text-secondary)]"><Minus size={11} /></button>
                          <input type="number" defaultValue={entry.amount}
                            onBlur={e => { const v = Number(e.target.value); if (v > 0 && v !== entry.amount) updateWeight(entry.id, v); }}
                            className="w-[44px] text-center bg-transparent border border-[var(--color-border)] rounded py-1 text-[12px] tabular-nums outline-none"
                            inputMode="decimal" style={{ fontSize: '16px' }} />
                          <button onClick={() => updateWeight(entry.id, entry.amount + 10)}
                            className="w-6 h-6 flex items-center justify-center rounded border border-[var(--color-border)] hover:bg-[var(--color-border)]/30 text-[var(--color-text-secondary)]"><Plus size={11} /></button>
                          <select value={entry.serving_unit || 'g'}
                            onChange={e => updateLog(entry.id, { serving_unit: e.target.value })}
                            className="text-[11px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded px-1 py-0.5 outline-none text-[var(--color-text-muted)]">
                            {(servingUnits || ["g","ml","份","碗","杯","罐","瓶","個","包","碟"]).map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                      </td>
                      <td className="text-right py-2.5 px-1 tabular-nums">
                        <div className="flex items-center justify-end gap-0.5">
                          <button onClick={() => updateLog(entry.id, { calories: Math.max(1, Math.round(entry.calories) - 10) })}
                            className="w-6 h-6 flex items-center justify-center rounded border border-[var(--color-border)] hover:bg-[var(--color-border)]/30 text-[var(--color-text-secondary)]"><Minus size={11} /></button>
                          <input type="number" value={Math.round(entry.calories)}
                            onChange={e => { const v = Number(e.target.value); if (v >= 0) updateLog(entry.id, { calories: v }); }}
                            className="w-[44px] text-center bg-transparent border border-[var(--color-border)] rounded py-1 text-[12px] tabular-nums outline-none text-orange-400 font-medium"
                            inputMode="decimal" min="0" style={{ fontSize: '16px' }} />
                          <button onClick={() => updateLog(entry.id, { calories: Math.round(entry.calories) + 10 })}
                            className="w-6 h-6 flex items-center justify-center rounded border border-[var(--color-border)] hover:bg-[var(--color-border)]/30 text-[var(--color-text-secondary)]"><Plus size={11} /></button>
                        </div>
                      </td>
                      <td className="text-right py-2.5 px-1 tabular-nums">
                        <input type="number" value={Math.round(entry.protein * 10) / 10}
                          onChange={e => { const v = Number(e.target.value); if (v >= 0) updateLog(entry.id, { protein: v }); }}
                          className="w-[38px] text-center bg-transparent border border-[var(--color-border)] rounded py-1 text-[12px] tabular-nums outline-none"
                          inputMode="decimal" min="0" step="0.1" style={{ fontSize: '16px' }} />
                      </td>
                      <td className="text-right py-2.5 px-1 tabular-nums">
                        <input type="number" value={Math.round(entry.carbs * 10) / 10}
                          onChange={e => { const v = Number(e.target.value); if (v >= 0) updateLog(entry.id, { carbs: v }); }}
                          className="w-[38px] text-center bg-transparent border border-[var(--color-border)] rounded py-1 text-[12px] tabular-nums outline-none"
                          inputMode="decimal" min="0" step="0.1" style={{ fontSize: '16px' }} />
                      </td>
                      <td className="text-right py-2.5 px-1 tabular-nums">
                        <input type="number" value={Math.round(entry.fat * 10) / 10}
                          onChange={e => { const v = Number(e.target.value); if (v >= 0) updateLog(entry.id, { fat: v }); }}
                          className="w-[38px] text-center bg-transparent border border-[var(--color-border)] rounded py-1 text-[12px] tabular-nums outline-none"
                          inputMode="decimal" min="0" step="0.1" style={{ fontSize: '16px' }} />
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => addToFavorites('in', entry.food_name, Math.round(entry.calories), entry.amount, undefined, entry.serving_unit || 'g')}
                            title="Add to Favorites"
                            className="p-1.5 rounded-lg hover:bg-[var(--color-accent)]/10 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors">
                            <Star size={13} />
                          </button>
                          <button onClick={() => deleteLog(entry.id)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-400 transition-colors">
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-[var(--color-border)]/10">
              {filteredLogs.map(entry => (
                <div key={entry.id} className="px-4 py-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[14px] font-semibold text-[var(--color-text-primary)] truncate">{entry.food_name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] capitalize shrink-0">{entry.meal_type}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => addToFavorites('in', entry.food_name, Math.round(entry.calories), entry.amount, undefined, entry.serving_unit || 'g')}
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-[var(--color-accent)]/10 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] active:scale-95 transition-all">
                        <Star size={16} />
                      </button>
                      <button onClick={() => deleteLog(entry.id)}
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-400 active:scale-95 transition-all">
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Amount stepper */}
                    <div className="flex items-center bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)]/50">
                      <button onClick={() => updateWeight(entry.id, Math.max(1, entry.amount - 10))}
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center text-[var(--color-text-muted)] active:bg-[var(--color-surface-elevated)] rounded-l-xl transition-colors">
                        <Minus size={16} />
                      </button>
                      <input type="number" defaultValue={entry.amount}
                        onBlur={e => { const v = Number(e.target.value); if (v > 0 && v !== entry.amount) updateWeight(entry.id, v); }}
                        className="w-[48px] text-center bg-transparent py-2 text-[14px] font-semibold tabular-nums outline-none"
                        inputMode="decimal" style={{ fontSize: '16px' }} />
                      <button onClick={() => updateWeight(entry.id, entry.amount + 10)}
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center text-[var(--color-text-muted)] active:bg-[var(--color-surface-elevated)] rounded-r-xl transition-colors">
                        <Plus size={16} />
                      </button>
                    </div>
                    <select value={entry.serving_unit || 'g'}
                      onChange={e => updateLog(entry.id, { serving_unit: e.target.value })}
                      className="min-h-[40px] px-2 text-[13px] bg-[var(--color-surface)] border border-[var(--color-border)]/50 rounded-xl outline-none text-[var(--color-text-muted)]">
                      {(servingUnits || ["g","ml","份","碗","杯","罐","瓶","個","包","碟"]).map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  {/* Nutrition row */}
                  <div className="flex items-center gap-2 text-[13px] tabular-nums flex-wrap">
                    <div className="flex items-center bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)]/50">
                      <button onClick={() => updateLog(entry.id, { calories: Math.max(1, Math.round(entry.calories) - 10) })}
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center text-[var(--color-text-muted)] active:bg-[var(--color-surface-elevated)] rounded-l-xl transition-colors">
                        <Minus size={14} />
                      </button>
                      <input type="number" value={Math.round(entry.calories)}
                        onChange={e => { const v = Number(e.target.value); if (v >= 0) updateLog(entry.id, { calories: v }); }}
                        className="w-[48px] text-center bg-transparent py-1.5 text-[14px] font-bold tabular-nums outline-none text-orange-400"
                        inputMode="decimal" min="0" style={{ fontSize: '16px' }} />
                      <button onClick={() => updateLog(entry.id, { calories: Math.round(entry.calories) + 10 })}
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center text-[var(--color-text-muted)] active:bg-[var(--color-surface-elevated)] rounded-r-xl transition-colors">
                        <Plus size={14} />
                      </button>
                    </div>
                    <span className="text-[11px] text-[var(--color-text-muted)]">kcal</span>
                    <span className="text-blue-400 font-semibold">P</span>
                    <input type="number" value={Math.round(entry.protein * 10) / 10}
                      onChange={e => { const v = Number(e.target.value); if (v >= 0) updateLog(entry.id, { protein: v }); }}
                      className="w-[42px] text-center bg-[var(--color-surface)] border border-[var(--color-border)]/50 rounded-lg py-1.5 text-[13px] tabular-nums outline-none"
                      inputMode="decimal" min="0" step="0.1" style={{ fontSize: '16px' }} />
                    <span className="text-amber-400 font-semibold">C</span>
                    <input type="number" value={Math.round(entry.carbs * 10) / 10}
                      onChange={e => { const v = Number(e.target.value); if (v >= 0) updateLog(entry.id, { carbs: v }); }}
                      className="w-[42px] text-center bg-[var(--color-surface)] border border-[var(--color-border)]/50 rounded-lg py-1.5 text-[13px] tabular-nums outline-none"
                      inputMode="decimal" min="0" step="0.1" style={{ fontSize: '16px' }} />
                    <span className="text-red-400 font-semibold">F</span>
                    <input type="number" value={Math.round(entry.fat * 10) / 10}
                      onChange={e => { const v = Number(e.target.value); if (v >= 0) updateLog(entry.id, { fat: v }); }}
                      className="w-[42px] text-center bg-[var(--color-surface)] border border-[var(--color-border)]/50 rounded-lg py-1.5 text-[13px] tabular-nums outline-none"
                      inputMode="decimal" min="0" step="0.1" style={{ fontSize: '16px' }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ═══ Exercise Section (Desktop) ═══ */}
      {exercises.length > 0 && (
        <div className="hidden md:block rounded-2xl border border-[var(--color-border)]/50 overflow-hidden bg-[var(--color-surface-elevated)]/20">
          <div className="px-4 py-3 border-b border-[var(--color-border)]/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-green-500/15 flex items-center justify-center">
                <Dumbbell size={13} className="text-green-400" />
              </div>
              <span className="text-[14px] font-semibold text-[var(--color-text-primary)]">Today's Exercise</span>
            </div>
            {summary.exercise_calories > 0 && (
              <span className="text-[13px] font-bold text-green-400 tabular-nums">{Math.round(summary.exercise_calories)} kcal</span>
            )}
          </div>
          <div className="divide-y divide-[var(--color-border)]/10">
            {exercises.map((ex: any) => (
              <div key={ex.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-surface-elevated)]/20 transition-colors group">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                  <Flame size={14} className="text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[var(--color-text-primary)] truncate">{ex.exercise_name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateExercise(ex.id, { duration_min: Math.max(1, (ex.duration_min || 30) - 5) })}
                        className="w-5 h-5 flex items-center justify-center rounded border border-[var(--color-border)]/50 hover:bg-[var(--color-border)]/20 text-[var(--color-text-muted)]"><Minus size={9} /></button>
                      <input type="number" value={ex.duration_min}
                        onChange={e => { const v = Number(e.target.value); if (v > 0) updateExercise(ex.id, { duration_min: v }); }}
                        className="w-[40px] text-center bg-transparent border-b border-[var(--color-border)]/50 py-0.5 text-[12px] tabular-nums outline-none"
                        style={{ fontSize: '16px' }} />
                      <button onClick={() => updateExercise(ex.id, { duration_min: (ex.duration_min || 30) + 5 })}
                        className="w-5 h-5 flex items-center justify-center rounded border border-[var(--color-border)]/50 hover:bg-[var(--color-border)]/20 text-[var(--color-text-muted)]"><Plus size={9} /></button>
                      <span className="text-[10px] text-[var(--color-text-muted)]">min</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input type="number" value={Math.round(Number(ex.calories_burned))}
                        onChange={e => { const v = Number(e.target.value); if (v >= 0) updateExercise(ex.id, { calories_burned: v }); }}
                        className="w-[44px] text-center bg-transparent border border-[var(--color-border)]/50 rounded py-1 text-[12px] tabular-nums outline-none text-green-400 font-semibold"
                        style={{ fontSize: '16px' }} />
                      <span className="text-[10px] text-[var(--color-text-muted)]">kcal</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => deleteExercise(ex.id)}
                  className="opacity-0 group-hover:opacity-100 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-400 transition-all">
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
