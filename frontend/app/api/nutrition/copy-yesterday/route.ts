import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserId } from "@/lib/nutrition-auth";

/** Local YYYY-MM-DD (avoids UTC off-by-one near midnight). */
function localDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function POST(req: NextRequest) {
  const uid = getUserId(req);
  if (uid === 0) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));

    const today = (body.log_date as string) || localDateStr();
    const sourceDate = (body.source_date as string) || (() => {
      const d = new Date(today + "T12:00:00");
      d.setDate(d.getDate() - 1);
      return localDateStr(d);
    })();

    const copyFood = body.copy_food !== false;
    const copyExercise = body.copy_exercise !== false;
    const preview = body.preview === true;
    /** Array of food_names to copy (omit = copy all available) */
    const foodNames: string[] | undefined = body.food_names;
    /** Array of exercise_names to copy (omit = copy all available) */
    const exerciseNames: string[] | undefined = body.exercise_names;

    let foodCopied = 0;
    let exerciseCopied = 0;
    let availableFoods: any[] = [];
    let availableExercises: any[] = [];

    /* ── Copy/Preview Food Logs ── */
    if (copyFood) {
      const sourceFoods = await query(
        `SELECT meal_type, food_name, amount, serving_unit, calories, protein, carbs, fat, source
         FROM daily_food_logs WHERE user_id = $1 AND log_date = $2`,
        [uid, sourceDate]
      );

      // Preview: show all items from source, no dedup (frontend sends source_date as log_date in preview)
      if (preview) {
        availableFoods = sourceFoods.rows.map((l: any) => ({
          food_name: l.food_name,
          meal_type: l.meal_type,
          calories: l.calories,
          protein: l.protein,
          carbs: l.carbs,
          fat: l.fat,
          amount: l.amount,
          serving_unit: l.serving_unit || "g",
        }));
      } else {
        // Dedup: only items not already logged today
        const notYetCopied = [];
        for (const log of sourceFoods.rows) {
          const existing = await query(
            `SELECT id FROM daily_food_logs
             WHERE user_id = $1 AND log_date = $2 AND food_name = $3 AND meal_type = $4 LIMIT 1`,
            [uid, today, log.food_name, log.meal_type]
          );
          if (existing.rows.length === 0) {
            notYetCopied.push(log);
          }
        }

        const selected = foodNames && foodNames.length > 0
          ? notYetCopied.filter((l: any) => foodNames.includes(l.food_name))
          : notYetCopied;

        for (const log of selected) {
          await query(
            `INSERT INTO daily_food_logs
               (user_id, log_date, meal_type, food_name, amount, serving_unit, calories, protein, carbs, fat, source)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'copy')`,
            [
              uid, today, log.meal_type, log.food_name, log.amount,
              log.serving_unit || "g", log.calories, log.protein, log.carbs, log.fat,
            ]
          );
          foodCopied++;
        }
      }
    }

    /* ── Copy/Preview Exercise Logs ── */
    if (copyExercise) {
      const sourceExercises = await query(
        `SELECT exercise_name, duration_min, met_value, calories_burned
         FROM exercise_logs WHERE user_id = $1 AND log_date = $2`,
        [uid, sourceDate]
      );

      // Preview: show all items from source, no dedup
      if (preview) {
        availableExercises = sourceExercises.rows.map((e: any) => ({
          exercise_name: e.exercise_name,
          duration_min: e.duration_min,
          met_value: e.met_value,
          calories_burned: e.calories_burned,
        }));
      } else {
        // Dedup: only items not already logged today
        const notYetCopied = [];
        for (const ex of sourceExercises.rows) {
          const existing = await query(
            `SELECT id FROM exercise_logs
             WHERE user_id = $1 AND log_date = $2 AND exercise_name = $3 LIMIT 1`,
            [uid, today, ex.exercise_name]
          );
          if (existing.rows.length === 0) {
            notYetCopied.push(ex);
          }
        }

        const selected = exerciseNames && exerciseNames.length > 0
          ? notYetCopied.filter((e: any) => exerciseNames.includes(e.exercise_name))
          : notYetCopied;

        for (const ex of selected) {
          await query(
            `INSERT INTO exercise_logs
               (user_id, log_date, exercise_name, duration_min, met_value, calories_burned)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [uid, today, ex.exercise_name, ex.duration_min, ex.met_value, ex.calories_burned]
          );
          exerciseCopied++;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      food_copied: foodCopied,
      exercise_copied: exerciseCopied,
      from: sourceDate,
      to: today,
      preview,
      // Always return available lists (non-empty when preview or when we have data)
      available_foods: availableFoods,
      available_exercises: availableExercises,
    });

  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
