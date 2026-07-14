import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserId } from "@/lib/nutrition-auth";

/* ================================================================
   Exercise Logs API
   GET    /api/nutrition/exercise?date=  — day's exercises + total
   POST   /api/nutrition/exercise        — add exercise entry
   DELETE /api/nutrition/exercise?id=    — remove entry
   ================================================================ */


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

async function getUserWeight(userId: number): Promise<number> {
  try {
    if (!userId) return 70;
    const r = await query(`SELECT weight_kg FROM user_profiles WHERE user_id = $1`, [userId]);
    return Number(r.rows[0]?.weight_kg) || 70;
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
  const uid = getUserId(req);
  await ensureTable();
  const date = req.nextUrl.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  try {
    const result = await query(
      `SELECT * FROM exercise_logs WHERE user_id = $1 AND log_date = $2 ORDER BY created_at DESC`,
      [uid, date]
    );
    const totalBurned = result.rows.reduce((sum: number, r: any) => sum + Number(r.calories_burned || 0), 0);
    return NextResponse.json({ exercises: result.rows, total_burned: Math.round(totalBurned * 10) / 10 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const uid = getUserId(req);
  if (uid === 0) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  await ensureTable();
  try {
    const body = await req.json();
    const { exercise_name, duration_min, log_date, calories_burned } = body;
    const hasCustomCal = calories_burned !== undefined && calories_burned !== null && calories_burned !== "";
    if (!exercise_name || (!duration_min && !hasCustomCal)) {
      return NextResponse.json({ error: "exercise_name and either duration_min or calories_burned required" }, { status: 400 });
    }

    const date = log_date || new Date().toISOString().slice(0, 10);
    let met: number | null = null;
    let calories: number;

    if (hasCustomCal) {
      // Custom calories — use directly
      calories = Number(calories_burned);
      met = 0; // custom, no MET
    } else {
      // Exact match, then case-insensitive / partial match against MET table
      met = MET_TABLE[exercise_name] ?? null;
      if (met === null) {
        const key = Object.keys(MET_TABLE).find(
          (k) => k.toLowerCase() === exercise_name.toLowerCase()
            || k.toLowerCase().includes(exercise_name.toLowerCase())
            || exercise_name.toLowerCase().includes(k.toLowerCase().split(" (")[0])
        );
        met = key ? MET_TABLE[key] : null;
      }
      if (met === null) {
        // Free-text exercise without known MET: use moderate default (5.0)
        met = 5.0;
      }
      const weightKg = await getUserWeight(uid);
      calories = calcCalories(met, weightKg, Number(duration_min) || 30);
    }

    const result = await query(
      `INSERT INTO exercise_logs (user_id, log_date, exercise_name, duration_min, met_value, calories_burned)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [uid, date, exercise_name, duration_min || 0, met || 0, calories]
    );

    return NextResponse.json({ entry: result.rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const uid = getUserId(req);
  if (uid === 0) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    const body = await req.json();
    const { duration_min, calories_burned } = body;

    // Fetch current record
    const existing = await query(
      `SELECT * FROM exercise_logs WHERE id = $1 AND user_id = $2`,
      [id, uid]
    );
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const rec = existing.rows[0];
    const newDuration = duration_min !== undefined ? Number(duration_min) : rec.duration_min;
    let newCalories = rec.calories_burned;
    let newMet = rec.met_value;

    if (calories_burned !== undefined && calories_burned !== null) {
      // User directly set calories — use as-is, mark as custom (met=0)
      newCalories = Number(calories_burned);
      newMet = 0;
    } else if (duration_min !== undefined) {
      // Duration changed — recalculate from MET if known, else scale proportionally
      const met = MET_TABLE[rec.exercise_name] || (Number(rec.met_value) > 0 ? Number(rec.met_value) : null);
      if (met) {
        const weightKg = await getUserWeight(uid);
        newCalories = calcCalories(met, weightKg, newDuration);
        newMet = met;
      } else if (Number(rec.duration_min) > 0) {
        // Scale custom calories by duration ratio
        const ratio = newDuration / Number(rec.duration_min);
        newCalories = Math.round(Number(rec.calories_burned) * ratio * 10) / 10;
      } else {
        newCalories = rec.calories_burned;
      }
    }

    const result = await query(
      `UPDATE exercise_logs SET duration_min=$1, met_value=$2, calories_burned=$3
       WHERE id=$4 AND user_id=$5 RETURNING *`,
      [newDuration, newMet, newCalories, id, uid]
    );

    return NextResponse.json({ entry: result.rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const uid = getUserId(req);
  if (uid === 0) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    await query(`DELETE FROM exercise_logs WHERE id = $1 AND user_id = $2`, [id, uid]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
