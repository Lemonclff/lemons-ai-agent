-- ============================================================
-- Custom Roles & Units — extend schedule module
-- ============================================================

-- Custom staff roles (replaces hardcoded AS/RW/PA)
CREATE TABLE IF NOT EXISTS schedule_roles (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,        -- e.g. "主任", "社工", "護理員"
    code        TEXT NOT NULL UNIQUE,        -- e.g. "DIR", "SW", "CW"
    color       TEXT DEFAULT '#6366f1',      -- UI display color
    sort_order  INT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Custom units/houses (replaces hardcoded A/B/C/D/E)
CREATE TABLE IF NOT EXISTS schedule_units (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,        -- e.g. "和平家", "喜樂家"
    code        TEXT NOT NULL UNIQUE,        -- e.g. "PEACE", "JOY"
    color       TEXT DEFAULT '#22c55e',      -- UI display color
    sort_order  INT DEFAULT 0,
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Seed default roles
INSERT INTO schedule_roles (name, code, color, sort_order) VALUES
('主管 (AS)',   'AS', '#818cf8', 1),
('前線 (RW)',   'RW', '#22c55e', 2),
('活動助理 (PA)','PA', '#f59e0b', 3)
ON CONFLICT (code) DO NOTHING;

-- Seed default units
INSERT INTO schedule_units (name, code, color, sort_order) VALUES
('A 社', 'A', '#22c55e', 1),
('B 社', 'B', '#3b82f6', 2),
('C 社', 'C', '#f59e0b', 3),
('D 社', 'D', '#a855f7', 4),
('E 社', 'E', '#f43f5e', 5)
ON CONFLICT (code) DO NOTHING;
