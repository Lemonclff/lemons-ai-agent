-- ============================================================================
-- Lemon's AI Agent — NutriSnap Nutrition Tracking Schema
-- User profiles, food database, daily logs, exercise tracking
-- ============================================================================

-- 1. User Health Profiles
--    Stores body metrics, activity level, and calorie targets
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id              INTEGER PRIMARY KEY REFERENCES users(id),
    gender               VARCHAR(10) DEFAULT 'male',
    age                  INTEGER DEFAULT 30,
    height_cm            DECIMAL(5,1) DEFAULT 170,
    weight_kg            DECIMAL(5,1) DEFAULT 70,
    activity_level       VARCHAR(20) DEFAULT 'moderate',
    goal                 VARCHAR(20) DEFAULT 'maintain',
    daily_calorie_target INTEGER DEFAULT 2000,
    daily_protein_target INTEGER DEFAULT 100,
    daily_carbs_target   INTEGER DEFAULT 250,
    daily_fat_target     INTEGER DEFAULT 65,
    daily_water_target_ml INTEGER DEFAULT 2000,
    updated_at           TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Food Nutrition Cache
--    Curated local foods + Open Food Facts API results
CREATE TABLE IF NOT EXISTS food_nutrition_cache (
    id                SERIAL PRIMARY KEY,
    food_name         VARCHAR(200) NOT NULL,
    display_name      VARCHAR(200),
    calories_per_100g DECIMAL(10,4),
    protein_per_100g  DECIMAL(10,4),
    carbs_per_100g    DECIMAL(10,4),
    fat_per_100g      DECIMAL(10,4),
    fiber_per_100g    DECIMAL(10,4),
    source            VARCHAR(20) NOT NULL,
    source_id         VARCHAR(100),
    created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(food_name, source)
);

CREATE INDEX IF NOT EXISTS idx_food_cache_name ON food_nutrition_cache (food_name);

-- 3. User Custom Foods
--    User-defined foods not found in the main cache
CREATE TABLE IF NOT EXISTS user_custom_foods (
    id                SERIAL PRIMARY KEY,
    user_id           INTEGER NOT NULL REFERENCES users(id),
    food_name         VARCHAR(200) NOT NULL,
    calories_per_100g DECIMAL(10,4),
    protein_per_100g  DECIMAL(10,4),
    carbs_per_100g    DECIMAL(10,4),
    fat_per_100g      DECIMAL(10,4),
    created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Daily Food Logs
--    Records every food entry per user per day
CREATE TABLE IF NOT EXISTS daily_food_logs (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id),
    log_date      DATE NOT NULL,
    meal_type     VARCHAR(20) DEFAULT 'snack',
    food_name     VARCHAR(200) NOT NULL,
    weight_grams  DECIMAL(10,4),
    calories      DECIMAL(10,4),
    protein       DECIMAL(10,4),
    carbs         DECIMAL(10,4),
    fat           DECIMAL(10,4),
    source        VARCHAR(20) DEFAULT 'manual',
    created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dfl_user_date ON daily_food_logs (user_id, log_date DESC);

-- 5. Exercise Logs
--    Records exercise entries with MET-based calorie calculation
CREATE TABLE IF NOT EXISTS exercise_logs (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    log_date        DATE NOT NULL,
    exercise_name   VARCHAR(100) NOT NULL,
    duration_min    INTEGER NOT NULL,
    met_value       DECIMAL(5,1) NOT NULL,
    calories_burned DECIMAL(8,1) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_exercise_user_date ON exercise_logs (user_id, log_date DESC);

-- 6. Water Logs
--    Records daily water intake entries
CREATE TABLE IF NOT EXISTS water_logs (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id),
    log_date      DATE NOT NULL,
    amount_ml     DECIMAL(8,1) NOT NULL DEFAULT 250,
    created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_water_user_date ON water_logs (user_id, log_date DESC);
