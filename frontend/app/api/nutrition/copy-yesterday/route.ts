     1|import { NextResponse } from "next/server";
     2|import { query } from "@/lib/db";
import { getUserId } from "@/lib/nutrition-auth";
     3|
     4|const uid = 1;
     5|
     6|export async function POST() {
     7|  const today = new Date().toISOString().slice(0, 10);
     8|  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
     9|
    10|  try {
    11|    const yesterdayLogs = await query(
    12|      `SELECT * FROM daily_food_logs WHERE user_id = $1 AND log_date = $2`,
    13|      [uid, yesterday]
    14|    );
    15|
    16|    let copied = 0;
    17|    for (const log of yesterdayLogs.rows) {
    18|      const existing = await query(
    19|        `SELECT id FROM daily_food_logs WHERE user_id = $1 AND log_date = $2 AND food_name = $3 AND meal_type = $4 LIMIT 1`,
    20|        [uid, today, log.food_name, log.meal_type]
    21|      );
    22|      if (existing.rows.length > 0) continue;
    23|
    24|      await query(
    25|        `INSERT INTO daily_food_logs (user_id, log_date, meal_type, food_name, amount, calories, protein, carbs, fat, source)
    26|         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'copy')`,
    27|        [uid, today, log.meal_type, log.food_name, log.amount, log.calories, log.protein, log.carbs, log.fat]
    28|      );
    29|      copied++;
    30|    }
    31|
    32|    return NextResponse.json({ ok: true, copied });
    33|  } catch (e) {
    34|    return NextResponse.json({ error: String(e) }, { status: 500 });
    35|  }
    36|}
    37|