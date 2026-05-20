#!/bin/bash
# ============================================================================
# Lemon's AI Agent — Sync WSL Project → D: Drive
# ============================================================================
# Copies database, scripts, and schema to D:\hermes_stock_task\
# Run: bash scripts/sync_to_d.sh
# ============================================================================

set -e

PROJECT="/home/lemon/lemons-ai-agent"
DEST="/mnt/d/hermes_stock_task"

echo "=== Lemon's AI Agent — Sync to D: Drive ==="
echo "Source: $PROJECT"
echo "Dest:   $DEST"
echo ""

# 1. Database
echo "[1/4] Copying database..."
mkdir -p "$DEST/data"
cp -v "$PROJECT/data/lemons.db" "$DEST/data/market.db"

# 2. Python scripts
echo "[2/4] Copying scripts..."
mkdir -p "$DEST/scripts_backup"
for f in db_init.py db_populate.py db_query.py options_api.py macro_economic.py sector_rotation.py; do
    [ -f "$PROJECT/scripts/$f" ] && cp -v "$PROJECT/scripts/$f" "$DEST/scripts_backup/$f"
done

# 3. Schema
echo "[3/4] Copying schema..."
cp -v "$PROJECT/db/schema.sql" "$DEST/schema.sql"
python3 "$PROJECT/scripts/db_init.py" --postgresql > "$DEST/schema_pg.sql"
echo "  → schema_pg.sql (PostgreSQL DDL)"

# 4. HTML Report
echo "[4/4] Generating HTML report..."
python3 "$PROJECT/scripts/db_report.py" "$PROJECT/data/lemons.db" "$DEST/data/report.html"

echo ""
echo "=== ✅ Sync complete ==="
echo "D: drive location: $DEST"
echo "Open in browser:   file:///D:/hermes_stock_task/data/report.html"
ls -lh "$DEST/data/"
