"""Query macro database - show latest analyzed events."""
import json, os
import psycopg2

env_file = os.path.join(os.path.dirname(__file__), '..', 'frontend', '.env.local')
if os.path.exists(env_file):
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, _, val = line.partition('=')
                if key.strip() == 'DATABASE_URL':
                    os.environ['DATABASE_URL'] = val.strip()

DB_URL = os.environ.get('DATABASE_URL', '')
conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

# Latest analyzed events
cur.execute("""
    SELECT event_name, event_name_zh, surprise_flag,
           expected_value, actual_value, deviation, unit,
           ai_impact_summary, updated_at
    FROM macro_economic_events
    WHERE ai_impact_summary IS NOT NULL
    ORDER BY updated_at DESC
    LIMIT 10
""")
rows = cur.fetchall()
cols = [d[0] for d in cur.description]

print("=== LATEST ANALYZED EVENTS ===")
for r in rows:
    evt = dict(zip(cols, r))
    print(f"\n--- {evt['event_name_zh']} ({evt['event_name']})")
    print(f"    Flag: {evt['surprise_flag']} | Expected: {evt['expected_value']} | Actual: {evt['actual_value']} | Deviation: {evt['deviation']}")
    print(f"    Updated: {evt['updated_at']}")
    print(f"    Summary: {evt['ai_impact_summary'][:200] if evt['ai_impact_summary'] else 'N/A'}")

# Also check: any events with actual_value but no AI analysis
cur.execute("""
    SELECT event_name, event_name_zh, surprise_flag,
           expected_value, actual_value, deviation, updated_at
    FROM macro_economic_events
    WHERE actual_value IS NOT NULL
      AND surprise_flag != 'PENDING'
      AND ai_impact_summary IS NULL
    ORDER BY updated_at DESC
    LIMIT 10
""")
rows2 = cur.fetchall()
cols2 = [d[0] for d in cur.description]

print("\n=== EVENTS WITH ACTUAL BUT NO AI ANALYSIS ===")
for r in rows2:
    evt = dict(zip(cols2, r))
    print(f"  {evt['event_name_zh']} ({evt['event_name']}): {evt['surprise_flag']} | Actual: {evt['actual_value']} | Updated: {evt['updated_at']}")

cur.close()
conn.close()
