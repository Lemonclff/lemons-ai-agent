#!/usr/bin/env python3
"""DB Query Worker v3 — cursor-safe dual backend + stock_price_daily support."""
import json, sys, os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

sql = sys.argv[1] if len(sys.argv) > 1 else (
    "SELECT 'options_volatility_log' as tbl, COUNT(*) as n FROM options_volatility_log "
    "UNION ALL SELECT 'macro_economic_events', COUNT(*) FROM macro_economic_events "
    "UNION ALL SELECT 'tracked_tickers', COUNT(*) FROM tracked_tickers "
    "UNION ALL SELECT 'stock_price_daily', COUNT(*) FROM stock_price_daily"
)

try:
    from db_connection import get_conn
    conn = get_conn()
    from db_connection import DB_TYPE as actual_type

    if actual_type == "postgresql":
        cur = conn.cursor()
        cur.execute(sql)
        rows = [dict(zip([d[0] for d in cur.description], r)) for r in cur.fetchall()]
        cols = [d[0] for d in cur.description] if cur.description else []
        cur.close()
    else:
        cur = conn.execute(sql)
        rows = [dict(r) for r in cur.fetchall()]
        cols = [d[0] for d in cur.description] if cur.description else []

    conn.close()
    print(json.dumps({"columns": cols, "rows": rows, "db_type": actual_type}, default=str))
except Exception as e:
    print(json.dumps({"error": str(e)[:500]}))
