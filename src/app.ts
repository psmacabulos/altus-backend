import 'dotenv/config';
import express from 'express';
import authRouter from './routes/auth.routes';
import exerciseRouter from './routes/exercise.routes';
import workoutRouter from './routes/workout.routes';
import achievementRouter from './routes/achievement.routes';
import cors from 'cors';
import helmet from 'helmet';

const app = express();

// helmet, cors, and express.json must be registered before routes
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use('/v1/auth', authRouter);
app.use('/v1/exercises', exerciseRouter);
app.use('/v1/workout_sessions', workoutRouter);
app.use('/v1/users/me', achievementRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default app;
