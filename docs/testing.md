# Altus Backend — Testing Guide

A record of manual API tests organised by phase. Each section covers one feature area and lists the curl commands needed to verify it works correctly — including both the happy path and expected error cases.

---

## How to read a curl command

```bash
curl -i -X POST http://localhost:5600/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"player1","email":"player1@test.com","password":"password123"}'
```

| Flag | Stands for | What it does |
|---|---|---|
| `-i` | include | Shows the full response: status line, headers, then body. Without this, curl only shows the body — you cannot see the status code. |
| `-X POST` | method | Sets the HTTP method. `-X GET`, `-X POST`, `-X PUT`, `-X DELETE`. If omitted, curl defaults to GET. |
| `http://localhost:5600/...` | — | The URL. `localhost` = your own machine. `5600` = the port Docker exposes. |
| `-H "Content-Type: application/json"` | header | Tells the server the body is JSON. Without it, `express.json()` does not parse the body and `req.body` arrives as `undefined`. |
| `-d '{"key":"value"}'` | data | The request body. Single quotes wrap the whole thing so the shell does not misinterpret the inner double quotes. |
| `\` | (shell) | Line continuation — splits one long command across multiple lines for readability. Still one request. |

**What `-i` output looks like:**

```
HTTP/1.1 201 Created          ← status line — this is what you are verifying
Content-Type: application/json
...
                              ← blank line separates headers from body
{"token":"...","user":{...}}  ← body
```

**Types of tests in this document:**

- **Integration test** — sends a real HTTP request to the running app, which hits the real database. Verifies the full stack works end to end. Requires `docker compose up -d`.
- **Unit test** — tests one function in isolation, no database or HTTP. Altus does not have unit tests yet — that is a future phase.

All tests in this document are **integration tests**.

---

## Prerequisites

Before running any test below:

```bash
docker compose up -d
```

Verify the app is up:

```bash
curl -i http://localhost:5600/health
```

Expected status: `200 OK` — Expected body: `{"status":"ok"}`

---

## Part 1 — Authentication (Phase 7a)

Tests for `POST /v1/auth/register` and `POST /v1/auth/login`.

---

### 1.1 Register — happy path

**What it tests:** A new visitor creates an account successfully.  
**Expected status:** `201 Created`  
**Expected body:** `{ token, user }` — user contains id, username, email, google_id, role, created_at, updated_at

```bash
curl -i -X POST http://localhost:5600/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"player1","email":"player1@test.com","password":"password123"}'
```

---

### 1.2 Register — duplicate email

**What it tests:** A visitor tries to register with an email already in the database.  
**Expected status:** `409 Conflict`  
**Expected body:** `{ "error": "Email already registered" }`

```bash
curl -i -X POST http://localhost:5600/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"player99","email":"player1@test.com","password":"password123"}'
```

---

### 1.3 Register — duplicate username

**What it tests:** A visitor tries to register with a username already taken.  
**Expected status:** `409 Conflict`  
**Expected body:** `{ "error": "Username already registered" }`

```bash
curl -i -X POST http://localhost:5600/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"player1","email":"player99@test.com","password":"password123"}'
```

---

### 1.4 Login — happy path

**What it tests:** A registered user logs in with correct credentials.  
**Expected status:** `200 OK`  
**Expected body:** `{ token, user }`

```bash
curl -i -X POST http://localhost:5600/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"player1@test.com","password":"password123"}'
```

---

### 1.5 Login — wrong password

**What it tests:** A user enters the correct email but wrong password.  
**Expected status:** `401 Unauthorized`  
**Expected body:** `{ "error": "Invalid credentials" }`

```bash
curl -i -X POST http://localhost:5600/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"player1@test.com","password":"wrongpassword"}'
```

---

### 1.6 Login — email not registered

**What it tests:** A user tries to log in with an email that does not exist in the database.  
**Expected status:** `401 Unauthorized`  
**Expected body:** `{ "error": "Invalid credentials" }`

```bash
curl -i -X POST http://localhost:5600/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nobody@test.com","password":"password123"}'
```

> Note: Both wrong password and unknown email return `401` with the same message `"Invalid credentials"`. This is intentional — telling the user *which* one was wrong (email or password) helps attackers enumerate valid accounts.

---

## Part 2 — Exercises (Phase 8)

Tests for `GET /v1/exercises`.

This endpoint is protected — you need a valid JWT. Run one of the login commands from Part 1 first, then copy the `token` value from the response and paste it into the curl commands below where `<your-token>` appears.

---

### 2.1 Get all exercises — happy path

**What it tests:** An authenticated user fetches all active exercises with nested difficulty presets.  
**Expected status:** `200 OK`  
**Expected body:** An array of exercise objects, each with a `difficulties` array nested inside.

```bash
curl -i http://localhost:5600/v1/exercises \
  -H "Authorization: Bearer <your-token>"
```

Check the response: each exercise should have `id`, `name`, `description`, `calories_per_rep`, and a `difficulties` array. Each difficulty should have `id`, `level_name`, `target_reps`, `score_multiplier`.

---

### 2.2 Get exercises — no token

**What it tests:** A request with no Authorization header is rejected.  
**Expected status:** `401 Unauthorized`  
**Expected body:** `{ "error": "..." }`

```bash
curl -i http://localhost:5600/v1/exercises
```

---

### 2.3 Get exercises — invalid token

**What it tests:** A request with a malformed or expired token is rejected.  
**Expected status:** `401 Unauthorized`  
**Expected body:** `{ "error": "..." }`

```bash
curl -i http://localhost:5600/v1/exercises \
  -H "Authorization: Bearer this.is.not.a.valid.token"
```

---

## Part 3 — Workout Sessions (Phase 9)

Tests for `POST /v1/workout_sessions` and `GET /v1/workout_sessions/me`.

### Prerequisites for Part 3

Phase 9 tests require two things before you start:

**1. A valid token** — register or login (Part 1) and copy the `token` from the response.

**2. A real `exercise_difficulty_id`** — this is a UUID that only exists in your database. You cannot hardcode it.

Run this first and copy an `id` from inside any `difficulties` array:

```bash
curl -s http://localhost:5600/v1/exercises \
  -H "Authorization: Bearer <your-token>"
```

Take one of the difficulty `id` values — for example, the `id` from the "Medium" difficulty of Squats. You will use it as `exercise_difficulty_id` in the POST test below.

---

### 3.1 Save a workout session — happy path

**What it tests:** An authenticated user saves a completed session. Score and calories are calculated server-side.  
**Expected status:** `201 Created`  
**Expected body:** `{ id, score, calories_burned, completed_at, new_achievements }` — `new_achievements` is `[]` unless this session crossed a threshold (Phase 10)

Replace `<exercise_difficulty_id>` with the UUID you copied from Step 2 above.

```bash
curl -i -X POST http://localhost:5600/v1/workout_sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{"exercise_difficulty_id":"<exercise_difficulty_id>","reps_completed":10,"duration_seconds":45}'
```

Verify the response: `score` should equal `reps_completed × score_multiplier` for the difficulty you chose. For Medium Squats (score_multiplier 1.5) with 10 reps: `score = 10 × 1.5 = 15`.

---

### 3.2 Save a workout session — fake difficulty ID

**What it tests:** Sending an `exercise_difficulty_id` that does not exist in the database returns an error, not a server crash.  
**Expected status:** `404 Not Found`  
**Expected body:** `{ "error": "..." }`

```bash
curl -i -X POST http://localhost:5600/v1/workout_sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{"exercise_difficulty_id":"00000000-0000-0000-0000-000000000000","reps_completed":10,"duration_seconds":45}'
```

---

### 3.3 Save a workout session — no auth

**What it tests:** A request without a token is rejected before reaching the controller.  
**Expected status:** `401 Unauthorized`  
**Expected body:** `{ "error": "..." }`

```bash
curl -i -X POST http://localhost:5600/v1/workout_sessions \
  -H "Content-Type: application/json" \
  -d '{"exercise_difficulty_id":"00000000-0000-0000-0000-000000000000","reps_completed":10,"duration_seconds":45}'
```

---

### 3.4 Get my workout history — happy path

**What it tests:** An authenticated user retrieves their full workout history. Run this after 3.1 so there is at least one session to return.  
**Expected status:** `200 OK`  
**Expected body:** An array of session objects — each with `id`, `exercise`, `difficulty`, `reps_completed`, `score`, `duration_seconds`, `calories_burned`, `completed_at`

```bash
curl -i http://localhost:5600/v1/workout_sessions/me \
  -H "Authorization: Bearer <your-token>"
```

---

### 3.5 Get my workout history — no auth

**What it tests:** A request without a token is rejected.  
**Expected status:** `401 Unauthorized`

```bash
curl -i http://localhost:5600/v1/workout_sessions/me
```

---

## Part 4 — Automated Testing (Phase 9+)

> This section documents the shift from manual curl tests to automated tests using Jest and Supertest. The curl commands above remain useful for quick manual checks. Automated tests replace the repetitive work of re-running everything by hand.

### Why automate

Every time a new feature is added, someone has to manually re-run every curl command to make sure nothing broke. That is called a **regression** — when a new change accidentally breaks something that used to work. Humans forget steps. Curl cannot run at 2am when a CI pipeline fires.

Automated tests solve this. Write the test once. It runs on every push, in every environment, forever.

### Tools

| Tool | What it does |
|---|---|
| **Jest** | Test runner — finds test files, runs them, reports pass/fail |
| **Supertest** | Sends HTTP requests to the Express app in-process — no server startup needed |
| **ts-jest** | TypeScript support for Jest — write tests in `.test.ts` directly |

Install as dev dependencies:

```
jest  ts-jest  supertest  @types/jest  @types/supertest
```

### File structure

```
src/
  __tests__/
    auth.test.ts          ← register, login, error cases
    exercise.test.ts      ← GET /exercises
    workout.test.ts       ← POST + GET /workout_sessions
    achievements.test.ts  ← new_achievements on save, GET /users/me/achievements
```

### How a test is structured (concept)

```
describe("POST /v1/auth/register")
  test: valid data → 201 + { token, user }
  test: duplicate email → 409
  test: duplicate username → 409

describe("POST /v1/auth/login")
  test: valid credentials → 200 + { token, user }
  test: wrong password → 401
  test: unknown email → 401
```

Each test is independent — it creates its own data, makes its assertion, and cleans up. No test depends on another test having run first.

### The test database

Integration tests hit a **real PostgreSQL database** — the same Docker Postgres used for development. No mocking. This is intentional — mocked databases prove code talks to the mock correctly, not that the SQL is valid. Real database tests catch wrong column names, broken JOINs, and constraint violations.

See `docs/learning-log.md Part 2 — Automated Testing` for the full explanation of why.
