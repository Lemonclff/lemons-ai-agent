"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, Plus, Minus, X, Camera, Apple, Loader2,
  ChevronLeft, ChevronRight, Utensils, TrendingUp,
  Settings, History, PieChart, UtensilsCrossed, Copy,
  Maximize2, Minimize2, LayoutDashboard, Dumbbell, UserCircle,
  Flame, Zap,
} from "lucide-react";


import { Ring } from "./components/Ring";
import { DashboardTab } from "./components/DashboardTab";
import { SearchTab } from "./components/SearchTab";
import { PhotoTab } from "./components/PhotoTab";
import { ProfileTab } from "./components/ProfileTab";
import { HistoryTab } from "./components/HistoryTab";
import { CaloriesOutTab } from "./components/CaloriesOutTab";
import { Tabs } from "@/components/ui/components";
import { cn } from "@/lib/utils";

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
  body_fat_pct?: number;
  activity_level: string; goal: string;
  daily_calorie_target: number; daily_protein_target: number; daily_carbs_target: number; daily_fat_target: number;
  daily_bmr?: number; daily_tdee?: number;
}
interface CustomFood { id: number; food_name: string; calories_per_100g: number; protein_per_100g: number; carbs_per_100g: number; fat_per_100g: number; }

const PAGES = [
  { key: "dashboard", label: "Home", shortLabel: "Home", icon: LayoutDashboard, color: "text-sky-400" },
  { key: "search", label: "Calories In", shortLabel: "In", icon: UtensilsCrossed, color: "text-orange-400" },
  { key: "calories-out", label: "Calories Out", shortLabel: "Out", icon: Dumbbell, color: "text-green-400" },
  { key: "photo", label: "AI Photo", shortLabel: "Photo", icon: Camera, color: "text-purple-400" },
  { key: "history", label: "History", shortLabel: "Hist", icon: History, color: "text-amber-400" },
  { key: "profile", label: "Profile", shortLabel: "Me", icon: UserCircle, color: "text-indigo-400" },
];

const PAGE_ORDER = PAGES.map(p => p.key);

/* ================================================================
   Main Page
   ================================================================ */

export default function NutritionPage() {
  const [page, setPage] = useState("dashboard");
  const touchStartX = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    const idx = PAGE_ORDER.indexOf(page);
    if (diff > 50 && idx < PAGE_ORDER.length - 1) setPage(PAGE_ORDER[idx + 1]);
    if (diff < -50 && idx > 0) setPage(PAGE_ORDER[idx - 1]);
  };
  const [fullscreen, setFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    if (window.innerWidth < 768) setFullscreen(true);
  }, []);
  // On mobile, auto-enter fullscreen. Show nothing until mounted to avoid flash.
  const showFullscreen = mounted ? fullscreen : false;
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  });

  // Dashboard
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [summary, setSummary] = useState<DaySummary>({ calories: 0, protein: 0, carbs: 0, fat: 0, count: 0, exercise_calories: 0 });
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
  const [addServingUnit, setAddServingUnit] = useState("g");
  const [servingUnits, setServingUnits] = useState<string[]>(["g", "ml", "份", "碗", "杯", "罐", "瓶", "個", "包", "碟"]);
  const [adding, setAdding] = useState(false);
  const [customFoods, setCustomFoods] = useState<CustomFood[]>([]);
  const [editCustId, setEditCustId] = useState<number | null>(null);
  const [editCustName, setEditCustName] = useState("");
  const [editCustCal, setEditCustCal] = useState("");
  const [editCustP, setEditCustP] = useState("");
  const [editCustC, setEditCustC] = useState("");
  const [editCustF, setEditCustF] = useState("");
  const [customName, setCustomName] = useState("");
  const [customCal, setCustomCal] = useState("");
  const [customProtein, setCustomProtein] = useState("");
  const [customCarbs, setCustomCarbs] = useState("");
  const [customFat, setCustomFat] = useState("");
  const [customMeal, setCustomMeal] = useState("snack");
  const [customServingUnit, setCustomServingUnit] = useState("g");
  const [customFavorite, setCustomFavorite] = useState(false);

  // Exercise
  const [exercises, setExercises] = useState<any[]>([]);
  const [exName, setExName] = useState("");
  const [exDuration, setExDuration] = useState(30);
  const [exDropdown, setExDropdown] = useState(false);
  const [exList, setExList] = useState<{name:string,met:number,category:string}[]>([]);
  const [exSearch, setExSearch] = useState("");
  const [exCustom, setExCustom] = useState(false);
  const [exCustomName, setExCustomName] = useState("");
  const [exCustomCal, setExCustomCal] = useState("");

  // Favorites (curated + suggested)
  const [favorites, setFavorites] = useState<{ in: any[]; out: any[] }>({ in: [], out: [] });
  const [suggested, setSuggested] = useState<{ in: any[]; out: any[] }>({ in: [], out: [] });

  // Profile
  const [profile, setProfile] = useState<UserProfile>({
    gender: "male", age: 30, height_cm: 170, weight_kg: 70,
    activity_level: "moderate", goal: "maintain",
    daily_calorie_target: 2000, daily_protein_target: 100, daily_carbs_target: 250, daily_fat_target: 65,
  });
  const [profileChecked, setProfileChecked] = useState(false);
  const [hasProfile, setHasProfile] = useState(true); // optimistic, set false if API returns null

  // History
  const [weeklyData, setWeeklyData] = useState<Record<string, Record<string, number>>>({});
  const [historyMonth, setHistoryMonth] = useState(new Date());

  // Photo
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoAnalyzing, setPhotoAnalyzing] = useState(false);
  const [photoResult, setPhotoResult] = useState<any>(null);
  const [photoError, setPhotoError] = useState("");
  const [photoMealType, setPhotoMealType] = useState("lunch");
  const [photoConfirming, setPhotoConfirming] = useState(false);
  const [photoDragOver, setPhotoDragOver] = useState(false);
  const [photoProvider, setPhotoProvider] = useState("agnes");
  const [photoNutrition, setPhotoNutrition] = useState<Record<string, any>>({});
  const [photoEditedWeights, setPhotoEditedWeights] = useState<Record<number, number>>({});
  const [photoUnits, setPhotoUnits] = useState<Record<number, string>>({});
  const [selectedDishes, setSelectedDishes] = useState<Set<number>>(new Set());
  const [editedNutrition, setEditedNutrition] = useState<Record<number, {cal:number,p:number,c:number,f:number}>>({});
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const PHOTO_PROVIDERS = [
    { value: "agnes", label: "Agnes AI (agnes-2.0-flash)", hasVision: true },
    { value: "gemini", label: "Google Gemini (gemini-2.0-flash)", hasVision: true },
    { value: "openai", label: "OpenAI (gpt-4o)", hasVision: true },
    { value: "openrouter", label: "OpenRouter", hasVision: true },
    { value: "nemotron", label: "NVIDIA", hasVision: true },
    { value: "local", label: "Local LLM", hasVision: true },
  ];

  // Toast
  const [toast, setToast] = useState("");
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const formatLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const todayStr = formatLocal(new Date());
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
        setHasProfile(true);
        setGoals({
          calories: json.profile.daily_calorie_target || 2000,
          protein: json.profile.daily_protein_target || 100,
          carbs: json.profile.daily_carbs_target || 250,
          fat: json.profile.daily_fat_target || 65,
        });
      } else {
        setHasProfile(false);
      }
    } catch { setHasProfile(false); }
    setProfileChecked(true);
  }, []);

  useEffect(() => { fetchLogs(currentDate); fetchExercises(); fetchFavorites(); }, [currentDate, fetchLogs]);
  useEffect(() => { fetchGoals(); fetchExList(); }, [fetchGoals]);
  useEffect(() => {
    fetch("/api/nutrition/logs?action=units").then(r => r.json()).then(d => {
      if (d.units?.length) setServingUnits(d.units);
    }).catch(() => {});
  }, []);

  /* ---- Update log entry ---- */
  const updateLog = async (id: number, fields: { amount?: number; serving_unit?: string; calories?: number; protein?: number; carbs?: number; fat?: number }) => {
    // Optimistic update
    setLogs(prev => prev.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l };
      if (fields.amount !== undefined) updated.amount = fields.amount;
      if (fields.serving_unit !== undefined) updated.serving_unit = fields.serving_unit;
      if (fields.calories !== undefined) updated.calories = fields.calories;
      if (fields.protein !== undefined) updated.protein = fields.protein;
      if (fields.carbs !== undefined) updated.carbs = fields.carbs;
      if (fields.fat !== undefined) updated.fat = fields.fat;
      return updated;
    }));
    try {
      await fetch(`/api/nutrition/logs?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      // Only re-fetch if macros/weight changed — serving_unit is cosmetic
      if (fields.amount !== undefined || fields.calories !== undefined ||
          fields.protein !== undefined || fields.carbs !== undefined || fields.fat !== undefined) {
        fetchLogs(currentDate);
      }
    } catch {}
  };

  // Backward-compat wrapper for weight-only updates
  const updateWeight = (id: number, weight: number) => {
    // Pass current macros as overrides so changing amount doesn't recalculate nutrition
    const entry = logs.find(l => l.id === id);
    if (entry) {
      updateLog(id, { amount: weight, calories: entry.calories, protein: entry.protein, carbs: entry.carbs, fat: entry.fat });
    } else {
      updateLog(id, { amount: weight });
    }
  };

  const deleteLog = async (id: number) => {
    setLogs(prev => prev.filter(l => l.id !== id));
    try { await fetch(`/api/nutrition/logs?id=${id}`, { method: "DELETE" }); fetchLogs(currentDate); } catch {}
  };

  const copyYesterday = async () => {
    try {
      await fetch("/api/nutrition/copy-yesterday", { method: "POST" });
      fetchLogs(currentDate);
      showToast("Copied yesterday's meals");
    } catch { showToast("Copy failed"); }
  };

  /* ---- Search ---- */
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

  const selectFood = (f: FoodResult) => {
    setAddTarget(f); setShowDropdown(false); setSearchQ("");
    // Reset weight based on current unit
    const isWeight = addServingUnit === 'g' || addServingUnit === 'ml';
    setAddWeight(isWeight ? 100 : 1);
  };

  const addFood = async () => {
    if (!addTarget) return;
    setAdding(true);
    try {
      await fetch("/api/nutrition/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ food_name: addTarget.food_name, amount: addWeight, meal_type: addMeal, serving_unit: addServingUnit, log_date: currentDate }),
      });
      setAddTarget(null); setAddWeight(100); setAddServingUnit("g");
      fetchLogs(currentDate);
      showToast(`Added ${addTarget.food_name}`);
    } catch { showToast("Failed to add"); }
    setAdding(false);
  };

  const addCustomFood = async () => {
    if (!customName) return;
    try {
      const r = await fetch("/api/nutrition/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ food_name: customName, calories_per_100g: Number(customCal)||0, protein_per_100g: Number(customProtein)||0, carbs_per_100g: Number(customCarbs)||0, fat_per_100g: Number(customFat)||0, is_favorite: customFavorite, default_weight: 100, default_serving_unit: customServingUnit }),
      });
      const json = await r.json();
      if (!json.error) {
        setCustomFoods(prev => [...prev, json.food]);
        setCustomName(""); setCustomCal(""); setCustomProtein(""); setCustomCarbs(""); setCustomFat(""); setCustomServingUnit("g"); setCustomFavorite(false);
        const weight = 100;
        const logRes = await fetch("/api/nutrition/logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ food_name: json.food.food_name, amount: weight, meal_type: customMeal, serving_unit: customServingUnit, log_date: todayStr }),
        });
        const logJson = await logRes.json();
        if (logJson.error) { showToast(`Failed to log: ${logJson.error}`); return; }
        fetchLogs(currentDate); fetchCustoms();
        showToast("Custom food added & logged");
      } else {
        showToast(`Error: ${json.error}`);
      }
    } catch (e: any) { showToast(`Failed: ${e.message || String(e)}`); }
  };

  const deleteCustom = async (id: number) => {
    try { await fetch(`/api/nutrition/custom?id=${id}`, { method: "DELETE" }); setCustomFoods(prev => prev.filter(f => f.id !== id)); showToast("Custom food deleted"); } catch {}
  };
  const startEditCustom = (f: CustomFood) => { setEditCustId(f.id); setEditCustName(f.food_name); setEditCustCal(String(f.calories_per_100g)); setEditCustP(String(f.protein_per_100g)); setEditCustC(String(f.carbs_per_100g)); setEditCustF(String(f.fat_per_100g)); };
  const saveEditCustom = async () => {
    if (!editCustId || !editCustName) return;
    try {
      const r = await fetch(`/api/nutrition/custom?id=${editCustId}`, { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ food_name: editCustName, calories_per_100g: Number(editCustCal)||0, protein_per_100g: Number(editCustP)||0, carbs_per_100g: Number(editCustC)||0, fat_per_100g: Number(editCustF)||0 }) });
      const json = await r.json();
      if (!json.error) { setCustomFoods(prev => prev.map(f => f.id === editCustId ? json.food : f)); setEditCustId(null); showToast("Custom food updated"); }
    } catch {}
  };
  const fetchCustoms = useCallback(async () => { try { const r = await fetch("/api/nutrition/custom"); const json = await r.json(); if (json.foods) setCustomFoods(json.foods); } catch {} }, []);

  /* ---- Exercise ---- */
  const fetchExercises = async () => {
    try {
      const r = await fetch(`/api/nutrition/exercise?date=${currentDate}`);
      const json = await r.json();
      if (json.exercises) setExercises(json.exercises);
    } catch {}
  };
  const fetchExList = async () => {
    try {
      const r = await fetch("/api/nutrition/exercises");
      const json = await r.json();
      if (json.exercises) setExList(json.exercises);
    } catch {}
  };
  const addExercise = async () => {
    const name = exName;
    if (!name) return;
    try {
      const body: any = { exercise_name: name, log_date: currentDate, duration_min: exDuration };
      if (exCustomCal) {
        body.calories_burned = Number(exCustomCal);
      }
      await fetch("/api/nutrition/exercise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setExName(""); setExDuration(30); setExCustomCal("");
      fetchExercises(); fetchLogs(currentDate);
      showToast(`Logged ${name}`);
    } catch {}
  };
  const deleteExercise = async (id: number) => {
    try { await fetch(`/api/nutrition/exercise?id=${id}`, { method: "DELETE" }); fetchExercises(); fetchLogs(currentDate); } catch {}
  };
  const updateExercise = async (id: number, data: { duration_min?: number; calories_burned?: number }) => {
    // Optimistic update
    setExercises(prev => prev.map(ex => {
      if (ex.id !== id) return ex;
      const updated = { ...ex };
      if (data.duration_min !== undefined) updated.duration_min = data.duration_min;
      if (data.calories_burned !== undefined) updated.calories_burned = data.calories_burned;
      return updated;
    }));
    try {
      await fetch(`/api/nutrition/exercise?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      fetchExercises(); fetchLogs(currentDate);
    } catch {}
  };

  /* ---- Favorites (curated + suggested) ---- */
  const fetchFavorites = async () => {
    try {
      const r = await fetch("/api/nutrition/favorites");
      const json = await r.json();
      if (json.favorites) setFavorites(json.favorites);
      if (json.suggested) setSuggested(json.suggested);
    } catch {}
  };

  const addToFavorites = async (type: 'in'|'out', name: string, calories?: number, default_weight?: number, default_duration?: number, serving_unit?: string) => {
    try {
      const r = await fetch("/api/nutrition/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name, calories: calories || 0, default_weight, default_duration, serving_unit: serving_unit || 'g' }),
      });
      const json = await r.json();
      if (json.favorite) {
        // Move from suggested to curated
        setFavorites(prev => ({
          ...prev,
          [type]: [...prev[type], json.favorite],
        }));
        setSuggested(prev => ({
          ...prev,
          [type]: prev[type].filter((s: any) => s.name !== name),
        }));
        showToast(`⭐ Pinned "${name}" to favorites`);
      }
    } catch {}
  };

  const removeFavorite = async (type: 'in'|'out', id: number) => {
    try {
      await fetch(`/api/nutrition/favorites?id=${id}&type=${type}`, { method: "DELETE" });
      setFavorites(prev => ({
        ...prev,
        [type]: prev[type].filter((f: any) => f.id !== id),
      }));
      fetchFavorites(); // refresh to repopulate suggested
      showToast("Removed from favorites");
    } catch {}
  };

  const quickAddIn = async (f: any) => {
    try {
      const unit = f.default_serving_unit || f.default_unit || 'g';
      const isWeightUnit = unit === 'g' || unit === 'ml';
      // If we have serving nutrition (from AI photo etc), pass it directly
      const hasServingNutrition = f.serving_calories != null && Number(f.serving_calories) > 0;

      let amount: number, serving_unit: string;
      let extraBody: Record<string, any> = {};

      if (hasServingNutrition) {
        // Use serving display values — pass nutrition directly
        amount = f.default_weight || 1;
        serving_unit = unit;
        const servings = Number(amount);
        extraBody = {
          calories: Math.round(Number(f.serving_calories) * servings),
          protein: parseFloat((Number(f.serving_protein || 0) * servings).toFixed(1)),
          carbs: parseFloat((Number(f.serving_carbs || 0) * servings).toFixed(1)),
          fat: parseFloat((Number(f.serving_fat || 0) * servings).toFixed(1)),
        };
      } else if (isWeightUnit) {
        amount = f.default_weight || f.avg_weight || 100;
        serving_unit = unit;
      } else {
        const servings = f.default_weight || 1;
        const gPerServing = f.grams_per_serving || 100;
        amount = servings * gPerServing;
        serving_unit = 'g';
      }

      await fetch("/api/nutrition/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          food_name: f.name, amount, meal_type: mealFilter || "snack",
          serving_unit, log_date: currentDate, ...extraBody,
        }),
      });
      fetchLogs(currentDate);
      const display = hasServingNutrition ? `${amount}${serving_unit} (${Number(f.serving_calories) * amount} kcal)` : `${amount}${serving_unit}`;
      showToast(`Quick added ${f.name} (${display})`);
    } catch { showToast("Failed to add"); }
  };

  const quickAddOut = async (f: any) => {
    try {
      const duration = f.default_duration || 30;
      await fetch("/api/nutrition/exercise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exercise_name: f.name, duration_min: duration, log_date: todayStr }),
      });
      fetchExercises(); fetchLogs(currentDate);
      showToast(`Quick added ${f.name} (${duration} min)`);
    } catch { showToast("Failed to add"); }
  };

  /* ---- Profile ---- */
  const saveProfile = async () => {
    try {
      const r = await fetch("/api/nutrition/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
      const json = await r.json();
      if (json.profile) { setProfile(json.profile); setHasProfile(true); setGoals({ calories: json.profile.daily_calorie_target||2000, protein: json.profile.daily_protein_target||100, carbs: json.profile.daily_carbs_target||250, fat: json.profile.daily_fat_target||65 }); showToast("Profile saved"); }
    } catch { showToast("Save failed"); }
  };

  /* ---- History ---- */
  const fetchWeekly = useCallback(async (date: string) => {
    try { const r = await fetch(`/api/nutrition/stats/weekly?date=${date}`); const json = await r.json(); if (json.weekly) setWeeklyData(json.weekly); } catch {}
  }, []);
  useEffect(() => { if (page === "history") fetchWeekly(currentDate); }, [page, currentDate, fetchWeekly]);
  useEffect(() => { if (page === "search") fetchCustoms(); }, [page, fetchCustoms]);

  /* ---- Helpers ---- */
  const dateDisplay = () => {
    const d = new Date(currentDate + "T12:00:00");
    const today = new Date();
    if (formatLocal(d) === formatLocal(today)) return "Today";
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    if (formatLocal(d) === formatLocal(yesterday)) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  const changeDate = (delta: number) => {
    const d = new Date(currentDate + "T12:00:00");
    d.setDate(d.getDate() + delta);
    setCurrentDate(formatLocal(d));
  };
  const filteredLogs = mealFilter ? logs.filter(l => l.meal_type === mealFilter) : logs;

  /* ---- Photo handlers ---- */
  const handlePhotoSelect = (file: File) => {
    if (!file.type.startsWith("image/")) { showToast("Please select an image file"); return; }
    if (file.size > 10 * 1024 * 1024) { showToast("Image must be under 10MB"); return; }
    setPhotoFile(file); setPhotoResult(null); setPhotoError("");
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };
  const handlePhotoDrop = (e: React.DragEvent) => { e.preventDefault(); setPhotoDragOver(false); const file = e.dataTransfer.files[0]; if (file) handlePhotoSelect(file); };

  const processPhotoResult = async (json: any) => {
    setPhotoResult(json);
    const weights: Record<number, number> = {};
    const units: Record<number, string> = {};
    const initNutrition: Record<number, {cal:number,p:number,c:number,f:number}> = {};
    json.dishes?.forEach((d: any, i: number) => {
      const unit = d.unit || d.suggested_unit || 'g';
      const gramsPerServing = d.grams_per_serving || d.estimated_weight_grams || 100;
      const isWeight = unit === 'g' || unit === 'ml';
      weights[i] = isWeight ? gramsPerServing : 1;
      units[i] = unit;
      if (d.calories !== undefined) initNutrition[i] = { cal: d.calories, p: d.protein_g||0, c: d.carbs_g||0, f: d.fat_g||0 };
    });
    setPhotoEditedWeights(weights); setPhotoUnits(units);
    setEditedNutrition(initNutrition); setSelectedDishes(new Set(json.dishes?.map((_:any,i:number)=>i)||[]));
    if (json.dishes?.length > 0) {
      const nutritionMap: Record<string, any> = {};
      await Promise.all(json.dishes.map(async (d: any) => {
        try {
          let nr = await fetch(`/api/nutrition/search?q=${encodeURIComponent(d.name)}`); let nj = await nr.json();
          if (nj.results?.[0]) { nutritionMap[d.name] = nj.results[0]; return; }
          const keywords = d.name.split(/[/、\s]+/).filter((k:string)=>k.length>1);
          for (const kw of keywords) { nr = await fetch(`/api/nutrition/search?q=${encodeURIComponent(kw)}`); nj = await nr.json(); if (nj.results?.[0]) { nutritionMap[d.name] = nj.results[0]; break; } }
          if (nutritionMap[d.name]) return;
          for (let i=0;i<=d.name.length-2;i++) { const slice = d.name.slice(i,i+2); nr = await fetch(`/api/nutrition/search?q=${encodeURIComponent(slice)}`); nj = await nr.json(); if (nj.results?.[0]) { nutritionMap[d.name] = nj.results[0]; break; } }
        } catch {}
      }));
      setPhotoNutrition(nutritionMap);
    }
  };

  const handlePasteResult = (json: any) => {
    processPhotoResult(json);
  };
  const handleAnalyze = async () => {
    if (!photoFile) return;
    setPhotoAnalyzing(true); setPhotoError("");
    try {
      const fd = new FormData(); fd.append("image", photoFile); fd.append("provider", photoProvider);
      const r = await fetch("/api/nutrition/analyze-image", { method: "POST", body: fd });
      const json = await r.json();
      if (json.status === "error") { setPhotoError(json.message); }
      else {
        processPhotoResult(json);
      }
    } catch (e) { setPhotoError(String(e)); }
    setPhotoAnalyzing(false);
  };
  const handleConfirmAnalysis = async () => {
    if (!photoResult?.dishes?.length) return;
    setPhotoConfirming(true);
    try {
      const selectedDishesList = photoResult.dishes.filter((_:any,i:number)=>selectedDishes.has(i)).map((d:any,i:number)=>{
        const aiNut=editedNutrition[i];
        const rawGrams = d.grams_per_serving || d.estimated_weight_grams || 100;
        const unit = photoUnits[i] || d.unit || d.suggested_unit || 'g';
        const isWeight = unit === 'g' || unit === 'ml';
        // Use display weight for serving units (1匙, not 47匙)
        const amount = photoEditedWeights[i] ?? (isWeight ? rawGrams : 1);
        return {
          name: d.name,
          amount: amount,
          unit: unit,
          grams_per_serving: rawGrams,
          ...(aiNut ? { ai_calories: aiNut.cal, ai_protein: aiNut.p, ai_carbs: aiNut.c, ai_fat: aiNut.f } : {}),
        };
      });
      if (selectedDishesList.length===0) { showToast("No dishes selected"); return; }
      const r = await fetch("/api/nutrition/confirm-analysis", { method: "POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({dishes:selectedDishesList,meal_type:photoMealType,log_date:currentDate}) });
      const json = await r.json(); const addedCount = json.added?.filter((a:any)=>a.status==="added").length||0;
      showToast(`Logged ${addedCount} dishes to ${photoMealType}`);
      setPhotoFile(null); setPhotoPreview(""); setPhotoResult(null); fetchLogs(currentDate);
    } catch (e) { showToast("Failed to save"); }
    setPhotoConfirming(false);
  };
  const resetPhoto = () => { setPhotoFile(null); setPhotoPreview(""); setPhotoResult(null); setPhotoError(""); setPhotoNutrition({}); setPhotoEditedWeights({}); setPhotoUnits({}); setSelectedDishes(new Set()); setEditedNutrition({}); setPasteMode(false); setPasteText(""); };

  /* ---- Render ---- */
  const currentPageIdx = PAGE_ORDER.indexOf(page);

  // ── Profile gate: block all tabs until profile is set ──
  if (profileChecked && !hasProfile && page !== "profile") {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--color-surface)] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--color-accent)]/15 flex items-center justify-center ring-1 ring-[var(--color-accent)]/20">
            <UserCircle size={32} className="text-[var(--color-accent)]" />
          </div>
          <h2 className="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">Welcome to NutriSnap</h2>
          <p className="text-[13px] text-[var(--color-text-muted)] mb-4">Please set up your profile before using the nutrition tracker. This helps calculate your daily calorie and macro targets.</p>
          <button onClick={() => setPage("profile")} className="px-5 py-2.5 text-[14px] font-semibold rounded-xl bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity">
            Set Up Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className={`w-full max-w-[960px] mx-auto pb-[calc(80px+max(16px,env(safe-area-inset-bottom,0px)))] md:pb-0 ${showFullscreen ? 'hidden' : ''}`}
      onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

      {/* ═══ Sticky Header + Tab Bar ═══ */}
      <div className="sticky top-safe z-30 -mx-4 px-4 bg-[var(--color-surface)]/95 backdrop-blur-xl border-b border-[var(--color-border)]/50 md:static md:bg-transparent md:backdrop-blur-none md:border-none md:px-0">

        {/* Date row */}
        <div className="flex items-center justify-between py-2 md:py-0 md:mt-2 md:mb-4">
          <div className="flex items-center gap-2">
            <Apple size={22} className="text-[var(--color-accent)]" />
            <h1 className="text-[18px] font-bold text-[var(--color-text-primary)]">NutriSnap</h1>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => changeDate(-1)} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[var(--color-surface-elevated)]/50 border border-[var(--color-border)]/30 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] active:scale-95 transition-all"><ChevronLeft size={18} /></button>
            <span className="text-[13px] font-semibold text-[var(--color-text-primary)] min-w-[90px] text-center tabular-nums">{dateDisplay()}</span>
            <button onClick={() => changeDate(1)} disabled={currentDate >= todayStr} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[var(--color-surface-elevated)]/50 border border-[var(--color-border)]/30 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] active:scale-95 transition-all disabled:opacity-20"><ChevronRight size={18} /></button>
            <button onClick={() => setFullscreen(true)} title="Fullscreen" className="md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 text-[var(--color-accent)] active:scale-95 transition-all"><Maximize2 size={16} /></button>
          </div>
        </div>

        {/* ═══ Mobile Tab Bar — icon + short label ═══ */}
        <div className="md:hidden flex items-center gap-0 pb-1.5 overflow-x-auto scrollbar-none">
          {PAGES.map(p => {
            const active = page === p.key;
            const Icon = p.icon;
            return (
              <button
                key={p.key}
                onClick={() => setPage(p.key)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 min-w-[56px] h-[52px] px-1 rounded-xl transition-all duration-200 flex-shrink-0",
                  active
                    ? "text-[var(--color-accent)] bg-[var(--color-accent)]/8"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                )}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.75} />
                <span className="text-[10px] font-semibold leading-none">{p.shortLabel}</span>
                {active && <span className="absolute bottom-0 w-5 h-0.5 rounded-full bg-[var(--color-accent)]" />}
              </button>
            );
          })}
        </div>

        {/* ═══ Desktop Tab Bar ═══ */}
        <div className="hidden md:block mb-4">
          <Tabs
            tabs={PAGES.map(p => ({ id: p.key, label: p.label, icon: p.icon }))}
            activeTab={page}
            onChange={setPage}
            variant="pills"
          />
        </div>
      </div>{/* end sticky */}

      {/* ═══ Page indicator dots (mobile) ═══ */}
      <div className="md:hidden flex items-center justify-center gap-1.5 py-2">
        {PAGES.map((_, i) => (
          <span key={i} className={cn(
            "rounded-full transition-all duration-300",
            i === currentPageIdx ? "w-4 h-1.5 bg-[var(--color-accent)]" : "w-1.5 h-1.5 bg-[var(--color-border)]"
          )} />
        ))}
      </div>

      {/* ═══ Tab Content ═══ */}
      <div className="animate-[fadeIn_200ms_ease]">
      {page === "dashboard" && (
        <DashboardTab summary={summary} goals={goals} loading={loading} mealFilter={mealFilter} setMealFilter={setMealFilter}
          filteredLogs={filteredLogs} updateWeight={updateWeight} updateLog={updateLog} deleteLog={deleteLog} copyYesterday={copyYesterday}
          exercises={exercises} deleteExercise={deleteExercise} updateExercise={updateExercise}
          favorites={favorites} suggested={suggested}
          quickAddIn={quickAddIn} quickAddOut={quickAddOut}
          addToFavorites={addToFavorites} removeFavorite={removeFavorite}
          servingUnits={servingUnits}
          userWeight={profile.weight_kg} />
      )}

      {page === "search" && (
        <SearchTab searchQ={searchQ} setSearchQ={setSearchQ} searchResults={searchResults} searching={searching}
          showDropdown={showDropdown} setShowDropdown={setShowDropdown} onSearch={onSearch} selectFood={selectFood}
          addTarget={addTarget} addMeal={addMeal} setAddMeal={setAddMeal} addWeight={addWeight} setAddWeight={setAddWeight}
          addServingUnit={addServingUnit} setAddServingUnit={setAddServingUnit}
          adding={adding} addFood={addFood}
          customName={customName} setCustomName={setCustomName} customCal={customCal} setCustomCal={setCustomCal}
          customProtein={customProtein} setCustomProtein={setCustomProtein} customCarbs={customCarbs} setCustomCarbs={setCustomCarbs}
          customFat={customFat} setCustomFat={setCustomFat} addCustomFood={addCustomFood}
          customMeal={customMeal} setCustomMeal={setCustomMeal}
          customServingUnit={customServingUnit} setCustomServingUnit={setCustomServingUnit}
          customFavorite={customFavorite} setCustomFavorite={setCustomFavorite}
          />
      )}

      {page === "calories-out" && (
        <CaloriesOutTab summary={summary} exercises={exercises} exName={exName} setExName={setExName}
          exDuration={exDuration} setExDuration={setExDuration}
          exCalories={exCustomCal} setExCalories={setExCustomCal}
          addExercise={addExercise} deleteExercise={deleteExercise} />
      )}

      {page === "photo" && (
        <PhotoTab photoFile={photoFile} setPhotoFile={setPhotoFile} photoPreview={photoPreview} setPhotoPreview={setPhotoPreview}
          photoAnalyzing={photoAnalyzing} photoResult={photoResult} photoError={photoError}
          photoProvider={photoProvider} setPhotoProvider={setPhotoProvider} photoProviders={PHOTO_PROVIDERS}
          photoMealType={photoMealType} setPhotoMealType={setPhotoMealType}
          photoConfirming={photoConfirming} photoDragOver={photoDragOver} setPhotoDragOver={setPhotoDragOver}
          photoNutrition={photoNutrition} photoEditedWeights={photoEditedWeights} setPhotoEditedWeights={setPhotoEditedWeights}
          selectedDishes={selectedDishes} setSelectedDishes={setSelectedDishes}
          editedNutrition={editedNutrition} setEditedNutrition={setEditedNutrition}
          pasteMode={pasteMode} setPasteMode={setPasteMode} pasteText={pasteText} setPasteText={setPasteText}
          handlePhotoSelect={handlePhotoSelect} handlePhotoDrop={handlePhotoDrop}
          handleAnalyze={handleAnalyze} handleConfirmAnalysis={handleConfirmAnalysis}
          resetPhoto={resetPhoto} showToast={showToast}
          servingUnits={servingUnits}
          onPasteResult={handlePasteResult} photoUnits={photoUnits} setPhotoUnits={setPhotoUnits} />
      )}

      {page === "profile" && (
        <ProfileTab profile={profile} setProfile={setProfile} goals={goals} saveProfile={saveProfile} showToast={showToast} />
      )}

      {page === "history" && (
        <HistoryTab weeklyData={weeklyData} currentDate={currentDate} setCurrentDate={setCurrentDate}
          todayStr={todayStr} goals={goals} historyMonth={historyMonth} setHistoryMonth={setHistoryMonth} />
      )}

      </div>{/* end fadeIn */}

    </div>

    {/* Fullscreen overlay — mobile only */}
    {showFullscreen && (
      <div className="md:hidden fixed inset-0 z-[60] bg-[var(--color-surface)] flex flex-col overflow-hidden">
        {/* ═══ Top bar — gradient ═══ */}
        <div className="shrink-0 px-4 pb-3 bg-gradient-to-b from-[var(--color-accent)]/8 via-[var(--color-accent)]/3 to-transparent"
          style={{ paddingTop: "max(16px, env(safe-area-inset-top, 0px))" }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[var(--color-accent)]/15 flex items-center justify-center ring-1 ring-[var(--color-accent)]/20">
                <Flame size={22} className="text-[var(--color-accent)]" />
              </div>
              <div>
                <span className="text-[17px] font-bold text-[var(--color-text-primary)]">NutriSnap</span>
                <p className="text-[11px] text-[var(--color-text-muted)]">{dateDisplay()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => changeDate(-1)} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white/5 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] active:scale-[0.97] transition-all">
                <ChevronLeft size={20} />
              </button>
              <button onClick={() => changeDate(1)} disabled={currentDate >= todayStr} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white/5 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] active:scale-[0.97] transition-all disabled:opacity-20">
                <ChevronRight size={20} />
              </button>
              <button onClick={() => setFullscreen(false)} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-muted)] active:scale-[0.97] transition-all ml-1">
                <Minimize2 size={20} />
              </button>
            </div>
          </div>
          {/* Calorie summary strip */}
          <div className="flex items-center gap-3 px-1">
            <div className="flex items-center gap-1.5 bg-orange-500/10 rounded-xl px-3 py-2 flex-1">
              <UtensilsCrossed size={14} className="text-orange-400" />
              <span className="text-[12px] font-bold text-orange-400 tabular-nums">{Math.round(summary.calories)}</span>
              <span className="text-[10px] text-[var(--color-text-muted)]">kcal in</span>
            </div>
            <div className="flex items-center gap-1.5 bg-green-500/10 rounded-xl px-3 py-2 flex-1">
              <Zap size={14} className="text-green-400" />
              <span className="text-[12px] font-bold text-green-400 tabular-nums">{Math.round(summary.exercise_calories)}</span>
              <span className="text-[10px] text-[var(--color-text-muted)]">kcal out</span>
            </div>
          </div>
        </div>

        {/* ═══ Content — scrollable ═══ */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {page === "dashboard" && (
            <DashboardTab summary={summary} goals={goals} loading={loading} mealFilter={mealFilter} setMealFilter={setMealFilter}
              filteredLogs={filteredLogs} updateWeight={updateWeight} updateLog={updateLog} deleteLog={deleteLog} copyYesterday={copyYesterday}
              exercises={exercises} deleteExercise={deleteExercise} updateExercise={updateExercise}
              favorites={favorites} suggested={suggested}
              quickAddIn={quickAddIn} quickAddOut={quickAddOut}
              addToFavorites={addToFavorites} removeFavorite={removeFavorite}
              servingUnits={servingUnits}
              userWeight={profile.weight_kg} />
          )}
          {page === "search" && (
            <SearchTab searchQ={searchQ} setSearchQ={setSearchQ} searchResults={searchResults} searching={searching}
              showDropdown={showDropdown} setShowDropdown={setShowDropdown} onSearch={onSearch} selectFood={selectFood}
              addTarget={addTarget} addMeal={addMeal} setAddMeal={setAddMeal} addWeight={addWeight} setAddWeight={setAddWeight}
              addServingUnit={addServingUnit} setAddServingUnit={setAddServingUnit}
              adding={adding} addFood={addFood}
              customName={customName} setCustomName={setCustomName} customCal={customCal} setCustomCal={setCustomCal}
              customProtein={customProtein} setCustomProtein={setCustomProtein} customCarbs={customCarbs} setCustomCarbs={setCustomCarbs}
              customFat={customFat} setCustomFat={setCustomFat} addCustomFood={addCustomFood}
              customMeal={customMeal} setCustomMeal={setCustomMeal}
              customServingUnit={customServingUnit} setCustomServingUnit={setCustomServingUnit}
              customFavorite={customFavorite} setCustomFavorite={setCustomFavorite}
              />
          )}
          {page === "calories-out" && (
            <CaloriesOutTab summary={summary} exercises={exercises} exName={exName} setExName={setExName}
              exDuration={exDuration} setExDuration={setExDuration}
              exCalories={exCustomCal} setExCalories={setExCustomCal}
              addExercise={addExercise} deleteExercise={deleteExercise} />
          )}
          {page === "photo" && (
            <PhotoTab photoFile={photoFile} setPhotoFile={setPhotoFile} photoPreview={photoPreview} setPhotoPreview={setPhotoPreview}
              photoAnalyzing={photoAnalyzing} photoResult={photoResult} photoError={photoError}
              photoProvider={photoProvider} setPhotoProvider={setPhotoProvider} photoProviders={PHOTO_PROVIDERS}
              photoMealType={photoMealType} setPhotoMealType={setPhotoMealType}
              photoConfirming={photoConfirming} photoDragOver={photoDragOver} setPhotoDragOver={setPhotoDragOver}
              photoNutrition={photoNutrition} photoEditedWeights={photoEditedWeights} setPhotoEditedWeights={setPhotoEditedWeights}
              selectedDishes={selectedDishes} setSelectedDishes={setSelectedDishes}
              editedNutrition={editedNutrition} setEditedNutrition={setEditedNutrition}
              pasteMode={pasteMode} setPasteMode={setPasteMode} pasteText={pasteText} setPasteText={setPasteText}
              handlePhotoSelect={handlePhotoSelect} handlePhotoDrop={handlePhotoDrop}
              handleAnalyze={handleAnalyze} handleConfirmAnalysis={handleConfirmAnalysis}
              resetPhoto={resetPhoto} showToast={showToast}
              servingUnits={servingUnits}
              onPasteResult={handlePasteResult} photoUnits={photoUnits} setPhotoUnits={setPhotoUnits} />
          )}
          {page === "profile" && (
            <ProfileTab profile={profile} setProfile={setProfile} goals={goals} saveProfile={saveProfile} showToast={showToast} />
          )}
          {page === "history" && (
            <HistoryTab weeklyData={weeklyData} currentDate={currentDate} setCurrentDate={setCurrentDate}
              todayStr={todayStr} goals={goals} historyMonth={historyMonth} setHistoryMonth={setHistoryMonth} />
          )}
        </div>

        {/* ═══ Bottom Tab Bar ═══ */}
        <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-2"
          style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="flex items-center justify-around py-1.5">
            {PAGES.map(p => {
              const active = page === p.key;
              const Icon = p.icon;
              return (
                <button
                  key={p.key}
                  onClick={() => setPage(p.key)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 flex-1 py-2 rounded-2xl transition-all duration-200 active:scale-[0.97]",
                    active
                      ? "text-white"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300",
                    active ? "bg-[var(--color-accent)] shadow-lg shadow-[var(--color-accent)]/30 scale-110" : "bg-transparent"
                  )}>
                    <Icon size={22} strokeWidth={active ? 2.5 : 1.75} />
                  </div>
                  <span className="text-[11px] font-bold leading-none">{p.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    )}

    {/* Toast — shared */}
    {toast && (
      <div className="fixed bottom-[80px] md:bottom-6 right-6 z-[70] px-4 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg shadow-lg text-[13px] text-[var(--color-text-primary)]">
        {toast}
      </div>
    )}
    </>
  );
}
