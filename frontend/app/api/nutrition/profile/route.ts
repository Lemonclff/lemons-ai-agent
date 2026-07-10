import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserId } from "@/lib/nutrition-auth";

/* ================================================================
   Profile API — TDEE & Macro Calculator
   ================================================================ */

const ACTIVITY: Record<string, { label: string; multiplier: number }> = {
  sedentary:    { label: "Sedentary (little/no exercise)", multiplier: 1.20 },
  light:        { label: "Light (1-3 days/week)",          multiplier: 1.375 },
  moderate:     { label: "Moderate (3-5 days/week)",       multiplier: 1.55 },
  active:       { label: "Active (6-7 days/week)",         multiplier: 1.725 },
  very_active:  { label: "Very Active (athlete, 2×/day)",   multiplier: 1.90 },
};

const GOAL_ADJUSTMENTS: Record<string, { label: string; pct: number; cap: number }> = {
  lose_fast:    { label: "Lose Weight (aggressive)",  pct: -0.20, cap: 750 },
  lose:         { label: "Lose Weight (moderate)",    pct: -0.15, cap: 500 },
  maintain:     { label: "Maintain Weight",           pct:  0.00, cap:   0 },
  gain:         { label: "Gain Weight (moderate)",    pct: +0.10, cap: 400 },
  gain_fast:    { label: "Gain Weight (aggressive)",  pct: +0.15, cap: 600 },
};

function calculateBMR(gender: string, weight_kg: number, height_cm: number, age: number, body_fat_pct?: number): number {
  // Mifflin-St Jeor (default) — most accurate for general population
  // Katch-McArdle when body_fat_pct is provided — more accurate for athletic/lean individuals
  if (body_fat_pct && body_fat_pct > 3 && body_fat_pct < 60) {
    const lbm = weight_kg * (1 - body_fat_pct / 100);
    return 370 + (21.6 * lbm); // Katch-McArdle
  }

  if (gender === "female") {
    return 10 * weight_kg + 6.25 * height_cm - 5 * age - 161;
  }
  return 10 * weight_kg + 6.25 * height_cm - 5 * age + 5;
}

function calculateMacro(weight_kg: number, tdee: number, goal: string) {
  // Protein — goal-dependent preserving muscle in deficit
  let proteinPerKg: number;
  if (goal.startsWith("lose"))       proteinPerKg = 2.2;  // higher to preserve muscle
  else if (goal.startsWith("gain"))  proteinPerKg = 2.0;
  else                               proteinPerKg = 1.8;  // maintain

  const protein = Math.round(weight_kg * proteinPerKg);
  const proteinCal = protein * 4;

  // Fat — minimum based on body weight for hormonal health
  const fatMin = Math.round(weight_kg * 0.8);
  const fatPct = Math.round((tdee * 0.25) / 9); // 25% of TDEE
  const fat = Math.max(fatMin, fatPct);
  const fatCal = fat * 9;

  // Carbs — remainder
  const carbs = Math.round((tdee - proteinCal - fatCal) / 4);
  const carbsCal = carbs * 4;

  return {
    protein, carbs, fat,
    proteinPct: Math.round((proteinCal / tdee) * 100),
    fatPct: Math.round((fatCal / tdee) * 100),
    carbsPct: Math.round((carbsCal / tdee) * 100),
  };
}

/* ---- GET ---- */

export async function GET(req: NextRequest) {
  const uid = getUserId(req);
  if (uid === 0) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id              INTEGER PRIMARY KEY REFERENCES users(id),
        gender               VARCHAR(10) DEFAULT 'male',
        age                  INTEGER DEFAULT 30,
        height_cm            DECIMAL(5,1) DEFAULT 170,
        weight_kg            DECIMAL(5,1) DEFAULT 70,
        body_fat_pct         DECIMAL(4,1),
        activity_level       VARCHAR(20) DEFAULT 'moderate',
        goal                 VARCHAR(20) DEFAULT 'maintain',
        daily_calorie_target INTEGER DEFAULT 2000,
        daily_protein_target INTEGER DEFAULT 100,
        daily_carbs_target   INTEGER DEFAULT 250,
        daily_fat_target     INTEGER DEFAULT 65,
        daily_bmr            INTEGER,
        daily_tdee           INTEGER,
        updated_at           TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Migration: add new columns if they don't exist
    await query(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS body_fat_pct DECIMAL(4,1)`).catch(() => {});
    await query(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS daily_bmr INTEGER`).catch(() => {});
    await query(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS daily_tdee INTEGER`).catch(() => {});

    const r = await query(`SELECT * FROM user_profiles WHERE user_id = $1`, [uid]);
    return NextResponse.json({ profile: r.rows[0] || null });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/* ---- POST ---- */

export async function POST(req: NextRequest) {
  const uid = getUserId(req);
  if (uid === 0) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id              INTEGER PRIMARY KEY REFERENCES users(id),
        gender               VARCHAR(10) DEFAULT 'male',
        age                  INTEGER DEFAULT 30,
        height_cm            DECIMAL(5,1) DEFAULT 170,
        weight_kg            DECIMAL(5,1) DEFAULT 70,
        body_fat_pct         DECIMAL(4,1),
        activity_level       VARCHAR(20) DEFAULT 'moderate',
        goal                 VARCHAR(20) DEFAULT 'maintain',
        daily_calorie_target INTEGER DEFAULT 2000,
        daily_protein_target INTEGER DEFAULT 100,
        daily_carbs_target   INTEGER DEFAULT 250,
        daily_fat_target     INTEGER DEFAULT 65,
        daily_bmr            INTEGER,
        daily_tdee           INTEGER,
        updated_at           TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await query(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS body_fat_pct DECIMAL(4,1)`).catch(() => {});
    await query(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS daily_bmr INTEGER`).catch(() => {});
    await query(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS daily_tdee INTEGER`).catch(() => {});

    const body = await req.json();
    const {
      gender, age, height_cm, weight_kg, body_fat_pct,
      activity_level, goal,
    } = body;

    // ─── BMR ───
    const bmr = Math.round(calculateBMR(gender, weight_kg, height_cm, age, body_fat_pct || undefined));

    // ─── TDEE ───
    const act = ACTIVITY[activity_level] || ACTIVITY.moderate;
    const tdee = Math.round(bmr * act.multiplier);

    // ─── Goal adjustment ───
    const adj = GOAL_ADJUSTMENTS[goal] || GOAL_ADJUSTMENTS.maintain;
    const delta = Math.round(tdee * adj.pct);
    const capped = adj.cap > 0 ? (delta > 0 ? Math.min(delta, adj.cap) : Math.max(delta, -adj.cap)) : delta;
    const target = tdee + capped;

    // ─── Macros ───
    const macros = calculateMacro(weight_kg, target, goal);

    await query(
      `INSERT INTO user_profiles (user_id, gender, age, height_cm, weight_kg, body_fat_pct, activity_level, goal,
         daily_calorie_target, daily_protein_target, daily_carbs_target, daily_fat_target,
         daily_bmr, daily_tdee, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         gender=$2, age=$3, height_cm=$4, weight_kg=$5, body_fat_pct=$6,
         activity_level=$7, goal=$8,
         daily_calorie_target=$9, daily_protein_target=$10, daily_carbs_target=$11, daily_fat_target=$12,
         daily_bmr=$13, daily_tdee=$14, updated_at=CURRENT_TIMESTAMP
       RETURNING *`,
      [
        uid, gender, age, height_cm, weight_kg, body_fat_pct ?? null,
        activity_level, goal,
        target, macros.protein, macros.carbs, macros.fat,
        bmr, tdee,
      ]
    );

    const r = await query(`SELECT * FROM user_profiles WHERE user_id = $1`, [uid]);
    return NextResponse.json({
      profile: r.rows[0],
      breakdown: {
        formula: body_fat_pct ? "Katch-McArdle (LBM)" : "Mifflin-St Jeor",
        bmr,
        activityMultiplier: act.multiplier,
        tdee,
        goalAdjustment: `${adj.label} (${capped >= 0 ? '+' : ''}${capped} kcal)`,
        target,
        macros: { protein: `${macros.protein}g`, carbs: `${macros.carbs}g`, fat: `${macros.fat}g` },
        macroSplit: `P:${macros.proteinPct}% C:${macros.carbsPct}% F:${macros.fatPct}%`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
