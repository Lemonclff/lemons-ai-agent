"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, Plus, Minus, X, Camera, Apple, Loader2,
  ChevronLeft, ChevronRight, Utensils, TrendingUp,
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
  fiber_per_100g: number;
  source: string;
  source_id: string | null;
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

interface DaySummary {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  count: number;
}

const MEAL_TYPES = [
  { key: "all", label: "All" },
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snack" },
];

const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

/* ================================================================
   Page
   ================================================================ */

export default function NutritionPage() {
  // Tab: camera | search | today
  const [activeTab, setActiveTab] = useState<"camera" | "search" | "today">("today");

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Daily logs
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [summary, setSummary] = useState<DaySummary>({ calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 });
  const [logsLoading, setLogsLoading] = useState(true);
  const [mealFilter, setMealFilter] = useState("all");
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().slice(0, 10));

  // Add food modal
  const [addTarget, setAddTarget] = useState<FoodResult | null>(null);
  const [addWeight, setAddWeight] = useState(100);
  const [addMeal, setAddMeal] = useState("snack");
  const [adding, setAdding] = useState(false);

  // Swipe delete state
  const [swipedId, setSwipedId] = useState<number | null>(null);
  const touchStartX = useRef(0);

  // Debounce ref for search
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  /* ---- Fetch logs ---- */

  const fetchLogs = useCallback(async (date: string) => {
    setLogsLoading(true);
    try {
      const r = await fetch(`/api/nutrition/logs?date=${date}`);
      const json = await r.json();
      if (!json.error) {
        setLogs(json.logs || []);
        setSummary(json.summary || { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 });
      }
    } catch {}
    setLogsLoading(false);
  }, []);

  useEffect(() => {
    fetchLogs(currentDate);
  }, [currentDate, fetchLogs]);

  /* ---- Search ---- */

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 1) { setSearchResults([]); setShowDropdown(false); return; }
    setSearching(true);
    try {
      const r = await fetch(`/api/nutrition/search?q=${encodeURIComponent(q)}`);
      const json = await r.json();
      if (!json.error) {
        setSearchResults(json.results || []);
        setShowDropdown(true);
      }
    } catch {}
    setSearching(false);
  }, []);

  const onSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 350);
  };

  /* ---- Add food ---- */

  const openAddModal = (food: FoodResult) => {
    setAddTarget(food);
    setAddWeight(100);
    setAddMeal("snack");
    setShowDropdown(false);
  };

  const confirmAdd = async () => {
    if (!addTarget) return;
    setAdding(true);
    try {
      const r = await fetch("/api/nutrition/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          food_name: addTarget.food_name,
          weight_grams: addWeight,
          meal_type: addMeal,
          log_date: currentDate,
        }),
      });
      const json = await r.json();
      if (!json.error) {
        setAddTarget(null);
        fetchLogs(currentDate);
      } else {
        alert(json.error);
      }
    } catch {}
    setAdding(false);
  };

  /* ---- Delete ---- */

  const deleteEntry = async (id: number) => {
    await fetch(`/api/nutrition/logs?id=${id}`, { method: "DELETE" });
    fetchLogs(currentDate);
    setSwipedId(null);
  };

  /* ---- Date nav ---- */

  const changeDate = (delta: number) => {
    const d = new Date(currentDate + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setCurrentDate(d.toISOString().slice(0, 10));
  };

  const dateDisplay = () => {
    const d = new Date(currentDate + "T00:00:00");
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  /* ---- Filter ---- */

  const filteredLogs = mealFilter === "all" ? logs : logs.filter((l) => l.meal_type === mealFilter);

  /* ---- Swipe ---- */

  const onTouchStart = (id: number, x: number) => {
    touchStartX.current = x;
    setSwipedId(null);
  };
  const onTouchEnd = (id: number, x: number) => {
    const diff = touchStartX.current - x;
    if (diff > 60) setSwipedId(id);
    if (diff < -30) setSwipedId(null);
  };

  const isToday = currentDate === new Date().toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="w-full max-w-[500px] mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mt-2 mb-1 px-1">
        <div className="flex items-center gap-2">
          <Apple size={20} className="text-[var(--color-accent)]" />
          <h1 className="text-[18px] font-bold text-[var(--color-text-primary)]">Nutrition</h1>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => changeDate(-1)} className="p-2 rounded hover:bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]" aria-label="Previous day">
            <ChevronLeft size={18} />
          </button>
          <span className="text-[13px] font-medium text-[var(--color-text-secondary)] min-w-[80px] text-center">{dateDisplay()}</span>
          <button onClick={() => changeDate(1)} className="p-2 rounded hover:bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]" disabled={currentDate >= todayStr} aria-label="Next day">
            <ChevronRight size={18} className={cn(currentDate >= todayStr && "opacity-30")} />
          </button>
        </div>
      </div>

      {/* ---- SEARCH TAB ---- */}
      {(activeTab === "search" || activeTab === "today") && (
        <>
          {/* Search bar */}
          <div className="relative mb-2">
            <div className="flex items-center gap-2 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg px-3 h-[48px]">
              <Search size={16} className="text-[var(--color-text-muted)] shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                placeholder="Search food..."
                className="flex-1 bg-transparent text-[14px] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)]"
              />
              {searching && <Loader2 size={14} className="animate-spin text-[var(--color-text-muted)]" />}
              {searchQuery && (
                <button onClick={() => { setSearchQuery(""); setSearchResults([]); setShowDropdown(false); }} className="p-1">
                  <X size={14} className="text-[var(--color-text-muted)]" />
                </button>
              )}
            </div>

            {/* Dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg shadow-lg max-h-[280px] overflow-y-auto">
                {searchResults.map((food, i) => (
                  <button
                    key={food.source_id || i}
                    onClick={() => openAddModal(food)}
                    className="w-full text-left px-4 py-3 hover:bg-[var(--color-surface)]/50 border-b border-[var(--color-border)]/10 last:border-0 transition-colors"
                  >
                    <div className="text-[13px] font-medium text-[var(--color-text-primary)] truncate">{food.display_name || food.food_name}</div>
                    <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                      {food.calories_per_100g > 0 ? `${Math.round(food.calories_per_100g)} kcal` : "?"} · P:{food.protein_per_100g}g C:{food.carbs_per_100g}g F:{food.fat_per_100g}g <span className="text-[10px] opacity-60">per 100g</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Backdrop to close dropdown */}
            {showDropdown && (
              <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
            )}
          </div>

          {/* Camera teaser */}
          <button
            onClick={() => setActiveTab("camera")}
            className="w-full mb-3 flex flex-col items-center gap-2 py-6 rounded-xl border-2 border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]/40 hover:text-[var(--color-accent)] transition-colors"
          >
            <div className="w-16 h-16 rounded-full bg-[var(--color-surface-elevated)] flex items-center justify-center">
              <Camera size={28} />
            </div>
            <span className="text-[12px] font-medium">AI Food Recognition</span>
            <span className="text-[10px] opacity-60">Coming soon</span>
          </button>
        </>
      )}

      {/* ---- TODAY TAB ---- */}
      {activeTab === "today" && (
        <>
          {/* Meal filter chips */}
          <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
            {MEAL_TYPES.map((m) => (
              <button
                key={m.key}
                onClick={() => setMealFilter(m.key)}
                className={cn(
                  "px-3 py-1.5 text-[12px] font-medium rounded-full whitespace-nowrap transition-colors",
                  mealFilter === m.key
                    ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                    : "bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Food list */}
          {logsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={22} className="animate-spin text-[var(--color-text-muted)]" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <Utensils size={40} className="mx-auto text-[var(--color-text-muted)]/30 mb-3" />
              <p className="text-[13px] text-[var(--color-text-muted)]">
                {isToday ? "No food logged yet today" : "No food logged on this day"}
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)]/60 mt-1">
                Search above to start tracking
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredLogs.map((entry) => (
                <div key={entry.id} className="relative overflow-hidden">
                  {/* Swipe delete button behind */}
                  <button
                    onClick={() => deleteEntry(entry.id)}
                    className="absolute right-0 top-0 bottom-0 w-[72px] bg-[#ef4444] flex items-center justify-center rounded-lg"
                  >
                    <X size={18} className="text-white" />
                  </button>

                  {/* Card */}
                  <div
                    className="relative bg-[var(--color-surface-elevated)]/40 border border-[var(--color-border)]/30 rounded-lg px-4 py-3 transition-transform"
                    style={{ transform: swipedId === entry.id ? "translateX(-72px)" : "translateX(0)" }}
                    onTouchStart={(e) => onTouchStart(entry.id, e.touches[0].clientX)}
                    onTouchEnd={(e) => onTouchEnd(entry.id, e.changedTouches[0].clientX)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-[var(--color-text-primary)]">{entry.food_name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]">{MEAL_LABELS[entry.meal_type] || entry.meal_type}</span>
                        </div>
                        <div className="text-[11px] text-[var(--color-text-muted)] mt-1 tabular-nums">
                          {Math.round(entry.calories)} kcal · P:{entry.protein}g C:{entry.carbs}g F:{entry.fat}g
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[16px] font-bold text-[var(--color-text-primary)] tabular-nums">{entry.weight_grams}g</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ---- CAMERA TAB (placeholder) ---- */}
      {activeTab === "camera" && (
        <div className="flex flex-col items-center py-16">
          <div className="w-24 h-24 rounded-full bg-[var(--color-surface-elevated)] flex items-center justify-center mb-4">
            <Camera size={40} className="text-[var(--color-text-muted)]" />
          </div>
          <p className="text-[15px] font-semibold text-[var(--color-text-primary)] mb-1">AI Food Recognition</p>
          <p className="text-[12px] text-[var(--color-text-muted)] text-center max-w-[280px]">
            Take a photo of your meal and AI will identify the dishes and estimate portions. Coming in Sprint 2.
          </p>
        </div>
      )}

      {/* ---- Bottom Summary Bar ---- */}
      <div className="fixed bottom-[56px] left-0 right-0 bg-[var(--color-surface)] border-t border-[var(--color-border)] px-4 py-3 z-30 max-md:block hidden">
        <div className="max-w-[500px] mx-auto">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">Today's Total</span>
            <span className="text-[10px] text-[var(--color-text-muted)]">{summary.count} items</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="text-[18px] font-bold text-[var(--color-text-primary)] tabular-nums">{Math.round(summary.calories)}</div>
              <div className="text-[10px] text-[var(--color-text-muted)]">kcal</div>
            </div>
            <div>
              <div className="text-[15px] font-semibold text-[var(--color-accent)] tabular-nums">{summary.protein}</div>
              <div className="text-[10px] text-[var(--color-text-muted)]">Protein g</div>
            </div>
            <div>
              <div className="text-[15px] font-semibold text-[#eab308] tabular-nums">{summary.carbs}</div>
              <div className="text-[10px] text-[var(--color-text-muted)]">Carbs g</div>
            </div>
            <div>
              <div className="text-[15px] font-semibold text-[#f59e0b] tabular-nums">{summary.fat}</div>
              <div className="text-[10px] text-[var(--color-text-muted)]">Fat g</div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop summary (inline) */}
      <div className="hidden max-md:hidden mt-3 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/20">
        <div className="grid grid-cols-4 gap-3 text-center">
          <div>
            <div className="text-[20px] font-bold text-[var(--color-text-primary)] tabular-nums">{Math.round(summary.calories)}</div>
            <div className="text-[11px] text-[var(--color-text-muted)]">kcal</div>
          </div>
          <div>
            <div className="text-[16px] font-semibold text-[var(--color-accent)] tabular-nums">{summary.protein}g</div>
            <div className="text-[11px] text-[var(--color-text-muted)]">Protein</div>
          </div>
          <div>
            <div className="text-[16px] font-semibold text-[#eab308] tabular-nums">{summary.carbs}g</div>
            <div className="text-[11px] text-[var(--color-text-muted)]">Carbs</div>
          </div>
          <div>
            <div className="text-[16px] font-semibold text-[#f59e0b] tabular-nums">{summary.fat}g</div>
            <div className="text-[11px] text-[var(--color-text-muted)]">Fat</div>
          </div>
        </div>
      </div>

      {/* ---- Bottom Tab Bar ---- */}
      <div className="fixed bottom-0 left-0 right-0 bg-[var(--color-surface)] border-t border-[var(--color-border)] z-40">
        <div className="max-w-[500px] mx-auto flex items-center justify-around h-[56px]">
          <button
            onClick={() => setActiveTab("camera")}
            className={cn("flex flex-col items-center gap-0.5 py-1 px-4 transition-colors", activeTab === "camera" ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]")}
          >
            <Camera size={22} />
            <span className="text-[10px]">Camera</span>
          </button>
          <button
            onClick={() => setActiveTab("search")}
            className={cn("flex flex-col items-center gap-0.5 py-1 px-4 transition-colors", activeTab === "search" ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]")}
          >
            <Search size={22} />
            <span className="text-[10px]">Search</span>
          </button>
          <button
            onClick={() => setActiveTab("today")}
            className={cn("flex flex-col items-center gap-0.5 py-1 px-4 transition-colors", activeTab === "today" ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]")}
          >
            <TrendingUp size={22} />
            <span className="text-[10px]">Today</span>
          </button>
        </div>
      </div>

      {/* ---- Add Food Modal ---- */}
      {addTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setAddTarget(null)}>
          <div
            className="w-full max-w-[500px] bg-[var(--color-surface)] rounded-t-2xl p-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[16px] font-bold text-[var(--color-text-primary)] mb-1">{addTarget.display_name || addTarget.food_name}</h2>
            <p className="text-[11px] text-[var(--color-text-muted)] mb-4">
              {Math.round(addTarget.calories_per_100g)} kcal · P:{addTarget.protein_per_100g}g C:{addTarget.carbs_per_100g}g F:{addTarget.fat_per_100g}g <span className="opacity-60">/ 100g</span>
            </p>

            {/* Weight adjuster */}
            <label className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 block">Weight (grams)</label>
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setAddWeight((w) => Math.max(10, w - 10))}
                className="w-[44px] h-[44px] rounded-lg bg-[var(--color-surface-elevated)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-primary)] text-[20px] font-bold hover:bg-[var(--color-border)]/30 transition-colors"
              >
                <Minus size={18} />
              </button>
              <input
                type="number"
                inputMode="decimal"
                value={addWeight}
                onChange={(e) => setAddWeight(Number(e.target.value) || 0)}
                className="flex-1 h-[48px] text-center text-[22px] font-bold bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] outline-none tabular-nums"
              />
              <button
                onClick={() => setAddWeight((w) => w + 10)}
                className="w-[44px] h-[44px] rounded-lg bg-[var(--color-surface-elevated)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-primary)] text-[20px] font-bold hover:bg-[var(--color-border)]/30 transition-colors"
              >
                <Plus size={18} />
              </button>
            </div>

            {/* Quick weight presets */}
            <div className="flex gap-2 mb-4">
              {[50, 100, 150, 200, 300].map((w) => (
                <button
                  key={w}
                  onClick={() => setAddWeight(w)}
                  className={cn(
                    "px-3 py-1 text-[12px] rounded-full transition-colors",
                    addWeight === w
                      ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-semibold"
                      : "bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                  )}
                >
                  {w}g
                </button>
              ))}
            </div>

            {/* Calculated nutrition */}
            <div className="p-3 rounded-lg bg-[var(--color-surface-elevated)]/30 border border-[var(--color-border)]/30 mb-4">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="text-[16px] font-bold text-[var(--color-text-primary)] tabular-nums">
                    {Math.round(addTarget.calories_per_100g * addWeight / 100)}
                  </div>
                  <div className="text-[10px] text-[var(--color-text-muted)]">kcal</div>
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[var(--color-accent)] tabular-nums">
                    {(addTarget.protein_per_100g * addWeight / 100).toFixed(1)}
                  </div>
                  <div className="text-[10px] text-[var(--color-text-muted)]">Protein</div>
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[#eab308] tabular-nums">
                    {(addTarget.carbs_per_100g * addWeight / 100).toFixed(1)}
                  </div>
                  <div className="text-[10px] text-[var(--color-text-muted)]">Carbs</div>
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[#f59e0b] tabular-nums">
                    {(addTarget.fat_per_100g * addWeight / 100).toFixed(1)}
                  </div>
                  <div className="text-[10px] text-[var(--color-text-muted)]">Fat</div>
                </div>
              </div>
            </div>

            {/* Meal type */}
            <label className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 block">Meal</label>
            <div className="flex gap-2 mb-4">
              {MEAL_TYPES.filter((m) => m.key !== "all").map((m) => (
                <button
                  key={m.key}
                  onClick={() => setAddMeal(m.key)}
                  className={cn(
                    "flex-1 py-2 text-[12px] rounded-lg font-medium transition-colors",
                    addMeal === m.key
                      ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                      : "bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Confirm button */}
            <button
              onClick={confirmAdd}
              disabled={adding}
              className="w-full h-[48px] bg-[var(--color-accent)] text-white rounded-xl text-[15px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {adding ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
              {adding ? "Adding..." : "Add to Plate"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
