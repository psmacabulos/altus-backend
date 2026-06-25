import request from 'supertest';
import app from '../app';
import { pool } from '../config/db';

let token: string;

beforeAll(async () => {
  const res = await request(app).post('/v1/auth/register').send({
    username: 'ExercisePat',
    email: 'exercise@gmail.com',
    password: 'password123',
  });
  token = res.body.token;
});

afterAll(async () => {
  await pool.query('DELETE  FROM users WHERE email = $1', ['exercise@gmail.com']);
  await pool.end();
});

describe('GET /v1/exercises', () => {
  it('returns 200 with exercise list when token is valid', async () => {
    const res = await request(app).get('/v1/exercises').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/v1/exercises');

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 401 when token is invalid', async () => {
    const res = await request(app).get('/v1/exercises').set('Authorization', 'Bearer wrongtoken');

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });
});
