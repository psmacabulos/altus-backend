import request from 'supertest';
import app from '../app';
import { pool } from '../config/db';

let difficultyId: string;
let token: string;

beforeAll(async () => {
  const res = await request(app).post('/v1/auth/register').send({
    username: 'WorkoutPatzi',
    email: 'workoutz@gmail.com',
    password: 'password123',
  });
  const result = await pool.query(`SELECT id FROM exercise_difficulties LIMIT 1`);
  difficultyId = result.rows[0].id;
  token = res.body.token;
});

afterAll(async () => {
  await pool.query(
    'DELETE FROM workout_sessions WHERE user_id = (SELECT id FROM users WHERE email = $1)',
    ['workoutz@gmail.com']
  );
  await pool.query('DELETE FROM users WHERE email = $1', ['workoutz@gmail.com']);
  await pool.end();
});

describe('POST /v1/workout_sessions', () => {
  it('returns 201 with exercise list when token is valid', async () => {
    const res = await request(app)
      .post('/v1/workout_sessions')
      .send({
        exercise_difficulty_id: difficultyId,
        reps_completed: 10,
        duration_seconds: 60,
      })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.score).toBeDefined();
    expect(res.body.calories_burned).toBeDefined();
  });

  it('returns 404 for a fake difficulty_id', async () => {
    const res = await request(app)
      .post('/v1/workout_sessions')
      .send({
        exercise_difficulty_id: '00000000-0000-0000-0000-000000000000',
        reps_completed: 10,
        duration_seconds: 60,
      })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.error).toBeDefined();
  });

  it('returns 401 if no token is provided', async () => {
    const res = await request(app).post('/v1/workout_sessions').send({
      exercise_difficulty_id: '00000-000000-0000-00000',
      reps_completed: 10,
      duration_seconds: 60,
    });

    expect(res.status).toBe(401);
    expect(res.error).toBeDefined();
  });
});

describe('GET /v1/workout_sessions/me', () => {
  it('returns 200 with session list when token is valid', async () => {
    const res = await request(app).get('/v1/exercises').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/v1/workout_sessions/me');

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 401 when token is invalid', async () => {
    const res = await request(app)
      .get('/v1/workout_sessions/me')
      .set('Authorization', 'Bearer wrongtoken');

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });
});
