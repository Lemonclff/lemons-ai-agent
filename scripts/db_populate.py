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


def insert_options(data: list[dict]):
    """Insert options snapshots into options_volatility_log."""
    conn = sqlite3.connect(str(DB_PATH))
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


def insert_macro(event: dict):
    """Insert a single macro economic event."""
    conn = sqlite3.connect(str(DB_PATH))
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
    if "--macro" in sys.argv:
        idx = sys.argv.index("--macro")
        event = json.loads(sys.argv[idx + 1]) if idx + 1 < len(sys.argv) else {}
        insert_macro(event)
    else:
        raw = sys.stdin.read().strip()
        if raw:
            data = json.loads(raw)
            insert_options(data)
        else:
            print("[DB] No input data (empty stdin)")
