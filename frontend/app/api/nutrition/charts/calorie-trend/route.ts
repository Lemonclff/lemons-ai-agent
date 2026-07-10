import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserId } from "@/lib/nutrition-auth";

/* ================================================================
   Chart Image API — proxies to AntV Studio for G2 chart images
   GET /api/nutrition/charts/calorie-trend?days=7
   ================================================================ */

export async function GET(req: NextRequest) {
  const uid = getUserId(req);
  if (uid === 0) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const days = parseInt(req.nextUrl.searchParams.get("days") || "7");
  const type = req.nextUrl.searchParams.get("type") || "calories";

  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));
  const from = startDate.toISOString().slice(0, 10);
  const to = endDate.toISOString().slice(0, 10);

  try {
    const result = await query(
      `SELECT log_date, SUM(calories) as total_cal, SUM(protein) as total_protein, SUM(carbs) as total_carbs, SUM(fat) as total_fat
       FROM daily_food_logs WHERE user_id = $1 AND log_date BETWEEN $2 AND $3
       GROUP BY log_date ORDER BY log_date`,
      [uid, from, to]
    );

    // Build full 7-day data with zeros for missing days
    const dataMap: Record<string, Record<string, number>> = {};
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      dataMap[key] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    }
    for (const row of result.rows) {
      const d = String(row.log_date).slice(0, 10);
      dataMap[d] = {
        calories: Math.round(Number(row.total_cal) || 0),
        protein: parseFloat((Number(row.total_protein) || 0).toFixed(1)),
        carbs: parseFloat((Number(row.total_carbs) || 0).toFixed(1)),
        fat: parseFloat((Number(row.total_fat) || 0).toFixed(1)),
      };
    }

    // Get user's calorie goal
    let goalLine = 2000;
    try {
      const prof = await query(`SELECT daily_calorie_target FROM user_profiles WHERE user_id = $1`, [uid]);
      if (prof.rows[0]?.daily_calorie_target) goalLine = Number(prof.rows[0].daily_calorie_target);
    } catch {}

    // Build AntV chart data
    const chartData = Object.entries(dataMap).map(([date, vals]) => ({
      date: new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" }),
      fullDate: date,
      value: type === "calories" ? vals.calories : type === "protein" ? vals.protein : type === "carbs" ? vals.carbs : vals.fat,
    }));

    // Call AntV Studio API
    const antvBody: any = {
      type: "column",
      source: "chart-visualization-skills",
      data: chartData.map((d: any) => ({ category: d.date, value: d.value })),
      title: `${days}-Day ${type.charAt(0).toUpperCase() + type.slice(1)} Trend`,
      theme: "dark",
      width: 640,
      height: 320,
      style: { texture: "default" },
      axisXTitle: "Day",
      axisYTitle: type === "calories" ? "kcal" : "g",
    };

    // Add goal line annotation
    if (type === "calories" && goalLine > 0) {
      antvBody.annotations = [
        { type: "lineY", y: goalLine, style: { stroke: "#ef4444", lineDash: [4, 4], lineWidth: 1.5 }, label: `Goal: ${goalLine}` },
      ];
    }

    const resp = await fetch("https://antv-studio.alipay.com/api/gpt-vis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(antvBody),
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      return NextResponse.json({ error: `AntV API error: ${resp.status}` }, { status: 502 });
    }

    const antvResult = await resp.json();
    if (antvResult.success && antvResult.resultObj) {
      return NextResponse.json({ imageUrl: antvResult.resultObj, chartData, goal: goalLine });
    }

    return NextResponse.json({ error: "Chart generation failed" }, { status: 502 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
