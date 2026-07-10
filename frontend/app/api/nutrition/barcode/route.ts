import { NextRequest, NextResponse } from "next/server";

/* ================================================================
   Barcode Lookup API — Open Food Facts
   GET /api/nutrition/barcode?code=4901234567890
   ================================================================ */

interface OFFProduct {
  code: string;
  product: {
    product_name?: string;
    product_name_zh?: string;
    brands?: string;
    image_url?: string;
    nutriments?: {
      "energy-kcal_100g"?: number;
      "energy-kcal_serving"?: number;
      "proteins_100g"?: number;
      "carbohydrates_100g"?: number;
      "fat_100g"?: number;
      "fiber_100g"?: number;
      "sugars_100g"?: number;
      "saturated-fat_100g"?: number;
      "salt_100g"?: number;
      "sodium_100g"?: number;
    };
    serving_size?: string;
    serving_quantity?: number;
    quantity?: string;
  };
  status: number;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code || code.length < 4) {
    return NextResponse.json({ error: "Valid barcode required" }, { status: 400 });
  }
  // Clean the code: strip non-digit characters, keep only digits
  const cleanCode = code.replace(/\D/g, "");

  try {
    const resp = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${cleanCode}.json`,
      {
        headers: {
          "User-Agent": "NutriSnap/1.0 (https://nutrisnap.app; contact@nutrisnap.app)",
        },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!resp.ok) {
      return NextResponse.json({ error: `OFF API error: ${resp.status}` }, { status: 502 });
    }

    const data: OFFProduct = await resp.json();

    if (data.status === 0 || !data.product) {
      return NextResponse.json({ error: "Product not found in Open Food Facts database" }, { status: 404 });
    }

    const p = data.product;
    const n = p.nutriments || {};

    // Prefer Chinese name if available, fall back to English
    const name = p.product_name_zh || p.product_name || "Unknown Product";

    const result = {
      code: cleanCode,
      name,
      brand: p.brands || null,
      image: p.image_url || null,
      serving_size: p.serving_size || null,
      serving_quantity: p.serving_quantity || null,
      quantity: p.quantity || null,
      nutrition: {
        calories_per_100g: n["energy-kcal_100g"]
          ? Math.round(Number(n["energy-kcal_100g"]))
          : n["energy-kcal_serving"] && p.serving_quantity
            ? Math.round(Number(n["energy-kcal_serving"]) / (Number(p.serving_quantity) / 100))
            : 0,
        protein_per_100g: n.proteins_100g ? parseFloat(Number(n.proteins_100g).toFixed(1)) : 0,
        carbs_per_100g: n.carbohydrates_100g ? parseFloat(Number(n.carbohydrates_100g).toFixed(1)) : 0,
        fat_per_100g: n.fat_100g ? parseFloat(Number(n.fat_100g).toFixed(1)) : 0,
        fiber_per_100g: n.fiber_100g ? parseFloat(Number(n.fiber_100g).toFixed(1)) : 0,
        sugars_per_100g: n.sugars_100g ? parseFloat(Number(n.sugars_100g).toFixed(1)) : 0,
      },
    };

    return NextResponse.json(result);
  } catch (e: any) {
    if (e.name === "AbortError" || e.name === "TimeoutError") {
      return NextResponse.json({ error: "Request timed out" }, { status: 504 });
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
