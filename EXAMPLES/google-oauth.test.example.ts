/**
 * EXAMPLE: Testing POST /auth/google — mocking the ONE external boundary
 * Context: the same fake "library" app (members, not users) used by
 * protected-route.test.example.ts. Not your actual code.
 * Use this as a reference while writing a new describe block in
 * src/__tests__/auth.test.ts (or a separate file, e.g. google-auth.test.ts).
 *
 * Every OTHER test in this app hits a REAL Postgres — no mocking (see
 * protected-route.test.example.ts and DEVELOPMENT.md's testing section).
 * Google is the one legitimate exception: a Jest test can't spin up a real
 * Google server, and shouldn't need live network access to a third party to
 * pass. So only verifyGoogleToken gets mocked here — everything downstream
 * of it (the real INSERT/UPDATE/SELECT against Postgres, the real JWT
 * signing) still runs for real and is genuinely being tested.
 */

import request from 'supertest';
import app from '../src/app'; // real: '../app'
import { pool } from '../src/config/db'; // real: '../config/db'
import { verifyGoogleToken } from '../src/services/google.service'; // real: '../services/google.service'

// ---------------------------------------------------------------------------
// STEP 1 — MOCK THE MODULE, NOT THE DATABASE
// ---------------------------------------------------------------------------
// jest.mock() is hoisted above the imports above by ts-jest's transform —
// by the time auth.service.ts (loaded indirectly through app, through the
// route, through the controller) does its own
//   import { verifyGoogleToken } from './google.service'
// it receives THIS fake version instead of the real one. auth.service.ts
// has no idea the difference — same reason the "layers don't know about
// each other's internals" rule from service.example.ts makes this possible.
jest.mock('../src/services/google.service'); // real: '../services/google.service'

// With no factory function passed to jest.mock(), Jest auto-mocks every
// export as a jest.fn() that returns undefined until you tell it otherwise.
// TypeScript still sees verifyGoogleToken as its normal typed function —
// this cast is what unlocks jest-only methods like .mockResolvedValueOnce
// on it without "as any" everywhere.
const mockedVerifyGoogleToken = verifyGoogleToken as jest.MockedFunction<typeof verifyGoogleToken>;

// jest.config.ts already sets clearMocks: true — mock.calls/mock.results
// reset automatically before every test in this file. That does NOT reset
// a configured return value, which is exactly why every test below sets
// its own mockResolvedValueOnce instead of relying on one set earlier.

afterAll(async () => {
  await pool.query('DELETE FROM members WHERE email = ANY($1)', [
    ['newmember@test.com', 'linked@test.com'],
  ]);
  await pool.end();
});

describe('POST /auth/google', () => {
  it('creates a new member on first-ever Google sign-in', async () => {
    mockedVerifyGoogleToken.mockResolvedValueOnce({
      googleId: 'google-id-brand-new',
      email: 'newmember@test.com',
    });

    const res = await request(app)
      .post('/auth/google')
      .send({ id_token: 'irrelevant-fake-value' });
    // That string is never actually checked — verifyGoogleToken is mocked,
    // so ANY id_token reaches it. What's under test is what loginWithGoogle()
    // DOES with the identity the mock hands back, not whether a real id_token
    // is well-formed (that's the real verifyGoogleToken's job, checked
    // separately via a manual OAuth Playground token — see PART 2 below).

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.member.email).toBe('newmember@test.com');
    expect(res.body.member.google_id).toBe('google-id-brand-new');
  });

  it('auto-links an existing password account on matching email', async () => {
    // Arrange: a REAL password member already exists — genuine INSERT,
    // nothing mocked here. This is the "existing = await findByEmail(email)"
    // branch in loginWithGoogle() finding something real.
    await request(app).post('/auth/register').send({
      username: 'LinkedMember',
      email: 'linked@test.com',
      password: 'password123',
    });

    mockedVerifyGoogleToken.mockResolvedValueOnce({
      googleId: 'google-id-linked',
      email: 'linked@test.com', // SAME email as the password account above
    });

    const res = await request(app).post('/auth/google').send({ id_token: 'irrelevant' });

    expect(res.status).toBe(200);
    expect(res.body.member.username).toBe('LinkedMember'); // same account, not a new one
    expect(res.body.member.google_id).toBe('google-id-linked'); // now attached
  });

  it('logs the same member back in on a second Google sign-in — no duplicate row', async () => {
    mockedVerifyGoogleToken.mockResolvedValueOnce({
      googleId: 'google-id-linked', // same googleId as the previous test
      email: 'linked@test.com',
    });

    const res = await request(app).post('/auth/google').send({ id_token: 'irrelevant' });

    expect(res.status).toBe(200);
    expect(res.body.member.email).toBe('linked@test.com');

    // Prove there's only ONE row for this google_id, not two — this is the
    // "findByGoogleId finds it, nothing gets written" branch actually working.
    const { rows } = await pool.query('SELECT id FROM members WHERE google_id = $1', [
      'google-id-linked',
    ]);
    expect(rows.length).toBe(1);
  });

  it('returns 401 when the Google token fails verification', async () => {
    // Simulate the real verifyGoogleToken throwing its own
    // AppError('Invalid Google token', 401) — mockRejectedValueOnce makes
    // the mocked function reject instead of resolve, same as a real failure.
    mockedVerifyGoogleToken.mockRejectedValueOnce(new Error('Invalid Google token'));

    const res = await request(app).post('/auth/google').send({ id_token: 'garbage' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });
});

// =============================================================
// WHAT THIS FILE DOES NOT DO
// =============================================================
//
// - It never sends a real request to Google — mockedVerifyGoogleToken
//   fully replaces that network call for every test here.
// - It never fakes the database — every member row these tests touch is
//   really inserted/updated/read through the same pool your app uses.
// - It does not test verifyGoogleToken() ITSELF (the real signature and
//   audience checking against Google's public keys) — a mock can't prove
//   that logic is right, only that the REST of your code reacts correctly
//   to whatever verifyGoogleToken hands it. Proving verifyGoogleToken
//   itself works means getting one real token from Google (OAuth Playground)
//   and sending it to a running server by hand — a manual check, not
//   something this automated suite can do.
