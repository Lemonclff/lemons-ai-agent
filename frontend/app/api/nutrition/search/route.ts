import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

/* ================================================================
   Nutrition Search API
   GET /api/nutrition/search?q=chicken
   - Local curated DB (Taiwanese foods) → Custom foods → Cache → OFF → USDA
   ================================================================ */

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

/* ---- Seed data: curated Taiwanese/Asian foods ---- */

const SEED_FOODS: Array<[string, string, number, number, number, number]> = [
  // Staples
  ["白飯", "White rice", 183, 2.7, 39.8, 0.4],
  ["糙米飯", "Brown rice", 180, 3.8, 36.7, 1.5],
  ["五穀飯", "Multigrain rice", 175, 4.0, 35.0, 1.2],
  ["稀飯", "Congee", 53, 1.1, 11.5, 0.2],
  ["地瓜粥", "Sweet potato congee", 70, 1.3, 15.0, 0.3],
  ["白饅頭", "Steamed bun", 223, 7.0, 44.0, 1.1],
  ["吐司", "Toast bread", 280, 8.5, 49.0, 4.5],
  ["全麥吐司", "Whole wheat toast", 250, 10.0, 43.0, 4.0],
  ["白麵條(熟)", "White noodles cooked", 138, 4.5, 28.0, 0.5],
  ["義大利麵(熟)", "Pasta cooked", 131, 5.0, 25.0, 1.1],
  ["陽春麵", "Plain noodles", 140, 4.5, 28.0, 0.5],
  ["冬粉(熟)", "Glass noodles cooked", 80, 0.2, 18.0, 0.1],

  // Proteins - Meat
  ["雞胸肉", "Chicken breast", 165, 31.0, 0, 3.6],
  ["雞腿肉(去皮)", "Chicken thigh skinless", 175, 26.0, 0, 7.5],
  ["雞腿(含皮)", "Chicken thigh with skin", 230, 24.0, 0, 15.0],
  ["滷雞腿", "Braised chicken leg", 210, 25.0, 2.0, 11.0],
  ["雞排(炸)", "Fried chicken cutlet", 310, 22.0, 15.0, 18.0],
  ["雞翅", "Chicken wings", 250, 22.0, 3.0, 16.0],
  ["豬瘦肉", "Lean pork", 180, 28.0, 0, 7.0],
  ["豬五花肉", "Pork belly", 350, 16.0, 0, 31.0],
  ["豬腳", "Pork trotter", 290, 22.0, 1.0, 22.0],
  ["排骨(炸)", "Fried pork chop", 290, 20.0, 10.0, 18.0],
  ["滷排骨", "Braised pork chop", 230, 22.0, 3.0, 14.0],
  ["滷肉(控肉)", "Braised pork belly", 320, 18.0, 2.0, 26.0],
  ["滷肉燥", "Minced braised pork", 300, 16.0, 4.0, 24.0],
  ["香腸", "Sausage", 320, 15.0, 8.0, 25.0],
  ["牛肉(瘦肉)", "Lean beef", 171, 28.0, 0, 7.0],
  ["牛腩", "Beef brisket", 250, 22.0, 0, 18.0],
  ["牛排(菲力)", "Beef tenderloin steak", 200, 28.0, 0, 10.0],
  ["牛肉麵(肉)", "Beef noodle soup meat", 180, 24.0, 2.0, 8.0],

  // Seafood
  ["鮭魚", "Salmon", 208, 20.0, 0, 14.0],
  ["鮪魚", "Tuna", 130, 28.0, 0, 1.5],
  ["鯖魚", "Mackerel", 230, 20.0, 0, 16.0],
  ["虱目魚", "Milkfish", 200, 20.0, 0, 13.0],
  ["鱈魚", "Cod", 82, 18.0, 0, 0.7],
  ["吳郭魚", "Tilapia", 96, 20.0, 0, 1.7],
  ["白蝦", "Shrimp", 85, 20.0, 0, 0.5],
  ["花枝/透抽", "Squid", 80, 16.0, 1.5, 0.8],
  ["蛤蜊", "Clams", 70, 12.0, 3.0, 0.5],
  ["蚵仔", "Oysters", 80, 9.0, 4.0, 2.5],

  // Soy & Egg
  ["雞蛋(全熟)", "Hard-boiled egg", 155, 13.0, 1.1, 11.0],
  ["荷包蛋", "Fried egg", 196, 13.0, 1.0, 15.0],
  ["蒸蛋", "Steamed egg custard", 80, 6.0, 2.0, 5.0],
  ["滷蛋", "Braised egg", 160, 13.0, 2.0, 11.0],
  ["皮蛋", "Century egg", 170, 14.0, 1.5, 12.0],
  ["豆腐(板豆腐)", "Firm tofu", 76, 8.0, 2.0, 4.0],
  ["嫩豆腐", "Silken tofu", 55, 5.0, 2.0, 3.0],
  ["豆乾", "Dried tofu", 160, 18.0, 2.0, 8.0],
  ["豆皮", "Tofu skin", 200, 22.0, 4.0, 10.0],
  ["油豆腐", "Fried tofu", 180, 14.0, 4.0, 12.0],
  ["毛豆", "Edamame", 130, 12.0, 10.0, 5.0],
  ["納豆", "Natto", 200, 18.0, 14.0, 10.0],

  // Vegetables
  ["高麗菜(炒)", "Stir-fried cabbage", 50, 1.5, 5.0, 2.5],
  ["高麗菜(燙)", "Boiled cabbage", 23, 1.3, 4.0, 0.3],
  ["空心菜(炒)", "Stir-fried water spinach", 55, 2.0, 4.0, 3.0],
  ["菠菜(炒)", "Stir-fried spinach", 50, 2.5, 3.5, 3.0],
  ["地瓜葉(炒)", "Stir-fried sweet potato leaves", 50, 2.5, 4.0, 2.5],
  ["青江菜(燙)", "Boiled bok choy", 18, 1.5, 2.5, 0.3],
  ["花椰菜(燙)", "Boiled broccoli", 35, 2.8, 5.0, 0.4],
  ["花椰菜(炒)", "Stir-fried broccoli", 55, 3.0, 5.0, 2.5],
  ["玉米", "Corn", 96, 3.4, 19.0, 1.2],
  ["玉米筍", "Baby corn", 40, 2.0, 7.0, 0.5],
  ["四季豆(炒)", "Stir-fried green beans", 50, 2.0, 6.0, 2.0],
  ["茄子(炒)", "Stir-fried eggplant", 65, 1.0, 6.0, 4.0],
  ["紅蘿蔔(炒)", "Stir-fried carrot", 55, 1.0, 8.0, 2.5],
  ["白蘿蔔(煮)", "Boiled daikon radish", 18, 0.6, 3.5, 0.2],
  ["小黃瓜", "Cucumber", 15, 0.7, 2.5, 0.1],
  ["番茄", "Tomato", 18, 0.9, 3.5, 0.2],
  ["番茄炒蛋", "Tomato scrambled eggs", 90, 5.0, 4.0, 6.0],
  ["洋蔥(炒)", "Stir-fried onion", 55, 1.0, 8.0, 2.5],
  ["青椒(炒)", "Stir-fried green pepper", 40, 1.0, 5.0, 2.0],
  ["豆芽菜(炒)", "Stir-fried bean sprouts", 40, 3.0, 4.0, 1.5],

  // Soups & Fruits
  ["紫菜蛋花湯", "Seaweed egg drop soup", 30, 2.0, 1.5, 1.5],
  ["味噌湯", "Miso soup", 35, 2.0, 3.0, 1.0],
  ["貢丸湯", "Meatball soup", 60, 4.0, 3.0, 3.0],
  ["酸辣湯", "Hot and sour soup", 50, 3.0, 5.0, 2.0],
  ["香蕉", "Banana", 89, 1.1, 23.0, 0.3],
  ["蘋果", "Apple", 52, 0.3, 14.0, 0.2],
  ["柳丁", "Orange", 47, 0.9, 12.0, 0.1],
  ["芭樂", "Guava", 38, 0.8, 8.0, 0.4],
  ["火龍果", "Dragon fruit", 55, 1.0, 13.0, 0.4],
  ["奇異果", "Kiwi", 61, 1.1, 15.0, 0.5],
  ["葡萄", "Grapes", 69, 0.7, 18.0, 0.2],

  // Composite dishes
  ["滷肉飯", "Braised pork rice", 220, 7.0, 26.0, 10.0],
  ["雞肉飯", "Chicken rice", 190, 8.0, 25.0, 6.0],
  ["排骨便當", "Pork chop bento", 280, 14.0, 34.0, 12.0],
  ["雞腿便當", "Chicken leg bento", 270, 15.0, 32.0, 11.0],
  ["滷肉便當", "Braised pork bento", 290, 12.0, 35.0, 13.0],
  ["炒飯", "Fried rice", 200, 6.0, 28.0, 8.0],
  ["炒麵", "Fried noodles", 190, 6.0, 26.0, 7.0],
  ["水餃(每顆)", "Dumpling per piece", 200, 8.0, 25.0, 7.0],
  ["鍋貼(每顆)", "Potsticker per piece", 220, 7.0, 22.0, 11.0],
  ["小籠包(每顆)", "Xiaolongbao per piece", 170, 8.0, 18.0, 7.0],
  ["肉包", "Meat bun", 230, 10.0, 30.0, 8.0],
  ["菜包", "Vegetable bun", 180, 6.0, 28.0, 5.0],
  ["蛋餅", "Egg crepe", 210, 8.0, 22.0, 10.0],
  ["飯糰", "Rice ball", 220, 8.0, 35.0, 6.0],
  ["燒餅油條", "Shao bing you tiao", 380, 10.0, 42.0, 20.0],
  ["蘿蔔糕", "Turnip cake", 150, 3.0, 22.0, 5.0],
  ["豆漿(無糖)", "Soy milk unsweetened", 33, 3.5, 1.5, 1.5],
  ["豆漿(有糖)", "Soy milk sweetened", 55, 3.5, 7.0, 1.5],
  ["牛奶", "Milk", 65, 3.2, 4.8, 3.5],
  ["拿鐵咖啡", "Caffe latte", 45, 2.5, 4.0, 2.0],
  ["珍珠奶茶(中杯)", "Bubble milk tea medium", 90, 0.8, 18.0, 2.0],
];

async function seedLocalFoods() {
  for (const [name, nameEn, cal, pro, carb, fat] of SEED_FOODS) {
    await query(
      `INSERT INTO food_nutrition_cache (food_name, display_name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, source, source_id)
       VALUES ($1,$2,$3,$4,$5,$6,0,'local',$2)
       ON CONFLICT (food_name, source) DO NOTHING`,
      [name, nameEn, cal, pro, carb, fat]
    );
  }
}

let seeded = false;

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
  if (!seeded) { await seedLocalFoods(); seeded = true; }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 1) {
    // Return all local foods when no query (for browse)
    const all = await query(`SELECT * FROM food_nutrition_cache WHERE source = 'local' ORDER BY food_name LIMIT 200`);
    return NextResponse.json({ results: all.rows, source: "local" });
  }

  // 1. Local cache (prioritizes seed foods)
  const allCache = await query(
    `SELECT * FROM food_nutrition_cache WHERE food_name ILIKE $1 ORDER BY CASE source WHEN 'local' THEN 0 WHEN 'open_food_facts' THEN 1 ELSE 2 END LIMIT 20`,
    [`%${q}%`]
  );

  if (allCache.rows.length > 0) {
    return NextResponse.json({ results: allCache.rows, source: "cache" });
  }

  // 2. Custom foods
  const custom = await query(
    `SELECT id, food_name, food_name as display_name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, 0 as fiber_per_100g, 'custom' as source, id::text as source_id, created_at FROM user_custom_foods WHERE user_id = 1 AND food_name ILIKE $1 LIMIT 10`,
    [`%${q}%`]
  );
  if (custom.rows.length > 0) {
    return NextResponse.json({ results: custom.rows, source: "custom" });
  }

  // 3. Open Food Facts
  const offResults = await searchOFF(q);
  if (offResults.length > 0) {
    await upsertCache(offResults);
    return NextResponse.json({ results: offResults, source: "api" });
  }

  return NextResponse.json({ results: [], source: "none" });
}
