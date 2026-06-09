import fs from 'fs';
import path from 'path';
import { pool } from '../config/db';

const runMigrations = async (): Promise<void> => {
  const migrationsFolder = path.join(__dirname, 'migrations');

  const files = fs
    .readdirSync(migrationsFolder)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsFolder, file), 'utf-8');
    console.log(`Running migration: ${file}`);
    await pool.query(sql);
    console.log(`Completed: ${file}`);
  }

  console.log('All migrations completed successfully.');

  await pool.end();
  process.exit(0);
};

runMigrations().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
