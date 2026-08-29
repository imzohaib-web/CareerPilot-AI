# CareerPilot AI — Database Schema (Planned)

> STATUS: PLANNED — documentation only. No application models or production data are created yet.

Database: **MongoDB** (accessed via Motor async driver). All documents are scoped to a `user_id` for ownership and authorization.

## Collections

### users
| Field | Type | Notes |
|-------|------|-------|
| _id | ObjectId | PK |
| email | string | unique, indexed |
| password_hash | string | bcrypt, never plaintext |
| name | string | |
| created_at | datetime | |

### career_profiles
| Field | Type | Notes |
|-------|------|-------|
| user_id | ObjectId | FK → users |
| education | string | |
| experience_level | string | enum: student/fresh/early-career |
| skills | string[] | self-reported baseline |
| interests | string[] | |
| career_preferences | object | remote/location/industry |

### resumes
| Field | Type | Notes |
|-------|------|-------|
| user_id | ObjectId | FK → users |
| filename | string | |
| stored_path | string | server-side path |
| extracted_text | string | |
| uploaded_at | datetime | |

### skill_profiles
| Field | Type | Notes |
|-------|------|-------|
| user_id | ObjectId | FK → users |
| target_role | string | |
| extracted_skills | string[] | from resume |
| gaps | object[] | {skill, status, priority, reason} |
| analyzed_at | datetime | |

### roadmaps
| Field | Type | Notes |
|-------|------|-------|
| user_id | ObjectId | FK → users |
| goal | string | |
| phases | object[] | {name, duration_weeks, tasks[]} |
| created_at | datetime | |

### interviews
| Field | Type | Notes |
|-------|------|-------|
| user_id | ObjectId | FK → users |
| target_role | string | |
| questions | object[] | |
| answers | object[] | |
| feedback | object[] | {score, strengths[], improvements[]} |
| started_at / completed_at | datetime | |

### progress
| Field | Type | Notes |
|-------|------|-------|
| user_id | ObjectId | FK → users |
| completed_tasks | string[] | roadmap task ids |
| readiness_score | int | latest resume score 0–100 |
| last_updated | datetime | |

### conversations
| Field | Type | Notes |
|-------|------|-------|
| user_id | ObjectId | FK → users |
| messages | object[] | {role, content, ts} |
| updated_at | datetime | keep only needed context |

## Relationships

- `users` is the root; every other collection references `user_id`.
- One active `skill_profile`, `roadmap`, and `progress` per user; multiple `resumes`, `interviews`, and `conversations` allowed.

## Rules

- Do NOT create production data or dummy records.
- Do NOT implement models in this task (they don't exist yet).
- Index `users.email` (unique) and `user_id` on every collection.
