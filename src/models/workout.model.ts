import { pool } from '../config/db';

interface CreateSessionInput {
  user_id: string;
  exercise_difficulty_id: string;
  reps_completed: number;
  score: number;
  duration_seconds: number;
  calories_burned: number;
}

interface WorkoutSession {
  id: string;
  score: number;
  calories_burned: number;
  completed_at: Date;
}

interface WorkoutHistoryRow {
  id: string;
  exercise: string;
  difficulty: string;
  reps_completed: number;
  score: number;
  duration_seconds: number;
  calories_burned: number;
  completed_at: Date;
}
interface Stats {
  session_count: number;
  total_reps: number;
  total_calories: number;
}

const createSession = async ({
  user_id,
  exercise_difficulty_id,
  reps_completed,
  score,
  duration_seconds,
  calories_burned,
}: CreateSessionInput): Promise<WorkoutSession> => {
  const result = await pool.query<WorkoutSession>(
    `
    INSERT INTO workout_sessions(
    user_id, exercise_difficulty_id, reps_completed, score, duration_seconds, calories_burned)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, score, calories_burned, completed_at`,
    [user_id, exercise_difficulty_id, reps_completed, score, duration_seconds, calories_burned]
  );
  return result.rows[0];
};

const getSessionsByUser = async (user_id: string): Promise<WorkoutHistoryRow[]> => {
  const result = await pool.query<WorkoutHistoryRow>(
    `
    SELECT w.id, e.name AS exercise, ed.level_name AS difficulty, w.reps_completed,
    w.score,w.duration_seconds, w.calories_burned, w.completed_at
    FROM workout_sessions w
    JOIN exercise_difficulties ed
    ON ed.id = w.exercise_difficulty_id
    JOIN exercises as e
    ON e.id = ed.exercise_id
    WHERE w.user_id = $1
    ORDER BY w.completed_at DESC`,
    [user_id]
  );
  return result.rows;
};

interface CalculationRequirement {
  score_multiplier: number;
  calories_per_rep: number;
}
// We need the score_multiplier and calories_per_rep in the service
const findDifficultyById = async (id: string): Promise<CalculationRequirement | null> => {
  const result = await pool.query<CalculationRequirement>(
    `SELECT ed.score_multiplier , e.calories_per_rep
    FROM exercise_difficulties ed
    JOIN exercises e
    ON e.id = ed.exercise_id
    WHERE ed.id = $1 `,
    [id]
  );
  return result.rows[0] ?? null;
};

const getAllUserStats = async (userId: string): Promise<Stats> => {
  const result = await pool.query(
    `SELECT
  COUNT(*) AS session_count,
  COALESCE(SUM(reps_completed), 0) AS total_reps,
  COALESCE(SUM(calories_burned), 0) AS total_calories
  FROM workout_sessions
  WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0];
};
export {
  createSession,
  getSessionsByUser,
  findDifficultyById,
  WorkoutSession,
  WorkoutHistoryRow,
  Stats,
  getAllUserStats,
};
