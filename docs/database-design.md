#  Altus Database Design and ERD

## 📖 Overview

This document defines the PostgreSQL database schema and entity relationships used by Altus.

Altus uses a relational database architecture to support:

- User authentication
- Workout history tracking
- Analytics
- Achievement systems
- Dynamic leaderboards
- Future scalability

---

# 🛢️ Database Type

- PostgreSQL
- Relational Database Management System (RDBMS)

---

# 📋 Database Tables

## users

| Column | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key |
| username | VARCHAR(50) | NOT NULL |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| password_hash | TEXT | Nullable for Google OAuth users |
| google_id | TEXT | Nullable for email/password users |
| role | ENUM | Default: `user` |
| created_at | TIMESTAMP | NOT NULL |
| updated_at | TIMESTAMP | NOT NULL |

### Constraint Note

At least one authentication method must exist:

- `password_hash`
- `google_id`

This rule is enforced using a PostgreSQL CHECK constraint.

---

## exercises

| Column | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key |
| name | VARCHAR(100) | UNIQUE, NOT NULL |
| description | TEXT | Nullable |
| calories_per_rep | DECIMAL(5,2) | NOT NULL |
| is_active | BOOLEAN | Default: TRUE |
| created_at | TIMESTAMP | NOT NULL |

---

## exercise_difficulties

| Column | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key |
| exercise_id | UUID | Foreign Key |
| level_name | ENUM | NOT NULL |
| target_reps | INTEGER | NOT NULL |
| score_multiplier | DECIMAL(5,2) | NOT NULL |

### Design Decision

Altus uses exercise-specific difficulty presets instead of global difficulty settings.

Example:

- Squat Easy = 5 reps
- Push-up Easy = 3 reps

This design improves scalability and exercise balancing.

---

## workout_sessions

| Column | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key |
| user_id | UUID | Foreign Key |
| exercise_difficulty_id | UUID | Foreign Key |
| reps_completed | INTEGER | NOT NULL |
| score | INTEGER | NOT NULL |
| duration_seconds | INTEGER | NOT NULL |
| calories_burned | DECIMAL(5,2) | Nullable |
| completed_at | TIMESTAMP | NOT NULL |

---

## achievements

| Column | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key |
| name | VARCHAR(100) | NOT NULL |
| description | TEXT | Nullable |
| badge_image | TEXT | Nullable |
| requirement_type | VARCHAR(100) | NOT NULL |
| requirement_value | INTEGER | NOT NULL |

### requirement_type Values

| Value | What it measures |
|---|---|
| `session_count` | Total number of completed workout sessions |
| `total_reps` | Cumulative reps across all sessions |
| `total_score` | Cumulative score across all sessions |
| `total_calories` | Cumulative calories burned across all sessions |

### Seed Data

| name | description | requirement_type | requirement_value |
|---|---|---|---|
| First Workout | Complete your first workout session | session_count | 1 |
| First Steps | Log 10 total reps | total_reps | 10 |
| Getting Started | Complete 5 workout sessions | session_count | 5 |
| On a Roll | Complete 10 workout sessions | session_count | 10 |
| Dedicated | Complete 25 workout sessions | session_count | 25 |
| Unstoppable | Complete 50 workout sessions | session_count | 50 |
| Century | Log 100 total reps | total_reps | 100 |
| Rep Machine | Log 500 total reps | total_reps | 500 |
| Beast Mode | Log 1,000 total reps | total_reps | 1000 |
| Point Scorer | Earn 1,000 total score | total_score | 1000 |
| High Achiever | Earn 10,000 total score | total_score | 10000 |
| Calorie Burner | Burn 500 total calories | total_calories | 500 |
| Inferno | Burn 2,000 total calories | total_calories | 2000 |

---

## user_achievements

| Column | Type | Constraints |
|---|---|---|
| user_id | UUID | Foreign Key |
| achievement_id | UUID | Foreign Key |
| unlocked_at | TIMESTAMP | NOT NULL |

### Composite Primary Key

```sql
PRIMARY KEY (user_id, achievement_id)
```

---

# 🧭 Entity Relationship Diagram (ERD)

![Altus ERD Diagram](./images/ERD.md.png)

---

# 📌 Key Architectural Decisions

| Decision | Justification |
|---|---|
| PostgreSQL instead of MongoDB | Strong relational modeling |
| UUID-based primary keys | Better scalability and security |
| Exercise-specific difficulties | Flexible exercise balancing |
| Dynamic leaderboard aggregation | Avoids redundant data storage |
| CHECK constraints for authentication | Prevents invalid authentication states |

