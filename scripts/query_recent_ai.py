#!/usr/bin/env python3
"""Query events with AI analysis generated in the last hour."""
import json
import os
import sys
from pathlib import Path

# Load .env
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
    print(json.dumps([]))
    sys.exit(0)

import psycopg2

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

# Query events with AI analysis updated in last hour
cur.execute(
    """
    SELECT id, event_name, event_name_zh,
           event_time::timestamptz AS event_time,
           expected_value, actual_value, previous_value,
           deviation, surprise_flag, unit, importance,
           ai_impact_tech, ai_impact_financial, ai_impact_broad,
           ai_impact_energy, ai_impact_consumer, ai_impact_industrial,
           ai_impact_summary, capital_flow, volatility_outlook,
           updated_at::timestamptz AS updated_at,
           created_at::timestamptz AS created_at
    FROM macro_economic_events
    WHERE ai_impact_summary IS NOT NULL
      AND updated_at >= NOW() - INTERVAL '1 hour'
    ORDER BY event_time DESC
"""
)
cols = [d[0] for d in cur.description]
rows = cur.fetchall()
cur.close()
conn.close()

events = [dict(zip(cols, r)) for r in rows]
for e in events:
    for k, v in e.items():
        if hasattr(v, "isoformat"):
            e[k] = v.isoformat()
        elif isinstance(v, float):
            e[k] = v
        elif isinstance(v, int):
            e[k] = v

print(json.dumps(events, ensure_ascii=False, indent=2, default=str))
