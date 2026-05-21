-- ============================================================================
-- Lemon's AI Agent — Personal Finance Schema
-- transactions table + indexes + RLS
-- ============================================================================

-- 1. Enum type for transaction direction
DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('income', 'expense');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Transactions table
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
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date DESC);

-- 4. Row Level Security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Allow users to see only their own rows; admin 'Lemon' sees all
DROP POLICY IF EXISTS user_and_admin_access_policy ON transactions;
CREATE POLICY user_and_admin_access_policy ON transactions
    AS PERMISSIVE FOR ALL
    TO public
    USING (
        user_id = current_setting('app.current_user_id', true)::integer
        OR EXISTS (
            SELECT 1 FROM users
            WHERE users.id = current_setting('app.current_user_id', true)::integer
              AND users.username = 'Lemon'
              AND users.is_admin = true
        )
    );
