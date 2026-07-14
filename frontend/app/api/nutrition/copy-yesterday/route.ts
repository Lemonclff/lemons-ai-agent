import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserId } from "@/lib/nutrition-auth";

/** Local YYYY-MM-DD (avoids UTC off-by-one near midnight). */
function localDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function POST(req: NextRequest) {
  const uid = getUserId(req);
  if (uid === 0) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    // Prefer client-provided dates (local timezone); fall back to server local date
    const today = (body.log_date as string) || localDateStr();
    let yesterday = body.yesterday as string | undefined;
    if (!yesterday) {
      const d = new Date(today + "T12:00:00");
      d.setDate(d.getDate() - 1);
      yesterday = localDateStr(d);
    }

    const yesterdayLogs = await query(
      `SELECT meal_type, food_name, amount, serving_unit, calories, protein, carbs, fat
       FROM daily_food_logs WHERE user_id = $1 AND log_date = $2`,
      [uid, yesterday]
    );

    let copied = 0;
    for (const log of yesterdayLogs.rows) {
      const existing = await query(
        `SELECT id FROM daily_food_logs
         WHERE user_id = $1 AND log_date = $2 AND food_name = $3 AND meal_type = $4 LIMIT 1`,
        [uid, today, log.food_name, log.meal_type]
      );
      if (existing.rows.length > 0) continue;

      await query(
        `INSERT INTO daily_food_logs
           (user_id, log_date, meal_type, food_name, amount, serving_unit, calories, protein, carbs, fat, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'copy')`,
        [
          uid, today, log.meal_type, log.food_name, log.amount,
          log.serving_unit || "g", log.calories, log.protein, log.carbs, log.fat,
        ]
      );
      copied++;
    }

    return NextResponse.json({ ok: true, copied, from: yesterday, to: today });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
