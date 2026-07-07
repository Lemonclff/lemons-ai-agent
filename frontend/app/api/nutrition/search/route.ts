import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

/* ================================================================
   Nutrition Search API
   GET /api/nutrition/search?q=chicken+breast
   - Checks local cache → Open Food Facts → USDA (optional)
   ================================================================ */

function ensureTables() {
  return query(`
    CREATE TABLE IF NOT EXISTS food_nutrition_cache (
        id                SERIAL PRIMARY KEY,
        food_name         VARCHAR(200) NOT NULL,
        display_name      VARCHAR(200),
        calories_per_100g DECIMAL(10,4),
        protein_per_100g  DECIMAL(10,4),
        carbs_per_100g    DECIMAL(10,4),
        fat_per_100g      DECIMAL(10,4),
        fiber_per_100g    DECIMAL(10,4),
        source            VARCHAR(20) NOT NULL,
        source_id         VARCHAR(100),
        created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(food_name, source)
    );

    CREATE TABLE IF NOT EXISTS user_custom_foods (
        id                SERIAL PRIMARY KEY,
        user_id           INTEGER NOT NULL REFERENCES users(id),
        food_name         VARCHAR(200) NOT NULL,
        calories_per_100g DECIMAL(10,4),
        protein_per_100g  DECIMAL(10,4),
        carbs_per_100g    DECIMAL(10,4),
        fat_per_100g      DECIMAL(10,4),
        created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS daily_food_logs (
        id            SERIAL PRIMARY KEY,
        user_id       INTEGER NOT NULL REFERENCES users(id),
        log_date      DATE NOT NULL,
        meal_type     VARCHAR(20) DEFAULT 'snack',
        food_name     VARCHAR(200) NOT NULL,
        weight_grams  DECIMAL(10,4),
        calories      DECIMAL(10,4),
        protein       DECIMAL(10,4),
        carbs         DECIMAL(10,4),
        fat           DECIMAL(10,4),
        source        VARCHAR(20) DEFAULT 'manual',
        created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_dfl_user_date ON daily_food_logs (user_id, log_date DESC);
  `);
}

/* ---- Types ---- */

interface FoodResult {
  food_name: string;
  display_name: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g: number;
  source: string;
  source_id: string | null;
}

/* ---- Open Food Facts ---- */

async function searchOFF(q: string): Promise<FoodResult[]> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&fields=product_name,nutriments,code&page_size=8&json=1`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data = await resp.json();
    const products = (data.products ?? []) as Array<{
      product_name?: string;
      nutriments?: Record<string, number>;
      code?: string;
    }>;
    return products
      .filter((p) => p.product_name && p.nutriments)
      .map((p) => ({
        food_name: p.product_name!,
        display_name: p.product_name!,
        calories_per_100g: p.nutriments?.["energy-kcal_100g"] ?? 0,
        protein_per_100g: p.nutriments?.proteins_100g ?? 0,
        carbs_per_100g: p.nutriments?.carbohydrates_100g ?? 0,
        fat_per_100g: p.nutriments?.fat_100g ?? 0,
        fiber_per_100g: p.nutriments?.fiber_100g ?? 0,
        source: "open_food_facts" as const,
        source_id: p.code || null,
      }));
  } catch {
    return [];
  }
}

/* ---- USDA ---- */

async function searchUSDA(q: string): Promise<FoodResult[]> {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) return [];
  try {
    const resp = await fetch("https://api.nal.usda.gov/fdc/v1/foods/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q, pageSize: 8, api_key: apiKey }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const foods = (data.foods ?? []) as Array<{
      fdcId: number;
      description: string;
      foodNutrients?: Array<{ nutrientName: string; value: number }>;
    }>;
    return foods.map((f) => {
      const getNutrient = (name: string) =>
        f.foodNutrients?.find((n) => n.nutrientName?.includes(name))?.value ?? 0;
      return {
        food_name: f.description,
        display_name: f.description,
        calories_per_100g: getNutrient("Energy") || 0,
        protein_per_100g: getNutrient("Protein") || 0,
        carbs_per_100g: getNutrient("Carbohydrate") || 0,
        fat_per_100g: getNutrient("Total lipid") || 0,
        fiber_per_100g: getNutrient("Fiber") || 0,
        source: "usda" as const,
        source_id: String(f.fdcId),
      };
    });
  } catch {
    return [];
  }
}

/* ---- Cache ---- */

async function upsertCache(items: FoodResult[]) {
  for (const item of items) {
    await query(
      `INSERT INTO food_nutrition_cache (food_name, display_name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, source, source_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (food_name, source) DO UPDATE SET
         calories_per_100g = EXCLUDED.calories_per_100g,
         protein_per_100g = EXCLUDED.protein_per_100g,
         carbs_per_100g = EXCLUDED.carbs_per_100g,
         fat_per_100g = EXCLUDED.fat_per_100g,
         fiber_per_100g = EXCLUDED.fiber_per_100g`,
      [item.food_name, item.display_name, item.calories_per_100g, item.protein_per_100g, item.carbs_per_100g, item.fat_per_100g, item.fiber_per_100g, item.source, item.source_id]
    );
  }
}

/* ---- Route ---- */

export async function GET(req: NextRequest) {
  await ensureTables();

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 1) {
    return NextResponse.json({ results: [] });
  }

  // 1. Check cache (also checks custom foods)
  const cacheResult = await query(
    `SELECT * FROM food_nutrition_cache WHERE food_name ILIKE $1 ORDER BY source LIMIT 15`,
    [`%${q}%`]
  );

  if (cacheResult.rows.length > 0) {
    return NextResponse.json({ results: cacheResult.rows, source: "cache" });
  }

  // 2. External APIs (parallel)
  const [offResults, usdaResults] = await Promise.all([
    searchOFF(q),
    searchUSDA(q),
  ]);

  // 3. Merge: OFF first, USDA second
  const merged = [...offResults, ...usdaResults];

  // 4. Cache results
  if (merged.length > 0) {
    await upsertCache(merged);
  }

  return NextResponse.json({ results: merged, source: "api" });
}
