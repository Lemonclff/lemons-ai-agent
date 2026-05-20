#!/usr/bin/env python3
"""DB Populate v2 — uses db_connection.py for dual backend support."""

import json, sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from db_connection import get_conn, placeholder, DB_TYPE

def insert_options(data: list[dict]):
    conn = get_conn()
    today = datetime.now().strftime("%Y-%m-%d")
    ph = placeholder()
    count = 0

    for d in data:
        ticker = d.get("ticker", "")
        if not ticker: continue

        iv_rank = d.get("iv_rank") or {}
        sparkline = json.dumps(d.get("sparkline")) if d.get("sparkline") else None
        earnings = d.get("earnings") or {}

        vals = (
            ticker, today,
            d.get("implied_volatility"), d.get("historical_volatility"),
            d.get("put_call_ratio"), d.get("call_volume", 0),
            d.get("put_volume", 0), d.get("total_volume", 0),
            d.get("iv_hv_spread"), 1 if d.get("unusual_activity") else 0,
            iv_rank.get("percentile"), sparkline,
            earnings.get("days_until"), d.get("ai_alert"),
            d.get("_source", "yfinance"),
        )

        if DB_TYPE == "sqlite":
            conn.execute(f"""
                INSERT OR REPLACE INTO options_volatility_log
                    (ticker, trade_date, implied_volatility, historical_volatility,
                     put_call_ratio, call_volume, put_volume, total_options_volume,
                     iv_hv_spread, unusual_activity_flag, iv_rank_percentile,
                     sparkline_json, earnings_days_until, ai_risk_alert, data_source)
                VALUES ({ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph})
            """, vals)
        else:
            try:
                conn.execute(f"""
                    INSERT INTO options_volatility_log
                        (ticker, trade_date, implied_volatility, historical_volatility,
                         put_call_ratio, call_volume, put_volume, total_options_volume,
                         iv_hv_spread, unusual_activity_flag, iv_rank_percentile,
                         sparkline_json, earnings_days_until, ai_risk_alert, data_source)
                    VALUES ({ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph})
                    ON CONFLICT (ticker, trade_date) DO UPDATE SET
                        implied_volatility=EXCLUDED.implied_volatility,
                        iv_hv_spread=EXCLUDED.iv_hv_spread,
                        updated_at=CURRENT_TIMESTAMP
                """, vals)
            except Exception as e:
                print(f"[WARN] {ticker}: {e}")

        count += 1

    conn.commit()
    conn.close()
    print(f"[DB] Inserted/updated {count} ticker(s) for {today} ({DB_TYPE})")

def insert_macro(event: dict):
    conn = get_conn()
    ph = placeholder()
    vals = (
        event.get("event_name"), event.get("event_time") or datetime.now().isoformat(),
        event.get("expected_value"), event.get("actual_value"),
        event.get("previous_value"), event.get("deviation"),
        event.get("surprise_flag"), event.get("ai_impact_tech"),
        event.get("ai_impact_financial"), event.get("ai_impact_broad"),
        event.get("ai_impact_summary"),
    )
    if DB_TYPE == "sqlite":
        conn.execute(f"""
            INSERT OR REPLACE INTO macro_economic_events
                (event_name, event_time, expected_value, actual_value, previous_value,
                 deviation, surprise_flag, ai_impact_tech, ai_impact_financial, ai_impact_broad, ai_impact_summary)
            VALUES ({ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph})
        """, vals)
    else:
        conn.execute(f"""
            INSERT INTO macro_economic_events
                (event_name, event_time, expected_value, actual_value, previous_value,
                 deviation, surprise_flag, ai_impact_tech, ai_impact_financial, ai_impact_broad, ai_impact_summary)
            VALUES ({ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph})
            ON CONFLICT (event_name, event_time) DO NOTHING
        """, vals)
    conn.commit()
    conn.close()
    print(f"[DB] Inserted macro event: {event.get('event_name')} ({DB_TYPE})")

if __name__ == "__main__":
    if "--macro" in sys.argv:
        idx = sys.argv.index("--macro")
        insert_macro(json.loads(sys.argv[idx + 1]) if idx + 1 < len(sys.argv) else {})
    else:
        raw = sys.stdin.read().strip()
        if raw:
            insert_options(json.loads(raw))
        else:
            print("[DB] No input (empty stdin)")
