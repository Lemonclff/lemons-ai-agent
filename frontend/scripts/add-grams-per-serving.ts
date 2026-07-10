/**
 * Patch: add grams_per_serving to user_custom_foods, populate from cache
 * Run: cd /home/lemon/lemons-ai-agent/frontend && npx tsx scripts/add-grams-per-serving.ts
 */
import { Pool } from "pg";

const DB_URL = "postgresql://admin:Lemonclf0428!@127.0.0.1:5432/ai_dashboard_db";
const pool = new Pool({ connectionString: DB_URL, max: 1 });

async function run() {
  const c = await pool.connect();
  try {
    // 1. Add column
    console.log("Adding grams_per_serving column...");
    await c.query(`ALTER TABLE user_custom_foods ADD COLUMN IF NOT EXISTS grams_per_serving NUMERIC`);
    console.log("Done.");

    // 2. Populate: for foods with known calories_per_100g, estimate grams
    //    Look up average (calories / calories_per_100g) * 100 from daily_food_logs
    console.log("\nPopulating grams_per_serving from log history...");
    const rows = await c.query(
      `SELECT id, food_name, calories_per_100g FROM user_custom_foods WHERE grams_per_serving IS NULL AND calories_per_100g > 0`
    );

    for (const row of rows.rows) {
      // Find log entries for this food with known serving_unit
      const logs = await c.query(
        `SELECT amount, serving_unit, calories
         FROM daily_food_logs
         WHERE user_id = 1 AND food_name ILIKE $1
         ORDER BY log_date DESC LIMIT 10`,
        [row.food_name]
      );

      if (logs.rows.length > 0) {
        // Calculate avg grams per serving from log data
        let totalCal = 0, totalAmount = 0, count = 0;
        for (const log of logs.rows) {
          const unit = (log.serving_unit || 'g').toLowerCase();
          if (unit === 'g' || unit === 'ml') {
            // Already in grams — use as-is
            totalCal += Number(log.calories) || 0;
            totalAmount += Number(log.amount) || 0;
            count++;
          } else {
            // Serving unit — estimate grams from calories ratio
            // grams_per_serving = (logged_calories / calories_per_100g) * 100
            if (Number(log.calories) > 0 && Number(row.calories_per_100g) > 0) {
              const estimated = (Number(log.calories) / Number(row.calories_per_100g)) * 100;
              totalAmount += estimated;
              count++;
            }
          }
        }
        if (count > 0) {
          const avg = Math.round(totalAmount / count);
          await c.query(
            `UPDATE user_custom_foods SET grams_per_serving = $1 WHERE id = $2`,
            [avg, row.id]
          );
          console.log(`  ${row.food_name}: grams_per_serving = ${avg} (from ${count} log entries)`);
        }
      } else {
        // No log data — use reasonable default
        console.log(`  ${row.food_name}: no log data, skipping`);
      }
    }

    // 3. Verify
    console.log("\n--- Final state ---");
    const final = await c.query(
      `SELECT food_name, default_weight, default_serving_unit, calories_per_100g, grams_per_serving
       FROM user_custom_foods WHERE is_favorite = true`
    );
    console.table(final.rows);

    console.log("\nDone.");
  } finally {
    c.release();
    await pool.end();
  }
}

run().catch(e => { console.error(e); process.exit(1); });
