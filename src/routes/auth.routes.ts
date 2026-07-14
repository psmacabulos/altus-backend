import { Router } from 'express';
import { handleGoogleLogin, handleLogin, handleRegister } from '../controllers/auth.controller';

const router = Router();

router.post('/register', handleRegister);
router.post('/login', handleLogin);
router.post('/google', handleGoogleLogin);

export default router;
