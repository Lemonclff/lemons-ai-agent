#!/usr/bin/env python3
"""Apply finance schema migration."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from db_connection import get_conn

conn = get_conn()
cur = conn.cursor()

# 1. Enum
try:
    cur.execute("CREATE TYPE transaction_type AS ENUM ('income', 'expense')")
    print("+ transaction_type enum")
except Exception as e:
    conn.rollback()
    if "already exists" in str(e):
        print("  enum exists, skip")
    else:
        print(f"  SKIP enum: {e}")

# 2. Table
try:
    cur.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type transaction_type NOT NULL,
            category VARCHAR(50) NOT NULL,
            sub_category VARCHAR(50),
            amount NUMERIC(12, 2) NOT NULL,
            transaction_date DATE NOT NULL,
            description TEXT,
            source_file VARCHAR(512),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    print("+ transactions table")
except Exception as e:
    conn.rollback()
    print(f"  SKIP table: {e}")

# 3. Indexes
for idx_name, idx_sql in [
    ("idx_transactions_user_id", "CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)"),
    ("idx_transactions_date", "CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date DESC)"),
    ("idx_transactions_category", "CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category)"),
    ("idx_transactions_type", "CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type)"),
    ("idx_transactions_user_date", "CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date DESC)"),
]:
    try:
        cur.execute(idx_sql)
        conn.commit()
        print(f"+ {idx_name}")
    except Exception as e:
        conn.rollback()
        print(f"  SKIP {idx_name}: {e}")

# 4. RLS
try:
    cur.execute("ALTER TABLE transactions ENABLE ROW LEVEL SECURITY")
    conn.commit()
    print("+ RLS enabled")
except Exception as e:
    conn.rollback()
    print(f"  SKIP RLS: {e}")

try:
    cur.execute("DROP POLICY IF EXISTS user_and_admin_access_policy ON transactions")
    cur.execute("""
        CREATE POLICY user_and_admin_access_policy ON transactions
            AS PERMISSIVE FOR ALL TO public
            USING (
                user_id = current_setting('app.current_user_id', true)::integer
                OR EXISTS (
                    SELECT 1 FROM users
                    WHERE users.id = current_setting('app.current_user_id', true)::integer
                      AND users.username = 'Lemon'
                      AND users.is_admin = true
                )
            )
    """)
    conn.commit()
    print("+ RLS policy")
except Exception as e:
    conn.rollback()
    print(f"  SKIP policy: {e}")

cur.close()
conn.close()
print("Finance schema migration done")
