"""Load solver result into DB"""
import json, psycopg2

with open('/tmp/sched.json') as f:
    result = json.load(f)

print(f"Status: {result['status']} | Shifts: {result['stats']['total_shifts']}")

conn = psycopg2.connect('postgresql://admin:Lemonclf0428!@localhost:5432/ai_dashboard_db')
cur = conn.cursor()

for a in result['assignments']:
    cur.execute("SELECT id FROM schedule_shift_types WHERE code=%s", (a['shift_code'],))
    row = cur.fetchone()
    if row:
        cur.execute(
            "INSERT INTO schedule_assignments (staff_id,shift_date,shift_type_id,unit,status,locked,created_by) VALUES (%s,%s,%s,%s,'scheduled',false,'solver') ON CONFLICT(staff_id,shift_date) DO UPDATE SET shift_type_id=%s,unit=%s",
            (a['staff_id'], a['date'], row[0], a['unit'], row[0], a['unit'])
        )

conn.commit()
cur.execute("SELECT count(*) FROM schedule_assignments WHERE shift_date >= '2026-07-01' AND shift_date <= '2026-07-31'")
print(f"Loaded {cur.fetchone()[0]} assignments into DB")
conn.close()
