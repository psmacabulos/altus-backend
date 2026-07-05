import request from 'supertest';
import app from '../app';
import { pool } from '../config/db';

let difficultyId: string;
let token: string;

beforeAll(async () => {
  const res = await request(app).post('/v1/auth/register').send({
    username: 'WorkoutPatzit',
    email: 'workoutz@gmail.coms',
    password: 'password123',
  });
  const result = await pool.query(`SELECT id FROM exercise_difficulties LIMIT 1`);
  difficultyId = result.rows[0].id;
  token = res.body.token;
});

afterAll(async () => {
  await pool.query(
    'DELETE FROM user_achievements WHERE user_id = (SELECT id FROM users WHERE email = $1)',
    ['workoutz@gmail.coms']
  );
  await pool.query(
    'DELETE FROM workout_sessions WHERE user_id = (SELECT id FROM users WHERE email = $1)',
    ['workoutz@gmail.coms']
  );
  await pool.query('DELETE FROM users WHERE email = $1', ['workoutz@gmail.coms']);
  await pool.end();
});

describe('GET /v1/users/me/achievements', () => {
  it('returns 200 with achievement list or empty array when token is valid', async () => {
    const res = await request(app)
      .get('/v1/users/me/achievements')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/v1/users/me/achievements');

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

describe('POST /v1/workout_sessions', () => {
  it('returns 201 with exercise list when token is valid', async () => {
    const res = await request(app)
      .post('/v1/workout_sessions')
      .send({
        exercise_difficulty_id: difficultyId,
        reps_completed: 5,
        duration_seconds: 60,
      })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(res.body.new_achievements[0].name).toBe('First Workout');
  });

  it('First workout now should appear on the list of achievements', async () => {
    const res = await request(app)
      .get('/v1/users/me/achievements')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('First Workout');
  });
});
