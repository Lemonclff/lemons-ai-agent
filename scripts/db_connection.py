#!/usr/bin/env python3
"""
Lemon's AI Agent — Database Connection Layer
=============================================

Single module that provides identical interface for SQLite and PostgreSQL.
All db_*.py scripts import from here. Switching backends is one env var.

Environment:
    DATABASE_URL=sqlite:///home/lemon/lemons-ai-agent/data/lemons.db   (default)
    DATABASE_URL=postgresql://lemons:password@localhost:5432/lemons_agent

Usage in any script:
    from db_connection import get_conn, db_type
    conn = get_conn()
    conn.execute("SELECT ...")    # Works identically on both backends
    conn.commit()
    conn.close()
"""

import os
import sys
from pathlib import Path

DB_URL = os.environ.get("DATABASE_URL", "")
DB_TYPE = "sqlite"  # default

# ============================================================================
# Connection Factory
# ============================================================================

def get_conn():
    """Return a DB-API 2.0 connection (sqlite3 or psycopg2)."""
    global DB_TYPE

    url = DB_URL or f"sqlite:///{Path(__file__).resolve().parent.parent / 'data' / 'lemons.db'}"

    if url.startswith("postgresql://") or url.startswith("postgres://"):
        DB_TYPE = "postgresql"
        return _pg_connect(url)
    else:
        DB_TYPE = "sqlite"
        return _sqlite_connect(url)


def _sqlite_connect(url: str):
    import sqlite3
    path = url.replace("sqlite:///", "").replace("sqlite://", "")
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.row_factory = sqlite3.Row
    return conn


def _pg_connect(url: str):
    import psycopg2
    # Parse URL: postgresql://user:pass@host:port/dbname
    conn = psycopg2.connect(url)
    conn.autocommit = False
    return conn


# ============================================================================
# Query Helpers (abstract over SQLite vs PG differences)
# ============================================================================

def placeholder(n: int = 1) -> str:
    """Return the correct placeholder for the current backend.
    SQLite uses ?, PostgreSQL uses %s."""
    return "?" if DB_TYPE == "sqlite" else "%s"

def placeholders(n: int) -> str:
    """Return n placeholders separated by commas."""
    p = placeholder()
    return ", ".join([p] * n)

def quote_ident(name: str) -> str:
    """Quote an identifier if needed."""
    if DB_TYPE == "postgresql":
        return f'"{name}"'
    return f'"{name}"'  # SQLite also supports double-quote

def now_expr() -> str:
    """Return the current timestamp expression."""
    return "datetime('now')" if DB_TYPE == "sqlite" else "CURRENT_TIMESTAMP"

def auto_pk() -> str:
    """Return auto-increment primary key DDL fragment."""
    return "INTEGER PRIMARY KEY AUTOINCREMENT" if DB_TYPE == "sqlite" else "SERIAL PRIMARY KEY"

def bool_type() -> str:
    return "INTEGER" if DB_TYPE == "sqlite" else "BOOLEAN"

def real_type() -> str:
    return "REAL" if DB_TYPE == "sqlite" else "DECIMAL(10, 4)"


# ============================================================================
# Schema DDL (backend-aware)
# ============================================================================

def get_ddl() -> str:
    """Return CREATE TABLE statements for the current backend."""
    pk = auto_pk()
    bl = bool_type()
    rl = real_type()
    ts = now_expr()

    return f"""
    CREATE TABLE IF NOT EXISTS options_volatility_log (
        id                      {pk},
        ticker                  TEXT NOT NULL,
        trade_date              TEXT NOT NULL,
        implied_volatility      {rl},
        historical_volatility   {rl},
        put_call_ratio          {rl},
        call_volume             INTEGER,
        put_volume              INTEGER,
        total_options_volume    INTEGER,
        iv_hv_spread            {rl},
        unusual_activity_flag   {bl} DEFAULT {'0' if DB_TYPE == 'sqlite' else 'FALSE'},
        iv_rank_percentile      {rl},
        sparkline_json          TEXT,
        earnings_days_until     INTEGER,
        ai_risk_alert           TEXT,
        data_source             TEXT DEFAULT 'yfinance',
        created_at              TEXT DEFAULT {ts},
        updated_at              TEXT DEFAULT {ts},
        UNIQUE(ticker, trade_date)
    );

    CREATE INDEX IF NOT EXISTS idx_opt_ticker_date ON options_volatility_log (ticker, trade_date DESC);
    CREATE INDEX IF NOT EXISTS idx_opt_trade_date  ON options_volatility_log (trade_date DESC);
    CREATE INDEX IF NOT EXISTS idx_opt_iv_rank     ON options_volatility_log (ticker, iv_rank_percentile DESC);

    CREATE TABLE IF NOT EXISTS macro_economic_events (
        id                  {pk},
        event_name          TEXT NOT NULL,
        event_time          TEXT NOT NULL,
        expected_value      {rl},
        actual_value        {rl},
        previous_value      {rl},
        deviation           {rl},
        surprise_flag       TEXT,
        ai_impact_tech      TEXT,
        ai_impact_financial TEXT,
        ai_impact_broad     TEXT,
        ai_impact_summary   TEXT,
        created_at          TEXT DEFAULT {ts},
        UNIQUE(event_name, event_time)
    );

    CREATE INDEX IF NOT EXISTS idx_macro_event_time ON macro_economic_events (event_time DESC);
    CREATE INDEX IF NOT EXISTS idx_macro_event_name ON macro_economic_events (event_name);
    CREATE INDEX IF NOT EXISTS idx_macro_surprise    ON macro_economic_events (surprise_flag, event_time DESC);

    CREATE TABLE IF NOT EXISTS tracked_tickers (
        id          {pk},
        ticker      TEXT NOT NULL UNIQUE,
        name        TEXT,
        sector      TEXT,
        is_active   {bl} DEFAULT {'1' if DB_TYPE == 'sqlite' else 'TRUE'},
        added_at    TEXT DEFAULT {ts}
    );
    """


# ============================================================================
# Quick test
# ============================================================================

if __name__ == "__main__":
    conn = get_conn()
    print(f"Backend: {DB_TYPE}")
    tables = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        if DB_TYPE == "sqlite"
        else "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename"
    ).fetchall()
    print(f"Tables: {[t[0] for t in tables]}")
    conn.close()
