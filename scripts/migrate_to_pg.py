#!/usr/bin/env python3
"""
Lemon's AI Agent — SQLite → PostgreSQL Migration Tool
=======================================================

Exports all data from SQLite and imports into PostgreSQL.
Requires psycopg2: pip install psycopg2-binary

Usage:
    # Step 1: Export SQLite → JSON dump
    python3 scripts/migrate_to_pg.py --export

    # Step 2: Set PG connection
    export DATABASE_URL=postgresql://lemons:password@localhost:5432/lemons_agent

    # Step 3: Create PG tables
    python3 scripts/db_init.py

    # Step 4: Import into PG
    python3 scripts/migrate_to_pg.py --import

    # Step 5: Verify
    export DATABASE_URL=postgresql://lemons:password@localhost:5432/lemons_agent
    python3 scripts/db_init.py --query "SELECT COUNT(*) FROM options_volatility_log"
"""

import argparse
import json
import os
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from db_connection import DB_TYPE
from db_init import init_db

SQLITE_DB = Path(__file__).resolve().parent.parent / "data" / "lemons.db"
DUMP_FILE = Path(__file__).resolve().parent.parent / "data" / "migration_dump.json"


def export_sqlite():
    """Export all SQLite tables to a JSON dump file."""
    if not SQLITE_DB.exists():
        print(f"[ERROR] SQLite DB not found: {SQLITE_DB}")
        sys.exit(1)

    conn = sqlite3.connect(str(SQLITE_DB))
    conn.row_factory = sqlite3.Row

    dump = {"exported_at": datetime.now().isoformat(), "tables": {}}

    for table in ["tracked_tickers", "options_volatility_log", "macro_economic_events", "stock_price_daily", "users"]:
        try:
            rows = conn.execute(f"SELECT * FROM {table}").fetchall()
            cols = [d[0] for d in conn.execute(f"SELECT * FROM {table} LIMIT 0").description]
            dump["tables"][table] = {"columns": cols, "rows": [dict(r) for r in rows]}
            print(f"  {table}: {len(rows)} rows")
        except Exception as e:
            print(f"  {table}: SKIP ({e})")

    conn.close()

    DUMP_FILE.write_text(json.dumps(dump, indent=2, default=str))
    print(f"\n[OK] Exported to {DUMP_FILE} ({DUMP_FILE.stat().st_size:,} bytes)")


def import_to_pg():
    """Import JSON dump into PostgreSQL."""
    if not DUMP_FILE.exists():
        print(f"[ERROR] Dump file not found: {DUMP_FILE}")
        print("  Run: python3 scripts/migrate_to_pg.py --export")
        sys.exit(1)

    from db_connection import get_conn
    conn = get_conn()
    # Re-read DB_TYPE after get_conn() sets it
    from db_connection import DB_TYPE as actual_type
    if actual_type != "postgresql":
        print("[ERROR] DATABASE_URL must be set to a PostgreSQL connection string")
        print("  export DATABASE_URL=postgresql://user:***@host:5432/dbname")
        conn.close()
        sys.exit(1)

    dump = json.loads(DUMP_FILE.read_text())

    cur = conn.cursor()

    # Import order: tracked_tickers first (no FK), then options, then macro
    # Columns that need boolean conversion from SQLite (0/1) to Python bool
    BOOL_COLUMNS = {"is_active", "unusual_activity_flag"}

    for table in ["tracked_tickers", "options_volatility_log", "macro_economic_events", "stock_price_daily", "users"]:
        data = dump["tables"].get(table)
        if not data or not data["rows"]:
            print(f"  {table}: no data, skipping")
            continue

        cols = data["columns"]
        rows = data["rows"]
        col_str = ", ".join(cols)
        placeholders = ", ".join(["%s"] * len(cols))

        count = 0
        for row in rows:
            vals = [row.get(c) for c in cols]
            # Convert int boolean columns (SQLite) → Python bool (PostgreSQL)
            for i, col in enumerate(cols):
                if col in BOOL_COLUMNS and vals[i] is not None:
                    vals[i] = bool(vals[i])
            try:
                cur.execute(
                    f"INSERT INTO {table} ({col_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING",
                    vals,
                )
                count += 1
            except Exception as e:
                conn.rollback()  # Reset aborted transaction
                print(f"  [WARN] {table} row {count}: {str(e)[:100]}")

        conn.commit()
        print(f"  {table}: {count}/{len(rows)} rows imported")

    cur.close()
    conn.close()
    print(f"\n[OK] Migration complete → PostgreSQL")


def main():
    parser = argparse.ArgumentParser(description="SQLite → PostgreSQL Migration")
    parser.add_argument("--export", action="store_true", help="Export SQLite to JSON dump")
    parser.add_argument("--import", action="store_true", dest="import_", help="Import JSON dump to PostgreSQL")
    args = parser.parse_args()

    if args.export:
        print("=== Exporting SQLite → JSON ===")
        export_sqlite()
    elif args.import_:
        print("=== Importing JSON → PostgreSQL ===")
        import_to_pg()
    else:
        print("Usage:")
        print("  python3 scripts/migrate_to_pg.py --export    # Dump SQLite → JSON")
        print("  python3 scripts/migrate_to_pg.py --import    # Load JSON → PostgreSQL")
        print("\nFull workflow:")
        print("  1. python3 scripts/migrate_to_pg.py --export")
        print("  2. export DATABASE_URL=postgresql://user:pass@host:5432/dbname")
        print("  3. python3 scripts/db_init.py")
        print("  4. python3 scripts/migrate_to_pg.py --import")
        print("  5. python3 scripts/db_init.py --query 'SELECT COUNT(*) FROM options_volatility_log'")


if __name__ == "__main__":
    main()
