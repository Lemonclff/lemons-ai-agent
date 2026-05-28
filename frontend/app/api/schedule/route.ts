/**
 * Schedule API Routes
 *
 * POST /api/schedule/solve    → run solver
 * GET  /api/schedule/roster   → query assignments
 * GET  /api/schedule/staff    → list staff
 * POST /api/schedule/assign   → manual assign / lock / unlock
 * GET  /api/schedule/stats    → coverage stats
 */

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { verifyToken } from "@/lib/auth";
import { PYTHON_BIN, scriptPath, spawnPythonEnv } from "@/lib/config";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const SCRIPT = scriptPath("schedule_solver.py");

function runPython(args: string[]): Promise<unknown> {
  return new Promise((resolve) => {
    const proc = spawn(PYTHON_BIN, [SCRIPT, ...args], {
      timeout: 60000,
      env: spawnPythonEnv(),
    });
    let out = "", errOut = "";
    proc.stdout?.on("data", (d: Buffer) => { out += d.toString(); });
    proc.stderr?.on("data", (d: Buffer) => { errOut += d.toString(); });
    proc.on("close", () => {
      try { resolve(JSON.parse(out)); }
      catch { resolve({ error: "Parse error", raw: out.slice(0, 300), stderr: errOut.slice(0, 200) }); }
    });
    proc.on("error", (e: Error) => resolve({ error: e.message }));
  });
}

function getAuth(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  return payload ? { userId: payload.userId || 1, isAdmin: !!payload.isAdmin } : null;
}

// ── GET ──
export async function GET(req: NextRequest) {
  const auth = getAuth(req);
  if (!auth) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sub = searchParams.get("sub") || "roster";

  const client = await pool.connect();
  try {
    if (sub === "staff") {
      const r = await client.query(
        "SELECT id, name, name_en, role, home_unit, can_work_units, skill_tags, is_active FROM schedule_staff ORDER BY home_unit, role, id"
      );
      return NextResponse.json(r.rows);
    }

    if (sub === "roster") {
      const start = searchParams.get("start") || new Date().toISOString().slice(0, 7) + "-01";
      const end = searchParams.get("end") || new Date().toISOString().slice(0, 10);
      const r = await client.query(
        `SELECT sa.id, sa.staff_id, s.name as staff_name, s.role, s.home_unit,
                sa.shift_date::text as shift_date, st.code as shift_code, st.label as shift_label, st.color,
                sa.unit, sa.status, sa.locked, sa.notes
         FROM schedule_assignments sa
         JOIN schedule_staff s ON sa.staff_id = s.id
         JOIN schedule_shift_types st ON sa.shift_type_id = st.id
         WHERE sa.shift_date >= $1 AND sa.shift_date <= $2
         ORDER BY sa.shift_date, sa.unit, s.role`,
        [start, end]
      );
      return NextResponse.json(r.rows);
    }

    if (sub === "stats") {
      const start = searchParams.get("start") || new Date().toISOString().slice(0, 7) + "-01";
      const end = searchParams.get("end") || new Date().toISOString().slice(0, 10);
      const r = await client.query(
        `SELECT sa.unit, st.code as shift_code, COUNT(*)::int as count
         FROM schedule_assignments sa
         JOIN schedule_shift_types st ON sa.shift_type_id = st.id
         WHERE sa.shift_date >= $1 AND sa.shift_date <= $2
         GROUP BY sa.unit, st.code ORDER BY sa.unit, st.code`,
        [start, end]
      );
      const r2 = await client.query(
        "SELECT id, name, start_date, end_date, leave_type FROM schedule_leave WHERE end_date >= $1 AND start_date <= $2",
        [start, end]
      );
      return NextResponse.json({ coverage: r.rows, leave: r2.rows });
    }

    if (sub === "leave") {
      const r = await client.query(
        "SELECT sl.id, sl.staff_id, s.name as staff_name, sl.start_date, sl.end_date, sl.leave_type, sl.notes FROM schedule_leave sl JOIN schedule_staff s ON sl.staff_id = s.id ORDER BY sl.start_date DESC LIMIT 100"
      );
      return NextResponse.json(r.rows);
    }

    if (sub === "roles") {
      const r = await client.query("SELECT * FROM schedule_roles ORDER BY sort_order");
      return NextResponse.json(r.rows);
    }

    if (sub === "units") {
      const r = await client.query("SELECT * FROM schedule_units WHERE is_active=true ORDER BY sort_order");
      return NextResponse.json(r.rows);
    }

    if (sub === "config") {
      const r = await client.query("SELECT config_key, config_json FROM schedule_config WHERE config_key='default'");
      return NextResponse.json(r.rows[0] || {});
    }

    return NextResponse.json({ error: "Unknown sub-action" }, { status: 400 });
  } finally {
    client.release();
  }
}

// ── POST ──
export async function POST(req: NextRequest) {
  const auth = getAuth(req);
  if (!auth) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const body = await req.json();
  const action = body.action || "solve";

  // ── SOLVE ──
  if (action === "solve") {
    const start = body.start_date;
    const end = body.end_date;
    if (!start || !end) return NextResponse.json({ error: "Missing start_date/end_date" }, { status: 400 });

    const args = ["solve", "--start", start, "--end", end];
    if (body.config) args.push("--config", body.config);

    const result = await runPython(args) as any;
    if (result.error) return NextResponse.json(result, { status: 500 });

    // Save assignments to DB
    if (result.status === "OPTIMAL" || result.status === "FEASIBLE") {
      const client = await pool.connect();
      try {
        // Clear non-locked assignments in this date range
        await client.query(
          "DELETE FROM schedule_assignments WHERE shift_date >= $1 AND shift_date <= $2 AND locked = false",
          [start, end]
        );

        // Insert new assignments
        for (const a of result.assignments) {
          const shiftId = await getShiftTypeId(client, a.shift_code);
          if (shiftId) {
            await client.query(
              `INSERT INTO schedule_assignments (staff_id, shift_date, shift_type_id, unit, status, locked, created_by)
               VALUES ($1, $2, $3, $4, 'scheduled', false, 'solver')
               ON CONFLICT (staff_id, shift_date) DO UPDATE SET shift_type_id=$3, unit=$4, status='scheduled'`,
              [a.staff_id, a.date, shiftId, a.unit]
            );
          }
        }
      } finally {
        client.release();
      }
    }

    return NextResponse.json(result);
  }

  // ── ASSIGN (manual) ──
  if (action === "assign") {
    const { staff_id, date, shift_code, unit, locked } = body;
    if (!staff_id || !date || !shift_code || !unit) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const shiftId = await getShiftTypeId(client, shift_code);
      if (!shiftId) return NextResponse.json({ error: `Unknown shift: ${shift_code}` }, { status: 400 });

      await client.query(
        `INSERT INTO schedule_assignments (staff_id, shift_date, shift_type_id, unit, status, locked, created_by, notes)
         VALUES ($1, $2, $3, $4, 'scheduled', $5, 'manual', $6)
         ON CONFLICT (staff_id, shift_date)
         DO UPDATE SET shift_type_id=$3, unit=$4, locked=$5, notes=$6, created_by='manual'`,
        [staff_id, date, shiftId, unit, locked || false, body.notes || null]
      );

      return NextResponse.json({ success: true });
    } finally {
      client.release();
    }
  }

  // ── DELETE assignment ──
  if (action === "delete") {
    const id = body.id;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const client = await pool.connect();
    try {
      await client.query("DELETE FROM schedule_assignments WHERE id=$1", [id]);
      return NextResponse.json({ success: true });
    } finally {
      client.release();
    }
  }

  // ── LEAVE ──
  if (action === "leave") {
    const { staff_id, start_date, end_date, leave_type, notes } = body;
    if (!staff_id || !start_date || !end_date) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      if (body.delete_id) {
        await client.query("DELETE FROM schedule_leave WHERE id=$1", [body.delete_id]);
      } else {
        await client.query(
          "INSERT INTO schedule_leave (staff_id, start_date, end_date, leave_type, notes) VALUES ($1,$2,$3,$4,$5)",
          [staff_id, start_date, end_date, leave_type || "annual", notes || null]
        );
      }
      return NextResponse.json({ success: true });
    } finally {
      client.release();
    }
  }

  // ── STAFF CRUD ──
  if (action === "staff_add") {
    const { name, name_en, role, home_unit, can_work_units, skill_tags } = body;
    if (!name || !role || !home_unit) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    const client = await pool.connect();
    try {
      const r = await client.query(
        `INSERT INTO schedule_staff (name, name_en, role, home_unit, can_work_units, skill_tags)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [name, name_en || null, role, home_unit, can_work_units || [home_unit], skill_tags || []]
      );
      return NextResponse.json({ success: true, id: r.rows[0].id });
    } finally { client.release(); }
  }

  if (action === "staff_update") {
    const { id, name, name_en, role, home_unit, can_work_units, skill_tags, is_active } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE schedule_staff SET name=COALESCE($2,name), name_en=COALESCE($3,name_en),
         role=COALESCE($4,role), home_unit=COALESCE($5,home_unit),
         can_work_units=COALESCE($6,can_work_units), skill_tags=COALESCE($7,skill_tags),
         is_active=COALESCE($8,is_active) WHERE id=$1`,
        [id, name || null, name_en || null, role || null, home_unit || null,
         can_work_units || null, skill_tags || null, is_active ?? null]
      );
      return NextResponse.json({ success: true });
    } finally { client.release(); }
  }

  if (action === "staff_delete") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const client = await pool.connect();
    try {
      await client.query("DELETE FROM schedule_assignments WHERE staff_id=$1", [id]);
      await client.query("DELETE FROM schedule_leave WHERE staff_id=$1", [id]);
      await client.query("DELETE FROM schedule_staff WHERE id=$1", [id]);
      return NextResponse.json({ success: true });
    } finally { client.release(); }
  }

  // ── ROLE/UNIT MANAGEMENT ──
  if (action === "role_save") {
    const { id, name, code, color } = body;
    if (!name || !code) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    const client = await pool.connect();
    try {
      if (id) {
        await client.query("UPDATE schedule_roles SET name=$2, code=$3, color=$4 WHERE id=$1", [id, name, code, color || '#6366f1']);
      } else {
        await client.query("INSERT INTO schedule_roles (name,code,color) VALUES ($1,$2,$3) ON CONFLICT (code) DO UPDATE SET name=$1,color=$3",
          [name, code, color || '#6366f1']);
      }
      return NextResponse.json({ success: true });
    } finally { client.release(); }
  }
  if (action === "role_delete") {
    if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const client = await pool.connect();
    try {
      await client.query("DELETE FROM schedule_roles WHERE id=$1", [body.id]);
      return NextResponse.json({ success: true });
    } finally { client.release(); }
  }
  if (action === "unit_save") {
    const { id, name, code, color } = body;
    if (!name || !code) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    const client = await pool.connect();
    try {
      if (id) {
        await client.query("UPDATE schedule_units SET name=$2, code=$3, color=$4 WHERE id=$1", [id, name, code, color || '#22c55e']);
      } else {
        await client.query("INSERT INTO schedule_units (name,code,color) VALUES ($1,$2,$3) ON CONFLICT (code) DO UPDATE SET name=$1,color=$3",
          [name, code, color || '#22c55e']);
      }
      return NextResponse.json({ success: true });
    } finally { client.release(); }
  }
  if (action === "unit_delete") {
    if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const client = await pool.connect();
    try {
      await client.query("UPDATE schedule_units SET is_active=false WHERE id=$1", [body.id]);
      return NextResponse.json({ success: true });
    } finally { client.release(); }
  }

  // ── LEAVE CRUD ──
  if (action === "leave_save") {
    const { id, staff_id, start_date, end_date, leave_type, notes } = body;
    if (!staff_id || !start_date || !end_date) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    const client = await pool.connect();
    try {
      if (id) {
        await client.query("UPDATE schedule_leave SET staff_id=$2,start_date=$3,end_date=$4,leave_type=$5,notes=$6 WHERE id=$1",
          [id, staff_id, start_date, end_date, leave_type||"annual", notes||null]);
      } else {
        await client.query("INSERT INTO schedule_leave (staff_id,start_date,end_date,leave_type,notes) VALUES ($1,$2,$3,$4,$5)",
          [staff_id, start_date, end_date, leave_type||"annual", notes||null]);
      }
      return NextResponse.json({ success: true });
    } finally { client.release(); }
  }
  if (action === "leave_delete") {
    if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const client = await pool.connect();
    try { await client.query("DELETE FROM schedule_leave WHERE id=$1",[body.id]); return NextResponse.json({success:true}); }
    finally { client.release(); }
  }

  // ── SHIFT TYPE CRUD ──
  if (action === "shift_save") {
    const { id, code, label, start_time, end_time, duration_h, category, color } = body;
    if (!code || !label) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    const client = await pool.connect();
    try {
      if (id) {
        await client.query(`UPDATE schedule_shift_types SET code=$2,label=$3,start_time=$4,end_time=$5,duration_h=$6,category=$7,color=$8 WHERE id=$1`,
          [id,code,label,start_time||'07:00',end_time||'16:00',duration_h||9,category||'day',color||'#22c55e']);
      } else {
        await client.query(`INSERT INTO schedule_shift_types (code,label,start_time,end_time,duration_h,category,color) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(code) DO UPDATE SET label=$2,color=$7`,
          [code,label,start_time||'07:00',end_time||'16:00',duration_h||9,category||'day',color||'#22c55e']);
      }
      return NextResponse.json({ success: true });
    } finally { client.release(); }
  }
  if (action === "shift_delete") {
    if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const client = await pool.connect();
    try { await client.query("DELETE FROM schedule_shift_types WHERE id=$1",[body.id]); return NextResponse.json({success:true}); }
    finally { client.release(); }
  }

  // ── COPY ROSTER ──
  if (action === "copy_roster") {
    const { from_start, from_end, to_start } = body;
    if (!from_start||!to_start) return NextResponse.json({ error: "Missing dates" }, { status: 400 });
    const client = await pool.connect();
    try {
      const fromD=new Date(from_start), toD=new Date(to_start);
      const offset = Math.round((toD.getTime()-fromD.getTime())/(86400000));
      await client.query(
        `INSERT INTO schedule_assignments (staff_id, shift_date, shift_type_id, unit, status, locked, created_by)
         SELECT staff_id, shift_date + $1, shift_type_id, unit, 'scheduled', false, 'copy'
         FROM schedule_assignments WHERE shift_date >= $2 AND shift_date <= $3
         ON CONFLICT (staff_id, shift_date) DO NOTHING`,
        [offset, from_start, from_end||from_start]);
      return NextResponse.json({ success: true });
    } finally { client.release(); }
  }

  // ── COVERAGE RULES ──
  if (action === "coverage_save") {
    const { unit, shift_type_id, min_total } = body;
    if (!unit||!shift_type_id) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    const client = await pool.connect();
    try {
      await client.query("DELETE FROM schedule_coverage_rules WHERE unit=$1 AND shift_type_id=$2",[unit,shift_type_id]);
      await client.query("INSERT INTO schedule_coverage_rules (unit,shift_type_id,min_total) VALUES ($1,$2,$3)",[unit,shift_type_id,min_total||1]);
      return NextResponse.json({ success: true });
    } finally { client.release(); }
  }

  // ── CONFIG SAVE ──
  if (action === "config_save") {
    const { config_json } = body;
    if (!config_json) return NextResponse.json({ error: "Missing config_json" }, { status: 400 });
    const client = await pool.connect();
    try {
      await client.query("UPDATE schedule_config SET config_json=$1 WHERE config_key='default'", [JSON.stringify(config_json)]);
      return NextResponse.json({ success: true });
    } finally { client.release(); }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

async function getShiftTypeId(client: any, code: string): Promise<number | null> {
  const r = await client.query("SELECT id FROM schedule_shift_types WHERE code=$1", [code]);
  return r.rows.length > 0 ? r.rows[0].id : null;
}
