"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, Plus, Minus, X, Camera, Apple, Loader2,
  ChevronLeft, ChevronRight, Utensils,
  Copy, Calendar, UtensilsCrossed, Dumbbell,
  Star, Flame, Zap, Droplets,
} from "lucide-react";
import { Ring, CalorieHero, MacroBars } from "../nutrition/components/Ring";
import { NumberField } from "../nutrition/components/NumberField";
import { cn } from "@/lib/utils";
import "../nutrition/nutrition.css";

/* ================================================================
   Types
   ================================================================ */
interface FoodResult {
  food_name: string; display_name: string; calories_per_100g: number;
  protein_per_100g: number; carbs_per_100g: number; fat_per_100g: number; source: string;
}
interface LogEntry {
  id: number; food_name: string; amount: number; serving_unit?: string;
  calories: number; protein: number; carbs: number; fat: number;
  meal_type: string; source: string;
}
interface DaySummary { calories: number; protein: number; carbs: number; fat: number; count: number; exercise_calories: number; }
interface UserProfile {
  gender: string; age: number; height_cm: number; weight_kg: number;
  activity_level: string; goal: string;
  daily_calorie_target: number; daily_protein_target: number; daily_carbs_target: number; daily_fat_target: number;
  daily_water_target_ml?: number;
}
interface FavoriteItem {
  id: number; name: string; calories: number;
  default_weight?: number; default_duration?: number;
  log_count?: number; avg_calories?: number; avg_weight?: number;
  serving_calories?: number; serving_unit?: string; default_unit?: string;
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

/* ================================================================
   Standalone Nutrition — Mobile-First Single Page
   ================================================================ */
export default function NutritionStandalone() {
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  });
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  })();

  // Core data
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [summary, setSummary] = useState<DaySummary>({ calories: 0, protein: 0, carbs: 0, fat: 0, count: 0, exercise_calories: 0 });
  const [loading, setLoading] = useState(true);
  const [mealFilter, setMealFilter] = useState("");
  const [goals, setGoals] = useState({ calories: 2000, protein: 100, carbs: 250, fat: 65 });

  // Water
  const [waterTotal, setWaterTotal] = useState(0);
  const [waterTarget, setWaterTarget] = useState(2000);
  const [waterInput, setWaterInput] = useState("");

  // Exercise
  const [exercises, setExercises] = useState<any[]>([]);
  const [showExercise, setShowExercise] = useState(false);
  const [exName, setExName] = useState("");
  const [exDuration, setExDuration] = useState(30);
  const [exSearch, setExSearch] = useState("");
  const [exList, setExList] = useState<{name:string,met:number,category:string}[]>([]);
  const [exCustom, setExCustom] = useState(false);
  const [exCustomCal, setExCustomCal] = useState("");

  // Search
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [addTarget, setAddTarget] = useState<FoodResult | null>(null);
  const [addWeight, setAddWeight] = useState(100);
  const [addMeal, setAddMeal] = useState("lunch");
  const [addServingUnit, setAddServingUnit] = useState("g");
  const [servingUnits, setServingUnits] = useState<string[]>(["g","ml","份","碗","杯","罐","瓶","個","包","碟"]);
  const [adding, setAdding] = useState(false);

  // Favorites
  const [favorites, setFavorites] = useState<FavoritesData>({ in: [], out: [] });
  const [suggested, setSuggested] = useState<SuggestedData>({ in: [], out: [] });

  // Profile
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Toast
  const [toast, setToast] = useState("");
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const formatLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  /* ═══ Fetch ═══ */
  const fetchLogs = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/nutrition/logs?date=${date}`);
      const json = await r.json();
      if (!json.error) { setLogs(json.logs || []); setSummary(json.summary); }
    } catch {}
    setLoading(false);
  }, []);

  const fetchGoals = useCallback(async () => {
    try {
      const r = await fetch("/api/nutrition/profile");
      const json = await r.json();
      if (json.profile) {
        setProfile(json.profile);
        setGoals({
          calories: json.profile.daily_calorie_target || 2000,
          protein: json.profile.daily_protein_target || 100,
          carbs: json.profile.daily_carbs_target || 250,
          fat: json.profile.daily_fat_target || 65,
        });
        if (json.profile.daily_water_target_ml) setWaterTarget(Number(json.profile.daily_water_target_ml));
      }
    } catch {}
  }, []);

  const fetchFavorites = async () => {
    try {
      const r = await fetch("/api/nutrition/favorites");
      const json = await r.json();
      if (json.favorites) setFavorites(json.favorites);
      if (json.suggested) setSuggested(json.suggested);
    } catch {}
  };

  const fetchExercises = async () => {
    try {
      const r = await fetch(`/api/nutrition/exercise?date=${currentDate}`);
      const json = await r.json();
      if (json.exercises) setExercises(json.exercises);
    } catch {}
  };

  const fetchWater = async () => {
    try {
      const r = await fetch(`/api/nutrition/water?date=${currentDate}`);
      const json = await r.json();
      if (json.total !== undefined) setWaterTotal(Number(json.total) || 0);
    } catch {}
  };

  const fetchExList = async () => {
    try {
      const r = await fetch("/api/nutrition/exercises");
      const json = await r.json();
      if (json.exercises) setExList(json.exercises);
    } catch {}
  };

  useEffect(() => { fetchLogs(currentDate); fetchExercises(); fetchFavorites(); fetchWater(); }, [currentDate, fetchLogs]);
  useEffect(() => { fetchGoals(); fetchExList(); }, [fetchGoals]);
  useEffect(() => {
    fetch("/api/nutrition/logs?action=units").then(r => r.json()).then(d => {
      if (d.units?.length) setServingUnits(d.units);
    }).catch(() => {});
  }, []);

  /* ═══ Date Navigation ═══ */
  const changeDate = (delta: number) => {
    const d = new Date(currentDate + "T12:00:00");
    d.setDate(d.getDate() + delta);
    setCurrentDate(formatLocal(d));
  };
  const dateDisplay = () => {
    const d = new Date(currentDate + "T12:00:00");
    if (currentDate === todayStr) return "Today";
    const yesterday = new Date(todayStr + "T12:00:00"); yesterday.setDate(yesterday.getDate()-1);
    if (currentDate === formatLocal(yesterday)) return "Yesterday";
    return d.toLocaleDateString("zh-Hant", { month: "short", day: "numeric" });
  };

  /* ═══ Log CRUD ═══ */
  const updateLog = async (id: number, fields: { amount?: number; serving_unit?: string; calories?: number; protein?: number; carbs?: number; fat?: number }) => {
    setLogs(prev => prev.map(l => l.id !== id ? l : { ...l, ...fields }));
    try {
      await fetch(`/api/nutrition/logs?id=${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) });
      if (fields.amount !== undefined || fields.calories !== undefined) fetchLogs(currentDate);
    } catch {}
  };

  const updateWeight = (id: number, w: number) => {
    const e = logs.find(l => l.id === id);
    updateLog(id, { amount: w, calories: e?.calories, protein: e?.protein, carbs: e?.carbs, fat: e?.fat });
  };

  const deleteLog = async (id: number) => {
    setLogs(prev => prev.filter(l => l.id !== id));
    try { await fetch(`/api/nutrition/logs?id=${id}`, { method: "DELETE" }); fetchLogs(currentDate); } catch {}
  };

  /* ═══ Search ═══ */
  const onSearch = (q: string) => {
    setSearchQ(q); setAddTarget(null);
    if (q.length < 1) { setSearchResults([]); setShowDropdown(false); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/nutrition/search?q=${encodeURIComponent(q)}`);
        const json = await r.json();
        setSearchResults(json.results || []);
        setShowDropdown(true);
      } catch {}
      setSearching(false);
    }, 300);
  };

  const selectFood = (f: FoodResult) => { setAddTarget(f); setShowDropdown(false); setSearchQ(""); };

  const addFood = async () => {
    if (!addTarget) return;
    setAdding(true);
    try {
      const r = await fetch("/api/nutrition/logs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ food_name: addTarget.food_name, amount: addWeight, meal_type: addMeal, serving_unit: addServingUnit, log_date: currentDate }),
      });
      const json = await r.json();
      if (json.error) { showToast(json.error); setAdding(false); return; }
      setAddTarget(null); setAddWeight(100); setAddServingUnit("g");
      fetchLogs(currentDate);
      showToast(`Added ${addTarget.display_name || addTarget.food_name}`);
    } catch { showToast("Failed to add"); }
    setAdding(false);
  };

  /* ═══ Water ═══ */
  const transferWater = async (ml: number) => {
    const target = Math.max(0, ml);
    setWaterTotal(target);
    try { await fetch("/api/nutrition/water", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ log_date: currentDate, amount_ml: target }) }); } catch {}
  };

  /* ═══ Exercise ═══ */
  const addExercise = async () => {
    if (!exName) return;
    try {
      const body: any = { exercise_name: exName, log_date: currentDate, duration_min: exDuration };
      if (exCustomCal) body.calories_burned = Number(exCustomCal);
      await fetch("/api/nutrition/exercise", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setExName(""); setExDuration(30); setExCustomCal("");
      fetchExercises(); fetchLogs(currentDate);
      showToast(`Logged ${exName}`);
    } catch {}
  };
  const deleteExercise = async (id: number) => {
    try { await fetch(`/api/nutrition/exercise?id=${id}`, { method: "DELETE" }); fetchExercises(); fetchLogs(currentDate); } catch {}
  };

  /* ═══ Favorites ═══ */
  const addToFavorites = async (type: 'in'|'out', name: string, calories?: number, default_weight?: number, default_duration?: number, serving_unit?: string) => {
    try {
      const r = await fetch("/api/nutrition/favorites", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name, calories: calories || 0, default_weight, default_duration, serving_unit: serving_unit || 'g' }),
      });
      const json = await r.json();
      if (json.favorite) {
        setFavorites(prev => ({ ...prev, [type]: [...prev[type], json.favorite] }));
        setSuggested(prev => ({ ...prev, [type]: prev[type].filter((s: any) => s.name !== name) }));
        showToast(`Pinned "${name}" to favorites`);
      }
    } catch {}
  };

  const removeFavorite = async (type: 'in'|'out', id: number) => {
    try {
      await fetch(`/api/nutrition/favorites?id=${id}`, { method: "DELETE" });
      setFavorites(prev => ({ ...prev, [type]: prev[type].filter(f => f.id !== id) }));
      showToast("Removed from favorites");
    } catch {}
  };

  const quickAddIn = async (f: FavoriteItem) => {
    try {
      const w = f.default_weight || 100;
      const u = f.default_unit || f.serving_unit || "g";
      const r = await fetch("/api/nutrition/logs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ food_name: f.name, amount: w, meal_type: "snack", serving_unit: u, log_date: currentDate }),
      });
      const json = await r.json();
      if (!json.error) { fetchLogs(currentDate); showToast(`+ ${f.name}`); }
    } catch {}
  };

  const quickAddOut = async (f: FavoriteItem) => {
    try {
      const d = f.default_duration || 30;
      await fetch("/api/nutrition/exercise", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exercise_name: f.name, log_date: currentDate, duration_min: d }),
      });
      fetchExercises(); fetchLogs(currentDate);
      showToast(`+ ${f.name}`);
    } catch {}
  };

  const copyYesterday = async () => {
    try {
      const d = new Date(currentDate + "T12:00:00"); d.setDate(d.getDate() - 1);
      const yesterday = formatLocal(d);
      const r = await fetch("/api/nutrition/copy-yesterday", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ log_date: currentDate, yesterday }),
      });
      const json = await r.json();
      if (json.error) { showToast(`Copy failed: ${json.error}`); return; }
      fetchLogs(currentDate);
      showToast(json.copied > 0 ? `Copied ${json.copied} meals from yesterday` : "Nothing new to copy");
    } catch { showToast("Copy failed"); }
  };

  const filteredLogs = mealFilter ? logs.filter(l => l.meal_type === mealFilter) : logs;

  /* ═══ Render Helpers ═══ */
  const renderFavChips = (items: FavoriteItem[], type: 'in'|'out', curated: boolean, onQuickAdd: (f: FavoriteItem) => void) => {
    if (items.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1.5">
        {items.map((f, i) => (
          <div key={`${type}-${curated ? 'c' : 's'}-${i}`} className="group relative">
            <button
              onClick={() => onQuickAdd(f)}
              className={cn(
                "nutri-chip px-3 py-1.5 text-[12px] rounded-full border flex items-center gap-1.5 min-h-[32px] active:scale-95",
                curated
                  ? "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/8 hover:bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                  : "border-dashed border-[var(--color-border)] bg-[var(--color-surface-elevated)]/20 hover:bg-[var(--color-surface-elevated)]/40 text-[var(--color-text-secondary)]"
              )}
            >
              <span className="max-w-[140px] truncate">{f.name}</span>
            </button>
            {curated ? (
              <button onClick={(e) => { e.stopPropagation(); removeFavorite(type, f.id); }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <X size={11} />
              </button>
            ) : (
              <button onClick={(e) => { e.stopPropagation(); addToFavorites(type, f.name, f.avg_calories || f.calories || 0, f.default_weight || f.avg_weight || 100, f.default_duration || 30, f.default_unit || 'g'); }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--color-accent)]/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Star size={10} />
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };

  /* ═══ Main Render ═══ */
  return (
    <>
      {/* ── Ambient blobs ── */}
      <div className="fixed top-[0%] left-[5%] w-[320px] h-[320px] rounded-full pointer-events-none z-[-1]"
        style={{ background: "radial-gradient(circle, rgba(255,159,10,0.04), transparent 70%)", filter: "blur(120px)", animation: "nutri-blob-1 20s ease-in-out infinite" }} />
      <div className="fixed bottom-[0%] right-[-5%] w-[280px] h-[280px] rounded-full pointer-events-none z-[-1]"
        style={{ background: "radial-gradient(circle, rgba(191,90,242,0.03), transparent 70%)", filter: "blur(100px)", animation: "nutri-blob-2 25s ease-in-out infinite 5s" }} />
      <div className="nutri-ambient-cyan fixed top-[45%] left-[50%] w-[240px] h-[240px] rounded-full pointer-events-none z-[-1]"
        style={{ background: "radial-gradient(circle, var(--nutri-ambient-cyan, rgba(100,210,255,0.06)), transparent 70%)", filter: "blur(100px)", transform: "translate(-50%, -50%)" }} />

      {/* ═══ Page Container ═══ */}
      <div className="nutrition-root w-full max-w-[520px] mx-auto min-h-[100dvh] pb-[calc(24px+env(safe-area-inset-bottom,0px))]">
        {/* Toast */}
        {toast && (
          <div className="nutri-toast fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-[70] px-4 py-3 nutri-glass rounded-2xl shadow-lg text-[13px] text-[var(--color-text-primary)]">{toast}</div>
        )}

        {/* ═══ Header ═══ */}
        <div className="sticky top-0 z-30 -mx-4 px-4 nutri-glass border-b border-[var(--color-border)]/50"
          style={{ paddingTop: "max(8px, env(safe-area-inset-top, 0px))" }}>
          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center shadow-[0_0_16px_rgba(249,115,22,0.35)]">
                <Apple size={18} className="text-white" />
              </div>
              <h1 className="text-[17px] font-bold text-[var(--color-text-primary)]">NutriSnap</h1>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => changeDate(-1)} className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-[var(--color-surface-elevated)]/50 border border-[var(--color-border)]/30 text-[var(--color-text-muted)] active:scale-95 transition-all">
                <ChevronLeft size={18} />
              </button>
              <span className="text-[13px] font-semibold text-[var(--color-text-primary)] min-w-[80px] text-center tabular-nums">{dateDisplay()}</span>
              <button onClick={() => changeDate(1)} disabled={currentDate >= todayStr} className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-[var(--color-surface-elevated)]/50 border border-[var(--color-border)]/30 text-[var(--color-text-muted)] active:scale-95 transition-all disabled:opacity-20">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* ═══ Main Content ═══ */}
        <div className="px-4 space-y-4 pt-4">
          <div className="nutri-stagger space-y-4">

            {/* ── Hero Energy Ring ── */}
            <CalorieHero caloriesIn={summary.calories} caloriesOut={summary.exercise_calories} goal={goals.calories} />

            {/* ── Macro Rings + Bars ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <Ring value={summary.calories} max={goals.calories} color="#f97316" label="Calories" unit="kcal" />
              <Ring value={summary.protein} max={goals.protein} color="#38bdf8" label="Protein" unit="g" />
              <Ring value={summary.carbs} max={goals.carbs} color="#fbbf24" label="Carbs" unit="g" />
              <Ring value={summary.fat} max={goals.fat} color="#f472b6" label="Fat" unit="g" />
            </div>
            <MacroBars protein={summary.protein} carbs={summary.carbs} fat={summary.fat} goals={goals} />

            {/* ── Protein Warning ── */}
            {goals.calories > 0 && summary.protein < goals.protein * 0.7 && (
              <div className="text-[12px] text-amber-400 px-4 py-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 flex items-center gap-2">
                <Zap size={14} className="shrink-0" /> Protein is low today. Try chicken, eggs, or tofu.
              </div>
            )}

            {/* ── Water Tracker ── */}
            <div className="nutri-glass nutri-glass-water rounded-2xl overflow-hidden nutri-card-hover">
              <div className="px-4 py-3 border-b border-[var(--color-border)]/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-sky-500/15 flex items-center justify-center">
                    <Droplets size={14} className="text-sky-400" />
                  </div>
                  <span className="text-[14px] font-semibold text-[var(--color-text-primary)]">Water</span>
                </div>
                <span className="text-[12px] tabular-nums text-[var(--color-text-muted)]">
                  <span className="font-bold text-sky-400">{Math.round(waterTotal)}</span> / {waterTarget} ml
                </span>
              </div>
              <div className="px-4 pt-3 pb-4 space-y-2">
                <input type="range" min={0} max={waterTarget * 1.5} step={50} value={Math.round(waterTotal)}
                  onChange={e => transferWater(Number(e.target.value))}
                  className="w-full h-2.5 rounded-full appearance-none cursor-pointer bg-[var(--color-border)]/35 overflow-hidden
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:h-7
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-sky-400 [&::-webkit-slider-thumb]:to-blue-500
                    [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-sky-400/30 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white/20
                    [&::-webkit-slider-thumb]:[animation:nutri-thumb-pulse_2.5s_ease-in-out_infinite]
                    [&::-webkit-slider-runnable-track]:h-full [&::-webkit-slider-runnable-track]:rounded-full"
                  style={{ background: `linear-gradient(to right, #38bdf8 ${Math.min(100, (waterTotal / Math.max(1, waterTarget * 1.5)) * 100)}%, transparent ${Math.min(100, (waterTotal / Math.max(1, waterTarget * 1.5)) * 100)}%)` }}
                />
                <div className="flex justify-between text-[10px] text-[var(--color-text-muted)]">
                  <span>{waterTarget > 0 ? `${Math.round((waterTotal / waterTarget) * 100)}%` : "--"}</span>
                  <span>{waterTotal >= waterTarget ? "Goal met!" : `${Math.max(0, waterTarget - Math.round(waterTotal))} ml left`}</span>
                </div>
              </div>
              <div className="px-4 pb-4 flex gap-2 items-center">
                {[250, 500, 750].map(ml => (
                  <button key={ml} onClick={() => transferWater(waterTotal + ml)}
                    className="flex-1 min-h-[44px] rounded-xl border border-[var(--color-border)]/40 bg-[var(--color-surface)]/30 hover:bg-[var(--color-surface-elevated)]/30 hover:border-sky-400/30 text-[13px] font-medium text-[var(--color-text-secondary)] hover:text-sky-400 transition-all active:scale-95 nutri-press">+{ml}</button>
                ))}
                <div className="flex items-center gap-0">
                  <input type="number" inputMode="decimal" placeholder="ml" value={waterInput}
                    onChange={e => setWaterInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { const v = parseInt(waterInput); if (v > 0) { transferWater(waterTotal + v); setWaterInput(""); } } }}
                    className="w-[54px] min-h-[44px] px-2 text-[16px] text-center bg-[var(--color-surface)]/30 border border-[var(--color-border)]/40 rounded-l-xl outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50 focus:border-sky-400/50 [appearance:textfield] border-r-0" />
                  <button onClick={() => { const v = parseInt(waterInput); if (v > 0) { transferWater(waterTotal + v); setWaterInput(""); } }}
                    className="min-h-[44px] min-w-[36px] flex items-center justify-center rounded-r-xl border border-[var(--color-border)]/40 bg-[var(--color-surface)]/30 hover:bg-[var(--color-surface-elevated)]/30 hover:border-sky-400/30 text-[var(--color-text-muted)] hover:text-sky-400 transition-all active:scale-95 nutri-press"><Plus size={16} /></button>
                </div>
              </div>
            </div>

            {/* ── Quick Food Search ── */}
            <div className="nutri-glass rounded-2xl overflow-hidden">
              <div className="relative">
                <input type="text" inputMode="search" placeholder="Search food to add..." value={searchQ}
                  onChange={e => onSearch(e.target.value)}
                  className="w-full min-h-[48px] px-4 py-3 bg-transparent text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50 outline-none border-0" />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {searching ? <Loader2 size={16} className="animate-spin text-[var(--color-text-muted)]" /> : <Search size={16} className="text-[var(--color-text-muted)]" />}
                </div>
              </div>
              {showDropdown && searchResults.length > 0 && (
                <div className="border-t border-[var(--color-border)]/50 max-h-[240px] overflow-y-auto divide-y divide-[var(--color-border)]/10">
                  {searchResults.map((f, i) => (
                    <button key={i} onClick={() => selectFood(f)}
                      className="w-full text-left px-4 py-2.5 hover:bg-[var(--color-surface-elevated)]/30 transition-colors">
                      <div className="text-[14px] font-medium text-[var(--color-text-primary)]">{f.display_name || f.food_name}</div>
                      <div className="text-[11px] text-[var(--color-text-muted)]">{f.calories_per_100g} kcal/100g</div>
                    </button>
                  ))}
                </div>
              )}
              {addTarget && (
                <div className="border-t border-[var(--color-border)]/50 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-semibold text-[var(--color-text-primary)] truncate max-w-[60%]">{addTarget.display_name || addTarget.food_name}</span>
                    <button onClick={() => setAddTarget(null)} className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-red-500/10 text-[var(--color-text-muted)] active:scale-95"><X size={16} /></button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)]/50">
                      <button onClick={() => setAddWeight(Math.max(1, addWeight - 10))} className="min-w-[40px] min-h-[40px] flex items-center justify-center text-[var(--color-text-muted)] rounded-l-xl nutri-inc-btn"><Minus size={16} /></button>
                      <NumberField value={addWeight} onCommit={v => { if (v && v > 0) setAddWeight(v); }} className="w-[56px] text-center py-2 font-semibold bg-transparent border-0 rounded-none min-h-[32px] px-0" />
                      <button onClick={() => setAddWeight(addWeight + 10)} className="min-w-[40px] min-h-[40px] flex items-center justify-center text-[var(--color-text-muted)] rounded-r-xl nutri-inc-btn"><Plus size={16} /></button>
                    </div>
                    <select value={addServingUnit} onChange={e => setAddServingUnit(e.target.value)}
                      className="min-h-[40px] px-2 text-[13px] bg-[var(--color-surface)] border border-[var(--color-border)]/50 rounded-xl outline-none text-[var(--color-text-muted)]">
                      {servingUnits.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <select value={addMeal} onChange={e => setAddMeal(e.target.value)}
                      className="min-h-[40px] px-2 text-[13px] bg-[var(--color-surface)] border border-[var(--color-border)]/50 rounded-xl outline-none text-[var(--color-text-muted)]">
                      {MEALS.filter(m => m.key).map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                  </div>
                  <button onClick={addFood} disabled={adding}
                    className="w-full min-h-[44px] rounded-xl bg-[var(--color-accent)] text-white text-[14px] font-semibold hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                    {adding ? "Adding..." : "Add Food"}
                  </button>
                </div>
              )}
            </div>

            {/* ── Favorites ── */}
            {(favorites.in.length > 0 || suggested.in.length > 0) && (
              <div className="nutri-glass rounded-2xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[var(--color-border)]/50">
                  <div className="text-[12px] font-semibold text-[var(--color-text-secondary)] flex items-center gap-1.5">
                    <Star size={12} className="text-[var(--color-accent)]" /> Quick Add
                  </div>
                </div>
                <div className="p-3 space-y-2.5">
                  {favorites.in.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Favorites</div>
                      {renderFavChips(favorites.in, 'in', true, quickAddIn)}
                    </div>
                  )}
                  {suggested.in.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Suggested</div>
                      {renderFavChips(suggested.in, 'in', false, quickAddIn)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Exercise Section (collapsible) ── */}
            <div className="nutri-glass rounded-2xl overflow-hidden">
              <button onClick={() => setShowExercise(!showExercise)}
                className="w-full px-4 py-3 flex items-center justify-between text-[14px] font-semibold text-[var(--color-text-primary)]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-green-500/15 flex items-center justify-center">
                    <Dumbbell size={14} className="text-green-400" />
                  </div>
                  Exercise
                  {exercises.length > 0 && <span className="text-[11px] text-green-400 font-medium">({exercises.length})</span>}
                </div>
                <span className={cn("transition-transform duration-300", showExercise && "rotate-180")}>
                  <ChevronRight size={16} className="text-[var(--color-text-muted)]" />
                </span>
              </button>
              {showExercise && (
                <div className="border-t border-[var(--color-border)]/50">
                  {/* Add exercise */}
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <input type="text" placeholder="Exercise name" value={exName}
                        onChange={e => setExName(e.target.value)}
                        className="flex-1 min-h-[40px] px-3 text-[14px] bg-[var(--color-surface)]/30 border border-[var(--color-border)]/40 rounded-xl outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50" />
                      <input type="number" inputMode="numeric" placeholder="min" value={exDuration}
                        onChange={e => setExDuration(Number(e.target.value) || 30)}
                        className="w-[60px] min-h-[40px] px-2 text-[14px] text-center bg-[var(--color-surface)]/30 border border-[var(--color-border)]/40 rounded-xl outline-none text-[var(--color-text-primary)] [appearance:textfield]" />
                    </div>
                    <button onClick={addExercise} disabled={!exName}
                      className="w-full min-h-[40px] rounded-xl bg-green-500/20 text-green-400 text-[13px] font-semibold hover:bg-green-500/30 active:scale-[0.97] transition-all disabled:opacity-30">
                      Log Exercise
                    </button>
                  </div>
                  {/* Exercise list */}
                  {exercises.length > 0 && (
                    <div className="divide-y divide-[var(--color-border)]/10">
                      {exercises.map((ex: any) => (
                        <div key={ex.id} className="flex items-center gap-3 px-4 py-2.5 group">
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
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Food Log ── */}
            <div className="nutri-glass rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--color-border)]/50 flex items-center justify-between flex-wrap gap-2">
                <span className="text-[14px] font-semibold text-[var(--color-text-primary)]">Food Log</span>
                <div className="flex items-center gap-1.5">
                  <button onClick={copyYesterday}
                    className="flex items-center gap-1 text-[11px] text-[var(--color-accent)] hover:underline min-h-[32px] px-1.5"><Copy size={11} />Copy Yest</button>
                  <div className="flex gap-1">
                    {MEALS.map(m => (
                      <button key={m.key} onClick={() => setMealFilter(m.key)}
                        className={cn("min-h-[30px] px-2 text-[11px] rounded-full font-medium nutri-filter-chip",
                          mealFilter === m.key ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]" : "text-[var(--color-text-muted)]")}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {loading ? (
                <div className="p-4 space-y-3">
                  {[1,2,3,4].map(i => <div key={i} className="nutri-skeleton-card h-[72px] rounded-xl" />)}
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center py-10 text-[13px] text-[var(--color-text-muted)]">
                  <UtensilsCrossed size={28} className="mx-auto mb-2 opacity-20" />
                  No food logged — search above to add
                </div>
              ) : (
                <div className="divide-y divide-[var(--color-border)]/10">
                  {filteredLogs.map(entry => (
                    <div key={entry.id} className={`nutri-log-row nutri-meal-accent nutri-meal-${entry.meal_type} px-4 py-3 space-y-2.5`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[14px] font-semibold text-[var(--color-text-primary)] truncate">{entry.food_name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] capitalize shrink-0">{entry.meal_type}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => addToFavorites('in', entry.food_name, Math.round(entry.calories), entry.amount, undefined, entry.serving_unit || 'g')}
                            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl hover:bg-[var(--color-accent)]/10 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] active:scale-95"><Star size={14} /></button>
                          <button onClick={() => deleteLog(entry.id)}
                            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-400 active:scale-95"><X size={14} /></button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)]/50">
                          <button onClick={() => updateWeight(entry.id, Math.max(1, entry.amount - 10))}
                            className="min-w-[36px] min-h-[36px] flex items-center justify-center text-[var(--color-text-muted)] rounded-l-xl nutri-inc-btn"><Minus size={14} /></button>
                          <NumberField value={entry.amount} onCommit={v => { if (v && v !== entry.amount) updateWeight(entry.id, v); }}
                            className="w-[48px] text-center py-2 font-semibold bg-transparent border-0 rounded-none min-h-[32px] px-0" />
                          <button onClick={() => updateWeight(entry.id, entry.amount + 10)}
                            className="min-w-[36px] min-h-[36px] flex items-center justify-center text-[var(--color-text-muted)] rounded-r-xl nutri-inc-btn"><Plus size={14} /></button>
                        </div>
                        <select value={entry.serving_unit || 'g'}
                          onChange={e => updateLog(entry.id, { serving_unit: e.target.value })}
                          className="min-h-[36px] px-2 text-[12px] bg-[var(--color-surface)] border border-[var(--color-border)]/50 rounded-xl outline-none text-[var(--color-text-muted)]">
                          {(servingUnits || ["g","ml","份","碗","杯","罐","瓶","個","包","碟"]).map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-1.5 text-[12px] tabular-nums flex-wrap">
                        <span className="font-bold text-orange-400">{Math.round(entry.calories)}</span>
                        <span className="text-[var(--color-text-muted)]">kcal</span>
                        <span className="text-blue-400 font-semibold ml-1">P</span>
                        <NumberField value={Math.round(entry.protein * 10) / 10} onCommit={v => { if (v !== null && v >= 0) updateLog(entry.id, { protein: v }); }}
                          className="w-[38px] text-center py-1 text-[12px] tabular-nums bg-transparent border-0 rounded-none min-h-[28px] px-0" step={0.1} />
                        <span className="text-amber-400 font-semibold">C</span>
                        <NumberField value={Math.round(entry.carbs * 10) / 10} onCommit={v => { if (v !== null && v >= 0) updateLog(entry.id, { carbs: v }); }}
                          className="w-[38px] text-center py-1 text-[12px] tabular-nums bg-transparent border-0 rounded-none min-h-[28px] px-0" step={0.1} />
                        <span className="text-red-400 font-semibold">F</span>
                        <NumberField value={Math.round(entry.fat * 10) / 10} onCommit={v => { if (v !== null && v >= 0) updateLog(entry.id, { fat: v }); }}
                          className="w-[38px] text-center py-1 text-[12px] tabular-nums bg-transparent border-0 rounded-none min-h-[28px] px-0" step={0.1} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
