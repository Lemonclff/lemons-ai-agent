/**
 * Migration: merge user_quick_favorites into user_custom_foods + user_exercise_favorites
 * Run: cd /home/lemon/lemons-ai-agent/frontend && npx tsx scripts/migrate-favorites.ts
 * Pass --dry for dry run.
 */
import { Pool } from "pg";

const DB_URL = "postgresql://admin:Lemonclf0428!@127.0.0.1:5432/ai_dashboard_db";
const pool = new Pool({ connectionString: DB_URL, max: 1 });

async function run() {
  const dry = process.argv.includes("--dry");
  if (dry) console.log("=== DRY RUN ===\n");

  const c = await pool.connect();
  try {
    // 0. Current state
    console.log("--- Current state ---");
    let r = await c.query(`SELECT COUNT(*) as n FROM user_quick_favorites`);
    console.log(`user_quick_favorites rows: ${r.rows[0].n}`);
    r = await c.query(`SELECT * FROM user_quick_favorites ORDER BY favorite_type, name`);
    if (r.rows.length > 0) console.table(r.rows);
    r = await c.query(`SELECT id, food_name FROM user_custom_foods`);
    if (r.rows.length > 0) console.table(r.rows);

    // 1. ALTER user_custom_foods
    console.log("\n--- Step 1: ALTER user_custom_foods ---");
    for (const sql of [
      `ALTER TABLE user_custom_foods ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false`,
      `ALTER TABLE user_custom_foods ADD COLUMN IF NOT EXISTS default_weight NUMERIC`,
      `ALTER TABLE user_custom_foods ADD COLUMN IF NOT EXISTS default_serving_unit VARCHAR(20) DEFAULT 'g'`,
      `ALTER TABLE user_custom_foods ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0`,
    ]) {
      if (dry) console.log(`[DRY] ${sql}`);
      else await c.query(sql);
    }

    // 2. Ensure unique constraint
    console.log("\n--- Step 2: Unique constraint ---");
    const ck = await c.query(`SELECT 1 FROM pg_constraint WHERE conname = 'user_custom_foods_user_food_key'`);
    if (ck.rows.length === 0) {
      if (dry) console.log("[DRY] Would add unique constraint");
      else await c.query(`ALTER TABLE user_custom_foods ADD CONSTRAINT user_custom_foods_user_food_key UNIQUE (user_id, food_name)`);
      console.log("Constraint would be added.");
    } else console.log("Already exists.");

    // 3. CREATE user_exercise_favorites
    console.log("\n--- Step 3: CREATE user_exercise_favorites ---");
    const createEx = `
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
    `;
    if (dry) console.log(`[DRY] CREATE user_exercise_favorites`);
    else await c.query(createEx);

    // 4. Migrate food favorites → user_custom_foods
    console.log("\n--- Step 4: Migrate food → custom_foods ---");
    const ffs = await c.query(`SELECT * FROM user_quick_favorites WHERE favorite_type = 'in'`);
    for (const f of ffs.rows) {
      // Try to get per-100g nutrition from:
      // a) food_nutrition_cache (best source)
      // b) existing user_custom_foods row (might have proper values)
      // c) calculate from stored calories (only works if default_weight is grams, not servings)
      let calPer100 = 0, protPer100 = 0, carbPer100 = 0, fatPer100 = 0;

      const hit = await c.query(
        `SELECT * FROM food_nutrition_cache WHERE food_name ILIKE $1 LIMIT 1`, [f.name]
      );
      if (hit.rows[0]) {
        calPer100 = Number(hit.rows[0].calories_per_100g) || 0;
        protPer100 = Number(hit.rows[0].protein_per_100g) || 0;
        carbPer100 = Number(hit.rows[0].carbs_per_100g) || 0;
        fatPer100 = Number(hit.rows[0].fat_per_100g) || 0;
      } else {
        // Check existing custom_foods entry
        const existing = await c.query(
          `SELECT * FROM user_custom_foods WHERE user_id = $1 AND food_name ILIKE $2 LIMIT 1`,
          [f.user_id, f.name]
        );
        if (existing.rows[0]) {
          calPer100 = Number(existing.rows[0].calories_per_100g) || 0;
          protPer100 = Number(existing.rows[0].protein_per_100g) || 0;
          carbPer100 = Number(existing.rows[0].carbs_per_100g) || 0;
          fatPer100 = Number(existing.rows[0].fat_per_100g) || 0;
        }
        // Don't try to calculate from serving-based calories — it produces garbage
      }

      const unit = f.serving_unit || 'g';
      const weight = f.default_weight ? Number(f.default_weight) : 100;

      if (dry) {
        console.log(`[DRY] Upsert: ${f.name}  cal/100g=${calPer100}  weight=${weight}  unit=${unit}`);
      } else {
        await c.query(
          `INSERT INTO user_custom_foods (user_id, food_name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, is_favorite, default_weight, default_serving_unit, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7,$8,$9)
           ON CONFLICT (user_id, food_name)
           DO UPDATE SET is_favorite=TRUE, default_weight=COALESCE(EXCLUDED.default_weight, user_custom_foods.default_weight),
                         default_serving_unit=COALESCE(EXCLUDED.default_serving_unit, user_custom_foods.default_serving_unit),
                         sort_order=COALESCE(EXCLUDED.sort_order, user_custom_foods.sort_order)`,
          [f.user_id, f.name, calPer100, protPer100, carbPer100, fatPer100, weight, unit, f.sort_order || 0]
        );
      }
    }

    // 5. Migrate exercise favorites → user_exercise_favorites
    console.log("\n--- Step 5: Migrate exercise → exercise_favorites ---");
    const efs = await c.query(`SELECT * FROM user_quick_favorites WHERE favorite_type = 'out'`);
    for (const f of efs.rows) {
      if (dry) {
        console.log(`[DRY] Insert exercise: ${f.name}  dur=${f.default_duration}  cal=${f.calories}`);
      } else {
        await c.query(
          `INSERT INTO user_exercise_favorites (user_id, name, calories, default_duration, sort_order)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT (user_id, name) DO NOTHING`,
          [f.user_id, f.name, Number(f.calories) || 0, f.default_duration || 30, f.sort_order || 0]
        );
      }
    }

    // 6. Verify
    console.log("\n--- Verification ---");
    if (dry) {
      console.log("[DRY] Would run verification queries");
    } else {
      r = await c.query(`SELECT food_name, is_favorite, default_weight, default_serving_unit FROM user_custom_foods WHERE is_favorite = true`);
      if (r.rows.length > 0) console.table(r.rows);
      else console.log("  (no food favorites)");
      r = await c.query(`SELECT * FROM user_exercise_favorites`);
      if (r.rows.length > 0) console.table(r.rows);
      else console.log("  (no exercise favorites)");
    }

    // 7. Drop old table
    if (!dry) {
      console.log("\n--- Step 7: Drop user_quick_favorites ---");
      await c.query(`DROP TABLE IF EXISTS user_quick_favorites`);
      console.log("Dropped.");
    } else {
      console.log("\n[DRY] Would drop user_quick_favorites");
    }
    console.log("\n✅ Migration complete!");
  } finally {
    c.release();
    await pool.end();
  }
}

run().catch(e => { console.error(e); process.exit(1); });
