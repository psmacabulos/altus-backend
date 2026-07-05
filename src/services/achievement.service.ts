import { unlock, getAll, UserAchievement, getUserAchievements } from '../models/achievement.model';
import { Stats } from '../models/workout.model';

const evaluateAchievements = async (user_id: string, stats: Stats): Promise<UserAchievement[]> => {
  //list first the all achievements that contain the criteria for unlock
  const allAchievements = await getAll();
  const newAchievements = [];

  // loop through all possible achievements
  for (const achievement of allAchievements) {
    // get the value of requirement type from user data (stats)
    const userStatValue = stats[achievement.requirement_type as keyof Stats];
    if (userStatValue >= achievement.requirement_value) {
      const result = await unlock(user_id, achievement.id);
      if (result) {
        newAchievements.push({
          id: achievement.id,
          name: achievement.name,
          description: achievement.description,
          badge_image: achievement.badge_image,
          unlocked_at: result.unlocked_at,
        });
      }
    }
  }
  return newAchievements;
};

const getMyAchievements = async (user_id: string): Promise<UserAchievement[]> => {
  return await getUserAchievements(user_id);
};
export { evaluateAchievements, getMyAchievements };
