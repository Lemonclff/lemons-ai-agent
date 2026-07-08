#!/usr/bin/env python3
"""Query all events from macro_economic_events for diagnostics."""
import sys, json, decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from economic_calendar import get_conn, ensure_table

ensure_table()
conn = get_conn()
cur = conn.cursor()

# All events count
cur.execute("SELECT COUNT(*) FROM macro_economic_events")
total = cur.fetchone()[0]

# Events with AI analysis
cur.execute("SELECT COUNT(*) FROM macro_economic_events WHERE ai_impact_summary IS NOT NULL")
ai_total = cur.fetchone()[0]

# Events with actual data
cur.execute("SELECT COUNT(*) FROM macro_economic_events WHERE actual_value IS NOT NULL")
with_data = cur.fetchone()[0]

# Events by surprise_flag
cur.execute("SELECT surprise_flag, COUNT(*) FROM macro_economic_events GROUP BY surprise_flag")
flags = cur.fetchall()

# Recent events (last 7 days)
cur.execute("""
    SELECT id, event_name, event_name_zh, event_time,
           expected_value, actual_value, deviation,
           surprise_flag, importance,
           CASE WHEN ai_impact_summary IS NOT NULL THEN 'YES' ELSE 'NO' END as has_ai,
           updated_at
    FROM macro_economic_events
    WHERE event_time::timestamptz >= NOW() - INTERVAL '7 days'
    ORDER BY event_time::timestamptz DESC
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

print(f"Total events: {total}")
print(f"Events with AI analysis: {ai_total}")
print(f"Events with actual data: {with_data}")
print(f"Flags: {flags}")
print(f"\nRecent events ({len(events)}):")
print(json.dumps(events, ensure_ascii=False, indent=2))

cur.close()
conn.close()
