"use client";

import { useState, useEffect } from "react";
import { TrendingDown, TrendingUp, Minus, Trash2, Plus, Scale, Calendar, Pencil } from "lucide-react";

interface WeightEntry {
  id: number; weight_kg: string; log_date: string; notes: string | null;
}
interface WeightStats {
  latest: number; first: number; change: number; avg: number; count: number;
}

interface UserProfile {
  gender: string; age: number; height_cm: number; weight_kg: number;
  body_fat_pct?: number;
  activity_level: string; goal: string;
  daily_calorie_target: number; daily_protein_target: number; daily_carbs_target: number; daily_fat_target: number;
  daily_bmr?: number; daily_tdee?: number;
}

const ACTIVITY_OPTIONS = [
  { value: "sedentary",   label: "Sedentary — little or no exercise",  mult: 1.20 },
  { value: "light",       label: "Light — exercise 1-3 days/week",     mult: 1.375 },
  { value: "moderate",    label: "Moderate — exercise 3-5 days/week",  mult: 1.55 },
  { value: "active",      label: "Active — exercise 6-7 days/week",    mult: 1.725 },
  { value: "very_active", label: "Very Active — athlete, 2×/day",      mult: 1.90 },
];

const GOAL_OPTIONS = [
  { value: "lose_fast",   label: "Lose Weight (aggressive, ~20%)" },
  { value: "lose",         label: "Lose Weight (moderate, ~15%)" },
  { value: "maintain",     label: "Maintain Weight" },
  { value: "gain",         label: "Gain Weight (moderate, +10%)" },
  { value: "gain_fast",    label: "Gain Weight (aggressive, +15%)" },
];

/** Simple SVG polyline chart */
function WeightChart({ entries }: { entries: WeightEntry[] }) {
  if (entries.length < 2) return null;
  const data = [...entries].reverse();
  const values = data.map(e => parseFloat(e.weight_kg));
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const W = 260, H = 80, padX = 2, padY = 4;
  const stepX = (W - padX * 2) / Math.max(data.length - 1, 1);

  const points = data
    .map((e, i) => `${padX + i * stepX},${padY + ((max - parseFloat(e.weight_kg)) / range) * (H - padY * 2)}`)
    .join(" ");

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20">
        {/* Grid lines */}
        <line x1={padX} y1={padY} x2={padX} y2={H - padY} stroke="var(--color-border)" strokeWidth="0.5" opacity="0.3" />
        <line x1={padX} y1={H - padY} x2={W - padX} y2={H - padY} stroke="var(--color-border)" strokeWidth="0.5" opacity="0.3" />
        {/* Area fill */}
        <polygon
          points={`${padX},${H - padY} ${points} ${W - padX},${H - padY}`}
          fill="var(--color-accent)"
          opacity="0.08"
        />
        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Dots */}
        {data.map((e, i) => (
          <circle
            key={i}
            cx={padX + i * stepX}
            cy={padY + ((max - parseFloat(e.weight_kg)) / range) * (H - padY * 2)}
            r="2.5"
            fill="var(--color-accent)"
          />
        ))}
      </svg>
      {/* Min/Max labels */}
      <div className="flex justify-between text-[10px] text-[var(--color-text-muted)]/50 px-0.5">
        <span>{min} kg</span>
        <span>{max} kg</span>
      </div>
    </div>
  );
}

export function ProfileTab({
  profile, setProfile, goals, saveProfile, showToast,
}: {
  profile: UserProfile; setProfile: (fn:(p:UserProfile)=>UserProfile) => void;
  goals: {calories:number,protein:number,carbs:number,fat:number}; saveProfile: () => void;
  showToast: (msg: string) => void;
}) {
  const [weightLog, setWeightLog] = useState<WeightEntry[]>([]);
  const [weightStats, setWeightStats] = useState<WeightStats | null>(null);
  const [newWeight, setNewWeight] = useState("");
  const [weightDate, setWeightDate] = useState(new Date().toISOString().slice(0, 10));
  const [weightNote, setWeightNote] = useState("");
  const [addingWeight, setAddingWeight] = useState(false);

  useEffect(() => { fetchWeightLog(); }, []);

  async function fetchWeightLog() {
    try {
      const r = await fetch("/api/nutrition/weight?days=90");
      const data = await r.json();
      if (data.entries) setWeightLog(data.entries);
      if (data.stats) setWeightStats(data.stats);
    } catch {}
  }

  async function addWeight() {
    if (!newWeight) return;
    setAddingWeight(true);
    try {
      const r = await fetch("/api/nutrition/weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weight_kg: parseFloat(newWeight), log_date: weightDate, notes: weightNote || null }),
      });
      if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err.error || 'Failed'); }
      setNewWeight(""); setWeightNote("");
      fetchWeightLog();
      showToast(`Logged ${newWeight} kg`);
    } catch (e: any) { showToast(e.message || 'Failed to log weight'); }
    setAddingWeight(false);
  }

  async function deleteWeight(id: number) {
    try {
      await fetch(`/api/nutrition/weight?id=${id}`, { method: "DELETE" });
      fetchWeightLog();
    } catch {}
  }

  const previewBmr = () => {
    const w = Number(profile.weight_kg);
    const h = Number(profile.height_cm);
    const a = Number(profile.age);
    if (!w || !h || !a) return null;
    if (profile.gender === "female") return Math.round(10 * w + 6.25 * h - 5 * a - 161);
    return Math.round(10 * w + 6.25 * h - 5 * a + 5);
  };
  const bmr = previewBmr();
  const selectedActivity = ACTIVITY_OPTIONS.find(o => o.value === profile.activity_level);
  const previewTdee = bmr && selectedActivity ? Math.round(bmr * selectedActivity.mult) : null;

  return (
    <div className="space-y-4 max-w-[560px]">
      {/* ═══ TDEE Calculator ═══ */}
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
            <input type="number" value={profile.weight_kg} step="0.1" onChange={e => setProfile(p => ({ ...p, weight_kg: Number(e.target.value) }))}
              className="w-full px-3 py-1.5 text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none" />
          </div>
          <div>
            <label className="text-[11px] text-[var(--color-text-muted)] block mb-1">
              Body Fat % <span className="text-[var(--color-text-muted)]/40">(optional)</span>
            </label>
            <input type="number" value={profile.body_fat_pct || ""} step="0.1" min="3" max="60"
              onChange={e => setProfile(p => ({ ...p, body_fat_pct: e.target.value ? Number(e.target.value) : undefined }))}
              placeholder="e.g. 18"
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

        {bmr && (
          <div className="mb-3 p-2 rounded bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/10">
            <div className="flex items-center gap-4 text-[12px]">
              <span className="text-[var(--color-text-muted)]">BMR: <b className="text-[var(--color-text-primary)] tabular-nums">{bmr}</b> kcal</span>
              {previewTdee && (
                <span className="text-[var(--color-text-muted)]">TDEE: <b className="text-[var(--color-accent)] tabular-nums">{previewTdee}</b> kcal <span className="text-[10px] opacity-50">(×{selectedActivity?.mult})</span></span>
              )}
              {profile.body_fat_pct && <span className="text-[10px] text-[var(--color-text-muted)]/60">Katch-McArdle</span>}
            </div>
          </div>
        )}

        <button onClick={saveProfile} className="px-4 py-1.5 text-[12px] font-medium rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90">Save & Calculate Goals</button>

        {goals.calories > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-[var(--color-surface-elevated)]/20 border border-[var(--color-border)]/30">
            <div className="text-[12px] font-semibold text-[var(--color-text-secondary)] mb-2">Daily Targets</div>
            <div className="grid grid-cols-2 gap-2 text-[13px]">
              <div><span className="text-[var(--color-text-muted)]">Calories</span> <span className="font-semibold tabular-nums ml-2">{goals.calories} kcal</span></div>
              <div><span className="text-[var(--color-text-muted)]">Protein</span> <span className="font-semibold tabular-nums ml-2">{goals.protein} g</span></div>
              <div><span className="text-[var(--color-text-muted)]">Carbs</span> <span className="font-semibold tabular-nums ml-2">{goals.carbs} g</span></div>
              <div><span className="text-[var(--color-text-muted)]">Fat</span> <span className="font-semibold tabular-nums ml-2">{goals.fat} g</span></div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Weight Tracking ═══ */}
      <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 bg-[var(--color-surface-elevated)]/30 border-b border-[var(--color-border)]/50">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center">
            <Scale size={14} className="text-indigo-400" />
          </div>
          <span className="text-[13px] font-semibold text-[var(--color-text-secondary)]">Weight Tracking</span>
          {weightStats && (
            <span className="ml-auto text-[11px] text-[var(--color-text-muted)] tabular-nums">{weightStats.count} entries</span>
          )}
        </div>

        {/* Chart */}
        {weightLog.length >= 2 && (
          <div className="px-4 pt-3">
            {/* Big number + delta */}
            <div className="flex items-baseline gap-3 mb-1">
              <span className="text-[28px] font-bold text-[var(--color-text-primary)] tabular-nums leading-none">
                {weightStats?.latest}
              </span>
              <span className="text-[13px] text-[var(--color-text-muted)]">kg</span>
              {weightStats && weightStats.change !== 0 && (
                <span className={`text-[13px] font-semibold tabular-nums flex items-center gap-0.5 ml-1 ${weightStats.change < 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {weightStats.change < 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                  {weightStats.change > 0 ? '+' : ''}{weightStats.change}
                </span>
              )}
            </div>
            <WeightChart entries={weightLog} />
          </div>
        )}

        {/* First entry prompt */}
        {weightLog.length === 0 && (
          <div className="px-4 py-6 text-center">
            <Scale size={28} className="mx-auto mb-2 text-[var(--color-text-muted)]/30" />
            <p className="text-[12px] text-[var(--color-text-muted)]">No weight data yet. Log your first entry below.</p>
          </div>
        )}

        {/* Single entry display */}
        {weightLog.length === 1 && (
          <div className="px-4 pt-3 pb-1 text-center">
            <span className="text-[28px] font-bold text-[var(--color-text-primary)] tabular-nums">{weightLog[0].weight_kg}</span>
            <span className="text-[13px] text-[var(--color-text-muted)] ml-1">kg</span>
          </div>
        )}

        {/* Add form */}
        <div className="px-4 py-3 flex items-end gap-2 flex-wrap border-t border-[var(--color-border)]/30">
          <div className="flex-1 min-w-[80px] max-w-[120px]">
            <label className="text-[10px] text-[var(--color-text-muted)] block mb-0.5">Weight (kg)</label>
            <input type="number" value={newWeight} step="0.1" min="20" max="300"
              onChange={e => setNewWeight(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addWeight()}
              placeholder="70.0"
              className="w-full px-2 py-2 text-[15px] font-semibold bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg outline-none tabular-nums focus:border-[var(--color-accent)]/50 transition-colors" />
          </div>
          <div className="flex-1 min-w-[100px] max-w-[140px]">
            <label className="text-[10px] text-[var(--color-text-muted)] block mb-0.5"><Calendar size={10} className="inline mr-0.5" />Date</label>
            <input type="date" value={weightDate}
              onChange={e => setWeightDate(e.target.value)}
              className="w-full px-2 py-2 text-[12px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg outline-none" />
          </div>
          <div className="hidden sm:block flex-1 min-w-[80px] max-w-[110px]">
            <label className="text-[10px] text-[var(--color-text-muted)] block mb-0.5"><Pencil size={10} className="inline mr-0.5" />Note</label>
            <input type="text" value={weightNote}
              onChange={e => setWeightNote(e.target.value)}
              placeholder="morning"
              className="w-full px-2 py-2 text-[12px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg outline-none" />
          </div>
          <button onClick={addWeight} disabled={addingWeight || !newWeight}
            className="px-3 py-2 text-[12px] font-semibold rounded-lg bg-indigo-500 text-white hover:bg-indigo-400 disabled:opacity-30 transition-all flex items-center gap-1 shadow-sm shadow-indigo-500/20 shrink-0">
            <Plus size={14} /> Log
          </button>
        </div>

        {/* History list */}
        {weightLog.length > 1 && (
          <div className="border-t border-[var(--color-border)]/30 max-h-[220px] overflow-y-auto">
            {weightLog.map((e, i) => {
              const prev = weightLog[i + 1];
              const diff = prev ? (parseFloat(e.weight_kg) - parseFloat(prev.weight_kg)).toFixed(1) : null;
              const isToday = e.log_date.slice(0, 10) === new Date().toISOString().slice(0, 10);
              return (
                <div key={e.id} className="flex items-center gap-3 px-4 py-2 text-[13px] hover:bg-[var(--color-surface-elevated)]/20 group transition-colors border-b border-[var(--color-border)]/10 last:border-0">
                  <span className="text-[var(--color-text-muted)] w-[55px] tabular-nums shrink-0 text-[12px]">
                    {isToday ? 'Today' : e.log_date.slice(5, 10)}
                  </span>
                  <span className="font-semibold tabular-nums text-[var(--color-text-primary)] w-[48px] shrink-0">{e.weight_kg}</span>
                  <span className="text-[var(--color-text-muted)] text-[11px]">kg</span>
                  {diff && Number(diff) !== 0 ? (
                    <span className={`text-[12px] font-semibold tabular-nums ml-1 ${Number(diff) < 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {Number(diff) > 0 ? '+' : ''}{diff}
                    </span>
                  ) : diff ? (
                    <span className="text-[12px] text-[var(--color-text-muted)]/40 tabular-nums ml-1">−</span>
                  ) : null}
                  <span className="text-[var(--color-text-muted)]/40 truncate flex-1 text-[11px]">{e.notes || ''}</span>
                  <button onClick={() => deleteWeight(e.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
