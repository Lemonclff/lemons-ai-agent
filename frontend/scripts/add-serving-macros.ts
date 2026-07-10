/**
 * Migration: add serving_calories/protein/carbs/fat to user_custom_foods
 * Run: cd /home/lemon/lemons-ai-agent/frontend && npx tsx scripts/add-serving-macros.ts
 */
import { Pool } from "pg";

const DB_URL = "postgresql://admin:Lemonclf0428!@127.0.0.1:5432/ai_dashboard_db";
const pool = new Pool({ connectionString: DB_URL, max: 1 });

async function run() {
  const c = await pool.connect();
  try {
    // 1. Add columns
    console.log("Adding serving nutrition columns...");
    for (const col of [
      "ALTER TABLE user_custom_foods ADD COLUMN IF NOT EXISTS serving_calories NUMERIC",
      "ALTER TABLE user_custom_foods ADD COLUMN IF NOT EXISTS serving_protein NUMERIC",
      "ALTER TABLE user_custom_foods ADD COLUMN IF NOT EXISTS serving_carbs NUMERIC",
      "ALTER TABLE user_custom_foods ADD COLUMN IF NOT EXISTS serving_fat NUMERIC",
    ]) {
      await c.query(col);
    }
    console.log("Done.");

    // 2. Populate from daily_food_logs: for each favorited food, get the most
    //    recent log entry and use its actual nutrition values
    console.log("\nPopulating serving macros from log history...");
    const rows = await c.query(
      `SELECT id, food_name FROM user_custom_foods WHERE is_favorite = true AND serving_calories IS NULL`
    );

    for (const row of rows.rows) {
      // Get the most recent log entry for this food
      const logs = await c.query(
        `SELECT amount, serving_unit, calories, protein, carbs, fat
         FROM daily_food_logs
         WHERE user_id = 1 AND food_name ILIKE $1 AND calories > 0
         ORDER BY log_date DESC, created_at DESC LIMIT 1`,
        [row.food_name]
      );

      if (logs.rows[0]) {
        const log = logs.rows[0];
        const unit = (log.serving_unit || 'g').toLowerCase();
        let servingCal = Number(log.calories);
        let servingP = Number(log.protein) || 0;
        let servingC = Number(log.carbs) || 0;
        let servingF = Number(log.fat) || 0;

        // If logged with multiple servings, normalize to per-serving
        if (unit !== 'g' && unit !== 'ml' && Number(log.amount) > 1) {
          const amt = Number(log.amount) || 1;
          servingCal = Math.round(servingCal / amt);
          servingP = parseFloat((servingP / amt).toFixed(1));
          servingC = parseFloat((servingC / amt).toFixed(1));
          servingF = parseFloat((servingF / amt).toFixed(1));
        }

        await c.query(
          `UPDATE user_custom_foods SET serving_calories=$1, serving_protein=$2, serving_carbs=$3, serving_fat=$4 WHERE id=$5`,
          [servingCal, servingP, servingC, servingF, row.id]
        );
        console.log(`  ${row.food_name}: serving_cal=${servingCal}, P=${servingP}, C=${servingC}, F=${servingF}`);
      } else {
        console.log(`  ${row.food_name}: no log data found`);
      }
    }

    // 3. Verify
    console.log("\n--- Final state ---");
    const final = await c.query(
      `SELECT food_name, default_serving_unit, grams_per_serving,
              serving_calories, serving_protein, serving_carbs, serving_fat
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
