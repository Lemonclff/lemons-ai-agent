"""Fix schedule coverage rules to realistic levels."""
import psycopg2
DB_URL = "postgresql://admin:Lemonclf0428!@localhost:5432/ai_dashboard_db"

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

# Clear old rules
cur.execute("DELETE FROM schedule_coverage_rules")

# Day shift (1423): 2 people per unit, at least 1 RW
for unit in ['A','B','C','D','E']:
    cur.execute(
        "INSERT INTO schedule_coverage_rules (unit, shift_type_id, min_as, min_rw, min_total) "
        "SELECT %s, id, 0, 1, 2 FROM schedule_shift_types WHERE code='1423'",
        (unit,))

# Night shift: 1 person per unit
for unit in ['A','B','C','D','E']:
    cur.execute(
        "INSERT INTO schedule_coverage_rules (unit, shift_type_id, min_as, min_rw, min_total) "
        "SELECT %s, id, 0, 0, 1 FROM schedule_shift_types WHERE code='N'",
        (unit,))

conn.commit()
cur.execute("SELECT unit, st.code, min_as, min_rw, min_total FROM schedule_coverage_rules cr JOIN schedule_shift_types st ON cr.shift_type_id=st.id ORDER BY unit, st.code")
for r in cur.fetchall():
    print(f"  {r[0]}社 {r[1]}: AS≥{r[2]} RW≥{r[3]} Total≥{r[4]}")

conn.close()
print("Coverage rules updated: 15 shifts/day for 15 staff")
