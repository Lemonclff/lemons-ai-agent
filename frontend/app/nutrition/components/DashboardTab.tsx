"use client";

import { useState, useEffect } from "react";
import {
  Loader2, Utensils, Minus, Plus, X, Copy, Star,
  Flame, Zap, Dumbbell, Calendar, Check, Droplets,
} from "lucide-react";
import { Ring, CalorieHero, MacroBars } from "./Ring";
import { NumberField } from "./NumberField";
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
  showCopyModal, setShowCopyModal,
  copySourceDate, setCopySourceDate,
  copyFromDate,
  waterTotal, waterTarget,
  transferWater,
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
  showCopyModal: boolean; setShowCopyModal: (v:boolean) => void;
  copySourceDate: string; setCopySourceDate: (v:string) => void;
  copyFromDate: (sourceDate: string, copyFood: boolean, copyExercise: boolean,
    foodNames?: string[], exerciseNames?: string[]) => Promise<void>;
  waterTotal: number; waterTarget: number;
  transferWater: (ml: number) => void;
}) {
  const [logTab, setLogTab] = useState<'food'|'exercise'>('food');
  const [favTab, setFavTab] = useState<'in'|'out'>('in');
  const [copyFood, setCopyFood] = useState(true);
  const [copyExercise, setCopyExercise] = useState(true);
  const [copying, setCopying] = useState(false);
  interface CopyItem { food_name?: string; exercise_name?: string; meal_type?: string; calories: number; duration_min?: number; calories_burned?: number; }
  const [previewItems, setPreviewItems] = useState<{foods: CopyItem[]; exercises: CopyItem[]}>({foods: [], exercises: []});
  const [selectedFoods, setSelectedFoods] = useState<Set<string>>(new Set());
  const [selectedExercises, setSelectedExercises] = useState<Set<string>>(new Set());
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [waterInput, setWaterInput] = useState("");

  /* ── Preview items when modal opens ── */
  useEffect(() => {
    if (!showCopyModal) { setPreviewItems({foods: [], exercises: []}); setPreviewLoaded(false); return; }
    const fetchPreview = async () => {
      setPreviewLoaded(false);
      try {
        const r = await fetch("/api/nutrition/copy-yesterday", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            log_date: copySourceDate,
            source_date: copySourceDate,
            copy_food: copyFood,
            copy_exercise: copyExercise,
            preview: true,
          }),
        });
        const json = await r.json();
        if (json.error) {
          setPreviewItems({foods: [], exercises: []});
        } else {
          const foods: CopyItem[] = json.available_foods || [];
          const exercises: CopyItem[] = json.available_exercises || [];
          setPreviewItems({ foods, exercises });
          setSelectedFoods(new Set(foods.map((f: CopyItem) => f.food_name!)));
          setSelectedExercises(new Set(exercises.map((e: CopyItem) => e.exercise_name!)));
        }
      } catch {
        setPreviewItems({foods: [], exercises: []});
      }
      setPreviewLoaded(true);
    };
    fetchPreview();
  }, [showCopyModal, copySourceDate, copyFood, copyExercise]);

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
      <div className="rounded-2xl border border-[var(--color-border)]/50 overflow-hidden bg-[var(--color-surface-elevated)]/20 nutri-card-hover">
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

      {/* ═══ Water Tracker — Slider ═══ */}
      <div className="rounded-2xl border border-[var(--color-border)]/50 overflow-hidden bg-[var(--color-surface-elevated)]/20 nutri-card-hover">
        <div className="px-4 py-3 border-b border-[var(--color-border)]/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-500/15 flex items-center justify-center nutri-icon-bounce">
              <Droplets size={14} className="text-sky-400" />
            </div>
            <span className="text-[14px] font-semibold text-[var(--color-text-primary)]">Water</span>
          </div>
          <span className="text-[12px] tabular-nums text-[var(--color-text-muted)]">
            <span className="font-bold text-sky-400">{Math.round(waterTotal)}</span>
            {" / "}
            <span>{waterTarget}</span> ml
          </span>
        </div>
        {/* Slider */}
        <div className="px-4 pt-3 pb-4 space-y-2">
          <input type="range" min={0} max={waterTarget * 1.5} step={50}
            value={Math.round(waterTotal)}
            onChange={e => transferWater(Number(e.target.value))}
            className="w-full h-2.5 rounded-full appearance-none cursor-pointer
              bg-[var(--color-border)]/35
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:h-7
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-sky-400 [&::-webkit-slider-thumb]:to-blue-500
              [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-sky-400/30 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white/20
              [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:active:scale-110
              [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-7 [&::-moz-range-thumb]:h-7
              [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-gradient-to-br [&::-moz-range-thumb]:from-sky-400 [&::-moz-range-thumb]:to-blue-500
              [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white/20 [&::-moz-range-thumb]:shadow-lg
              overflow-hidden
              [&::-webkit-slider-runnable-track]:h-full [&::-webkit-slider-runnable-track]:rounded-full
            "
            style={{
              background: `linear-gradient(to right, #38bdf8 ${Math.min(100, (waterTotal / Math.max(1, waterTarget * 1.5)) * 100)}%, transparent ${Math.min(100, (waterTotal / Math.max(1, waterTarget * 1.5)) * 100)}%)`,
            }}
          />
          <div className="flex justify-between text-[10px] text-[var(--color-text-muted)]">
            <span>{waterTarget > 0 ? `${Math.round((waterTotal / waterTarget) * 100)}%` : "—"}</span>
            <span>{waterTotal >= waterTarget ? "Goal met! 🎉" : `${waterTarget - Math.round(waterTotal)} ml left`}</span>
          </div>
        </div>
        {/* Quick-add chips + custom input */}
        <div className="px-4 pb-4 flex gap-2 items-center">
          {[250, 500, 750].map(ml => (
            <button key={ml} onClick={() => transferWater(waterTotal + ml)}
              className="flex-1 min-h-[44px] rounded-xl border border-[var(--color-border)]/40 bg-[var(--color-surface)]/30 hover:bg-[var(--color-surface-elevated)]/30 hover:border-sky-400/30 hover:shadow-[0_0_12px_rgba(56,189,248,0.15)] text-[13px] font-medium text-[var(--color-text-secondary)] hover:text-sky-400 transition-all active:scale-95 nutri-press">
              +{ml}
            </button>
          ))}
          <div className="flex items-center gap-0">
            <input type="number" inputMode="decimal" placeholder="ml" value={waterInput}
              onChange={e => setWaterInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  const v = parseInt(waterInput);
                  if (v > 0) { transferWater(waterTotal + v); setWaterInput(""); }
                }
              }}
              className="w-[54px] min-h-[44px] px-2 text-[13px] text-center bg-[var(--color-surface)]/30 border border-[var(--color-border)]/40 rounded-l-xl outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50 focus:border-sky-400/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none border-r-0 nutri-input-glow" />
            <button onClick={() => {
              const v = parseInt(waterInput);
              if (v > 0) { transferWater(waterTotal + v); setWaterInput(""); }
            }}
              className="min-h-[44px] min-w-[36px] flex items-center justify-center rounded-r-xl border border-[var(--color-border)]/40 bg-[var(--color-surface)]/30 hover:bg-[var(--color-surface-elevated)]/30 hover:border-sky-400/30 text-[var(--color-text-muted)] hover:text-sky-400 transition-all active:scale-95 nutri-press">
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Low protein warning */}
      {goals.calories > 0 && summary.protein < goals.protein * 0.7 && (
        <div className="text-[12px] text-amber-400 px-4 py-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 flex items-center gap-2 animate-[fade-up_0.4s_ease] nutri-card-hover">
          <Zap size={14} className="shrink-0" /> Protein is low today. Try chicken, eggs, or tofu.
        </div>
      )}
      {/* ═══ Mobile: Food + Exercise Tab ═══ */}
      <div className="md:hidden rounded-2xl border border-[var(--color-border)]/50 overflow-hidden bg-[var(--color-surface-elevated)]/20 nutri-card-hover">
        {/* Tab bar */}
        <div className="flex border-b border-[var(--color-border)]/50">
          <button onClick={() => setLogTab("food")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[13px] font-semibold transition-all active:scale-95 ${
              logTab === "food"
                ? "text-orange-400 border-b-2 border-orange-400 bg-orange-500/5"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`}>
            <Utensils size={14} /> Food
            {summary.count > 0 && <span className="text-[10px] text-orange-400/70">({summary.count})</span>}
          </button>
          <button onClick={() => setLogTab("exercise")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[13px] font-semibold transition-all active:scale-95 ${
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
            <button onClick={() => copyYesterday()}
              className="flex items-center gap-1 text-[12px] text-[var(--color-accent)] hover:underline min-h-[36px] px-2">
              <Copy size={12} />Copy Yest
            </button>
            <button onClick={() => { setPreviewItems({foods:[], exercises:[]}); setCopyFood(true); setCopyExercise(true); setShowCopyModal(true); }}
              className="flex items-center gap-1 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:underline min-h-[36px] px-2">
              <Calendar size={12} />Copy From...
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
                      <NumberField value={entry.amount} onCommit={v => { if (v && v !== entry.amount) updateWeight(entry.id, v); }}
                        className="w-[48px] text-center py-2 font-semibold bg-transparent border-0 rounded-none min-h-[32px] px-0" />
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
                      <NumberField value={Math.round(entry.calories)} onCommit={v => { if (v !== null && v >= 0) updateLog(entry.id, { calories: v }); }}
                        className="w-[48px] text-center py-1.5 font-bold tabular-nums text-orange-400 bg-transparent border-0 rounded-none min-h-[32px] px-0" />
                      <button onClick={() => updateLog(entry.id, { calories: Math.round(entry.calories) + 10 })}
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center text-[var(--color-text-muted)] active:bg-[var(--color-surface-elevated)] rounded-r-xl transition-colors">
                        <Plus size={14} />
                      </button>
                    </div>
                    <span className="text-[11px] text-[var(--color-text-muted)]">kcal</span>
                    <span className="text-blue-400 font-semibold">P</span>
                    <NumberField value={Math.round(entry.protein * 10) / 10} onCommit={v => { if (v !== null && v >= 0) updateLog(entry.id, { protein: v }); }}
                      className="w-[42px] text-center py-1.5 text-[13px] tabular-nums bg-transparent border-0 rounded-none min-h-[32px] px-0" step={0.1} />
                    <span className="text-amber-400 font-semibold">C</span>
                    <NumberField value={Math.round(entry.carbs * 10) / 10} onCommit={v => { if (v !== null && v >= 0) updateLog(entry.id, { carbs: v }); }}
                      className="w-[42px] text-center py-1.5 text-[13px] tabular-nums bg-transparent border-0 rounded-none min-h-[32px] px-0" step={0.1} />
                    <span className="text-red-400 font-semibold">F</span>
                    <NumberField value={Math.round(entry.fat * 10) / 10} onCommit={v => { if (v !== null && v >= 0) updateLog(entry.id, { fat: v }); }}
                      className="w-[42px] text-center py-1.5 text-[13px] tabular-nums bg-transparent border-0 rounded-none min-h-[32px] px-0" step={0.1} />
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

      {/* ═══ Food Log ══ */}
      {/* ═══ Food Log ═══ */}
      <div className="hidden md:block rounded-2xl border border-[var(--color-border)]/50 overflow-hidden bg-[var(--color-surface-elevated)]/20 nutri-card-hover">
        <div className="px-4 py-3 border-b border-[var(--color-border)]/50 flex items-center justify-between flex-wrap gap-2">
          <span className="text-[14px] font-semibold text-[var(--color-text-primary)]">Today's Food Log</span>
          <div className="flex items-center gap-2">
            <button onClick={() => copyYesterday()}
              className="flex items-center gap-1 text-[12px] text-[var(--color-accent)] hover:underline min-h-[36px] px-2 transition-all active:scale-95">
              <Copy size={12} />Copy Yest
            </button>
            <button onClick={() => { setPreviewItems({foods:[], exercises:[]}); setCopyFood(true); setCopyExercise(true); setShowCopyModal(true); }}
              className="flex items-center gap-1 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:underline min-h-[36px] px-2 transition-all active:scale-95">
              <Calendar size={12} />Copy From...
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
                          <NumberField value={entry.amount} onCommit={v => { if (v && v !== entry.amount) updateWeight(entry.id, v); }}
                            className="w-[44px] text-center py-1 text-[12px] tabular-nums bg-transparent border-0 rounded-none min-h-[28px] px-0" />
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
                          <NumberField value={Math.round(entry.calories)} onCommit={v => { if (v !== null && v >= 0) updateLog(entry.id, { calories: v }); }}
                            className="w-[44px] text-center py-1 text-[12px] tabular-nums text-orange-400 font-medium bg-transparent border-0 rounded-none min-h-[28px] px-0" />
                          <button onClick={() => updateLog(entry.id, { calories: Math.round(entry.calories) + 10 })}
                            className="w-6 h-6 flex items-center justify-center rounded border border-[var(--color-border)] hover:bg-[var(--color-border)]/30 text-[var(--color-text-secondary)]"><Plus size={11} /></button>
                        </div>
                      </td>
                      <td className="text-right py-2.5 px-1 tabular-nums">
                        <NumberField value={Math.round(entry.protein * 10) / 10} onCommit={v => { if (v !== null && v >= 0) updateLog(entry.id, { protein: v }); }}
                          className="w-[38px] text-center py-1 text-[12px] tabular-nums bg-transparent border-0 rounded-none min-h-[28px] px-0" step={0.1} />
                      </td>
                      <td className="text-right py-2.5 px-1 tabular-nums">
                        <NumberField value={Math.round(entry.carbs * 10) / 10} onCommit={v => { if (v !== null && v >= 0) updateLog(entry.id, { carbs: v }); }}
                          className="w-[38px] text-center py-1 text-[12px] tabular-nums bg-transparent border-0 rounded-none min-h-[28px] px-0" step={0.1} />
                      </td>
                      <td className="text-right py-2.5 px-1 tabular-nums">
                        <NumberField value={Math.round(entry.fat * 10) / 10} onCommit={v => { if (v !== null && v >= 0) updateLog(entry.id, { fat: v }); }}
                          className="w-[38px] text-center py-1 text-[12px] tabular-nums bg-transparent border-0 rounded-none min-h-[28px] px-0" step={0.1} />
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
                      <NumberField value={entry.amount} onCommit={v => { if (v && v !== entry.amount) updateWeight(entry.id, v); }}
                        className="w-[48px] text-center py-2 font-semibold bg-transparent border-0 rounded-none min-h-[32px] px-0" />
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
                      <NumberField value={Math.round(entry.calories)} onCommit={v => { if (v !== null && v >= 0) updateLog(entry.id, { calories: v }); }}
                        className="w-[48px] text-center py-1.5 font-bold tabular-nums text-orange-400 bg-transparent border-0 rounded-none min-h-[32px] px-0" />
                      <button onClick={() => updateLog(entry.id, { calories: Math.round(entry.calories) + 10 })}
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center text-[var(--color-text-muted)] active:bg-[var(--color-surface-elevated)] rounded-r-xl transition-colors">
                        <Plus size={14} />
                      </button>
                    </div>
                    <span className="text-[11px] text-[var(--color-text-muted)]">kcal</span>
                    <span className="text-blue-400 font-semibold">P</span>
                    <NumberField value={Math.round(entry.protein * 10) / 10} onCommit={v => { if (v !== null && v >= 0) updateLog(entry.id, { protein: v }); }}
                      className="w-[42px] text-center py-1.5 text-[13px] tabular-nums bg-transparent border-0 rounded-none min-h-[32px] px-0" step={0.1} />
                    <span className="text-amber-400 font-semibold">C</span>
                    <NumberField value={Math.round(entry.carbs * 10) / 10} onCommit={v => { if (v !== null && v >= 0) updateLog(entry.id, { carbs: v }); }}
                      className="w-[42px] text-center py-1.5 text-[13px] tabular-nums bg-transparent border-0 rounded-none min-h-[32px] px-0" step={0.1} />
                    <span className="text-red-400 font-semibold">F</span>
                    <NumberField value={Math.round(entry.fat * 10) / 10} onCommit={v => { if (v !== null && v >= 0) updateLog(entry.id, { fat: v }); }}
                      className="w-[42px] text-center py-1.5 text-[13px] tabular-nums bg-transparent border-0 rounded-none min-h-[32px] px-0" step={0.1} />
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
                      <NumberField value={ex.duration_min} onCommit={v => { if (v && v > 0) updateExercise(ex.id, { duration_min: v }); }}
                        className="w-[40px] text-center py-0.5 text-[12px] tabular-nums bg-transparent border-0 rounded-none min-h-[24px] px-0" />
                      <button onClick={() => updateExercise(ex.id, { duration_min: (ex.duration_min || 30) + 5 })}
                        className="w-5 h-5 flex items-center justify-center rounded border border-[var(--color-border)]/50 hover:bg-[var(--color-border)]/20 text-[var(--color-text-muted)]"><Plus size={9} /></button>
                      <span className="text-[10px] text-[var(--color-text-muted)]">min</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <NumberField value={Math.round(Number(ex.calories_burned))} onCommit={v => { if (v !== null && v >= 0) updateExercise(ex.id, { calories_burned: v }); }}
                        className="w-[44px] text-center py-1 text-[12px] tabular-nums text-green-400 font-semibold bg-transparent border-0 rounded-none min-h-[24px] px-0" />
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

      {/* ═══ Copy Modal ═══ */}
      {showCopyModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 modal-sheet" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-[fadeIn_150ms_ease]" onClick={() => setShowCopyModal(false)} aria-hidden="true" />
          <div className="relative w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] shadow-xl animate-[scale-in_220ms_var(--ease-out-expo)] overflow-hidden modal-sheet-content">
            {/* Drag handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1" aria-hidden="true">
              <span className="w-10 h-1 rounded-full bg-[var(--color-border-strong)]" />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-0">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] tracking-tight flex items-center gap-2">
                <Calendar size={18} className="text-[var(--color-accent)]" />
                Copy From...
              </h2>
              <button onClick={() => setShowCopyModal(false)}
                className="p-2.5 -mr-1 -mt-1 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] transition-colors touch-target">
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-5 space-y-5">
              {/* Date Picker */}
              <div>
                <label className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-2">From Date</label>
                <input type="date" value={copySourceDate}
                  onChange={e => { setCopySourceDate(e.target.value); }}
                  className="w-full min-h-[44px] px-3 py-2 text-[14px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl outline-none text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/30 transition-all" />
              </div>

              {/* Type Toggles */}
              <div>
                <label className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-2">Copy What</label>
                <div className="flex gap-3">
                  <label className={cn(
                    "flex-1 flex items-center gap-2.5 px-3.5 py-3 rounded-xl border cursor-pointer transition-all min-h-[44px] select-none",
                    copyFood
                      ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/8 text-[var(--color-accent)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]"
                  )}>
                    <div className={cn(
                      "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0",
                      copyFood ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white" : "border-[var(--color-border-strong)]"
                    )}>
                      {copyFood && <Check size={13} strokeWidth={3} />}
                    </div>
                    <input type="checkbox" checked={copyFood} onChange={() => setCopyFood(!copyFood)} className="sr-only" />
                    <div className="flex flex-col">
                      <span className="text-[13px] font-medium">Food</span>
                      <span className="text-[11px] opacity-60">Calories In</span>
                    </div>
                  </label>
                  <label className={cn(
                    "flex-1 flex items-center gap-2.5 px-3.5 py-3 rounded-xl border cursor-pointer transition-all min-h-[44px] select-none",
                    copyExercise
                      ? "border-green-400/40 bg-green-400/8 text-green-400"
                      : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]"
                  )}>
                    <div className={cn(
                      "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0",
                      copyExercise ? "border-green-400 bg-green-400 text-white" : "border-[var(--color-border-strong)]"
                    )}>
                      {copyExercise && <Check size={13} strokeWidth={3} />}
                    </div>
                    <input type="checkbox" checked={copyExercise} onChange={() => setCopyExercise(!copyExercise)} className="sr-only" />
                    <div className="flex flex-col">
                      <span className="text-[13px] font-medium">Exercise</span>
                      <span className="text-[11px] opacity-60">Calories Out</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Item List */}
              {!previewLoaded ? (
                <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]/50 px-4 py-3">
                  <div className="flex items-center gap-2 text-[13px] text-[var(--color-text-muted)]">
                    <Loader2 size={14} className="animate-spin" />
                    Checking available records...
                  </div>
                </div>
              ) : previewItems.foods.length === 0 && previewItems.exercises.length === 0 ? (
                <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]/50 px-4 py-3">
                  <div className="text-center py-2 text-[13px] text-[var(--color-text-muted)]">
                    No items to copy from this date
                  </div>
                </div>
              ) : (
                <div className="max-h-[260px] overflow-y-auto space-y-2 -mx-1 px-1">
                  {/* Food items */}
                  {copyFood && previewItems.foods.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 px-1">
                        Food ({selectedFoods.size}/{previewItems.foods.length})
                      </div>
                      {previewItems.foods.map((item) => {
                        const key = item.food_name!;
                        const checked = selectedFoods.has(key);
                        return (
                          <label key={key}
                            className={cn(
                              "flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all min-h-[40px] select-none mb-1",
                              checked
                                ? "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 text-[var(--color-text-primary)]"
                                : "border-[var(--color-border)]/30 bg-[var(--color-surface)]/30 text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]"
                            )}>
                            <div className={cn(
                              "w-4.5 h-4.5 rounded border-2 flex items-center justify-center transition-all shrink-0",
                              checked ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white" : "border-[var(--color-border-strong)]"
                            )}>
                              {checked && <Check size={11} strokeWidth={3} />}
                            </div>
                            <input type="checkbox" checked={checked}
                              onChange={() => {
                                const next = new Set(selectedFoods);
                                checked ? next.delete(key) : next.add(key);
                                setSelectedFoods(next);
                              }} className="sr-only" />
                            <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <span className="text-[13px] font-medium truncate block">{item.food_name}</span>
                                <span className="text-[10px] text-[var(--color-text-muted)] capitalize">{item.meal_type}</span>
                              </div>
                              <span className="text-[12px] font-semibold tabular-nums text-orange-400 shrink-0">
                                {Math.round(item.calories)} kcal
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* Exercise items */}
                  {copyExercise && previewItems.exercises.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 px-1">
                        Exercise ({selectedExercises.size}/{previewItems.exercises.length})
                      </div>
                      {previewItems.exercises.map((item) => {
                        const key = item.exercise_name!;
                        const checked = selectedExercises.has(key);
                        return (
                          <label key={key}
                            className={cn(
                              "flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all min-h-[40px] select-none mb-1",
                              checked
                                ? "border-green-400/30 bg-green-400/5 text-[var(--color-text-primary)]"
                                : "border-[var(--color-border)]/30 bg-[var(--color-surface)]/30 text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]"
                            )}>
                            <div className={cn(
                              "w-4.5 h-4.5 rounded border-2 flex items-center justify-center transition-all shrink-0",
                              checked ? "border-green-400 bg-green-400 text-white" : "border-[var(--color-border-strong)]"
                            )}>
                              {checked && <Check size={11} strokeWidth={3} />}
                            </div>
                            <input type="checkbox" checked={checked}
                              onChange={() => {
                                const next = new Set(selectedExercises);
                                checked ? next.delete(key) : next.add(key);
                                setSelectedExercises(next);
                              }} className="sr-only" />
                            <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <span className="text-[13px] font-medium truncate block">{item.exercise_name}</span>
                                <span className="text-[10px] text-[var(--color-text-muted)]">{item.duration_min} min</span>
                              </div>
                              <span className="text-[12px] font-semibold tabular-nums text-green-400 shrink-0">
                                {Math.round(item.calories_burned || 0)} kcal
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowCopyModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)] transition-colors min-h-[44px]">
                  Cancel
                </button>
                <button onClick={async () => {
                  setCopying(true);
                  await copyFromDate(
                    copySourceDate, copyFood, copyExercise,
                    selectedFoods.size > 0 ? Array.from(selectedFoods) : undefined,
                    selectedExercises.size > 0 ? Array.from(selectedExercises) : undefined,
                  );
                  setCopying(false);
                }}
                  disabled={copying || (selectedFoods.size === 0 && selectedExercises.size === 0)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-40 transition-all min-h-[44px] shadow-glow-sm flex items-center justify-center gap-2">
                  {copying ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
                  {copying
                    ? "Copying..."
                    : `Copy (${selectedFoods.size + selectedExercises.size})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
