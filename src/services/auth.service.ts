import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import {
  createUser,
  findByEmail,
  SafeUser,
  createMemberFromGoogle,
  findByGoogleId,
  linkGoogleId,
} from '../models/user.model';
import { DatabaseError } from 'pg';
import { verifyGoogleToken } from './google.service';

// Extend Error to carry Status Code for the controller to read
class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

const generateJWT = (userId: string): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_secret not set');
  }

  return jwt.sign({ userId }, secret, { expiresIn: '7d' });
};

interface RegisterInput {
  username: string;
  email: string;
  password: string;
}
const register = async ({
  username,
  email,
  password,
}: RegisterInput): Promise<{ token: string; user: SafeUser }> => {
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const user = await createUser({ username, email, passwordHash });
    const token = generateJWT(user.id);
    return { token, user };
  } catch (error: unknown) {
    if (error instanceof DatabaseError && error.code === '23505') {
      if (error.constraint === 'users_email_key') {
        throw new AppError('Email already registered', 409);
      }
      if (error.constraint === 'users_username_key') {
        throw new AppError('Username already registered', 409);
      }
    }
    throw error; // to be handled up the flow
  }
};

const login = async (
  email: string,
  password: string
): Promise<{ token: string; user: SafeUser }> => {
  const user = await findByEmail(email);

  if (!user || !user.password_hash) {
    throw new AppError('Invalid credentials', 401);
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    throw new AppError('Invalid credentials', 401);
  }

  const token = generateJWT(user.id);

  const { password_hash: _password_hash, ...safeUser } = user;

  return { token, user: safeUser };
};

export { login, register, generateJWT, AppError };

const loginWithGoogle = async (id_token: string): Promise<{ token: string; user: SafeUser }> => {
  const { googleId, email } = await verifyGoogleToken(id_token);

  // Branch 1 - already linked. Nothing to write, just load and sign
  let user: SafeUser | null = await findByGoogleId(googleId);

  if (!user) {
    const existing = await findByEmail(email);

    if (existing) {
      // Branch 2 - same email, first time using Google, Auto link
      user = await linkGoogleId(existing.id, googleId);
    } else {
      // never seen this person. Derive a username from the email and try to create
      // an account, retrying on collission
      const base = email.split('@')[0].slice(0, 50);
      let candidate = base;
      let attempt = 0;
      const MAX_ATTEMPTS = 5;

      while (true) {
        try {
          user = await createMemberFromGoogle(candidate, email, googleId);
          break;
        } catch (error: unknown) {
          attempt++;
          const isUsernameCollision =
            error instanceof DatabaseError &&
            error.code === '23505' &&
            error.constraint === 'users_username_key';
          if (!isUsernameCollision || attempt >= MAX_ATTEMPTS) {
            throw error;
          }
          candidate = `${base}${attempt}`.slice(0, 50);
        }
      }
    }
  }
  const token = generateJWT(user.id);
  return { token, user };
};

export { loginWithGoogle };
