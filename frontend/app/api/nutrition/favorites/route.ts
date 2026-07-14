import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserId } from "@/lib/nutrition-auth";

/* ================================================================
   Quick Add Favorites API (post-migration)
   
   Food favorites    → user_custom_foods (is_favorite = true)
   Exercise favorites → user_exercise_favorites

   GET    /api/nutrition/favorites       — curated + auto-suggested
   POST   /api/nutrition/favorites       — add/update a favorite
   DELETE /api/nutrition/favorites?id=N&type=in|out  — remove
   ================================================================ */

export async function GET(req: NextRequest) {
  const uid = getUserId(req);

  try {
    // ── Curated food favorites (from user_custom_foods) ──
    const foodFavs = await query(
      `SELECT id, food_name as name, calories_per_100g,
              default_weight, default_serving_unit, grams_per_serving,
              serving_calories, serving_protein, serving_carbs, serving_fat,
              sort_order,
              NULL::integer as default_duration
       FROM user_custom_foods
       WHERE user_id = $1 AND is_favorite = true
       ORDER BY sort_order, created_at DESC`,
      [uid]
    );

    // ── Curated exercise favorites ──
    const exFavs = await query(
      `SELECT id, name, calories, default_duration, sort_order
       FROM user_exercise_favorites
       WHERE user_id = $1
       ORDER BY sort_order, created_at DESC`,
      [uid]
    );

    // ── Auto-suggested Calories In (from frequently logged, excluding curated) ──
    let suggestedIn: any[] = [];
    try {
      const inResult = await query(
        `SELECT food_name as name,
                COUNT(*) as log_count,
                ROUND(AVG(amount)) as default_weight,
                ROUND(AVG(calories)) as avg_calories,
                MODE() WITHIN GROUP (ORDER BY COALESCE(serving_unit, 'g')) as default_unit
         FROM daily_food_logs
         WHERE user_id = $1
           AND food_name NOT IN (SELECT food_name FROM user_custom_foods WHERE user_id = $1 AND is_favorite = true)
         GROUP BY food_name
         ORDER BY MAX(log_date) DESC, log_count DESC
         LIMIT 6`,
        [uid]
      );
      suggestedIn = inResult.rows;
    } catch {}

    // ── Auto-suggested Calories Out ──
    let suggestedOut: any[] = [];
    try {
      const outResult = await query(
        `SELECT exercise_name as name,
                COUNT(*) as log_count,
                ROUND(AVG(duration_min)) as default_duration,
                ROUND(AVG(calories_burned)) as avg_calories
         FROM exercise_logs
         WHERE user_id = $1
           AND exercise_name NOT IN (SELECT name FROM user_exercise_favorites WHERE user_id = $1)
         GROUP BY exercise_name
         ORDER BY MAX(log_date) DESC, log_count DESC
         LIMIT 6`,
        [uid]
      );
      suggestedOut = outResult.rows;
    } catch {}

    return NextResponse.json({
      favorites: {
        in: foodFavs.rows,
        out: exFavs.rows,
      },
      suggested: {
        in: suggestedIn,
        out: suggestedOut,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const uid = getUserId(req);
  if (uid === 0) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  try {
    const body = await req.json();
    const { type, name, calories, default_weight, default_duration, serving_unit } = body;

    if (!type || !name || !["in", "out"].includes(type)) {
      return NextResponse.json(
        { error: "type ('in' or 'out') and name required" },
        { status: 400 }
      );
    }

    if (type === "in") {
      // ── Food favorite: upsert into user_custom_foods with is_favorite=true ──
      // Try to get per-100g nutrition from cache
      let calPer100 = 0, protPer100 = 0, carbPer100 = 0, fatPer100 = 0, gramsPerServing: number | null = null;
      let servingCal: number | null = null, servingP: number | null = null, servingC: number | null = null, servingF: number | null = null;

      try {
        const cached = await query(
          `SELECT * FROM food_nutrition_cache WHERE food_name ILIKE $1 LIMIT 1`,
          [name]
        );
        if (cached.rows[0]) {
          calPer100 = Number(cached.rows[0].calories_per_100g) || 0;
          protPer100 = Number(cached.rows[0].protein_per_100g) || 0;
          carbPer100 = Number(cached.rows[0].carbs_per_100g) || 0;
          fatPer100 = Number(cached.rows[0].fat_per_100g) || 0;
          if (calories && calories > 0 && calPer100 > 0) {
            gramsPerServing = Math.round((calories / calPer100) * 100);
          }
        }

        // Also grab actual serving nutrition from the most recent log entry
        const logEntry = await query(
          `SELECT calories, protein, carbs, fat, amount, serving_unit
           FROM daily_food_logs
           WHERE user_id = $1 AND food_name ILIKE $2 AND calories > 0
           ORDER BY log_date DESC, created_at DESC LIMIT 1`,
          [uid, name]
        );
        if (logEntry.rows[0]) {
          const le = logEntry.rows[0];
          const unit = (le.serving_unit || 'g').toLowerCase();
          let amt = Number(le.amount) || 1;
          // Normalize to per-serving
          if (unit !== 'g' && unit !== 'ml' && amt > 1) {
            servingCal = Math.round(Number(le.calories) / amt);
            servingP = parseFloat((Number(le.protein || 0) / amt).toFixed(1));
            servingC = parseFloat((Number(le.carbs || 0) / amt).toFixed(1));
            servingF = parseFloat((Number(le.fat || 0) / amt).toFixed(1));
          } else {
            servingCal = Number(le.calories);
            servingP = Number(le.protein) || 0;
            servingC = Number(le.carbs) || 0;
            servingF = Number(le.fat) || 0;
          }
        }
      } catch {}

      const weight = default_weight ?? 100;
      const unit = serving_unit || 'g';

      const result = await query(
        `INSERT INTO user_custom_foods (user_id, food_name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, is_favorite, default_weight, default_serving_unit, grams_per_serving, serving_calories, serving_protein, serving_carbs, serving_fat, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7,$8,$9,$10,$11,$12,$13,0)
         ON CONFLICT (user_id, food_name)
         DO UPDATE SET is_favorite = TRUE,
                       default_weight = EXCLUDED.default_weight,
                       default_serving_unit = EXCLUDED.default_serving_unit,
                       grams_per_serving = COALESCE(EXCLUDED.grams_per_serving, user_custom_foods.grams_per_serving),
                       serving_calories = COALESCE(EXCLUDED.serving_calories, user_custom_foods.serving_calories),
                       serving_protein = COALESCE(EXCLUDED.serving_protein, user_custom_foods.serving_protein),
                       serving_carbs = COALESCE(EXCLUDED.serving_carbs, user_custom_foods.serving_carbs),
                       serving_fat = COALESCE(EXCLUDED.serving_fat, user_custom_foods.serving_fat)
         RETURNING id, food_name as name, default_weight, default_serving_unit, grams_per_serving, serving_calories, serving_protein, serving_carbs, serving_fat`,
        [uid, name, calPer100, protPer100, carbPer100, fatPer100, weight, unit, gramsPerServing, servingCal, servingP, servingC, servingF]
      );

      return NextResponse.json({ favorite: result.rows[0] });
    } else {
      // ── Exercise favorite ──
      const result = await query(
        `INSERT INTO user_exercise_favorites (user_id, name, calories, default_duration, sort_order)
         VALUES ($1,$2,$3,$4,0)
         ON CONFLICT (user_id, name)
         DO UPDATE SET calories = EXCLUDED.calories, default_duration = EXCLUDED.default_duration
         RETURNING *`,
        [uid, name, calories ?? 0, default_duration ?? 30]
      );
      return NextResponse.json({ favorite: result.rows[0] });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const uid = getUserId(req);
  if (uid === 0) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  const type = req.nextUrl.searchParams.get("type") || "in"; // default to food

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  try {
    if (type === "in") {
      // Un-favorite the custom food (keep the food, just remove from quick-add)
      await query(
        `UPDATE user_custom_foods SET is_favorite = false WHERE id = $1 AND user_id = $2`,
        [id, uid]
      );
    } else {
      await query(
        `DELETE FROM user_exercise_favorites WHERE id = $1 AND user_id = $2`,
        [id, uid]
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
