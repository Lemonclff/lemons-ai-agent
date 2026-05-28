-- ============================================================
-- Schedule Module — Database Schema
-- 智能排更系統
-- ============================================================

-- 1. 職員資料
CREATE TABLE IF NOT EXISTS schedule_staff (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    name_en         TEXT,
    role            TEXT NOT NULL CHECK (role IN ('AS','RW','PA')),
    home_unit       TEXT NOT NULL CHECK (home_unit IN ('A','B','C','D','E')),
    can_work_units  TEXT[] DEFAULT '{}',
    skill_tags      TEXT[] DEFAULT '{}',
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- 2. 更份類型
CREATE TABLE IF NOT EXISTS schedule_shift_types (
    id          SERIAL PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,
    label       TEXT NOT NULL,
    start_time  TIME NOT NULL,
    end_time    TIME NOT NULL,
    duration_h  NUMERIC(3,1) NOT NULL,
    category    TEXT NOT NULL CHECK (category IN ('day','night','float')),
    color       TEXT DEFAULT '#6366f1'
);

-- 3. 每日人手要求
CREATE TABLE IF NOT EXISTS schedule_coverage_rules (
    id              SERIAL PRIMARY KEY,
    unit            TEXT NOT NULL,
    shift_type_id   INT REFERENCES schedule_shift_types(id),
    day_of_week     INT CHECK (day_of_week BETWEEN 0 AND 6),
    min_as          INT DEFAULT 0,
    min_rw          INT DEFAULT 0,
    min_total       INT DEFAULT 1
);

-- 4. 排更記錄
CREATE TABLE IF NOT EXISTS schedule_assignments (
    id              SERIAL PRIMARY KEY,
    staff_id        INT REFERENCES schedule_staff(id),
    shift_date      DATE NOT NULL,
    shift_type_id   INT REFERENCES schedule_shift_types(id),
    unit            TEXT NOT NULL,
    status          TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','swapped','called_off')),
    locked          BOOLEAN DEFAULT false,
    notes           TEXT,
    created_by      TEXT DEFAULT 'solver',
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(staff_id, shift_date)
);

-- 5. 請假記錄
CREATE TABLE IF NOT EXISTS schedule_leave (
    id          SERIAL PRIMARY KEY,
    staff_id    INT REFERENCES schedule_staff(id),
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    leave_type  TEXT NOT NULL CHECK (leave_type IN ('annual','sick','time_off','training','other')),
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- 6. Solver 配置
CREATE TABLE IF NOT EXISTS schedule_config (
    id          SERIAL PRIMARY KEY,
    config_key  TEXT UNIQUE NOT NULL,
    config_json JSONB NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Seed Data
-- ============================================================

-- Shift Types
INSERT INTO schedule_shift_types (code, label, start_time, end_time, duration_h, category, color) VALUES
('1423',  '早更 (1423)', '07:00', '16:00', 9.0, 'day',   '#22c55e'),
('N',     '夜更',       '22:00', '07:00', 9.0, 'night', '#6366f1'),
('PA',    '活動更',     '09:00', '18:00', 9.0, 'day',   '#f59e0b'),
('AM',    '上午更',     '07:00', '13:00', 6.0, 'day',   '#14b8a6'),
('PM',    '下午更',     '13:00', '19:00', 6.0, 'day',   '#ec4899'),
('OFF',   '放假',       '00:00', '00:00', 0.0, 'float', '#3f3f46')
ON CONFLICT (code) DO NOTHING;

-- Coverage Rules (Mon-Sun, all units)
INSERT INTO schedule_coverage_rules (unit, shift_type_id, day_of_week, min_as, min_rw, min_total)
SELECT u.unit, st.id, NULL, 1, 2, 3
FROM (SELECT unnest(ARRAY['A','B','C','D','E']) AS unit) u
CROSS JOIN schedule_shift_types st
WHERE st.code = '1423';

INSERT INTO schedule_coverage_rules (unit, shift_type_id, day_of_week, min_as, min_rw, min_total)
SELECT u.unit, st.id, NULL, 0, 1, 1
FROM (SELECT unnest(ARRAY['A','B','C','D','E']) AS unit) u
CROSS JOIN schedule_shift_types st
WHERE st.code = 'N';

-- Staff (15 people across 5 units, using generic names)
INSERT INTO schedule_staff (name, name_en, role, home_unit, can_work_units, skill_tags) VALUES
('陳主任',   'Chan',    'AS', 'A', '{A,B}',   '{急救,督導}'),
('李姑娘',   'Lee',     'RW', 'A', '{A,B}',   '{急救}'),
('張Sir',    'Cheung',  'RW', 'A', '{A}',     '{駕駛}'),
('黃主任',   'Wong',    'AS', 'B', '{B,C}',   '{督導}'),
('何姑娘',   'Ho',      'RW', 'B', '{B}',     '{急救,駕駛}'),
('林Sir',    'Lam',     'RW', 'B', '{B,C}',   '{}'),
('梁主任',   'Leung',   'AS', 'C', '{C,D}',   '{督導,急救}'),
('吳姑娘',   'Ng',      'RW', 'C', '{C}',     '{}'),
('劉Sir',    'Lau',     'RW', 'C', '{C,D}',   '{駕駛}'),
('周主任',   'Chow',    'AS', 'D', '{D,E}',   '{督導}'),
('鄭姑娘',   'Cheng',   'RW', 'D', '{D}',     '{急救}'),
('馮Sir',    'Fung',    'RW', 'D', '{D,E}',   '{駕駛}'),
('許主任',   'Hui',     'AS', 'E', '{E,D}',   '{督導,急救}'),
('蘇姑娘',   'So',      'RW', 'E', '{E}',     '{}'),
('潘Sir',    'Poon',    'PA', 'E', '{A,B,C,D,E}','{駕駛}')
ON CONFLICT DO NOTHING;

-- Default solver config
INSERT INTO schedule_config (config_key, config_json) VALUES
('default', '{
  "hard_constraints": {
    "one_shift_per_day": true,
    "min_coverage": true,
    "respect_leave": true,
    "home_unit_only": false,
    "night_rest_24h": true,
    "max_consecutive_days": 6,
    "required_skills": false
  },
  "soft_constraints": {
    "avoid_consecutive_nights": {"enabled": true, "weight": 100},
    "fair_weekend_distribution": {"enabled": true, "weight": 50},
    "prefer_same_unit_continuity": {"enabled": false, "weight": 20},
    "avoid_abc_all_off": {"enabled": true, "weight": 200},
    "as_avoid_night": {"enabled": true, "weight": 150},
    "minimize_cross_unit": {"enabled": true, "weight": 30}
  },
  "optimization_goal": "balanced"
}')
ON CONFLICT (config_key) DO NOTHING;
