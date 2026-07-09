"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, Plus, Minus, X, Camera, Apple, Loader2,
  ChevronLeft, ChevronRight, Utensils, TrendingUp,
  Settings, History, PieChart, UtensilsCrossed, Copy,
  Maximize2, Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { Ring } from "./components/Ring";
import { DashboardTab } from "./components/DashboardTab";
import { SearchTab } from "./components/SearchTab";
import { PhotoTab } from "./components/PhotoTab";
import { ProfileTab } from "./components/ProfileTab";
import { HistoryTab } from "./components/HistoryTab";
import { CaloriesOutTab } from "./components/CaloriesOutTab";
import { BottomNav } from "./components/BottomNav";

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
}
interface CustomFood { id: number; food_name: string; calories_per_100g: number; protein_per_100g: number; carbs_per_100g: number; fat_per_100g: number; }

const PAGES = [
  { key: "dashboard", label: "Home", icon: PieChart },
  { key: "search", label: "Calories In", icon: Search },
  { key: "calories-out", label: "Calories Out", icon: TrendingUp },
  { key: "photo", label: "AI Photo", icon: Camera },
  { key: "history", label: "History", icon: History },
  { key: "profile", label: "Profile", icon: Settings },
];

/* ================================================================
   Main Page
   ================================================================ */

export default function NutritionPage() {
  const [page, setPage] = useState("dashboard");
  const [fullscreen, setFullscreen] = useState(false);
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
  const [selectedDishes, setSelectedDishes] = useState<Set<number>>(new Set());
  const [editedNutrition, setEditedNutrition] = useState<Record<number, {cal:number,p:number,c:number,f:number}>>({});
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const PHOTO_PROVIDERS = [
    { value: "agnes", label: "Agnes AI (agnes-2.0-flash)", hasVision: true },
    { value: "nemotron", label: "Nemotron Omni (NVIDIA)", hasVision: true },
    { value: "openai", label: "OpenAI (gpt-4o)", hasVision: true },
    { value: "openrouter", label: "OpenRouter", hasVision: true },
    { value: "lmstudio", label: "LM Studio (本地)", hasVision: false },
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
        setGoals({
          calories: json.profile.daily_calorie_target || 2000,
          protein: json.profile.daily_protein_target || 100,
          carbs: json.profile.daily_carbs_target || 250,
          fat: json.profile.daily_fat_target || 65,
        });
      }
    } catch {}
  }, []);

  useEffect(() => { fetchLogs(currentDate); fetchExercises(); fetchFavorites(); }, [currentDate, fetchLogs]);
  useEffect(() => { fetchGoals(); fetchExList(); }, [fetchGoals]);

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
  const updateWeight = (id: number, weight: number) => updateLog(id, { amount: weight });

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
        body: JSON.stringify({ food_name: customName, calories_per_100g: Number(customCal)||0, protein_per_100g: Number(customProtein)||0, carbs_per_100g: Number(customCarbs)||0, fat_per_100g: Number(customFat)||0 }),
      });
      const json = await r.json();
      if (!json.error) {
        setCustomFoods(prev => [...prev, json.food]);
        setCustomName(""); setCustomCal(""); setCustomProtein(""); setCustomCarbs(""); setCustomFat(""); setCustomServingUnit("g");
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
    const name = exCustom ? exCustomName : exName;
    if (!name) return;
    try {
      const body: any = { exercise_name: name, log_date: currentDate };
      if (exCustom) {
        body.calories_burned = Number(exCustomCal) || 0;
        body.duration_min = 0;
      } else {
        body.duration_min = exDuration;
      }
      await fetch("/api/nutrition/exercise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setExName(""); setExDuration(30); setExCustomName(""); setExCustomCal("");
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

  const addToFavorites = async (type: 'in'|'out', name: string, calories?: number, default_weight?: number, default_duration?: number) => {
    try {
      const r = await fetch("/api/nutrition/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name, calories: calories || 0, default_weight, default_duration }),
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
      await fetch(`/api/nutrition/favorites?id=${id}`, { method: "DELETE" });
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
      const weight = f.default_weight || f.avg_weight || 100;
      await fetch("/api/nutrition/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ food_name: f.name, amount: weight, meal_type: "snack", log_date: todayStr }),
      });
      fetchLogs(currentDate);
      showToast(`Quick added ${f.name} (${weight}g)`);
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
      if (json.profile) { setProfile(json.profile); setGoals({ calories: json.profile.daily_calorie_target||2000, protein: json.profile.daily_protein_target||100, carbs: json.profile.daily_carbs_target||250, fat: json.profile.daily_fat_target||65 }); showToast("Profile saved"); }
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
  const handleAnalyze = async () => {
    if (!photoFile) return;
    setPhotoAnalyzing(true); setPhotoError("");
    try {
      const fd = new FormData(); fd.append("image", photoFile); fd.append("provider", photoProvider);
      const r = await fetch("/api/nutrition/analyze-image", { method: "POST", body: fd });
      const json = await r.json();
      if (json.status === "error") { setPhotoError(json.message); }
      else {
        setPhotoResult(json);
        const weights: Record<number, number> = {}; const initNutrition: Record<number, {cal:number,p:number,c:number,f:number}> = {};
        json.dishes?.forEach((d: any, i: number) => { weights[i] = d.estimated_amount; if (d.calories !== undefined) initNutrition[i] = { cal: d.calories, p: d.protein_g||0, c: d.carbs_g||0, f: d.fat_g||0 }; });
        setPhotoEditedWeights(weights); setEditedNutrition(initNutrition); setSelectedDishes(new Set(json.dishes?.map((_:any,i:number)=>i)||[]));
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
      }
    } catch (e) { setPhotoError(String(e)); }
    setPhotoAnalyzing(false);
  };
  const handleConfirmAnalysis = async () => {
    if (!photoResult?.dishes?.length) return;
    setPhotoConfirming(true);
    try {
      const selectedDishesList = photoResult.dishes.filter((_:any,i:number)=>selectedDishes.has(i)).map((d:any,i:number)=>{const aiNut=editedNutrition[i]; return {name:d.name,estimated_amount:photoEditedWeights[i]||d.estimated_amount,...(aiNut?{ai_calories:aiNut.cal,ai_protein:aiNut.p,ai_carbs:aiNut.c,ai_fat:aiNut.f}:{})};});
      if (selectedDishesList.length===0) { showToast("No dishes selected"); return; }
      const r = await fetch("/api/nutrition/confirm-analysis", { method: "POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({dishes:selectedDishesList,meal_type:photoMealType,log_date:currentDate}) });
      const json = await r.json(); const addedCount = json.added?.filter((a:any)=>a.status==="added").length||0;
      showToast(`Logged ${addedCount} dishes to ${photoMealType}`);
      setPhotoFile(null); setPhotoPreview(""); setPhotoResult(null); fetchLogs(currentDate);
    } catch (e) { showToast("Failed to save"); }
    setPhotoConfirming(false);
  };
  const resetPhoto = () => { setPhotoFile(null); setPhotoPreview(""); setPhotoResult(null); setPhotoError(""); setPhotoNutrition({}); setPhotoEditedWeights({}); setSelectedDishes(new Set()); setEditedNutrition({}); setPasteMode(false); setPasteText(""); };

  /* ---- Render ---- */
  return (
    <>
    <div className={`w-full max-w-[960px] mx-auto pb-[104px] md:pb-0 ${fullscreen ? 'hidden' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mt-2 mb-4">
        <div className="flex items-center gap-2">
          <Apple size={22} className="text-[var(--color-accent)]" />
          <h1 className="text-[20px] font-bold text-[var(--color-text-primary)]">NutriSnap</h1>
          <span className="text-[12px] text-[var(--color-text-muted)] mt-1 max-md:hidden">Food Nutrition Analysis</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => changeDate(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-surface-elevated)]/50 border border-[var(--color-border)]/50 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] hover:border-[var(--color-accent)]/30 hover:text-[var(--color-accent)] transition-all"><ChevronLeft size={16} /></button>
          <span className="text-[14px] font-semibold text-[var(--color-text-primary)] min-w-[100px] text-center">{dateDisplay()}</span>
          <button onClick={() => changeDate(1)} disabled={currentDate >= todayStr} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-surface-elevated)]/50 border border-[var(--color-border)]/50 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] hover:border-[var(--color-accent)]/30 hover:text-[var(--color-accent)] transition-all disabled:opacity-20 disabled:hover:border-[var(--color-border)]/50"><ChevronRight size={16} /></button>
          <button onClick={() => setFullscreen(!fullscreen)} title={fullscreen ? "Exit" : "Fullscreen"} className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-surface-elevated)]/50 border border-[var(--color-border)]/50 text-[var(--color-text-muted)] hover:bg-[var(--color-accent)]/10 hover:border-[var(--color-accent)]/30 hover:text-[var(--color-accent)] transition-all ml-1"><Maximize2 size={15} /></button>
        </div>
      </div>

      {/* Sub-navigation — desktop only */}
      <div className="hidden md:flex gap-1 mb-4 overflow-x-auto pb-1">
        {PAGES.map(p => (
          <button key={p.key} onClick={() => setPage(p.key)}
            className={cn("flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg whitespace-nowrap transition-colors",
              page === p.key ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]")}>
            <p.icon size={16} />{p.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {page === "dashboard" && (
        <DashboardTab summary={summary} goals={goals} loading={loading} mealFilter={mealFilter} setMealFilter={setMealFilter}
          filteredLogs={filteredLogs} updateWeight={updateWeight} updateLog={updateLog} deleteLog={deleteLog} copyYesterday={copyYesterday}
          exercises={exercises} deleteExercise={deleteExercise} updateExercise={updateExercise}
          favorites={favorites} suggested={suggested}
          quickAddIn={quickAddIn} quickAddOut={quickAddOut}
          addToFavorites={addToFavorites} removeFavorite={removeFavorite}
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
          />
      )}

      {page === "calories-out" && (
        <CaloriesOutTab summary={summary} exercises={exercises} exName={exName} setExName={setExName}
          exDuration={exDuration} setExDuration={setExDuration} exDropdown={exDropdown} setExDropdown={setExDropdown}
          exList={exList} exSearch={exSearch} setExSearch={setExSearch}
          exCustom={exCustom} setExCustom={setExCustom} exCustomName={exCustomName} setExCustomName={setExCustomName}
          exCustomCal={exCustomCal} setExCustomCal={setExCustomCal}
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
          resetPhoto={resetPhoto} showToast={showToast} />
      )}

      {page === "profile" && (
        <ProfileTab profile={profile} setProfile={setProfile} goals={goals} saveProfile={saveProfile} />
      )}

      {page === "history" && (
        <HistoryTab weeklyData={weeklyData} currentDate={currentDate} setCurrentDate={setCurrentDate}
          todayStr={todayStr} goals={goals} historyMonth={historyMonth} setHistoryMonth={setHistoryMonth} />
      )}

    </div>

    {/* Fullscreen overlay — mobile only */}
    {fullscreen && (
      <div className="md:hidden fixed inset-0 z-[60] bg-[var(--color-surface)] flex flex-col overflow-hidden">
        {/* Compact top bar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]/30 shrink-0">
          <div className="flex items-center gap-2">
            <Apple size={18} className="text-[var(--color-accent)]" />
            <span className="text-[14px] font-bold text-[var(--color-text-primary)]">NutriSnap</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => changeDate(-1)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--color-surface-elevated)]/50 border border-[var(--color-border)]/50 text-[var(--color-text-muted)]"><ChevronLeft size={14} /></button>
            <span className="text-[13px] font-semibold text-[var(--color-text-primary)] min-w-[80px] text-center">{dateDisplay()}</span>
            <button onClick={() => changeDate(1)} disabled={currentDate >= todayStr} className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--color-surface-elevated)]/50 border border-[var(--color-border)]/50 text-[var(--color-text-muted)] disabled:opacity-20"><ChevronRight size={14} /></button>
            <button onClick={() => setFullscreen(false)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 text-[var(--color-accent)] ml-1"><Minimize2 size={14} /></button>
          </div>
        </div>

        {/* Tab content — scrollable */}
        <div className="flex-1 overflow-y-auto px-3 pt-3 pb-4">
          {page === "dashboard" && (
            <DashboardTab summary={summary} goals={goals} loading={loading} mealFilter={mealFilter} setMealFilter={setMealFilter}
              filteredLogs={filteredLogs} updateWeight={updateWeight} updateLog={updateLog} deleteLog={deleteLog} copyYesterday={copyYesterday}
              exercises={exercises} deleteExercise={deleteExercise} updateExercise={updateExercise}
              favorites={favorites} suggested={suggested}
              quickAddIn={quickAddIn} quickAddOut={quickAddOut}
              addToFavorites={addToFavorites} removeFavorite={removeFavorite}
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
              />
          )}
          {page === "calories-out" && (
            <CaloriesOutTab summary={summary} exercises={exercises} exName={exName} setExName={setExName}
              exDuration={exDuration} setExDuration={setExDuration} exDropdown={exDropdown} setExDropdown={setExDropdown}
              exList={exList} exSearch={exSearch} setExSearch={setExSearch}
              exCustom={exCustom} setExCustom={setExCustom} exCustomName={exCustomName} setExCustomName={setExCustomName}
              exCustomCal={exCustomCal} setExCustomCal={setExCustomCal}
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
              resetPhoto={resetPhoto} showToast={showToast} />
          )}
          {page === "profile" && (
            <ProfileTab profile={profile} setProfile={setProfile} goals={goals} saveProfile={saveProfile} />
          )}
          {page === "history" && (
            <HistoryTab weeklyData={weeklyData} currentDate={currentDate} setCurrentDate={setCurrentDate}
              todayStr={todayStr} goals={goals} historyMonth={historyMonth} setHistoryMonth={setHistoryMonth} />
          )}
        </div>

        {/* Bottom Nav inside fullscreen */}
        <BottomNav page={page} setPage={setPage} />
      </div>
    )}

    {/* Toast — shared */}
    {toast && (
      <div className="fixed bottom-24 md:bottom-6 right-6 z-[70] px-4 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg shadow-lg text-[13px] text-[var(--color-text-primary)]">
        {toast}
      </div>
    )}
    </>
  );
}
