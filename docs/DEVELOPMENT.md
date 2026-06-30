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
  auth.test.ts       POST /v1/auth/register, POST /v1/auth/login
  exercise.test.ts   GET /v1/exercises
  workout.test.ts    POST /v1/workout_sessions, GET /v1/workout_sessions/me
```

**Config:** `jest.config.ts` at project root — `preset: ts-jest`, `testEnvironment: node`

**Requirements before running tests:**
- Docker must be running (`docker compose up -d`)
- DB must be migrated and seeded
- `.env` must have `DB_HOST=localhost` (not `db` — that is the Docker internal hostname)

**Pattern:** Integration tests — no mocking, hits real Postgres. Each file registers its own test user in `beforeAll` and cleans up in `afterAll`. Tests are independent across files (separate Jest worker processes, separate DB connections).

---

## Current state — as of 2026-06-30

**Where we are:** Phase 9 is done and merged to `main`. Phase 10 has not started yet.

```
Phases 1–9  ✅ Done and on main, deployed to Heroku
Phase 7b    ⏸ Deferred (Google OAuth)
Phase 10    🔨 Active — Achievement System — NOT YET STARTED
```

**What was just completed (Phase 9):**
- Workout sessions endpoints: `POST /v1/workout_sessions`, `GET /v1/workout_sessions/me`
- Automated integration tests (14 tests) — auth, exercises, workout sessions all green
- App/server split: `src/app.ts` (Express app) vs `src/index.ts` (server start)

**To pick up on a new machine:**
1. `git pull origin main` — get the latest
2. `docker compose up -d` — start Postgres
3. `npm test` — verify all 14 tests still pass
4. Create the Phase 10 branch: `git checkout -b feat/achievements`

**Phase 10 — Achievement System — what to build next:**
- `src/models/achievement.model.ts` — `getAll()`, `getUserAchievements()`, `unlock()`
- `src/services/achievement.service.ts` — `evaluateAchievements()` (called from workout.service after saving)
- `src/controllers/achievement.controller.ts` — `handleGetMyAchievements()`
- `src/routes/achievement.routes.ts` — `GET /v1/users/me/achievements`
- Seed the 13 achievements into `src/db/seed.ts`
- Wire `checkAchievements()` into `workout.service.ts` (stub already there, Phase 9 deferred it)

See `docs/backend-roadmap.md` Phase 10 section for the full checklist and achievement seed table.

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
- `AppError` class lives in `auth.service.ts` for now — move to shared utils in Phase 13

## Key docs
- `docs/API-specifications.md` — full endpoint spec and response shapes
- `docs/backend-roadmap.md` — phase plan and progress
- `docs/learning-log.md` — 122 lessons logged (Lessons 0–122, Phase 1–9, read before answering questions)
- `docs/learning-log-part2.md` — topic-based reference (Phase 9+, automated testing onwards)
- `docs/user-stories.md` — user stories mapped to phases
- `EXAMPLES/` — reference files for each layer (model, service, controller, routes)
