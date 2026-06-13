# MoveVerse Backend

REST API for the MoveVerse fitness game. Players register, log in, complete exercise sessions tracked by MediaPipe on the frontend, and compete on a leaderboard.

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
cd moveverse-backend
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

**Base URL:** `http://localhost:5600/api/v1`

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
| POST | `/auth/google` | No | Google OAuth login/register *(planned)* |
| POST | `/auth/logout` | 🔒 | Logout *(planned)* |

**Register**

```bash
curl -i -X POST http://localhost:5600/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"player1","email":"player1@test.com","password":"password123"}'
```

**Login**

```bash
curl -i -X POST http://localhost:5600/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"player1@test.com","password":"password123"}'
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

### Exercises *(planned)*

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/exercises` | 🔒 | List all active exercises |
| GET | `/exercises/:id/difficulties` | 🔒 | Difficulty presets for one exercise |

---

### Workout Sessions *(planned)*

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/workout_sessions` | 🔒 | Save a completed session |
| GET | `/workout_sessions/me` | 🔒 | Current user's session history |

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

## Project structure

```
src/
  config/       PostgreSQL connection pool
  db/           Migration and seed scripts + SQL files
  controllers/  HTTP handlers (unpack req, call service, send res)
  middleware/   Auth middleware (requireAuth)
  models/       SQL query functions
  routes/       URL → controller mappings
  services/     Business logic (register, login, JWT)
  types/        TypeScript global augmentations
  index.ts      App entry point
```
