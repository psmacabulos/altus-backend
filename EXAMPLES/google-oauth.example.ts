/**
 * EXAMPLE FILE — Google OAuth login, all four layers
 * Context: the same fake "library" app (members, not users) used by
 * service.example.ts / model.example.ts / controller.example.ts / routes.example.ts.
 * Not your actual code. This file shows what to ADD to each real file —
 * it is split into PARTS, one per destination file, so you can find
 * "where does this go" quickly.
 *
 * REFERENCE DOCS:
 *
 * google-auth-library npm page
 *   https://www.npmjs.com/package/google-auth-library
 * OAuth2Client#verifyIdToken
 *   https://github.com/googleapis/google-auth-library-nodejs#verifying-a-id-token
 */

import { OAuth2Client } from 'google-auth-library';
import { DatabaseError } from 'pg';
import { pool } from '../src/config/db'; // real: '../config/db'
import { Member, SafeMember, findByEmail } from './model.example'; // real: '../models/user.model'
import { AppError, generateJWT } from './service.example'; // real: same file — this function lives ALONGSIDE register/login

// =============================================================================
// PART A — belongs in a NEW FILE: src/services/google.service.ts
// =============================================================================
//
// This layer's only job: hand it a token, get back a TRUSTED identity.
// It knows nothing about your database or your members table — same
// separation of concerns as bcrypt.example.ts knowing nothing about SQL.

// Created ONCE, at module load — same reasoning as the pg Pool in db.ts.
// Re-creating this per request would be wasteful and pointless; it holds
// no per-request state.
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// The only fields the rest of the app needs. Google's payload has more
// (name, picture, locale...) but you decided usernames come from email,
// so there is no reason to carry fields nothing will read — Lesson from
// Phase 9: SafeMember / Member split for the same "only expose what's used" reason.
interface GoogleIdentity {
  googleId: string;
  email: string;
}

const verifyGoogleToken = async (idToken: string): Promise<GoogleIdentity> => {
  // verifyIdToken does THREE things in one call:
  //   1. Checks the signature against Google's public keys (fetched once,
  //      cached, refreshed automatically by the library — you never touch this)
  //   2. Checks the token hasn't expired
  //   3. Checks "audience" — that this token was issued FOR YOUR app
  //      (your GOOGLE_CLIENT_ID), not some other app that also uses
  //      Google Sign-In. Skipping this check would let a token meant for
  //      a totally different website be replayed against your API.
  // If ANY of these fail, the library itself throws — you don't need to
  // hand-roll that logic.
  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
  } catch (error: unknown) {
    // Translate the library's raw error into YOUR error type — same
    // pattern as translating a Postgres DatabaseError into an AppError.
    // The controller only ever needs to understand AppError.
    throw new AppError('Invalid Google token', 401);
  }

  const payload = ticket.getPayload();

  // getPayload() is typed as "possibly undefined" — TypeScript is right
  // to make you check. In practice this only happens if the token is
  // malformed in a way verifyIdToken didn't already catch.
  if (!payload || !payload.email) {
    throw new AppError('Invalid Google token', 401);
  }

  // email_verified: Google's own confirmation that this address is real.
  // This matters because of a decision you made — a Google sign-in with
  // a MATCHING email auto-links to an existing password account with no
  // further proof. That's only safe because Google is vouching for the
  // email. If this were false, you'd be trusting an unverified claim.
  if (!payload.email_verified) {
    throw new AppError('Google account email is not verified', 401);
  }

  return {
    googleId: payload.sub, // Google's permanent, unique id for this person
    email: payload.email,
  };
};

export { verifyGoogleToken };

// =============================================================================
// PART B — ADD to the existing src/models/user.model.ts
// =============================================================================
//
// Three new functions alongside your existing createMember / findByEmail /
// findById. Same rules as always: SQL only, no business logic, no hashing.

// Used by loginWithGoogle — the FIRST lookup, before falling back to email.
const findByGoogleId = async (googleId: string): Promise<Member | null> => {
  const result = await pool.query<Member>(
    `SELECT id, username, email, password_hash, google_id, role, created_at
     FROM members
     WHERE google_id = $1`,
    [googleId]
  );
  return result.rows[0] ?? null;
};

// Used when an existing password-only account signs in with Google for
// the first time. Note this is an UPDATE, not an INSERT — the member
// row already exists, it just gains a google_id.
const linkGoogleId = async (memberId: string, googleId: string): Promise<SafeMember> => {
  const result = await pool.query<SafeMember>(
    `UPDATE members
     SET google_id = $1
     WHERE id = $2
     RETURNING id, username, email, google_id, role, created_at`,
    [googleId, memberId]
  );
  return result.rows[0];
};

// Used for a brand-new Google signup. password_hash is simply never
// passed — it stays NULL, which your CHECK constraint allows because
// google_id is present. Mirrors createMember(), minus the password.
const createMemberFromGoogle = async (
  username: string,
  email: string,
  googleId: string
): Promise<SafeMember> => {
  const result = await pool.query<SafeMember>(
    `INSERT INTO members (username, email, google_id)
     VALUES ($1, $2, $3)
     RETURNING id, username, email, google_id, role, created_at`,
    [username, email, googleId]
  );
  return result.rows[0];
};

export { findByGoogleId, linkGoogleId, createMemberFromGoogle };

// =============================================================================
// PART C — ADD to the existing src/services/auth.service.ts
// =============================================================================
//
// This is the orchestration: verify → decide which of the three branches
// applies → sign a JWT exactly the way login() and register() already do.

const loginWithGoogle = async (idToken: string): Promise<{ token: string; member: SafeMember }> => {
  const { googleId, email } = await verifyGoogleToken(idToken);

  // BRANCH 1 — already linked. Nothing to write, just load and sign.
  let member: SafeMember | null = await findByGoogleId(googleId);

  if (!member) {
    const existing = await findByEmail(email);

    if (existing) {
      // BRANCH 2 — same email, first time using Google. Auto-link, per
      // your decision: Google already vouched for this email above.
      member = await linkGoogleId(existing.id, googleId);
    } else {
      // BRANCH 3 — never seen this person. Derive a username from the
      // email and try to create the account, retrying on collision.
      //
      // Why a try/catch loop instead of a "check if taken" query first?
      // Checking-then-inserting has a race condition (two requests could
      // both check, both see it's free, both try to insert). Catching
      // the UNIQUE constraint violation — same 23505 code register()
      // already handles — is the pattern that's actually safe under
      // concurrency, and reuses a mental model you already have.
      const base = email.split('@')[0].slice(0, 50);
      let candidate = base;
      let attempt = 0;
      const MAX_ATTEMPTS = 5;

      while (true) {
        try {
          member = await createMemberFromGoogle(candidate, email, googleId);
          break;
        } catch (error: unknown) {
          attempt++;
          const isUsernameCollision =
            error instanceof DatabaseError &&
            error.code === '23505' &&
            error.constraint === 'members_username_key';

          if (!isUsernameCollision || attempt >= MAX_ATTEMPTS) {
            throw error; // not a username collision, or we've tried enough — bubble up
          }
          candidate = `${base}${attempt}`.slice(0, 50);
        }
      }
    }
  }

  // All three branches converge here — this is the SAME generateJWT
  // your password login uses. The frontend cannot tell, from the token
  // alone, which branch fired — nor should it need to.
  const token = generateJWT(member.id);

  return { token, member };
};

export { loginWithGoogle };

// =============================================================================
// PART D — ADD to the existing src/controllers/auth.controller.ts
// =============================================================================
//
// Same shape as handleRegister / handleLogin — unpack, call service, respond.

// (import loginWithGoogle alongside register/login at the top of the real file)

const handleGoogleLogin = async (req: import('express').Request, res: import('express').Response): Promise<void> => {
  try {
    const { idToken } = req.body;
    const result = await loginWithGoogle(idToken);

    // 200, not 201 — from the CLIENT's point of view this is always an
    // authentication action, same as /login. Whether a row happened to
    // get created behind the scenes (branch 3) is an implementation
    // detail, not something the response status should communicate.
    res.status(200).json(result);
  } catch (error: unknown) {
    // reuse the SAME handleError already defined in the real controller.ts
    // (see controller.example.ts) — not repeated here.
  }
};

export { handleGoogleLogin };

// =============================================================================
// PART E — ADD to the existing src/routes/auth.routes.ts
// =============================================================================
//
//   import { handleGoogleLogin } from '../controllers/auth.controller';
//   router.post('/google', handleGoogleLogin);
//
// Mounted the same way the rest of auth.routes.ts already is (at /v1/auth
// in index.ts) — this becomes POST /v1/auth/google. No new mounting step needed.

// =============================================================================
// WHAT THIS FEATURE DOES NOT DO
// =============================================================================
//
// - It never receives or stores a Google PASSWORD — only a token proving
//   identity, already authenticated by Google.
// - It never trusts the frontend's claim of who the user is — the
//   backend re-derives identity itself from the verified token, every time.
// - It does not delete or block password login for linked accounts —
//   after auto-linking, that member can still log in with either method.
