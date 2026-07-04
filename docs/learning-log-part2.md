# Altus Backend — Learning Log Part 2

Part 1 (`learning-log.md`) logs concepts chronologically as numbered lessons. This file organises knowledge by topic — use it as a reference rather than a history. Same rule: record the *why*, not just the *what*.

---

## Docker

### Running a SQL query inside Docker without opening a shell

You do not need to enter the container to run a one-off query. Use `docker compose exec` with the `-c` flag to pass the query directly:

```bash
docker compose exec db psql -U <DB_USER> -d <DB_NAME> -c "SELECT id, username FROM users;"
```

**What the flags mean:**
- `-U` — **User** — the PostgreSQL username to connect as
- `-d` — **database** — the database name to connect to
- `-c` — **command** — the SQL query to run (skips the interactive shell)

If you want an interactive psql shell instead, omit the `-c` flag:

```bash
docker compose exec db psql -U <DB_USER> -d <DB_NAME>
```

Then type queries freely and `\q` to exit. Use the one-liner when you know exactly what you want; use the shell when you are exploring.

---

### `docker compose down` vs `docker compose down -v` — what the `-v` flag destroys

```
docker compose down          ← stops and removes containers, keeps volumes
docker compose down -v       ← stops containers AND deletes volumes (all database data)
```

A Docker volume is where Postgres stores its data — every table, every row, every migration. It persists between `docker compose down` and `docker compose up` so your data survives restarts. The `-v` flag deletes that volume entirely.

**When to use each:**

| Situation | Command |
|---|---|
| Stop containers to save memory, keep data | `docker compose down` |
| Wipe everything and start fresh (e.g. fix a bad migration) | `docker compose down -v` |

**After `docker compose down -v`**, the database is empty — no tables, no data. You must re-run migrations and seeds before tests or the app will work:

```
docker compose exec app npm run migrate
docker compose exec app npm run seed
```

Using `-v` by mistake is an easy way to lose all local data. If the goal was just to stop containers, omit the flag.

---

### Reaching a Dockerised Postgres from a script running on the host (not inside a container)

`docker compose ps` shows the `db` service's port mapping:

```
0.0.0.0:5432->5432/tcp
```

This means Docker **publishes** the container's port 5432 onto the host machine's port 5432. Any process running directly on the host — including a `ts-node` script run in a normal terminal, completely outside any container — can reach Postgres at `localhost:5432` because of this mapping. Nothing about running the script "goes through" Docker; it just connects over the network to the port Docker exposed.

This is exactly why `.env` has `DB_HOST=localhost` and not `DB_HOST=db`:

| Where the code runs | Correct `DB_HOST` | Why |
|---|---|---|
| Directly on the host (e.g. `npx ts-node ...`, local Jest tests) | `localhost` | The published port is only reachable from the host under `localhost` |
| Inside the `app` container (e.g. the real running server) | `db` | `localhost` inside a container means the container itself; `db` is the other container's name on the shared Docker network |

Same database, two different hostnames — the difference is *where the connecting process itself is running*, not where Postgres is running.

---

## npm vs npx

### What is the difference between `npm` and `npx`?

Both come with Node.js, but they do different jobs.

**`npm`** is a package manager — it installs, removes, and manages packages. The only way to run code with `npm` is through the `scripts` section in `package.json`:

```json
"scripts": {
  "test": "jest",
  "build": "tsc"
}
```

When you run `npm test`, npm looks up the `"test"` key and runs whatever command is there. You cannot pass extra arguments directly — `npm test exercise` does not work the way you might expect.

**`npx`** runs a package binary directly — no `package.json` script needed. If the package is installed locally (in `node_modules/.bin/`), npx finds it and runs it. This lets you pass arguments freely:

```
npx jest exercise        ← runs Jest with "exercise" as a filter (only runs exercise.test.ts)
npx jest --coverage      ← runs Jest with the coverage flag
npx jest auth exercise   ← runs only auth.test.ts and exercise.test.ts
```

The argument after `jest` is a **test name filter** — Jest treats it as a regex and only runs files whose path matches it.

**When to use which:**

| Situation | Use |
|---|---|
| Running a defined project script | `npm run <script>` (or `npm test` for the test script) |
| Running all tests the normal way | `npm test` |
| Running one test file while debugging | `npx jest <filename>` |
| Passing flags to a tool without adding a script | `npx <tool> --flag` |
| Running a one-off tool without installing it globally | `npx <package>` |

In day-to-day development you will mostly use `npm test` (runs the full suite). Use `npx jest <filter>` when you are working on one file and do not want to wait for every other test to run.

### A dependency can be "installed" without you asking for it

`ts-node` is not listed anywhere in this project's `package.json`, yet `npx ts-node` works. That is because `ts-node-dev` (which *is* a direct `devDependency`) depends on `ts-node` internally. npm installs every transitive dependency into `node_modules` and hoists their executables into `node_modules/.bin/` — which is exactly where `npx` looks. So `ts-node` is real and runnable, just not something the project intentionally added. Relying on a transitive binary is fragile: if `ts-node-dev` ever stops depending on `ts-node`, the command silently breaks with no warning from this project's own dependency list.

### Running a single file directly with `ts-node`

There is no npm script for "run one arbitrary `.ts` file", so use `npx` directly:

```bash
npx ts-node -r dotenv/config src/models/achievement.model.ts
```

- `npx ts-node` — runs that file through the TypeScript compiler, no build step needed
- `-r dotenv/config` — see below

Useful for debugging one model/service function in isolation without booting the whole server.

### The `-r` flag — preloading a module before your file runs

`-r` (`--require`) is a native Node.js CLI flag: "before executing my target file, `require()` this module first." `-r dotenv/config` preloads the `dotenv/config` module, whose entire job is a side effect — read `.env` and copy its keys into `process.env`. Nothing is imported by name; requiring it is the action.

**Why it was needed here:** [src/app.ts](../src/app.ts) does the same thing as a top-of-file import — `import 'dotenv/config';` — because `app.ts` is always the first file loaded when the real server starts. Running `achievement.model.ts` directly skips `app.ts` entirely, so nothing loads `.env` unless told to. `-r dotenv/config` is the CLI equivalent for standalone scripts. This is documented in dotenv's own README as the "preload" pattern — built for exactly this case.

---

## Project Structure

### The app/server split — why `app.ts` and `index.ts` are separate files

In real production codebases, `index.ts` is split into two files:

```
app.ts     → builds the Express app (routes, middleware), exports it
index.ts   → imports app, calls app.listen() — the only entry point
```

**Why:** `index.ts` does two things — build the app and start the server. Tests only need the app, not a running server. If a test imports `index.ts`, `app.listen()` fires as a side effect, binding a port unnecessarily and causing conflicts (especially if the server is already running in Docker).

By keeping `app.ts` clean and portable, tests import it without triggering a server start. `index.ts` is never imported by tests.

**The second reason (beyond testing):** some teams run the same Express app in multiple ways — as a regular server (`app.listen()`), or as a serverless function (AWS Lambda, Vercel) where the cloud provider handles the server and you just export the app. A clean `app.ts` export makes both possible without duplicating code.

This pattern is common enough that it has a name: the **app/server split**.

---

## TypeScript Configuration

### The `"types"` field in tsconfig.json is an allowlist

When you leave the `"types"` field out of `tsconfig.json`, TypeScript automatically includes every `@types/*` package you have installed. But the moment you write a `"types"` array, it becomes an **allowlist** — TypeScript only loads what is listed and ignores everything else.

```json
"types": ["node"]           ← only Node globals — @types/jest is ignored
"types": ["node", "jest"]   ← Node globals + Jest globals — both loaded
```

This is why `describe`, `it`, and `expect` showed red underlines even after installing `@types/jest`. The package was installed but TypeScript was not loading it because only `"node"` was listed.

**The rule:** if you use the `"types"` field at all, every type package you need must be listed there. The common ones for this project: `"node"` (always) and `"jest"` (once tests are added).

---

## Automated Testing

### The problem with manual curl

Curl works for checking a single endpoint in the moment. It does not scale. Every time a new feature is added, someone has to manually re-run every curl command in `testing.md` to make sure nothing broke. That is called a **regression** — when a new change accidentally breaks something that previously worked.

Problems with manual testing at scale:
- Humans forget steps
- Curl cannot run automatically when code is pushed to GitHub
- Curl cannot tell you *exactly* which assertion failed — you read the output and judge
- Curl requires Docker to be running and the server to be up

Automated tests solve all of this. Write the test once and it runs forever — locally, in CI, on every push.

### The tools: Jest + Supertest

The industry standard for testing Express APIs in TypeScript:

| Tool | What it does |
|---|---|
| **Jest** | Test runner — discovers test files, executes them, reports pass/fail, measures coverage |
| **Supertest** | Sends HTTP requests to the Express `app` object in memory — no server startup required |
| **ts-jest** | TypeScript preprocessor for Jest — write tests in `.test.ts` without compiling first |
| **@types/jest** | TypeScript types for Jest globals (`describe`, `it`, `expect`) |
| **@types/supertest** | TypeScript types for Supertest's request/response object |

All five are `devDependencies` — never in the production build.

### Why Supertest instead of a real HTTP client

Supertest connects directly to the Express `app` object in memory. It does not bind to a port. This means:

- No running server required — tests import the app and hit it directly
- Tests start instantly — no waiting for a server to boot
- No port conflicts if multiple test runners run simultaneously

The alternative (starting the actual server on port 5600 before every test) is fragile, slow, and requires more setup.

### Why not Postman/Newman

Postman is useful for manual exploration during development. Newman is Postman's CLI runner for CI. But for a TypeScript project, they are not the primary testing tool:

- Postman collections are JSON blobs — hard to review, hard to read the diff in a PR
- Sharing setup between tests (register a user, get a token, use it on the next test) is awkward in Postman
- Jest test files are `.ts` files — version-controlled, reviewed like any other code, run with `npm test`

The roadmap's CI Level 3 checkpoint runs `npm test` — that command runs Jest. That is what this project is built around.

### What a test file looks like (conceptually)

Jest organises tests in two levels:

- `describe()` — a group of related tests (e.g. all tests for `POST /v1/auth/register`)
- `it()` or `test()` — a single test case (e.g. "duplicate email returns 409")

```
describe("POST /v1/auth/register")
  it: valid data → status 201 + body has token and user
  it: duplicate email → status 409 + error message
  it: duplicate username → status 409 + error message

describe("POST /v1/auth/login")
  it: valid credentials → status 200 + body has token and user
  it: wrong password → status 401
  it: unknown email → status 401
```

This follows the **AAA pattern** — Arrange, Act, Assert:

1. **Arrange** — create the test data (register a user, get a token)
2. **Act** — make the HTTP request via Supertest
3. **Assert** — check the status code and response body with `expect()`

### Integration tests vs unit tests (in this project's context)

| | Integration test | Unit test |
|---|---|---|
| What it tests | The full stack: HTTP → controller → service → model → DB | One function in isolation |
| Database involved? | Yes — real Postgres | No |
| Checks | "Does this endpoint do the right thing end to end?" | "Does this function return the right value?" |
| Speed | Slower (DB round-trips) | Very fast (in-memory only) |
| What it catches | Broken SQL, wrong JOINs, missing middleware, wrong status codes | Logic bugs in one function |

For this project, **integration tests are the priority**. The interesting bugs live at the boundaries between layers — wrong SQL, missing auth middleware, incorrect status codes. Unit tests for individual service functions are lower value because the functions are small and each layer has one job.

### Why the test database must be real (no mocking)

The most common beginner mistake in backend testing is mocking the database. A mocked DB returns whatever you tell it to return — so you can write passing tests for SQL that would crash in production.

Real database tests catch:
- Column name typos in SQL (`user_id` vs `userId`)
- Missing JOIN conditions that return wrong data
- `UNIQUE` constraint violations that only the real DB enforces
- `RETURNING` clauses that fail because of a wrong column name

The cost is that tests need Docker running with the Postgres container up. That cost is worth it.

### Where test files live

```
src/
  __tests__/
    auth.test.ts          ← register, login, middleware error cases
    exercise.test.ts      ← GET /exercises
    workout.test.ts       ← POST /workout_sessions, GET /workout_sessions/me
```

One file per endpoint group. Named after the route, not the phase. Each file is self-contained — it sets up its own test data and does not depend on another test file having run first.

### The Supertest response object — what `res` contains

When Supertest makes a request, the response object has these properties:

| Property | What it contains | Example |
|---|---|---|
| `res.status` | HTTP status code as a number | `201`, `401`, `409` |
| `res.body` | Parsed JSON body — whatever `res.json()` sent | `{ token: "...", user: {...} }` |
| `res.headers` | Response headers | `{ "content-type": "application/json" }` |
| `res.ok` | `true` if status is 2xx, `false` otherwise | `true` on 201, `false` on 401 |

**Why error tests check `res.body.error`:** controllers always send errors as `{ error: "message" }`. So `res.body` is that object and `res.body.error` is the string. The consistent error shape (Lesson 84) is what makes this predictable across every test. Success responses follow the same logic — `res.body.token`, `res.body.user`, etc. match exactly what the controller passed to `res.json()`.

### What does "test runner" mean?

A test runner is like a **coach with a stopwatch and a scoreboard**. It does not know anything about HTTP or databases — its only job is to find your test files, run each test, and report which ones passed ✅ and which ones failed ❌. Jest is the runner. When you type `npm test`, you are telling Jest to start running.

### What does "HTTP client" mean — is Supertest like a human making a request?

Yes — exactly that. When you test manually with curl, you type a command and read the response. Supertest does the same thing in code, automatically:

```
You with curl:       curl -X POST /v1/auth/register -d '{"email":...}'
Supertest in code:   request(app).post('/v1/auth/register').send({ email: ... })
```

"HTTP client" just means: something that *makes* HTTP requests — as opposed to your Express server, which *receives* them. Jest organises the tests. Supertest does the actual requesting. Your Express app has no idea it is being tested.

### How to find configuration docs for any tool — without asking anyone

When you install a new tool and need to configure it, there are three places to look, in this order:

**1. The npm page of the package (`npmjs.com/package/<name>`)**
Every package on npm has a README. For tools like `ts-jest`, the README has a "Getting Started" section that shows the minimal working config. This is always your first stop after installing something new.

**2. The tool's official docs — look for the Configuration section**
Once you know a config key exists (e.g. `testEnvironment`), the full explanation of accepted values lives in the official docs. For Jest: `https://jestjs.io/docs/configuration`

**3. Google the specific combination**
Search `"jest ts-jest typescript express config"` — the community has already solved the most common setups and the top results show the standard pattern.

**The pattern inside most docs:**

```
Getting Started  ← minimal working config — always start here
Configuration    ← every option explained in full
API Reference    ← functions and their arguments
```

Start with Getting Started. Go to Configuration only when you need to change a specific behaviour. You rarely need the API Reference when beginning.

This applies to every tool — not just Jest. Express, pg, bcryptjs, dotenv — all have npm pages with README examples and official docs with a configuration reference.

### Why you do not import model types into test files

`res.body` in Supertest is typed as `any`. Even if you import a model interface and cast the body, the compiler accepts the cast unconditionally — it does not verify that the API actually returned that shape.

```typescript
// This looks type-safe but is not — it's just a promise to the compiler
const body = res.body as WorkoutSession;
expect(body.score).toBeDefined();
```

In test files, the `expect()` assertions are the type check. They verify the actual runtime value returned by the endpoint:

```typescript
expect(res.body.score).toBeDefined(); // checks what the server actually sent
```

This is more reliable than a compile-time cast on an `any` value.

**When types are useful in test files:** file-level variables that you assign yourself — `let token: string` and `let difficultyId: string`. TypeScript will catch it if you accidentally assign the wrong type to those.

The rule: use types where the compiler can actually enforce something. Do not cast `res.body` just to make the file look more TypeScript-y.

### The `npm test` script and CI

The `"test"` script in `package.json` currently prints an error and exits 1. Once Jest is configured it becomes:

```json
"test": "jest"
```

GitHub Actions' Level 3 CI step runs `npm test`. When that command passes, the test suite is green. When it fails, the PR cannot merge. That is the gate.

### Branch strategy for testing

Tests are part of the definition of done for a feature — not a separate task added later. If Phase 9's code lives on `feat/workout-sessions`, the test files for Phase 9 (and the test setup for all prior phases) also go on that branch. The branch is only ready to merge when:

1. The feature code is complete
2. The full test suite passes (auth + exercises + workout sessions)
3. CI is green

"The code works, I'll add tests later" is a debt that rarely gets paid.

---

## Database Seeding

### What to seed vs what not to seed

Not every table in the schema needs seed data. The rule:

| Table type | Seed it? | Why |
|---|---|---|
| Static reference data (exercises, achievements) | ✅ Yes | These rows must exist before the app can function |
| Admin / system users | ✅ Yes | A known test user makes development easier |
| User-generated data (workout_sessions, user_achievements) | ❌ No | These fill dynamically as users interact with the app |

`user_achievements` is the key example — it starts empty and is correct that way. The achievement evaluation system inserts rows when a user earns a badge. Seeding it would be fake data that bypasses the logic you are trying to test.

**Exception for local development:** it is valid to seed a few `user_achievements` rows so you can test the `GET /v1/users/me/achievements` endpoint without completing workouts first. Just know this is dev-only data, not production behaviour.

### The FK lookup pattern in seed files

When a seed function inserts a row that references another table via foreign key, you cannot hardcode the ID — the database generates it. The pattern is: query for the parent ID first, then use it in the child insert.

```ts
// ✅ correct — look up the ID, then use it
const result = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
const userId = result.rows[0].id;
await pool.query(`INSERT INTO user_achievements (user_id, ...) VALUES ($1, ...)`, [userId]);

// ❌ wrong — IDs are UUIDs generated by Postgres, never hardcoded
await pool.query(`INSERT INTO user_achievements (user_id, ...) VALUES ('abc-123', ...)`);
```

This pattern already exists in `seedExerciseDifficulties` — it looks up `squatId` before inserting difficulties. Apply it whenever one seed function depends on rows created by another.

**Ordering matters:** always call the parent seed function before the child. `seedUserAchievements` must run after both `seedUsers` and `seedAchievements` because it depends on rows from both.

### Array + loop pattern for repeated inserts

When seeding multiple rows with the same shape, use an array of values and a single loop instead of repeating `pool.query` for each row:

```ts
// ❌ verbose — 12 separate pool.query calls
await pool.query(`INSERT INTO achievements ...`, ['First Workout', ..., 1]);
await pool.query(`INSERT INTO achievements ...`, ['Getting Started', ..., 5]);
// ... 10 more

// ✅ clean — one loop, one query shape
const achievements = [
  ['First Workout', 'Complete your first workout', 'session_count', 1],
  ['Getting Started', 'Complete 5 workouts', 'session_count', 5],
  // ...
];
for (const [name, description, requirement_type, requirement_value] of achievements) {
  await pool.query(`INSERT INTO achievements ...`, [name, description, requirement_type, requirement_value]);
}
```

This is easier to read, easier to add rows to, and the `ON CONFLICT DO NOTHING` makes re-running the seed safe every time.

---

## API Design

### When to include a timestamp in a response

A timestamp column on a join table (like `user_achievements.unlocked_at`) should be included in the response when it adds meaning for the user — not just because it exists in the database.

For `GET /v1/users/me/achievements`, `unlocked_at` tells the user *when* they earned each badge. That is part of the experience — a badge with a date is more rewarding than a badge without one. Include it.

The test: ask "does the user care when this happened?" If yes, include it. If the timestamp is internal (e.g. `created_at` on an exercise row), leave it out of the public response.

### Two interfaces for the same table depending on the query

When the same table is queried in two different ways, the response shape differs and needs two separate TypeScript interfaces.

Example from the achievement model:

```ts
// Query: SELECT * FROM achievements
// No join — no unlocked_at
interface Achievement {
  id: string;
  name: string;
  description: string;
  requirement_type: string;
  requirement_value: number;
}

// Query: SELECT a.*, ua.unlocked_at FROM achievements a JOIN user_achievements ua ...
// Has join — includes unlocked_at
interface UserAchievement extends Achievement {
  unlocked_at: Date;
}
```

`UserAchievement extends Achievement` avoids repeating every field. The `unlocked_at` comes from the `user_achievements` join, not the `achievements` table itself.

---

## SQL

### `INSERT` clause order: `VALUES` → `ON CONFLICT` → `RETURNING`

Postgres enforces a fixed clause order on `INSERT`. `RETURNING` must always come **last** — same family of bug as Lesson 120 (`JOIN` must come before `WHERE`): SQL clauses aren't free-order, each one only makes sense once the clauses before it have already been applied.

```sql
-- ❌ syntax error at or near "ON" — RETURNING before ON CONFLICT
INSERT INTO user_achievements (user_id, achievement_id)
VALUES ($1, $2) RETURNING user_id, achievement_id, unlocked_at
ON CONFLICT DO NOTHING

-- ✅ correct order
INSERT INTO user_achievements (user_id, achievement_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING
RETURNING user_id, achievement_id, unlocked_at
```

`RETURNING` describes what to hand back *after* the conflict has already been resolved — Postgres has to know whether the row was inserted before it can decide what to return, so it can't appear earlier in the statement.

### `ON CONFLICT DO NOTHING` + `RETURNING` can return zero rows — not an error

When a conflict fires and `DO NOTHING` skips the insert, `RETURNING` has nothing to return — the query still succeeds, but `result.rows` is an empty array, not a row. `result.rows[0]` is `undefined` in that case.

This matters for the function's return type. A signature like `Promise<Achievement>` (non-optional) is a lie if the row can legitimately be absent — the caller has no compiler-enforced reminder that "already unlocked" is a real, expected outcome, not an edge case to ignore. The honest signature is `Promise<Achievement | undefined>` (or similar), which forces every caller to handle "nothing happened" explicitly.

This distinction is exactly what `evaluateAchievements()` needs to build the `new_achievements` array (Phase 10) — it has to tell "just unlocked this workout" apart from "already had it," and that's only possible if `unlock()`'s return value can honestly express both cases.

---

## Development Workflow

### How to figure out "what's next" without being told

The instinct is to pull the next unchecked box off the roadmap and start typing. A more reliable process:

1. **Re-anchor on the user story, not the code.** Ask what the *user* actually experiences, not which function is missing. For Phase 10: "After I finish a workout, I might unlock a badge. I can also look at all my badges anytime" — that's two separate flows, not one task.
2. **Trace each flow's full request lifecycle before writing anything** — e.g. `POST /workout_sessions` → save session → check thresholds → insert newly earned achievements → return them alongside the session response.
3. **Check what already exists before assuming the roadmap is current.** The roadmap is a plan; the code is the truth. Read the actual file to see which pieces of a flow are already built, not just which checkboxes are ticked.
4. **Build in the order that unblocks the most other work: Model → Service → Controller → Route.** Each layer literally calls the one below it, so a service function can't be written until the model function it depends on exists. Whichever missing model function most other pending work depends on is the one to write first — not necessarily the first one listed.

Applying this to Phase 10 surfaced that the model layer was still missing a plain, unfiltered `getAll()` (all achievements + thresholds, no user, no join) — without it, `evaluateAchievements()` in the service layer has nothing to compare a user's stats against. That gap wasn't visible from the roadmap text alone; it only showed up by tracing what the *next* layer up actually needs.

### Writing TODOs as a plan before coding

Before implementing a function, write a `// TODO` comment for each step as a planning skeleton. Work top to bottom — implement one step, delete its TODO, move to the next. When all TODOs are gone, the function is done.

```ts
// TODO: getAllAchievements()
// - SELECT * FROM achievements ORDER BY requirement_value ASC

// TODO: getUserAchievements(userId)
// - JOIN user_achievements → achievements WHERE ua.user_id = $1

// TODO: unlockAchievement(userId, achievementId)
// - INSERT INTO user_achievements ON CONFLICT DO NOTHING
```

This approach forces you to think through the logic before writing TypeScript. It also acts as a checklist — you can see at a glance which functions are done and which are not.

### Better Comments extension — colour codes

The **Better Comments** VS Code extension (Aaron Bond) colour-codes comments by prefix, making intent immediately visible:

| Prefix | Colour | Use for |
|---|---|---|
| `// *` | Green | Section headers, highlights |
| `// !` | Red | Warnings, blockers, important notes |
| `// ?` | Blue | Questions, uncertainty |
| `// TODO` | Orange | Steps to implement |
| `// //` | Grey strikethrough | Removed or skipped code |

Use `// TODO` for planning (orange stands out while you work). Use `// !` when a constraint is easy to miss. Delete all TODOs before committing — they are working notes, not permanent comments.
