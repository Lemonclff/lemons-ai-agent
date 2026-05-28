"""Query macro database for analyzed events in the last hour."""
import json, os, sys
from datetime import datetime, timedelta, timezone
import psycopg2

# Load DATABASE_URL from .env.local
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

# Check for events with AI analysis generated in last hour
cur.execute("""
    SELECT id, event_name, event_name_zh,
           event_time::timestamptz AS event_time,
           expected_value, actual_value, previous_value,
           deviation, surprise_flag, unit, importance,
           ai_impact_tech, ai_impact_financial, ai_impact_broad,
           ai_impact_energy, ai_impact_consumer, ai_impact_industrial,
           ai_impact_summary, capital_flow, volatility_outlook,
           updated_at
    FROM macro_economic_events
    WHERE ai_impact_summary IS NOT NULL
      AND updated_at >= NOW() - INTERVAL '1 hour'
    ORDER BY updated_at DESC
""")
rows = cur.fetchall()
cols = [d[0] for d in cur.description]
events = [dict(zip(cols, r)) for r in rows]

print(f"Analyzed events (last 1hr): {len(events)}")

# Also check all-time analyzed events
cur.execute("""
    SELECT COUNT(*) FROM macro_economic_events
    WHERE ai_impact_summary IS NOT NULL
""")
total_analyzed = cur.fetchone()[0]
print(f"All-time analyzed events: {total_analyzed}")

if events:
    print(json.dumps(events, ensure_ascii=False, indent=2, default=str))

cur.close()
conn.close()
