import 'dotenv/config';
import express from 'express';
import authRouter from './routes/auth.routes';
import cors from 'cors';
import helmet from 'helmet';
import { connectDB } from './config/db';

const app = express();
const PORT = process.env.PORT || 3000;

// helmet, cors, and express.json must be registered before routes
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use('/api/v1/auth', authRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const startServer = async (): Promise<void> => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server now running on port ${PORT}`);
  });
};

startServer();
