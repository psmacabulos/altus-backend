import { AppError } from './auth.service';
import {
  createSession,
  getSessionsByUser,
  findDifficultyById,
  WorkoutSession,
  WorkoutHistoryRow,
  getAllUserStats,
  Stats,
} from '../models/workout.model';
import { evaluateAchievements } from './achievement.service';
import { UserAchievement } from '../models/achievement.model';

interface WorkoutStats {
  sessions: WorkoutHistoryRow[];
  stats: Stats;
}

const saveSession = async (
  exercise_difficulty_id: string,
  reps_completed: number,
  user_id: string,
  duration_seconds: number
): Promise<WorkoutSession & { new_achievements: UserAchievement[] }> => {
  const difficulty = await findDifficultyById(exercise_difficulty_id);
  if (!difficulty) {
    throw new AppError('Non-existent exercise difficulty id', 404);
  }
  const score = Math.round(difficulty.score_multiplier * reps_completed);
  const calories_burned = difficulty.calories_per_rep * reps_completed;

  const session = await createSession({
    user_id,
    exercise_difficulty_id,
    reps_completed,
    score,
    duration_seconds,
    calories_burned,
  });
  const stats = await getAllUserStats(user_id);
  const new_achievements = await evaluateAchievements(user_id, stats);
  return { ...session, new_achievements };
};

const getMyHistory = async (user_id: string): Promise<WorkoutStats> => {
  const sessions = await getSessionsByUser(user_id);
  const stats = await getAllUserStats(user_id);
  return { sessions, stats };
};
export { saveSession, getMyHistory, WorkoutStats };
