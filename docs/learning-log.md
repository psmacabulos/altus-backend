# MoveVerse Backend — Learning Log

A personal record of concepts learned while building this project. Written for future reference — not documentation of what the code does, but why things work the way they do.

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

| Field | What it does |
|---|---|
| `target` | Which version of JavaScript to output |
| `outDir` | Where compiled files go (`dist/`) |
| `rootDir` | Where your TypeScript source lives (`src/`) |
| `strict` | Enables strict type checking — always use this |
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

| Command | When to use |
|---|---|
| `npm install` | Adding new packages locally |
| `npm ci` | CI/CD and Docker — installs exact versions from `package-lock.json`, faster, fails if lock file is out of sync |

---

## Lesson 7 — What Express is

Express is a framework that sits on top of Node's built-in HTTP module and makes it easier to handle requests and responses. Without Express you would have to parse URLs, headers, and bodies manually.

---

## Lesson 8 — Middleware

Middleware are functions that run between receiving a request and sending a response. They run in the order you register them with `app.use()`.

```typescript
app.use(helmet());   // runs first
app.use(cors());     // runs second
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

| Command | When to use |
|---|---|
| `docker compose up --build` | Source code changed — rebuilds the image |
| `docker compose down && docker compose up -d` | `.env` changed — containers need to restart to pick up new environment variables |

Code changes require a rebuild. Environment variable changes only require a restart.

---

## Lesson 17 — What CI/CD means

| Term | Meaning |
|---|---|
| CI (Continuous Integration) | Every push automatically runs checks — lint, build, tests |
| CD (Continuous Deployment) | Every merge to main automatically deploys to production |

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
  lint:              # job name
    runs-on: ubuntu-latest
    steps:
      - run: npm ci
      - run: npm run lint
```

---

## Lesson 20 — GitHub Actions triggers

```yaml
on:
  push:              # triggers on push to any branch
  pull_request:
    branches: ['main', 'dev']  # triggers on PRs targeting these branches
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

## Lesson 31 — __dirname vs process.cwd()

| | Points to |
|---|---|
| `__dirname` | The directory of the current file |
| `process.cwd()` | The directory where the command was run from (project root) |

When TypeScript compiles to `dist/db/migrate.js`, `__dirname` points to `dist/db/`. SQL migration files live in `src/db/migrations/` — not in dist. Use `process.cwd()` to always start from the project root, where `src/` is always reachable.

---

## Lesson 32 — ts-node vs node (compiled JS)

| Command | How it runs |
|---|---|
| `ts-node src/db/migrate.ts` | Runs TypeScript directly, no compilation step |
| `node dist/db/migrate.js` | Runs compiled JavaScript — TypeScript must be compiled first |

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
const hash = await bcrypt.hash(password, 10);    // store this
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
