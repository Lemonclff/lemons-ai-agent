import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserId } from "@/lib/nutrition-auth";

/* ================================================================
   Water Logs API
   GET    /api/nutrition/water?date=     — day's water entries + total
   POST   /api/nutrition/water           — add water entry {amount_ml}
   PUT    /api/nutrition/water           — set daily total (replaces all entries)
   DELETE /api/nutrition/water?id=       — remove entry
   ================================================================ */

export async function GET(req: NextRequest) {
  const uid = getUserId(req);
  if (uid === 0) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const date = req.nextUrl.searchParams.get("date") || new Date().toISOString().slice(0, 10);

  try {
    const result = await query(
      `SELECT id, amount_ml, created_at
       FROM water_logs WHERE user_id = $1 AND log_date = $2 ORDER BY created_at DESC`,
      [uid, date]
    );

    const totalMl = result.rows.reduce((sum: number, r: any) => sum + (Number(r.amount_ml) || 0), 0);

    // Get user's profile to calculate water target
    let targetMl = 2000;
    try {
      const profile = await query(
        `SELECT weight_kg, activity_level, daily_water_target_ml FROM user_profiles WHERE user_id = $1`,
        [uid]
      );
      if (profile.rows[0]) {
        // Use stored target if available, otherwise calculate from weight
        if (profile.rows[0].daily_water_target_ml) {
          targetMl = Number(profile.rows[0].daily_water_target_ml);
        } else {
          const weight = Number(profile.rows[0].weight_kg) || 70;
          const activityMultipliers: Record<string, number> = {
            sedentary: 30, light: 33, moderate: 35, active: 37, very_active: 40,
          };
          const mlPerKg = activityMultipliers[profile.rows[0].activity_level] || 35;
          targetMl = Math.round(weight * mlPerKg);
          // Round to nearest 50ml
          targetMl = Math.round(targetMl / 50) * 50;
        }
      }
    } catch {}

    return NextResponse.json({
      entries: result.rows.map((r: any) => ({
        id: r.id,
        amount_ml: Number(r.amount_ml),
        created_at: r.created_at,
      })),
      total_ml: parseFloat(totalMl.toFixed(1)),
      target_ml: targetMl,
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
    const { amount_ml, log_date } = body;
    const ml = Number(amount_ml) || 250;
    const date = log_date || new Date().toISOString().slice(0, 10);

    const result = await query(
      `INSERT INTO water_logs (user_id, log_date, amount_ml)
       VALUES ($1, $2, $3) RETURNING id, amount_ml, created_at`,
      [uid, date, ml]
    );

    return NextResponse.json({
      ok: true,
      entry: {
        id: result.rows[0].id,
        amount_ml: Number(result.rows[0].amount_ml),
        created_at: result.rows[0].created_at,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const uid = getUserId(req);
  if (uid === 0) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  try {
    const body = await req.json();
    const { amount_ml, log_date } = body;
    const totalMl = Math.max(0, Number(amount_ml) || 0);
    const date = log_date || new Date().toISOString().slice(0, 10);

    // Clear all entries for the day
    await query(`DELETE FROM water_logs WHERE user_id = $1 AND log_date = $2`, [uid, date]);

    // Insert one entry with the total (if > 0)
    if (totalMl > 0) {
      await query(
        `INSERT INTO water_logs (user_id, log_date, amount_ml)
         VALUES ($1, $2, $3)`,
        [uid, date, totalMl]
      );
    }

    return NextResponse.json({ ok: true, total_ml: totalMl });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const uid = getUserId(req);
  if (uid === 0) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    await query(
      `DELETE FROM water_logs WHERE id = $1 AND user_id = $2`,
      [Number(id), uid]
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
