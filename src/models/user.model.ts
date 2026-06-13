import { pool } from '../config/db';

interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string | null;
  google_id: string | null;
  role: 'user' | 'admin';
  created_at: Date;
  updated_at: Date;
}

type SafeUser = Omit<User, 'password_hash'>;

interface CreateUserInput {
  username: string;
  email: string;
  passwordHash: string;
}

const createUser = async ({
  username,
  email,
  passwordHash,
}: CreateUserInput): Promise<SafeUser> => {
  const result = await pool.query(
    `INSERT INTO users (username, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING  id, username, email, google_id, role, created_at, updated_at`,
    [username, email, passwordHash]
  );
  return result.rows[0];
};

// Used by Login Story
const findByEmail = async (email: string): Promise<User | null> => {
  const result = await pool.query(
    `SELECT id, username, email, password_hash, google_id, role, created_at, updated_at
            FROM users WHERE email = $1`,
    [email]
  );
  return result.rows[0] ?? null;
};

// Used by auth middleware
const findById = async (id: string): Promise<SafeUser | null> => {
  const result = await pool.query(
    `SELECT id, username, email, google_id, role, created_at, updated_at
            FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
};
export { createUser, findByEmail, findById, User, SafeUser };
