#!/usr/bin/env python3
"""DB Query Worker v2 — uses db_connection.py for dual backend support."""
import json, sys, os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from db_connection import get_conn

sql = sys.argv[1] if len(sys.argv) > 1 else (
    "SELECT 'options_volatility_log' as tbl, COUNT(*) as n FROM options_volatility_log "
    "UNION ALL SELECT 'macro_economic_events', COUNT(*) FROM macro_economic_events "
    "UNION ALL SELECT 'tracked_tickers', COUNT(*) FROM tracked_tickers"
)

try:
    conn = get_conn()
    cur = conn.execute(sql)
    rows = [dict(r) for r in cur.fetchall()]
    cols = [d[0] for d in cur.description] if cur.description else []
    conn.close()
    print(json.dumps({"columns": cols, "rows": rows, "db_type": os.environ.get("DATABASE_URL", "sqlite")[:30]}, default=str))
except Exception as e:
    print(json.dumps({"error": str(e)[:500]}))
