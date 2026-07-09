import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

/* ================================================================
   Confirm AI Analysis API
   POST /api/nutrition/confirm-analysis
   - Accepts confirmed dishes from AI photo analysis
   - Looks up nutrition data for each dish
   - Inserts into daily_food_logs
   - Unknown foods inserted with zero nutrition
   ================================================================ */

const UID = 1;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dishes, meal_type, log_date } = body;

    if (!dishes || !Array.isArray(dishes) || dishes.length === 0) {
      return NextResponse.json({ error: "dishes array required" }, { status: 400 });
    }

    const date = log_date || new Date().toISOString().slice(0, 10);
    const added: Array<{ name: string; status: string; weight: number }> = [];

    for (const dish of dishes) {
      const name: string = dish.name;
      const weight: number = dish.estimated_weight_grams || 100;

      // Look up nutrition from cache or custom foods
      const per100 = await query(
        `SELECT calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g
         FROM food_nutrition_cache WHERE food_name ILIKE $1 LIMIT 1`,
        [name]
      );

      let nutrition = per100.rows[0];
      if (!nutrition) {
        const custom = await query(
          `SELECT calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g
           FROM user_custom_foods WHERE user_id = $1 AND food_name ILIKE $2 LIMIT 1`,
          [UID, name]
        );
        nutrition = custom.rows[0];
      }

      if (!nutrition) {
        // Use AI estimate if provided
        if (dish.ai_calories !== undefined) {
          await query(
            `INSERT INTO daily_food_logs (user_id, log_date, meal_type, food_name, amount, calories, protein, carbs, fat, source)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ai_photo')`,
            [UID, date, meal_type || "lunch", name, weight,
             dish.ai_calories || 0, dish.ai_protein || 0, dish.ai_carbs || 0, dish.ai_fat || 0]
          );
          added.push({ name, status: "added_ai", weight });
          continue;
        }
        // Unknown food — insert with zero nutrition
        await query(
          `INSERT INTO daily_food_logs (user_id, log_date, meal_type, food_name, amount, calories, protein, carbs, fat, source)
           VALUES ($1,$2,$3,$4,$5,0,0,0,0,'ai_unknown')`,
          [UID, date, meal_type || "lunch", name, weight]
        );
        added.push({ name, status: "unknown", weight });
        continue;
      }

      const factor = Number(weight) / 100;
      const calories = parseFloat((Number(nutrition.calories_per_100g) * factor).toFixed(1));
      const protein = parseFloat((Number(nutrition.protein_per_100g) * factor).toFixed(1));
      const carbs = parseFloat((Number(nutrition.carbs_per_100g) * factor).toFixed(1));
      const fat = parseFloat((Number(nutrition.fat_per_100g) * factor).toFixed(1));

      await query(
        `INSERT INTO daily_food_logs (user_id, log_date, meal_type, food_name, amount, calories, protein, carbs, fat, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ai_photo')`,
        [UID, date, meal_type || "lunch", name, weight, calories, protein, carbs, fat]
      );
      added.push({ name, status: "added", weight });
    }

    return NextResponse.json({ added });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
