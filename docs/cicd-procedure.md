# Altus Backend — CI/CD Procedure

A step-by-step reference for the full CI/CD pipeline: what it is, how it's structured, and how to set it up.

---

## What CI/CD means

| Term | What it stands for | What it does |
|---|---|---|
| CI | Continuous Integration | Automatically checks every push — lint, build, tests |
| CD | Continuous Deployment | Automatically deploys to production when `main` is updated |

Together: every push to any branch is checked. Every merge into `main` is deployed. You never manually deploy — pushing to `main` IS deploying.

---

## Where does everything live on Heroku?

Heroku separates your app and your database into two independent things:

| What | Where it lives | How you set it up |
|---|---|---|
| Your Node.js app | A **dyno** — Heroku's managed Linux server | Deployed automatically via GitHub Actions |
| Your PostgreSQL database | A **Heroku Postgres add-on** — a separate managed database server | Added manually in the Heroku dashboard (Step 2) |

An **add-on** is an extra service you attach to your Heroku app. Heroku Postgres is one of many — you search for it in the dashboard, click add, and Heroku provisions a real PostgreSQL database for you and gives you the credentials. You don't install anything or configure a server.

Your `.env` file never reaches Heroku. Instead, you enter each variable manually in the Heroku dashboard as a **Config Var**. Heroku injects those into your app at runtime exactly like `.env` does locally.

---

## Heroku CLI — when it is and isn't needed

| Step | Needs CLI? |
|---|---|
| Creating the Heroku app | No — done in the dashboard |
| Adding Heroku Postgres | No — done in the dashboard |
| Getting the API key | No — done in the dashboard |
| Adding GitHub Secrets | No — done in GitHub settings |
| The deploy job in GitHub Actions | No — the `akhileshns/heroku-deploy` action handles it via the API |
| Running migrations in production | No — handled automatically by the Procfile `release:` line |
| Seeding the production database | **Yes — Step 9 requires the CLI** |

---

## Current pipeline state

```
Any branch push
  ├── lint job        (npm run lint)       ✅ done
  └── typecheck job   (npm run build)      ✅ done

Push to main
  └── deploy job      (Heroku)             ⏳ to set up
```

---

## Files involved

| File | Purpose | Status |
|---|---|---|
| `.github/workflows/ci.yml` | The full workflow — CI + CD | CI done, deploy job to add |
| `Procfile` | Tells Heroku what command to run | To create |
| `package.json` | Needs `engines` field for Node version | To update |
| GitHub Secrets | Stores `HEROKU_API_KEY` securely | To configure |

---

## Step 1 — Heroku account setup

1. Go to heroku.com and confirm your account is active via the GitHub Student Developer Pack.
2. Create a new app — name it something like `altus-backend`.
3. Go to **Account Settings → API Key** → copy your API key. You will need this in Step 4.

---

## Step 2 — Add Heroku Postgres

This is where your production database lives. You are not installing Postgres — Heroku runs it for you.

1. In your Heroku app dashboard → **Resources** tab → **Add-ons**
2. In the search box type `Heroku Postgres`
3. Select it → choose the **Mini** plan (free with Student Pack credits) → click **Submit Order Form**
4. Heroku will provision a PostgreSQL database. Wait a few seconds for it to appear under Add-ons.
5. Click on the **Heroku Postgres** add-on to open it
6. Go to **Settings → Database Credentials → View Credentials**
7. You will see: `Host`, `Database`, `User`, `Password`, `Port`. Keep this page open — you need these values in Step 7.

---

## Step 3 — Add the `engines` field to package.json

In `package.json`, add an `engines` field at the top level (alongside `name`, `version`, etc.):

```json
"engines": {
  "node": "22.x"
}
```

This tells Heroku exactly which Node version to use. Without it, Heroku picks a default that may not match your local environment.

Heroku's Node.js buildpack automatically runs `npm run build` after `npm ci` if a `build` script exists — which yours does. No extra configuration needed.

---

## Step 4 — Add Heroku API Key to GitHub Secrets

GitHub Secrets store sensitive values so they are never written in plain text inside your workflow file.

1. Go to your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**
2. Name: `HEROKU_API_KEY`
3. Value: paste the API key from Step 1
4. Click **Add secret**

In the workflow file you reference it as `${{ secrets.HEROKU_API_KEY }}` — GitHub injects the value at runtime. The actual key is never visible in logs or code.

---

## Step 5 — Create a `Procfile`

Create a file named `Procfile` (no extension) in the project root.

It contains two lines:

```
release: npm run migrate
web: npm start
```

| Line | What it does |
|---|---|
| `release:` | Runs automatically before the app starts on every deployment. Runs all migrations against the production database. Safe to re-run because all migration files use `CREATE TABLE IF NOT EXISTS`. |
| `web:` | Tells Heroku this is a web process (it will receive HTTP traffic). `npm start` maps to `node dist/index.js` from your `scripts` in `package.json`. |

---

## Step 6 — Add the deploy job to ci.yml

Add a third job to `.github/workflows/ci.yml`:

```yaml
  deploy:
    runs-on: ubuntu-latest
    needs: [lint, typecheck]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Deploy to Heroku
        env:
          HEROKU_API_KEY: ${{ secrets.HEROKU_API_KEY }}
          HEROKU_APP_NAME: altus-backend
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

**Keywords used here that are new:**

| Keyword | What it does |
|---|---|
| `needs: [lint, typecheck]` | The deploy job only runs after both CI jobs pass. If lint or typecheck fails, no deploy happens. |
| `if: github.ref == 'refs/heads/main'` | Only deploy when pushing to `main`. Feature branch pushes run CI but never deploy. |
| `fetch-depth: 0` | Checks out the full git history. Heroku rejects shallow clones — this ensures the full history is pushed. |
| `~/.netrc` | A standard Unix credential file that git reads automatically. We write the Heroku API key here so git can authenticate when pushing to Heroku's remote. No third-party action needed. |

---

## Step 7 — Set environment variables on Heroku

Your `.env` file is in `.gitignore` — it never reaches Heroku. You enter each variable manually in the dashboard.

Go to your Heroku app → **Settings → Config Vars → Reveal Config Vars** and add each row:

| Variable | Where to get the value |
|---|---|
| `NODE_ENV` | Type `production` |
| `JWT_SECRET` | Make up a long random string — e.g. `altus-super-secret-2025` |
| `DB_HOST` | Copy `Host` from Step 2 credentials |
| `DB_PORT` | Copy `Port` from Step 2 credentials (usually `5432`) |
| `DB_NAME` | Copy `Database` from Step 2 credentials |
| `DB_USER` | Copy `User` from Step 2 credentials |
| `DB_PASSWORD` | Copy `Password` from Step 2 credentials |
| `ADMIN_EMAIL` | The email for your seeded admin user |
| `ADMIN_PASSWORD` | The password for your seeded admin user |

> Note: Heroku automatically sets `PORT` for you — do not add it manually.

---

## Step 8 — First deploy (creates tables via migrations)

This is the first time your code reaches Heroku. When GitHub Actions runs the deploy job, Heroku will:
1. Pull your code
2. Run `npm ci` and `npm run build`
3. Run the `release:` line from your Procfile — `npm run migrate` — which creates all tables
4. Start the app with `npm start`

**To trigger the first deploy:**
1. Create a pull request from `dev` into `main` on GitHub
2. Merge it
3. Watch the **Actions** tab on GitHub — you should see three jobs: `lint`, `typecheck`, `deploy`
4. `deploy` only starts after the other two turn green
5. Wait for all three to show a green checkmark

The migrations run automatically as part of the deploy — you do not need to run them manually. All tables (`users`, `exercises`, `exercise_difficulties`, `workout_sessions`, `achievements`, `user_achievements`) will exist in the Heroku Postgres database once the deploy job finishes.

---

## Step 9 — Seed the production database (one-time)

**Do this only after Step 8 completes** — the tables must exist before seeding.

This step requires the **Heroku CLI** installed on your machine. Search for "Heroku CLI" and download the installer for your OS from the official Heroku Dev Center. After installing, log in once:

```
heroku login
```

Then run the seed command:

```
heroku run npm run seed:prod --app altus-backend
```

`heroku run` opens a temporary one-off dyno, runs the command against the live production database, then closes. All seed inserts use `ON CONFLICT DO NOTHING` so it is safe to run again without duplicating data.

You only need to do this once. Migrations run automatically on every future deploy (via the `release:` Procfile line). Seeding is a one-time setup for reference data like exercises, difficulties, and achievements.

---

## Step 10 — Verify

After Steps 8 and 9 complete:

1. Visit `https://api.altus.games/health`
2. Expected response: `{ "status": "ok" }`

If you see that response, your app is live, the database is connected, and the seed data is in place.

---

## The full picture — what happens on every push

```
Push to feature branch
  ├── lint        ✓ or ✗
  └── typecheck   ✓ or ✗
  (no deploy)

Push/merge to main
  ├── lint        ✓ or ✗
  ├── typecheck   ✓ or ✗
  └── deploy      only runs if both above pass
        ├── release: npm run migrate  (runs before app starts)
        └── web: npm start            (app goes live)
```

**Rule:** Never push broken code to `main`. The `needs:` keyword enforces this automatically — a failing CI job cancels the deploy job before it starts.
