# MoveVerse Backend — Learning Log

A personal record of concepts learned while building this project. Written for future reference — not documentation of what the code does, but why things work the way they do.

---

## Lesson 0 — The layered architecture (the map of the whole backend)

Every feature in this backend is built from the same four layers. A request enters at the top, travels down, and the response travels back up:

```
            Client (browser / mobile app)
                 │  HTTP request
                 ▼
routes       maps URL + method to a controller function
                 ▼
controller   handles HTTP — reads req, calls service, sends res
                 ▼
service      business logic — decisions, rules, calculations
                 ▼
model        SQL queries only — the only layer that touches the DB
                 ▼
            PostgreSQL
                 │  rows come back
                 ▼
            response travels back up: model → service → controller → res.json()
```

Each layer knows ONE thing and is ignorant of the rest:

| Layer      | Its only job                                  | Must NOT do          |
| ---------- | --------------------------------------------- | -------------------- |
| routes     | "POST /api/v1/auth/register → handleRegister" | Any logic            |
| controller | Unpack req, call service, pick status code    | SQL, business rules  |
| service    | Decisions: "is this email taken? hash this"   | SQL, touch req/res   |
| model      | Run parameterised SQL, return rows            | Logic, HTTP          |

**The request/response cycle** for one call:

1. Express receives the HTTP request, global middleware runs first (helmet, cors, json parser)
2. The route file matches the URL and method, and hands off to a controller
3. The controller pulls what it needs out of `req.body` / `req.params` and calls a service function with plain values — no `req` or `res` ever goes deeper than the controller
4. The service makes the decisions and calls model functions when it needs data
5. The model runs SQL through the shared pool and returns rows
6. The result bubbles back up; the controller turns it into a status code + JSON and calls `res.json()` — the cycle ends with exactly one response per request

**Why bother with layers?** Change isolation (swap how login works without touching SQL), testability (test business logic without HTTP or a database), and repetition (every phase from auth to leaderboard is the same four files with different nouns — learn the shape once, repeat it everywhere).

---

## Lesson 1 — What Node.js actually is

Node.js is not a language. It is a runtime — it takes JavaScript (which normally only runs in a browser) and lets it run on a server. When you run `node index.js`, Node executes that file on your machine, not in a browser.

---

## Lesson 2 — Why TypeScript over JavaScript

TypeScript adds types to JavaScript. If a function expects a number and you pass a string, TypeScript tells you before you run the code. JavaScript only tells you at runtime — often in production. TypeScript errors are caught at compile time, which is much safer.

---

## Lesson 3 — What tsc does

`tsc` is the TypeScript compiler. It reads `.ts` files and outputs `.js` files into the `dist/` folder. The server always runs the compiled JavaScript (`node dist/index.js`), never the TypeScript source directly. TypeScript is a development tool — it does not exist at runtime.

---

## Lesson 4 — tsconfig.json

Controls how TypeScript compiles your code. Key fields:

| Field             | What it does                                                           |
| ----------------- | ---------------------------------------------------------------------- |
| `target`          | Which version of JavaScript to output                                  |
| `outDir`          | Where compiled files go (`dist/`)                                      |
| `rootDir`         | Where your TypeScript source lives (`src/`)                            |
| `strict`          | Enables strict type checking — always use this                         |
| `types: ["node"]` | Makes Node.js globals available (`__dirname`, `fs`, `path`, `process`) |

**Critical:** Without `"types": ["node"]`, TypeScript does not know about Node.js built-ins and throws errors for `__dirname`, `fs`, etc.

---

## Lesson 5 — package.json scripts

Scripts are shortcuts for terminal commands. Instead of typing the full command every time, you define it once and run it with `npm run <name>`.

```json
"dev": "ts-node-dev --respawn --transpile-only src/index.ts"
```

`--respawn` restarts on crash. `--transpile-only` skips full type checking on each restart (faster for development).

---

## Lesson 6 — npm install vs npm ci

| Command       | When to use                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| `npm install` | Adding new packages locally                                                                                    |
| `npm ci`      | CI/CD and Docker — installs exact versions from `package-lock.json`, faster, fails if lock file is out of sync |

---

## Lesson 7 — What Express is

Express is a framework that sits on top of Node's built-in HTTP module and makes it easier to handle requests and responses. Without Express you would have to parse URLs, headers, and bodies manually.

---

## Lesson 8 — Middleware

Middleware are functions that run between receiving a request and sending a response. They run in the order you register them with `app.use()`.

```typescript
app.use(helmet()); // runs first
app.use(cors()); // runs second
app.use(express.json()); // runs third
// routes run after
```

If you put `express.json()` after your routes, POST request bodies will be empty because the body wasn't parsed yet.

---

## Lesson 9 — helmet and cors

- `helmet` sets security headers on every response — protects against common web vulnerabilities
- `cors` controls which domains can call your API — without it, browsers block cross-origin requests by default

Both must be registered before routes.

---

## Lesson 10 — Health check endpoint

```typescript
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
```

A simple endpoint that returns 200 with no logic. Used by deployment platforms, monitoring tools, and load balancers to check if the app is alive. First endpoint you build, first endpoint you test after every deployment.

---

## Lesson 11 — Environment variables and dotenv

Sensitive values (database credentials, API keys) are never written in source code. They live in a `.env` file which is in `.gitignore` — it never gets committed.

`dotenv` reads `.env` and loads those values into `process.env`. In `index.ts`:

```typescript
import 'dotenv/config';
```

This must be the first import — before anything that reads `process.env`.

---

## Lesson 12 — What Docker is

Docker packages your app and everything it needs (Node version, dependencies, config) into a container — an isolated environment that runs the same on any machine. "It works on my machine" stops being an excuse.

---

## Lesson 13 — Dockerfile

A set of instructions for building a Docker image. The image is the blueprint; the container is the running instance.

```dockerfile
FROM node:22-alpine    # base image
WORKDIR /app           # working directory inside the container
COPY package*.json ./  # copy package files first (layer caching)
RUN npm ci             # install dependencies
COPY . .               # copy source code
```

Copying `package*.json` before the full source code is intentional — Docker caches each step. If only source code changes, npm install is skipped on rebuild.

---

## Lesson 14 — docker-compose

Runs multiple containers together. Instead of starting a Node container and a Postgres container separately and manually connecting them, `docker-compose.yml` defines both and starts them with one command.

```
docker compose up --build    # build and start
docker compose up -d         # start in background (detached)
docker compose down          # stop and remove containers
docker compose exec app npm run migrate  # run a command inside a running container
```

---

## Lesson 15 — Service names in docker-compose

In `docker-compose.yml`, each container has a name (e.g., `app`, `db`). Containers on the same network can reach each other using those names as hostnames. That is why `DB_HOST=db` in `.env` — the app container connects to the database container by its service name.

---

## Lesson 16 — docker compose up --build vs down/up

| Command                                       | When to use                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| `docker compose up --build`                   | Source code changed — rebuilds the image                                         |
| `docker compose down && docker compose up -d` | `.env` changed — containers need to restart to pick up new environment variables |

Code changes require a rebuild. Environment variable changes only require a restart.

---

## Lesson 17 — What CI/CD means

| Term                        | Meaning                                                   |
| --------------------------- | --------------------------------------------------------- |
| CI (Continuous Integration) | Every push automatically runs checks — lint, build, tests |
| CD (Continuous Deployment)  | Every merge to main automatically deploys to production   |

The goal: you never manually deploy. Pushing to `main` IS deploying.

---

## Lesson 18 — GitHub Actions

GitHub's built-in CI/CD system. You define workflows in `.github/workflows/*.yml`. GitHub reads these files and runs them automatically when triggered.

A workflow has jobs. Each job has steps. Steps run commands.

---

## Lesson 19 — YAML syntax basics

YAML uses indentation (spaces, never tabs) to define structure. Two spaces per level is standard.

```yaml
jobs:
  lint: # job name
    runs-on: ubuntu-latest
    steps:
      - run: npm ci
      - run: npm run lint
```

---

## Lesson 20 — GitHub Actions triggers

```yaml
on:
  push: # triggers on push to any branch
  pull_request:
    branches: ['main', 'dev'] # triggers on PRs targeting these branches
```

The deploy job additionally has `if: github.ref == 'refs/heads/main'` so it only runs when code actually lands on main, not on every push.

---

## Lesson 21 — needs keyword in GitHub Actions

```yaml
deploy:
  needs: [lint, typecheck]
```

The deploy job only starts after both lint and typecheck pass. If either fails, no deploy happens. This enforces the rule: never deploy broken code.

---

## Lesson 22 — GitHub Secrets

Sensitive values like API keys cannot be written in workflow files (they are public). GitHub Secrets store them securely. You reference them in YAML as `${{ secrets.SECRET_NAME }}` — GitHub injects the real value at runtime and redacts it from logs.

---

## Lesson 23 — PostgreSQL connection pool

A pool keeps a set of database connections open and reuses them. Opening a new connection for every query is expensive — pools solve that.

```typescript
const pool = new Pool({ host, port, database, user, password });
```

You call `pool.query()` anywhere in the app. The pool manages which connection handles each query.

---

## Lesson 24 — pg library (node-postgres)

The standard Node.js library for connecting to PostgreSQL. You write raw SQL — no magic, no ORM. What you write is exactly what the database executes.

```typescript
const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
const user = result.rows[0];
```

`$1`, `$2` are parameterised placeholders. The pg library handles escaping — this is how you prevent SQL injection.

---

## Lesson 25 — SQL injection and parameterised queries

Never build SQL by string concatenation:

```typescript
// WRONG — SQL injection vulnerability
pool.query(`SELECT * FROM users WHERE email = '${email}'`);
```

An attacker can pass `' OR 1=1 --` as the email and get all users.

Always use placeholders:

```typescript
// CORRECT
pool.query('SELECT * FROM users WHERE email = $1', [email]);
```

---

## Lesson 26 — Database migrations

A migration is a versioned SQL file that modifies the database schema. Instead of manually running SQL in a database client, migrations are tracked in code and run in order.

```
001_create_users.sql
002_create_exercises.sql
```

The zero-padded number ensures correct order. The migration runner reads and executes them alphabetically.

---

## Lesson 27 — CREATE TABLE IF NOT EXISTS

```sql
CREATE TABLE IF NOT EXISTS users (...);
```

This makes the migration safe to re-run. If the table already exists, the statement is skipped. Without `IF NOT EXISTS`, re-running the migration would crash with "table already exists."

---

## Lesson 28 — Foreign keys and seed order

A foreign key means one table references another. You must insert into the parent table before the child table.

```
exercises → exercise_difficulties (exercise_id is a foreign key)
```

If you try to insert an exercise difficulty before the exercise exists, the database rejects it.

---

## Lesson 29 — process.exit(0) vs process.exit(1)

Unix convention for exit codes:

- `process.exit(0)` — success, everything went fine
- `process.exit(1)` — failure, something went wrong

Scripts that call other scripts (like the Procfile `release:` command) read the exit code to know whether to continue or stop the deployment.

---

## Lesson 30 — fs and path modules

Node.js built-in modules for working with the filesystem and file paths.

```typescript
import fs from 'fs';
import path from 'path';

const folder = path.join(process.cwd(), 'src', 'db', 'migrations');
const files = fs.readdirSync(folder);
```

`path.join()` builds a file path correctly on any OS (handles `/` vs `\` differences). `fs.readdirSync()` reads all files in a folder.

---

## Lesson 31 — \_\_dirname vs process.cwd()

|                 | Points to                                                   |
| --------------- | ----------------------------------------------------------- |
| `__dirname`     | The directory of the current file                           |
| `process.cwd()` | The directory where the command was run from (project root) |

When TypeScript compiles to `dist/db/migrate.js`, `__dirname` points to `dist/db/`. SQL migration files live in `src/db/migrations/` — not in dist. Use `process.cwd()` to always start from the project root, where `src/` is always reachable.

---

## Lesson 32 — ts-node vs node (compiled JS)

| Command                     | How it runs                                                  |
| --------------------------- | ------------------------------------------------------------ |
| `ts-node src/db/migrate.ts` | Runs TypeScript directly, no compilation step                |
| `node dist/db/migrate.js`   | Runs compiled JavaScript — TypeScript must be compiled first |

Heroku prunes devDependencies after building. `ts-node` is a devDependency — it no longer exists in the Heroku slug when the release phase runs. That is why `migrate:prod` and `seed:prod` use `node` on compiled JS, not `ts-node`.

---

## Lesson 33 — What seeding is

Seeding is inserting initial reference data into the database — data the app needs to function but that doesn't come from users. Examples: exercise definitions, difficulty levels, achievements, admin user.

Regular user data is NOT seeded — it is created at runtime when users register.

---

## Lesson 34 — ON CONFLICT DO NOTHING (idempotent inserts)

```sql
INSERT INTO exercises (name) VALUES ('Squat')
ON CONFLICT (name) DO NOTHING;
```

If a row with that name already exists, the insert is silently skipped instead of crashing. This makes the seed script safe to run multiple times without creating duplicate data.

---

## Lesson 35 — ON CONFLICT with composite constraints

```sql
ON CONFLICT (exercise_id, level_name) DO NOTHING
```

The conflict check uses AND logic — both columns must match for the row to be skipped. If `exercise_id` matches but `level_name` is different, it is a new row and gets inserted.

---

## Lesson 36 — Fetching a parent ID before inserting a child

When inserting into a table with a foreign key, you need the parent row's ID first:

```typescript
const result = await pool.query(`SELECT id FROM exercises WHERE name = $1`, ['Squat']);
const squatId = result.rows[0].id;

await pool.query(
  `INSERT INTO exercise_difficulties (exercise_id, level_name, ...) VALUES ($1, $2, ...)`,
  [squatId, 'Easy', ...]
);
```

---

## Lesson 37 — tsconfig "types": ["node"]

TypeScript does not automatically know about Node.js globals. Without `"types": ["node"]` in `tsconfig.json`, using `__dirname`, `fs`, `path`, or `process` throws TypeScript errors even though they exist at runtime.

This must be added from the start on any Node.js TypeScript project.

---

## Lesson 38 — TypeScript fundamentals (Promise, async, void)

**`async`** — marks a function as asynchronous. Required before you can use `await` inside it.

**`await`** — pauses execution until a Promise resolves. Without it, you get a Promise object, not the result.

**`Promise<void>`** — the return type of an async function that completes successfully but returns no value. Like `void` in non-async functions but wrapped for async.

```typescript
const doSomething = async (): Promise<void> => {
  await pool.query('...');
}; // ← semicolon here because this is a variable assignment, not a function declaration
```

---

## Lesson 39 — Idempotency

An operation is idempotent if running it multiple times produces the same result as running it once. Migrations use `IF NOT EXISTS`. Seed inserts use `ON CONFLICT DO NOTHING`. Both are idempotent — safe to re-run without side effects.

---

## Lesson 40 — bcryptjs (password hashing)

Passwords are never stored in plain text. bcrypt hashes them one-way — you cannot reverse a hash back to the original password.

```typescript
const hash = await bcrypt.hash(password, 10); // store this
const match = await bcrypt.compare(input, hash); // true or false at login
```

Salt rounds = 10 is the industry standard (~100ms to compute, slow enough to resist brute force).

---

## Lesson 41 — Live queries vs pre-aggregated stats

For MVP scale, calculate stats on demand with COUNT queries rather than maintaining pre-aggregated counters.

- Achievement checking runs a COUNT after every workout session save
- Leaderboard runs a query only when a user visits the page

Pre-aggregation adds complexity (triggers, jobs, denormalised data). Live queries are simpler and fast enough at small scale.

---

## Lesson 42 — Heroku dynos and add-ons

Heroku separates your app (a **dyno** — a managed Linux container) from your database (a **Heroku Postgres add-on** — a managed PostgreSQL server). You do not configure the OS or install Postgres. You add the service in the dashboard and Heroku provisions it.

Config Vars are Heroku's equivalent of `.env` — environment variables set in the dashboard, injected into the app at runtime.

---

## Lesson 43 — Heroku release phase

In the Procfile:

```
release: npm run migrate:prod
web: npm start
```

`release:` runs automatically before the app starts on every deployment. This is where migrations go — tables are always up to date before the app accepts traffic. If the release command fails, the new version is not deployed.

---

## Lesson 44 — SSL required for Heroku Postgres

Heroku Postgres only accepts SSL connections. Connecting without SSL results in:

```
no pg_hba.conf entry for host "...", no encryption
```

Fix in `db.ts`:

```typescript
ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
```

The conditional is important — local Docker Postgres does not use SSL. `rejectUnauthorized: false` is needed because Heroku uses a self-signed certificate that Node would otherwise reject.

---

## Lesson 45 — Why akhileshns/heroku-deploy broke

Third-party GitHub Actions can go unmaintained. `akhileshns/heroku-deploy` fails to install the Heroku CLI on modern GitHub Actions runners. Lesson: prefer solutions with fewer moving parts. A direct `git push` to Heroku's remote using `.netrc` for authentication has no third-party dependencies and will not break when someone stops maintaining a package.

---

## Lesson 46 — .netrc for git authentication

`.netrc` is a standard Unix credential file that git reads automatically when authenticating over HTTPS. Writing credentials there before a `git push` is equivalent to passing a username and password in the URL, but cleaner.

```bash
cat > ~/.netrc <<EOF
machine git.heroku.com
  login $HEROKU_EMAIL
  password $HEROKU_API_KEY
EOF
git push heroku main
```

---

## Lesson 47 — git cherry-pick

Cherry-pick copies a single commit from one branch and applies it to another — without bringing across any other commits from that branch.

```
git cherry-pick dev     # applies the latest commit from dev onto current branch
```

Useful for hotfixes: fix on the correct branch, cherry-pick to wherever else it is needed.

---

## Lesson 48 — .gitignore — what it does

Files and folders listed in `.gitignore` are completely invisible to git. They are not tracked, staged, or committed. This is correct for secrets (`.env`), build output (`dist/`), and large installed packages (`node_modules/`).

Documentation, however, should always be committed — it is part of the project. Never put `docs/` in `.gitignore`.

---

## Lesson 49 — Empty commit to retrigger deployment

GitHub Actions only fires on a new push. If you need to retrigger a deployment without making a real code change (e.g. after fixing a Config Var in Heroku), use an empty commit:

```
git commit --allow-empty -m "chore: retrigger deployment"
git push origin main
```

`--allow-empty` allows a commit with no staged changes. The push triggers the workflow as normal.

---

## Lesson 50 — SASL error: DB password must be a string

If a pg Pool config receives `undefined` for any field (because a Config Var was not set in Heroku), the connection fails with a cryptic SASL error rather than a clear "missing variable" message.

```
SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string
```

This always means an environment variable is missing or empty. Check all five DB Config Vars in the Heroku dashboard: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`.

---

## Lesson 51 — What auth is really for: "who is asking?"

Phase 7a is not really about register and login. It is about giving the API the ability to answer one question on every request: **who is asking?** Almost every later feature depends on it — workouts are saved for *the current user*, achievements unlock for *the current user*, "my profile" needs to know who "my" is. Auth is built first because everything else stands on it.

Critically, the user's identity comes from the verified token — never from the request body. If the client could just send `user_id` in the body, anyone could submit workouts as anyone else.

---

## Lesson 52 — HTTP is stateless

Every HTTP request arrives at the server as a total stranger. The server does not remember that this person logged in two minutes ago — and the Heroku dyno could restart between two requests, wiping any in-memory state.

So a client must prove who it is on **every request**. Two classic solutions:

| Approach | How it works                                                                  |
| -------- | ----------------------------------------------------------------------------- |
| Sessions | Server stores "token abc123 = user 42" in a table, looks it up on every request |
| JWT      | Server hands the client a **signed note** at login; the note itself says who the user is |

MoveVerse uses JWTs — no session storage or lookup needed, which suits a stateless deployment. The trade-off: a JWT cannot easily be revoked before it expires, which is why tokens get expiry times.

---

## Lesson 53 — What a JWT actually is

A JWT is a signed note with three parts: `header.payload.signature`.

- **Payload** — carries the user's id. It is only base64-encoded, NOT encrypted — anyone can read it, so never put secrets in it.
- **Signature** — created with the server's `JWT_SECRET`. If anyone edits the payload to claim a different user id, the signature stops matching and verification fails.
- **The secret never leaves the server** — `.env` locally, Config Var on Heroku. The secret is the only thing that makes the scheme trustworthy.

So the server doesn't need to *remember* issuing the token. It just checks the signature: "did I sign this, and is it untampered?"

---

## Lesson 54 — The three capabilities of Phase 7a

1. **Register** — turn a stranger into a stored user. Never store the password; store the bcrypt hash (one-way fingerprint). Even a leaked database gives attackers no passwords.
2. **Login** — a returning user proves who they are. Find the stored hash, `bcrypt.compare()` the input against it. Nothing is ever decrypted — hashes can't be reversed, only re-computed and compared. Success → sign and return a JWT.
3. **The gate (`requireAuth` middleware)** — the real product of the phase. Runs before any protected route: read `Authorization: Bearer <token>`, verify the signature, attach the user to `req.user`, call `next()`. Written once, then every protected route in phases 8–12 just bolts it on.

---

## Lesson 55 — Why we build bottom-up (model first)

Build order: model → service → controller → routes → middleware. Each layer **calls** the one below it. Writing the controller first means calling service functions that don't exist yet — coding against imaginary code. Bottom-up means at every step, the thing you depend on already exists and works. The middleware comes last because it can't verify tokens until login can issue them.

---

## Lesson 56 — Login errors should not leak which field was wrong

Wrong email and wrong password must return the **same** error ("Invalid credentials", 401). If "email not found" and "wrong password" are different messages, an attacker can probe which emails are registered (user enumeration). The service knows the difference; the response must not show it.

---

## Lesson 57 — File naming: user.model.ts (the `<noun>.<layer>.ts` convention)

The pattern is `<noun>.<layer>.ts` — the **what** first, the **which layer** second. The dot has zero technical meaning to Node or TypeScript; only the final `.ts` matters to the compiler. It is purely a readability convention.

Why the suffix exists: the same noun lives at several layers (`user.model.ts`, `user.service.ts`, `user.controller.ts`, `user.routes.ts`). Without the suffix they would all be `user.ts` in different folders — identical in editor tabs, fuzzy-find, and stack traces, where the folder name disappears.

Styles seen in real codebases:

| Style           | Where it comes from                                              |
| --------------- | ---------------------------------------------------------------- |
| `user.model.ts` | Angular style guide, NestJS — the TypeScript ecosystem default   |
| `user_model.ts` | Developers from Python/Ruby, where snake_case filenames are norm |
| `userModel.ts`  | Older Node/JavaScript projects                                   |
| `models/user.ts`| Folder carries the role — common in Go, minimalist codebases     |

The rule that actually matters: **consistency beats preference**. One pattern across the whole codebase looks professional; a mix signals nobody is steering. The choice is made once (this project chose dot style in Phase 1) and never debated again.

Naming nuance: the file is `user.model.ts` (singular — it represents the concept of *a user*) while the table is `users` (plural — SQL convention, a table holds many rows). And the service is `auth.service.ts`, not `user.service.ts`, because register/login are auth *operations* performed on user *data* — Phase 11 adds a separate `user.service.ts` for profile operations, and both call the same `user.model.ts`.

---

## Lesson 58 — Generics (`<>`) and the Omit utility type

Angle brackets are **type parameters** — like function arguments, but for types, evaluated at compile time:

```typescript
Promise<void>          // a Promise that resolves to nothing
pool.query<User>(...)  // a query whose rows have the shape User
Omit<User, 'password_hash'>  // built-in "type function": User minus one property
```

`Omit<User, 'password_hash'>` produces a copy of the `User` type with that property deleted:

```typescript
type SafeUser = Omit<User, 'password_hash'>;
// identical to rewriting the whole interface by hand without password_hash
```

Why `Omit` instead of writing the second interface manually: **one source of truth**. Add a column to `User` and `SafeUser` updates itself; a hand-written copy silently drifts out of sync.

Why a SafeUser type at all: `password_hash` must never appear in an HTTP response. Types don't exist at runtime — the SQL column list is what actually excludes the hash. But declaring `findById(): Promise<SafeUser | null>` puts the **compiler** on guard: any future code that tries to pass the hash through that path becomes a compile error. The type is the guard rail; the SQL is the gate.

**The correct vocabulary (interview-ready):**

| Concept | Correct term |
| --- | --- |
| `Omit`, `Pick`, `Partial`, `Required` — prebuilt, no import needed | built-in **utility types** |
| The `<>` brackets | **generics** |
| What goes inside the `<>` | **type arguments** |
| One named part of a type's shape (e.g. `email`) | a **property** (or **key**) |
| Creating `SafeUser` from `User` | **deriving** a type |

Interview sentence: "`Omit` is a built-in utility type. It's generic — it takes two type arguments: the type to start from and the keys to remove. I used it to derive `SafeUser` from `User` without the `password_hash` property, so the compiler prevents the hash leaking into API responses."

⚠️ Do not confuse **`Omit`** (TypeScript utility type) with **OAuth** (the authorization protocol behind "Sign in with Google", Phase 7b) — completely unrelated despite sounding similar.

---

## Lesson 59 — Why createUser() returns the row (Promise&lt;SafeUser&gt; vs Promise&lt;void&gt;)

The return type of a function follows from one question: **who calls this, and what do they need next?**

`Promise<void>` fits fire-and-forget scripts (`connectDB()`, `runMigrations()`, seeding) — the caller only needs "it finished without throwing."

`createUser()` must return the new row because the caller (`register()` in the service) needs it to finish its own job — and the most important values are **born inside the database** at insert time:

```
id          UUID DEFAULT gen_random_uuid()   ← Postgres invents this
role        DEFAULT 'user'                   ← Postgres fills this
created_at  DEFAULT NOW()                    ← Postgres stamps this
```

The service sent in username/email/hash, but it cannot sign a JWT without the new `id` — which didn't exist until the INSERT ran. Returning `void` would force a second query (`findByEmail` right after inserting) just to learn what the database already knew. `INSERT ... RETURNING` hands the created row back in the same round trip.

| Function | Caller needs | Return type |
| --- | --- | --- |
| `runMigrations()` | just "did it work?" | `Promise<void>` |
| `createUser()` | generated `id`, `role`, `created_at` | `Promise<SafeUser>` |
| `findByEmail()` | the row, or "not found" | `Promise<User \| null>` |

`void` is not the default for async functions — it is the special case for when there is genuinely nothing to give back.

---

## Lesson 60 — RETURNING and the shape of result.rows

`RETURNING` bolts onto the end of an `INSERT` (also works on `UPDATE` and `DELETE`): "after the write, give me back the affected rows, with these columns." Without it, an INSERT reports only a row count. It is a **PostgreSQL feature**, not universal SQL — MySQL doesn't have it.

The `pg` library always returns the same shape: `result.rows` is an **array of row objects**, regardless of the query. The difference is how many elements can be in it:

| Query | rows on success | rows[0] |
| --- | --- | --- |
| `INSERT ... RETURNING` (one row) | exactly one element | always safe to use directly |
| `SELECT ... WHERE email = $1` | one element **or empty** | may be `undefined` → use `rows[0] ?? null` |

A failed INSERT (e.g. duplicate email hitting a UNIQUE constraint) does not produce zero rows — it **throws**. That is why `createUser()` can return `rows[0]` directly while the find functions need the `?? null` guard.

---

## Lesson 61 — Where to handle errors: the layer that can do something meaningful

**Principle: catch an error at the layer that has the context to act on it.** A try/catch that just re-throws (or worse, swallows the error and returns null) is noise — or a bug.

For a duplicate email at registration, each layer translates the error into its own language:

```
model:       no try/catch — let the Postgres error bubble up untouched
service:     error.code === '23505' (unique_violation) + "I'm in a register flow"
             → throws a clean business error: "Email already registered"
controller:  catches the business error → picks the HTTP status: 409 Conflict
```

The model can't act meaningfully (it doesn't know HTTP, or whether a duplicate even matters to the caller). The service is the first layer with **context** — it knows what a unique violation *means* in this operation.

Practical notes:

- Check `error.code === '23505'`, not the message text — Postgres error codes are stable across versions; messages are not.
- A pre-check (`findByEmail()` before inserting) gives friendlier UX but does **not** replace handling 23505 — two registrations can race between check and insert. The DB unique constraint is the real guarantee; the pre-check is politeness.
- Unanticipated errors (DB down) are caught by nobody in particular — they bubble to the global error handler (Phase 13), which logs and returns a generic 500. That safety net is why you don't write try/catch everywhere "just in case."

---

## Lesson 62 — VARCHAR vs TEXT in PostgreSQL

In Postgres they are stored **identically** — same performance, same memory. The only difference: `VARCHAR(n)` adds a **length constraint** (inserting longer data is rejected with an error). `TEXT` accepts any length.

So the design question is never "which is faster?" but **"does a max length make business sense for this data?"**

| Column | Type | Why |
| --- | --- | --- |
| `username` | `VARCHAR(50)` | Displayed in UIs/leaderboards — a limit is a business rule |
| `email` | `VARCHAR(255)` | Emails have a real max (254 per spec); 255 is traditional |
| `password_hash` | `TEXT` | bcrypt controls the length, not us — a future algorithm change must not break storage |
| `google_id` | `TEXT` | Google controls the format — never limit data whose format belongs to someone else |

⚠️ Postgres-specific: in MySQL, VARCHAR and TEXT genuinely differ in storage and indexing. Interview phrasing: "In Postgres they perform identically — VARCHAR just adds a length check, so I use VARCHAR(n) where a limit is a business rule and TEXT where I don't control the format."

---

## Lesson 63 — How to know which model functions to create

You don't invent model functions — you **discover** them by walking each user story down the layers. Start from the feature, and each layer demands things from the layer below; model functions are whatever falls out.

Phase 7a walked this way:

```
"A user registers"  → register() needs:  store the user → createUser()
                      (duplicate email/username? no lookup needed — the UNIQUE
                       constraint checks it during the INSERT, see Lesson 65)
"A user logs in"    → login() needs:     fetch stored hash by email → findByEmail()
"Protected route"   → middleware needs:  load user by JWT id → findById()
```

Three stories → exactly three functions. The flows demand precisely those, nothing else. Note: `findByEmail()` belongs to the **login** story, not register — register's duplicate check is done by the database constraint, not by a query.

The discipline half is **YAGNI** ("You Aren't Gonna Need It"): don't scaffold full CRUD (`getAllUsers`, `deleteUser`...) because no current story asks for it — that's untested dead code. The model file grows when new stories arrive: Phase 11's profile stories are what add `updateUsername()` and `getStatsByUser()`.

Name functions after the intent found during the walk — "look up a user by email" → `findByEmail()`, not a generic `getUser(field, value)`. Specific names keep functions simple and their SQL obvious.

---

## Lesson 64 — Two UNIQUE columns: telling apart which one was violated

`users` has two UNIQUE constraints, for different business reasons:

- `email` — the **login identity**: duplicates would make `findByEmail()` ambiguous; login couldn't work
- `username` — the **public identity**: shown on leaderboards/profiles; duplicates would allow impersonation

Violating either throws the same Postgres code `23505`. To tell them apart, the error object carries a `constraint` property with the violated constraint's auto-generated name (`users_email_key`, `users_username_key`). The service checks that name → "Email already registered" vs "Username already taken."

Error specificity is opposite between the two auth flows, on purpose:

| Flow | Error style | Why |
| --- | --- | --- |
| Register | **Specific** ("username taken") | The visitor must know what to change; reveals nothing an attacker couldn't learn by trying to register |
| Login | **Vague** ("invalid credentials") | Specific errors enable user enumeration (Lesson 56) |

---

## Lesson 65 — The INSERT is the check: why no findByUsername() pre-check

Two ways to detect a duplicate at registration:

- **Design A — ask first:** `SELECT` to see if the username exists, then `INSERT` if not
- **Design B — just try:** `INSERT` directly; if it's a duplicate, Postgres throws

The key insight: a `UNIQUE` constraint means **Postgres already checks for duplicates on every insert, automatically**. Design A asks the same question twice — and worse, its answer can go stale: two simultaneous registrations for "kath" can *both* pass the pre-check (neither row exists yet), then both insert. That gap is a **race condition**. The constraint never has the gap, because the database serialises the inserts — the second one is refused.

Cinema-seat analogy: phoning to ask "is seat 12 free?" reserves nothing — someone can take it before you book. Just clicking "book" lets the booking system itself be the check.

How the visitor still finds out (the error path):

```
Model:      INSERT → Postgres throws { code: '23505', constraint: 'users_username_key' }
Service:    catch → translate to "Username already taken"
Controller: catch → 409 + JSON error
Visitor:    sees the message, picks another name
```

Same user experience as a pre-check — minus one query and one race condition.

Why `findByEmail()` still exists: **not for duplicate-checking** — login (US-02) needs it to fetch the stored hash for `bcrypt.compare()`. No story needs `findByUsername()`, so it isn't written (YAGNI, Lesson 63).

---

## Lesson 66 — Positional parameters vs an input object (DTO)

```typescript
// Style A — positional
createUser(username: string, email: string, passwordHash: string)

// Style B — object parameter typed by an interface
interface CreateUserInput { username: string; email: string; passwordHash: string; }
createUser(input: CreateUserInput)
```

The danger with Style A here: **all three params are `string`**, so swapping arguments at the call site — `createUser(email, username, hash)` — compiles without error and creates corrupt data. That is a *positional argument bug*. Style B makes it impossible: every value is labeled at the call site, and misnamed keys are compile errors.

Production rule of thumb: **1–2 params of different types → positional is fine. 3+ params, or two adjacent params of the same type → use an object.** Objects also stay readable as functions grow (Phase 9's `createSession()` will take several values).

Interview term: an interface describing data passed between layers (`CreateUserInput`) is a **DTO — Data Transfer Object**. "I used a DTO-style input object to avoid positional argument bugs since all fields were strings."

---

## Lesson 67 — Reading a parameter: name vs type annotation

Every parameter is `name: Type` — the name is invented by you, the type must exist:

```typescript
(username: string)            // name "username", type string
(input: CreateUserInput)      // name "input", type CreateUserInput — same pattern
```

`input` is not a keyword — it could be `data`, `params`, anything. A type can never stand alone in a parameter list (`createUser(CreateUserInput)` won't compile): types are erased at runtime (Lesson 3), so an actual variable name must hold the value.

Common variant — **destructuring** the object directly in the parameter list:

```typescript
const createUser = async ({ username, email, passwordHash }: CreateUserInput) => ...
```

One object argument, properties immediately unpacked as local variables (`username` instead of `input.username`). Callers pass the same single object either way — destructuring only changes life *inside* the function.

---

## Lesson 68 — Where types live: co-location vs a types/ folder

**Co-location principle: put things next to the code that owns them; promote to a shared place only when multiple owners genuinely need them.**

`User`, `SafeUser`, `CreateUserInput` → live in `user.model.ts` and are exported from it. The model is the **source of truth** for row shapes (it mirrors the table), and keeping interface + SQL in one file means a column change edits both in the same view — a separate types folder lets them silently drift. A central `types/index.ts` with hundreds of unrelated types is the same mistake as one giant `utils.ts`.

When `src/types/` IS right:

1. **Truly global shapes** owned by no layer (e.g. a standard `ApiError` used by all controllers + the global error handler)
2. **Augmenting someone else's types** — e.g. `src/types/express.d.ts`, a declaration file extending Express's `Request` so `req.user` exists. Global by nature; cannot live in a model. (Needed in Phase 7a for the auth middleware.)

Rule of thumb: co-locate by default; moving a type later is cheap (editors update all imports). When in doubt, keep it local.

---

## Lesson 69 — How to verify a model layer without anyone reviewing it

The verification ladder, quickest to production-grade:

1. **Compiler + linter** (`npx tsc --noEmit`, `npm run lint`) — proves the TypeScript is coherent, NOT that queries work. TypeScript trusts your SQL (Lesson 58). "It compiles" ≠ "it works."
2. **Scratch script** — a temporary `src/db/scratch.ts` (same standalone pattern as seed/migrate): import the model functions, call each one against the **local Docker DB**, `console.log` results, compare against expectations **written down beforehand**. Delete the script after.
3. **psql — the ground truth** — `docker compose exec db psql ...` then `SELECT` to independently confirm what was actually stored (right columns? role defaulted? hash present?). Code can lie about what it did; the database cannot.
4. **Automated tests** (Jest/Vitest, CI Level 3) — the scratch checklist written as permanent tests, re-run on every push forever. Level 2 verifies today's code; Level 4 keeps verifying it when you're not watching.

The scratch checklist for user.model.ts — note half are **unhappy paths** (beginners only test success):

- created row has DB-generated `id`, default `role`, timestamps
- `createUser` / `findById` results contain **no** `password_hash`
- `findByEmail` result **does** contain it
- unknown email/id → `null` (not undefined, no crash)
- duplicate username/email → throws with `code === '23505'`

---

## Lesson 70 — npx: running a tool without a package.json script

Installed packages put their executables in `node_modules/.bin/` — which is not on the PATH, so typing `ts-node` alone fails. `package.json` scripts work because npm adds that folder to the PATH while running them. **`npx` does the same for one-off commands**: it looks in `node_modules/.bin/` first and runs the tool from there.

```
npx ts-node src/db/scratch.ts
```

Perfect for temporary invocations that don't deserve a permanent script entry.

Gotcha in a Docker setup: `DB_HOST=db` only resolves **inside the Docker network** (Lesson 15). Run ad-hoc DB scripts inside the app container, like migrations:

```
docker compose exec app npx ts-node src/db/scratch.ts
```

Bonus: inside the container, docker-compose has already injected the env vars — no dotenv needed.

---

## Lesson 71 — The life of a JWT

A JWT is just a **string**: three base64 chunks joined by dots — `header.payload.signature`. Base64 is encoding, not encryption — anyone can read the header and payload (try jwt.io). Only the signature is unforgeable.

**Birth** — at login/register: `jwt.sign({ userId }, secret, { expiresIn: '7d' })`
1. header JSON (`{"alg":"HS256"}`) → base64
2. payload + auto-added `exp` timestamp → base64
3. `header.payload` + the **secret** → HMAC-SHA256 → signature
4. join with dots, return the string

**Travel** — returned as `{ token, user }`; the frontend stores it (where = frontend's concern).

**Working life** — frontend sends `Authorization: Bearer <token>` on every protected request. `jwt.verify(token, secret)` re-computes the signature from the incoming header+payload using the server's secret and compares:
- match → "I signed this, nothing was altered" → trust the userId inside
- payload tampered → recomputed signature ≠ attached signature → 401
- attacker can't forge a matching signature **without the secret** — which never leaves the server. That's the entire security model.

No DB lookup, no session table — the token proves itself (stateless). The middleware's `findById()` is to fetch *fresh user data*, not to validate the token.

**Death** — `jwt.verify` checks `exp`; past it → 401 → log in again. Expiry is the only death (no early revocation — Lesson 52's trade-off), which is why tokens are born with a lifespan.

Nuance: the browser only **carries** the token — the server does all verifying (the browser doesn't have the secret). Client holds, server checks.

---

## Lesson 72 — The jsonwebtoken methods used in this project

```typescript
import jwt from 'jsonwebtoken';
```

**`jwt.sign(payload, secret, options)` → string** — creates a token. Used in `generateJWT()` (service).

```typescript
const token = jwt.sign(
  { userId: user.id },          // payload — readable by anyone, keep minimal
  process.env.JWT_SECRET,       // secret — the trust anchor
  { expiresIn: '7d' }           // options — adds the exp claim ('7d', '1h', 60 = seconds)
);
// → "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJhYmMt..."
```

**`jwt.verify(token, secret)` → payload (or throws)** — checks signature + expiry. Used in `requireAuth()` (middleware). This is the only method that proves a token is genuine.

```typescript
try {
  const payload = jwt.verify(token, process.env.JWT_SECRET) as { userId: string };
  // valid → payload.userId is trustworthy
} catch (error) {
  // invalid → ALWAYS respond 401. Two failure types if needed:
  // error instanceof jwt.TokenExpiredError  → token is real but expired
  // error instanceof jwt.JsonWebTokenError  → malformed/tampered/wrong secret
}
```

Note: `verify` **throws** on failure (unlike the model's `null` convention) — so it always sits inside try/catch.

**`jwt.decode(token)` → payload** — reads the payload **WITHOUT checking the signature**. ⚠️ Never use for auth — it trusts anything, including forged tokens. Only legitimate use: debugging/inspecting a token's contents (same as pasting it into jwt.io). If you ever see `decode` in an auth middleware in a code review, that is a critical security bug.

| Method | Checks signature? | On failure | Used in |
| --- | --- | --- | --- |
| `sign` | creates it | throws (bad inputs) | auth.service → generateJWT() |
| `verify` | ✅ yes | **throws** | auth.middleware → requireAuth() |
| `decode` | ❌ NO | returns null | debugging only — never auth |

---

## Lesson 73 — The Node version lives in three places — keep them in sync

Upgrading Node (e.g. 22 → 24) is not one edit. The version is pinned independently in:

| Where | Controls |
| --- | --- |
| `Dockerfile` — `FROM node:24-alpine` | local Docker development |
| `package.json` — `engines` field | what Heroku installs in production |
| `.github/workflows/ci.yml` — `node-version` | what CI lints/builds/tests on |

If they drift, CI tests on a different version than production runs — the recipe for "works in CI, breaks in prod" bugs. Update all three in the same commit.

Applying the change locally: a `FROM` line change requires `docker compose up --build` (Lesson 16) and invalidates the **entire layer cache** (every step builds on the base image, Lesson 13) — the rebuild pulls the new image and re-runs `npm ci` from scratch. Slow once; normal. Then verify instead of assuming: `docker compose exec app node --version`.

---

## Lesson 74 — AppError vs plain Error: two families, two audiences

| | Operational (business) errors | Programmer/config errors |
| --- | --- | --- |
| Examples | "Email already registered", "Invalid credentials" | `JWT_SECRET is not set`, null bug |
| Caused by | the user — and the user can fix it | the developer/ops — only they can fix it |
| Status code | meaningful (409, 401) | only ever 500 |
| Throw | `AppError(message, statusCode)` | plain `Error` |
| Message audience | **the end user** (goes into the JSON response) | **the developer** (goes into server logs) |

The mechanism: the controller treats `instanceof AppError` as "**this message is safe to show the user**" and sends it. Plain Errors fall through to the generic path — client sees "Something went wrong", the real message lands in the logs.

Mixing them is harmful: `new AppError('JWT_SECRET is not set', 500)` would leak server internals into HTTP responses — reconnaissance for attackers. The class you throw is a statement about **who the message is addressed to**.

Interview terms: **operational errors** (expected, handled, user-facing) vs **programmer errors** (bugs/misconfig, generic response, logged).

---

## Lesson 75 — process.env is always `string | undefined` (and what belongs in env vars)

TypeScript cannot read `.env` at compile time, so **every** `process.env.X` is typed `string | undefined`. APIs that want a specific type reject it — e.g. jsonwebtoken's `expiresIn` accepts `number | StringValue` (a template-literal type matching `'7d'`, `'1h'`...), so `string | undefined` fails twice: the `undefined` and the "any old string".

Ways to narrow:
- a runtime check: `if (!secret) throw ...` → type becomes `string` below the check
- fallback + assertion: `(process.env.JWT_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn']` — `as` is a **type assertion**: "compiler, trust me." Every `as` transfers responsibility from the type system to you; use sparingly.

The better question first: **should this be an env var at all?** Env vars are for secrets (`JWT_SECRET`) and per-environment differences (`DB_HOST`). `'7d'` is neither — it's a design decision, identical everywhere. Constants belong in code: type-checked, reviewed, and impossible to break with a missing config var on deploy day (Lesson 50's bug genre). YAGNI applies to configuration too:

```typescript
return jwt.sign({ userId }, secret, { expiresIn: '7d' });
```

---

## Lesson 76 — Same shape ≠ same type: DRY applies to meaning, not shape

`RegisterInput` (service) and `CreateUserInput` (model) share two of three fields — tempting to merge. Don't. The differing field is a different **thing**, not a different name:

```typescript
interface RegisterInput   { ...; password: string; }      // plain text — radioactive
interface CreateUserInput { ...; passwordHash: string; }  // safe residue after bcrypt
```

The boundary between them is the `bcrypt.hash()` line inside `register()` — the two types document where the plain password dies. A shared interface would make "forgot to hash, passed it straight through" look natural; separate types make it at least a visible lie (`passwordHash: input.password`) and keep layers free to evolve apart (RegisterInput gains validation; CreateUserInput gains `googleId` in 7b).

Term: merging types that merely *look* alike is removing **incidental duplication** — a classic over-DRY mistake. Keep a type per meaning, named for its meaning (`CreateUserInput`, not a generic `UserInput`).

---

## Lesson 77 — How to discover an unknown error's shape (no AI needed)

Three research routes, most practical first:

1. **Trigger it and print it.** Cause the error on purpose in a scratch script and `console.log(e)` — the whole object. The pg error prints `severity`, `code`, `detail`, `table`, `constraint`... The error object is its own documentation. This is how most developers actually learn error shapes.
2. **Read the library's types.** The `pg` driver wraps Postgres errors in a `DatabaseError` class (visible in `node_modules/pg-protocol/dist/messages.d.ts` — F12 / Go to Definition works on dependencies too). Because it's exported, the cast can be replaced with a proper runtime check:

```typescript
import { DatabaseError } from 'pg';

if (error instanceof DatabaseError && error.code === '23505') {
  if (error.constraint === 'users_email_key') { ... }
}
```

`instanceof` narrows `unknown` safely — no `as` cast needed (better than the EXAMPLES file version).

3. **The official reference for the values.** PostgreSQL manual, appendix "PostgreSQL Error Codes": `23505 unique_violation`, `23503 foreign_key_violation` (coming in Phase 9), `23502 not_null_violation` — all in Class 23, Integrity Constraint Violation.

Why `catch (error: unknown)`: JavaScript can `throw` anything (even a string), so TypeScript types every catch variable `unknown`, forcing a narrowing check before property access. `instanceof` is the narrowing tool of choice.

---

## Lesson 78 — Rest operator in destructuring: collecting what remains

```typescript
const { password_hash, ...safeMember } = member;
```

Read as: "pull `password_hash` into its own variable — collect **everything else** into a new object called `safeMember`." The name after `...` is invented by you.

```
member         → { id, username, email, password_hash, google_id, role, created_at }
password_hash  → '$2b$10$...'          // extracted, used for nothing, discarded
safeMember     → { id, username, email, google_id, role, created_at }  // hash gone
```

This is the **runtime** equivalent of `SafeUser = Omit<User, 'password_hash'>` (Lesson 58) — the hash is never copied across, not just hidden by a type. Used in `login()` because `findByEmail()` must return the hash (bcrypt.compare needs it), but the hash must not leave the service after that check.

Same `...` syntax, two directions:
- **rest** — collects what remains after destructuring: `const { a, ...rest } = obj`
- **spread** — expands into something: `const newObj = { ...obj, extraKey: value }`

---

## Lesson 79 — Shorthand vs explicit object properties: key name matters

```typescript
const safeUser = { ... };

return { token, safeUser };        // shorthand → { token: token, safeUser: safeUser }
return { token, user: safeUser };  // explicit  → { token: token, user: safeUser }
```

Shorthand `{ x }` locks the key name to the variable name. When the variable name and the required key name differ, use explicit `{ keyName: variableName }`.

TypeScript enforces the declared return type shape — `Promise<{ token: string; user: SafeUser }>` means the key must be literally `user`. Returning `{ safeUser }` creates a `safeUser` key, not a `user` key → type error. The data is there, just under the wrong name, which would break every caller that writes `result.user` at runtime.

---

## Lesson 80 — Semicolons vs commas inside `{}`: type vs value

Same `{}` symbol, two completely different things with their own separator rules:

```typescript
// TYPE definition (TypeScript only — erased at compile time) → semicolons
Promise<{ token: string; user: SafeUser }>

// OBJECT LITERAL (JavaScript value — exists at runtime) → commas
return { token, user: safeUser }
```

| What it is | World | Separator |
| --- | --- | --- |
| Type / interface definition | TypeScript (compile time only) | `;` semicolon |
| Object literal (a real value) | JavaScript (runtime) | `,` comma |

An inline type like `{ token: string; user: SafeUser }` is just an anonymous interface — TypeScript's type syntax, same rules as a named `interface {}` block. Seeing semicolons inside `{}` means "I'm describing a shape." Seeing commas means "I'm building a real object."

---

## Lesson 81 — res.json() and how data flows from model to browser

`res.status(201).json(result)` does three things: sets `Content-Type: application/json`, calls `JSON.stringify()` on the argument, and sends it as the HTTP response body. Whatever JS object you pass in is exactly what the frontend receives as JSON.

The data shape is decided at the **model** (which columns RETURNING/SELECT lists) and flows upward unchanged:

```
PostgreSQL row  →  model returns SafeUser
                →  service wraps it: { token, user: SafeUser }
                →  controller: res.json(result)
                →  browser receives: { "token": "...", "user": { ... } }
```

The controller is a **thin pass-through** — it does not reshape, filter, or make decisions about data. If you find yourself transforming data inside a controller, that logic belongs in the service.

The controller's only real decisions:

| Situation | Status | Why |
| --- | --- | --- |
| Register success | `201 Created` | a new resource was created |
| Login success | `200 OK` | no new resource — just authentication |
| AppError thrown | `error.statusCode` | service already decided (409, 401...) |
| Unknown error | `500` | something broke unexpectedly |

`200` vs `201` is the one place the controller actually thinks. Everything else is mechanical pass-through or error translation.

---

## Lesson 82 — res.status() vs res.statusCode

Both set the HTTP status code — the difference is chaining:

```typescript
res.status(201).json(result)   // Express method — returns res, enables chaining
res.statusCode = 201;          // Node.js property — assignment, no chaining, two lines
res.json(result);
```

`res.status()` is an Express convenience method that sets the code and returns `res` so `.json()` can be called immediately. `res.statusCode` is the raw Node.js `http.ServerResponse` property Express inherits — it works but feels below the Express layer.

Both produce identical HTTP responses. Use `res.status()` — it's the universal Express convention and chains cleanly. `res.statusCode` is the right answer only if you're writing raw Node.js without Express.

---

## Lesson 83 — The anatomy of an HTTP request (what the frontend sends)

Every HTTP request is a structured package with five parts. Express unpacks each one into a named property on `req`:

```
POST /api/v1/auth/register HTTP/1.1
Host: localhost:3000
Content-Type: application/json
Authorization: Bearer eyJhbGc...

{ "username": "kath", "email": "kath@x.com", "password": "secret123" }
```

**1. Method** — the intent of the request. Express routes filter on this first.

| Method | Meaning | Example |
| --- | --- | --- |
| `GET` | Read data, no body | fetch exercises list |
| `POST` | Create something, has a body | register, login, save workout |
| `PUT` | Replace something fully, has a body | update profile |
| `PATCH` | Partially update, has a body | change just the username |
| `DELETE` | Remove something | delete account |

**2. URL / path** — where the request is going. Breaks into two sub-parts Express separates for you:

```
/api/v1/users/abc-123?sort=desc
         └─────────┘ └────────┘
         req.params  req.query
```

- `req.params` — named segments declared in the route definition (`:id`): `router.get('/users/:id')` → `req.params.id === 'abc-123'`
- `req.query` — everything after the `?` as key/value pairs: `req.query.sort === 'desc'`

**3. Headers** — metadata about the request, not the data itself. Accessed via `req.headers`:

| Header | What it carries | Where you'll use it |
| --- | --- | --- |
| `Content-Type: application/json` | "my body is JSON" | `express.json()` middleware reads this to decide whether to parse |
| `Authorization: Bearer <token>` | the JWT | `requireAuth` middleware reads `req.headers.authorization` |
| `Host` | which domain was requested | rarely touched in app code |

The `Authorization` header is the one you'll access most:
```typescript
const authHeader = req.headers.authorization;
// "Bearer eyJhbGciOiJIUzI1NiJ9..."
const token = authHeader?.split(' ')[1];
// "eyJhbGciOiJIUzI1NiJ9..."
```

**4. Body** — the data payload. Only present on POST/PUT/PATCH. Accessed via `req.body`.

Without `express.json()` middleware, `req.body` is `undefined` — the middleware reads the raw bytes, parses them as JSON, and puts the result on `req.body`. This is why middleware order matters (Lesson 8): `express.json()` must run before any route that reads `req.body`.

```typescript
const { username, email, password } = req.body;
```

Always destructure explicitly — never pass `req.body` directly into a service (Lesson 81).

**5. req.user** — not part of the HTTP standard. This is a custom property your `requireAuth` middleware *attaches* after verifying the JWT. Downstream route handlers read it as if it arrived with the request. This is the mechanism that makes "who is asking?" available everywhere on protected routes.

---

## Lesson 84 — The anatomy of an HTTP response (what we send back)

Every response has three parts: a status code, headers, and a body.

**Status codes — the most important ones for this project:**

| Code | Name | When to use |
| --- | --- | --- |
| `200` | OK | Successful read or login — data returned |
| `201` | Created | Something new was created (register, save workout) |
| `400` | Bad Request | Client sent malformed/missing data |
| `401` | Unauthorized | Not logged in, or token invalid/expired |
| `403` | Forbidden | Logged in but not allowed (wrong role) |
| `404` | Not Found | Resource doesn't exist |
| `409` | Conflict | Duplicate — email/username already registered |
| `500` | Internal Server Error | Something broke on the server |

Rule of thumb: `2xx` = success, `4xx` = client's fault, `5xx` = server's fault.

**Headers** — Express sets `Content-Type: application/json` automatically when you call `res.json()`. You rarely set headers manually unless handling CORS or cookies.

**Body** — the JSON payload. `res.json()` serialises your object:

```typescript
res.status(201).json({ token, user });
// sends: { "token": "eyJ...", "user": { "id": "...", ... } }

res.status(401).json({ error: 'Invalid credentials' });
// sends: { "error": "Invalid credentials" }
```

Consistency rule: **always use the same shape for errors** — `{ error: "..." }`. The frontend team writes one error handler that works everywhere.

---

## Lesson 85 — Common Express req and res methods used in this project

**Reading from `req`:**

```typescript
req.body                    // parsed JSON body (POST/PUT/PATCH)
req.params.id               // route segment: /users/:id
req.query.exercise          // query string: ?exercise=squats
req.headers.authorization   // "Bearer <token>"
req.user                    // attached by requireAuth middleware (custom)
```

**Sending with `res` — the three patterns you'll use:**

```typescript
// 1. Success with data
res.status(200).json({ token, user });
res.status(201).json({ token, user });

// 2. Operational error (AppError caught)
res.status(error.statusCode).json({ error: error.message });

// 3. Unexpected error (500)
res.status(500).json({ error: 'Something went wrong' });
```

**The one rule:** call `res.json()` (or any `res.send*`) **exactly once** per request. Calling it twice throws a "headers already sent" error. This is why error handlers use `return` after sending, and why `try/catch` always ends with one clear path.

Express does not enforce this — TypeScript does not catch it — it's a runtime crash if you get it wrong. The `void` return type on controller functions is your reminder: after sending, there is nothing left to do.

---

## Lesson 86 — What a routes file is and why it exists

**The business reason**

A user on the MoveVerse app taps "Sign Up." The frontend sends `POST /api/v1/auth/register`. Express needs to know: "that URL + that method → call `handleRegister`." The routes file is the map that makes that connection. Without it, the controller functions you wrote exist in memory but are unreachable — like a business that has a phone but is not in the directory.

**What the routes file does**

Exactly one thing: bind a URL path + HTTP method to a controller function.

```typescript
router.post('/register', handleRegister);
router.post('/login',    handleLogin);
```

That is the entire file. No logic, no SQL, no `req`, no `res`.

**Express Router vs the main app**

`Router()` creates a mini Express app. It handles its own set of routes and gets mounted into the main app in `index.ts` at a prefix:

```typescript
// index.ts
app.use('/api/v1/auth', authRouter);
```

The prefix `/api/v1/auth` lives in `index.ts`, not in the routes file. This matters: if the business bumps from v1 to v2, only `index.ts` changes — not every route file.

Final paths the client sees:
- `POST /api/v1/auth/register` → `handleRegister`
- `POST /api/v1/auth/login` → `handleLogin`

**What the routes layer must never do**

- Import from models or services
- Write `req` or `res` — only controllers do that
- Contain `if` statements, `try/catch`, or any logic

---

## Lesson 87 — Why the URL prefix lives in index.ts, not in the routes file

When you write `router.post('/register', handleRegister)`, you are only defining the **suffix** — the part after whatever prefix the router is mounted at.

The prefix (`/api/v1/auth`) is declared at mount time in `index.ts`:

```typescript
app.use('/auth', authRouter);
```

**Why this split?**

Imagine you have five route files: auth, users, workouts, movements, leaderboard. If the business decides everything should be under `/api/v1/`, you change **one line** in `index.ts`:

```typescript
app.use('/api/v1/auth', authRouter);
```

Without this split, you would have to open every single routes file and edit the path prefix in each one. The routes file owns the suffix; `index.ts` owns the prefix. Change happens in one place.

---

## Lesson 88 — HTTP methods and what they mean (GET, POST, PUT, DELETE, PATCH)

Each HTTP method carries a meaning about what you are trying to do to a resource. Express exposes each one as a method on `router`:

| Method   | Meaning                          | Example                        |
| -------- | -------------------------------- | ------------------------------ |
| `GET`    | Read — fetch existing data       | `GET /users/me` — who am I?    |
| `POST`   | Create — make something new      | `POST /auth/register` — sign up |
| `PUT`    | Replace — overwrite a full record | `PUT /users/me` — replace profile |
| `PATCH`  | Update — change part of a record | `PATCH /users/me` — change username only |
| `DELETE` | Remove a resource                | `DELETE /workouts/123`         |

**Why register and login are both POST**

Register creates a new user row — `POST` is correct (creating a resource).  
Login does not create anything permanent, but it does create a session/token, and it sends a password in the body. `GET` requests must never carry sensitive data in the body (some clients ignore it; logs capture URLs). So login is `POST` too — the password travels in the request body, not in the URL.

**The rule of thumb:** if the operation changes state or sends sensitive data → `POST` (or `PUT`/`PATCH`/`DELETE`). If it only reads → `GET`.

---

## Lesson 89 — camelCase vs snake_case in API responses: what production actually uses

**The short answer:** camelCase is the dominant convention for JavaScript/TypeScript APIs, but snake_case is also used by major APIs and is a valid, simpler choice when the frontend team is the same team.

**Why camelCase is common in JS/TS APIs**

JSON was born from JavaScript. JavaScript uses camelCase natively. A React developer writing `user.createdAt` feels natural; `user.created_at` feels like it belongs in a Python or Ruby codebase. Most major JS-ecosystem APIs (Stripe, Google, Shopify) use camelCase in their responses.

**Why snake_case is also legitimate**

GitHub and Twitter/X both use snake_case. PostgreSQL uses snake_case. If the backend stays snake_case end-to-end, there is no transformation layer needed — what comes out of the DB goes straight into the JSON response with no extra code.

**The transformation problem**

If you choose camelCase for the API but snake_case in the DB, you need a transformation step somewhere — either in the service, the controller, or via a library like `humps`. This adds complexity and is another place for bugs to hide.

**MoveVerse decision: snake_case throughout**

- DB columns: snake_case (PostgreSQL convention)
- API responses: snake_case (matches DB directly — no transformation)
- API request bodies: snake_case (consistent with responses)

This means no transformation layer is needed anywhere. The DB row goes straight into `res.json()`. The frontend team (same team) knows to expect snake_case.

**When you would reconsider this**

If MoveVerse ever published a public API consumed by third-party developers — most of whom would be JavaScript developers — camelCase would be the better choice. At that point, add a transform at the controller layer (or use an ORM like Prisma that handles it automatically).
