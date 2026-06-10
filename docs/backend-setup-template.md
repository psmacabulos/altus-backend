# MoveVerse Backend — Setup Template

A reference for setting up a production-ready Node.js + TypeScript + PostgreSQL backend from scratch. Use this when starting a new project or onboarding onto this stack.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Runtime | Node.js 22.x | JavaScript runtime |
| Language | TypeScript | Type safety, better tooling |
| Framework | Express 5 | HTTP server and routing |
| Database | PostgreSQL | Relational data storage |
| ORM/Query | node-postgres (pg) | Raw SQL with connection pooling |
| Auth | bcryptjs + jsonwebtoken | Password hashing and JWT tokens |
| Dev server | ts-node-dev | Auto-restart on file changes |
| Local env | Docker + docker-compose | Consistent local development |
| CI/CD | GitHub Actions + Heroku | Automated checks and deployment |

---

## Project Structure

```
src/
  config/
    db.ts               # PostgreSQL connection pool
  db/
    migrate.ts          # Migration runner
    seed.ts             # Seed script
    migrations/         # SQL migration files (numbered, sorted)
  controllers/          # Request handlers
  middleware/           # Express middleware (auth, error handling)
  models/               # Database query functions
  routes/               # Express route definitions
  services/             # Business logic
  index.ts              # App entry point
docs/                   # Project documentation
```

---

## package.json

```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write src/**/*.ts",
    "migrate": "ts-node src/db/migrate.ts",
    "seed": "ts-node src/db/seed.ts",
    "migrate:prod": "node dist/db/migrate.js",
    "seed:prod": "node dist/db/seed.js"
  },
  "engines": {
    "node": "22.x"
  }
}
```

**Why two migrate/seed scripts:**
- `migrate` and `seed` use `ts-node` — for local development inside Docker
- `migrate:prod` and `seed:prod` use `node` on compiled JS — for Heroku, where `ts-node` is pruned as a devDependency before the release phase runs

---

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "types": ["node"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Critical field:** `"types": ["node"]` must be present. Without it, TypeScript does not recognise Node.js globals like `__dirname`, `fs`, `path`, and `process`.

---

## .env

```
PORT=3000
NODE_ENV=development

DB_HOST=db
DB_PORT=5432
DB_NAME=moveverse
DB_USER=postgres
DB_PASSWORD=postgres

JWT_SECRET=your-local-secret

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your-admin-password
```

`DB_HOST=db` matches the service name in `docker-compose.yml`. Never commit `.env` — it is in `.gitignore`.

---

## src/config/db.ts

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const connectDB = async (): Promise<void> => {
  try {
    // pool.connect() borrows a client to verify the connection is reachable
    const client = await pool.connect();
    console.log('Database connected successfully');
    client.release();
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

export { pool, connectDB };
```

**SSL note:** `ssl` must be conditional. Heroku Postgres requires SSL; local Docker Postgres does not. `rejectUnauthorized: false` is needed because Heroku uses a self-signed certificate.

---

## src/db/migrate.ts

```typescript
import fs from 'fs';
import path from 'path';
import { pool } from '../config/db';

const runMigrations = async (): Promise<void> => {
  const migrationsFolder = path.join(process.cwd(), 'src', 'db', 'migrations');

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
```

**Path note:** Use `process.cwd()` not `__dirname`. When running compiled JS (`node dist/db/migrate.js`), `__dirname` points to `dist/db/` where no SQL files exist. `process.cwd()` always points to the project root where `src/db/migrations/` is reachable.

---

## Procfile

```
release: npm run migrate:prod
web: npm start
```

`release:` runs automatically before the app starts on every Heroku deployment. Migrations use `CREATE TABLE IF NOT EXISTS` so they are safe to re-run.

---

## Migration file naming

```
001_create_users.sql
002_create_exercises.sql
003_create_exercise_difficulties.sql
```

Always prefix with a zero-padded number. The migration runner sorts files alphabetically — the number guarantees correct order and respects foreign key dependencies (parent tables before child tables).

---

## Key dependency installation

```
npm install express cors helmet dotenv pg bcryptjs jsonwebtoken
npm install -D typescript ts-node-dev @types/node @types/express @types/cors @types/pg @types/bcryptjs @types/jsonwebtoken eslint prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-config-prettier
```
