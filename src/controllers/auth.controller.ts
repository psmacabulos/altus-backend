import { login, register, AppError } from '../services/auth.service';
import { Response, Request } from 'express';

const handleError = (error: unknown, res: Response): void => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  res.status(500).json({ error: 'Something went wrong' });
};

const handleRegister = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password } = req.body;
    const result = await register({ username, email, password });
    res.status(201).json(result);
  } catch (error) {
    handleError(error, res);
  }
};

const handleLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const result = await login(email, password);
    res.status(200).json(result);
  } catch (error) {
    handleError(error, res);
  }
};

export { handleRegister, handleLogin };
