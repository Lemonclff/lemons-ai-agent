"use client";

import { useState, useEffect } from "react";
import { TrendingDown, TrendingUp, Trash2, Plus, Scale, Calendar, Flame, Target, Droplets } from "lucide-react";
import { NumberField } from "./NumberField";

interface WeightEntry {
  id: number; weight_kg: string; log_date: string; notes: string | null;
}
interface WeightStats { latest: number; first: number; change: number; avg: number; count: number; }
interface UserProfile {
  gender: string; age: number; height_cm: number; weight_kg: number;
  body_fat_pct?: number;
  activity_level: string; goal: string;
  daily_calorie_target: number; daily_protein_target: number; daily_carbs_target: number; daily_fat_target: number;
  daily_water_target_ml?: number;
  daily_bmr?: number; daily_tdee?: number;
}

const ACTIVITY_OPTIONS = [
  { value: "sedentary", label: "Sedentary", sub: "little or no exercise", mult: 1.20 },
  { value: "light", label: "Light", sub: "1−3 days/week", mult: 1.375 },
  { value: "moderate", label: "Moderate", sub: "3−5 days/week", mult: 1.55 },
  { value: "active", label: "Active", sub: "6−7 days/week", mult: 1.725 },
  { value: "very_active", label: "Athlete", sub: "intense 2×/day", mult: 1.90 },
];

const GOAL_OPTIONS = [
  { value: "lose_fast", label: "Aggressive Cut", sub: "~20% deficit" },
  { value: "lose", label: "Moderate Cut", sub: "~15% deficit" },
  { value: "maintain", label: "Maintain", sub: "weight stable" },
  { value: "gain", label: "Lean Bulk", sub: "+10% surplus" },
  { value: "gain_fast", label: "Aggressive Bulk", sub: "~15% surplus" },
];

function WeightChart({ entries }: { entries: WeightEntry[] }) {
  if (entries.length < 2) return null;
  const data = [...entries].reverse();
  const values = data.map(e => parseFloat(e.weight_kg));
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const W = 280, H = 90, padX = 2, padY = 4;
  const stepX = (W - padX * 2) / Math.max(data.length - 1, 1);
  const points = data.map((e, i) => `${padX + i * stepX},${padY + ((max - parseFloat(e.weight_kg)) / range) * (H - padY * 2)}`).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24">
        <defs>
          <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line x1={padX} y1={padY} x2={padX} y2={H - padY} stroke="var(--color-border)" strokeWidth="0.5" opacity="0.2" />
        <line x1={padX} y1={H - padY} x2={W - padX} y2={H - padY} stroke="var(--color-border)" strokeWidth="0.5" opacity="0.2" />
        <polygon points={`${padX},${H - padY} ${points} ${W - padX},${H - padY}`} fill="url(#weightGrad)" />
        <polyline points={points} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((e, i) => (
          <circle key={i} cx={padX + i * stepX} cy={padY + ((max - parseFloat(e.weight_kg)) / range) * (H - padY * 2)} r="2.5" fill="var(--color-accent)" />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-[var(--color-text-muted)]/50 px-1">
        <span>{min}</span><span>kg</span><span>{max}</span>
      </div>
    </div>
  );
}

const MacroBadge = ({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) => (
  <div className="flex flex-col items-center p-2.5 rounded-xl bg-[var(--color-surface-elevated)]/40 nutri-card-hover transition-all duration-300">
    <span className={`text-[18px] font-bold tabular-nums ${color}`}>{value}</span>
    <span className="text-[10px] text-[var(--color-text-muted)]">{unit}</span>
    <span className="text-[10px] text-[var(--color-text-muted)]/60">{label}</span>
  </div>
);

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
        method: "POST", headers: { "Content-Type": "application/json" },
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
    try { await fetch(`/api/nutrition/weight?id=${id}`, { method: "DELETE" }); fetchWeightLog(); } catch {}
  }

  const bmr = (() => {
    const w = Number(profile.weight_kg), h = Number(profile.height_cm), a = Number(profile.age);
    if (!w || !h || !a) return null;
    if (profile.gender === "female") return Math.round(10 * w + 6.25 * h - 5 * a - 161);
    return Math.round(10 * w + 6.25 * h - 5 * a + 5);
  })();
  const selectedActivity = ACTIVITY_OPTIONS.find(o => o.value === profile.activity_level);
  const previewTdee = bmr && selectedActivity ? Math.round(bmr * selectedActivity.mult) : null;

  return (
    <div className="space-y-3 max-w-[560px] nutri-stagger">

      {/* ═══ TDEE Calculator ═══ */}
      <div className="rounded-2xl border border-[var(--color-border)]/50 bg-[var(--color-surface-elevated)]/20 p-4 nutri-card-hover">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-[var(--color-accent)]/15 flex items-center justify-center nutri-icon-bounce">
            <Flame size={15} className="text-[var(--color-accent)]" />
          </div>
          <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">TDEE Calculator</h3>
          {previewTdee && (
            <span className="ml-auto text-[16px] font-bold text-[var(--color-accent)] tabular-nums">{previewTdee} kcal</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5 max-md:grid-cols-1 mb-3">
          <div>
            <label className="text-[11px] font-medium text-[var(--color-text-muted)] block mb-1">Gender</label>
            <select
              value={profile.gender}
              onChange={e => setProfile(p => ({ ...p, gender: e.target.value }))}
              className="w-full min-h-[42px] px-3 text-[14px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl outline-none text-[var(--color-text-primary)] focus:border-[var(--color-accent)]/50 transition-colors nutri-input-glow"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-[var(--color-text-muted)] block mb-1">Age</label>
            <NumberField
              value={profile.age}
              min={10} max={120}
              onCommit={(v) => setProfile(p => ({ ...p, age: v ?? 30 }))}
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-[var(--color-text-muted)] block mb-1">Height (cm)</label>
            <NumberField
              value={profile.height_cm}
              min={100} max={250}
              onCommit={(v) => setProfile(p => ({ ...p, height_cm: v ?? 170 }))}
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-[var(--color-text-muted)] block mb-1">Weight (kg)</label>
            <NumberField
              value={profile.weight_kg}
              min={30} max={300} step={0.1}
              onCommit={(v) => setProfile(p => ({ ...p, weight_kg: v ?? 70 }))}
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-[var(--color-text-muted)] block mb-1">Body Fat % <span className="opacity-40">(opt)</span></label>
            <NumberField
              value={profile.body_fat_pct}
              min={3} max={60} step={0.1}
              placeholder="e.g. 18"
              allowEmpty nullable
              emptyValue={undefined}
              onCommit={(v) => setProfile(p => ({ ...p, body_fat_pct: v ?? undefined }))}
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-[var(--color-text-muted)] block mb-1">Activity Level</label>
            <select
              value={profile.activity_level}
              onChange={e => setProfile(p => ({ ...p, activity_level: e.target.value }))}
              className="w-full min-h-[42px] px-3 text-[13px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl outline-none text-[var(--color-text-primary)] focus:border-[var(--color-accent)]/50 transition-colors nutri-input-glow"
            >
              {ACTIVITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label} — {o.sub}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-[var(--color-text-muted)] block mb-1">Goal</label>
            <select
              value={profile.goal}
              onChange={e => setProfile(p => ({ ...p, goal: e.target.value }))}
              className="w-full min-h-[42px] px-3 text-[13px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl outline-none text-[var(--color-text-primary)] focus:border-[var(--color-accent)]/50 transition-colors nutri-input-glow"
            >
              {GOAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label} ({o.sub})</option>)}
            </select>
          </div>
        </div>

        {bmr && (
          <div className="flex items-center gap-3 mb-3 px-4 py-2.5 rounded-xl bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/10 text-[13px] animate-[fade-up_0.3s_ease]">
            <span className="text-[var(--color-text-muted)]">BMR <b className="text-[var(--color-text-primary)] tabular-nums ml-1">{bmr}</b></span>
            <span className="text-[var(--color-border)]/50">|</span>
            <span className="text-[var(--color-text-muted)]">TDEE <b className="text-[var(--color-accent)] tabular-nums ml-1">{previewTdee ?? "—"}</b></span>
            <span className="text-[10px] text-[var(--color-text-muted)]/50 ml-auto">{profile.body_fat_pct ? "Katch-McArdle" : "Mifflin-St Jeor"}</span>
          </div>
        )}

        <button onClick={saveProfile}
          className="w-full min-h-[48px] text-[14px] font-semibold rounded-xl bg-[var(--color-accent)] text-white hover:opacity-90 active:scale-[0.98] transition-all nutri-press">
          Calculate & Save Goals
        </button>

        {goals.calories > 0 && (
          <div className="mt-4 grid grid-cols-4 gap-2">
            <MacroBadge label="Calories" value={goals.calories} unit="kcal" color="text-orange-400" />
            <MacroBadge label="Protein" value={goals.protein} unit="g" color="text-green-400" />
            <MacroBadge label="Carbs" value={goals.carbs} unit="g" color="text-amber-400" />
            <MacroBadge label="Fat" value={goals.fat} unit="g" color="text-rose-400" />
          </div>
        )}
        {profile.daily_water_target_ml && (
          <div className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500/8 border border-sky-500/20 nutri-card-hover">
            <Droplets size={16} className="text-sky-400 shrink-0" />
            <span className="text-[13px] text-[var(--color-text-secondary)]">
              Water target: <strong className="text-sky-400">{profile.daily_water_target_ml} ml</strong>
              <span className="text-[11px] text-[var(--color-text-muted)] ml-1">(based on weight & activity)</span>
            </span>
          </div>
        )}
      </div>

      {/* ═══ Weight Tracking ═══ */}
      <div className="rounded-2xl border border-[var(--color-border)]/50 overflow-hidden bg-[var(--color-surface-elevated)]/20 nutri-card-hover">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)]/50">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/15 flex items-center justify-center nutri-icon-bounce">
            <Scale size={15} className="text-indigo-400" />
          </div>
          <span className="text-[14px] font-semibold text-[var(--color-text-primary)]">Weight Tracking</span>
          {weightStats && <span className="ml-auto text-[12px] text-[var(--color-text-muted)] tabular-nums">{weightStats.count} entries</span>}
        </div>

        {weightLog.length >= 2 && (
          <div className="px-4 pt-3">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-[30px] font-bold text-[var(--color-text-primary)] tabular-nums leading-none">{weightStats?.latest}</span>
              <span className="text-[13px] text-[var(--color-text-muted)]">kg</span>
              {weightStats && weightStats.change !== 0 && (
                <span className={`text-[13px] font-semibold tabular-nums flex items-center gap-0.5 ${weightStats.change < 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {weightStats.change < 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                  {weightStats.change > 0 ? '+' : ''}{weightStats.change}
                </span>
              )}
            </div>
            <WeightChart entries={weightLog} />
          </div>
        )}
        {weightLog.length === 0 && (
          <div className="px-4 py-8 text-center">
            <Scale size={28} className="mx-auto mb-2 text-[var(--color-text-muted)]/30" />
            <p className="text-[13px] text-[var(--color-text-muted)]">No weight data yet. Log your first entry below.</p>
          </div>
        )}
        {weightLog.length === 1 && (
          <div className="px-4 pt-3 pb-1 text-center">
            <span className="text-[30px] font-bold text-[var(--color-text-primary)] tabular-nums">{weightLog[0].weight_kg}</span>
            <span className="text-[13px] text-[var(--color-text-muted)] ml-1">kg</span>
          </div>
        )}

        {/* Add form */}
        <div className="px-4 py-3 border-t border-[var(--color-border)]/30">
          <div className="flex gap-2">
            <div className="flex-[2]">
              <label className="text-[11px] font-medium text-[var(--color-text-muted)] block mb-1">Weight (kg)</label>
              <NumberField
                value={parseFloat(newWeight) || null}
                min={20} max={300} step={0.1}
                allowEmpty
                placeholder="70.0"
                onCommit={(v) => setNewWeight(v === null ? "" : String(v))}
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-medium text-[var(--color-text-muted)] block mb-1"><Calendar size={10} className="inline mr-0.5" />Date</label>
              <input type="date" value={weightDate} onChange={e => setWeightDate(e.target.value)}
                className="w-full min-h-[46px] px-2 text-[14px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl outline-none focus:border-[var(--color-accent)]/50 transition-colors nutri-input-glow" />
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <div className="flex-[3]">
              <input type="text" value={weightNote} onChange={e => setWeightNote(e.target.value)}
                placeholder="Note (e.g. morning, after workout)"
                className="w-full min-h-[44px] px-4 text-[14px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl outline-none focus:border-[var(--color-accent)]/50 transition-colors nutri-input-glow" />
            </div>
            <button onClick={addWeight} disabled={addingWeight || !newWeight}
              className="flex-1 min-h-[44px] text-[14px] font-semibold rounded-xl bg-indigo-500 text-white hover:bg-indigo-400 disabled:opacity-30 active:scale-95 transition-all flex items-center justify-center gap-1.5 nutri-press">
              <Plus size={15} /> Log
            </button>
          </div>
        </div>

        {/* History list */}
        {weightLog.length > 1 && (
          <div className="border-t border-[var(--color-border)]/30 max-h-[220px] overflow-y-auto">
            {weightLog.map((e, i) => {
              const prev = weightLog[i + 1];
              const diff = prev ? (parseFloat(e.weight_kg) - parseFloat(prev.weight_kg)).toFixed(1) : null;
              const isToday = e.log_date.slice(0, 10) === new Date().toISOString().slice(0, 10);
              return (
                <div key={e.id} className="flex items-center gap-2 px-4 py-2.5 text-[13px] hover:bg-[var(--color-surface-elevated)]/20 group transition-colors border-b border-[var(--color-border)]/10 last:border-0">
                  <span className="text-[var(--color-text-muted)] w-[52px] tabular-nums shrink-0 text-[12px]">{isToday ? 'Today' : e.log_date.slice(5, 10)}</span>
                  <span className="font-semibold tabular-nums text-[var(--color-text-primary)] w-[44px] shrink-0">{e.weight_kg}</span>
                  <span className="text-[var(--color-text-muted)] text-[11px]">kg</span>
                  {diff && Number(diff) !== 0 ? (
                    <span className={`text-[12px] font-semibold tabular-nums ${Number(diff) < 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{Number(diff) > 0 ? '+' : ''}{diff}</span>
                  ) : diff ? <span className="text-[12px] text-[var(--color-text-muted)]/40 tabular-nums">−</span> : null}
                  <span className="text-[var(--color-text-muted)]/40 truncate flex-1 text-[11px]">{e.notes || ''}</span>
                  <button onClick={() => deleteWeight(e.id)}
                    className="opacity-0 group-hover:opacity-100 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-400 transition-all shrink-0 nutri-press">
                    <Trash2 size={14} />
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
