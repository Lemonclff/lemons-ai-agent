import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

/* ================================================================
   Custom Foods API
   POST /api/nutrition/custom
   Body: { food_name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g }
   ================================================================ */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { food_name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g } = body;

    if (!food_name) {
      return NextResponse.json({ error: "food_name is required" }, { status: 400 });
    }

    // Default user_id=1 for now (auth not enforced yet; see plan)
    const result = await query(
      `INSERT INTO user_custom_foods (user_id, food_name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [1, food_name, calories_per_100g ?? 0, protein_per_100g ?? 0, carbs_per_100g ?? 0, fat_per_100g ?? 0]
    );

    return NextResponse.json({ food: result.rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
