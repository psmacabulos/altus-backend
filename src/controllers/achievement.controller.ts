import { Response, Request } from 'express';
import { AppError } from '../services/auth.service';
import { getMyAchievements } from '../services/achievement.service';

const handleError = (error: unknown, res: Response): void => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  res.status(500).json({ error: 'Something went wrong' });
};

const handleGetMyAchievements = async (req: Request, res: Response): Promise<void> => {
  try {
    const user_id = req.user!.userId;
    const result = await getMyAchievements(user_id);
    res.status(200).json(result);
  } catch (error) {
    handleError(error, res);
  }
};

export { handleGetMyAchievements };
