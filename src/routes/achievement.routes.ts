import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { handleGetMyAchievements } from '../controllers/achievement.controller';

const router = Router();

router.get('/achievements', requireAuth, handleGetMyAchievements);

export default router;
