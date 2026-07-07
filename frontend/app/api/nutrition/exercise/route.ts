import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

/* ================================================================
   Exercise Logs API
   GET    /api/nutrition/exercise?date=  — day's exercises + total
   POST   /api/nutrition/exercise        — add exercise entry
   DELETE /api/nutrition/exercise?id=    — remove entry
   ================================================================ */

const UID = 1;

const MET_TABLE: Record<string, number> = {
  "Running (8 km/h)": 8.0, "Running (10 km/h)": 10.0, "Running (12 km/h)": 12.0,
  "Brisk Walking (5.5 km/h)": 4.5, "Walking (4 km/h)": 3.0,
  "Cycling (moderate)": 6.0, "Cycling (vigorous)": 8.0,
  "Swimming (moderate)": 7.0, "Jump Rope": 10.0, "HIIT Training": 8.0,
  "Rowing Machine": 7.0, "Elliptical Trainer": 5.0, "Stair Climber": 8.0,
  "Weight Training": 5.0, "Bodyweight Exercise": 4.5,
  "Yoga": 3.0, "Pilates": 3.5, "Tai Chi": 3.5, "Hiking": 6.5,
  "Basketball": 6.5, "Badminton": 5.5, "Table Tennis": 4.0,
  "Aerobic Dance": 6.0, "Dance": 5.0,
  "House Cleaning": 3.0, "Walking Dog": 3.0,
};

async function getUserWeight(): Promise<number> {
  try {
    const r = await query(`SELECT weight_kg FROM user_profiles WHERE user_id = $1`, [UID]);
    return r.rows[0]?.weight_kg || 70;
  } catch { return 70; }
}

function calcCalories(met: number, weightKg: number, durationMin: number): number {
  return Math.round(met * weightKg * (durationMin / 60) * 10) / 10;
}

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS exercise_logs (
      id              SERIAL PRIMARY KEY,
      user_id         INTEGER NOT NULL REFERENCES users(id),
      log_date        DATE NOT NULL,
      exercise_name   VARCHAR(100) NOT NULL,
      duration_min    INTEGER NOT NULL,
      met_value       DECIMAL(5,1) NOT NULL,
      calories_burned DECIMAL(8,1) NOT NULL,
      created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_exercise_user_date ON exercise_logs (user_id, log_date DESC);
  `);
}

export async function GET(req: NextRequest) {
  await ensureTable();
  const date = req.nextUrl.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  try {
    const result = await query(
      `SELECT * FROM exercise_logs WHERE user_id = $1 AND log_date = $2 ORDER BY created_at DESC`,
      [UID, date]
    );
    const totalBurned = result.rows.reduce((sum: number, r: any) => sum + Number(r.calories_burned || 0), 0);
    return NextResponse.json({ exercises: result.rows, total_burned: Math.round(totalBurned * 10) / 10 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await ensureTable();
  try {
    const body = await req.json();
    const { exercise_name, duration_min, log_date } = body;
    if (!exercise_name || !duration_min) {
      return NextResponse.json({ error: "exercise_name and duration_min required" }, { status: 400 });
    }

    const met = MET_TABLE[exercise_name];
    if (!met) {
      return NextResponse.json({ error: `Unknown exercise: ${exercise_name}` }, { status: 400 });
    }

    const weightKg = await getUserWeight();
    const calories = calcCalories(met, weightKg, Number(duration_min));
    const date = log_date || new Date().toISOString().slice(0, 10);

    const result = await query(
      `INSERT INTO exercise_logs (user_id, log_date, exercise_name, duration_min, met_value, calories_burned)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [UID, date, exercise_name, duration_min, met, calories]
    );

    return NextResponse.json({ entry: result.rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    await query(`DELETE FROM exercise_logs WHERE id = $1 AND user_id = $2`, [id, UID]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
