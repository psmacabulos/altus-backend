import { pool } from '../config/db';

interface AchievementBase {
  id: string;
  name: string;
  description: string;
  badge_image: string | null;
}

interface Achievement extends AchievementBase {
  requirement_type: string;
  requirement_value: number;
}

interface UserAchievement extends AchievementBase {
  unlocked_at: Date;
}

interface UnlockedAchievement {
  user_id: string;
  achievement_id: string;
  unlocked_at: Date;
}

// two tables are involved: achievements table and user_achievements table

const getUserAchievements = async (user_id: string): Promise<UserAchievement[]> => {
  const result = await pool.query(
    `SELECT a.id, a.name, a.description, a.badge_image, 
    ua.unlocked_at
    FROM achievements a
    JOIN user_achievements ua
    ON ua.achievement_id = a.id
    WHERE ua.user_id = $1
    ORDER BY ua.unlocked_at, a.name`,
    [user_id]
  );

  return result.rows;
};

const getAll = async (): Promise<Achievement[]> => {
  const result = await pool.query(`SELECT id, name, description, badge_image,
    requirement_type, requirement_value FROM achievements;`);

  return result.rows;
};

const unlock = async (userId: string, achievementId: string): Promise<UnlockedAchievement> => {
  const result = await pool.query(
    `INSERT INTO user_achievements (user_id, achievement_id)
    VALUES ($1, $2)  ON CONFLICT DO NOTHING
    RETURNING user_id, achievement_id, unlocked_at`,
    [userId, achievementId]
  );

  return result.rows[0];
};

export { getUserAchievements, getAll, unlock };
