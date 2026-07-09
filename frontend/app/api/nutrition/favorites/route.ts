import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyToken } from "@/lib/auth";

/* ================================================================
   Quick Add Favorites API
   GET    /api/nutrition/favorites                — curated + auto-suggested
   POST   /api/nutrition/favorites                — add a favorite
   DELETE /api/nutrition/favorites?id=N           — remove a favorite

   Supports both "in" (Calories In / food) and "out" (Calories Out / exercise).
   ================================================================ */

function getUserId(req: NextRequest): number {
  try {
    const token = req.cookies.get("token")?.value;
    if (token) {
      const payload = verifyToken(token);
      if (payload) return payload.userId;
    }
  } catch {}
  return 1;
}

export async function GET(req: NextRequest) {
  const uid = getUserId(req);

  try {
    // Curated favorites
    const curated = await query(
      `SELECT * FROM user_quick_favorites
       WHERE user_id = $1
       ORDER BY favorite_type, sort_order, created_at DESC`,
      [uid]
    );

    const curatedIn = curated.rows.filter((r: any) => r.favorite_type === "in");
    const curatedOut = curated.rows.filter((r: any) => r.favorite_type === "out");

    // Auto-suggested Calories In (from frequently logged foods, excluding curated)
    const curatedInNames = curatedIn.map((r: any) => r.name);
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
           AND food_name NOT IN (SELECT name FROM user_quick_favorites WHERE user_id = $1 AND favorite_type = 'in')
         GROUP BY food_name
         ORDER BY MAX(log_date) DESC, log_count DESC
         LIMIT 6`,
        [uid]
      );
      suggestedIn = inResult.rows;
    } catch {}

    // Auto-suggested Calories Out (from frequently logged exercises, excluding curated)
    const curatedOutNames = curatedOut.map((r: any) => r.name);
    let suggestedOut: any[] = [];
    try {
      const outResult = await query(
        `SELECT exercise_name as name,
                COUNT(*) as log_count,
                ROUND(AVG(duration_min)) as default_duration,
                ROUND(AVG(calories_burned)) as avg_calories
         FROM exercise_logs
         WHERE user_id = $1
           AND exercise_name NOT IN (SELECT name FROM user_quick_favorites WHERE user_id = $1 AND favorite_type = 'out')
         GROUP BY exercise_name
         ORDER BY MAX(log_date) DESC, log_count DESC
         LIMIT 6`,
        [uid]
      );
      suggestedOut = outResult.rows;
    } catch {}

    return NextResponse.json({
      favorites: {
        in: curatedIn,
        out: curatedOut,
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
  try {
    const body = await req.json();
    const { type, name, calories, default_weight, default_duration, serving_unit } = body;

    if (!type || !name || !["in", "out"].includes(type)) {
      return NextResponse.json(
        { error: "type ('in' or 'out') and name required" },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO user_quick_favorites (user_id, favorite_type, name, calories, default_weight, default_duration, serving_unit)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, favorite_type, name)
       DO UPDATE SET calories = EXCLUDED.calories, default_weight = EXCLUDED.default_weight,
                     default_duration = EXCLUDED.default_duration, serving_unit = EXCLUDED.serving_unit,
                     sort_order = EXCLUDED.sort_order
       RETURNING *`,
      [
        uid, type, name, calories ?? 0,
        default_weight ?? 100, default_duration ?? 30,
        serving_unit || 'g',
      ]
    );

    return NextResponse.json({ favorite: result.rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const uid = getUserId(req);
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  try {
    await query(
      `DELETE FROM user_quick_favorites WHERE id = $1 AND user_id = $2`,
      [id, uid]
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
