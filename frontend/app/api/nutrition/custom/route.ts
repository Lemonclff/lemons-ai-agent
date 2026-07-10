import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserId } from "@/lib/nutrition-auth";

/* ================================================================
   Custom Foods API — Full CRUD
   GET    /api/nutrition/custom              — list all custom foods
   POST   /api/nutrition/custom              — create custom food
   PUT    /api/nutrition/custom?id=1         — update custom food
   DELETE /api/nutrition/custom?id=1         — delete custom food
   ================================================================ */


export async function GET(req: NextRequest) {
  const uid = getUserId(req);
  try {
    const result = await query(
      `SELECT id, user_id, food_name,
              calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
              is_favorite, default_weight, default_serving_unit, sort_order,
              created_at
       FROM user_custom_foods WHERE user_id = $1 ORDER BY food_name`,
      [uid]
    );
    return NextResponse.json({ foods: result.rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const uid = getUserId(req);
  try {
    const body = await req.json();
    const {
      food_name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
      is_favorite, default_weight, default_serving_unit,
    } = body;

    if (!food_name) {
      return NextResponse.json({ error: "food_name is required" }, { status: 400 });
    }

    // Check if food already exists for this user
    const existing = await query(
      `SELECT id FROM user_custom_foods WHERE user_id = $1 AND food_name ILIKE $2`,
      [uid, food_name]
    );

    let result;
    if (existing.rows.length > 0) {
      result = await query(
        `UPDATE user_custom_foods SET
           calories_per_100g = $1, protein_per_100g = $2, carbs_per_100g = $3, fat_per_100g = $4,
           is_favorite = COALESCE($5, is_favorite),
           default_weight = COALESCE($6, default_weight),
           default_serving_unit = COALESCE($7, default_serving_unit)
         WHERE id = $8 AND user_id = $9
         RETURNING *`,
        [
          calories_per_100g ?? 0, protein_per_100g ?? 0, carbs_per_100g ?? 0, fat_per_100g ?? 0,
          is_favorite ?? null, default_weight ?? null, default_serving_unit ?? null,
          existing.rows[0].id, uid,
        ]
      );
    } else {
      result = await query(
        `INSERT INTO user_custom_foods (user_id, food_name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, is_favorite, default_weight, default_serving_unit)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [uid, food_name, calories_per_100g ?? 0, protein_per_100g ?? 0, carbs_per_100g ?? 0, fat_per_100g ?? 0,
         is_favorite ?? false, default_weight ?? 100, default_serving_unit ?? 'g']
      );
    }

    return NextResponse.json({ food: result.rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const uid = getUserId(req);
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const body = await req.json();
    const {
      food_name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
      is_favorite, default_weight, default_serving_unit,
    } = body;

    const result = await query(
      `UPDATE user_custom_foods SET
         food_name = COALESCE($1, food_name),
         calories_per_100g = COALESCE($2, calories_per_100g),
         protein_per_100g = COALESCE($3, protein_per_100g),
         carbs_per_100g = COALESCE($4, carbs_per_100g),
         fat_per_100g = COALESCE($5, fat_per_100g),
         is_favorite = COALESCE($6, is_favorite),
         default_weight = COALESCE($7, default_weight),
         default_serving_unit = COALESCE($8, default_serving_unit)
       WHERE id = $9 AND user_id = $10
       RETURNING *`,
      [
        food_name ?? null, calories_per_100g ?? null, protein_per_100g ?? null,
        carbs_per_100g ?? null, fat_per_100g ?? null,
        is_favorite ?? null, default_weight ?? null, default_serving_unit ?? null,
        id, uid,
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ food: result.rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const uid = getUserId(req);
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const result = await query(
      `DELETE FROM user_custom_foods WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, uid]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
