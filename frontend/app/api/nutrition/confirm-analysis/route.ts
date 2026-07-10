import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserId } from "@/lib/nutrition-auth";


export async function POST(req: NextRequest) {
  const uid = getUserId(req);
  try {
    const body = await req.json();
    const { dishes, meal_type, log_date } = body;
    const date = log_date || new Date().toISOString().slice(0, 10);
    const added: any[] = [];

    for (const dish of dishes) {
      const name: string = dish.name;
      const unit: string = dish.unit || dish.serving_unit || 'g';
      const amount: number = dish.amount ?? dish.grams_per_serving ?? dish.estimated_weight_grams ?? 100;
      const gramsPerServing: number = dish.grams_per_serving || dish.estimated_weight_grams || 100;
      const isWeightUnit = unit === 'g' || unit === 'ml';
      const calcGrams = isWeightUnit ? amount : amount * gramsPerServing;

      // If AI provided nutrition, use it directly — skip DB lookup
      if (dish.ai_calories !== undefined) {
        await query(
          `INSERT INTO daily_food_logs (user_id, log_date, meal_type, food_name, amount, serving_unit, calories, protein, carbs, fat, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'ai_photo')`,
          [uid, date, meal_type || "lunch", name, amount, unit,
           dish.ai_calories || 0, dish.ai_protein || 0, dish.ai_carbs || 0, dish.ai_fat || 0]
        );
        added.push({ name, status: "added_ai", amount, unit });
        continue;
      }

      // No AI nutrition — look up from cache or custom foods
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
          [uid, name]
        );
        nutrition = custom.rows[0];
      }

      if (!nutrition) {
        // Unknown food — insert with zero nutrition
        await query(
          `INSERT INTO daily_food_logs (user_id, log_date, meal_type, food_name, amount, serving_unit, calories, protein, carbs, fat, source)
           VALUES ($1,$2,$3,$4,$5,$6,0,0,0,0,'ai_unknown')`,
          [uid, date, meal_type || "lunch", name, amount, unit]
        );
        added.push({ name, status: "unknown", amount, unit });
        continue;
      }

      const factor = calcGrams / 100;
      const calories = parseFloat((Number(nutrition.calories_per_100g) * factor).toFixed(1));
      const protein = parseFloat((Number(nutrition.protein_per_100g) * factor).toFixed(1));
      const carbs = parseFloat((Number(nutrition.carbs_per_100g) * factor).toFixed(1));
      const fat = parseFloat((Number(nutrition.fat_per_100g) * factor).toFixed(1));

      await query(
        `INSERT INTO daily_food_logs (user_id, log_date, meal_type, food_name, amount, serving_unit, calories, protein, carbs, fat, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'ai_photo')`,
        [uid, date, meal_type || "lunch", name, amount, unit, calories, protein, carbs, fat]
      );
      added.push({ name, status: "added", amount, unit });
    }

    return NextResponse.json({ added });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
