# Errors Encountered

A running log of real errors hit during development, what caused them, and how they were fixed.

---

## 1. TSError: Cannot find module 'fs' / 'path' / '__dirname'

**When:** Running `npm run migrate` inside Docker.

**Error:**
```
TSError: ⨯ Unable to compile TypeScript:
src/db/migrate.ts: Cannot find name '__dirname'.
```

**Cause:** `tsconfig.json` was missing `"types": ["node"]` in `compilerOptions`. Without it, TypeScript does not know about Node.js built-in globals like `__dirname`, `fs`, and `path`.

**Fix:** Added to `tsconfig.json`:
```json
"types": ["node"]
```

---

## 2. Migration script defined but never called

**When:** Running `npm run migrate` — no output, nothing happened.

**Cause:** `runMigrations` was defined as a function but never called at the bottom of the file.

**Fix:** Added the call at the bottom of `migrate.ts`:
```typescript
runMigrations().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
```

---

## 3. Seed failed — wrong number of placeholders

**When:** Running `npm run seed` inside Docker.

**Error:**
```
error: bind message supplies 4 parameters, but prepared statement "" requires 3
```

**Cause:** The INSERT had 4 columns and 4 values but only `$1, $2, $3` as placeholders — missing `$4`.

**Fix:** Updated all affected queries to include `$4` in the VALUES clause.

---

## 4. Seed failed — ADMIN_EMAIL and ADMIN_PASSWORD not set

**When:** Running `npm run seed` after adding those variables to `.env`.

**Error:**
```
Seed failed: Error: ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env
```

**Cause:** Docker containers load environment variables at startup. Changing `.env` after a container is running has no effect — the container still has the old values.

**Fix:** Restart the containers to pick up the new `.env` values:
```
docker compose down && docker compose up -d
```

---

## 5. GitHub Actions deploy failed — heroku: not found

**When:** First deployment to Heroku via GitHub Actions using `akhileshns/heroku-deploy@v3.13.15`.

**Error:**
```
/bin/sh: 1: heroku: not found
Error: Error: Command failed: heroku create moveverse-backend
```

**Cause:** The `akhileshns/heroku-deploy` action is poorly maintained and fails to install the Heroku CLI on the GitHub Actions runner. It has 60+ open issues and multiple failure reports as of 2026.

**Fix:** Replaced the action entirely with a direct git push to Heroku using `.netrc` for authentication. No third-party action needed:
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

---

## 7. Heroku release phase failed — SSL required by Heroku Postgres

**When:** Deploy to Heroku — migrations started running then failed on first SQL file.

**Error:**
```
Migration failed: error: no pg_hba.conf entry for host "...", user "...", database "...", no encryption
```

**Cause:** Heroku Postgres requires SSL encrypted connections. The app was connecting without SSL, so the database server rejected the connection outright.

**Fix:** Added an `ssl` option to the Pool config in `src/config/db.ts`, conditionally enabled only in production because the local Docker Postgres does not use SSL:
```typescript
ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
```
`rejectUnauthorized: false` is required because Heroku Postgres uses a self-signed certificate, which Node rejects by default.

---

## 6. Heroku release phase failed — migrations folder not found

**When:** First successful deploy to Heroku — the release phase (`npm run migrate:prod`) crashed.

**Error:**
```
Migration failed: Error: ENOENT: no such file or directory, scandir '/app/dist/db/migrations'
```

**Cause:** `tsc` only compiles `.ts` files. The `.sql` migration files are never copied to `dist/`. So `dist/db/migrations/` does not exist. The migrate script was using `__dirname` which in the compiled file points to `dist/db/` — not where the SQL files are.

This worked locally because `npm run migrate` uses `ts-node` which runs from the source file, so `__dirname` pointed to `src/db/` where the SQL files exist. On Heroku, `npm run migrate:prod` runs the compiled JS where `__dirname` points to `dist/db/`.

**Fix:** Changed `migrate.ts` to use `process.cwd()` instead of `__dirname`:
```typescript
const migrationsFolder = path.join(process.cwd(), 'src', 'db', 'migrations');
```
`process.cwd()` always returns the project root (`/app` on Heroku, local project folder on your machine), from where `src/db/migrations/` is always reachable.
