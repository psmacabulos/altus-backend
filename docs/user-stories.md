# 📖 MoveVerse Backend — User Stories

Every feature exists because a person needs something. This document lists those needs as **user stories**, maps each one to the roadmap phase and branch that delivers it, and tracks honest progress — not "how much code is written" but "how many promises to the user are kept."

Format: *As a [who], I want [what], so that [why].* Each story lists the steps the backend must perform — these steps are what dictate the service and model functions (see learning log, Lesson 63).

---

## 🧭 The two kinds of work

Phases 1–6 (server, Docker, CI/CD, database, seeding) appear nowhere below. That is not an oversight — they are **enablers**: a user never asked for Docker. They make story delivery possible, but deliver no story themselves. This explains the honest progress gap:

```
Roadmap phases complete:   6 of 13   (46%)  ← effort spent
User stories delivered:    0 of 15   ( 0%)  ← value shipped
```

Both numbers are true. Infrastructure-first was the right call — but from this point on, every phase ships stories, and this document tracks that.

---

## 🔐 Epic 1 — Identity (Phases 7a + 7b · branch `feature/auth`)

### US-01 — Register
> As a **visitor**, I want to create an account with username, email, and password, so that MoveVerse can track my workouts as mine.

Steps the backend performs:
1. Receive `POST /api/v1/auth/register` with username, email, password
2. Hash the password (bcrypt) — never store the original
3. Insert the user row — if email or username is already taken, the database's UNIQUE constraint refuses the insert, and the service translates that into "Email already registered" / "Username already taken" (learning log, Lesson 65)
4. Sign a JWT containing the new user's id
5. Respond `201` with `{ token, user }` — user object contains no hash

Status: 🔨 In progress (Phase 7a active) · Stack: routes → controller → `register()` → `createUser()`

### US-02 — Log in
> As a **registered user**, I want to log in with email and password, so that I can access my account from any device.

Steps:
1. Receive `POST /api/v1/auth/login`
2. Look up user by email, compare password against stored hash (bcrypt.compare)
3. Wrong email and wrong password return the **same** `401` (no user enumeration)
4. Success → sign JWT, respond `{ token, user }`

Status: 🔨 In progress (Phase 7a) · Stack: `login()` → `findByEmail()`

### US-03 — Stay recognised on every request
> As a **logged-in user**, I want the app to know who I am on every request, so that everything I do is saved to my account — and nobody else's.

Steps:
1. Client sends `Authorization: Bearer <token>` on protected requests
2. `requireAuth` middleware verifies the JWT signature
3. Valid → attach user to `req.user`, continue; invalid/missing → `401`
4. User identity always comes from the token, **never** from the request body

Status: 🔨 In progress (Phase 7a) · Stack: `auth.middleware.ts` → `findById()`

### US-04 — Sign in with Google
> As a **visitor**, I want to sign up or log in with my Google account, so that I don't have to manage another password.

Steps:
1. Receive `POST /api/v1/auth/google` with a Google ID token
2. Verify the token with Google (`google-auth-library`)
3. Existing `google_id` → log them in; new → create user (no password — schema allows `password_hash NULL`)
4. Respond with a normal MoveVerse JWT — downstream code never knows the difference

Status: ⏳ Not started (Phase 7b)

---

## 🏋️ Epic 2 — Working Out (Phases 8 + 9 · branches `feature/exercises`, `feature/workouts`)

### US-05 — Browse exercises
> As a **logged-in user**, I want to see all available exercises with their difficulty levels, so that I can choose a workout that matches my ability.

Steps:
1. `GET /api/v1/exercises` (protected) → join exercises with difficulties, only `is_active = true`
2. Respond with exercises, difficulties nested inside each

Status: ⏳ Not started (Phase 8)

### US-06 — Save a workout
> As a **logged-in user**, I want my completed workout saved with score and calories calculated for me, so that my effort is recorded fairly and identically for everyone.

Steps:
1. `POST /api/v1/workout_sessions` (protected) with `exercise_difficulty_id`, `reps_completed`, `duration_seconds`
2. User id from the token — never from the body
3. Validate the difficulty exists; **server** calculates score and calories (client-sent scores can't be trusted — it's a leaderboard)
4. Insert session, then check for newly unlocked achievements
5. Respond with the saved session + `new_achievements`

Status: ⏳ Not started (Phase 9)

### US-07 — See my workout history
> As a **logged-in user**, I want to see my past workouts, so that I can track my progress over time.

Steps: `GET /api/v1/workout_sessions/me` (protected) → sessions for `req.user` id, newest first

Status: ⏳ Not started (Phase 9)

---

## 🏆 Epic 3 — Motivation (Phase 10 · branch `feature/achievements`)

### US-08 — Earn achievements automatically
> As a **user**, I want badges to unlock by themselves when I hit milestones, so that I feel rewarded without doing anything extra.

Steps: after each workout save → compare user totals against each achievement's `requirement_type`/`requirement_value` → insert newly crossed ones into `user_achievements` (never twice) → return them in the workout response

Status: ⏳ Not started (Phase 10)

### US-09 — View my achievements
> As a **user**, I want to see all badges I've earned, so that I can enjoy my collection and see what's still locked.

Steps: `GET /api/v1/users/me/achievements` (protected) → user's earned achievements with badge data

Status: ⏳ Not started (Phase 10)

---

## 👤 Epic 4 — My Profile (Phase 11 · branch `feature/profile`)

### US-10 — View my profile
> As a **user**, I want to view my own profile, so that I can confirm my account details.

Steps: `GET /api/v1/users/me` (protected) → profile from `req.user`, never the password hash

Status: ⏳ Not started (Phase 11)

### US-11 — Update my username
> As a **user**, I want to change my username, so that my public identity stays under my control.

Steps: `PUT /api/v1/users/me` (protected) → validate new username, reject if taken (UNIQUE), update, return updated profile

Status: ⏳ Not started (Phase 11)

### US-12 — See my stats
> As a **user**, I want my totals (workouts, reps, calories), so that I can see the big picture of my effort.

Steps: `GET /api/v1/users/me/stats` (protected) → aggregate queries over workout_sessions (live COUNT/SUM — Lesson 41)

Status: ⏳ Not started (Phase 11)

### US-13 — View someone's public profile
> As **anyone**, I want to view a user's public profile, so that I can check out people I see on the leaderboard.

Steps: `GET /api/v1/users/:id` (**public**) → public fields only (username, achievements, public stats) — no email, no ids of private data

Status: ⏳ Not started (Phase 11)

---

## 📊 Epic 5 — Competition (Phase 12 · branch `feature/leaderboard`)

### US-14 — View the leaderboard
> As **anyone (even logged out)**, I want to see top scores, optionally filtered by exercise, so that I'm motivated to compete — and tempted to sign up.

Steps: `GET /api/v1/leaderboard?exercise=squats` (**public**) → top 50 by score, joined with usernames and exercise names, optional `ILIKE` filter

Status: ⏳ Not started (Phase 12)

---

## 🛡️ Epic 6 — Trust (Phase 13 + ongoing · branch `feature/validation`)

### US-15 — Always get a clear answer
> As an **API consumer** (the frontend team), I want every bad request to return a consistent, clear error, so that I can build reliable error handling without guessing.

Steps: validate request bodies on every endpoint (basic validation per-phase; final pass in Phase 13) → unknown routes get `404`, crashes get caught `500`, all errors share one `{ "error": "..." }` shape

Status: ⏳ Not started (Phase 13; partial delivery in every phase)

---

## 📈 Progress at a glance

| Epic | Stories | Delivered | In progress | Status |
|---|---|---|---|---|
| 1. Identity | US-01–04 | 0 | US-01, 02, 03 | 🔨 Active — Phase 7a |
| 2. Working Out | US-05–07 | 0 | — | ⏳ |
| 3. Motivation | US-08–09 | 0 | — | ⏳ |
| 4. My Profile | US-10–13 | 0 | — | ⏳ |
| 5. Competition | US-14 | 0 | — | ⏳ |
| 6. Trust | US-15 | 0 | — | ⏳ |
| **Total** | **15** | **0 (0%)** | **3 (20%)** | |

A story counts as **delivered** only when its endpoint works on the live Heroku app — merged to `main`, deployed, testable. Not when the code is written.

---

## 🔍 Consistency check against the backend roadmap

Verdict: **the roadmap covers every story above — no story is missing a phase, and no phase exists without a story.** Three findings to discuss as a team:

1. **The `admin` role has no stories.** The schema defines `user_role AS ENUM ('user','admin')`, and Phase 8 filters on `exercises.is_active` — implying someone can deactivate an exercise. But no roadmap phase builds any admin endpoint (manage exercises, manage achievements). Either: (a) admin manages data directly via SQL for MVP — fine, but write that down; or (b) an admin epic is missing. **Decision needed.**
2. **Phase 12's title is slightly misleading.** It's called "Leaderboard & Public Profiles," but the public profile endpoint (`GET /users/:id` → US-13) is actually built in Phase 11. Suggest renaming Phase 12 to just "Leaderboard" — one-word doc fix.
3. **Branch-per-story vs branch-per-phase.** Recommendation: keep **one branch per epic/phase** (`feature/auth`, `feature/workouts`, ...) rather than per story. US-06 and US-08 share code (achievements are checked inside the workout save) — separate branches would conflict constantly. The roadmap's existing `feature/*` naming already matches this. Stories small enough to be a branch are already a phase.

---

*Linked docs: [backend-roadmap.md](backend-roadmap.md) · [learning-log.md](learning-log.md) (Lesson 63 — how stories dictate model functions)*
