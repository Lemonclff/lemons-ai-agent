import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const UID = 1;

export async function POST() {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  try {
    const yesterdayLogs = await query(
      `SELECT * FROM daily_food_logs WHERE user_id = $1 AND log_date = $2`,
      [UID, yesterday]
    );

    let copied = 0;
    for (const log of yesterdayLogs.rows) {
      const existing = await query(
        `SELECT id FROM daily_food_logs WHERE user_id = $1 AND log_date = $2 AND food_name = $3 AND meal_type = $4 LIMIT 1`,
        [UID, today, log.food_name, log.meal_type]
      );
      if (existing.rows.length > 0) continue;

      await query(
        `INSERT INTO daily_food_logs (user_id, log_date, meal_type, food_name, amount, calories, protein, carbs, fat, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'copy')`,
        [UID, today, log.meal_type, log.food_name, log.amount, log.calories, log.protein, log.carbs, log.fat]
      );
      copied++;
    }

    return NextResponse.json({ ok: true, copied });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
