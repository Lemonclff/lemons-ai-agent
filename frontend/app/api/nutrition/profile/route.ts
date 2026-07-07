import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

const UID = 1;

const ACTIVITY: Record<string, number> = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
};

/* ---- GET ---- */

export async function GET() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id              INTEGER PRIMARY KEY REFERENCES users(id),
        gender               VARCHAR(10) DEFAULT 'male',
        age                  INTEGER DEFAULT 30,
        height_cm            DECIMAL(5,1) DEFAULT 170,
        weight_kg            DECIMAL(5,1) DEFAULT 70,
        activity_level       VARCHAR(20) DEFAULT 'moderate',
        goal                 VARCHAR(20) DEFAULT 'maintain',
        daily_calorie_target INTEGER DEFAULT 2000,
        daily_protein_target INTEGER DEFAULT 100,
        daily_carbs_target   INTEGER DEFAULT 250,
        daily_fat_target     INTEGER DEFAULT 65,
        updated_at           TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const r = await query(`SELECT * FROM user_profiles WHERE user_id = $1`, [UID]);
    return NextResponse.json({ profile: r.rows[0] || null });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/* ---- POST ---- */

export async function POST(req: NextRequest) {
  try {
    // Ensure table exists
    await query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id              INTEGER PRIMARY KEY REFERENCES users(id),
        gender               VARCHAR(10) DEFAULT 'male',
        age                  INTEGER DEFAULT 30,
        height_cm            DECIMAL(5,1) DEFAULT 170,
        weight_kg            DECIMAL(5,1) DEFAULT 70,
        activity_level       VARCHAR(20) DEFAULT 'moderate',
        goal                 VARCHAR(20) DEFAULT 'maintain',
        daily_calorie_target INTEGER DEFAULT 2000,
        daily_protein_target INTEGER DEFAULT 100,
        daily_carbs_target   INTEGER DEFAULT 250,
        daily_fat_target     INTEGER DEFAULT 65,
        updated_at           TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const body = await req.json();
    const { gender, age, height_cm, weight_kg, activity_level, goal } = body;

    // Mifflin-St Jeor BMR
    let bmr: number;
    if (gender === "female") {
      bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161;
    } else {
      bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5;
    }

    const mult = ACTIVITY[activity_level] || 1.55;
    let tdee = Math.round(bmr * mult);

    if (goal === "lose") tdee -= 500;
    else if (goal === "gain") tdee += 500;

    const protein = Math.round(weight_kg * 2.0);
    const fat = Math.round((tdee * 0.25) / 9);
    const carbs = Math.round((tdee - protein * 4 - fat * 9) / 4);

    await query(
      `INSERT INTO user_profiles (user_id, gender, age, height_cm, weight_kg, activity_level, goal, daily_calorie_target, daily_protein_target, daily_carbs_target, daily_fat_target, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         gender=$2, age=$3, height_cm=$4, weight_kg=$5, activity_level=$6, goal=$7,
         daily_calorie_target=$8, daily_protein_target=$9, daily_carbs_target=$10, daily_fat_target=$11, updated_at=CURRENT_TIMESTAMP
       RETURNING *`,
      [UID, gender, age, height_cm, weight_kg, activity_level, goal, tdee, protein, carbs, fat]
    );

    const r = await query(`SELECT * FROM user_profiles WHERE user_id = $1`, [UID]);
    return NextResponse.json({ profile: r.rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
