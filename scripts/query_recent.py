#!/usr/bin/env python3
"""Query macro_economic_events for recent AI analyses"""
import os, sys, json
from pathlib import Path
from datetime import datetime, timezone, timedelta

_ENV_FILE = Path(__file__).resolve().parent.parent / "frontend" / ".env.local"
if _ENV_FILE.exists():
    with open(_ENV_FILE) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                if key.strip() == "DATABASE_URL":
                    os.environ["DATABASE_URL"] = val.strip()
                    break

import psycopg2
from psycopg2.extras import RealDictCursor

conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur = conn.cursor(cursor_factory=RealDictCursor)

one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)

# Find events with AI analysis in the last hour
cur.execute("""
    SELECT * FROM macro_economic_events 
    WHERE ai_impact_summary IS NOT NULL 
      AND ai_impact_summary != ''
      AND updated_at >= %s
    ORDER BY updated_at DESC
""", (one_hour_ago,))
rows = cur.fetchall()

print(f"Found {len(rows)} events with AI analysis in the last hour")
for r in rows:
    print(json.dumps(r, default=str, ensure_ascii=False, indent=2))

# Also check: any events AT ALL in the last hour (for debugging)
cur.execute("""
    SELECT id, event_name, event_name_zh, event_time, expected_value, actual_value, surprise_flag, 
           ai_impact_summary, updated_at, deviation, importance
    FROM macro_economic_events 
    WHERE updated_at >= %s
    ORDER BY updated_at DESC
""", (one_hour_ago,))
all_rows = cur.fetchall()
print(f"\nAll events updated in last hour: {len(all_rows)}")
for r in all_rows:
    print(json.dumps(r, default=str, ensure_ascii=False))

# Check most recent events regardless of time
cur.execute("""
    SELECT id, event_name, event_name_zh, event_time, expected_value, actual_value, 
           surprise_flag, ai_impact_summary, updated_at, deviation, importance
    FROM macro_economic_events 
    ORDER BY updated_at DESC
    LIMIT 10
""")
recent = cur.fetchall()
print(f"\n10 most recently updated events:")
for r in recent:
    print(json.dumps(r, default=str, ensure_ascii=False))

cur.close()
conn.close()
