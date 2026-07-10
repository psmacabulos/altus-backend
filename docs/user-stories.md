# 📖 Altus Backend — User Stories

Every feature exists because a person needs something. This document lists those needs as **user stories**, maps each one to the roadmap phase and branch that delivers it, and tracks honest progress — not "how much code is written" but "how many promises to the user are kept."

Format: *As a [who], I want [what], so that [why].* Each story lists the steps the backend must perform — these steps are what dictate the service and model functions (see learning log, Lesson 63).

---

## 🧭 The two kinds of work

Phases 1–6 (server, Docker, CI/CD, database, seeding) appear nowhere below. That is not an oversight — they are **enablers**: a user never asked for Docker. They make story delivery possible, but deliver no story themselves. This explains the honest progress gap:

```
Roadmap phases complete:   10 of 12   (83%)  ← effort spent  (Phases 1–10 done; 7b deferred)
User stories delivered:    6 of 11    (55%)  ← value shipped  (US-01–03, US-05–07 on Heroku)
```

Both numbers are true. Infrastructure-first was the right call — but from this point on, every phase ships stories, and this document tracks that.

---

## 🔐 Epic 1 — Identity (Phases 7a + 7b · branch `feature/auth`)

### US-01 — Register
> As a **visitor**, I want to create an account with username, email, and password, so that Altus can track my workouts as mine.

Steps the backend performs:
1. Receive `POST /v1/auth/register` with username, email, password
2. Hash the password (bcrypt) — never store the original
3. Insert the user row — if email or username is already taken, the database's UNIQUE constraint refuses the insert, and the service translates that into "Email already registered" / "Username already taken" (learning log, Lesson 65)
4. Sign a JWT containing the new user's id
5. Respond `201` with `{ token, user }` — user object contains no hash

Status: ✅ Delivered — merged to `main`, live on Heroku

### US-02 — Log in
> As a **registered user**, I want to log in with email and password, so that I can access my account from any device.

Steps:
1. Receive `POST /v1/auth/login`
2. Look up user by email, compare password against stored hash (bcrypt.compare)
3. Wrong email and wrong password return the **same** `401` (no user enumeration)
4. Success → sign JWT, respond `{ token, user }`

Status: ✅ Delivered — merged to `main`, live on Heroku

### US-03 — Stay recognised on every request
> As a **logged-in user**, I want the app to know who I am on every request, so that everything I do is saved to my account — and nobody else's.

Steps:
1. Client sends `Authorization: Bearer <token>` on protected requests
2. `requireAuth` middleware verifies the JWT signature
3. Valid → attach user to `req.user`, continue; invalid/missing → `401`
4. User identity always comes from the token, **never** from the request body

Status: ✅ Delivered — merged to `main`, live on Heroku

### US-04 — Sign in with Google
> As a **visitor**, I want to sign up or log in with my Google account, so that I don't have to manage another password.

Steps:
1. Receive `POST /v1/auth/google` with a Google ID token
2. Verify the token with Google (`google-auth-library`)
3. Existing `google_id` → log them in; new → create user (no password — schema allows `password_hash NULL`)
4. Respond with a normal Altus JWT — downstream code never knows the difference

Status: ⏸ Deferred — Phase 7b skipped for now

---

## 🏋️ Epic 2 — Working Out (Phases 8 + 9 · branches `feature/exercises`, `feature/workouts`)

### US-05 — Browse exercises
> As a **logged-in user**, I want to see all available exercises with their difficulty levels, so that I can choose a workout that matches my ability.

Steps:
1. `GET /v1/exercises` (protected) → join exercises with difficulties, only `is_active = true`
2. Respond with exercises, difficulties nested inside each

Status: ✅ Delivered — merged to `main`, live on Heroku

### US-06 — Save a workout
> As a **logged-in user**, I want my completed workout saved with score and calories calculated for me, so that my effort is recorded fairly and identically for everyone.

Steps:
1. `POST /v1/workout_sessions` (protected) with `exercise_difficulty_id`, `reps_completed`, `duration_seconds`
2. User id from the token — never from the body
3. Validate the difficulty exists; **server** calculates score and calories (client-sent scores can't be trusted — it's a leaderboard)
4. Insert session, then check for newly unlocked achievements
5. Respond with the saved session + `new_achievements`

Status: ✅ Delivered — merged to `main`, live on Heroku

### US-07 — See my workout history
> As a **logged-in user**, I want to see my past workouts, so that I can track my progress over time.

Steps: `GET /v1/workout_sessions/me` (protected) → `{ sessions, stats }` for `req.user` id, sessions newest first, `stats` reused from the achievement-evaluation aggregate (Phase 10) so the frontend doesn't need to re-total the list itself

Status: ✅ Delivered — merged to `main`, live on Heroku

---

## 🏆 Epic 3 — Motivation (Phase 10 · branch `feat/achievements`)

### US-08 — Earn achievements automatically
> As a **user**, I want badges to unlock by themselves when I hit milestones, so that I feel rewarded without doing anything extra.

Steps: after each workout save → compare user totals against each achievement's `requirement_type`/`requirement_value` → insert newly crossed ones into `user_achievements` (never twice) → return them in the workout response

Status: 🔨 Code complete, tests passing — not yet merged to `main`/deployed

### US-09 — View my achievements
> As a **user**, I want to see all badges I've earned, so that I can enjoy my collection and see what's still locked.

Steps: `GET /v1/users/me/achievements` (protected) → user's earned achievements with badge data

Status: 🔨 Code complete, tests passing — not yet merged to `main`/deployed

---

## 📊 Epic 4 — Competition (Phase 11 · branch `feature/leaderboard`)

### US-10 — View the leaderboard
> As **anyone (even logged out)**, I want to see top scores, optionally filtered by exercise, so that I'm motivated to compete — and tempted to sign up.

Steps: `GET /v1/leaderboard?exercise=squats` (**public**) → top 50 by score, joined with usernames and exercise names, optional `ILIKE` filter

Status: ⏳ Not started (Phase 11)

---

## 🛡️ Epic 5 — Trust (Phase 12 + ongoing · branch `feature/validation`)

### US-11 — Always get a clear answer
> As an **API consumer** (the frontend team), I want every bad request to return a consistent, clear error, so that I can build reliable error handling without guessing.

Steps: validate request bodies on every endpoint (basic validation per-phase; final pass in Phase 12) → unknown routes get `404`, crashes get caught `500`, all errors share one `{ "error": "..." }` shape

Status: ⏳ Not started (Phase 12; partial delivery in every phase)

---

## 📈 Progress at a glance

| Epic | Stories | Delivered | In progress | Status |
|---|---|---|---|---|
| 1. Identity | US-01–04 | 3 (01, 02, 03) | — | ✅ Done · US-04 deferred |
| 2. Working Out | US-05–07 | 3 (05, 06, 07) | — | ✅ Done |
| 3. Motivation | US-08–09 | 0 | US-08, 09 | 🔨 Code complete — pending merge |
| 4. Competition | US-10 | 0 | — | ⏳ |
| 5. Trust | US-11 | 0 | — | ⏳ |
| **Total** | **11** | **6 (55%)** | **2** | |

A story counts as **delivered** only when its endpoint works on the live Heroku app — merged to `main`, deployed, testable. Not when the code is written.

---

## 🔍 Consistency check against the backend roadmap

Verdict: **the roadmap covers every story above — no story is missing a phase, and no phase exists without a story.** Three findings to discuss as a team:

1. **The `admin` role has no stories.** The schema defines `user_role AS ENUM ('user','admin')`, and Phase 8 filters on `exercises.is_active` — implying someone can deactivate an exercise. But no roadmap phase builds any admin endpoint (manage exercises, manage achievements). Either: (a) admin manages data directly via SQL for MVP — fine, but write that down; or (b) an admin epic is missing. **Decision needed.**
2. **Branch-per-story vs branch-per-phase.** Recommendation: keep **one branch per epic/phase** (`feature/auth`, `feature/workouts`, ...) rather than per story. US-06 and US-08 share code (achievements are checked inside the workout save) — separate branches would conflict constantly. The roadmap's existing `feature/*` naming already matches this. Stories small enough to be a branch are already a phase.

**2026-07-05 update:** Epic 4 (My Profile — US-10 view profile, US-11 update username, US-12 stats, US-13 public profile) was cut for MVP. Profile/username data is already returned by `/auth/register` and `/auth/login`; workout totals overlap with `/workout_sessions/me` and `/users/me/achievements`, so a dedicated stats/profile phase added no new value at this stage. Former Phase 12 (Leaderboard) and Phase 13 (Validation) renumbered to Phase 11 and Phase 12.

---

*Linked docs: [backend-roadmap.md](backend-roadmap.md) · [learning-log.md](learning-log.md) (Lesson 63 — how stories dictate model functions)*
