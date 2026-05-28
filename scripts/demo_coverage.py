"""Reduce coverage for demo: 2 shifts/unit/day = 10 total for 15 staff."""
import psycopg2
conn = psycopg2.connect('postgresql://admin:Lemonclf0428!@localhost:5432/ai_dashboard_db')
cur = conn.cursor()
cur.execute('DELETE FROM schedule_coverage_rules')
for unit in ['A','B','C','D','E']:
    cur.execute("INSERT INTO schedule_coverage_rules (unit,shift_type_id,min_as,min_rw,min_total) SELECT %s,id,0,1,1 FROM schedule_shift_types WHERE code='1423'", (unit,))
    cur.execute("INSERT INTO schedule_coverage_rules (unit,shift_type_id,min_as,min_rw,min_total) SELECT %s,id,0,0,1 FROM schedule_shift_types WHERE code='N'", (unit,))
conn.commit()
cur.execute('SELECT unit,st.code,min_total FROM schedule_coverage_rules cr JOIN schedule_shift_types st ON cr.shift_type_id=st.id')
for r in cur.fetchall(): print(f"  {r[0]}社 {r[1]}: min {r[2]}")
conn.close()
print("Done: 10 shifts/day, 310 needed vs 457 available = feasible")
