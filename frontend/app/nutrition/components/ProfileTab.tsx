"use client";

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
  // Estimate BMR for live preview
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
            <input type="number" value={profile.weight_kg} step="0.1" onChange={e => setProfile(p => ({ ...p, weight_kg: Number(e.target.value) }))}
              className="w-full px-3 py-1.5 text-[13px] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded outline-none" />
          </div>
          <div>
            <label className="text-[11px] text-[var(--color-text-muted)] block mb-1">
              Body Fat % <span className="text-[var(--color-text-muted)]/40">(optional — enables Katch-McArdle)</span>
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

        {/* ── Live BMR / TDEE Preview ── */}
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
    </div>
  );
}
