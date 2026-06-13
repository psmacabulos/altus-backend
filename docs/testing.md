# MoveVerse Backend — Testing Guide

A record of manual API tests organised by phase. Each section covers one feature area and lists the curl commands needed to verify it works correctly — including both the happy path and expected error cases.

---

## How to read a curl command

```bash
curl -i -X POST http://localhost:5600/api/v1/auth/register \
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
- **Unit test** — tests one function in isolation, no database or HTTP. MoveVerse does not have unit tests yet — that is a future phase.

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

Tests for `POST /api/v1/auth/register` and `POST /api/v1/auth/login`.

---

### 1.1 Register — happy path

**What it tests:** A new visitor creates an account successfully.  
**Expected status:** `201 Created`  
**Expected body:** `{ token, user }` — user contains id, username, email, google_id, role, created_at, updated_at

```bash
curl -i -X POST http://localhost:5600/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"player1","email":"player1@test.com","password":"password123"}'
```

---

### 1.2 Register — duplicate email

**What it tests:** A visitor tries to register with an email already in the database.  
**Expected status:** `409 Conflict`  
**Expected body:** `{ "error": "Email already registered" }`

```bash
curl -i -X POST http://localhost:5600/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"player99","email":"player1@test.com","password":"password123"}'
```

---

### 1.3 Register — duplicate username

**What it tests:** A visitor tries to register with a username already taken.  
**Expected status:** `409 Conflict`  
**Expected body:** `{ "error": "Username already registered" }`

```bash
curl -i -X POST http://localhost:5600/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"player1","email":"player99@test.com","password":"password123"}'
```

---

### 1.4 Login — happy path

**What it tests:** A registered user logs in with correct credentials.  
**Expected status:** `200 OK`  
**Expected body:** `{ token, user }`

```bash
curl -i -X POST http://localhost:5600/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"player1@test.com","password":"password123"}'
```

---

### 1.5 Login — wrong password

**What it tests:** A user enters the correct email but wrong password.  
**Expected status:** `401 Unauthorized`  
**Expected body:** `{ "error": "Invalid credentials" }`

```bash
curl -i -X POST http://localhost:5600/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"player1@test.com","password":"wrongpassword"}'
```

---

### 1.6 Login — email not registered

**What it tests:** A user tries to log in with an email that does not exist in the database.  
**Expected status:** `401 Unauthorized`  
**Expected body:** `{ "error": "Invalid credentials" }`

```bash
curl -i -X POST http://localhost:5600/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nobody@test.com","password":"password123"}'
```

> Note: Both wrong password and unknown email return `401` with the same message `"Invalid credentials"`. This is intentional — telling the user *which* one was wrong (email or password) helps attackers enumerate valid accounts.
