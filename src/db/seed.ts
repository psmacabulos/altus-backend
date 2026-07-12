import bcrypt from 'bcryptjs';
import { pool } from '../config/db';

const seedUsers = async (): Promise<void> => {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
  }

  const SALT_ROUNDS = 10;
  const passwordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);

  await pool.query(
    `INSERT INTO users (username, email, password_hash, role)
        VALUES($1,$2,$3,$4)
        ON CONFLICT(email) DO NOTHING`,
    ['admin', adminEmail, passwordHash, 'admin']
  );
  console.log('Admin user seeded.');
};

const seedExercises = async (): Promise<void> => {
  await pool.query(
    `INSERT INTO exercises (name, description, calories_per_rep, is_active)
        VALUES($1, $2, $3, $4)
        ON CONFLICT (name) DO NOTHING`,
    ['Squat', 'A lower body exercise targeting quads, hamstrings, and glutes', 0.32, true]
  );
  console.log('Exercises seeded.');
};

const seedExerciseDifficulties = async (): Promise<void> => {
  // exercise_id is a foreign key — must fetch the parent ID before inserting
  const result = await pool.query(`SELECT id FROM exercises WHERE name = $1`, ['Squat']);
  const squatId = result.rows[0].id;

  await pool.query(
    `INSERT INTO exercise_difficulties(exercise_id, level_name, target_reps, score_multiplier)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (exercise_id, level_name) DO NOTHING`,
    [squatId, 'Easy', 10, 1.0]
  );
  await pool.query(
    `INSERT INTO exercise_difficulties(exercise_id, level_name, target_reps, score_multiplier)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (exercise_id, level_name) DO NOTHING`,
    [squatId, 'Medium', 20, 1.5]
  );
  await pool.query(
    `INSERT INTO exercise_difficulties(exercise_id, level_name, target_reps, score_multiplier)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (exercise_id, level_name) DO NOTHING`,
    [squatId, 'Hard', 40, 2.0]
  );
  console.log('Exercise difficulties seeded.');
};

const seedAchievements = async (): Promise<void> => {
  const achievements = [
    ['First Workout', 'Complete your first workout', 'session_count', 1],
    ['Getting Started', 'Complete 5 workouts', 'session_count', 5],
    ['On a Roll', 'Complete 10 workouts', 'session_count', 10],
    ['Dedicated', 'Complete 25 workouts', 'session_count', 25],
    ['Unstoppable', 'Complete 50 workouts', 'session_count', 50],
    ['First Steps', 'Log 10 total reps', 'total_reps', 10],
    ['Century', 'Log 100 total reps', 'total_reps', 100],
    ['Rep Machine', 'Log 500 total reps', 'total_reps', 500],
    ['Beast Mode', 'Log 1,000 total reps', 'total_reps', 1000],
    ['Warm Up', 'Burn 50 total calories', 'total_calories', 50],
    ['Calorie Burner', 'Burn 250 total calories', 'total_calories', 250],
    ['Inferno', 'Burn 1,000 total calories', 'total_calories', 1000],
  ];

  for (const [name, description, requirement_type, requirement_value] of achievements) {
    await pool.query(
      `INSERT INTO achievements (name, description, requirement_type, requirement_value)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO UPDATE
       SET description = EXCLUDED.description,
       requirement_type = EXCLUDED.requirement_type,
       requirement_value = EXCLUDED.requirement_value`,
      [name, description, requirement_type, requirement_value]
    );
  }
};

const seedWorkoutSessions = async (): Promise<void> => {
  const userResult = await pool.query(`SELECT id FROM users WHERE email = $1`, [
    process.env.ADMIN_EMAIL,
  ]);
  const userId = userResult.rows[0].id;

  const difficultyEasyResult = await pool.query(
    `SELECT ed.id, ed.score_multiplier, e.calories_per_rep
     FROM exercise_difficulties ed
     JOIN exercises e ON e.id = ed.exercise_id
     WHERE e.name = $1 AND ed.level_name = $2`,
    ['Squat', 'Easy']
  );
  const { id: difficultyId, score_multiplier, calories_per_rep } = difficultyEasyResult.rows[0];

  const sessions = [8, 9, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]; // reps_completed for a few sample sessions
  for (const reps of sessions) {
    await pool.query(
      `INSERT INTO workout_sessions (user_id, exercise_difficulty_id, reps_completed, score, duration_seconds, calories_burned)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [userId, difficultyId, reps, Math.round(reps * score_multiplier), 60, reps * calories_per_rep]
    );
  }
  console.log('Workout sessions seeded.');
};

const seedUserAchievements = async (): Promise<void> => {
  // 1. look up the admin user id
  const userResult = await pool.query(`SELECT id FROM users WHERE email = $1`, [
    process.env.ADMIN_EMAIL,
  ]);
  const userId = userResult.rows[0].id;

  // 2. look up the first 3 achievement ids by name
  const achievementNames = ['First Workout', 'Getting Started', 'On a Roll'];
  for (const name of achievementNames) {
    const achResult = await pool.query(`SELECT id FROM achievements WHERE name = $1`, [name]);
    const achievementId = achResult.rows[0].id;

    // 3. insert — ON CONFLICT skips if already exists (PK is user_id + achievement_id)
    await pool.query(
      `INSERT INTO user_achievements (user_id, achievement_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [userId, achievementId]
    );
  }
  console.log('User achievements seeded.');
};

const runSeed = async (): Promise<void> => {
  console.log('Seeding users...');
  await seedUsers();

  console.log('Seeding exercises...');
  await seedExercises();

  console.log('Seeding exercise difficulties...');
  await seedExerciseDifficulties();

  console.log('Seeding workout_sessions...');
  await seedWorkoutSessions();

  console.log('Seeding achievements...');
  await seedAchievements();

  console.log('Seeding user achievements');
  await seedUserAchievements();

  console.log('Seeding finished successfully!');
  await pool.end();
  process.exit(0);
};

runSeed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
