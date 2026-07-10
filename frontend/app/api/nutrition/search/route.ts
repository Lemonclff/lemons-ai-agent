     1|import { NextRequest, NextResponse } from "next/server";
     2|import { query } from "@/lib/db";
import { getUserId } from "@/lib/nutrition-auth";
     3|
     4|/* ================================================================
     5|   Nutrition Search API
     6|   GET /api/nutrition/search?q=chicken
     7|   - Local curated DB (Taiwanese foods) → Custom foods → Cache → OFF → USDA
     8|   ================================================================ */
     9|
    10|/* ---- Types ---- */
    11|
    12|interface FoodResult {
    13|  food_name: string;
    14|  display_name: string;
    15|  calories_per_100g: number;
    16|  protein_per_100g: number;
    17|  carbs_per_100g: number;
    18|  fat_per_100g: number;
    19|  fiber_per_100g: number;
    20|  source: string;
    21|  source_id: string | null;
    22|}
    23|
    24|/* ---- Seed data: curated Taiwanese/Asian foods ---- */
    25|
    26|const SEED_FOODS: Array<[string, string, number, number, number, number]> = [
    27|  // Staples
    28|  ["白飯", "White rice", 183, 2.7, 39.8, 0.4],
    29|  ["糙米飯", "Brown rice", 180, 3.8, 36.7, 1.5],
    30|  ["五穀飯", "Multigrain rice", 175, 4.0, 35.0, 1.2],
    31|  ["稀飯", "Congee", 53, 1.1, 11.5, 0.2],
    32|  ["地瓜粥", "Sweet potato congee", 70, 1.3, 15.0, 0.3],
    33|  ["白饅頭", "Steamed bun", 223, 7.0, 44.0, 1.1],
    34|  ["吐司", "Toast bread", 280, 8.5, 49.0, 4.5],
    35|  ["全麥吐司", "Whole wheat toast", 250, 10.0, 43.0, 4.0],
    36|  ["白麵條(熟)", "White noodles cooked", 138, 4.5, 28.0, 0.5],
    37|  ["義大利麵(熟)", "Pasta cooked", 131, 5.0, 25.0, 1.1],
    38|  ["陽春麵", "Plain noodles", 140, 4.5, 28.0, 0.5],
    39|  ["冬粉(熟)", "Glass noodles cooked", 80, 0.2, 18.0, 0.1],
    40|
    41|  // Proteins - Meat
    42|  ["雞胸肉", "Chicken breast", 165, 31.0, 0, 3.6],
    43|  ["雞腿肉(去皮)", "Chicken thigh skinless", 175, 26.0, 0, 7.5],
    44|  ["雞腿(含皮)", "Chicken thigh with skin", 230, 24.0, 0, 15.0],
    45|  ["滷雞腿", "Braised chicken leg", 210, 25.0, 2.0, 11.0],
    46|  ["雞排(炸)", "Fried chicken cutlet", 310, 22.0, 15.0, 18.0],
    47|  ["雞翅", "Chicken wings", 250, 22.0, 3.0, 16.0],
    48|  ["豬瘦肉", "Lean pork", 180, 28.0, 0, 7.0],
    49|  ["豬五花肉", "Pork belly", 350, 16.0, 0, 31.0],
    50|  ["豬腳", "Pork trotter", 290, 22.0, 1.0, 22.0],
    51|  ["排骨(炸)", "Fried pork chop", 290, 20.0, 10.0, 18.0],
    52|  ["滷排骨", "Braised pork chop", 230, 22.0, 3.0, 14.0],
    53|  ["滷肉(控肉)", "Braised pork belly", 320, 18.0, 2.0, 26.0],
    54|  ["滷肉燥", "Minced braised pork", 300, 16.0, 4.0, 24.0],
    55|  ["香腸", "Sausage", 320, 15.0, 8.0, 25.0],
    56|  ["牛肉(瘦肉)", "Lean beef", 171, 28.0, 0, 7.0],
    57|  ["牛腩", "Beef brisket", 250, 22.0, 0, 18.0],
    58|  ["牛排(菲力)", "Beef tenderloin steak", 200, 28.0, 0, 10.0],
    59|  ["牛肉麵(肉)", "Beef noodle soup meat", 180, 24.0, 2.0, 8.0],
    60|
    61|  // Seafood
    62|  ["鮭魚", "Salmon", 208, 20.0, 0, 14.0],
    63|  ["鮪魚", "Tuna", 130, 28.0, 0, 1.5],
    64|  ["鯖魚", "Mackerel", 230, 20.0, 0, 16.0],
    65|  ["虱目魚", "Milkfish", 200, 20.0, 0, 13.0],
    66|  ["鱈魚", "Cod", 82, 18.0, 0, 0.7],
    67|  ["吳郭魚", "Tilapia", 96, 20.0, 0, 1.7],
    68|  ["白蝦", "Shrimp", 85, 20.0, 0, 0.5],
    69|  ["花枝/透抽", "Squid", 80, 16.0, 1.5, 0.8],
    70|  ["蛤蜊", "Clams", 70, 12.0, 3.0, 0.5],
    71|  ["蚵仔", "Oysters", 80, 9.0, 4.0, 2.5],
    72|
    73|  // Soy & Egg
    74|  ["雞蛋(全熟)", "Hard-boiled egg", 155, 13.0, 1.1, 11.0],
    75|  ["荷包蛋", "Fried egg", 196, 13.0, 1.0, 15.0],
    76|  ["蒸蛋", "Steamed egg custard", 80, 6.0, 2.0, 5.0],
    77|  ["滷蛋", "Braised egg", 160, 13.0, 2.0, 11.0],
    78|  ["皮蛋", "Century egg", 170, 14.0, 1.5, 12.0],
    79|  ["豆腐(板豆腐)", "Firm tofu", 76, 8.0, 2.0, 4.0],
    80|  ["嫩豆腐", "Silken tofu", 55, 5.0, 2.0, 3.0],
    81|  ["豆乾", "Dried tofu", 160, 18.0, 2.0, 8.0],
    82|  ["豆皮", "Tofu skin", 200, 22.0, 4.0, 10.0],
    83|  ["油豆腐", "Fried tofu", 180, 14.0, 4.0, 12.0],
    84|  ["毛豆", "Edamame", 130, 12.0, 10.0, 5.0],
    85|  ["納豆", "Natto", 200, 18.0, 14.0, 10.0],
    86|
    87|  // Vegetables
    88|  ["高麗菜(炒)", "Stir-fried cabbage", 50, 1.5, 5.0, 2.5],
    89|  ["高麗菜(燙)", "Boiled cabbage", 23, 1.3, 4.0, 0.3],
    90|  ["空心菜(炒)", "Stir-fried water spinach", 55, 2.0, 4.0, 3.0],
    91|  ["菠菜(炒)", "Stir-fried spinach", 50, 2.5, 3.5, 3.0],
    92|  ["地瓜葉(炒)", "Stir-fried sweet potato leaves", 50, 2.5, 4.0, 2.5],
    93|  ["青江菜(燙)", "Boiled bok choy", 18, 1.5, 2.5, 0.3],
    94|  ["花椰菜(燙)", "Boiled broccoli", 35, 2.8, 5.0, 0.4],
    95|  ["花椰菜(炒)", "Stir-fried broccoli", 55, 3.0, 5.0, 2.5],
    96|  ["玉米", "Corn", 96, 3.4, 19.0, 1.2],
    97|  ["玉米筍", "Baby corn", 40, 2.0, 7.0, 0.5],
    98|  ["四季豆(炒)", "Stir-fried green beans", 50, 2.0, 6.0, 2.0],
    99|  ["茄子(炒)", "Stir-fried eggplant", 65, 1.0, 6.0, 4.0],
   100|  ["紅蘿蔔(炒)", "Stir-fried carrot", 55, 1.0, 8.0, 2.5],
   101|  ["白蘿蔔(煮)", "Boiled daikon radish", 18, 0.6, 3.5, 0.2],
   102|  ["小黃瓜", "Cucumber", 15, 0.7, 2.5, 0.1],
   103|  ["番茄", "Tomato", 18, 0.9, 3.5, 0.2],
   104|  ["番茄炒蛋", "Tomato scrambled eggs", 90, 5.0, 4.0, 6.0],
   105|  ["洋蔥(炒)", "Stir-fried onion", 55, 1.0, 8.0, 2.5],
   106|  ["青椒(炒)", "Stir-fried green pepper", 40, 1.0, 5.0, 2.0],
   107|  ["豆芽菜(炒)", "Stir-fried bean sprouts", 40, 3.0, 4.0, 1.5],
   108|
   109|  // Soups & Fruits
   110|  ["紫菜蛋花湯", "Seaweed egg drop soup", 30, 2.0, 1.5, 1.5],
   111|  ["味噌湯", "Miso soup", 35, 2.0, 3.0, 1.0],
   112|  ["貢丸湯", "Meatball soup", 60, 4.0, 3.0, 3.0],
   113|  ["酸辣湯", "Hot and sour soup", 50, 3.0, 5.0, 2.0],
   114|  ["香蕉", "Banana", 89, 1.1, 23.0, 0.3],
   115|  ["蘋果", "Apple", 52, 0.3, 14.0, 0.2],
   116|  ["柳丁", "Orange", 47, 0.9, 12.0, 0.1],
   117|  ["芭樂", "Guava", 38, 0.8, 8.0, 0.4],
   118|  ["火龍果", "Dragon fruit", 55, 1.0, 13.0, 0.4],
   119|  ["奇異果", "Kiwi", 61, 1.1, 15.0, 0.5],
   120|  ["葡萄", "Grapes", 69, 0.7, 18.0, 0.2],
   121|
   122|  // Composite dishes
   123|  ["滷肉飯", "Braised pork rice", 220, 7.0, 26.0, 10.0],
   124|  ["雞肉飯", "Chicken rice", 190, 8.0, 25.0, 6.0],
   125|  ["排骨便當", "Pork chop bento", 280, 14.0, 34.0, 12.0],
   126|  ["雞腿便當", "Chicken leg bento", 270, 15.0, 32.0, 11.0],
   127|  ["滷肉便當", "Braised pork bento", 290, 12.0, 35.0, 13.0],
   128|  ["炒飯", "Fried rice", 200, 6.0, 28.0, 8.0],
   129|  ["炒麵", "Fried noodles", 190, 6.0, 26.0, 7.0],
   130|  ["水餃(每顆)", "Dumpling per piece", 200, 8.0, 25.0, 7.0],
   131|  ["鍋貼(每顆)", "Potsticker per piece", 220, 7.0, 22.0, 11.0],
   132|  ["小籠包(每顆)", "Xiaolongbao per piece", 170, 8.0, 18.0, 7.0],
   133|  ["肉包", "Meat bun", 230, 10.0, 30.0, 8.0],
   134|  ["菜包", "Vegetable bun", 180, 6.0, 28.0, 5.0],
   135|  ["蛋餅", "Egg crepe", 210, 8.0, 22.0, 10.0],
   136|  ["飯糰", "Rice ball", 220, 8.0, 35.0, 6.0],
   137|  ["燒餅油條", "Shao bing you tiao", 380, 10.0, 42.0, 20.0],
   138|  ["蘿蔔糕", "Turnip cake", 150, 3.0, 22.0, 5.0],
   139|  ["豆漿(無糖)", "Soy milk unsweetened", 33, 3.5, 1.5, 1.5],
   140|  ["豆漿(有糖)", "Soy milk sweetened", 55, 3.5, 7.0, 1.5],
   141|  ["牛奶", "Milk", 65, 3.2, 4.8, 3.5],
   142|  ["拿鐵咖啡", "Caffe latte", 45, 2.5, 4.0, 2.0],
   143|  ["珍珠奶茶(中杯)", "Bubble milk tea medium", 90, 0.8, 18.0, 2.0],
   144|
   145|  // Desserts & Sweets
   146|  ["麻糬", "Mochi", 230, 4.0, 50.0, 1.5],
   147|  ["刨冰", "Shaved ice", 120, 0.5, 28.0, 0.2],
   148|  ["冰淇淋", "Ice cream", 210, 3.5, 24.0, 11.0],
   149|  ["抹茶拿鐵", "Matcha latte", 60, 3.0, 8.0, 2.0],
   150|  ["鮮奶油", "Whipped cream", 340, 2.0, 3.0, 36.0],
   151|  ["芒果", "Mango", 60, 0.8, 15.0, 0.4],
   152|  ["奶茶", "Milk tea", 70, 1.0, 12.0, 2.0],
   153|  ["桂花", "Osmanthus", 0, 0, 0, 0],
   154|  ["黑芝麻", "Black sesame", 570, 18.0, 23.0, 50.0],
   155|  ["花生", "Peanut", 567, 26.0, 16.0, 49.0],
   156|  ["抹茶粉", "Matcha powder", 320, 30.0, 37.0, 5.0],
   157|];
   158|
   159|async function seedLocalFoods() {
   160|  for (const [name, nameEn, cal, pro, carb, fat] of SEED_FOODS) {
   161|    await query(
   162|      `INSERT INTO food_nutrition_cache (food_name, display_name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, source, source_id)
   163|       VALUES ($1,$2,$3,$4,$5,$6,0,'local',$2)
   164|       ON CONFLICT (food_name, source) DO NOTHING`,
   165|      [name, nameEn, cal, pro, carb, fat]
   166|    );
   167|  }
   168|}
   169|
   170|let seeded = false;
   171|
   172|function ensureTables() {
   173|  return query(`
   174|    CREATE TABLE IF NOT EXISTS food_nutrition_cache (
   175|        id                SERIAL PRIMARY KEY,
   176|        food_name         VARCHAR(200) NOT NULL,
   177|        display_name      VARCHAR(200),
   178|        calories_per_100g DECIMAL(10,4),
   179|        protein_per_100g  DECIMAL(10,4),
   180|        carbs_per_100g    DECIMAL(10,4),
   181|        fat_per_100g      DECIMAL(10,4),
   182|        fiber_per_100g    DECIMAL(10,4),
   183|        source            VARCHAR(20) NOT NULL,
   184|        source_id         VARCHAR(100),
   185|        created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
   186|        UNIQUE(food_name, source)
   187|    );
   188|    CREATE TABLE IF NOT EXISTS user_custom_foods (
   189|        id                SERIAL PRIMARY KEY,
   190|        user_id           INTEGER NOT NULL REFERENCES users(id),
   191|        food_name         VARCHAR(200) NOT NULL,
   192|        calories_per_100g DECIMAL(10,4),
   193|        protein_per_100g  DECIMAL(10,4),
   194|        carbs_per_100g    DECIMAL(10,4),
   195|        fat_per_100g      DECIMAL(10,4),
   196|        created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
   197|    );
   198|    CREATE TABLE IF NOT EXISTS daily_food_logs (
   199|        id            SERIAL PRIMARY KEY,
   200|        user_id       INTEGER NOT NULL REFERENCES users(id),
   201|        log_date      DATE NOT NULL,
   202|        meal_type     VARCHAR(20) DEFAULT 'snack',
   203|        food_name     VARCHAR(200) NOT NULL,
   204|        amount        DECIMAL(10,4),
   205|        calories      DECIMAL(10,4),
   206|        protein       DECIMAL(10,4),
   207|        carbs         DECIMAL(10,4),
   208|        fat           DECIMAL(10,4),
   209|        source        VARCHAR(20) DEFAULT 'manual',
   210|        created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
   211|    );
   212|    CREATE INDEX IF NOT EXISTS idx_dfl_user_date ON daily_food_logs (user_id, log_date DESC);
   213|  `);
   214|}
   215|
   216|/* ---- Open Food Facts ---- */
   217|
   218|async function searchOFF(q: string): Promise<FoodResult[]> {
   219|  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&fields=product_name,nutriments,code&page_size=8&json=1`;
   220|  try {
   221|    const resp = await fetch(url);
   222|    if (!resp.ok) return [];
   223|    const data = await resp.json();
   224|    const products = (data.products ?? []) as Array<{
   225|      product_name?: string;
   226|      nutriments?: Record<string, number>;
   227|      code?: string;
   228|    }>;
   229|    return products
   230|      .filter((p) => p.product_name && p.nutriments)
   231|      .map((p) => ({
   232|        food_name: p.product_name!,
   233|        display_name: p.product_name!,
   234|        calories_per_100g: p.nutriments?.["energy-kcal_100g"] ?? 0,
   235|        protein_per_100g: p.nutriments?.proteins_100g ?? 0,
   236|        carbs_per_100g: p.nutriments?.carbohydrates_100g ?? 0,
   237|        fat_per_100g: p.nutriments?.fat_100g ?? 0,
   238|        fiber_per_100g: p.nutriments?.fiber_100g ?? 0,
   239|        source: "open_food_facts" as const,
   240|        source_id: p.code || null,
   241|      }));
   242|  } catch {
   243|    return [];
   244|  }
   245|}
   246|
   247|/* ---- Cache ---- */
   248|
   249|async function upsertCache(items: FoodResult[]) {
   250|  for (const item of items) {
   251|    await query(
   252|      `INSERT INTO food_nutrition_cache (food_name, display_name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, source, source_id)
   253|       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
   254|       ON CONFLICT (food_name, source) DO UPDATE SET
   255|         calories_per_100g = EXCLUDED.calories_per_100g,
   256|         protein_per_100g = EXCLUDED.protein_per_100g,
   257|         carbs_per_100g = EXCLUDED.carbs_per_100g,
   258|         fat_per_100g = EXCLUDED.fat_per_100g,
   259|         fiber_per_100g = EXCLUDED.fiber_per_100g`,
   260|      [item.food_name, item.display_name, item.calories_per_100g, item.protein_per_100g, item.carbs_per_100g, item.fat_per_100g, item.fiber_per_100g, item.source, item.source_id]
   261|    );
   262|  }
   263|}
   264|
   265|/* ---- Route ---- */
   266|
   267|export async function GET(req: NextRequest) {
  const uid = getUserId(req);
   268|  await ensureTables();
   269|  if (!seeded) { await seedLocalFoods(); seeded = true; }
   270|
   271|  const q = req.nextUrl.searchParams.get("q")?.trim();
   272|  if (!q || q.length < 1) {
   273|    // Return all local foods when no query (for browse)
   274|    const all = await query(`SELECT * FROM food_nutrition_cache WHERE source = 'local' ORDER BY food_name LIMIT 200`);
   275|    return NextResponse.json({ results: all.rows, source: "local" });
   276|  }
   277|
   278|  // 1. Local cache (prioritizes seed foods)
   279|  const allCache = await query(
   280|    `SELECT * FROM food_nutrition_cache WHERE food_name ILIKE $1 ORDER BY CASE source WHEN 'local' THEN 0 WHEN 'open_food_facts' THEN 1 ELSE 2 END LIMIT 20`,
   281|    [`%${q}%`]
   282|  );
   283|
   284|  if (allCache.rows.length > 0) {
   285|    return NextResponse.json({ results: allCache.rows, source: "cache" });
   286|  }
   287|
   288|  // 2. Custom foods
   289|  const custom = await query(
   290|    `SELECT id, food_name, food_name as display_name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, 0 as fiber_per_100g, 'custom' as source, id::text as source_id, created_at FROM user_custom_foods WHERE user_id = 1 AND food_name ILIKE $1 LIMIT 10`,
   291|    [`%${q}%`]
   292|  );
   293|  if (custom.rows.length > 0) {
   294|    return NextResponse.json({ results: custom.rows, source: "custom" });
   295|  }
   296|
   297|  // 3. Open Food Facts
   298|  const offResults = await searchOFF(q);
   299|  if (offResults.length > 0) {
   300|    await upsertCache(offResults);
   301|    return NextResponse.json({ results: offResults, source: "api" });
   302|  }
   303|
   304|  return NextResponse.json({ results: [], source: "none" });
   305|}
   306|