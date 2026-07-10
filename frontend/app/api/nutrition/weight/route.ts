import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserId } from "@/lib/nutrition-auth";

/* ================================================================
   Weight Tracking API
   GET    /api/nutrition/weight              — list all entries
   GET    /api/nutrition/weight?days=30      — last N days
   POST   /api/nutrition/weight              — add entry
   DELETE /api/nutrition/weight?id=1         — remove entry
   ================================================================ */

export async function GET(req: NextRequest) {
  const uid = getUserId(req);
  if (uid === 0) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const days = parseInt(req.nextUrl.searchParams.get("days") || "90");

  try {
    // Ensure table exists
    await query(`
      CREATE TABLE IF NOT EXISTS weight_logs (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id),
        weight_kg  DECIMAL(5,1) NOT NULL,
        log_date   DATE NOT NULL DEFAULT CURRENT_DATE,
        notes      VARCHAR(200),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, log_date)
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_weight_logs_user_date ON weight_logs(user_id, log_date)`);

    const result = await query(
      `SELECT id, weight_kg, log_date, notes, created_at
       FROM weight_logs
       WHERE user_id = $1 AND log_date >= CURRENT_DATE - $2::integer
       ORDER BY log_date DESC, created_at DESC`,
      [uid, days]
    );

    // Calculate stats
    const entries = result.rows;
    let stats = null;
    if (entries.length >= 2) {
      const latest = parseFloat(entries[0].weight_kg);
      const first = parseFloat(entries[entries.length - 1].weight_kg);
      const change = parseFloat((latest - first).toFixed(1));
      const avg = parseFloat((entries.reduce((s: number, e: any) => s + parseFloat(e.weight_kg), 0) / entries.length).toFixed(1));
      stats = { latest, first, change, avg, count: entries.length };
    } else if (entries.length === 1) {
      stats = { latest: parseFloat(entries[0].weight_kg), count: 1 };
    }

    return NextResponse.json({ entries, stats });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const uid = getUserId(req);
  if (uid === 0) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  try {
    const body = await req.json();
    const { weight_kg, log_date, notes } = body;

    if (!weight_kg || weight_kg < 20 || weight_kg > 500) {
      return NextResponse.json({ error: "Valid weight_kg required (20-500)" }, { status: 400 });
    }

    const date = log_date || new Date().toISOString().slice(0, 10);

    await query(`
      CREATE TABLE IF NOT EXISTS weight_logs (
        id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
        weight_kg DECIMAL(5,1) NOT NULL, log_date DATE NOT NULL DEFAULT CURRENT_DATE,
        notes VARCHAR(200), created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Upsert: one entry per user per day (replace if already logged today)
    const result = await query(
      `INSERT INTO weight_logs (user_id, weight_kg, log_date, notes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, log_date) DO UPDATE SET
         weight_kg = EXCLUDED.weight_kg, notes = EXCLUDED.notes, created_at = NOW()
       RETURNING *`,
      [uid, weight_kg, date, notes || null]
    );

    // Auto-update profile weight
    if (date === new Date().toISOString().slice(0, 10)) {
      try {
        await query(
          `INSERT INTO user_profiles (user_id, weight_kg, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (user_id) DO UPDATE SET weight_kg = $2, updated_at = NOW()`,
          [uid, weight_kg]
        );
      } catch {}
    }

    return NextResponse.json({ entry: result.rows[0] });
  } catch (e: any) {
    // Handle missing unique constraint gracefully
    if (e.message?.includes("violates unique constraint") || e.code === "23505") {
      return NextResponse.json({ error: "Already logged weight today. Use DELETE first to re-log." }, { status: 409 });
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const uid = getUserId(req);
  if (uid === 0) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    await query(`DELETE FROM weight_logs WHERE id = $1 AND user_id = $2`, [id, uid]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
