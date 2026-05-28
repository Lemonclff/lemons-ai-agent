#!/usr/bin/env python3
"""Check database state for economic events."""
import json
import os
import sys
from pathlib import Path

_ENV_FILE = Path(__file__).resolve().parent.parent / "frontend" / ".env.local"
if _ENV_FILE.exists():
    with open(_ENV_FILE) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                if "#" in val:
                    ci = val.find(" #")
                    if ci < 0: ci = val.find("\t#")
                    if ci >= 0: val = val[:ci]
                val = val.strip()
                if key.strip() not in os.environ:
                    os.environ[key.strip()] = val

DB_URL = os.environ.get("DATABASE_URL", "")
if not DB_URL:
    print(json.dumps({"error": "no DATABASE_URL"}))
    sys.exit(1)

import psycopg2
conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

# Summary by flag
cur.execute("SELECT surprise_flag, COUNT(*) FROM macro_economic_events GROUP BY surprise_flag ORDER BY surprise_flag")
print("=== EVENT COUNTS BY FLAG ===")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]}")

# Recent events with analysis
cur.execute("""
    SELECT event_name, event_name_zh, surprise_flag, 
           actual_value, expected_value, deviation, 
           updated_at::timestamp AS updated_at
    FROM macro_economic_events 
    WHERE ai_impact_summary IS NOT NULL 
    ORDER BY updated_at DESC LIMIT 10
""")
print("\n=== AI ANALYZED EVENTS (latest 10) ===")
analyzed = cur.fetchall()
if analyzed:
    for row in analyzed:
        print(f"  {row[0]} | {row[2]} | actual={row[3]} expected={row[4]} dev={row[5]} | updated={row[6]}")
else:
    print("  (none)")

# Pending events
cur.execute("""
    SELECT event_name, event_name_zh, event_time::timestamp,
           surprise_flag
    FROM macro_economic_events
    WHERE surprise_flag = 'PENDING'
    ORDER BY event_time DESC LIMIT 5
""")
print("\n=== PENDING EVENTS (latest 5) ===")
pending = cur.fetchall()
if pending:
    for row in pending:
        print(f"  {row[0]} | event_time={row[2]} | flag={row[3]}")
else:
    print("  (none)")

# Events with actual_value but no AI (should be picked up by --analyze-all)
cur.execute("""
    SELECT event_name, event_name_zh, surprise_flag,
           actual_value, expected_value
    FROM macro_economic_events
    WHERE actual_value IS NOT NULL
      AND surprise_flag != 'PENDING'
      AND ai_impact_summary IS NULL
    LIMIT 10
""")
print("\n=== UNANALYZED RELEASED EVENTS ===")
unanalyzed = cur.fetchall()
if unanalyzed:
    for row in unanalyzed:
        print(f"  {row[0]} | {row[2]} | actual={row[3]} expected={row[4]}")
else:
    print("  (none)")

cur.close()
conn.close()
