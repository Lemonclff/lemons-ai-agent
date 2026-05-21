-- ============================================================================
-- Parse Tasks Queue — persisted AI parse task history
-- ============================================================================

CREATE TABLE IF NOT EXISTS parse_tasks (
    task_id         VARCHAR(32) PRIMARY KEY,
    file_path       VARCHAR(512) NOT NULL,
    file_name       VARCHAR(255),
    provider        VARCHAR(20) DEFAULT 'nvidia',
    status          VARCHAR(20) DEFAULT 'queued',   -- queued | running | done | error
    result_json     JSONB,                           -- AI parse result (transactions array)
    error_message   TEXT,
    tx_count        INTEGER DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at      TIMESTAMP WITH TIME ZONE,
    finished_at     TIMESTAMP WITH TIME ZONE,
    user_id         INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_parse_tasks_status ON parse_tasks(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parse_tasks_file ON parse_tasks(file_path);
CREATE INDEX IF NOT EXISTS idx_parse_tasks_created ON parse_tasks(created_at DESC);

-- Auto-cleanup: delete tasks older than 30 days
-- Run via: DELETE FROM parse_tasks WHERE created_at < NOW() - INTERVAL '30 days'
