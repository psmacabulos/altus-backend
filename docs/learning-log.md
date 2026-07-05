# Altus Backend — Learning Log (Part 1)

A personal record of concepts learned while building this project. Written for future reference — not documentation of what the code does, but why things work the way they do.

> **Part 2** is in `docs/learning-log-part2.md` — organised by topic rather than lesson number. Start there for anything learned from Phase 9 onwards.

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
| routes     | "POST /v1/auth/register → handleRegister" | Any logic            |
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

`path.join()` builds a file path correctly on any OS (handles `/` vs `\` differences). `fs.readdirSync()` reads all files in a folder and returns the result immediately — this is the synchronous version.

**`readdirSync` vs `readdir` (async)**

Node.js provides two versions of most file system operations:

```typescript
// Synchronous — blocks the thread until done, returns result directly
const files = fs.readdirSync(folder);

// Asynchronous — non-blocking, result arrives via Promise
const files = await fs.promises.readdir(folder);
```

`readdirSync` is safe here because `migrate.ts` is a script that runs once and exits — there is no server, no incoming requests, nothing else to do while waiting. Blocking is fine.

Inside an Express route handler or service, you must never use sync file operations — blocking the thread freezes every other request the server is handling. In a running server, always use `await fs.promises.readdir(...)`.

**The rule:** scripts that run once and exit → sync is fine. Inside a running server → always async.

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

Altus uses JWTs — no session storage or lookup needed, which suits a stateless deployment. The trade-off: a JWT cannot easily be revoked before it expires, which is why tokens get expiry times.

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
- Unanticipated errors (DB down) are caught by nobody in particular — they bubble to the global error handler (Phase 12), which logs and returns a generic 500. That safety net is why you don't write try/catch everywhere "just in case."

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
POST /v1/auth/register HTTP/1.1
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
/v1/users/abc-123?sort=desc
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

A user on the Altus app taps "Sign Up." The frontend sends `POST /v1/auth/register`. Express needs to know: "that URL + that method → call `handleRegister`." The routes file is the map that makes that connection. Without it, the controller functions you wrote exist in memory but are unreachable — like a business that has a phone but is not in the directory.

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
app.use('/v1/auth', authRouter);
```

The prefix `/v1/auth` lives in `index.ts`, not in the routes file. This matters: if the business bumps from v1 to v2, only `index.ts` changes — not every route file.

Final paths the client sees:
- `POST /v1/auth/register` → `handleRegister`
- `POST /v1/auth/login` → `handleLogin`

**What the routes layer must never do**

- Import from models or services
- Write `req` or `res` — only controllers do that
- Contain `if` statements, `try/catch`, or any logic

---

## Lesson 87 — Why the URL prefix lives in index.ts, not in the routes file

When you write `router.post('/register', handleRegister)`, you are only defining the **suffix** — the part after whatever prefix the router is mounted at.

The prefix (`/v1/auth`) is declared at mount time in `index.ts`:

```typescript
app.use('/auth', authRouter);
```

**Why this split?**

Imagine you have five route files: auth, users, workouts, movements, leaderboard. If the business decides everything should be under `/v1/`, you change **one line** in `index.ts`:

```typescript
app.use('/v1/auth', authRouter);
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

**Altus decision: snake_case throughout**

- DB columns: snake_case (PostgreSQL convention)
- API responses: snake_case (matches DB directly — no transformation)
- API request bodies: snake_case (consistent with responses)

This means no transformation layer is needed anywhere. The DB row goes straight into `res.json()`. The frontend team (same team) knows to expect snake_case.

**When you would reconsider this**

If Altus ever published a public API consumed by third-party developers — most of whom would be JavaScript developers — camelCase would be the better choice. At that point, add a transform at the controller layer (or use an ORM like Prisma that handles it automatically).

---

## Lesson 90 — What middleware is and why requireAuth exists

**The business reason**

Every route after login — saving a workout, viewing your profile, checking the leaderboard rank — should only work if you are logged in. The frontend proves this by sending the JWT it received at login in every protected request:

```
Authorization: Bearer <token>
```

The middleware is the guard that sits between the route and the controller. It reads that header, verifies the token, and either lets the request through or stops it with a 401. Without it, the controller has no way to know who is making the request.

**The middleware function signature**

```typescript
(req: Request, res: Response, next: NextFunction): void
```

It looks exactly like a controller — `req`, `res` — plus one extra argument: `next`. Calling `next()` tells Express "I'm done here, move on to the next handler." Not calling it (and sending a response instead) stops the chain dead.

**How it sits between the route and the controller**

```typescript
router.get('/me', requireAuth, handleGetMe);
//                ^^^^^^^^^^^
//                middleware runs first
//                only if it calls next() does handleGetMe run
```

**What requireAuth does, step by step**

1. Read `req.headers.authorization` — expect `Bearer <token>`
2. If missing or wrong format → `res.status(401).json(...)` and `return` — stop
3. Call `jwt.verify(token, secret)` — throws if expired or tampered
4. If valid → attach `req.user = { userId: decoded.userId }` and call `next()`
5. If verify throws → catch it, send 401 — stop

---

## Lesson 91 — The `next` function: how Express chains handlers

Express processes a request through a chain of functions. Each function either:
- **Sends a response** — the chain ends (no more handlers run)
- **Calls `next()`** — passes control to the next handler in the chain

```
request → requireAuth → handleGetMe → response
              ↓ next()       ↓ res.json()
```

If `requireAuth` sends a 401, it does NOT call `next()`, so `handleGetMe` never runs. This is how middleware "guards" a route.

**The rule:** in any middleware function, you must do exactly one of:
- Call `next()` (hand off)
- Send a response (end the cycle)

Never both. Never neither (the request would hang forever with no response).

---

## Lesson 92 — TypeScript module augmentation: adding `req.user` to Express

Express's `Request` type does not have a `user` property — it's not part of the library. If you write `req.user = { userId: '...' }` in the middleware, TypeScript throws a compile error: *Property 'user' does not exist on type 'Request'.*

The fix is **module augmentation** — you tell TypeScript to add a property to an existing third-party type, without modifying the library itself. You do this in a `.d.ts` declaration file:

```typescript
// src/types/express.d.ts
declare global {
  namespace Express {
    interface Request {
      user?: { userId: string };
    }
  }
}
```

**Why `user?` and not `user`?**

The `?` makes it optional. Unauthenticated routes (register, login, leaderboard) do not have a user attached — if `user` were required, TypeScript would complain every time you accessed `req` on a public route.

**Why a `.d.ts` file and not a `.ts` file?**

A `.d.ts` file contains only type declarations — no runtime code. It is automatically picked up by the TypeScript compiler as long as it lives inside the `src/` directory and `tsconfig.json` includes that path. No import needed anywhere.

---

## Lesson 93 — What `jwt.verify()` actually returns at runtime

`jwt.verify(token, secret)` returns the **decoded payload** — exactly what was passed into `jwt.sign()` when the token was created, plus two standard fields the JWT library adds automatically:

```javascript
// We signed: jwt.sign({ userId }, secret, { expiresIn: '7d' })
// verify returns:
{
  userId: "3f7a1b2c-...",   // what we put in
  iat: 1749123456,          // "issued at" — Unix timestamp, added automatically
  exp: 1749728256           // "expiry"    — Unix timestamp, added automatically
}
```

- `iat` = issued at — when the token was created
- `exp` = expiry — `iat` + 7 days in our case

`jwt.verify()` checks `exp` against the current time automatically. If the token is expired, tampered with, or signed with the wrong secret — it **throws** an error instead of returning. That is why the call must be inside a `try/catch`.

**Why we cast `as JwtPayload`**

TypeScript sees the return type of `jwt.verify()` as `string | JwtPayload` — it does not know our payload's shape. The `as JwtPayload` cast tells TypeScript: "trust me, this object has a `userId` string." At runtime, nothing changes — the object still has `iat` and `exp` — but TypeScript now allows `decoded.userId` without a compile error.

**The rule: to know what `decoded` contains, always look at `generateJWT`.**

The payload you get back from `verify` is exactly what you put into `sign`. If you do not know what keys were signed, go back to `generateJWT` and read what was passed as the first argument.

---

## Lesson 94 — How to add more data to the JWT payload (e.g. role)

The JWT payload is just an object — you can put any data you want into it by adding more properties to the object passed to `jwt.sign()`.

**Example: adding `role`**

```typescript
// Before — only userId
const generateJWT = (userId: string): string => {
  return jwt.sign({ userId }, secret, { expiresIn: '7d' });
};

// After — userId + role
const generateJWT = (userId: string, role: 'user' | 'admin'): string => {
  return jwt.sign({ userId, role }, secret, { expiresIn: '7d' });
};
```

At the call sites (`register` and `login`), pass the role from the user object:

```typescript
const token = generateJWT(user.id, user.role);
```

`user.role` already exists on `SafeUser` — it comes directly from the DB column which defaults to `'user'`.

**Also update `JwtPayload`** to match what is now being signed:

```typescript
interface JwtPayload {
  userId: string;
  role: 'user' | 'admin';  // add this
}
```

`JwtPayload` and the object passed to `jwt.sign()` must always stay in sync — they are the same contract, one for TypeScript and one for the JWT library.

**When to add role to the token**

Not now. Role is only needed when building admin-only routes (a later phase). Adding it before it is used is scope creep. When that phase arrives: update `generateJWT`, update `JwtPayload`, update `req.user` in `express.d.ts`, and add a separate `requireAdmin` middleware.

---

## Lesson 95 — `declare global`, `namespace`, `interface`, and `export {}` in a `.d.ts` file

This is the full pattern used in `src/types/express.d.ts`:

```typescript
declare global {
  namespace Express {
    interface Request {
      user?: { userId: string };
    }
  }
}

export {};
```

Each keyword has a specific job:

**`declare`**

Tells TypeScript: "I am describing a type — there is no runtime code here." It is a compile-time-only instruction. Nothing from a `declare` block ends up in the compiled JavaScript.

**`declare global { ... }`**

`global` means: "put this declaration in the global scope, visible everywhere in the project without importing." Together, `declare global { ... }` is how you add types to the global environment from inside a module file.

**`namespace Express`**

Express uses TypeScript namespaces internally to organise its types. `namespace Express` opens that namespace so you can reach inside it. Think of it like opening a drawer labelled "Express" that already exists — you are not creating it, you are adding something to it.

**`interface Request { ... }`**

TypeScript has a feature called **declaration merging** — if you declare an `interface` with the same name as one that already exists, TypeScript merges the two rather than replacing the first. Express already has an `interface Request` with `body`, `params`, `query`, `headers`, and so on. Writing another `interface Request` here does not replace it — it *adds* `user?` to it. The result is one merged interface with all the original properties plus yours.

**`export {}`**

This is the least obvious one. TypeScript treats files in one of two ways:

- **Script** — no `import` or `export` statements → declarations are automatically global
- **Module** — has at least one `import` or `export` statement → declarations are scoped to that file only

`declare global` is only meaningful inside a **module** file. If the file has no imports or exports, TypeScript sees it as a script, `declare global` has no effect, and the augmentation does not apply correctly.

`export {}` is a no-op at runtime — it exports nothing — but it makes TypeScript treat the file as a module. That single line is what activates `declare global`.

**In plain English, the whole file says:**

"This file is a module (`export {}`). Inside the global scope (`declare global`), inside Express's namespace (`namespace Express`), merge `user?` into the existing Request interface (`interface Request`)."

---

## Lesson 96 — curl: what it is and how to read the flags

`curl` is a command-line tool for sending HTTP requests. It is built into Windows 11, macOS, and Linux — no install needed. In production teams, developers use it to manually test API endpoints before connecting a frontend.

**Anatomy of a curl command**

```bash
curl -X POST http://localhost:5600/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"player1","email":"player1@test.com","password":"password123"}'
```

| Flag | Stands for | What it does |
|---|---|---|
| `-X POST` | method | Sets the HTTP method. Without this, curl defaults to `GET`. |
| `-H "..."` | header | Adds a request header. You can use `-H` multiple times for multiple headers. |
| `-d '...'` | data | The request body. curl sends this as the body of the request. |
| `\` | (shell) | Line continuation — splits one command across multiple lines for readability. |

**Why `-H "Content-Type: application/json"` is required**

This header tells the server what format the body is in. Without it, `express.json()` middleware does not parse the body — `req.body` arrives as `undefined` and the controller throws a TypeError. Always include it on POST/PUT/PATCH requests with a JSON body.

**Why single quotes around the body**

```bash
-d '{"username":"player1"}'
```

The body contains double quotes. If you wrap the whole thing in double quotes, the shell tries to interpret the inner double quotes and breaks the JSON. Single quotes tell the shell: "treat everything inside literally."

**Integration test vs unit test**

- **Integration test** — sends a real HTTP request to the running app, which hits the real database. Verifies the full stack works end to end. Requires `docker compose up -d`.
- **Unit test** — tests one function in isolation, no database or HTTP involved. Faster but narrower — only proves that one function behaves correctly, not that all the layers connect correctly.

curl commands are always integration tests.

---

## Lesson 97 — The underscore prefix convention for intentionally unused variables

ESLint's `no-unused-vars` rule throws an error when you declare a variable but never use it. But sometimes you *need* to declare a variable just to discard it — most commonly when destructuring an object to exclude a property:

```typescript
// We want safeUser (everything except password_hash)
// But destructuring forces us to name the excluded property
const { password_hash, ...safeUser } = user; // ← ESLint error: password_hash unused
```

**The fix: prefix with `_`**

```typescript
const { password_hash: _password_hash, ...safeUser } = user; // ← ESLint ignores it
```

`password_hash: _password_hash` is renamed destructuring — it takes the `password_hash` property and assigns it to a variable named `_password_hash`. The `_` prefix is a universal convention meaning: "I know this is unused — that is intentional."

By default, `@typescript-eslint/no-unused-vars` ignores any variable whose name starts with `_`. No extra config needed.

**Why not just use a different approach?**

You could avoid the variable entirely by building the object manually:

```typescript
const safeUser = { id: user.id, username: user.username, ... }; // tedious, error-prone
```

The destructuring + underscore pattern is cleaner and more maintainable — especially as the User interface grows.

---

## Lesson 98 — When Docker requires a full rebuild (`--build`) vs a restart

Docker builds an image once and bakes all project files into it at that point. How changes reach the running container depends on whether the file is volume-mounted.

**What is volume-mounted in Altus:**

```yaml
volumes:
  - ./src:/app/src   # only src/ is mounted
```

Only `./src` is mounted — changes to any `.ts` file inside `src/` are reflected immediately because the container reads from the host folder in real time.

**Everything else is baked into the image** — it does not update until you rebuild:

| File changed | What to do |
|---|---|
| Anything in `src/` | Nothing — changes reflect immediately via volume mount |
| `eslint.config.mjs` | `docker compose down && docker compose up --build` |
| `tsconfig.json` | `docker compose down && docker compose up --build` |
| `package.json` / `package-lock.json` | `docker compose down && docker compose up --build` |
| `Dockerfile` | `docker compose down && docker compose up --build` |
| `.env` | `docker compose down && docker compose up -d` (no rebuild needed — env vars are injected at runtime, not baked into the image) |

**The symptom when you forget to rebuild**

You change a config file, save it, the container keeps running — and the old behaviour continues as if nothing changed. No error, no warning. The container is simply running an old version of the file.

**The rule:** if the change is outside `src/`, rebuild.

---

## Lesson 99 — `curl -i`: how to see the HTTP status code in the terminal

By default, curl only prints the response body. The status code (`200`, `401`, `409`, etc.) is part of the response headers — and headers are hidden unless you ask for them.

**Add `-i` to include headers:**

```bash
curl -i -X POST http://localhost:5600/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nobody@test.com","password":"password123"}'
```

**What you see with `-i`:**

```
HTTP/1.1 401 Unauthorized        ← status line — method, version, code, and reason phrase
X-Powered-By: Express
Content-Type: application/json
Date: ...
                                 ← blank line separating headers from body
{"error":"Invalid credentials"}  ← body
```

**Why the status code matters in testing**

The body alone is not enough to verify a test. Two different scenarios could return the same body shape — what distinguishes them is the status code. A `401` and a `403` might both return `{ "error": "..." }`, but they mean different things:
- `401` — not authenticated (no valid token)
- `403` — authenticated but not allowed (valid token, wrong role)

Always verify both the status code **and** the body when testing an endpoint.

---

## Lesson 100 — Real-time stays on the client; the backend is called once at the boundary

**The pattern**

For features that involve real-time feedback during a user action (a game, a live form, a timer), keep all real-time computation on the client. The backend is only called once — at the boundary when the action is complete.

**Altus example — workout session**

```
During the game (client only — no network):
  MediaPipe detects a rep → game event fires → score increments on screen
  All of this is local. Zero backend calls. Zero latency.

Session ends (one network call):
  POST /v1/workout_sessions
  { exercise_difficulty_id, reps_completed, duration_seconds }
        ↓
  Backend calculates score and calories independently
  Saves to DB, returns authoritative result
```

**Why the backend never receives a score from the frontend**

The frontend calculates a local score for display only. The backend recalculates it independently using `reps_completed × score_multiplier`. The backend's number is what gets stored — the frontend's number is discarded.

This prevents score manipulation: a tampered request body cannot corrupt the stored score because the backend never reads a client-sent score. It derives the score itself from the raw inputs.

**Why this pattern avoids latency during gameplay**

If the backend were called on every rep (to confirm or compute the score), each rep would require a round-trip network call — typically 50–300ms. On a fast-paced game at 1 rep per second, this creates visible lag and freezes. The pattern avoids this entirely by keeping the game loop local and deferring all backend work until the session is over.

**The general rule**

| What | Where |
|---|---|
| Real-time feedback (score, timer, animation) | Client — no network |
| Persistence and validation | Backend — called once at the boundary |
| Source of truth for stored data | Always the backend's calculation |

This pattern appears in many contexts beyond games: live search suggestions (client-side filter, backend only on submit), collaborative editors (local edits, server sync on save), shopping carts (local state, backend on checkout).

---

## Lesson 103 — What Docker volumes are and how Docker separates projects

**What a volume actually is**

A Docker container is throwaway — when it stops or is deleted, everything inside it is gone. That is intentional. But a database cannot be throwaway. Volumes solve this: a volume is a folder that lives **outside** the container, on the host machine, that the container reads and writes to.

```
Host machine
  └── Docker-managed storage
        └── postgres_data  ← volume (permanent)

Postgres container (temporary)
  └── /var/lib/postgresql/data  ← Docker mounts the volume here at startup
```

The container is the engine. The volume is the fuel tank. You can delete and recreate the engine — the tank stays.

**How Docker keeps projects separate — automatic name prefixing**

When you run `docker compose up`, Docker prefixes every volume name with the project folder name:

```
Declared in compose:         postgres_data
Actual volume name created:  moveverse-backend_postgres_data
```

A second project with its own `postgres_data` declaration gets its own prefixed volume:

```
moveverse-backend_postgres_data   ← Altus data (folder name is still moveverse-backend)
other-project_postgres_data       ← other project's data
```

They never overlap. Run `docker volume ls` to see all volumes on your machine.

**Postgres versions across projects**

Each `docker-compose.yml` specifies its own image version (`image: postgres:15-alpine`, `image: postgres:14`). Docker runs whichever version each project asks for, reading its own separate volume. As long as the projects use different host ports (5432 vs 5433 etc.) they can run simultaneously without conflict.

---

## Lesson 102 — Docker volumes survive image deletion — how to fully reset Postgres

**The symptom**

After deleting Docker images and running `docker compose up` again, Postgres throws:

```
password authentication failed for user "moveverse_user"
```

even though `.env` has the correct password.

**Why it happens**

Docker has three separate concepts that are deleted independently:

| Docker thing | What it is | Deleted with image delete? |
|---|---|---|
| Image | The blueprint (the "recipe") | Yes |
| Container | A running instance | No — needs `docker rm` |
| Volume | Persistent storage | No — needs `docker volume rm` or `down -v` |

The `docker-compose.yml` declares a named volume `postgres_data` mapped to `/var/lib/postgresql/data` inside the Postgres container. This volume holds all the database files, including the credentials set during first initialisation.

When Postgres starts and finds the volume already contains data, it **skips initialisation entirely** — it will not re-read `POSTGRES_USER` / `POSTGRES_PASSWORD` from the environment. So the old credentials stay in the volume and no longer match the `.env` values.

**The fix — delete the volume and let Postgres reinitialise**

```bash
docker compose down -v     # stops containers AND deletes named volumes
docker compose up --build  # rebuilds images, Postgres initialises from scratch
```

Then re-run migrations and seed:

```bash
docker compose exec app npm run migrate
docker compose exec app npm run seed
```

**The rule to remember**

When resetting Docker from scratch, always use `down -v` — not just `down` or image deletion. `-v` is the flag that clears volumes.

Each layer answers a different question, so each layer uses a different naming style.

**The rule per layer:**

| Layer | Naming pattern | Answers the question |
|---|---|---|
| Model | `verb + Noun` | "What does the SQL do?" |
| Service | bare `verb` or `verb + Noun` | "What is the user trying to do?" |
| Controller | `handle` + action | "What HTTP request am I handling?" |
| Routes | no named functions | Just wires URL to controller |

**Model — database language**

Model function names describe the SQL operation:

- `createUser` → INSERT INTO users
- `findByEmail` → SELECT WHERE email = $1
- `findById` → SELECT WHERE id = $1
- `getAllExercises` → SELECT all rows from exercises JOIN difficulties
- `createSession` → INSERT INTO workout_sessions

Verbs to use: `create`, `find`, `getAll`, `update`, `delete`

**Service — business language**

Service function names describe the concept a non-technical person would recognise:

- `register` → "I want to sign up"
- `login` → "I want to log in"
- `getExercises` → "I want to see exercises"
- `saveSession` → "I want to save my workout"

Re-read the user story. The main verb of the story becomes the service function name.

**Controller — always prefixed with `handle`**

Controller names mirror the service name, prefixed with `handle`:

- `handleRegister`, `handleLogin`, `handleGetExercises`, `handleSaveSession`

The `handle` prefix signals: this is an HTTP handler — it touches `req` and `res`. Nothing else uses this prefix.

**Deriving names from the user story (the formula)**

> "As a player, I want to see all exercises with their difficulty levels."

1. Business action = **get exercises** → service: `getExercises()`
2. DB action = select all rows → model: `getAllExercises()`
3. HTTP handler = handling that GET request → controller: `handleGetExercises()`

**Quick reference for Altus phases**

| User story | Model | Service | Controller |
|---|---|---|---|
| "see all exercises" | `getAllExercises()` | `getExercises()` | `handleGetExercises()` |
| "save a workout" | `createSession()` | `saveSession()` | `handleSaveSession()` |
| "see my history" | `getSessionsByUser()` | `getWorkoutHistory()` | `handleGetMyHistory()` |
| "view my profile" | `findById()` | `getProfile()` | `handleGetProfile()` |

---

## Lesson 104 — URL design: subdomain vs path prefix — when `/api/v1` becomes redundant

When a backend API is served from a dedicated subdomain like `api.altus.games`, including `/api` in the path prefix is redundant:

```
api.altus.games/api/v1/exercises   ← "api" appears twice
api.altus.games/v1/exercises       ← clean — subdomain already signals it's an API
```

The subdomain communicates the purpose (`api`). The path only needs to carry the version (`v1`) and the resource (`exercises`).

**Real-world examples that follow this pattern:**
- `api.stripe.com/v1/...`
- `api.github.com/repos/...`

**The rule:** If your subdomain is `api.*`, drop `/api` from the path prefix. Keep `/v1` for versioning.

**For Altus:** `src/index.ts` mounts routes at `/v1/auth`, `/v1/exercises`, etc. — not `/api/v1/`. The production URL is `https://api.altus.games/v1/...`.

---

## Lesson 105 — Custom domains on Heroku: how DNS and CNAME records work

**The problem:** By default your backend is at `moveverse-backend.herokuapp.com`. You want users (and the frontend) to reach it at `api.altus.games`.

**How it works:**

```
User hits api.altus.games
    ↓
DNS looks up the CNAME record for api.altus.games
    ↓
CNAME says: go to xyz.herokudns.com
    ↓
Heroku receives request, checks which app owns api.altus.games
    ↓
Routes to your app → response sent back
```

You are not moving anything — you are adding a signpost in DNS.

**Two steps required — both must be done:**

1. **Tell Heroku** — Heroku must know your app owns that domain, otherwise it refuses the request even if DNS points there:
   ```bash
   heroku domains:add api.altus.games --app moveverse-backend
   heroku domains:wait api.altus.games --app moveverse-backend
   heroku domains --app moveverse-backend   # reveals the DNS target
   ```

2. **Tell DNS (name.com)** — Add a CNAME record so browsers know where to go:

   | Field | Value |
   |---|---|
   | Type | CNAME |
   | Host | `api` |
   | Answer | the `.herokudns.com` target Heroku gave you |

**Important:** You cannot edit a Heroku domain entry — only remove and re-add. If you get the domain wrong, run `heroku domains:remove` first, then `heroku domains:add` with the correct domain.

**Verify DNS is live:**
```bash
nslookup api.altus.games
```
When this returns the Heroku address, DNS is propagating correctly.

---

## Lesson 106 — Heroku ACM: automatic SSL certificates for custom domains

When you add a custom domain to Heroku, HTTPS does not work automatically. Heroku uses **Automated Certificate Management (ACM)** to issue a free SSL certificate — but it must be enabled first.

**Symptom without ACM enabled:**
```
curl: (35) schannel: SEC_E_INTERNAL_ERROR — The Local Security Authority cannot be contacted
```

**Check ACM status:**
```bash
heroku certs:auto --app moveverse-backend
```

**Enable ACM:**
```bash
heroku certs:auto:enable --app moveverse-backend
```

After enabling, ACM provisions the certificate automatically once DNS is pointing correctly. It can take a few minutes. Status moves from `Waiting` → `OK`.

**Why it requires DNS first:** ACM uses a domain validation challenge — it needs to confirm you actually control the domain before issuing a certificate. If DNS is not pointed at Heroku yet, the validation fails.

---

## Lesson 107 — Never rewrite pushed git history — fix forward with a new commit

**The rule:** If a commit has already been pushed to a remote branch, do not amend it, reset it, or rebase it away. Fix the mistake in a new commit instead.

**Why:** When you push a commit, teammates (or CI) may already have pulled it. Rewriting history changes the commit hash — their local history and the remote history diverge, causing conflicts that are painful to resolve.

**What "rewriting history" means:**
- `git commit --amend` after pushing
- `git reset --hard HEAD~1` then force push
- `git rebase -i` to squash/edit pushed commits

**The safe approach — always:**
```bash
# Fix the files
git add <files>
git commit -m "fix: correct the mistake"
git push
```

Two commits in history is fine. A clean, honest record of what happened is better than a falsified single commit.

**Exception:** On your own private feature branch that nobody else has pulled, amending is acceptable. But when in doubt, fix forward.

---

## Lesson 108 — How to rename a git branch

**Rename the branch you are currently on:**
```bash
git branch -m new-name
```

**Rename a branch you are NOT on:**
```bash
git branch -m old-name new-name
```

**After renaming, if the branch was already pushed:**
```bash
git push origin -u new-name        # push the renamed branch
git push origin --delete old-name  # delete the old name from remote
```

**Convention used in this project:** `feat/` prefix for feature branches (e.g. `feat/exercises`, `feat/auth`). Not `feature/` — shorter and matches common team convention.

---

## Lesson 114 — JWT payload: what you sign is what you get back

**Signing a token**

```typescript
jwt.sign({ userId }, secret, { expiresIn: '7d' });
```

The first argument `{ userId }` is the **payload** — an object you choose. Whatever you put in here comes back when the token is decoded.

**Verifying and reading the token**

```typescript
const decoded = jwt.verify(token, secret);
// decoded = { userId: 'abc-123', iat: 1234567890, exp: 1235172690 }
```

`iat` (issued at) and `exp` (expiry) are added automatically by the library. You get them back alongside your own fields.

**How this powers `req.user`**

The middleware decodes the token on every protected request and attaches the payload to `req.user`. That is why every controller can read `req.user.userId` — it came from the token, not the request body.

**What NOT to put in the payload**

The JWT payload is NOT encrypted — it is base64 encoded, which anyone can decode. Never put passwords, full user objects, or sensitive data in it. Only put an ID — something useless without the database behind it.

```
jwt.sign({ userId })        ✅ — just an ID, meaningless alone
jwt.sign({ user })          ❌ — leaks email, role, everything
jwt.sign({ password })      ❌ — critical security vulnerability
```

---

## Lesson 115 — Why jwt.sign() takes 3 arguments but jwt.verify() returns 1 object

**Signing takes three separate arguments:**

```typescript
jwt.sign(
  { userId },          // 1. the payload — your data
  secret,              // 2. the signing key — proves authenticity
  { expiresIn: '7d' } // 3. options — controls token behaviour
)
```

These are separate for convenience. Under the hood, the library merges `expiresIn` into the payload as `exp` (a Unix timestamp) and uses the secret to generate a signature. The secret never enters the payload.

**A JWT has three parts separated by dots:**

```
header . payload . signature
  ↑         ↑         ↑
algorithm  your     cryptographic proof
           data     the token wasn't tampered with
           + iat    (uses the secret — never readable)
           + exp
```

**Decoding returns one flat object — the payload section only:**

```typescript
{ userId: 'abc-123', iat: 1234567890, exp: 1235172690 }
```

`iat` and `exp` appear here because the library added them to the payload before sealing the token. The secret never comes back — it was used to create the signature, not stored in the payload.

**The rule:** `jwt.sign()` takes 3 arguments as a convenient API. Inside the token there is always one JSON object. The secret lives only in your server's environment — never in the token.

---

## Lesson 117 — JWT logout: why it's harder than it looks and what to do for MVP

**The core problem**

JWTs are stateless — the server never stores them. When a user "logs out," the frontend deletes the token from storage. But the token itself remains cryptographically valid until it expires. If someone intercepted the token before logout, they can still use it.

**Server-side logout options**

| Approach | How it works | Trade-off |
|---|---|---|
| Client-side only | Frontend deletes the token | Simple — stolen token stays valid until expiry |
| Token blacklist | Store invalidated tokens in DB/Redis, check on every request | True revocation — adds a DB lookup to every protected request |
| Short expiry + refresh tokens | 15min access token + long-lived refresh token | Industry standard — significantly more complex to build |

**For Altus MVP: client-side logout is sufficient**

The risk profile of a fitness game does not justify a token blacklist or refresh token system. The token expires in 7 days anyway. A `POST /auth/logout` endpoint that just tells the frontend "ok, delete your token" adds no real security — the frontend should just delete it without asking.

**The general rule**

Match your logout strategy to your security requirements. A banking app needs refresh tokens and short expiry. A game leaderboard does not. Complexity has a cost — only pay it when the threat model demands it.

---

## Lesson 116 — The N+1 problem and how a JOIN solves it

**What N+1 means**

The naive approach to fetching exercises with difficulties:

```
Query 1: SELECT * FROM exercises              → returns N exercises
Query 2: SELECT * FROM exercise_difficulties WHERE exercise_id = id_1
Query 3: SELECT * FROM exercise_difficulties WHERE exercise_id = id_2
...
Query N+1: SELECT * FROM exercise_difficulties WHERE exercise_id = id_N
```

N exercises = N+1 database queries. With 50 exercises that is 51 round trips to the database. Each round trip has overhead: network latency, connection acquisition, query parsing. This compounds quickly.

**The JOIN solution — 1 query always**

```sql
SELECT e.*, ed.*
FROM exercises e
JOIN exercise_difficulties ed ON ed.exercise_id = e.id
```

One query returns all the data regardless of how many exercises exist. The cost of extra exercises is more rows in one result set — not more queries.

**Time complexity of the JOIN + reshape approach**

| Step | Complexity | Why |
|---|---|---|
| SQL JOIN | O(E × D) | One row per exercise-difficulty pair |
| JavaScript loop | O(E × D) | One pass through all rows |
| `exerciseMap[id]` lookup | O(1) | JS objects are hash maps |
| `Object.values()` | O(E) | One pass through map keys |

Overall: **O(E × D)**. Since D is always 3 (Easy/Medium/Hard), this simplifies to **O(E)** — linear in the number of exercises.

**The real win is not algorithmic — it is network round trips**

Reducing from N+1 queries to 1 query eliminates N database round trips. That is where the actual performance gain comes from, not the Big-O complexity.

---

## Lesson 109 — SQL JOINs: combining two tables in one query

**Why JOINs exist**

Data in a relational database is split across tables to avoid repetition. A `JOIN` combines rows from two tables into one result set wherever a condition is true — used when the API response needs data from more than one table at once.

**The syntax**

```sql
SELECT
  e.id    AS exercise_id,
  e.name,
  ed.id   AS difficulty_id,
  ed.level_name
FROM exercises e
JOIN exercise_difficulties ed ON ed.exercise_id = e.id
WHERE e.is_active = true
ORDER BY e.name, ed.level_name
```

| Part | What it does |
|---|---|
| `FROM exercises e` | Start with the exercises table, alias it `e` |
| `JOIN exercise_difficulties ed` | Bring in difficulties, alias `ed` |
| `ON ed.exercise_id = e.id` | The link condition — only combine rows where the difficulty belongs to that exercise |
| `AS exercise_id` | Alias a column name — needed when both tables have an `id` column to avoid a clash |

**What the result looks like**

The JOIN returns FLAT rows — one row per difficulty, exercise data repeated:

```
exercise_id | name    | difficulty_id | level_name
1           | Squats  | a             | Easy
1           | Squats  | b             | Medium
1           | Squats  | c             | Hard
2           | Pushups | d             | Easy
```

This is expected. The model's job is to reshape these flat rows into nested objects after the query.

---

## Lesson 110 — How to plan interfaces in a model (the 3-interface rule)

Before writing any function in a model, define your interfaces first. Always start from two questions:

**1. What does the SQL return?** → raw row interface
**2. What does the caller need back?** → output interface(s)

For a JOIN query that needs nested output, you always need 3 interfaces:

| Interface | Answers | Where to look |
|---|---|---|
| Raw row | What does one flat SQL row look like? | Your SELECT column list |
| Nested child | What is inside the nested array? | API spec response |
| Parent with array | What does the final output object look like? | API spec response |

**Applied to exercises:**

```typescript
interface ExerciseRow {       // raw SQL row — mirrors SELECT list exactly
  exercise_id: string;
  name: string;
  difficulty_id: string;
  level_name: string;
  ...
}

interface Difficulty {        // one item inside the nested array
  id: string;
  level_name: string;
  target_reps: number;
  score_multiplier: number;
}

interface Exercise {          // the final output shape
  id: string;
  name: string;
  difficulties: Difficulty[];
}
```

**The rule:** Write interfaces BEFORE writing the function. Once the interfaces are right, the function logic follows naturally.

---

## Lesson 111 — `Record<K, V>`: TypeScript's type for objects with dynamic keys

`Record<K, V>` is a TypeScript built-in utility type. It describes an object where:
- Every **key** is of type `K`
- Every **value** is of type `V`
- The exact keys are not known in advance

```typescript
const exerciseMap: Record<string, Exercise> = {};
```

This tells TypeScript: "this object will have string keys (exercise IDs) and Exercise values." At runtime it is just `{}`.

**Why not just use `{}`?**

Plain `{}` tells TypeScript nothing about what goes in the object. TypeScript would not know what type `exerciseMap['some-id']` is, and would not catch mistakes when you access or assign properties.

**Equivalent syntax** — these mean the same thing:
```typescript
Record<string, Exercise>
{ [key: string]: Exercise }   // index signature — older style
```

`Record` is preferred — shorter and more readable.

---

## Lesson 112 — `console.log` depth limit: why nested objects show as `[Object]`

**The symptom**

```
[ { id: '1', name: 'Squats', difficulties: [ [Object], [Object] ] } ]
```

`difficulties` shows `[Object]` instead of the actual data.

**Why it happens**

`console.log` only expands objects to 2 levels deep by default. The `difficulties` array is at level 3 — so Node.js collapses it to `[Object]` rather than printing it fully.

**The fix — use `JSON.stringify` for debugging nested structures**

```typescript
console.log(JSON.stringify(result, null, 2));
```

`JSON.stringify(value, null, 2)` converts the full object to a JSON string with 2-space indentation — no depth limit, everything visible.

Remove `JSON.stringify` debug lines before committing. They are for development only.

---

## Lesson 113 — Loop logic bug: push inside `if` vs outside `if`

**The bug**

```typescript
if (!exerciseMap[row.exercise_id]) {
  exerciseMap[row.exercise_id] = { ..., difficulties: [] };
  exerciseMap[row.exercise_id].difficulties.push(...);  // ← inside the if
}
```

The push is inside the `if` block — it only runs when the exercise is seen for the **first time**. On the second and third rows (Medium, Hard difficulties), the exercise already exists so the `if` is false — the push never runs. Result: only the first difficulty appears.

**The fix — push outside the `if`**

```typescript
if (!exerciseMap[row.exercise_id]) {
  exerciseMap[row.exercise_id] = { ..., difficulties: [] };
  // only create the entry here — do NOT push here
}

// always runs — for every row, new exercise or existing
exerciseMap[row.exercise_id].difficulties.push(...);
```

**The mental model**

The `if` block answers: *"does this exercise exist yet?"* — create it if not.
The push answers: *"add this difficulty to whichever exercise this row belongs to."* — always happens.

---

## Lesson 114 — PostgreSQL INSERT: parameterized queries and RETURNING

### Parameterized queries — `$1, $2, $3`

When writing SQL with `pg`, never put values directly inside the SQL string. Use numbered placeholders instead — `$1`, `$2`, `$3` — and pass the actual values as a second array argument to `pool.query()`:

```
pool.query(SQL_WITH_PLACEHOLDERS, [value1, value2, value3])
```

`$1` maps to the first element in the array, `$2` to the second, and so on.

**Why?** Putting values directly into the SQL string (via concatenation or template literals) is how SQL injection attacks work — a malicious value can break out of the string and execute arbitrary SQL. The parameterized form keeps SQL and data completely separate — the DB driver never lets a value be interpreted as SQL.

### `RETURNING` — getting the inserted row back without a second query

By default, a PostgreSQL INSERT writes the row and returns nothing. The `RETURNING` clause, added at the end of the INSERT statement, tells PostgreSQL: "after inserting, give me back these columns from the row you just wrote."

```sql
INSERT INTO some_table (col_a, col_b) VALUES ($1, $2)
RETURNING id, created_at
```

This is useful when the row contains values the application never knew before the insert — for example, a `UUID` generated by `gen_random_uuid()` or a timestamp defaulting to `NOW()`. Without `RETURNING` you would need a second SELECT to fetch them. `RETURNING` avoids that round-trip.

The result comes back in `result.rows`, the same as any SELECT. Since an INSERT writes one row, the inserted data is at `result.rows[0]`.

---

## Lesson 115 — `find` vs `get` in model function naming

Both use a SELECT query underneath, but the names signal different intentions to the reader.

**`find`** — searching for a specific record that may or may not exist. Returns a single item or `null`. The word "find" implies uncertainty — you're looking, it might not be there.

- `findByEmail` → does a user with this email exist? Returns one user or null.
- `findById` → does a user with this ID exist? Returns one user or null.

**`get`** — fetching data expected to be there. Returns a collection (array) or a definite resource. An empty array is a valid result — not an error.

- `getAllExercises` → returns all exercises, always an array (possibly empty).
- `getSessionsByUser` → returns a user's sessions, always an array (possibly empty).

**Rule of thumb**

| Scenario | Convention |
|---|---|
| Looking up one record that might not exist | `find` |
| Fetching a collection or a resource expected to exist | `get` |

This is also why auth code always checks `if (!user)` after `findByEmail` — the name itself signals that `null` is a possible return value that must be handled.

---

## Lesson 116 — Never trust the client: why reference data must be re-fetched server-side

**The temptation**

When the frontend already has data (e.g. `score_multiplier`, `calories_per_rep` from `GET /exercises`), it seems wasteful to query the DB again when saving a workout. Why not just have the frontend send those values back?

**Why it's dangerous**

Any value that travels through the client can be tampered with. A player can open DevTools, intercept the POST request, and change `score_multiplier` from `1.5` to `100`. If the server uses whatever the client sent, the score is inflated 100×. Moving the multiplier into the request body just shifts the attack surface — it doesn't eliminate it.

**The rule: never trust the client**

Reference data sent to the frontend (multipliers, prices, permissions, limits) must always be re-fetched from the server when used in a calculation or security decision. The client's copy could be stale, modified, or malicious.

**The double benefit of re-querying**

A DB lookup at save time does two things at once:
1. **Validates** — if the `exercise_difficulty_id` is fake or stale, the query returns nothing and you catch it with a 404.
2. **Provides trusted data** — multipliers come from the DB, not from whatever the client decided to send.

The performance cost (one extra SELECT per save) is negligible for an infrequent operation like saving a workout. Security always wins over micro-optimisation here.

---

## Lesson 117 — `??` vs `||`: nullish coalescing vs logical OR

Both operators provide a fallback value, but they trigger under different conditions.

**`||` (logical OR)** — returns the right side when the left side is any **falsy** value: `null`, `undefined`, `0`, `''`, `false`.

**`??` (nullish coalescing)** — returns the right side only when the left side is **`null` or `undefined`**. It ignores other falsy values.

**Why the difference matters**

```
score_multiplier = 0   // valid value

score_multiplier || 'default'  →  'default'  ❌ (0 is falsy, gets replaced)
score_multiplier ?? 'default'  →  0          ✅ (0 is not null/undefined, kept)
```

**Rule of thumb**

- Use `??` when `0`, `false`, or `''` are legitimate values you do not want to accidentally overwrite.
- Use `||` only when you want to replace all falsy values with a fallback.

---

## Lesson 118 — `if` statement vs `try/catch`: choosing the right error-handling pattern

Both handle error cases, but the right choice depends on *when* the problem is detectable.

**Use an `if` statement** when you can check the condition before acting. Query first, inspect the result, throw if invalid. The flow stays under your control.

Example: `saveSession` calls `findDifficultyById` first. If it returns null, throw a 404 immediately. No DB error involved — you knew upfront.

**Use `try/catch`** when the error only reveals itself when you attempt the operation — you cannot check beforehand.

Example: `register` cannot check for a duplicate email before inserting without a race condition (another user could claim the email between the SELECT and INSERT). The database's unique constraint is the only reliable guard, so you attempt the INSERT and catch the `23505` constraint error that comes back.

**Rule of thumb**

| Situation | Pattern |
|---|---|
| You can check the condition before acting | `if` statement upfront |
| The error only reveals itself when you try | `try/catch` around the attempt |

A `try/catch` in the service should always target a **specific, known error**. Re-throw anything else (`throw error`) — never silently swallow unexpected errors.

---

## Lesson 119 — Non-null assertion `!`: telling TypeScript a value is guaranteed to exist

**The problem**

`req.user` is typed as `user?: { userId: string }` in `express.d.ts` — the `?` makes it optional. TypeScript warns that `req.user.userId` could fail if `user` is `undefined`.

**Why it's safe here**

On protected routes, `requireAuth` middleware runs before the controller. If the JWT is missing or invalid, `requireAuth` rejects the request with a `401` and the controller never executes. By the time the controller runs, `req.user` is guaranteed to be set.

TypeScript cannot see this runtime guarantee — it only sees the type definition. The non-null assertion operator `!` bridges that gap:

```typescript
const userId = req.user!.userId;
```

The `!` tells TypeScript: "I know this looks like it could be undefined, but I'm guaranteeing it won't be at runtime."

**When to use `!` vs when not to**

Use `!` only when there is a real runtime guarantee you can point to — in this case, the middleware. Do not use `!` to silence TypeScript warnings when the value genuinely could be undefined. That turns a compile-time warning into a silent runtime crash.

---

## Lesson 120 — SQL clause ordering: JOINs must come before WHERE

SQL has a fixed clause order. Putting `WHERE` between two `JOIN` statements is a syntax error — the database will reject the query.

**Correct order:**

```sql
FROM   table
JOIN   other_table ON ...
JOIN   another_table ON ...
WHERE  condition
ORDER BY column
```

**Wrong — WHERE between JOINs:**

```sql
FROM   workout_sessions w
JOIN   exercise_difficulties ed ON ed.id = w.exercise_difficulty_id
WHERE  w.user_id = $1         ← syntax error here
JOIN   exercises e ON e.id = ed.exercise_id
ORDER BY w.completed_at DESC
```

The rule: finish all your JOINs first, then filter with WHERE, then sort with ORDER BY.

---

## Lesson 121 — Database schema version control with migrations

**The rule: never edit an existing migration file**

Migration files are a permanent, ordered record of every change made to the schema. Once a migration has run in production, editing it is rewriting history — the production database has already moved past that point and will not re-run it.

For every schema change, create a new numbered migration file instead.

**The pattern**

```
001_create_users.sql          ← never touch after deployed
002_create_exercises.sql      ← never touch after deployed
...
007_add_profile_picture_to_users.sql   ← new change goes here
```

The new file contains an `ALTER TABLE` statement, not a `CREATE TABLE`. The migration runner executes files in numeric order, so the new file runs after everything that came before it.

**Common ALTER TABLE operations**

| Change | SQL |
|---|---|
| Add a column | `ALTER TABLE t ADD COLUMN IF NOT EXISTS col type` |
| Remove a column | `ALTER TABLE t DROP COLUMN IF EXISTS col` |
| Rename a column | `ALTER TABLE t RENAME COLUMN old_name TO new_name` |

**Why numbered files matter**

Numbers enforce execution order. A later migration may depend on a table or column created by an earlier one. Running them out of order would fail. The numbering guarantees the database is always built up correctly — on any machine, from scratch.

**The bigger picture**

The migrations folder is the schema's version history, the same way git tracks code. A new developer runs `npm run migrate` and gets an identical database built step by step from the beginning.

---

## Lesson 122 — Anti-cheat: two levels of server-side protection

**The question:** if the backend calculates score from `reps_completed`, can a player still cheat by sending a fake `reps_completed` value?

**Yes — `reps_completed` comes from the frontend and can be tampered with.**

A player with DevTools can intercept the POST request and change `reps_completed: 15` to `reps_completed: 99999`. The score will be inflated.

**Level 1 — What server-side scoring prevents (MVP)**

Without server-side scoring, a player sends an arbitrary `score` value directly — completely unconstrained. Server-side scoring removes that attack. The player can still inflate `reps_completed`, but:
- The formula (`× score_multiplier`) still comes from the DB — they can't change the rate
- The cheat is constrained rather than arbitrary

This is the right stopping point for MVP.

**Level 2 — Full anti-cheat (future phase)**

Real competitive games cross-check claimed reps against other signals:
- **Duration check** — 1000 reps in 10 seconds is physically impossible → flag or reject
- **Rate limiting** — a user completing 100 sessions per hour is suspicious
- **Statistical anomaly detection** — scores wildly inconsistent with a user's history

This is a whole engineering discipline, not justified at MVP stage.

**The trade-off to articulate**

Server-side scoring solves the obvious attack (fake scores). Fake rep counts are a harder problem addressed in a future anti-cheat phase. Knowing where to draw the line is an engineering judgement call.
