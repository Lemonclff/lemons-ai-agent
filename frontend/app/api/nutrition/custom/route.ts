     1|import { NextRequest, NextResponse } from "next/server";
     2|import { query } from "@/lib/db";
import { getUserId } from "@/lib/nutrition-auth";
     3|
     4|/* ================================================================
     5|   Custom Foods API — Full CRUD
     6|   GET    /api/nutrition/custom              — list all custom foods
     7|   POST   /api/nutrition/custom              — create custom food
     8|   PUT    /api/nutrition/custom?id=1         — update custom food
     9|   DELETE /api/nutrition/custom?id=1         — delete custom food
    10|   ================================================================ */
    11|
    12|const uid = 1;
    13|
    14|export async function GET(req: NextRequest) {
  const uid = getUserId(req);
    15|  try {
    16|    const result = await query(
    17|      `SELECT id, user_id, food_name,
    18|              calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
    19|              is_favorite, default_weight, default_serving_unit, sort_order,
    20|              created_at
    21|       FROM user_custom_foods WHERE user_id = $1 ORDER BY food_name`,
    22|      [uid]
    23|    );
    24|    return NextResponse.json({ foods: result.rows });
    25|  } catch (e) {
    26|    return NextResponse.json({ error: String(e) }, { status: 500 });
    27|  }
    28|}
    29|
    30|export async function POST(req: NextRequest) {
  const uid = getUserId(req);
    31|  try {
    32|    const body = await req.json();
    33|    const {
    34|      food_name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
    35|      is_favorite, default_weight, default_serving_unit,
    36|    } = body;
    37|
    38|    if (!food_name) {
    39|      return NextResponse.json({ error: "food_name is required" }, { status: 400 });
    40|    }
    41|
    42|    // Check if food already exists for this user
    43|    const existing = await query(
    44|      `SELECT id FROM user_custom_foods WHERE user_id = $1 AND food_name ILIKE $2`,
    45|      [uid, food_name]
    46|    );
    47|
    48|    let result;
    49|    if (existing.rows.length > 0) {
    50|      result = await query(
    51|        `UPDATE user_custom_foods SET
    52|           calories_per_100g = $1, protein_per_100g = $2, carbs_per_100g = $3, fat_per_100g = $4,
    53|           is_favorite = COALESCE($5, is_favorite),
    54|           default_weight = COALESCE($6, default_weight),
    55|           default_serving_unit = COALESCE($7, default_serving_unit)
    56|         WHERE id = $8 AND user_id = $9
    57|         RETURNING *`,
    58|        [
    59|          calories_per_100g ?? 0, protein_per_100g ?? 0, carbs_per_100g ?? 0, fat_per_100g ?? 0,
    60|          is_favorite ?? null, default_weight ?? null, default_serving_unit ?? null,
    61|          existing.rows[0].id, uid,
    62|        ]
    63|      );
    64|    } else {
    65|      result = await query(
    66|        `INSERT INTO user_custom_foods (user_id, food_name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, is_favorite, default_weight, default_serving_unit)
    67|         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    68|         RETURNING *`,
    69|        [uid, food_name, calories_per_100g ?? 0, protein_per_100g ?? 0, carbs_per_100g ?? 0, fat_per_100g ?? 0,
    70|         is_favorite ?? false, default_weight ?? 100, default_serving_unit ?? 'g']
    71|      );
    72|    }
    73|
    74|    return NextResponse.json({ food: result.rows[0] });
    75|  } catch (e) {
    76|    return NextResponse.json({ error: String(e) }, { status: 500 });
    77|  }
    78|}
    79|
    80|export async function PUT(req: NextRequest) {
  const uid = getUserId(req);
    81|  try {
    82|    const id = req.nextUrl.searchParams.get("id");
    83|    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    84|
    85|    const body = await req.json();
    86|    const {
    87|      food_name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
    88|      is_favorite, default_weight, default_serving_unit,
    89|    } = body;
    90|
    91|    const result = await query(
    92|      `UPDATE user_custom_foods SET
    93|         food_name = COALESCE($1, food_name),
    94|         calories_per_100g = COALESCE($2, calories_per_100g),
    95|         protein_per_100g = COALESCE($3, protein_per_100g),
    96|         carbs_per_100g = COALESCE($4, carbs_per_100g),
    97|         fat_per_100g = COALESCE($5, fat_per_100g),
    98|         is_favorite = COALESCE($6, is_favorite),
    99|         default_weight = COALESCE($7, default_weight),
   100|         default_serving_unit = COALESCE($8, default_serving_unit)
   101|       WHERE id = $9 AND user_id = $10
   102|       RETURNING *`,
   103|      [
   104|        food_name ?? null, calories_per_100g ?? null, protein_per_100g ?? null,
   105|        carbs_per_100g ?? null, fat_per_100g ?? null,
   106|        is_favorite ?? null, default_weight ?? null, default_serving_unit ?? null,
   107|        id, uid,
   108|      ]
   109|    );
   110|
   111|    if (result.rows.length === 0) {
   112|      return NextResponse.json({ error: "Not found" }, { status: 404 });
   113|    }
   114|    return NextResponse.json({ food: result.rows[0] });
   115|  } catch (e) {
   116|    return NextResponse.json({ error: String(e) }, { status: 500 });
   117|  }
   118|}
   119|
   120|export async function DELETE(req: NextRequest) {
  const uid = getUserId(req);
   121|  try {
   122|    const id = req.nextUrl.searchParams.get("id");
   123|    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
   124|
   125|    const result = await query(
   126|      `DELETE FROM user_custom_foods WHERE id = $1 AND user_id = $2 RETURNING id`,
   127|      [id, uid]
   128|    );
   129|
   130|    if (result.rows.length === 0) {
   131|      return NextResponse.json({ error: "Not found" }, { status: 404 });
   132|    }
   133|    return NextResponse.json({ deleted: true });
   134|  } catch (e) {
   135|    return NextResponse.json({ error: String(e) }, { status: 500 });
   136|  }
   137|}
   138|