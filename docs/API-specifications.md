# MoveVerse — Backend API Specifications

This document defines all HTTP endpoints exposed by the MoveVerse backend, structured around the user journey.

**Base URL (local):** `http://localhost:5600/api/v1`
**Base URL (production):** `https://moveverse-api.railway.app/api/v1`

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript |
| Backend | Node.js + Express.js |
| Database | PostgreSQL |
| Authentication | JWT / Google OAuth 2.0 |
| Pose Detection | MediaPipe (frontend only) |
| Camera Access | getUserMedia (frontend only) |

---

## User Journey

```
Visitor arrives
  └─ Can view leaderboard (public)
  └─ Clicks "Play" → redirected to register or login

Register or Login
  └─ Email + password  →  POST /auth/register  or  POST /auth/login
  └─ Google Sign-In   →  POST /auth/google
  └─ Both return a JWT

Authenticated user
  └─ GET /exercises → choose exercise
  └─ GET /exercises/:id/difficulties → choose difficulty
  └─ Plays game (MediaPipe tracks reps on frontend)
  └─ POST /workout_sessions → save score
  └─ Achievements checked automatically after save

Profile page
  └─ GET /users/me → own profile
  └─ GET /workout_sessions/me → exercise history
  └─ GET /users/me/achievements → unlocked achievements
  └─ GET /users/me/stats → summary statistics

Leaderboard (public)
  └─ GET /leaderboard → top 50 global
  └─ GET /leaderboard/:exerciseName → top 50 per exercise
  └─ GET /leaderboard/me/rank → own rank (auth required)
```

---

## Authentication

After registering or logging in, the server returns a signed JWT. The frontend stores it and sends it with every protected request.

### Protected Request Header

```
Authorization: Bearer <token>
```

---

## Standard Error Response

All errors return JSON in this shape:

```json
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE"
}
```

| HTTP Status | Meaning |
|---|---|
| `400` | Bad request — missing or invalid fields |
| `401` | Unauthorized — missing or invalid JWT |
| `403` | Forbidden — authenticated but not permitted |
| `404` | Resource not found |
| `409` | Conflict — e.g. email already registered |
| `500` | Internal server error |

---

## Authentication API

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| POST | `/auth/register` | No | Create account (email + password) |
| POST | `/auth/login` | No | Login (email + password) |
| POST | `/auth/google` | No | Login or register via Google OAuth |
| POST | `/auth/logout` | Yes 🔒 | Invalidate current session |

---

### POST `/auth/register`

Creates a new account. Returns a JWT immediately — no separate login step needed.

**Request Body**

| Field | Type | Required | Validation |
|---|---|---|---|
| username | string | Yes | Unique, max 50 characters |
| email | string | Yes | Valid email, unique |
| password | string | Yes | Minimum 8 characters |

**Request Example**
```json
{
  "username": "player1",
  "email": "player@example.com",
  "password": "password123"
}
```

**Response — `201 Created`**
```json
{
  "message": "Account created successfully",
  "token": "<jwt_token>",
  "user": {
    "id": "uuid",
    "username": "player1",
    "role": "user"
  }
}
```

**Errors:** `400` invalid or missing fields — `409` email already registered

---

### POST `/auth/login`

**Request Body**

| Field | Type | Required |
|---|---|---|
| email | string | Yes |
| password | string | Yes |

**Request Example**
```json
{
  "email": "player@example.com",
  "password": "password123"
}
```

**Response — `200 OK`**
```json
{
  "token": "<jwt_token>",
  "user": {
    "id": "uuid",
    "username": "player1",
    "role": "user"
  }
}
```

**Errors:** `400` missing fields — `401` invalid credentials — `401` account uses Google Sign-In (wrong auth method)

---

### POST `/auth/google`

The frontend obtains a Google ID token using the Google Sign-In button. It sends that token here — the backend verifies it with Google's API and either creates a new account or logs in the existing one.

**Request Body**

| Field | Type | Required |
|---|---|---|
| idToken | string | Yes |

**Request Example**
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsInR5..."
}
```

**Response — `200 OK` (existing user) or `201 Created` (new user)**
```json
{
  "token": "<jwt_token>",
  "user": {
    "id": "uuid",
    "username": "player1",
    "role": "user"
  }
}
```

**Errors:** `400` missing idToken — `401` invalid Google token (verification with Google API failed) — `409` email already registered with email/password — `500` internal server error

---

### POST `/auth/logout`

🔒 Requires valid JWT. No request body required. The frontend discards the token after this call.

**Response — `200 OK`**
```json
{
  "message": "Logged out successfully"
}
```

---

## Exercises API

Exercises are loaded after the user logs in. A visitor cannot access this endpoint — clicking "Play" redirects them to register or login first.

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| GET | `/exercises` | Yes 🔒 | Fetch all active exercises |
| GET | `/exercises/:id/difficulties` | Yes 🔒 | Fetch difficulty presets for one exercise |

---

### GET `/exercises`

🔒 Requires valid JWT. Returns all exercises where `is_active = true`.

The frontend stores this list in React state. The `id` from each exercise is used when fetching difficulty presets.

**Response — `200 OK`**
```json
[
  {
    "id": "uuid",
    "name": "Squats",
    "description": "Standard squat exercise",
    "caloriesPerRep": 0.32
  },
  {
    "id": "uuid",
    "name": "Pushups",
    "description": "Standard push-up exercise",
    "caloriesPerRep": 0.28
  }
]
```

---

### GET `/exercises/:id/difficulties`

🔒 Requires valid JWT. Returns all difficulty presets for a specific exercise.

The frontend stores the selected difficulty's `id` as `exerciseDifficultyId` — this UUID is required when posting a completed workout session.

**Response — `200 OK`**
```json
[
  {
    "id": "uuid",
    "levelName": "Easy",
    "targetReps": 5,
    "scoreMultiplier": 1.0
  },
  {
    "id": "uuid",
    "levelName": "Medium",
    "targetReps": 10,
    "scoreMultiplier": 1.5
  },
  {
    "id": "uuid",
    "levelName": "Hard",
    "targetReps": 20,
    "scoreMultiplier": 2.0
  }
]
```

**Errors:** `404` exercise not found

---

## Workout Sessions API

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| POST | `/workout_sessions` | Yes 🔒 | Save a completed workout session |
| GET | `/workout_sessions/me` | Yes 🔒 | Retrieve the authenticated user's session history |

---

### POST `/workout_sessions`

🔒 Requires valid JWT. The `user_id` is taken from the JWT — never send it in the request body.

**How score is calculated:** The backend computes `score` as `repsCompleted × scoreMultiplier` from the difficulty preset. The frontend does not calculate or send the score.

**How calories are calculated:** The backend computes `caloriesBurned` as `repsCompleted × caloriesPerRep` from the exercise record.

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| exerciseDifficultyId | UUID | Yes | ID of the selected difficulty preset |
| repsCompleted | integer | Yes | Number of valid repetitions completed |
| durationSeconds | integer | Yes | Session duration in seconds |

**Request Example**
```json
{
  "exerciseDifficultyId": "3f7a1b2c-...",
  "repsCompleted": 15,
  "durationSeconds": 60
}
```

**Response — `201 Created`**
```json
{
  "id": "uuid",
  "score": 630,
  "caloriesBurned": 13.44,
  "completedAt": "2025-06-01T10:30:00.000Z"
}
```

**Errors:** `400` missing or invalid fields — `404` exercise difficulty not found

> After saving, the backend checks whether the user has unlocked any new achievements. This happens automatically — no separate API call is needed from the frontend.

---

### GET `/workout_sessions/me`

🔒 Requires valid JWT. Returns the authenticated user's full workout history.

**Response — `200 OK`**
```json
[
  {
    "id": "uuid",
    "exercise": "Squats",
    "difficulty": "Medium",
    "repsCompleted": 15,
    "score": 630,
    "durationSeconds": 60,
    "caloriesBurned": 13.44,
    "completedAt": "2025-06-01T10:30:00.000Z"
  }
]
```

---

## Users API

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| GET | `/users/:id` | No | Fetch a user's public profile |
| GET | `/users/me` | Yes 🔒 | Fetch the authenticated user's full profile |
| PUT | `/users/me` | Yes 🔒 | Update the authenticated user's profile |
| GET | `/users/me/stats` | Yes 🔒 | Fetch the authenticated user's workout statistics |
| GET | `/users/me/achievements` | Yes 🔒 | Fetch the authenticated user's unlocked achievements |

---

### GET `/users/:id`

Public profile. Safe to display to anyone.

**Response — `200 OK`**
```json
{
  "id": "uuid",
  "username": "player1",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

**Errors:** `404` user not found

---

### GET `/users/me`

🔒 Requires valid JWT. Returns the full profile for the logged-in user.

**Response — `200 OK`**
```json
{
  "id": "uuid",
  "username": "player1",
  "email": "player@example.com",
  "role": "user",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

---

### PUT `/users/me`

🔒 Requires valid JWT. All fields are optional — only send what is changing.

**Request Body**

| Field | Type | Validation |
|---|---|---|
| username | string | Max 50 characters, unique |

**Response — `200 OK`**
```json
{
  "message": "Profile updated successfully"
}
```

**Errors:** `400` invalid fields — `409` username already taken

---

### GET `/users/me/stats`

🔒 Requires valid JWT. Returns the authenticated user's workout statistics, calculated live from the `workout_sessions` table.

**Response — `200 OK`**
```json
{
  "totalSessions": 42,
  "totalReps": 1250,
  "totalCaloriesBurned": 380.50,
  "bestScore": 980,
  "mostPlayedExercise": "Squats"
}
```

---

### GET `/users/me/achievements`

🔒 Requires valid JWT. Returns all achievements unlocked by the authenticated user.

**Response — `200 OK`**
```json
[
  {
    "id": "uuid",
    "name": "First Rep",
    "description": "Complete your first workout session",
    "badgeImage": "https://...",
    "unlockedAt": "2025-06-01T10:30:00.000Z"
  }
]
```

---

## Leaderboard API

The leaderboard is public — no login required to view it.

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| GET | `/leaderboard` | No | Top 50 scores across all exercises |
| GET | `/leaderboard/:exerciseName` | No | Top 50 scores for a specific exercise |
| GET | `/leaderboard/me/rank` | Yes 🔒 | Authenticated user's global ranking |

---

### GET `/leaderboard`

**Response — `200 OK`**
```json
[
  {
    "rank": 1,
    "username": "player1",
    "score": 1250,
    "exercise": "Squats",
    "completedAt": "2025-06-01T10:30:00.000Z"
  },
  {
    "rank": 2,
    "username": "player2",
    "score": 1180,
    "exercise": "Pushups",
    "completedAt": "2025-06-01T09:15:00.000Z"
  }
]
```

---

### GET `/leaderboard/:exerciseName`

Filters top 50 by exercise name (e.g. `/leaderboard/Squats`).

**Response — `200 OK`** — same shape as above, filtered to one exercise.

**Errors:** `404` exercise name not recognised

---

### GET `/leaderboard/me/rank`

🔒 Requires valid JWT.

**Response — `200 OK`**
```json
{
  "rank": 14,
  "totalPlayers": 203,
  "bestScore": 630
}
```
