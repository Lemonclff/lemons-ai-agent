"""Migrate: add schedule_roles + schedule_units tables."""
import psycopg2
DB_URL = "postgresql://admin:Lemonclf0428!@localhost:5432/ai_dashboard_db"

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()
with open('/home/lemon/lemons-ai-agent/db/schedule_roles_units.sql') as f:
    cur.execute(f.read())
conn.commit()

cur.execute("SELECT * FROM schedule_roles ORDER BY sort_order")
print("Roles:", [f"{r[1]}({r[2]})" for r in cur.fetchall()])
cur.execute("SELECT * FROM schedule_units ORDER BY sort_order")
print("Units:", [f"{r[1]}({r[2]})" for r in cur.fetchall()])
conn.close()
print("Migration OK")
