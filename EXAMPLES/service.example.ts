/**
 * EXAMPLE FILE — Auth service layer (business logic)
 * Context: a fake "library" app. Not your actual code.
 * Use this as a reference while writing src/services/auth.service.ts
 *
 * The service is the BRAIN. It makes decisions and enforces rules.
 * It knows nothing about HTTP (no req/res) and nothing about SQL —
 * it calls model functions when it needs data.
 *
 * REFERENCE DOCS:
 *
 * jsonwebtoken npm page
 *   https://www.npmjs.com/package/jsonwebtoken
 * bcryptjs — see bcrypt.example.ts in this folder
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { DatabaseError } from 'pg';
import { Member, SafeMember, createMember, findByEmail } from '../EXAMPLES/model.example'; // in real code: '../models/user.model'

// ---------------------------------------------------------------------------
// STEP 1 — A BUSINESS ERROR THAT CARRIES ITS HTTP STATUS
// ---------------------------------------------------------------------------
// The service throws errors with MEANING ("email taken"), but the controller
// must pick an HTTP status (409? 401?). Solution: a tiny error class that
// carries the status along. The controller just reads error.statusCode.
// In your real app this is worth putting in its own small file so every
// service can use it (it becomes the backbone of Phase 13's error handler).

class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message); // sets error.message
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// STEP 2 — generateJWT: the shared helper both flows end with
// ---------------------------------------------------------------------------

const generateJWT = (memberId: string): string => {
  // The secret comes from the environment — never hardcoded.
  // New env var! Must exist in .env, .env.example, and Heroku config vars.
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Fail loudly at the moment of use. A missing secret is a deployment
    // mistake — better a clear 500 than silently signing weak tokens.
    throw new Error('JWT_SECRET is not set');
  }

  // PAYLOAD: only the id.
  //  - the payload is readable by anyone (base64, not encrypted)
  //  - any other data (email, role) goes STALE — the middleware loads
  //    fresh data with findById() anyway
  // EXPIRY: tokens can't be revoked, so they must die on their own.
  return jwt.sign({ memberId }, secret, { expiresIn: '7d' });
};

// ---------------------------------------------------------------------------
// STEP 3 — register: US "a visitor creates an account"
// ---------------------------------------------------------------------------

interface RegisterInput {
  username: string;
  email: string;
  password: string; // plain text ARRIVES here — and dies here, hashed
}

const register = async (input: RegisterInput): Promise<{ token: string; member: SafeMember }> => {
  // Hash first. After this line the plain password is never used again.
  const passwordHash = await bcrypt.hash(input.password, 10);

  try {
    const member = await createMember({
      username: input.username,
      email: input.email,
      passwordHash,
    });

    // The DB generated the id during the INSERT — now we can sign.
    const token = generateJWT(member.id);
    return { token, member };
  } catch (error: unknown) {
    // TRANSLATE the database error into a business error (Lesson 61).
    // The pg driver wraps Postgres errors in its exported DatabaseError
    // class — instanceof both proves the shape at runtime AND narrows the
    // type for TypeScript (no "as" cast needed — Lesson 77).
    // 23505 = unique_violation. error.constraint says WHICH unique rule:
    // Postgres auto-names them <table>_<column>_key.
    if (error instanceof DatabaseError && error.code === '23505') {
      if (error.constraint === 'members_email_key') {
        throw new AppError('Email already registered', 409);
      }
      if (error.constraint === 'members_username_key') {
        throw new AppError('Username already taken', 409);
      }
    }
    throw error; // not ours to handle — let it bubble to the global handler
  }
};

// ---------------------------------------------------------------------------
// STEP 4 — login: US "a returning member proves who they are"
// ---------------------------------------------------------------------------

const login = async (
  email: string,
  password: string
): Promise<{ token: string; member: SafeMember }> => {
  const member = await findByEmail(email); // includes password_hash — on purpose

  // THREE failure cases, ONE error message (Lesson 56 — no user enumeration):
  //   1. no member with that email
  //   2. member exists but has NO password_hash (Google-only account!
  //      bcrypt.compare against null would crash — this branch is a real
  //      user: someone who signed up with Google trying password login)
  //   3. password doesn't match
  // An attacker must not be able to tell these apart.
  if (!member || !member.password_hash) {
    throw new AppError('Invalid credentials', 401);
  }

  const passwordMatches = await bcrypt.compare(password, member.password_hash);
  if (!passwordMatches) {
    throw new AppError('Invalid credentials', 401);
  }

  const token = generateJWT(member.id);

  // findByEmail returned the FULL row (it had to — we needed the hash).
  // Strip the hash before anything leaves the service. Destructuring +
  // rest syntax: pull password_hash out, keep "everything else" in safeMember.
  const { password_hash, ...safeMember } = member;

  return { token, member: safeMember };
};

// ---------------------------------------------------------------------------
// STEP 5 — EXPORTS
// ---------------------------------------------------------------------------

export { register, login, generateJWT, AppError };

// =============================================================
// WHAT THIS LAYER DOES NOT DO
// =============================================================
//
// - No req/res. The controller unpacks HTTP and calls these with
//   plain values; these return plain objects (or throw AppErrors).
// - No SQL. Data needs go through model functions.
// - No res.status(...) — the AppError CARRIES the status; the
//   controller is the one who sends it.
//
// =============================================================
// HOW THE CONTROLLER WILL USE THIS (preview — you'll write it next)
// =============================================================
//
//   const handleRegister = async (req, res) => {
//     try {
//       const { token, member } = await register(req.body);
//       res.status(201).json({ token, member });
//     } catch (error) {
//       if (error instanceof AppError) {
//         return res.status(error.statusCode).json({ error: error.message });
//       }
//       res.status(500).json({ error: 'Something went wrong' });
//     }
//   };
