import { NextRequest, NextResponse } from "next/server";

/* ================================================================
   Exercise MET Reference Table
   GET /api/nutrition/exercises
   ================================================================ */

export function GET() {
  const exercises = [
    { name: "Running (8 km/h)", met: 8.0, category: "Cardio" },
    { name: "Running (10 km/h)", met: 10.0, category: "Cardio" },
    { name: "Running (12 km/h)", met: 12.0, category: "Cardio" },
    { name: "Brisk Walking (5.5 km/h)", met: 4.5, category: "Cardio" },
    { name: "Walking (4 km/h)", met: 3.0, category: "Cardio" },
    { name: "Cycling (moderate)", met: 6.0, category: "Cardio" },
    { name: "Cycling (vigorous)", met: 8.0, category: "Cardio" },
    { name: "Swimming (moderate)", met: 7.0, category: "Cardio" },
    { name: "Jump Rope", met: 10.0, category: "Cardio" },
    { name: "HIIT Training", met: 8.0, category: "Cardio" },
    { name: "Rowing Machine", met: 7.0, category: "Cardio" },
    { name: "Elliptical Trainer", met: 5.0, category: "Cardio" },
    { name: "Stair Climber", met: 8.0, category: "Cardio" },
    { name: "Weight Training", met: 5.0, category: "Strength" },
    { name: "Bodyweight Exercise", met: 4.5, category: "Strength" },
    { name: "Yoga", met: 3.0, category: "Flexibility" },
    { name: "Pilates", met: 3.5, category: "Flexibility" },
    { name: "Tai Chi", met: 3.5, category: "Flexibility" },
    { name: "Hiking", met: 6.5, category: "Outdoor" },
    { name: "Basketball", met: 6.5, category: "Sports" },
    { name: "Badminton", met: 5.5, category: "Sports" },
    { name: "Table Tennis", met: 4.0, category: "Sports" },
    { name: "Aerobic Dance", met: 6.0, category: "Cardio" },
    { name: "Dance", met: 5.0, category: "Cardio" },
    { name: "House Cleaning", met: 3.0, category: "Daily" },
    { name: "Walking Dog", met: 3.0, category: "Daily" },
  ];

  return NextResponse.json({ exercises });
}
