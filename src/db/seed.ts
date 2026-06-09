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
  await pool.query(
    `INSERT INTO achievements(name, description, requirement_type, requirement_value)
        VALUES($1, $2, $3, $4)
        ON CONFLICT (name) DO NOTHING`,
    ['First Step', 'Complete your first workout', 'session_count', 1]
  );
  await pool.query(
    `INSERT INTO achievements(name, description, requirement_type, requirement_value)
        VALUES($1, $2, $3, $4)
        ON CONFLICT (name) DO NOTHING`,
    ['Getting Started', 'Complete 5 workouts', 'session_count', 5]
  );
  await pool.query(
    `INSERT INTO achievements(name, description, requirement_type, requirement_value)
        VALUES($1, $2, $3, $4)
        ON CONFLICT (name) DO NOTHING`,
    ['Dedicated', 'Complete 10 workouts', 'session_count', 10]
  );
};
const runSeed = async (): Promise<void> => {
  console.log('Seeding users...');
  await seedUsers();

  console.log('Seeding exercises...');
  await seedExercises();

  console.log('Seeding exercise difficulties...');
  await seedExerciseDifficulties();

  console.log('Seeding achievements...');
  await seedAchievements();

  console.log('Seeding finished successfully!');
  await pool.end();
  process.exit(0);
};

runSeed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
