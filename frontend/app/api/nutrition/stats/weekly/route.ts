import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

const UID = 1;

export async function GET(req: NextRequest) {
  const dateStr = req.nextUrl.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const endDate = new Date(dateStr + "T12:00:00");
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 6);

  const from = startDate.toISOString().slice(0, 10);
  const to = endDate.toISOString().slice(0, 10);

  try {
    const result = await query(
      `SELECT log_date, SUM(calories) as total_cal, SUM(protein) as total_protein, SUM(carbs) as total_carbs, SUM(fat) as total_fat
       FROM daily_food_logs
       WHERE user_id = $1 AND log_date BETWEEN $2 AND $3
       GROUP BY log_date ORDER BY log_date`,
      [UID, from, to]
    );

    const daily: Record<string, Record<string, number>> = {};
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      daily[key] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    }
    for (const row of result.rows) {
      const raw = row.log_date;
      let d: string;
      if (typeof raw === "string") {
        d = raw.slice(0, 10);
      } else if (raw instanceof Date) {
        d = `${raw.getFullYear()}-${String(raw.getMonth()+1).padStart(2,"0")}-${String(raw.getDate()).padStart(2,"0")}`;
      } else {
        d = String(raw).slice(0, 10);
      }
      daily[d] = {
        calories: Math.round(Number(row.total_cal) || 0),
        protein: parseFloat((Number(row.total_protein) || 0).toFixed(1)),
        carbs: parseFloat((Number(row.total_carbs) || 0).toFixed(1)),
        fat: parseFloat((Number(row.total_fat) || 0).toFixed(1)),
      };
    }

    return NextResponse.json({ weekly: daily });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
