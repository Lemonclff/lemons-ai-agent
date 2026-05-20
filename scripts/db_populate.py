#!/usr/bin/env python3
"""DB Populate v3 — cursor-safe dual backend + stock_price_daily support."""

import json, sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))


def _get_cursor():
    """Return (conn, cur, actual_type) with proper PG cursor handling."""
    from db_connection import get_conn
    conn = get_conn()
    # Re-read DB_TYPE from module to avoid import-copy staleness
    from db_connection import DB_TYPE as actual_type
    if actual_type == "postgresql":
        cur = conn.cursor()
    else:
        cur = conn  # sqlite3: conn.execute() works directly
    return conn, cur, actual_type


def insert_options(data: list[dict]):
    conn, cur, db_type = _get_cursor()
    today = datetime.now().strftime("%Y-%m-%d")

    if db_type == "sqlite":
        ph = "?"
    else:
        ph = "%s"

    count = 0
    for d in data:
        ticker = d.get("ticker", "")
        if not ticker:
            continue

        iv_rank = d.get("iv_rank") or {}
        sparkline = json.dumps(d.get("sparkline")) if d.get("sparkline") else None
        earnings = d.get("earnings") or {}

        unusual_flag = 1 if d.get("unusual_activity") else 0
        if db_type == "postgresql":
            unusual_flag = bool(unusual_flag)

        vals = (
            ticker, today,
            d.get("implied_volatility"), d.get("historical_volatility"),
            d.get("put_call_ratio"), d.get("call_volume", 0),
            d.get("put_volume", 0), d.get("total_volume", 0),
            d.get("iv_hv_spread"), unusual_flag,
            iv_rank.get("percentile"), sparkline,
            earnings.get("days_until"), d.get("ai_alert"),
            d.get("_source", "yfinance"),
        )

        if db_type == "sqlite":
            cur.execute(f"""
                INSERT OR REPLACE INTO options_volatility_log
                    (ticker, trade_date, implied_volatility, historical_volatility,
                     put_call_ratio, call_volume, put_volume, total_options_volume,
                     iv_hv_spread, unusual_activity_flag, iv_rank_percentile,
                     sparkline_json, earnings_days_until, ai_risk_alert, data_source)
                VALUES ({ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph})
            """, vals)
        else:
            try:
                cur.execute(f"""
                    INSERT INTO options_volatility_log
                        (ticker, trade_date, implied_volatility, historical_volatility,
                         put_call_ratio, call_volume, put_volume, total_options_volume,
                         iv_hv_spread, unusual_activity_flag, iv_rank_percentile,
                         sparkline_json, earnings_days_until, ai_risk_alert, data_source)
                    VALUES ({ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph})
                    ON CONFLICT (ticker, trade_date) DO UPDATE SET
                        implied_volatility=EXCLUDED.implied_volatility,
                        historical_volatility=EXCLUDED.historical_volatility,
                        put_call_ratio=EXCLUDED.put_call_ratio,
                        call_volume=EXCLUDED.call_volume,
                        put_volume=EXCLUDED.put_volume,
                        total_options_volume=EXCLUDED.total_options_volume,
                        iv_hv_spread=EXCLUDED.iv_hv_spread,
                        unusual_activity_flag=EXCLUDED.unusual_activity_flag,
                        iv_rank_percentile=EXCLUDED.iv_rank_percentile,
                        sparkline_json=EXCLUDED.sparkline_json,
                        earnings_days_until=EXCLUDED.earnings_days_until,
                        ai_risk_alert=EXCLUDED.ai_risk_alert,
                        data_source=EXCLUDED.data_source,
                        updated_at=CURRENT_TIMESTAMP
                """, vals)
            except Exception as e:
                conn.rollback()
                print(f"[WARN] {ticker}: {e}")

        count += 1

    conn.commit()
    if db_type == "postgresql":
        cur.close()
    conn.close()
    print(f"[DB] Inserted/updated {count} ticker(s) for {today} ({db_type})")


def insert_macro(event: dict):
    conn, cur, db_type = _get_cursor()
    ph = "?" if db_type == "sqlite" else "%s"

    vals = (
        event.get("event_name"), event.get("event_time") or datetime.now().isoformat(),
        event.get("expected_value"), event.get("actual_value"),
        event.get("previous_value"), event.get("deviation"),
        event.get("surprise_flag"), event.get("ai_impact_tech"),
        event.get("ai_impact_financial"), event.get("ai_impact_broad"),
        event.get("ai_impact_summary"),
    )

    if db_type == "sqlite":
        cur.execute(f"""
            INSERT OR REPLACE INTO macro_economic_events
                (event_name, event_time, expected_value, actual_value, previous_value,
                 deviation, surprise_flag, ai_impact_tech, ai_impact_financial, ai_impact_broad, ai_impact_summary)
            VALUES ({ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph})
        """, vals)
    else:
        cur.execute(f"""
            INSERT INTO macro_economic_events
                (event_name, event_time, expected_value, actual_value, previous_value,
                 deviation, surprise_flag, ai_impact_tech, ai_impact_financial, ai_impact_broad, ai_impact_summary)
            VALUES ({ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph})
            ON CONFLICT (event_name, event_time) DO NOTHING
        """, vals)

    conn.commit()
    if db_type == "postgresql":
        cur.close()
    conn.close()
    print(f"[DB] Inserted macro event: {event.get('event_name')} ({db_type})")


def insert_prices(rows: list[dict]):
    """Insert daily OHLCV data into stock_price_daily.

    Each row: {ticker, trade_date, open, high, low, close, adj_close, volume, [data_source]}
    """
    conn, cur, db_type = _get_cursor()
    ph = "?" if db_type == "sqlite" else "%s"

    count = 0
    for r in rows:
        ticker = r.get("ticker", "")
        if not ticker:
            continue

        vals = (
            ticker,
            r.get("trade_date") or r.get("date"),
            r.get("open"), r.get("high"), r.get("low"),
            r.get("close"), r.get("adj_close") or r.get("close"),
            r.get("volume", 0),
            r.get("data_source", "yfinance"),
        )

        if db_type == "sqlite":
            cur.execute(f"""
                INSERT OR REPLACE INTO stock_price_daily
                    (ticker, trade_date, open, high, low, close, adj_close, volume, data_source)
                VALUES ({ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph})
            """, vals)
        else:
            try:
                cur.execute(f"""
                    INSERT INTO stock_price_daily
                        (ticker, trade_date, open, high, low, close, adj_close, volume, data_source)
                    VALUES ({ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph})
                    ON CONFLICT (ticker, trade_date) DO UPDATE SET
                        open=EXCLUDED.open, high=EXCLUDED.high, low=EXCLUDED.low,
                        close=EXCLUDED.close, adj_close=EXCLUDED.adj_close,
                        volume=EXCLUDED.volume
                """, vals)
            except Exception as e:
                conn.rollback()
                print(f"[WARN] {ticker} {r.get('trade_date', '?')}: {e}")
                continue

        count += 1

    conn.commit()
    if db_type == "postgresql":
        cur.close()
    conn.close()
    print(f"[DB] Inserted/updated {count} price row(s) ({db_type})")


if __name__ == "__main__":
    if "--macro" in sys.argv:
        idx = sys.argv.index("--macro")
        insert_macro(json.loads(sys.argv[idx + 1]) if idx + 1 < len(sys.argv) else {})
    elif "--prices" in sys.argv:
        # Pipe bulk price data via stdin: [{"ticker":"NVDA","trade_date":"2026-01-02",...},...]
        raw = sys.stdin.read().strip()
        if raw:
            insert_prices(json.loads(raw))
        else:
            print("[DB] No input (empty stdin)")
    else:
        raw = sys.stdin.read().strip()
        if raw:
            insert_options(json.loads(raw))
        else:
            print("[DB] No input (empty stdin)")
