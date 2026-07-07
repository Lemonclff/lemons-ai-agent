"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, Plus, Minus, X, Camera, Apple, Loader2,
  ChevronLeft, ChevronRight, Utensils, TrendingUp,
  Settings, History, PieChart, UtensilsCrossed, Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ================================================================
   Types
   ================================================================ */

interface FoodResult {
  food_name: string;
  display_name: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  source: string;
}

interface LogEntry {
  id: number;
  food_name: string;
  weight_grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meal_type: string;
  source: string;
}

interface DaySummary { calories: number; protein: number; carbs: number; fat: number; count: number; }

interface UserProfile {
  gender: string; age: number; height_cm: number; weight_kg: number;
  activity_level: string; goal: string;
  daily_calorie_target: number; daily_protein_target: number; daily_carbs_target: number; daily_fat_target: number;
}

interface CustomFood { id: number; food_name: string; calories_per_100g: number; protein_per_100g: number; carbs_per_100g: number; fat_per_100g: number; }

const PAGES = [
  { key: "dashboard", label: "Dashboard", icon: PieChart },
  { key: "search", label: "Search", icon: Search },
  { key: "photo", label: "AI Photo", icon: Camera },
  { key: "profile", label: "Profile", icon: Settings },
  { key: "history", label: "History", icon: History },
];

const MEALS = [
  { key: "", label: "All" },
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snack" },
];

const ACTIVITY_OPTIONS = [
  { value: "sedentary", label: "Sedentary (little exercise)" },
  { value: "light", label: "Light (1-3 days/week)" },
  { value: "moderate", label: "Moderate (3-5 days/week)" },
  { value: "active", label: "Active (6-7 days/week)" },
  { value: "very_active", label: "Very Active (athlete)" },
];

const GOAL_OPTIONS = [
  { value: "lose", label: "Lose Weight (-500 kcal)" },
  { value: "maintain", label: "Maintain Weight" },
  { value: "gain", label: "Gain Weight (+500 kcal)" },
];

/* ================================================================
   Progress Ring
   ================================================================ */

function Ring({ value, max, color, label, unit }: { value: number; max: number; color: string; label: string; unit: string }) {
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

/* ================================================================
   Main Page
   ================================================================ */

export default function NutritionPage() {
  const [page, setPage] = useState("dashboard");
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().slice(0, 10));

  // Dashboard
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [summary, setSummary] = useState<DaySummary>({ calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [mealFilter, setMealFilter] = useState("");
  const [goals, setGoals] = useState({ calories: 2000, protein: 100, carbs: 250, fat: 65 });

  // Search
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [addTarget, setAddTarget] = useState<FoodResult | null>(null);
  const [addWeight, setAddWeight] = useState(100);
  const [addMeal, setAddMeal] = useState("lunch");
  const [adding, setAdding] = useState(false);
  const [customFoods, setCustomFoods] = useState<CustomFood[]>([]);
  const [customName, setCustomName] = useState("");
  const [customCal, setCustomCal] = useState("");
  const [customProtein, setCustomProtein] = useState("");
  const [customCarbs, setCustomCarbs] = useState("");
  const [customFat, setCustomFat] = useState("");

  // Profile
  const [profile, setProfile] = useState<UserProfile>({
    gender: "male", age: 30, height_cm: 170, weight_kg: 70,
    activity_level: "moderate", goal: "maintain",
    daily_calorie_target: 2000, daily_protein_target: 100, daily_carbs_target: 250, daily_fat_target: 65,
  });

  // History
  const [weeklyData, setWeeklyData] = useState<Record<string, Record<string, number>>>({});
  const [historyMonth, setHistoryMonth] = useState(new Date());

  // Toast
  const [toast, setToast] = useState("");
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const todayStr = new Date().toISOString().slice(0, 10);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  /* ---- Fetch logs ---- */
  const fetchLogs = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/nutrition/logs?date=${date}`);
      const json = await r.json();
      if (!json.error) { setLogs(json.logs || []); setSummary(json.summary); }
    } catch {}
    setLoading(false);
  }, []);

  /* ---- Fetch goals ---- */
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
      }
    } catch {}
  }, []);

  useEffect(() => { fetchLogs(currentDate); fetchGoals(); }, [currentDate, fetchLogs, fetchGoals]);

  /* ---- Search ---- */
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 1) { setSearchResults([]); setShowDropdown(false); return; }
    setSearching(true);
    try {
      const r = await fetch(`/api/nutrition/search?q=${encodeURIComponent(q)}`);
      const json = await r.json();
      if (!json.error) { setSearchResults(json.results || []); setShowDropdown(true); }
    } catch {}
    setSearching(false);
  }, []);

  const onSearch = (v: string) => {
    setSearchQ(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(v), 300);
  };

  const selectFood = (f: FoodResult) => {
    setAddTarget(f);
    setAddWeight(100);
    setAddMeal("lunch");
    setShowDropdown(false);
    setSearchQ(f.food_name);
  };

  /* ---- Add food ---- */
  const addFood = async () => {
    if (!addTarget) return;
    setAdding(true);
    try {
      const r = await fetch("/api/nutrition/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ food_name: addTarget.food_name, weight_grams: addWeight, meal_type: addMeal, log_date: currentDate }),
      });
      const json = await r.json();
      if (!json.error) {
        setAddTarget(null);
        fetchLogs(currentDate);
        showToast(`${addTarget.food_name} 已加入`);
      } else { showToast(json.error); }
    } catch {}
    setAdding(false);
  };

  /* ---- Update weight ---- */
  const updateWeight = async (id: number, newWeight: number) => {
    setLogs(prev => prev.map(l => l.id === id ? { ...l, weight_grams: newWeight } : l));
    // Recalculate summary locally
    try {
      await fetch(`/api/nutrition/logs`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
    } catch {}
    setTimeout(() => fetchLogs(currentDate), 300);
  };

  /* ---- Delete ---- */
  const deleteEntry = async (id: number) => {
    await fetch(`/api/nutrition/logs?id=${id}`, { method: "DELETE" });
    fetchLogs(currentDate);
  };

  /* ---- Copy yesterday ---- */
  const copyYesterday = async () => {
    try {
      const r = await fetch("/api/nutrition/copy-yesterday", { method: "POST" });
      const json = await r.json();
      if (json.ok) { fetchLogs(currentDate); showToast(`複製了 ${json.copied} 項食物`); }
    } catch {}
  };

  /* ---- Custom food ---- */
  const addCustomFood = async () => {
    if (!customName) return;
    try {
      const r = await fetch("/api/nutrition/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          food_name: customName,
          calories_per_100g: Number(customCal) || 0,
          protein_per_100g: Number(customProtein) || 0,
          carbs_per_100g: Number(customCarbs) || 0,
          fat_per_100g: Number(customFat) || 0,
        }),
      });
      const json = await r.json();
      if (!json.error) {
        setCustomFoods(prev => [...prev, json.food]);
        setCustomName(""); setCustomCal(""); setCustomProtein(""); setCustomCarbs(""); setCustomFat("");
        showToast("自訂食物已新增");
      }
    } catch {}
  };

  const deleteCustom = async (id: number) => {
    // No dedicated DELETE endpoint for custom — skip for now
    setCustomFoods(prev => prev.filter(f => f.id !== id));
  };

  /* ---- Profile ---- */
  const saveProfile = async () => {
    try {
      const r = await fetch("/api/nutrition/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const json = await r.json();
      if (json.profile) {
        setProfile(json.profile);
        setGoals({
          calories: json.profile.daily_calorie_target || 2000,
          protein: json.profile.daily_protein_target || 100,
          carbs: json.profile.daily_carbs_target || 250,
          fat: json.profile.daily_fat_target || 65,
        });
        showToast("設定已儲存");
      }
    } catch {}
  };

  /* ---- Weekly ---- */
  const fetchWeekly = useCallback(async (date: string) => {
    try {
      const r = await fetch(`/api/nutrition/stats/weekly?date=${date}`);
      const json = await r.json();
      if (json.weekly) setWeeklyData(json.weekly);
    } catch {}
  }, []);

  useEffect(() => { if (page === "history") fetchWeekly(currentDate); }, [page, currentDate, fetchWeekly]);

  /* ---- Helpers ---- */
  const dateDisplay = () => {
    const d = new Date(currentDate + "T00:00:00");
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const changeDate = (delta: number) => {
    const d = new Date(currentDate + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setCurrentDate(d.toISOString().slice(0, 10));
  };

  const filteredLogs = mealFilter ? logs.filter(l => l.meal_type === mealFilter) : logs;

  return (
    <div className="w-full max-w-[960px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mt-2 mb-4">
        <div className="flex items-center gap-2">
          <Apple size={22} className="text-[var(--color-accent)]" />
          <h1 className="text-[20px] font-bold text-[var(--color-text-primary)]">NutriSnap</h1>
          <span className="text-[12px] text-[var(--color-text-muted)] mt-1">Food Nutrition Analysis</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => changeDate(-1)} className="p-2 rounded hover:bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]"><ChevronLeft size={18} /></button>
          <span className="text-[13px] font-medium text-[var(--color-text-secondary)] min-w-[90px] text-center">{dateDisplay()}</span>
          <button onClick={() => changeDate(1)} className="p-2 rounded hover:bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]" disabled={currentDate >= todayStr}><ChevronRight size={18} className={cn(currentDate >= todayStr && "opacity-30")} /></button>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1 max-md:flex-nowrap">
        {PAGES.map(p => (
          <button
            key={p.key}
            onClick={() => setPage(p.key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg whitespace-nowrap transition-colors",
              page === p.key
                ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]"
            )}
          >
            <p.icon size={16} />{p.label}
          </button>
        ))}
      </div>

      {/* ================================================================
           DASHBOARD
           ================================================================ */}
      {page === "dashboard" && (
        <>
          {/* Progress Rings */}
          <div className="grid grid-cols-4 gap-3 mb-4 max-md:grid-cols-2">
            <Ring value={summary.calories} max={goals.calories} color="#3b82f6" label="Calories" unit="kcal" />
            <Ring value={summary.protein} max={goals.protein} color="#22c55e" label="Protein" unit="g" />
            <Ring value={summary.carbs} max={goals.carbs} color="#eab308" label="Carbs" unit="g" />
            <Ring value={summary.fat} max={goals.fat} color="#f59e0b" label="Fat" unit="g" />
          </div>
          {goals.calories > 0 && summary.protein < goals.protein * 0.7 && (
            <div className="text-[12px] text-[#f59e0b] mb-3 px-3 py-2 rounded border border-[#f59e0b]/20 bg-[#f59e0b]/5">
              ⚡ Protein is low today. Consider adding chicken breast, eggs, or tofu.
            </div>
          )}

          {/* Food Log */}
          <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
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
              <table className="w-full text-[13px] leading-none">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
                    <th className="text-left py-2 px-4">Food</th>
                    <th className="text-left py-2 px-2">Meal</th>
                    <th className="text-center py-2 px-2">Weight</th>
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
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => updateWeight(entry.id, Math.max(10, entry.weight_grams - 10))} className="w-6 h-6 flex items-center justify-center rounded border border-[var(--color-border)] hover:bg-[var(--color-border)]/30 text-[var(--color-text-secondary)]"><Minus size={12} /></button>
                          <input type="number" value={entry.weight_grams} onChange={e => updateWeight(entry.id, Number(e.target.value) || 0)}
                            className="w-[52px] text-center bg-transparent border border-[var(--color-border)] rounded py-0.5 text-[12px] tabular-nums outline-none"
                            inputMode="decimal" />
                          <button onClick={() => updateWeight(entry.id, entry.weight_grams + 10)} className="w-6 h-6 flex items-center justify-center rounded border border-[var(--color-border)] hover:bg-[var(--color-border)]/30 text-[var(--color-text-secondary)]"><Plus size={12} /></button>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums font-semibold">{Math.round(entry.calories)}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-[11px] text-[var(--color-text-muted)]">{entry.protein}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-[11px] text-[var(--color-text-muted)]">{entry.carbs}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-[11px] text-[var(--color-text-muted)]">{entry.fat}</td>
                      <td className="py-2 px-2 text-right">
                        <button onClick={() => deleteEntry(entry.id)} className="text-[var(--color-text-muted)] hover:text-[#ef4444]"><X size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="px-4 py-2.5 border-t border-[var(--color-border)] bg-[var(--color-surface-elevated)]/10 flex justify-between text-[13px] font-semibold">
              <span>Total ({summary.count} items)</span>
              <span className="tabular-nums">{Math.round(summary.calories)} kcal · P:{summary.protein} C:{summary.carbs} F:{summary.fat}</span>
            </div>
          </div>
        </>
      )}

      {/* ================================================================
           SEARCH
           ================================================================ */}
      {page === "search" && (
        <div className="grid gap-4 max-w-[640px]">
          {/* Search */}
          <div className="border border-[var(--color-border)] rounded-lg p-4">
            <h3 className="text-[13px] font-semibold text-[var(--color-text-secondary)] mb-3">Search Food</h3>
            <div className="relative">
              <div className="flex items-center gap-2 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg px-3 h-[44px]">
                <Search size={16} className="text-[var(--color-text-muted)] shrink-0" />
                <input value={searchQ} onChange={e => onSearch(e.target.value)} onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                  placeholder="Search (e.g. chicken breast, rice...)" className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--color-text-muted)]" />
                {searching && <Loader2 size={14} className="animate-spin text-[var(--color-text-muted)]" />}
              </div>
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg shadow-lg max-h-[240px] overflow-y-auto">
                  {searchResults.map((f, i) => (
                    <button key={f.food_name + i} onClick={() => selectFood(f)}
                      className="w-full text-left px-4 py-2.5 hover:bg-[var(--color-surface)]/50 border-b border-[var(--color-border)]/10 last:border-0 transition-colors flex justify-between items-center">
                      <div>
                        <div className="text-[13px] font-medium">{f.food_name}</div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">{f.source === "local" ? "Local DB" : f.source === "custom" ? "Custom" : "Open Food Facts"}</div>
                      </div>
                      <span className="text-[12px] text-[var(--color-text-muted)] tabular-nums">{Math.round(f.calories_per_100g)} kcal/100g</span>
                    </button>
                  ))}
                </div>
              )}
              {showDropdown && <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />}
            </div>

            {/* Inline add row */}
            {addTarget && (
              <div className="flex items-center gap-3 mt-3 p-3 rounded-lg bg-[var(--color-surface-elevated)]/20 border border-[var(--color-border)]/30">
                <span className="text-[13px] font-medium text-[var(--color-text-primary)] shrink-0">{addTarget.food_name}</span>
                <select value={addMeal} onChange={e => setAddMeal(e.target.value)}
                  className="text-[12px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1.5 outline-none">
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                </select>
                <div className="flex items-center gap-1">
                  <button onClick={() => setAddWeight(w => Math.max(10, w - 10))} className="w-7 h-7 flex items-center justify-center rounded border border-[var(--color-border)] hover:bg-[var(--color-border)]/30"><Minus size={12} /></button>
                  <input type="number" value={addWeight} onChange={e => setAddWeight(Number(e.target.value) || 0)}
                    className="w-[60px] text-center bg-transparent border border-[var(--color-border)] rounded py-1 text-[13px] tabular-nums outline-none" inputMode="decimal" />
                  <button onClick={() => setAddWeight(w => w + 10)} className="w-7 h-7 flex items-center justify-center rounded border border-[var(--color-border)] hover:bg-[var(--color-border)]/30"><Plus size={12} /></button>
                  <span className="text-[12px] text-[var(--color-text-muted)]">g</span>
                </div>
                <button onClick={addFood} disabled={adding}
                  className="ml-auto px-4 py-1.5 text-[12px] font-medium rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {adding ? "..." : "Add"}
                </button>
              </div>
            )}
          </div>

          {/* Custom Food */}
          <div className="border border-[var(--color-border)] rounded-lg p-4">
            <h3 className="text-[13px] font-semibold text-[var(--color-text-secondary)] mb-3">Add Custom Food</h3>
            <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
              <div><label className="text-[11px] text-[var(--color-text-muted)] block mb-1">Name</label><input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="e.g. Protein shake" className="w-full px-3 py-1.5 text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none" /></div>
              <div><label className="text-[11px] text-[var(--color-text-muted)] block mb-1">Calories (/100g)</label><input value={customCal} onChange={e => setCustomCal(e.target.value)} placeholder="kcal" className="w-full px-3 py-1.5 text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none" /></div>
              <div><label className="text-[11px] text-[var(--color-text-muted)] block mb-1">Protein (/100g)</label><input value={customProtein} onChange={e => setCustomProtein(e.target.value)} placeholder="g" className="w-full px-3 py-1.5 text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none" /></div>
              <div><label className="text-[11px] text-[var(--color-text-muted)] block mb-1">Carbs (/100g)</label><input value={customCarbs} onChange={e => setCustomCarbs(e.target.value)} placeholder="g" className="w-full px-3 py-1.5 text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none" /></div>
              <div><label className="text-[11px] text-[var(--color-text-muted)] block mb-1">Fat (/100g)</label><input value={customFat} onChange={e => setCustomFat(e.target.value)} placeholder="g" className="w-full px-3 py-1.5 text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none" /></div>
            </div>
            <button onClick={addCustomFood} className="mt-3 px-4 py-1.5 text-[12px] font-medium rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90">Add Custom Food</button>
          </div>
        </div>
      )}

      {/* ================================================================
           PHOTO (placeholder)
           ================================================================ */}
      {page === "photo" && (
        <div className="max-w-[480px] mx-auto">
          <div className="border-2 border-dashed border-[var(--color-border)] rounded-xl p-10 text-center cursor-pointer hover:border-[var(--color-accent)]/40 transition-colors">
            <Camera size={40} className="mx-auto text-[var(--color-text-muted)] mb-3" />
            <div className="text-[14px] text-[var(--color-text-muted)] mb-1">Click or drag to upload food photo</div>
            <div className="text-[11px] text-[var(--color-text-muted)]/60">AI photo recognition coming soon</div>
          </div>
        </div>
      )}

      {/* ================================================================
           PROFILE
           ================================================================ */}
      {page === "profile" && (
        <div className="max-w-[560px]">
          <div className="border border-[var(--color-border)] rounded-lg p-4">
            <h3 className="text-[13px] font-semibold text-[var(--color-text-secondary)] mb-3">TDEE Calculator</h3>
            <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1 mb-4">
              <div>
                <label className="text-[11px] text-[var(--color-text-muted)] block mb-1">Gender</label>
                <select value={profile.gender} onChange={e => setProfile(p => ({ ...p, gender: e.target.value }))}
                  className="w-full px-3 py-1.5 text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none">
                  <option value="male">Male</option><option value="female">Female</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-[var(--color-text-muted)] block mb-1">Age</label>
                <input type="number" value={profile.age} onChange={e => setProfile(p => ({ ...p, age: Number(e.target.value) }))}
                  className="w-full px-3 py-1.5 text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none" />
              </div>
              <div>
                <label className="text-[11px] text-[var(--color-text-muted)] block mb-1">Height (cm)</label>
                <input type="number" value={profile.height_cm} onChange={e => setProfile(p => ({ ...p, height_cm: Number(e.target.value) }))}
                  className="w-full px-3 py-1.5 text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none" />
              </div>
              <div>
                <label className="text-[11px] text-[var(--color-text-muted)] block mb-1">Weight (kg)</label>
                <input type="number" value={profile.weight_kg} onChange={e => setProfile(p => ({ ...p, weight_kg: Number(e.target.value) }))}
                  className="w-full px-3 py-1.5 text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none" />
              </div>
              <div>
                <label className="text-[11px] text-[var(--color-text-muted)] block mb-1">Activity Level</label>
                <select value={profile.activity_level} onChange={e => setProfile(p => ({ ...p, activity_level: e.target.value }))}
                  className="w-full px-3 py-1.5 text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none">
                  {ACTIVITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-[var(--color-text-muted)] block mb-1">Goal</label>
                <select value={profile.goal} onChange={e => setProfile(p => ({ ...p, goal: e.target.value }))}
                  className="w-full px-3 py-1.5 text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none">
                  {GOAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <button onClick={saveProfile} className="px-4 py-1.5 text-[12px] font-medium rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90">Save & Calculate Goals</button>

            {goals.calories > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-[var(--color-surface-elevated)]/20 border border-[var(--color-border)]/30">
                <div className="text-[12px] font-semibold text-[var(--color-text-secondary)] mb-2">Daily Targets</div>
                <div className="grid grid-cols-2 gap-2 text-[13px]">
                  <div>Calories: <strong>{goals.calories} kcal</strong></div>
                  <div>Protein: <strong>{goals.protein} g</strong></div>
                  <div>Carbs: <strong>{goals.carbs} g</strong></div>
                  <div>Fat: <strong>{goals.fat} g</strong></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================
           HISTORY
           ================================================================ */}
      {page === "history" && (
        <div className="grid gap-4 max-w-[640px]">
          <div className="border border-[var(--color-border)] rounded-lg p-4">
            <h3 className="text-[13px] font-semibold text-[var(--color-text-secondary)] mb-3">7-Day Calorie Trend</h3>
            <div className="flex items-end gap-1 h-[180px]">
              {Object.entries(weeklyData).map(([date, vals]) => {
                const maxVal = Math.max(...Object.values(weeklyData).map(v => v.calories), 1);
                const h = (vals.calories / maxVal) * 140;
                const label = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
                return (
                  <div key={date} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">{vals.calories}</span>
                    <div className="w-full rounded-t" style={{ height: Math.max(h, 4), background: date === currentDate ? "var(--color-accent)" : "var(--color-border)", opacity: date === currentDate ? 1 : 0.5, transition: "height 0.3s" }} />
                    <span className="text-[10px] text-[var(--color-text-muted)]">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mini Calendar */}
          <div className="border border-[var(--color-border)] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => { const d = new Date(historyMonth); d.setMonth(d.getMonth() - 1); setHistoryMonth(d); }} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"><ChevronLeft size={16} /></button>
              <span className="text-[13px] font-semibold text-[var(--color-text-secondary)]">{historyMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
              <button onClick={() => { const d = new Date(historyMonth); d.setMonth(d.getMonth() + 1); setHistoryMonth(d); }} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"><ChevronRight size={16} /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => <div key={d} className="text-[10px] text-[var(--color-text-muted)] py-1">{d}</div>)}
              {(() => {
                const y = historyMonth.getFullYear(); const m = historyMonth.getMonth();
                const firstDay = new Date(y, m, 1).getDay();
                const daysInMonth = new Date(y, m + 1, 0).getDate();
                const cells = [];
                for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} />);
                for (let d = 1; d <= daysInMonth; d++) {
                  const ds = `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
                  const isToday = ds === todayStr;
                  const isSelected = ds === currentDate;
                  cells.push(
                    <button key={d} onClick={() => setCurrentDate(ds)}
                      className={cn("py-1.5 text-[11px] rounded hover:bg-[var(--color-surface-elevated)] transition-colors",
                        isToday && "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent)]",
                        isSelected && !isToday && "bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-semibold"
                      )}>{d}</button>
                  );
                }
                return cells;
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg shadow-lg text-[13px] text-[var(--color-text-primary)] animate-in">
          {toast}
        </div>
      )}
    </div>
  );
}
