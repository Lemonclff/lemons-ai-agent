"use client";

interface UserProfile {
  gender: string; age: number; height_cm: number; weight_kg: number;
  activity_level: string; goal: string;
  daily_calorie_target: number; daily_protein_target: number; daily_carbs_target: number; daily_fat_target: number;
}

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

export function ProfileTab({
  profile, setProfile, goals, saveProfile,
}: {
  profile: UserProfile; setProfile: (fn:(p:UserProfile)=>UserProfile) => void;
  goals: {calories:number,protein:number,carbs:number,fat:number}; saveProfile: () => void;
}) {
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
