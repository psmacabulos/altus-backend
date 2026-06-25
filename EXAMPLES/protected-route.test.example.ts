/**
 * EXAMPLE: Testing a protected route that requires a JWT token
 *
 * Pattern: beforeAll registers a test user and saves the token.
 * afterAll deletes the test user and closes the pool.
 * Each test uses the saved token in the Authorization header.
 */

import request from 'supertest';
import app from '../src/app';
import { pool } from '../src/config/db';

// Declare token at the top of the file so all tests can access it.
// beforeAll will fill it in before any test runs.
let token: string;

beforeAll(async () => {
  // Register a test user and save the returned token.
  const res = await request(app).post('/v1/auth/register').send({
    username: 'ExampleUser',
    email: 'example@test.com',
    password: 'password123',
  });
  token = res.body.token;
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email = $1', ['example@test.com']);
  await pool.end();
});

describe('GET /v1/some-protected-route', () => {
  it('returns 200 with data when token is valid', async () => {
    // .set() adds a request header — this is how you send the JWT
    const res = await request(app)
      .get('/v1/some-protected-route')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true); // checking the body is an array
  });

  it('returns 401 when no token is provided', async () => {
    // No .set() call — request has no Authorization header
    const res = await request(app).get('/v1/some-protected-route');

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 401 when token is invalid', async () => {
    const res = await request(app)
      .get('/v1/some-protected-route')
      .set('Authorization', 'Bearer this-is-not-a-real-token');

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });
});
