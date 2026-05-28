"""Load demo schedule into DB for roster page testing."""
import psycopg2, json

DB_URL = "postgresql://admin:Lemonclf0428!@localhost:5432/ai_dashboard_db"

# Load solver output
with open('/tmp/schedule_demo.json') as f:
    result = json.load(f)

if result['status'] not in ('OPTIMAL', 'FEASIBLE'):
    print(f"ERROR: Solver status is {result['status']}")
    exit(1)

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

# Clear existing non-locked assignments for July 2026
cur.execute("DELETE FROM schedule_assignments WHERE shift_date >= '2026-07-01' AND shift_date <= '2026-07-31' AND locked = false")

# Insert assignments
count = 0
for a in result['assignments']:
    # Get shift type id
    cur.execute("SELECT id FROM schedule_shift_types WHERE code = %s", (a['shift_code'],))
    row = cur.fetchone()
    if not row:
        continue
    shift_id = row[0]

    cur.execute(
        """INSERT INTO schedule_assignments (staff_id, shift_date, shift_type_id, unit, status, locked, created_by)
           VALUES (%s, %s, %s, %s, 'scheduled', false, 'demo')
           ON CONFLICT (staff_id, shift_date) DO UPDATE
           SET shift_type_id = %s, unit = %s, status = 'scheduled', locked = false""",
        (a['staff_id'], a['date'], shift_id, a['unit'],
         shift_id, a['unit'])
    )
    count += 1

conn.commit()

# Verify
cur.execute("SELECT count(*) FROM schedule_assignments WHERE shift_date >= '2026-07-01' AND shift_date <= '2026-07-31'")
total = cur.fetchone()[0]
cur.execute("SELECT count(DISTINCT shift_date) FROM schedule_assignments WHERE shift_date >= '2026-07-01' AND shift_date <= '2026-07-31'")
days = cur.fetchone()[0]

conn.close()

print(f"""
✅ Demo loaded!
   Assignments: {count} shifts across {days} days
   Status: {result['status']}
   Penalty: {result['stats']['objective_value']}
   Solver time: {result['stats']['solve_time_ms']}ms

📋 人手要求: 每家社每日 1 日更 + 1 夜更 = 10 shifts/day
🏖 請假: 陳主任 7/10-12 · 何姑娘 7/15-16 · 周主任 7/20-22
⚙️ 約束: AS避免夜更(150) + 公平週末(50) + 避免連續夜更(100) + ABC group(200)

🔗 去 https://dashboard.lemonffing.com/roster 查看
   → 月份揀到 2026年7月
   → 即可見到完整排更表
""")
