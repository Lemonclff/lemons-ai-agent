#!/usr/bin/env python3
"""DB query worker — called by Next.js API route. Outputs JSON to stdout."""
import json, sqlite3, sys, os
from pathlib import Path

DB = Path(os.environ.get("LEMONS_DB", Path(__file__).resolve().parent.parent.parent / "data" / "lemons.db"))
sql = sys.argv[1] if len(sys.argv) > 1 else "SELECT 'options_volatility_log' as tbl, COUNT(*) as n FROM options_volatility_log UNION ALL SELECT 'macro_economic_events', COUNT(*) FROM macro_economic_events UNION ALL SELECT 'tracked_tickers', COUNT(*) FROM tracked_tickers"

try:
    conn = sqlite3.connect(str(DB))
    conn.row_factory = sqlite3.Row
    cur = conn.execute(sql)
    rows = [dict(r) for r in cur.fetchall()]
    cols = [d[0] for d in cur.description] if cur.description else []
    conn.close()
    print(json.dumps({"columns": cols, "rows": rows, "db": str(DB)}, default=str))
except Exception as e:
    print(json.dumps({"error": str(e)[:500]}))
