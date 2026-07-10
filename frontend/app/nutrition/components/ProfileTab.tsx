"use client";

import { useState, useEffect } from "react";
import { TrendingDown, TrendingUp, Minus, Trash2, Plus } from "lucide-react";

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

export function ProfileTab({
  profile, setProfile, goals, saveProfile,
}: {
  profile: UserProfile; setProfile: (fn:(p:UserProfile)=>UserProfile) => void;
  goals: {calories:number,protein:number,carbs:number,fat:number}; saveProfile: () => void;
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
      if (!r.ok) throw new Error();
      setNewWeight(""); setWeightNote("");
      fetchWeightLog();
    } catch {}
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

  // Simple sparkline bar chart
  const maxWeight = weightLog.length > 0 ? Math.max(...weightLog.map(e => parseFloat(e.weight_kg))) : 0;
  const minWeight = weightLog.length > 0 ? Math.min(...weightLog.map(e => parseFloat(e.weight_kg))) : 0;
  const range = maxWeight - minWeight || 1;

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
      <div className="border border-[var(--color-border)] rounded-lg p-4">
        <h3 className="text-[13px] font-semibold text-[var(--color-text-secondary)] mb-3">Weight Tracking</h3>

        {/* Stats bar */}
        {weightStats && weightStats.count >= 2 && (
          <div className="flex items-center gap-3 mb-3 p-2.5 rounded-lg bg-[var(--color-surface-elevated)]/20 border border-[var(--color-border)]/20">
            <span className="text-[12px] text-[var(--color-text-muted)]">
              <span className="font-semibold text-[var(--color-text-primary)] tabular-nums">{weightStats.latest}</span> kg
            </span>
            {weightStats.change !== 0 ? (
              <span className={`text-[12px] font-semibold tabular-nums flex items-center gap-0.5 ${weightStats.change < 0 ? 'text-green-400' : 'text-red-400'}`}>
                {weightStats.change < 0 ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                {weightStats.change > 0 ? '+' : ''}{weightStats.change} kg
              </span>
            ) : (
              <span className="text-[12px] text-[var(--color-text-muted)] flex items-center gap-0.5"><Minus size={13} /> 0</span>
            )}
            <span className="text-[11px] text-[var(--color-text-muted)]/60 ml-auto">{weightStats.count} entries</span>
          </div>
        )}

        {/* Sparkline chart */}
        {weightLog.length >= 2 && (
          <div className="flex items-end gap-[2px] h-10 mb-3 px-1">
            {[...weightLog].reverse().map((e, i) => {
              const h = range > 0 ? ((parseFloat(e.weight_kg) - minWeight) / range) * 100 : 50;
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div
                    className="w-full rounded-t-sm bg-[var(--color-accent)]/40 hover:bg-[var(--color-accent)]/70 transition-colors min-h-[3px]"
                    style={{ height: `${Math.max(h, 5)}%` }}
                    title={`${e.log_date}: ${e.weight_kg} kg`}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Add weight */}
        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="text-[10px] text-[var(--color-text-muted)] block mb-0.5">Weight (kg)</label>
            <input type="number" value={newWeight} step="0.1" min="20" max="300"
              onChange={e => setNewWeight(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addWeight()}
              placeholder="70.0"
              className="w-[90px] px-2.5 py-1.5 text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg outline-none tabular-nums" />
          </div>
          <div>
            <label className="text-[10px] text-[var(--color-text-muted)] block mb-0.5">Date</label>
            <input type="date" value={weightDate}
              onChange={e => setWeightDate(e.target.value)}
              className="w-[130px] px-2 py-1.5 text-[12px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg outline-none" />
          </div>
          <div>
            <label className="text-[10px] text-[var(--color-text-muted)] block mb-0.5">Note</label>
            <input type="text" value={weightNote}
              onChange={e => setWeightNote(e.target.value)}
              placeholder="e.g. morning"
              className="w-[120px] px-2.5 py-1.5 text-[12px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg outline-none" />
          </div>
          <button onClick={addWeight} disabled={addingWeight || !newWeight}
            className="px-3 py-1.5 text-[12px] font-medium rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-40 flex items-center gap-1">
            <Plus size={14} /> Log
          </button>
        </div>

        {/* History list */}
        {weightLog.length > 0 && (
          <div className="mt-3 space-y-1 max-h-[200px] overflow-y-auto">
            {weightLog.slice(0, 14).map((e, i) => {
              const prev = weightLog[i + 1];
              const diff = prev ? (parseFloat(e.weight_kg) - parseFloat(prev.weight_kg)).toFixed(1) : null;
              return (
                <div key={e.id} className="flex items-center gap-2 text-[12px] py-1 px-2 rounded hover:bg-[var(--color-surface-elevated)]/30 group">
                  <span className="text-[var(--color-text-muted)] w-[75px] tabular-nums">{e.log_date.slice(5)}</span>
                  <span className="font-semibold tabular-nums text-[var(--color-text-primary)] w-[50px]">{e.weight_kg} kg</span>
                  {diff && Number(diff) !== 0 && (
                    <span className={`text-[11px] tabular-nums w-[45px] ${Number(diff) < 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {Number(diff) > 0 ? '+' : ''}{diff}
                    </span>
                  )}
                  {diff && Number(diff) === 0 && <span className="w-[45px]" />}
                  <span className="text-[var(--color-text-muted)]/50 truncate flex-1">{e.notes || ''}</span>
                  <button onClick={() => deleteWeight(e.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-all">
                    <Trash2 size={12} />
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
