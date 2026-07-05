# Altus Backend

REST API for the Altus fitness game. Players register, log in, complete exercise sessions tracked by MediaPipe on the frontend, and compete on a leaderboard.

**Stack:** Node.js 24 · Express 5 · TypeScript · PostgreSQL · Docker · JWT

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Git

No local Node.js install required — everything runs inside Docker.

---

## Getting started

```bash
git clone <repo-url>
cd altus-backend
```

Copy the environment file and fill in your values:

```bash
cp .env.example .env
```

Required variables in `.env`:

| Variable | Description |
|---|---|
| `PORT` | Port the app listens on (e.g. `5600`) |
| `DB_HOST` | Use `db` — matches the Docker service name |
| `DB_PORT` | `5432` |
| `DB_NAME` | Database name |
| `DB_USER` | Database user |
| `DB_PASSWORD` | Database password |
| `JWT_SECRET` | Secret used to sign JWT tokens — use a strong random string |
| `ADMIN_EMAIL` | Seed admin account email |
| `ADMIN_PASSWORD` | Seed admin account password |

---

## Running the app

```bash
docker compose up -d
```

Check it is running:

```bash
curl http://localhost:5600/health
# → {"status":"ok"}
```

Stop the app:

```bash
docker compose down
```

> **After changing any file outside `src/`** (e.g. `package.json`, `eslint.config.mjs`, `Dockerfile`), rebuild the image:
> ```bash
> docker compose down && docker compose up --build
> ```

---

## Database

### Run migrations

Creates all tables. Safe to re-run — uses `CREATE TABLE IF NOT EXISTS`.

```bash
docker compose exec app npm run migrate
```

### Seed data

Inserts exercises, difficulty presets, and the admin account defined in `.env`.

```bash
docker compose exec app npm run seed
```

---

## API

**Base URL (local):** `http://localhost:5600/v1`
**Base URL (production):** `https://api.altus.games/v1`

All responses use `snake_case` field names. Protected routes require a JWT in the `Authorization` header:

```
Authorization: Bearer <token>
```

Error responses follow this shape:

```json
{ "error": "Human-readable message" }
```

---

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | No | Create account — returns JWT + user |
| POST | `/auth/login` | No | Login — returns JWT + user |
| POST | `/auth/google` | No | Google OAuth login/register *(deferred)* |

**Register**

```bash
curl -i -X POST http://localhost:5600/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"player1\",\"email\":\"player1@test.com\",\"password\":\"password123\"}"
```

**Login**

```bash
curl -i -X POST http://localhost:5600/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"player1@test.com\",\"password\":\"password123\"}"
```

Both return:

```json
{
  "token": "<jwt>",
  "user": {
    "id": "uuid",
    "username": "player1",
    "email": "player1@test.com",
    "google_id": null,
    "role": "user",
    "created_at": "...",
    "updated_at": "..."
  }
}
```

---

### Exercises

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/exercises` | 🔒 | All active exercises with nested difficulty presets |

Called once after login. The frontend stores the result in React context — not called during gameplay.

```bash
curl -i http://localhost:5600/v1/exercises \
  -H "Authorization: Bearer <token>"
```

Returns:

```json
[
  {
    "id": "uuid",
    "name": "Squat",
    "description": "A lower body exercise targeting quads, hamstrings, and glutes",
    "calories_per_rep": "0.32",
    "difficulties": [
      { "id": "uuid", "level_name": "Easy",   "target_reps": 10, "score_multiplier": "1.00" },
      { "id": "uuid", "level_name": "Medium", "target_reps": 20, "score_multiplier": "1.50" },
      { "id": "uuid", "level_name": "Hard",   "target_reps": 40, "score_multiplier": "2.00" }
    ]
  }
]
```

---

### Workout Sessions

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/workout_sessions` | 🔒 | Save a completed session |
| GET | `/workout_sessions/me` | 🔒 | Current user's session history |

**Save a session**

```bash
curl -i -X POST http://localhost:5600/v1/workout_sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d "{\"exercise_difficulty_id\":\"<uuid>\",\"reps_completed\":15,\"duration_seconds\":60}"
```

Returns:

```json
{
  "id": "uuid",
  "score": 630,
  "calories_burned": 13.44,
  "completed_at": "2025-06-01T10:30:00.000Z"
}
```

**Get history**

```bash
curl -i http://localhost:5600/v1/workout_sessions/me \
  -H "Authorization: Bearer <token>"
```

Returns:

```json
[
  {
    "id": "uuid",
    "exercise": "Squats",
    "difficulty": "Medium",
    "reps_completed": 15,
    "score": 630,
    "duration_seconds": 60,
    "calories_burned": 13.44,
    "completed_at": "2025-06-01T10:30:00.000Z"
  }
]
```

---

### Users *(planned)*

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/users/me` | 🔒 | Current user's profile |
| GET | `/users/:id` | No | Public profile |
| PUT | `/users/me` | 🔒 | Update profile |
| GET | `/users/me/stats` | 🔒 | Workout statistics |
| GET | `/users/me/achievements` | 🔒 | Unlocked achievements |

---

### Leaderboard *(planned)*

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/leaderboard` | No | Top 50 global scores |
| GET | `/leaderboard/:exercise_name` | No | Top 50 for one exercise |
| GET | `/leaderboard/me/rank` | 🔒 | Current user's global rank |

---

## Running tests

Tests require Docker running with the database migrated and seeded. `.env` must have `DB_HOST=localhost`.

```bash
npm test              # full suite
npx jest <filename>   # single file e.g. npx jest workout
```

---

## Project structure

```
src/
  __tests__/    Integration test files (Jest + Supertest)
  config/       PostgreSQL connection pool
  db/           Migration and seed scripts + SQL files
  controllers/  HTTP handlers (unpack req, call service, send res)
  middleware/   Auth middleware (requireAuth)
  models/       SQL query functions
  routes/       URL → controller mappings
  services/     Business logic (register, login, JWT)
  types/        TypeScript global augmentations
  app.ts        Express app (middleware + routes)
  index.ts      Server entry point (app.listen only)
jest.config.ts  Test runner configuration
```
