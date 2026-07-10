     1|import { NextRequest, NextResponse } from "next/server";
     2|import { query } from "@/lib/db";
import { getUserId } from "@/lib/nutrition-auth";
     3|
     4|/* ================================================================
     5|   Exercise Logs API
     6|   GET    /api/nutrition/exercise?date=  — day's exercises + total
     7|   POST   /api/nutrition/exercise        — add exercise entry
     8|   DELETE /api/nutrition/exercise?id=    — remove entry
     9|   ================================================================ */
    10|
    11|const uid = 1;
    12|
    13|const MET_TABLE: Record<string, number> = {
    14|  "Running (8 km/h)": 8.0, "Running (10 km/h)": 10.0, "Running (12 km/h)": 12.0,
    15|  "Brisk Walking (5.5 km/h)": 4.5, "Walking (4 km/h)": 3.0,
    16|  "Cycling (moderate)": 6.0, "Cycling (vigorous)": 8.0,
    17|  "Swimming (moderate)": 7.0, "Jump Rope": 10.0, "HIIT Training": 8.0,
    18|  "Rowing Machine": 7.0, "Elliptical Trainer": 5.0, "Stair Climber": 8.0,
    19|  "Weight Training": 5.0, "Bodyweight Exercise": 4.5,
    20|  "Yoga": 3.0, "Pilates": 3.5, "Tai Chi": 3.5, "Hiking": 6.5,
    21|  "Basketball": 6.5, "Badminton": 5.5, "Table Tennis": 4.0,
    22|  "Aerobic Dance": 6.0, "Dance": 5.0,
    23|  "House Cleaning": 3.0, "Walking Dog": 3.0,
    24|};
    25|
    26|async function getUserWeight(): Promise<number> {
    27|  try {
    28|    const r = await query(`SELECT weight_kg FROM user_profiles WHERE user_id = $1`, [uid]);
    29|    return r.rows[0]?.weight_kg || 70;
    30|  } catch { return 70; }
    31|}
    32|
    33|function calcCalories(met: number, weightKg: number, durationMin: number): number {
    34|  return Math.round(met * weightKg * (durationMin / 60) * 10) / 10;
    35|}
    36|
    37|async function ensureTable() {
    38|  await query(`
    39|    CREATE TABLE IF NOT EXISTS exercise_logs (
    40|      id              SERIAL PRIMARY KEY,
    41|      user_id         INTEGER NOT NULL REFERENCES users(id),
    42|      log_date        DATE NOT NULL,
    43|      exercise_name   VARCHAR(100) NOT NULL,
    44|      duration_min    INTEGER NOT NULL,
    45|      met_value       DECIMAL(5,1) NOT NULL,
    46|      calories_burned DECIMAL(8,1) NOT NULL,
    47|      created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    48|    );
    49|    CREATE INDEX IF NOT EXISTS idx_exercise_user_date ON exercise_logs (user_id, log_date DESC);
    50|  `);
    51|}
    52|
    53|export async function GET(req: NextRequest) {
  const uid = getUserId(req);
    54|  await ensureTable();
    55|  const date = req.nextUrl.searchParams.get("date") || new Date().toISOString().slice(0, 10);
    56|  try {
    57|    const result = await query(
    58|      `SELECT * FROM exercise_logs WHERE user_id = $1 AND log_date = $2 ORDER BY created_at DESC`,
    59|      [uid, date]
    60|    );
    61|    const totalBurned = result.rows.reduce((sum: number, r: any) => sum + Number(r.calories_burned || 0), 0);
    62|    return NextResponse.json({ exercises: result.rows, total_burned: Math.round(totalBurned * 10) / 10 });
    63|  } catch (e) {
    64|    return NextResponse.json({ error: String(e) }, { status: 500 });
    65|  }
    66|}
    67|
    68|export async function POST(req: NextRequest) {
  const uid = getUserId(req);
    69|  await ensureTable();
    70|  try {
    71|    const body = await req.json();
    72|    const { exercise_name, duration_min, log_date, calories_burned } = body;
    73|    if (!exercise_name || (!duration_min && !calories_burned)) {
    74|      return NextResponse.json({ error: "exercise_name and either duration_min or calories_burned required" }, { status: 400 });
    75|    }
    76|
    77|    const date = log_date || new Date().toISOString().slice(0, 10);
    78|    let met: number | null = null;
    79|    let calories: number;
    80|
    81|    if (calories_burned !== undefined && calories_burned !== null) {
    82|      // Custom calories — use directly
    83|      calories = Number(calories_burned);
    84|      met = 0; // custom, no MET
    85|    } else {
    86|      // Calculate from MET table
    87|      met = MET_TABLE[exercise_name] || null;
    88|      if (met === null) {
    89|        return NextResponse.json({ error: `Unknown exercise: ${exercise_name}. Provide calories_burned for custom exercises.` }, { status: 400 });
    90|      }
    91|      const weightKg = await getUserWeight();
    92|      calories = calcCalories(met, weightKg, Number(duration_min));
    93|    }
    94|
    95|    const result = await query(
    96|      `INSERT INTO exercise_logs (user_id, log_date, exercise_name, duration_min, met_value, calories_burned)
    97|       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    98|      [uid, date, exercise_name, duration_min || 0, met || 0, calories]
    99|    );
   100|
   101|    return NextResponse.json({ entry: result.rows[0] });
   102|  } catch (e) {
   103|    return NextResponse.json({ error: String(e) }, { status: 500 });
   104|  }
   105|}
   106|
   107|export async function PUT(req: NextRequest) {
  const uid = getUserId(req);
   108|  const id = req.nextUrl.searchParams.get("id");
   109|  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
   110|
   111|  try {
   112|    const body = await req.json();
   113|    const { duration_min, calories_burned } = body;
   114|
   115|    // Fetch current record
   116|    const existing = await query(
   117|      `SELECT * FROM exercise_logs WHERE id = $1 AND user_id = $2`,
   118|      [id, uid]
   119|    );
   120|    if (existing.rows.length === 0) {
   121|      return NextResponse.json({ error: "not found" }, { status: 404 });
   122|    }
   123|
   124|    const rec = existing.rows[0];
   125|    const newDuration = duration_min !== undefined ? Number(duration_min) : rec.duration_min;
   126|    let newCalories = rec.calories_burned;
   127|    let newMet = rec.met_value;
   128|
   129|    if (calories_burned !== undefined && calories_burned !== null) {
   130|      // User directly set calories — use as-is, mark as custom (met=0)
   131|      newCalories = Number(calories_burned);
   132|      newMet = 0;
   133|    } else if (duration_min !== undefined) {
   134|      // Duration changed — recalculate from MET if known
   135|      const met = MET_TABLE[rec.exercise_name];
   136|      if (met) {
   137|        const weightKg = await getUserWeight();
   138|        newCalories = calcCalories(met, weightKg, newDuration);
   139|        newMet = met;
   140|      } else {
   141|        // Custom exercise without MET — keep existing calories
   142|        newCalories = rec.calories_burned;
   143|      }
   144|    }
   145|
   146|    const result = await query(
   147|      `UPDATE exercise_logs SET duration_min=$1, met_value=$2, calories_burned=$3
   148|       WHERE id=$4 AND user_id=$5 RETURNING *`,
   149|      [newDuration, newMet, newCalories, id, uid]
   150|    );
   151|
   152|    return NextResponse.json({ entry: result.rows[0] });
   153|  } catch (e) {
   154|    return NextResponse.json({ error: String(e) }, { status: 500 });
   155|  }
   156|}
   157|
   158|export async function DELETE(req: NextRequest) {
  const uid = getUserId(req);
   159|  const id = req.nextUrl.searchParams.get("id");
   160|  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
   161|  try {
   162|    await query(`DELETE FROM exercise_logs WHERE id = $1 AND user_id = $2`, [id, uid]);
   163|    return NextResponse.json({ ok: true });
   164|  } catch (e) {
   165|    return NextResponse.json({ error: String(e) }, { status: 500 });
   166|  }
   167|}
   168|