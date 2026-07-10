     1|import { NextRequest, NextResponse } from "next/server";
     2|import { query } from "@/lib/db";
import { getUserId } from "@/lib/nutrition-auth";
     3|
     4|const uid = 1;
     5|
     6|export async function GET(req: NextRequest) {
  const uid = getUserId(req);
     7|  const dateStr = req.nextUrl.searchParams.get("date") || new Date().toISOString().slice(0, 10);
     8|  const endDate = new Date(dateStr + "T12:00:00");
     9|  const startDate = new Date(endDate);
    10|  startDate.setDate(startDate.getDate() - 6);
    11|
    12|  const from = startDate.toISOString().slice(0, 10);
    13|  const to = endDate.toISOString().slice(0, 10);
    14|
    15|  try {
    16|    const result = await query(
    17|      `SELECT log_date, SUM(calories) as total_cal, SUM(protein) as total_protein, SUM(carbs) as total_carbs, SUM(fat) as total_fat
    18|       FROM daily_food_logs
    19|       WHERE user_id = $1 AND log_date BETWEEN $2 AND $3
    20|       GROUP BY log_date ORDER BY log_date`,
    21|      [uid, from, to]
    22|    );
    23|
    24|    const daily: Record<string, Record<string, number>> = {};
    25|    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    26|      const key = d.toISOString().slice(0, 10);
    27|      daily[key] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    28|    }
    29|    for (const row of result.rows) {
    30|      const raw = row.log_date;
    31|      let d: string;
    32|      if (typeof raw === "string") {
    33|        d = raw.slice(0, 10);
    34|      } else if (raw instanceof Date) {
    35|        d = `${raw.getFullYear()}-${String(raw.getMonth()+1).padStart(2,"0")}-${String(raw.getDate()).padStart(2,"0")}`;
    36|      } else {
    37|        d = String(raw).slice(0, 10);
    38|      }
    39|      daily[d] = {
    40|        calories: Math.round(Number(row.total_cal) || 0),
    41|        protein: parseFloat((Number(row.total_protein) || 0).toFixed(1)),
    42|        carbs: parseFloat((Number(row.total_carbs) || 0).toFixed(1)),
    43|        fat: parseFloat((Number(row.total_fat) || 0).toFixed(1)),
    44|      };
    45|    }
    46|
    47|    return NextResponse.json({ weekly: daily });
    48|  } catch (e) {
    49|    return NextResponse.json({ error: String(e) }, { status: 500 });
    50|  }
    51|}
    52|