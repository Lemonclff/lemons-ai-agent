#!/usr/bin/env python3
"""
Lemon's AI Agent — Database Initializer
=========================================

Creates SQLite database (PostgreSQL-compatible DDL) with all tables
and indexes for options volatility tracking and macro economic events.

Supports two modes:
    python db_init.py --sqlite           # SQLite (default, runs now)
    python db_init.py --postgresql       # Output PostgreSQL DDL to stdout

SQLite → PostgreSQL migration is trivial: the DDL is 99% compatible.
Only SERIAL → INTEGER PRIMARY KEY AUTOINCREMENT and a few type differences.

Usage:
    python db_init.py                    # Create data/lemons.db
    python db_init.py --seed             # Create + seed with sample data
    python db_init.py --query "SELECT * FROM tracked_tickers"
"""

import argparse
import json
import sqlite3
import sys
import textwrap
from datetime import datetime, timedelta, timezone
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "lemons.db"

# ============================================================================
# DDL — SQLite (PostgreSQL-compatible subset)
# ============================================================================

DDL_SQLITE = textwrap.dedent("""
    -- 1. 期權波動率監控表
    CREATE TABLE IF NOT EXISTS options_volatility_log (
        id                      INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker                  TEXT NOT NULL,
        trade_date              TEXT NOT NULL,          -- DATE as TEXT (ISO 8601)
        implied_volatility      REAL,                   -- IV (%)
        historical_volatility   REAL,                   -- HV 20-day (%)
        put_call_ratio          REAL,                   -- PCR
        call_volume             INTEGER,                -- Call volume
        put_volume              INTEGER,                -- Put volume
        total_options_volume    INTEGER,                -- Total volume
        iv_hv_spread            REAL,                   -- IV - HV
        unusual_activity_flag   INTEGER DEFAULT 0,      -- 0/1 boolean
        iv_rank_percentile      REAL,                   -- IV rank (52-week)
        sparkline_json          TEXT,                   -- 5-day prices as JSON array
        earnings_days_until     INTEGER,                -- Days until earnings (NULL if none)
        ai_risk_alert           TEXT,                   -- LLM-generated alert
        data_source             TEXT DEFAULT 'yfinance',-- 'yfinance' | 'mock' | 'manual'
        created_at              TEXT DEFAULT (datetime('now')),
        updated_at              TEXT DEFAULT (datetime('now')),

        UNIQUE(ticker, trade_date)
    );

    -- Index: fast lookup by ticker + date range
    CREATE INDEX IF NOT EXISTS idx_opt_ticker_date
        ON options_volatility_log (ticker, trade_date DESC);

    -- Index: time-series queries (all tickers on a date)
    CREATE INDEX IF NOT EXISTS idx_opt_trade_date
        ON options_volatility_log (trade_date DESC);

    -- Index: anomaly queries (unusual activity only)
    CREATE INDEX IF NOT EXISTS idx_opt_unusual
        ON options_volatility_log (ticker, trade_date DESC)
        WHERE unusual_activity_flag = 1;

    -- Index: IV rank for volatility regime queries
    CREATE INDEX IF NOT EXISTS idx_opt_iv_rank
        ON options_volatility_log (ticker, iv_rank_percentile DESC);

    -- 2. 宏觀經濟事件表
    CREATE TABLE IF NOT EXISTS macro_economic_events (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        event_name          TEXT NOT NULL,
        event_time          TEXT NOT NULL,              -- ISO 8601 timestamp
        expected_value      REAL,
        actual_value        REAL,
        previous_value      REAL,
        deviation           REAL,                       -- actual - expected
        surprise_flag       TEXT,                       -- 'BEAT' | 'MISS' | 'INLINE'
        ai_impact_tech      TEXT,                       -- LLM: tech sector impact
        ai_impact_financial TEXT,                       -- LLM: financial sector impact
        ai_impact_broad     TEXT,                       -- LLM: broad market impact
        ai_impact_summary   TEXT,                       -- LLM: overall summary
        created_at          TEXT DEFAULT (datetime('now')),

        UNIQUE(event_name, event_time)
    );

    -- Index: calendar view (upcoming/recent events)
    CREATE INDEX IF NOT EXISTS idx_macro_event_time
        ON macro_economic_events (event_time DESC);

    -- Index: event type lookup
    CREATE INDEX IF NOT EXISTS idx_macro_event_name
        ON macro_economic_events (event_name);

    -- Index: surprise events (BEAT/MISS only)
    CREATE INDEX IF NOT EXISTS idx_macro_surprise
        ON macro_economic_events (surprise_flag, event_time DESC);

    -- 3. 追蹤標的清單
    CREATE TABLE IF NOT EXISTS tracked_tickers (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker      TEXT NOT NULL UNIQUE,
        name        TEXT,
        sector      TEXT,
        is_active   INTEGER DEFAULT 1,
        added_at    TEXT DEFAULT (datetime('now'))
    );

    -- Seed data
    INSERT OR IGNORE INTO tracked_tickers (ticker, name, sector) VALUES
        ('TSLA',  'Tesla Inc.',              'Consumer Discretionary'),
        ('NVDA',  'NVIDIA Corporation',       'Technology'),
        ('AMD',   'Advanced Micro Devices',   'Technology'),
        ('AAPL',  'Apple Inc.',               'Technology'),
        ('MSTR',  'MicroStrategy Inc.',       'Technology'),
        ('COIN',  'Coinbase Global Inc.',     'Financials'),
        ('SMCI',  'Super Micro Computer Inc.','Technology'),
        ('PLTR',  'Palantir Technologies',    'Technology'),
        ('ARM',   'ARM Holdings',             'Technology'),
        ('AVGO',  'Broadcom Inc.',            'Technology');
""")


# ============================================================================
# PostgreSQL DDL (for production deployment)
# ============================================================================

DDL_POSTGRESQL = textwrap.dedent("""
    -- ============================================================================
    -- Lemon's AI Agent — PostgreSQL Schema
    -- Run: psql -U your_user -d your_db -f this_file.sql
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
    CREATE INDEX idx_opt_unusual      ON options_volatility_log (ticker, trade_date DESC)
        WHERE unusual_activity_flag = TRUE;
    CREATE INDEX idx_opt_iv_rank      ON options_volatility_log (ticker, iv_rank_percentile DESC);

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


# ============================================================================
# Seed data
# ============================================================================

def seed_sample_data(db_path: Path):
    """Insert realistic sample data for testing queries."""
    conn = sqlite3.connect(str(db_path))
    conn.executescript(DDL_SQLITE)

    today = datetime.now().strftime("%Y-%m-%d")
    tickers = ["NVDA", "TSLA", "AAPL", "AMD", "MSTR", "COIN"]

    # Sample options data
    for t in tickers:
        conn.execute("""
            INSERT OR IGNORE INTO options_volatility_log
                (ticker, trade_date, implied_volatility, historical_volatility,
                 put_call_ratio, call_volume, put_volume, total_options_volume,
                 iv_hv_spread, unusual_activity_flag, iv_rank_percentile, data_source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (t, today, 55.0, 40.0, 0.85, 300000, 255000, 555000,
              15.0, 0, 65.0, "sample"))

    # Sample macro events
    events = [
        ("US Core CPI YoY", today + "T08:30:00-05:00", 3.1, 2.9, 3.2,
         -0.2, "MISS", "Tech: disinflation supports multiples",
         "Financial: lower rates pressure NIM",
         "Broad: risk-on, growth bid"),
        ("Non-Farm Payrolls", today + "T08:30:00-05:00", 180.0, 228.0, 151.0,
         48.0, "BEAT", "Tech: wage pressure, capex strong",
         "Financial: delayed cuts, loan growth",
         "Broad: soft landing narrative intact"),
    ]
    for evt in events:
        conn.execute("""
            INSERT OR IGNORE INTO macro_economic_events
                (event_name, event_time, expected_value, actual_value, previous_value,
                 deviation, surprise_flag, ai_impact_tech, ai_impact_financial, ai_impact_broad)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, evt)

    conn.commit()
    conn.close()
    print(f"[OK] Sample data seeded into {db_path}")


# ============================================================================
# CLI
# ============================================================================

def init_db(db_path: Path):
    """Create database with schema, no sample data."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.executescript(DDL_SQLITE)
    conn.commit()
    conn.close()
    print(f"[OK] Database created: {db_path}")
    print(f"     Tables: options_volatility_log, macro_economic_events, tracked_tickers")
    print(f"     Indexes: 7 total (ticker+date, time-series, anomaly, surprise)")


def query_db(db_path: Path, sql: str):
    """Run a read query and print results."""
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cur = conn.execute(sql)
    rows = cur.fetchall()
    if rows:
        cols = [d[0] for d in cur.description]
        print(" | ".join(cols))
        print("-" * 60)
        for row in rows:
            print(" | ".join(str(v) for v in row))
        print(f"\n({len(rows)} row(s))")
    else:
        print("(empty)")
    conn.close()


def main():
    parser = argparse.ArgumentParser(description="Lemon's AI Agent — DB Initializer")
    parser.add_argument("--sqlite", action="store_true", default=True, help="Init SQLite (default)")
    parser.add_argument("--postgresql", action="store_true", help="Print PostgreSQL DDL")
    parser.add_argument("--seed", action="store_true", help="Seed sample data after init")
    parser.add_argument("--query", type=str, help="Run SQL query against the DB")
    parser.add_argument("--db", type=str, default=str(DB_PATH), help="Database path")
    args = parser.parse_args()

    if args.postgresql:
        print(DDL_POSTGRESQL)
        return

    db_path = Path(args.db)

    if args.query:
        query_db(db_path, args.query)
        return

    # Init
    init_db(db_path)

    if args.seed:
        seed_sample_data(db_path)

    # Show stats
    conn = sqlite3.connect(str(db_path))
    tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()
    indexes = conn.execute("SELECT name FROM sqlite_master WHERE type='index' ORDER BY name").fetchall()
    conn.close()
    print(f"\n  Tables:  {', '.join(t[0] for t in tables)}")
    print(f"  Indexes: {', '.join(t[0] for t in indexes)}")


if __name__ == "__main__":
    main()
