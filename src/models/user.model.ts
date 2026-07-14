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
  const result = await pool.query<User>(
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

// Used by loginWithGoogle — never needs password_hash (this branch never
// compares a password), so it's excluded, same as findById().
const findByGoogleId = async (googleId: string): Promise<SafeUser | null> => {
  const result = await pool.query<SafeUser>(
    `SELECT id, username, email, google_id, role, created_at, updated_at
    FROM users
    WHERE google_id = $1`,
    [googleId]
  );
  return result.rows[0] ?? null;
};

// Used when an existing password-only account signs in with google
// for the first time.
const linkGoogleId = async (userId: string, googleId: string): Promise<SafeUser> => {
  const result = await pool.query(
    `UPDATE users
    SET google_id = $1
    WHERE id = $2
    RETURNING id, username, email, google_id, role, created_at, updated_at`,
    [googleId, userId]
  );
  return result.rows[0];
};

// Used for brand new Google signup
const createMemberFromGoogle = async (
  username: string,
  email: string,
  googleId: string
): Promise<SafeUser> => {
  const result = await pool.query(
    `INSERT INTO users (username, email, google_id)
    VALUES($1, $2, $3)
    RETURNING id, username, email, google_id, role, created_at, updated_at`,
    [username, email, googleId]
  );
  return result.rows[0];
};

export { createMemberFromGoogle, findByGoogleId, linkGoogleId };
