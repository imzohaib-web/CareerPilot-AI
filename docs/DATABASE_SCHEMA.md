# CareerPilot AI — Database Schema

> MongoDB collections are created by the application as features are used. Documents are scoped to `user_id`.

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

### learning_assessments
| Field | Type | Notes |
|-------|------|-------|
| user_id | ObjectId | Owner from authenticated JWT |
| roadmap_id | ObjectId | Roadmap containing the assessed task |
| task_id | string | Task identifier |
| skill | string | Skill being assessed |
| questions | object[] | Questions and server-only answer key |
| status | string | `in_progress` or `completed` |
| score / passed | int / bool | Server-calculated score and 70% pass result |
| completed_at | datetime | Submission time |

### verified_skills
| Field | Type | Notes |
|-------|------|-------|
| user_id | ObjectId | Owner from authenticated JWT |
| skill_key | string | Case-insensitive per-user unique key |
| name | string | Roadmap skill passed by the user |
| score | int | Passing assessment score (70–100) |
| verified_at | datetime | Latest successful verification |

### learning_alerts
| Field | Type | Notes |
|-------|------|-------|
| user_id | ObjectId | Owner from authenticated JWT |
| title / message | string | Assessment outcome notification |
| category | string | `skill_verified` or `assessment_retry` |
| is_read | bool | In-app read state |
| email_status | string | SMTP result or `not_configured` |
| created_at | datetime | Alert timestamp |

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
- Learning collections are indexed by `user_id`; verified skills are unique by user and normalized skill name.
