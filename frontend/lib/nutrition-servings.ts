/**
 * Typical grams per serving unit for common Taiwanese / Asian foods.
 * Used when logging with 碗/份/個 etc. instead of raw grams.
 *
 * Lookup order (see resolveGramsPerServing):
 *  1. explicit client hint
 *  2. user_custom_foods.grams_per_serving
 *  3. this table (food + unit, then food default, then unit default)
 *  4. fallback 100g
 */

export type ServingUnit =
  | "g" | "ml" | "份" | "碗" | "杯" | "罐" | "瓶" | "個" | "包" | "碟"
  | "匙" | "片" | "塊" | "顆" | string;

/** Default grams for a unit when food-specific data is missing */
export const UNIT_DEFAULT_GRAMS: Record<string, number> = {
  "g": 1,
  "ml": 1,
  "份": 200,   // typical plate / set portion
  "碗": 200,   // rice bowl ≈ 150–250g
  "杯": 240,   // ~1 cup liquid
  "罐": 330,   // soda can
  "瓶": 500,   // medium bottle
  "個": 80,    // generic piece
  "包": 100,   // snack pack
  "碟": 120,   // small plate veg/side
  "匙": 15,    // tablespoon-ish
  "片": 30,    // slice
  "塊": 50,    // chunk
  "顆": 50,    // small piece (dumpling, egg-ish)
};

/**
 * Food-specific grams per common unit.
 * Keys are Chinese food names (and common aliases).
 * Values map unit → grams for ONE unit of that measure.
 */
export const FOOD_SERVING_GRAMS: Record<string, Partial<Record<string, number>>> = {
  // Staples
  "白飯": { "碗": 180, "份": 180, "杯": 150 },
  "糙米飯": { "碗": 180, "份": 180 },
  "五穀飯": { "碗": 180, "份": 180 },
  "稀飯": { "碗": 250, "份": 250 },
  "地瓜粥": { "碗": 250, "份": 250 },
  "白饅頭": { "個": 80, "份": 80 },
  "吐司": { "片": 30, "份": 60 },
  "全麥吐司": { "片": 30, "份": 60 },
  "白麵條(熟)": { "碗": 200, "份": 200 },
  "義大利麵(熟)": { "碗": 180, "份": 180 },
  "陽春麵": { "碗": 300, "份": 300 },
  "冬粉(熟)": { "碗": 150, "份": 150 },

  // Proteins
  "雞胸肉": { "份": 120, "片": 40, "塊": 50 },
  "雞腿肉(去皮)": { "份": 120, "個": 120 },
  "雞腿(含皮)": { "份": 150, "個": 150 },
  "滷雞腿": { "份": 130, "個": 130 },
  "雞排(炸)": { "份": 200, "片": 200 },
  "雞翅": { "個": 40, "份": 80 },
  "豬瘦肉": { "份": 100, "片": 30 },
  "豬五花肉": { "份": 100, "片": 25 },
  "豬腳": { "份": 150 },
  "排骨(炸)": { "份": 150, "塊": 80 },
  "滷排骨": { "份": 140, "塊": 70 },
  "滷肉(控肉)": { "份": 80, "碗": 100 },
  "滷肉燥": { "份": 50, "匙": 20, "碗": 80 },
  "香腸": { "個": 70, "份": 70 },
  "牛肉(瘦肉)": { "份": 100, "片": 30 },
  "牛腩": { "份": 120, "塊": 40 },
  "牛排(菲力)": { "份": 180, "片": 180 },
  "牛肉麵(肉)": { "份": 100 },

  // Seafood
  "鮭魚": { "份": 120, "片": 100 },
  "鮪魚": { "份": 100, "罐": 120 },
  "鯖魚": { "份": 120 },
  "虱目魚": { "份": 120 },
  "鱈魚": { "份": 120 },
  "吳郭魚": { "份": 150 },
  "白蝦": { "份": 80, "個": 15 },
  "花枝/透抽": { "份": 100 },
  "蛤蜊": { "份": 100, "個": 12 },
  "蚵仔": { "份": 80 },

  // Soy & egg
  "雞蛋(全熟)": { "個": 50, "顆": 50, "份": 50 },
  "荷包蛋": { "個": 55, "份": 55 },
  "蒸蛋": { "碗": 150, "份": 150 },
  "滷蛋": { "個": 55, "份": 55 },
  "皮蛋": { "個": 55, "份": 55 },
  "豆腐(板豆腐)": { "份": 100, "塊": 50 },
  "嫩豆腐": { "份": 100, "盒": 300 },
  "豆乾": { "份": 50, "片": 20 },
  "豆皮": { "份": 40 },
  "油豆腐": { "個": 30, "份": 60 },
  "毛豆": { "份": 80 },
  "納豆": { "包": 40, "份": 40 },

  // Vegetables
  "高麗菜(炒)": { "份": 120, "碟": 120 },
  "高麗菜(燙)": { "份": 100, "碟": 100 },
  "空心菜(炒)": { "份": 100, "碟": 100 },
  "菠菜(炒)": { "份": 100, "碟": 100 },
  "地瓜葉(炒)": { "份": 100, "碟": 100 },
  "青江菜(燙)": { "份": 100, "碟": 100 },
  "花椰菜(燙)": { "份": 100 },
  "花椰菜(炒)": { "份": 100 },
  "玉米": { "根": 150, "份": 100 },
  "玉米筍": { "份": 80 },
  "四季豆(炒)": { "份": 100 },
  "茄子(炒)": { "份": 120 },
  "紅蘿蔔(炒)": { "份": 80 },
  "白蘿蔔(煮)": { "份": 100 },
  "小黃瓜": { "根": 100, "份": 80 },
  "番茄": { "個": 120, "份": 120 },
  "番茄炒蛋": { "份": 150, "碟": 150 },
  "洋蔥(炒)": { "份": 80 },
  "青椒(炒)": { "份": 80 },
  "豆芽菜(炒)": { "份": 100 },

  // Soups & fruits
  "紫菜蛋花湯": { "碗": 250, "份": 250 },
  "味噌湯": { "碗": 200, "份": 200 },
  "貢丸湯": { "碗": 300, "份": 300 },
  "酸辣湯": { "碗": 300, "份": 300 },
  "香蕉": { "根": 120, "個": 120, "份": 120 },
  "蘋果": { "個": 180, "份": 180 },
  "柳丁": { "個": 150, "份": 150 },
  "芭樂": { "個": 200, "份": 150 },
  "火龍果": { "個": 300, "份": 150 },
  "奇異果": { "個": 80, "份": 80 },
  "葡萄": { "份": 100, "顆": 5 },
  "芒果": { "個": 200, "份": 150 },

  // Composite
  "滷肉飯": { "碗": 300, "份": 300 },
  "雞肉飯": { "碗": 300, "份": 300 },
  "排骨便當": { "份": 500 },
  "雞腿便當": { "份": 500 },
  "滷肉便當": { "份": 500 },
  "炒飯": { "盤": 350, "份": 350, "碗": 300 },
  "炒麵": { "盤": 350, "份": 350, "碗": 300 },
  "水餃(每顆)": { "顆": 25, "個": 25, "份": 150 },
  "鍋貼(每顆)": { "顆": 28, "個": 28, "份": 140 },
  "小籠包(每顆)": { "顆": 30, "個": 30, "份": 120 },
  "肉包": { "個": 100, "份": 100 },
  "菜包": { "個": 90, "份": 90 },
  "蛋餅": { "份": 120, "個": 120 },
  "飯糰": { "個": 180, "份": 180 },
  "燒餅油條": { "份": 150 },
  "蘿蔔糕": { "份": 100, "片": 50 },
  "豆漿(無糖)": { "杯": 300, "瓶": 300, "份": 300 },
  "豆漿(有糖)": { "杯": 300, "瓶": 300, "份": 300 },
  "牛奶": { "杯": 240, "瓶": 250, "份": 240 },
  "拿鐵咖啡": { "杯": 300, "份": 300 },
  "珍珠奶茶(中杯)": { "杯": 500, "份": 500 },
  "奶茶": { "杯": 350, "份": 350 },
  "抹茶拿鐵": { "杯": 300, "份": 300 },

  // Desserts / snacks
  "麻糬": { "個": 40, "份": 80 },
  "刨冰": { "碗": 300, "份": 300 },
  "冰淇淋": { "球": 60, "份": 100 },
  "鮮奶油": { "匙": 15, "份": 30 },
  "黑芝麻": { "匙": 10, "份": 20 },
  "花生": { "份": 30, "把": 20 },
  "抹茶粉": { "匙": 5, "份": 10 },
};

/** Aliases → canonical name in FOOD_SERVING_GRAMS */
const ALIASES: Record<string, string> = {
  "白米饭": "白飯",
  "米饭": "白飯",
  "飯": "白飯",
  "rice": "白飯",
  "雞蛋": "雞蛋(全熟)",
  "蛋": "雞蛋(全熟)",
  "egg": "雞蛋(全熟)",
  "雞胸": "雞胸肉",
  "雞腿": "滷雞腿",
  "水餃": "水餃(每顆)",
  "餃子": "水餃(每顆)",
  "鍋貼": "鍋貼(每顆)",
  "小籠包": "小籠包(每顆)",
  "吐司麵包": "吐司",
  "麵包": "吐司",
  "牛奶(全脂)": "牛奶",
  "優格": "牛奶",
  "珍珠奶茶": "珍珠奶茶(中杯)",
  "珍奶": "珍珠奶茶(中杯)",
  "花枝": "花枝/透抽",
  "透抽": "花枝/透抽",
  "滷肉": "滷肉(控肉)",
  "控肉": "滷肉(控肉)",
};

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, "");
}

/**
 * Resolve grams for ONE unit of the given food + serving unit.
 * Returns null only for pure weight units (caller should use amount as grams).
 */
export function resolveGramsPerServing(
  foodName: string,
  unit: string,
  hint?: number | null
): number {
  if (hint && hint > 0) return hint;

  const u = (unit || "g").trim().toLowerCase();
  // g/ml: one "unit" is 1 gram/ml — amount already is grams
  if (u === "g" || u === "ml") return 1;

  const raw = normalizeName(foodName);
  const canonical = ALIASES[raw] || ALIASES[raw.toLowerCase()] || raw;

  // Exact food + unit
  const foodMap = FOOD_SERVING_GRAMS[canonical];
  if (foodMap) {
    if (foodMap[unit] && foodMap[unit]! > 0) return foodMap[unit]!;
    // case-insensitive unit in map
    const unitKey = Object.keys(foodMap).find((k) => k.toLowerCase() === u);
    if (unitKey && foodMap[unitKey]! > 0) return foodMap[unitKey]!;
    // food default: prefer 份 then first value
    if (foodMap["份"] && foodMap["份"]! > 0) return foodMap["份"]!;
  }

  // Partial name match (e.g. "滷雞腿便當" contains "滷雞腿")
  for (const [key, units] of Object.entries(FOOD_SERVING_GRAMS)) {
    if (canonical.includes(key) || key.includes(canonical)) {
      if (units[unit] && units[unit]! > 0) return units[unit]!;
      if (units["份"] && units["份"]! > 0) return units["份"]!;
    }
  }

  // Unit default
  if (UNIT_DEFAULT_GRAMS[unit] && UNIT_DEFAULT_GRAMS[unit] > 0) {
    return UNIT_DEFAULT_GRAMS[unit];
  }
  if (UNIT_DEFAULT_GRAMS[u]) return UNIT_DEFAULT_GRAMS[u];

  return 100;
}

/** Convert amount + unit → total grams for nutrition math */
export function amountToGramsSync(
  foodName: string,
  amount: number,
  unit: string,
  gramsPerServingHint?: number | null
): number {
  const u = (unit || "g").trim();
  if (u === "g" || u === "ml") return Number(amount) || 0;
  const gps = resolveGramsPerServing(foodName, u, gramsPerServingHint);
  return (Number(amount) || 0) * gps;
}
