# Altus Backend — Claude Code Context

## Project
Node.js + Express + TypeScript + PostgreSQL backend for **Altus** (formerly MoveVerse) — a fitness game where players complete exercises tracked by MediaPipe on the frontend and compete on a leaderboard.

- **Local:** `http://localhost:5600` · Docker-based dev (`docker compose up -d`)
- **Production:** `https://api.altus.games` · Heroku (app name: `altus-backend`)
- **Route prefix:** `/v1/` (not `/api/v1/`)
- **Terminal:** Git Bash always

## Mentor approach — non-negotiable
- User writes ALL source code (`.ts`, `.sql`, config files) — never write these directly
- Explain business-why first, then derive technical design from user stories
- Show code only as examples in chat or in `EXAMPLES/` folder
- Every conceptual question must be logged immediately as a lesson in `docs/learning-log.md`
- When updating learning log, also update `docs/backend-roadmap.md`
- Remind user to commit at the end of each completed phase

## Architecture — Route → Controller → Service → Model
```
src/routes/       URL → controller mapping
src/controllers/  unpack req, call service, send res
src/services/     business logic
src/models/       SQL queries only
src/middleware/   auth.middleware.ts — requireAuth (JWT check → req.user.userId)
src/types/        express.d.ts — adds req.user to Express types
src/config/       db.ts — pg connection pool
```

## Naming conventions
| Layer | Pattern | Example |
|---|---|---|
| Model | `verb + Noun` — DB action | `getAllExercises`, `createUser`, `findByEmail` |
| Service | `verb` — business action | `getExercises`, `register`, `login` |
| Controller | `handle` + action | `handleGetExercises`, `handleRegister` |

## Automated Testing

**Stack:** Jest + Supertest + ts-jest (all `devDependencies`)

**Run all tests:**
```
npm test
```

**Run one file while debugging:**
```
npx jest <filename>   e.g. npx jest workout
```

**Test files:**
```
src/__tests__/
  auth.test.ts         POST /v1/auth/register, POST /v1/auth/login
  exercise.test.ts     GET /v1/exercises
  workout.test.ts      POST /v1/workout_sessions, GET /v1/workout_sessions/me
  achievements.test.ts POST /v1/workout_sessions (new_achievements), GET /v1/users/me/achievements
```

**Config:** `jest.config.ts` at project root — `preset: ts-jest`, `testEnvironment: node`

**Requirements before running tests:**
- Docker must be running (`docker compose up -d`)
- DB must be migrated and seeded
- `.env` must have `DB_HOST=localhost` (not `db` — that is the Docker internal hostname)

**Pattern:** Integration tests — no mocking, hits real Postgres. Each file registers its own test user in `beforeAll` and cleans up in `afterAll`. Tests are independent across files (separate Jest worker processes, separate DB connections).

---

## Current state
- Phases 1–9 complete and merged to `main` — deployed to Heroku
- Phase 7b (Google OAuth) complete — not yet merged to `dev`/`main`
- Phase 10 (Achievement System) code-complete, all tests passing on `feat/achievements` — not yet merged to `dev`/`main`
- Automated tests written for all current endpoints (auth, exercises, workout sessions, achievements) — Google OAuth not yet covered by automated tests
- **Next: Phase 11 — Leaderboard**

## Branch strategy
```
main → production (Heroku auto-deploys)
dev  → integration
feat/* → one branch per phase (current: merge feat/exercises → dev → main)
```

## Key decisions already made
- Difficulties nested inside exercises response — no separate endpoint (avoids N+1)
- `exercise_difficulty_id` from GET /exercises is sent to POST /workout_sessions
- Score and calories calculated server-side only — frontend never sends a score
- JWT payload: `{ userId }` only — 7 day expiry
- Logout is client-side only for MVP — no blacklist needed
- `AppError` class lives in `auth.service.ts` for now — move to shared utils in Phase 12
- Achievement evaluation happens synchronously inside `saveSession()`, on every workout save — never lazily on `GET /users/me/achievements` (that endpoint is a pure read, no side effects)
- Collection endpoints (`getMyAchievements`, `getSessionsByUser`, etc.) return `[]` for "nothing here" — never `null`

## Key docs
- `docs/API-specifications.md` — full endpoint spec and response shapes
- `docs/backend-roadmap.md` — phase plan and progress
- `docs/learning-log.md` — 122 lessons logged (Lessons 0–122, Phase 1–9, read before answering questions)
- `docs/learning-log-part2.md` — topic-based reference (Phase 9+, automated testing onwards)
- `docs/user-stories.md` — user stories mapped to phases
- `EXAMPLES/` — reference files for each layer (model, service, controller, routes)
