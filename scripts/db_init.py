#!/usr/bin/env python3
"""
Lemon's AI Agent — Database Initializer v2
============================================

Supports BOTH SQLite and PostgreSQL via db_connection.py.
Auto-detects backend from DATABASE_URL env var.

Usage:
    # SQLite (default)
    python3 db_init.py
    python3 db_init.py --seed

    # PostgreSQL (set env var first)
    export DATABASE_URL=postgresql://lemons:pass@localhost:5432/lemons_agent
    python3 db_init.py --seed

    # Output PostgreSQL DDL for manual deployment
    python3 db_init.py --pg-ddl
"""

import argparse
import os
import sys
from datetime import datetime
from pathlib import Path

# Add project scripts dir to path for db_connection import
sys.path.insert(0, str(Path(__file__).resolve().parent))
from db_connection import get_conn, DB_TYPE, get_ddl, placeholder, placeholders, now_expr

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "lemons.db"


def init_db():
    """Create tables using backend-aware DDL."""
    conn = get_conn()
    # Re-read DB_TYPE from module to avoid Python import-copy staleness
    from db_connection import DB_TYPE as actual_type
    ddl = get_ddl()

    # psycopg2 requires cursor; sqlite3 allows conn.execute() directly
    if actual_type == "postgresql":
        cur = conn.cursor()
        for stmt in ddl.split(";"):
            stmt = stmt.strip()
            if stmt and not stmt.startswith("--"):
                try:
                    cur.execute(stmt)
                except Exception as e:
                    print(f"[WARN] {str(e)[:100]}")
        cur.close()
    else:
        for stmt in ddl.split(";"):
            stmt = stmt.strip()
            if stmt and not stmt.startswith("--"):
                try:
                    conn.execute(stmt)
                except Exception as e:
                    print(f"[WARN] {str(e)[:100]}")

    conn.commit()
    conn.close()

    print(f"[OK] Database initialized ({actual_type})")
    if actual_type == "sqlite":
        print(f"     Path: {os.environ.get('DATABASE_URL', DB_PATH)}")
    else:
        print(f"     URL:  {os.environ.get('DATABASE_URL', 'postgresql://...')}")

    return conn


def seed_data():
    """Insert sample data."""
    conn = get_conn()
    today = datetime.now().strftime("%Y-%m-%d")
    ph = placeholder()

    # Tracked tickers
    tickers = [
        ("TSLA", "Tesla Inc.", "Consumer Discretionary"),
        ("NVDA", "NVIDIA Corporation", "Technology"),
        ("AMD", "Advanced Micro Devices", "Technology"),
        ("AAPL", "Apple Inc.", "Technology"),
        ("MSTR", "MicroStrategy Inc.", "Technology"),
        ("COIN", "Coinbase Global Inc.", "Financials"),
        ("SMCI", "Super Micro Computer Inc.", "Technology"),
        ("PLTR", "Palantir Technologies", "Technology"),
        ("ARM", "ARM Holdings", "Technology"),
        ("AVGO", "Broadcom Inc.", "Technology"),
    ]

    if DB_TYPE == "sqlite":
        for t, n, s in tickers:
            conn.execute(
                f"INSERT OR IGNORE INTO tracked_tickers (ticker, name, sector) VALUES ({ph},{ph},{ph})",
                (t, n, s),
            )
    else:
        for t, n, s in tickers:
            try:
                conn.execute(
                    f"INSERT INTO tracked_tickers (ticker, name, sector) VALUES ({ph},{ph},{ph}) ON CONFLICT (ticker) DO NOTHING",
                    (t, n, s),
                )
            except Exception:
                pass  # Already exists

    # Sample options data
    for ticker in ["NVDA", "TSLA", "AAPL", "AMD", "MSTR", "COIN"]:
        if DB_TYPE == "sqlite":
            conn.execute(f"""
                INSERT OR IGNORE INTO options_volatility_log
                    (ticker, trade_date, implied_volatility, historical_volatility,
                     put_call_ratio, call_volume, put_volume, total_options_volume,
                     iv_hv_spread, iv_rank_percentile, data_source)
                VALUES ({ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph})
            """, (ticker, today, 55.0, 40.0, 0.85, 300000, 255000, 555000, 15.0, 65.0, "sample"))
        else:
            try:
                conn.execute(f"""
                    INSERT INTO options_volatility_log
                        (ticker, trade_date, implied_volatility, historical_volatility,
                         put_call_ratio, call_volume, put_volume, total_options_volume,
                         iv_hv_spread, iv_rank_percentile, data_source)
                    VALUES ({ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph})
                    ON CONFLICT (ticker, trade_date) DO NOTHING
                """, (ticker, today, 55.0, 40.0, 0.85, 300000, 255000, 555000, 15.0, 65.0, "sample"))
            except Exception:
                pass

    # Sample macro events
    events = [
        ("US Core CPI YoY", today + "T08:30:00-05:00", 3.1, 2.9, 3.2, -0.2, "MISS",
         "Tech: disinflation supports multiples", "Financial: lower rates pressure NIM", "Broad: risk-on, growth bid"),
        ("Non-Farm Payrolls", today + "T08:30:00-05:00", 180.0, 228.0, 151.0, 48.0, "BEAT",
         "Tech: wage pressure, capex strong", "Financial: delayed cuts, loan growth", "Broad: soft landing narrative intact"),
    ]
    for evt in events:
        if DB_TYPE == "sqlite":
            conn.execute(f"""
                INSERT OR IGNORE INTO macro_economic_events
                    (event_name, event_time, expected_value, actual_value, previous_value,
                     deviation, surprise_flag, ai_impact_tech, ai_impact_financial, ai_impact_broad)
                VALUES ({ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph})
            """, evt)
        else:
            try:
                conn.execute(f"""
                    INSERT INTO macro_economic_events
                        (event_name, event_time, expected_value, actual_value, previous_value,
                         deviation, surprise_flag, ai_impact_tech, ai_impact_financial, ai_impact_broad)
                    VALUES ({ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph})
                    ON CONFLICT (event_name, event_time) DO NOTHING
                """, evt)
            except Exception:
                pass

    conn.commit()
    conn.close()
    print(f"[OK] Sample data seeded ({DB_TYPE})")


def query_db(sql: str):
    """Run a read query and print results."""
    conn = get_conn()
    from db_connection import DB_TYPE as actual_type
    if actual_type == "postgresql":
        cur = conn.cursor()
        cur.execute(sql)
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description] if cur.description else []
        cur.close()
    else:
        cur = conn.execute(sql)
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description] if cur.description else []
    if rows:
        print(" | ".join(cols))
        print("-" * 60)
        for row in rows:
            print(" | ".join(str(v)[:80] for v in row))
        print(f"\n({len(rows)} row(s))")
    else:
        print("(empty)")
    conn.close()


def print_pg_ddl():
    """Output PostgreSQL-specific DDL (SERIAL, BOOLEAN, DECIMAL, etc.)."""
    print("""-- ============================================================================
-- Lemon's AI Agent — PostgreSQL Schema
-- Generated by db_init.py --pg-ddl
-- Run: psql -U lemons -d lemons_agent -f this_file.sql
-- ============================================================================

CREATE TABLE options_volatility_log (
    id              SERIAL PRIMARY KEY,
    ticker          VARCHAR(10) NOT NULL,
    trade_date      DATE NOT NULL,
    implied_volatility   DECIMAL(10, 4),
    historical_volatility DECIMAL(10, 4),
    put_call_ratio       DECIMAL(10, 4),
    call_volume          BIGINT,
    put_volume           BIGINT,
    total_options_volume BIGINT,
    iv_hv_spread         DECIMAL(10, 4),
    unusual_activity_flag BOOLEAN DEFAULT FALSE,
    iv_rank_percentile    DECIMAL(5, 1),
    sparkline_json       TEXT,
    earnings_days_until  INTEGER,
    ai_risk_alert        TEXT,
    data_source          VARCHAR(20) DEFAULT 'yfinance',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_options_ticker_date UNIQUE (ticker, trade_date)
);

CREATE INDEX idx_opt_ticker_date  ON options_volatility_log (ticker, trade_date DESC);
CREATE INDEX idx_opt_trade_date   ON options_volatility_log (trade_date DESC);
CREATE INDEX idx_opt_iv_rank      ON options_volatility_log (ticker, iv_rank_percentile DESC);
CREATE INDEX idx_opt_unusual      ON options_volatility_log (ticker, trade_date DESC) WHERE unusual_activity_flag = TRUE;

CREATE TABLE macro_economic_events (
    id              SERIAL PRIMARY KEY,
    event_name      VARCHAR(100) NOT NULL,
    event_time      TIMESTAMP WITH TIME ZONE NOT NULL,
    expected_value  DECIMAL(10, 4),
    actual_value    DECIMAL(10, 4),
    previous_value  DECIMAL(10, 4),
    deviation       DECIMAL(10, 4),
    surprise_flag   VARCHAR(20),
    ai_impact_tech       TEXT,
    ai_impact_financial  TEXT,
    ai_impact_broad      TEXT,
    ai_impact_summary    TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_macro_event_time UNIQUE (event_name, event_time)
);

CREATE INDEX idx_macro_event_time ON macro_economic_events (event_time DESC);
CREATE INDEX idx_macro_event_name ON macro_economic_events (event_name);
CREATE INDEX idx_macro_surprise    ON macro_economic_events (surprise_flag, event_time DESC);

CREATE TABLE tracked_tickers (
    id          SERIAL PRIMARY KEY,
    ticker      VARCHAR(10) NOT NULL UNIQUE,
    name        VARCHAR(100),
    sector      VARCHAR(50),
    is_active   BOOLEAN DEFAULT TRUE,
    added_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tracked_tickers (ticker, name, sector) VALUES
    ('TSLA','Tesla Inc.','Consumer Discretionary'),
    ('NVDA','NVIDIA Corporation','Technology'),
    ('AMD','Advanced Micro Devices','Technology'),
    ('AAPL','Apple Inc.','Technology'),
    ('MSTR','MicroStrategy Inc.','Technology'),
    ('COIN','Coinbase Global Inc.','Financials'),
    ('SMCI','Super Micro Computer Inc.','Technology'),
    ('PLTR','Palantir Technologies','Technology'),
    ('ARM','ARM Holdings','Technology'),
    ('AVGO','Broadcom Inc.','Technology')
ON CONFLICT (ticker) DO NOTHING;
""")


def main():
    parser = argparse.ArgumentParser(description="Lemon's AI Agent — DB Initializer v2")
    parser.add_argument("--seed", action="store_true", help="Seed sample data")
    parser.add_argument("--pg-ddl", action="store_true", help="Print PostgreSQL DDL")
    parser.add_argument("--query", type=str, help="Run SQL query")
    parser.add_argument("--init-only", action="store_true", help="Skip sample data")
    args = parser.parse_args()

    if args.pg_ddl:
        print_pg_ddl()
        return

    if args.query:
        query_db(args.query)
        return

    # Initialize
    init_db()

    if args.seed:
        seed_data()


if __name__ == "__main__":
    main()
