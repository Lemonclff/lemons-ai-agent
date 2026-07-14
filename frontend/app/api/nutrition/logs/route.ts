import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserId } from "@/lib/nutrition-auth";

/* ================================================================
   Daily Food Logs API
   GET  /api/nutrition/logs?date=2026-07-07  — query day's logs + summary
   POST /api/nutrition/logs                  — add food entry
   DELETE /api/nutrition/logs?id=1           — remove entry
   PUT  /api/nutrition/logs?id=1             — update weight / meal_type
   ================================================================ */

export async function GET(req: NextRequest) {
  const uid = getUserId(req);
  const action = req.nextUrl.searchParams.get("action");

  if (action === "units") {
    try {
      const result = await query(
        `SELECT DISTINCT COALESCE(serving_unit, 'g') as unit
         FROM daily_food_logs WHERE user_id = $1 ORDER BY unit`,
        [uid]
      );
      return NextResponse.json({ units: result.rows.map((r: any) => r.unit) });
    } catch {
      return NextResponse.json({ units: ["g", "ml", "份", "碗", "杯", "罐", "瓶", "個", "包", "碟"] });
    }
  }

  const date = req.nextUrl.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  try {
    const result = await query(
      `SELECT id, user_id, log_date, meal_type, food_name,
              ROUND(amount::numeric, 0) as amount,
              COALESCE(serving_unit, 'g') as serving_unit,
              ROUND(calories::numeric, 1) as calories,
              ROUND(protein::numeric, 1) as protein,
              ROUND(carbs::numeric, 1) as carbs,
              ROUND(fat::numeric, 1) as fat,
              source, created_at
       FROM daily_food_logs WHERE user_id = $1 AND log_date = $2 ORDER BY created_at DESC`,
      [uid, date]
    );

    const summary = result.rows.reduce(
      (acc: Record<string, number>, row: Record<string, unknown>) => ({
        calories: acc.calories + (Number(row.calories) || 0),
        protein: acc.protein + (Number(row.protein) || 0),
        carbs: acc.carbs + (Number(row.carbs) || 0),
        fat: acc.fat + (Number(row.fat) || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    let exerciseCalories = 0;
    try {
      const exResult = await query(
        `SELECT COALESCE(SUM(calories_burned), 0) as total FROM exercise_logs WHERE user_id = $1 AND log_date = $2`,
        [uid, date]
      );
      exerciseCalories = parseFloat((Number(exResult.rows[0]?.total) || 0).toFixed(1));
    } catch {}

    return NextResponse.json({
      logs: result.rows,
      summary: {
        calories: parseFloat(summary.calories.toFixed(1)),
        protein: parseFloat(summary.protein.toFixed(1)),
        carbs: parseFloat(summary.carbs.toFixed(1)),
        fat: parseFloat(summary.fat.toFixed(1)),
        count: result.rows.length,
        exercise_calories: exerciseCalories,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/** Convert amount + unit into grams for per-100g nutrition math. */
async function amountToGrams(
  uid: number,
  foodName: string,
  amount: number,
  unit: string,
  gramsPerServingHint?: number
): Promise<number> {
  const isWeightUnit = unit === "g" || unit === "ml";
  if (isWeightUnit) return Number(amount);

  // Prefer explicit grams_per_serving from client / custom food
  let gps = gramsPerServingHint && gramsPerServingHint > 0 ? gramsPerServingHint : 0;
  if (!gps) {
    try {
      const custom = await query(
        `SELECT grams_per_serving FROM user_custom_foods
         WHERE user_id = $1 AND food_name ILIKE $2 AND grams_per_serving IS NOT NULL AND grams_per_serving > 0
         LIMIT 1`,
        [uid, foodName]
      );
      if (custom.rows[0]?.grams_per_serving) {
        gps = Number(custom.rows[0].grams_per_serving);
      }
    } catch { /* column may not exist on older schemas */ }
  }
  // Default: 1 serving unit ≈ 100g (matches per-100g nutrition tables)
  if (!gps || gps <= 0) gps = 100;
  return Number(amount) * gps;
}

export async function POST(req: NextRequest) {
  const uid = getUserId(req);
  if (uid === 0) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  try {
    const body = await req.json();
    const { food_name, amount, meal_type, log_date, serving_unit, grams_per_serving,
            calories: calOverride, protein: pOverride, carbs: cOverride, fat: fOverride } = body;
    const date = log_date || new Date().toISOString().slice(0, 10);
    const unit = serving_unit || "g";

    if (!food_name || amount === undefined || amount === null || Number(amount) <= 0) {
      return NextResponse.json({ error: "food_name and positive amount required" }, { status: 400 });
    }

    let calories: number, protein: number, carbs: number, fat: number;

    if (calOverride !== undefined || pOverride !== undefined || cOverride !== undefined || fOverride !== undefined) {
      calories = calOverride !== undefined ? Number(calOverride) : 0;
      protein  = pOverride  !== undefined ? Number(pOverride)  : 0;
      carbs    = cOverride  !== undefined ? Number(cOverride)  : 0;
      fat      = fOverride  !== undefined ? Number(fOverride)  : 0;

      const result = await query(
        `INSERT INTO daily_food_logs (user_id, log_date, meal_type, food_name, amount, serving_unit, calories, protein, carbs, fat, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'quick_add')
         RETURNING *`,
        [uid, date, meal_type || "snack", food_name, amount, unit, calories, protein, carbs, fat]
      );
      return NextResponse.json({ entry: result.rows[0] });
    }

    const per100 = await query(
      `SELECT calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g
       FROM food_nutrition_cache WHERE food_name ILIKE $1 LIMIT 1`,
      [food_name]
    );

    let nutrition = per100.rows[0];
    if (!nutrition) {
      const custom = await query(
        `SELECT calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g
         FROM user_custom_foods WHERE user_id = $1 AND food_name ILIKE $2 LIMIT 1`,
        [uid, food_name]
      );
      nutrition = custom.rows[0];
    }

    if (!nutrition) {
      return NextResponse.json({ error: `Food "${food_name}" not found in database. Please search first.` }, { status: 404 });
    }

    // Non-weight units (碗/份/杯…) must convert to grams before /100 factor
    const grams = await amountToGrams(uid, food_name, Number(amount), unit, Number(grams_per_serving) || undefined);
    const factor = grams / 100;
    calories = parseFloat((Number(nutrition.calories_per_100g) * factor).toFixed(1));
    protein  = parseFloat((Number(nutrition.protein_per_100g) * factor).toFixed(1));
    carbs    = parseFloat((Number(nutrition.carbs_per_100g) * factor).toFixed(1));
    fat      = parseFloat((Number(nutrition.fat_per_100g) * factor).toFixed(1));

    const result = await query(
      `INSERT INTO daily_food_logs (user_id, log_date, meal_type, food_name, amount, serving_unit, calories, protein, carbs, fat, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'manual')
       RETURNING *`,
      [uid, date, meal_type || "snack", food_name, amount, unit, calories, protein, carbs, fat]
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
    await query(`DELETE FROM daily_food_logs WHERE id = $1 AND user_id = $2`, [id, uid]);
    return NextResponse.json({ ok: true });
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
    const { amount, meal_type, serving_unit, calories: calOverride, protein: pOverride, carbs: cOverride, fat: fOverride } = body;

    const existing = await query(
      `SELECT * FROM daily_food_logs WHERE id = $1 AND user_id = $2`,
      [id, uid]
    );
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const rec = existing.rows[0];
    const foodName = rec.food_name;
    const newWeight = amount ?? rec.amount;
    const newMeal = meal_type ?? rec.meal_type;
    const newUnit = serving_unit ?? rec.serving_unit ?? "g";

    const hasMacroOverride = calOverride !== undefined || pOverride !== undefined ||
                             cOverride !== undefined || fOverride !== undefined;

    let calories: number, protein: number, carbs: number, fat: number;

    if (hasMacroOverride) {
      calories = calOverride !== undefined ? Number(calOverride) : Number(rec.calories);
      protein  = pOverride   !== undefined ? Number(pOverride)   : Number(rec.protein);
      carbs    = cOverride   !== undefined ? Number(cOverride)   : Number(rec.carbs);
      fat      = fOverride   !== undefined ? Number(fOverride)   : Number(rec.fat);
    } else {
      const per100 = await query(
        `SELECT calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g
         FROM food_nutrition_cache WHERE food_name ILIKE $1 LIMIT 1`,
        [foodName]
      );
      let nutrition = per100.rows[0];
      if (!nutrition) {
        const custom = await query(
          `SELECT calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g
           FROM user_custom_foods WHERE user_id = $1 AND food_name ILIKE $2 LIMIT 1`,
          [uid, foodName]
        );
        nutrition = custom.rows[0];
      }
      if (!nutrition) {
        // No per-100g data (e.g. AI photo) — scale macros by amount ratio
        const oldAmt = Number(rec.amount) || 1;
        const ratio = Number(newWeight) / oldAmt;
        calories = parseFloat((Number(rec.calories) * ratio).toFixed(1));
        protein  = parseFloat((Number(rec.protein) * ratio).toFixed(1));
        carbs    = parseFloat((Number(rec.carbs) * ratio).toFixed(1));
        fat      = parseFloat((Number(rec.fat) * ratio).toFixed(1));
      } else {
        const grams = await amountToGrams(uid, foodName, Number(newWeight), newUnit);
        const factor = grams / 100;
        calories = parseFloat((Number(nutrition.calories_per_100g) * factor).toFixed(1));
        protein  = parseFloat((Number(nutrition.protein_per_100g)  * factor).toFixed(1));
        carbs    = parseFloat((Number(nutrition.carbs_per_100g)    * factor).toFixed(1));
        fat      = parseFloat((Number(nutrition.fat_per_100g)      * factor).toFixed(1));
      }
    }

    await query(
      `UPDATE daily_food_logs SET amount=$1, meal_type=$2, serving_unit=$3, calories=$4, protein=$5, carbs=$6, fat=$7
       WHERE id=$8 AND user_id=$9`,
      [newWeight, newMeal, newUnit, calories, protein, carbs, fat, id, uid]
    );

    return NextResponse.json({ ok: true, entry: { id, calories, protein, carbs, fat } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
