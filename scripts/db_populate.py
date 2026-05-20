#!/usr/bin/env python3
"""
Lemon's AI Agent — DB Population Script
=========================================

Reads JSON from options_api.py (stdin) and inserts into the database.
Also supports macro economic event insertion.

Usage:
    echo '["NVDA","TSLA"]' | python options_api.py | python db_populate.py
    python db_populate.py --macro '{"event_name":"CPI","actual":3.1,...}'
"""

import json
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "lemons.db"


def insert_options(data: list[dict], db_path: Path = DB_PATH):
    """Insert options snapshots into options_volatility_log."""
    conn = sqlite3.connect(str(db_path))
    today = datetime.now().strftime("%Y-%m-%d")
    count = 0

    for d in data:
        ticker = d.get("ticker", "")
        if not ticker:
            continue

        iv_rank = d.get("iv_rank") or {}
        sparkline = json.dumps(d.get("sparkline")) if d.get("sparkline") else None
        earnings = d.get("earnings") or {}

        conn.execute("""
            INSERT OR REPLACE INTO options_volatility_log
                (ticker, trade_date, implied_volatility, historical_volatility,
                 put_call_ratio, call_volume, put_volume, total_options_volume,
                 iv_hv_spread, unusual_activity_flag, iv_rank_percentile,
                 sparkline_json, earnings_days_until, ai_risk_alert, data_source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            ticker, today,
            d.get("implied_volatility"),
            d.get("historical_volatility"),
            d.get("put_call_ratio"),
            d.get("call_volume", 0),
            d.get("put_volume", 0),
            d.get("total_volume", 0),
            d.get("iv_hv_spread"),
            1 if d.get("unusual_activity") else 0,
            iv_rank.get("percentile"),
            sparkline,
            earnings.get("days_until"),
            d.get("ai_alert"),
            d.get("_source", "yfinance"),
        ))
        count += 1

    conn.commit()
    conn.close()
    print(f"[DB] Inserted/updated {count} ticker(s) for {today}")


def insert_macro(event: dict, db_path: Path = DB_PATH):
    """Insert a single macro economic event."""
    conn = sqlite3.connect(str(db_path))
    conn.execute("""
        INSERT OR REPLACE INTO macro_economic_events
            (event_name, event_time, expected_value, actual_value,
             previous_value, deviation, surprise_flag,
             ai_impact_tech, ai_impact_financial, ai_impact_broad, ai_impact_summary)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        event.get("event_name"),
        event.get("event_time") or datetime.now().isoformat(),
        event.get("expected_value"),
        event.get("actual_value"),
        event.get("previous_value"),
        event.get("deviation"),
        event.get("surprise_flag"),
        event.get("ai_impact_tech"),
        event.get("ai_impact_financial"),
        event.get("ai_impact_broad"),
        event.get("ai_impact_summary"),
    ))
    conn.commit()
    conn.close()
    print(f"[DB] Inserted macro event: {event.get('event_name')}")


if __name__ == "__main__":
    # Parse --db and --macro flags
    args = sys.argv[1:]
    db_path = DB_PATH
    macro_event = None

    i = 0
    while i < len(args):
        if args[i] == "--db" and i + 1 < len(args):
            db_path = Path(args[i + 1])
            i += 2
        elif args[i] == "--macro" and i + 1 < len(args):
            macro_event = json.loads(args[i + 1])
            i += 2
        else:
            i += 1

    if macro_event:
        insert_macro(macro_event, db_path)
    else:
        raw = sys.stdin.read().strip()
        if raw:
            data = json.loads(raw)
            insert_options(data, db_path)
        else:
            print("[DB] No input data (empty stdin)")
