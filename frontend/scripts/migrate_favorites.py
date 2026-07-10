#!/usr/bin/env python3
"""
Migration: merge user_quick_favorites into user_custom_foods + user_exercise_favorites
Run: python3 /home/lemon/lemons-ai-agent/frontend/scripts/migrate_favorites.py
"""
import subprocess, sys

DB = "lemons_ai"
USER = "lemon"
HOST = "localhost"

def run(sql, dry=False):
    """Run SQL via psql. Returns stdout."""
    env = {"PGPASSWORD": "Lemonclf0428!"}
    cmd = ["psql", "-h", HOST, "-U", USER, "-d", DB, "-c", sql]
    if dry:
        print(f"[DRY] {sql}")
        return ""
    result = subprocess.run(cmd, capture_output=True, text=True, env=env)
    if result.returncode != 0:
        print(f"ERROR: {result.stderr}")
        sys.exit(1)
    return result.stdout

def main():
    dry = "--dry" in sys.argv
    if dry:
        print("=== DRY RUN ===")

    # 1. Check existing state
    print("\n--- Current state ---")
    print(run("SELECT COUNT(*) FROM user_quick_favorites;", dry))
    print(run("SELECT COUNT(*) FROM user_custom_foods;", dry))
    print(run("SELECT * FROM user_quick_favorites ORDER BY favorite_type, name;", dry))

    # 2. ALTER user_custom_foods
    print("\n--- Step 1: ALTER user_custom_foods ---")
    for col_sql in [
        "ALTER TABLE user_custom_foods ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;",
        "ALTER TABLE user_custom_foods ADD COLUMN IF NOT EXISTS default_weight NUMERIC;",
        "ALTER TABLE user_custom_foods ADD COLUMN IF NOT EXISTS default_serving_unit VARCHAR(20) DEFAULT 'g';",
        "ALTER TABLE user_custom_foods ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;",
    ]:
        print(run(col_sql, dry))

    # 3. CREATE user_exercise_favorites
    print("\n--- Step 2: CREATE user_exercise_favorites ---")
    print(run("""
        CREATE TABLE IF NOT EXISTS user_exercise_favorites (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL DEFAULT 1,
            name VARCHAR(200) NOT NULL,
            calories NUMERIC DEFAULT 0,
            default_duration INTEGER DEFAULT 30,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(user_id, name)
        );
    """, dry))

    # 4. Migrate food favorites (type='in') → user_custom_foods
    print("\n--- Step 3: Migrate food favorites → user_custom_foods ---")
    # Upsert pattern: for each favorite of type='in', create or update custom_food
    migrate_food = """
        INSERT INTO user_custom_foods (user_id, food_name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, is_favorite, default_weight, default_serving_unit, sort_order)
        SELECT
            uqf.user_id,
            uqf.name,
            COALESCE(
                (SELECT fnc.calories_per_100g FROM food_nutrition_cache fnc WHERE fnc.food_name ILIKE uqf.name LIMIT 1),
                uqf.calories / NULLIF(uqf.default_weight, 0) * 100,
                0
            ) as calories_per_100g,
            0, 0, 0,
            TRUE,
            uqf.default_weight,
            COALESCE(uqf.serving_unit, 'g'),
            uqf.sort_order
        FROM user_quick_favorites uqf
        WHERE uqf.favorite_type = 'in'
        ON CONFLICT (user_id, food_name)
        DO UPDATE SET
            is_favorite = TRUE,
            default_weight = COALESCE(EXCLUDED.default_weight, user_custom_foods.default_weight),
            default_serving_unit = COALESCE(EXCLUDED.default_serving_unit, user_custom_foods.default_serving_unit),
            sort_order = EXCLUDED.sort_order;
    """
    # Check if unique constraint exists
    try:
        print(run(migrate_food, dry))
    except SystemExit:
        # ON CONFLICT needs the unique constraint; check if it exists
        print("Trying without ON CONFLICT...")
        # First, ensure unique constraint
        print(run("""
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_custom_foods_user_food_key') THEN
                    ALTER TABLE user_custom_foods ADD CONSTRAINT user_custom_foods_user_food_key UNIQUE (user_id, food_name);
                END IF;
            END $$;
        """, dry))
        print(run(migrate_food, dry))

    # 5. Migrate exercise favorites (type='out') → user_exercise_favorites
    print("\n--- Step 4: Migrate exercise favorites → user_exercise_favorites ---")
    migrate_ex = """
        INSERT INTO user_exercise_favorites (user_id, name, calories, default_duration, sort_order)
        SELECT user_id, name, COALESCE(calories, 0), COALESCE(default_duration, 30), COALESCE(sort_order, 0)
        FROM user_quick_favorites
        WHERE favorite_type = 'out'
        ON CONFLICT (user_id, name) DO NOTHING;
    """
    print(run(migrate_ex, dry))

    # 6. Verify migration
    print("\n--- Step 5: Verify ---")
    print(run("SELECT COUNT(*) as food_favs FROM user_custom_foods WHERE is_favorite = true;", dry))
    print(run("SELECT food_name, is_favorite, default_weight, default_serving_unit FROM user_custom_foods WHERE is_favorite = true;", dry))
    print(run("SELECT * FROM user_exercise_favorites;", dry))

    # 7. Drop old table (only if NOT dry)
    if not dry:
        print("\n--- Step 6: Drop user_quick_favorites ---")
        print(run("DROP TABLE IF EXISTS user_quick_favorites;"))
    else:
        print("\n[DRY] Would drop user_quick_favorites")

    print("\n✅ Migration complete!")

if __name__ == "__main__":
    main()
