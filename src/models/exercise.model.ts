import { pool } from '../config/db';

interface Difficulty {
  id: string;
  level_name: string;
  target_reps: number;
  score_multiplier: number;
}

interface Exercise {
  id: string;
  name: string;
  description: string;
  calories_per_rep: number;
  difficulties: Difficulty[];
}

interface ExerciseRow {
  exercise_id: string;
  name: string;
  description: string;
  calories_per_rep: number;
  difficulty_id: string;
  level_name: string;
  target_reps: number;
  score_multiplier: number;
}
const getAllExercises = async (): Promise<Exercise[]> => {
  const result = await pool.query<ExerciseRow>(
    `SELECT e.id AS exercise_id, e.name, e.description, e.calories_per_rep,
        ed.id AS difficulty_id, ed.level_name, ed.target_reps, ed.score_multiplier
        FROM exercises e
        JOIN exercise_difficulties ed
        ON ed.exercise_id = e.id
        WHERE e.is_active = true
        ORDER BY e.name, ed.level_name`
  );

  const exerciseMap: Record<string, Exercise> = {};

  for (const row of result.rows) {
    if (!exerciseMap[row.exercise_id]) {
      // First time we see this exercise - create its entry with an empty difficulties array
      exerciseMap[row.exercise_id] = {
        id: row.exercise_id,
        name: row.name,
        description: row.description,
        calories_per_rep: row.calories_per_rep,
        difficulties: [],
      };
    }
    // Whether new or existing - always push this row's difficulty into the array
    exerciseMap[row.exercise_id].difficulties.push({
      id: row.difficulty_id,
      level_name: row.level_name,
      target_reps: row.target_reps,
      score_multiplier: row.score_multiplier,
    });
  }

  // Reshape the flat rows -> nested objects
  // Based on the API specs, getting all exercises should return the following format:
  /*
[
  {
    "id": "uuid",
    "name": "Squats",
    "description": "Standard squat exercise",
    "calories_per_rep": 0.32,
    "difficulties": [
      { "id": "uuid", "level_name": "Easy",   "target_reps": 5,  "score_multiplier": 1.0 },
      { "id": "uuid", "level_name": "Medium", "target_reps": 10, "score_multiplier": 1.5 },
      { "id": "uuid", "level_name": "Hard",   "target_reps": 20, "score_multiplier": 2.0 }
    ]
  }
]
*/

  return Object.values(exerciseMap);
};

export { getAllExercises, Exercise };
