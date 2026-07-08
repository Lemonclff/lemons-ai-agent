#!/usr/bin/env python3
"""Query macro_economic_events for recent AI-analyzed events."""
import sys, json, decimal
from pathlib import Path

# Set up path so we can import from scripts/
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from economic_calendar import get_conn, ensure_table

ensure_table()
conn = get_conn()
cur = conn.cursor()
cur.execute("""
    SELECT id, event_name, event_name_zh, event_time,
           expected_value, actual_value, previous_value,
           deviation, surprise_flag, unit, importance,
           ai_impact_summary, ai_impact_tech, ai_impact_financial,
           ai_impact_broad, ai_impact_energy, ai_impact_consumer,
           ai_impact_industrial, capital_flow, volatility_outlook,
           updated_at
    FROM macro_economic_events
    WHERE ai_impact_summary IS NOT NULL
      AND updated_at >= NOW() - INTERVAL '1 hour'
    ORDER BY updated_at DESC
""")
cols = [d[0] for d in cur.description]
rows = cur.fetchall()
events = [dict(zip(cols, r)) for r in rows]

for e in events:
    for k, v in e.items():
        if hasattr(v, "isoformat"):
            e[k] = v.isoformat()
        elif isinstance(v, decimal.Decimal):
            e[k] = float(v)

print(json.dumps(events, ensure_ascii=False, indent=2))
cur.close()
conn.close()
