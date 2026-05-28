#!/usr/bin/env python3
"""Query macro_economic_events with AI analysis from last hour."""
import os, sys, json
from pathlib import Path

# Load .env — relative to this script's location in scripts/
SCRIPT_DIR = Path(__file__).resolve().parent
ENV_FILE = SCRIPT_DIR.parent / "frontend" / ".env.local"

if ENV_FILE.exists():
    with open(ENV_FILE) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, _, val = line.partition('=')
                if '#' in val:
                    ci = val.find(' #')
                    if ci < 0:
                        ci = val.find('\t#')
                    if ci >= 0:
                        val = val[:ci]
                val = val.strip()
                if key.strip() not in os.environ:
                    os.environ[key.strip()] = val

import psycopg2

conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()

cur.execute("""
    SELECT id, event_name, event_name_zh,
           event_time,
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
cols = [d[0] for d in cur.description]
rows = cur.fetchall()
events = [dict(zip(cols, r)) for r in rows]

# Also get any events that were recently analyzed regardless of time filter (broader)
cur.execute("""
    SELECT id, event_name, event_name_zh,
           event_time,
           expected_value, actual_value, previous_value,
           deviation, surprise_flag, unit, importance,
           ai_impact_tech, ai_impact_financial, ai_impact_broad,
           ai_impact_energy, ai_impact_consumer, ai_impact_industrial,
           ai_impact_summary, capital_flow, volatility_outlook,
           updated_at
    FROM macro_economic_events
    WHERE ai_impact_summary IS NOT NULL
    ORDER BY updated_at DESC
    LIMIT 5
""")
cols2 = [d[0] for d in cur.description]
rows2 = cur.fetchall()
recent_all = [dict(zip(cols2, r)) for r in rows2]

print("=== Events with AI analysis in last hour ===")
print(json.dumps(events, ensure_ascii=False, indent=2, default=str))
print("\n=== Most recent 5 with AI analysis (any time) ===")
print(json.dumps(recent_all, ensure_ascii=False, indent=2, default=str))

cur.close()
conn.close()
