# Altus Backend — Errors Encountered

A record of real errors hit during development and deployment. Each entry documents the environment, root cause, and resolution — written so the same mistake is never repeated twice.

---

## Local Development

---

### ERR-001 — TypeScript cannot find Node.js globals

**Environment:** Local — Docker container  
**Command:** `npm run migrate`

**Error**
```
TSError: ⨯ Unable to compile TypeScript:
src/db/migrate.ts: Cannot find name '__dirname'.
```

**Root Cause**  
`tsconfig.json` was missing `"types": ["node"]` in `compilerOptions`. Without it, TypeScript does not recognise Node.js built-in globals including `__dirname`, `fs`, `path`, and `process`.

**Resolution**  
Added to `tsconfig.json` under `compilerOptions`:
```json
"types": ["node"]
```

**Prevention**  
Always include `"types": ["node"]` when starting a Node.js TypeScript project. It belongs in the initial tsconfig setup, not added later when errors appear.

---

### ERR-002 — Migration script defined but never called

**Environment:** Local — Docker container  
**Command:** `npm run migrate`

**Error**  
No output, nothing happened. The script ran and exited silently.

**Root Cause**  
`runMigrations` was defined as a function but the function call was never added at the bottom of the file.

**Resolution**  
Added the invocation at the bottom of `migrate.ts`:
```typescript
runMigrations().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
```

---

### ERR-003 — Seed failed — wrong number of query placeholders

**Environment:** Local — Docker container  
**Command:** `npm run seed`

**Error**
```
error: bind message supplies 4 parameters, but prepared statement "" requires 3
```

**Root Cause**  
An INSERT statement had 4 columns and 4 values in the array but only `$1, $2, $3` as placeholders — `$4` was missing. The pg library counts placeholders strictly against the values array.

**Resolution**  
Updated all affected queries to use `$4` as the fourth placeholder in the VALUES clause.

---

### ERR-004 — Seed failed — environment variables not loaded after .env change

**Environment:** Local — Docker container  
**Command:** `npm run seed`

**Error**
```
Seed failed: Error: ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env
```

**Root Cause**  
Docker containers load environment variables at startup only. Editing `.env` while a container is running has no effect — the container holds the values it was started with.

**Resolution**  
Restarted the containers to reload the updated `.env`:
```
docker compose down && docker compose up -d
```

**Prevention**  
Code changes → `docker compose up --build`. Environment variable changes → `docker compose down && docker compose up -d`.

---

## CI/CD — GitHub Actions

---

### ERR-005 — Deploy failed — Heroku CLI not found on GitHub Actions runner

**Environment:** GitHub Actions — deploy job  
**Trigger:** Push to `main`

**Error**
```
/bin/sh: 1: heroku: not found
Error: Command failed: heroku create moveverse-backend
```

**Root Cause**  
The `akhileshns/heroku-deploy@v3.13.15` GitHub Action fails to install the Heroku CLI on modern GitHub Actions runners. The action has 60+ open issues and multiple unresolved failure reports as of 2026.

**Resolution**  
Replaced the third-party action with a direct git push to Heroku's remote, authenticating via `.netrc`:
```yaml
- name: Deploy to Heroku
  env:
    HEROKU_API_KEY: ${{ secrets.HEROKU_API_KEY }}
    HEROKU_APP_NAME: moveverse-backend
    HEROKU_EMAIL: patrick.macabulos@gmail.com
  run: |
    cat > ~/.netrc <<EOF
    machine api.heroku.com
      login $HEROKU_EMAIL
      password $HEROKU_API_KEY
    machine git.heroku.com
      login $HEROKU_EMAIL
      password $HEROKU_API_KEY
    EOF
    git remote add heroku https://git.heroku.com/$HEROKU_APP_NAME.git
    git push heroku main
```

**Prevention**  
Avoid third-party GitHub Actions for critical deployment steps. A direct `git push` has no external dependency and will not break when an action goes unmaintained.

---

## Production — Heroku

---

### ERR-006 — Release phase failed — migrations folder not found

**Environment:** Heroku — release phase (`npm run migrate:prod`)  
**Trigger:** First deployment to Heroku

**Error**
```
Migration failed: Error: ENOENT: no such file or directory, scandir '/app/dist/db/migrations'
```

**Root Cause**  
`tsc` only compiles `.ts` files. The `.sql` migration files are never copied to `dist/`. At runtime, `__dirname` in the compiled file `dist/db/migrate.js` points to `dist/db/` — where no SQL files exist.

This error did not appear locally because `npm run migrate` uses `ts-node`, which runs from the source file directly, so `__dirname` pointed to `src/db/` where the SQL files live.

**Resolution**  
Changed the migrations folder path in `migrate.ts` from `__dirname` to `process.cwd()`:
```typescript
const migrationsFolder = path.join(process.cwd(), 'src', 'db', 'migrations');
```
`process.cwd()` always returns the project root (`/app` on Heroku), from which `src/db/migrations/` is always reachable regardless of where the compiled file lives.

---

### ERR-007 — Release phase failed — database rejecting unencrypted connection

**Environment:** Heroku — release phase  
**Trigger:** Deploy after ERR-006 was resolved

**Error**
```
Migration failed: error: no pg_hba.conf entry for host "...", user "...", database "...", no encryption
```

**Root Cause**  
Heroku Postgres requires SSL encrypted connections. The app was connecting without SSL, so the database server rejected the connection.

**Resolution**  
Added a conditional `ssl` option to the Pool config in `src/config/db.ts`:
```typescript
ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
```
The condition is required — local Docker Postgres does not use SSL. `rejectUnauthorized: false` allows Heroku's self-signed certificate, which Node rejects by default.

---

### ERR-008 — Release phase failed — database password must be a string

**Environment:** Heroku — release phase  
**Trigger:** Deploy after ERR-007 was resolved

**Error**
```
Migration failed: Error: SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string
```

**Root Cause**  
`DB_PASSWORD` was not set in Heroku Config Vars. `process.env.DB_PASSWORD` resolved to `undefined`, and the pg library requires a string for the password field.

**Resolution**  
Set all five database Config Vars in the Heroku dashboard under **Settings → Config Vars**, copied from the Heroku Postgres add-on credentials page:
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

**Prevention**  
Set all Config Vars before the first deployment. A missing variable produces an unhelpful error message — always verify Config Vars if a connection error appears.

---

### ERR-009 — heroku run command not found on Windows Git Bash

**Environment:** Local — Windows Git Bash (MINGW64)  
**Command:** `heroku run npm run seed:prod --app moveverse-backend`

**Error**
```
/bin/bash: line 1: run: command not found
```

**Root Cause**  
On Windows Git Bash, `heroku run npm run seed:prod` is parsed incorrectly — the shell passes `run` as the command instead of `npm run seed:prod`. This is a known compatibility issue between the Heroku CLI and MINGW64.

**Resolution**  
Bypass `npm run` and call the compiled file directly:
```
heroku run node dist/db/seed.js --app moveverse-backend
```

---

## Auth — Phase 7a

---

### ERR-010 — Controller sends `{}` to the frontend instead of `{ token, user }`

**Environment:** Local — any  
**Where:** `src/controllers/auth.controller.ts` — `handleRegister()`, `handleLogin()`

**Error**  
No crash. The frontend silently receives an empty object `{}` instead of the expected `{ token, user }`. The request also hangs if the service throws — the rejection is never caught.

**Root Cause**  
Missing `await` on async service calls:
```typescript
const result = register({ username, email, password }); // no await
res.status(201).json(result); // result is a Promise object, not the data
```
`register()` is `async` — it returns a `Promise`. Without `await`, `result` holds the unresolved Promise. `JSON.stringify` on a Promise produces `{}`.

**Resolution**  
Add `await` to every async service call:
```typescript
const result = await register({ username, email, password });
```

**Prevention**  
If a function is declared `async`, its return value is always a `Promise` — always `await` it at the call site.

---

### ERR-011 — Cannot set headers after they are sent to the client

**Environment:** Local — any  
**Where:** `src/controllers/auth.controller.ts` — `handleError()`

**Error**
```
Error: Cannot set headers after they are sent to the client
```

**Root Cause**  
Missing `return` after sending an error response inside a conditional:
```typescript
const handleError = (error: unknown, res: Response): void => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: error.message }); // sends response
    // no return — falls through to the next line
  }
  res.status(500).json({ error: 'Something went wrong' }); // tries to send again — crash
};
```
The first `res.json()` closes the HTTP transaction. The second call tries to write to an already-closed response.

**Resolution**  
Add `return` immediately after any conditional `res.json()`:
```typescript
res.status(error.statusCode).json({ error: error.message });
return;
```

**Prevention**  
`res.json()` must be called exactly once per request. After any `res.send*` inside a branch, always `return`.

---

### ERR-012 — TypeError: Cannot destructure property of undefined

**Environment:** Local — any  
**Where:** `src/controllers/auth.controller.ts` — `handleRegister()`, `handleLogin()`

**Error**
```
TypeError: Cannot destructure property 'username' of undefined
```

**Root Cause**  
`req.body` destructuring was placed outside the try/catch block:
```typescript
const { username, email, password } = req.body; // outside try — throws here
try {
  ...
} catch (error) {
  handleError(error, res); // never reached
}
```
If `express.json()` middleware is not registered, or the request has no `Content-Type: application/json` header, `req.body` is `undefined`. The TypeError fires outside the catch, so `handleError` never runs and the request hangs.

**Resolution**  
Move all `req.body` reads inside the try block:
```typescript
try {
  const { username, email, password } = req.body;
  ...
} catch (error) {
  handleError(error, res);
}
```

**Prevention**  
All code that can throw — including body reads — must live inside the try block so errors are always caught and a response is always sent.

---

### ERR-013 — ESLint config change not reflected until Docker image is rebuilt

**Environment:** Local — Docker container  
**Command:** `npm run lint` (run via `ts-node-dev` on file save)

**Error**  
After updating `eslint.config.mjs`, the old ESLint behaviour persisted and errors continued to appear as if the config had not changed.

**Root Cause**  
Docker builds the image once and copies all project files into it at that point. Changes to files on the host — including config files like `eslint.config.mjs` — are not automatically picked up by a running container unless a volume mount covers that file. Config files at the project root are not volume-mounted (only `./src` is mounted), so the container kept running with the old config baked into the image.

**Resolution**  
Rebuild the Docker image to bake in the updated config:
```bash
docker compose down && docker compose up --build
```

**Prevention**  
Any change outside `./src` requires a rebuild:
- `eslint.config.mjs` → rebuild
- `tsconfig.json` → rebuild
- `package.json` / `package-lock.json` → rebuild
- `Dockerfile` → rebuild

Only files inside `./src` are volume-mounted and reflected immediately without a rebuild. Environment variable changes (`.env`) do not require a rebuild — only `docker compose down && docker compose up -d`.

---

## Automated Testing — Phase 10

---

### ERR-014 — Jest finds zero test files after setup

**Environment:** Local  
**Command:** `npm test`

**Error**  
Jest ran and exited with no results — zero test suites, zero tests.

**Root Cause**  
`testMatch` in `jest.config.ts` was `*.tests.ts` (extra `s`). The glob pattern did not match any file.

**Resolution**  
Changed to `*.test.ts`.

---

### ERR-015 — Module not found on import of app

**Environment:** Local  
**Command:** `npm test`

**Error**
```
Cannot find module './app.'
```

**Root Cause**  
`src/index.ts` had a trailing dot in the import path: `import app from './app.'`.

**Resolution**  
Removed the trailing dot: `'./app'`.

---

### ERR-016 — `describe`/`it` from wrong module

**Environment:** Local  
**Command:** `npm test`

**Error**  
Tests ran but assertions behaved incorrectly or produced unexpected errors.

**Root Cause**  
`auth.test.ts` imported `describe` and `it` from `'node:test'` — Node's built-in test runner, not Jest. The two runners are incompatible.

**Resolution**  
Deleted the import entirely. Jest injects `describe`, `it`, `expect`, and `afterAll` as globals — no import is needed in any test file.

---

### ERR-017 — `expect()` silently never runs

**Environment:** Local  
**Command:** `npm test`

**Error**  
No error — but the assertion was never actually checked. Tests passed regardless of response content.

**Root Cause**  
`expect()` was written outside the `it` callback, where the `res` variable was out of scope.

**Resolution**  
Moved `expect()` inside the `it` callback where `res` is defined.

---

### ERR-018 — Jest finds zero test files (folder name typo)

**Environment:** Local  
**Command:** `npm test`

**Error**  
Zero test suites found after creating test files.

**Root Cause**  
The test folder was named `__test__` (missing `s`). The `testMatch` glob pattern requires `__tests__`.

**Resolution**  
Renamed the folder to `__tests__`.

---

### ERR-019 — Red underlines on `describe`, `it`, `expect` in VS Code

**Environment:** Local — VS Code  
**Where:** Any `.test.ts` file

**Error**  
`Cannot find name 'describe'`, `Cannot find name 'it'`, `Cannot find name 'expect'` — despite `@types/jest` being installed.

**Root Cause**  
`tsconfig.json` had `"types": ["node"]`. The `"types"` array is an allowlist — once it exists, TypeScript only loads what is listed and ignores all other installed `@types/*` packages, including `@types/jest`.

**Resolution**  
Added `"jest"` to the array: `"types": ["node", "jest"]`.

**Prevention**  
If `"types"` is used at all, every required type package must be listed. Adding a new `@types/*` package is not enough — it must also be added to the `"types"` array.

---

### ERR-020 — `token` variable out of scope in test

**Environment:** Local  
**Where:** `src/__tests__/exercise.test.ts`

**Error**
```
Cannot find name 'token'
```

**Root Cause**  
`const token = res.body.token` was declared inside `beforeAll`. Variables declared with `const` or `let` inside a function are scoped to that function and destroyed when it returns.

**Resolution**  
Declared `let token: string` at the file level, then assigned inside `beforeAll` without `const` or `let`:
```typescript
let token: string;

beforeAll(async () => {
  const res = await ...
  token = res.body.token;
});
```

---

### ERR-021 — `.set()` chained after `await`

**Environment:** Local  
**Where:** `src/__tests__/exercise.test.ts`

**Error**  
TypeScript error or runtime crash — `.set()` not available on the resolved response object.

**Root Cause**  
`await` was placed around only the request call, then `.set()` was chained on the result:
```typescript
const res = (await request(app).get('/v1/exercises')).set('Authorization', `Bearer ${token}`);
```

**Resolution**  
Chain `.set()` before awaiting:
```typescript
const res = await request(app).get('/v1/exercises').set('Authorization', `Bearer ${token}`);
```

---

### ERR-022 — Test gets 401 on second and subsequent runs

**Environment:** Local  
**Where:** `src/__tests__/exercise.test.ts` — test 1

**Error**
```
Expected: 200
Received: 401
```

**Root Cause**  
`afterAll` was deleting `cap@gmail.com` (copied from `auth.test.ts`) but the test registered `exercise@gmail.com`. The test user was never cleaned up. On the next run, `beforeAll` tried to register the same user again, got a 409 conflict, and `res.body.token` was `undefined`. The test then sent `Bearer undefined` → 401.

**Resolution**  
Changed `afterAll` to delete `exercise@gmail.com` — matching the email used in `beforeAll` exactly.

**Prevention**  
`afterAll` must delete the exact email(s) that `beforeAll` inserts. Copy-pasting `afterAll` from another test file and forgetting to update the email is a common source of this bug.

---

### ERR-023 — `TypeError: Cannot read properties of undefined` on `res.body.console`

**Environment:** Local  
**Where:** `src/__tests__/exercise.test.ts`

**Error**
```
TypeError: Cannot read properties of undefined (reading 'error')
```

**Root Cause**  
`res.body.console.error` was used instead of `res.body.error`. `res.body` is `{ error: "..." }` — there is no `console` property on it, so `res.body.console` is `undefined`, and accessing `.error` on `undefined` throws.

**Resolution**  
Changed to `res.body.error`.

---

### ERR-024 — Receives 404 when 401 is expected

**Environment:** Local  
**Where:** `src/__tests__/exercise.test.ts` — invalid token test

**Error**
```
Expected: 401
Received: 404
```

**Root Cause**  
The route URL was `/v1/exercise` (missing `s`). That route does not exist so Express returned 404 (route not found) instead of 401 (unauthorized).

**Resolution**  
Fixed to `/v1/exercises`.

---

### ERR-025 — Assertion with `.toBeDefined` never actually runs

**Environment:** Local  
**Where:** Any test file

**Error**  
No error — test passes regardless of whether the value is defined.

**Root Cause**  
`.toBeDefined` without `()` evaluates to the function reference (always truthy as a value). The assertion is never called.

**Resolution**  
Add parentheses: `.toBeDefined()`.

---

### ERR-026 — `beforeAll` crashes after `docker compose down -v`

**Environment:** Local  
**Command:** `npx jest workout`

**Error**
```
TypeError: Cannot read properties of undefined (reading 'id')
```
at `result.rows[0].id` in `beforeAll`.

**Root Cause**  
`docker compose down -v` deletes Docker volumes. The Postgres volume holds all database data — tables, migrations, and seed data. After `docker compose up`, the database is completely empty. `SELECT id FROM exercise_difficulties LIMIT 1` returns zero rows, so `result.rows[0]` is `undefined`.

**Resolution**  
After any `docker compose down -v`, re-run migrations and seeds before running tests:
```
docker compose exec app npm run migrate
docker compose exec app npm run seed
```

**Prevention**  
Use `docker compose down` (without `-v`) when you only want to stop containers. Only use `-v` when you intentionally want to wipe all data and start fresh — and always remember to migrate and seed afterward.

---

### ERR-027 — Workout sessions not cleaned up — `afterAll` subquery uses wrong email

**Environment:** Local  
**Where:** `src/__tests__/workout.test.ts` — `afterAll`

**Error**
```
error: update or delete on table "users" violates foreign key constraint "workout_sessions_user_id_fkey"
```

**Root Cause**  
When the test email was changed from `workouts@gmail.com` to `workoutz@gmail.com` in `beforeAll`, the subquery in `afterAll` was not updated:
```typescript
// subquery still had the old email
'DELETE FROM workout_sessions WHERE user_id = (SELECT id FROM users WHERE email = $1)',
['workouts@gmail.com']  // ← wrong email, finds no user, deletes no sessions
```
The sessions remained in the DB, and the subsequent `DELETE FROM users` failed because of the FK constraint.

**Resolution**  
Updated the subquery email to match the email used in `beforeAll`.

**Prevention**  
When changing a test email, update every reference to it in `afterAll` — both the session cleanup subquery and the user DELETE must use the same email.

---

## Achievement System — Phase 10

---

### ERR-028 — `syntax error at or near "ON"` on achievement unlock

**Environment:** Local  
**Where:** `src/models/achievement.model.ts` — `unlock()`

**Error**
```
error: syntax error at or near "ON"
```

**Root Cause**  
`RETURNING` was written before `ON CONFLICT` in the `INSERT`:
```sql
INSERT INTO user_achievements (user_id, achievement_id)
VALUES ($1, $2) RETURNING user_id, achievement_id, unlocked_at
ON CONFLICT DO NOTHING
```
Postgres requires a fixed clause order — `RETURNING` must come after `ON CONFLICT`, since it describes what to hand back only once the conflict has already been resolved.

**Resolution**  
Reordered to `VALUES` → `ON CONFLICT DO NOTHING` → `RETURNING`.

**Prevention**  
Same family of bug as JOIN-before-WHERE (learning-log-part2.md, SQL section) — SQL clauses aren't free-order.

---

### ERR-029 — `GET /v1/users/me/achievements` returns 404 despite controller/routes being correct

**Environment:** Local  
**Where:** `src/app.ts`

**Error**
```
404 Cannot GET /v1/users/me/achievements
```

**Root Cause**  
`app.ts` mounted the prefix with no router:
```ts
app.use('/v1/users/me');
```
No second argument, and the achievement router was never imported. Express accepted this silently — no crash, no warning — it just registered nothing.

**Resolution**  
Imported the router and passed it as the second argument: `app.use('/v1/users/me', achievementRouter);` (matching the existing `app.use('/v1/workout_sessions', workoutRouter)` pattern).

**Prevention**  
When a route "isn't there" and nothing looks obviously broken, check `app.ts` for both pieces — the import at the top *and* the router argument in `app.use()`. Either one missing produces the identical silent symptom.

---

### ERR-030 — `afterAll` FK violation reintroduced by a new feature's side effect

**Environment:** Local  
**Where:** `src/__tests__/workout.test.ts` — `afterAll`

**Error**
```
error: update or delete on table "users" violates foreign key constraint "user_achievements_user_id_fkey" on table "user_achievements"
```

**Root Cause**  
`afterAll` only deleted `workout_sessions` then `users` — correct for Phase 9, when `POST /workout_sessions` never wrote anywhere else. Phase 10 wired achievement evaluation into `saveSession()`, so that same endpoint now also inserts into `user_achievements`. The old cleanup didn't know that table existed, so `DELETE FROM users` failed while `user_achievements` rows still referenced it.

**Resolution**  
Added `DELETE FROM user_achievements WHERE user_id = (...)` before the existing `workout_sessions` and `users` deletes.

**Prevention**  
Whenever a new feature adds a write to a table an *existing* test's cleanup doesn't know about, that older test needs revisiting — passing before doesn't guarantee still-correct after a feature changes what its own endpoints write to.

---

### ERR-031 — Suite passes file-by-file but fails randomly when run together

**Environment:** Local  
**Command:** `npx jest` (full suite) vs `npx jest workout` / `npx jest achievements` (single file)

**Error**
```
Expected: 201, Received: 401   (and similar, on whichever file "lost")
```

**Root Cause**  
`workout.test.ts` and `achievements.test.ts` both registered a test user with the identical `email`/`username` in `beforeAll`. Jest runs separate test files in separate worker processes in parallel by default. Both `beforeAll` hooks raced to `INSERT` the same email; the `UNIQUE` constraint let only one succeed. The losing file's `register` call returned `409 Conflict` instead of `{ token, user }`, so `token` was `undefined`, and every subsequent request in that file got `401`.

**Resolution**  
Gave each test file a genuinely unique test user (different `email` and `username`).

**Prevention**  
A failure that disappears when run alone but reappears when the whole suite runs together is the signature of a race condition, not a logic bug — check for shared unique test data across files first.
