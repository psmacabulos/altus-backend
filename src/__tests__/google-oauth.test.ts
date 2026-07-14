import request from 'supertest';
import app from '../app';
import { pool } from '../config/db';
import { verifyGoogleToken } from '../services/google.service';
import { AppError } from '../services/auth.service';

jest.mock('../services/google.service.ts');

const mockedVerifyGoogleToken = verifyGoogleToken as jest.MockedFunction<typeof verifyGoogleToken>;

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email = ANY($1)', [
    ['newuser@test.com', 'linked@test.com'],
  ]);
  await pool.end();
});

describe('POST /auth/google', () => {
  it('creates a new user on first-ever Google sign-in', async () => {
    mockedVerifyGoogleToken.mockResolvedValueOnce({
      googleId: 'google-id-brand-new',
      email: 'newuser@test.com',
    });

    const res = await request(app)
      .post('/v1/auth/google')
      .send({ id_token: 'irrelevant-fake-value' });
    // That string is never actually checked — verifyGoogleToken is mocked,
    // so ANY id_token reaches it. What's under test is what loginWithGoogle()
    // DOES with the identity the mock hands back, not whether a real id_token
    // is well-formed (that's the real verifyGoogleToken's job, checked
    // separately via a manual OAuth Playground token — see PART 2 below).

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('newuser@test.com');
    expect(res.body.user.google_id).toBe('google-id-brand-new');
  });

  it('auto-links an existing password account on matching email', async () => {
    // Arrange: a REAL password user already exists — genuine INSERT,
    // nothing mocked here. This is the "existing = await findByEmail(email)"
    // branch in loginWithGoogle() finding something real.
    await request(app).post('/v1/auth/register').send({
      username: 'Linkeduser',
      email: 'linked@test.com',
      password: 'password123',
    });

    mockedVerifyGoogleToken.mockResolvedValueOnce({
      googleId: 'google-id-linked',
      email: 'linked@test.com', // SAME email as the password account above
    });

    const res = await request(app).post('/v1/auth/google').send({ id_token: 'irrelevant' });

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('Linkeduser'); // same account, not a new one
    expect(res.body.user.google_id).toBe('google-id-linked'); // now attached
  });

  it('logs the same user back in on a second Google sign-in — no duplicate row', async () => {
    mockedVerifyGoogleToken.mockResolvedValueOnce({
      googleId: 'google-id-linked', // same googleId as the previous test
      email: 'linked@test.com',
    });

    const res = await request(app).post('/v1/auth/google').send({ id_token: 'irrelevant' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('linked@test.com');

    // Prove there's only ONE row for this google_id, not two — this is the
    // "findByGoogleId finds it, nothing gets written" branch actually working.
    const { rows } = await pool.query('SELECT id FROM users WHERE google_id = $1', [
      'google-id-linked',
    ]);
    expect(rows.length).toBe(1);
  });

  it('returns 401 when the Google token fails verification', async () => {
    // Simulate the real verifyGoogleToken throwing its own
    // AppError('Invalid Google token', 401) — mockRejectedValueOnce makes
    // the mocked function reject instead of resolve, same as a real failure.
    mockedVerifyGoogleToken.mockRejectedValueOnce(new AppError('Invalid Google token', 401));

    const res = await request(app).post('/v1/auth/google').send({ id_token: 'garbage' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });
});
