#!/usr/bin/env python3
"""Migration: add user_id + result_json columns to parse_task_history"""
import os, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
_ENV_FILE = Path(__file__).resolve().parent.parent / "frontend" / ".env.local"
_HERMES_ENV = Path.home() / ".hermes" / ".env"
for _ef in [_HERMES_ENV, _ENV_FILE]:
    if _ef.exists():
        with open(_ef) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    if "#" in v:
                        ci = v.find(" #")
                        if ci < 0: ci = v.find("\t#")
                        if ci >= 0: v = v[:ci]
                    if k.strip() not in os.environ or not os.environ.get(k.strip()):
                        os.environ[k.strip()] = v.strip()

from db_connection import get_conn

conn = get_conn()
cur = conn.cursor()

# Add new columns (IF NOT EXISTS is PG 9.6+, we'll catch duplicates)
for col, dtype in [("user_id", "INTEGER"), ("result_json", "TEXT")]:
    try:
        cur.execute(f"ALTER TABLE parse_task_history ADD COLUMN {col} {dtype}")
        print(f"  ✓ Added column: {col} {dtype}")
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
            print(f"  - Column already exists: {col}")
        else:
            print(f"  ✗ Failed: {col} — {e}")

conn.commit()

# Show current schema
cur.execute("""
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'parse_task_history' 
    ORDER BY ordinal_position
""")
print("\n  parse_task_history columns:")
for row in cur.fetchall():
    print(f"    {row[0]:20s} {row[1]:15s} nullable={row[2]}")

cur.close()
conn.close()
print("\n  ✓ Migration complete")
