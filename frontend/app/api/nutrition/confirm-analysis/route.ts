     1|import { NextRequest, NextResponse } from "next/server";
     2|import { query } from "@/lib/db";
import { getUserId } from "@/lib/nutrition-auth";
     3|
     4|const uid = 1;
     5|
     6|export async function POST(req: NextRequest) {
  const uid = getUserId(req);
     7|  try {
     8|    const body = await req.json();
     9|    const { dishes, meal_type, log_date } = body;
    10|    const date = log_date || new Date().toISOString().slice(0, 10);
    11|    const added: any[] = [];
    12|
    13|    for (const dish of dishes) {
    14|      const name: string = dish.name;
    15|      const unit: string = dish.unit || dish.serving_unit || 'g';
    16|      const amount: number = dish.amount ?? dish.grams_per_serving ?? dish.estimated_weight_grams ?? 100;
    17|      const gramsPerServing: number = dish.grams_per_serving || dish.estimated_weight_grams || 100;
    18|      const isWeightUnit = unit === 'g' || unit === 'ml';
    19|      const calcGrams = isWeightUnit ? amount : amount * gramsPerServing;
    20|
    21|      // If AI provided nutrition, use it directly — skip DB lookup
    22|      if (dish.ai_calories !== undefined) {
    23|        await query(
    24|          `INSERT INTO daily_food_logs (user_id, log_date, meal_type, food_name, amount, serving_unit, calories, protein, carbs, fat, source)
    25|           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'ai_photo')`,
    26|          [uid, date, meal_type || "lunch", name, amount, unit,
    27|           dish.ai_calories || 0, dish.ai_protein || 0, dish.ai_carbs || 0, dish.ai_fat || 0]
    28|        );
    29|        added.push({ name, status: "added_ai", amount, unit });
    30|        continue;
    31|      }
    32|
    33|      // No AI nutrition — look up from cache or custom foods
    34|      const per100 = await query(
    35|        `SELECT calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g
    36|         FROM food_nutrition_cache WHERE food_name ILIKE $1 LIMIT 1`,
    37|        [name]
    38|      );
    39|
    40|      let nutrition = per100.rows[0];
    41|      if (!nutrition) {
    42|        const custom = await query(
    43|          `SELECT calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g
    44|           FROM user_custom_foods WHERE user_id = $1 AND food_name ILIKE $2 LIMIT 1`,
    45|          [uid, name]
    46|        );
    47|        nutrition = custom.rows[0];
    48|      }
    49|
    50|      if (!nutrition) {
    51|        // Unknown food — insert with zero nutrition
    52|        await query(
    53|          `INSERT INTO daily_food_logs (user_id, log_date, meal_type, food_name, amount, serving_unit, calories, protein, carbs, fat, source)
    54|           VALUES ($1,$2,$3,$4,$5,$6,0,0,0,0,'ai_unknown')`,
    55|          [uid, date, meal_type || "lunch", name, amount, unit]
    56|        );
    57|        added.push({ name, status: "unknown", amount, unit });
    58|        continue;
    59|      }
    60|
    61|      const factor = calcGrams / 100;
    62|      const calories = parseFloat((Number(nutrition.calories_per_100g) * factor).toFixed(1));
    63|      const protein = parseFloat((Number(nutrition.protein_per_100g) * factor).toFixed(1));
    64|      const carbs = parseFloat((Number(nutrition.carbs_per_100g) * factor).toFixed(1));
    65|      const fat = parseFloat((Number(nutrition.fat_per_100g) * factor).toFixed(1));
    66|
    67|      await query(
    68|        `INSERT INTO daily_food_logs (user_id, log_date, meal_type, food_name, amount, serving_unit, calories, protein, carbs, fat, source)
    69|         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'ai_photo')`,
    70|        [uid, date, meal_type || "lunch", name, amount, unit, calories, protein, carbs, fat]
    71|      );
    72|      added.push({ name, status: "added", amount, unit });
    73|    }
    74|
    75|    return NextResponse.json({ added });
    76|  } catch (e) {
    77|    return NextResponse.json({ error: String(e) }, { status: 500 });
    78|  }
    79|}
    80|