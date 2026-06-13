import { Response, Request, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface JwtPayload {
  userId: string;
}

const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  // Read the authorization header
  // Frontend sends - Authorization: Bearer <token>
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token never call next()
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  const token = authHeader.split(' ')[1];
  // Verify the token

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    req.user = { userId: decoded.userId };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export { requireAuth };
