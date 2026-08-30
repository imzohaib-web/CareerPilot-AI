# CareerPilot AI — API Specification

> STATUS: PLANNED — these endpoints are documented, NOT implemented. No feature implementation in this task.

Base path: `/api`. All responses are JSON. Protected endpoints require `Authorization: Bearer <JWT>`.

## AUTH

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| POST | /api/auth/register | IMPLEMENTED | Create account (email, password) |
| POST | /api/auth/login | IMPLEMENTED | Authenticate, return JWT |
| GET | /api/auth/me | IMPLEMENTED | Current user from token |

## PROFILE

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| POST | /api/profile | IMPLEMENTED | Create career profile |
| GET | /api/profile | IMPLEMENTED | Read career profile |
| PUT | /api/profile | IMPLEMENTED | Update career profile |

## RESUME

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| POST | /api/resume/upload | PLANNED | Upload resume (validated PDF/text) |
| POST | /api/resume/analyze | PLANNED | Run AI resume analysis |

## CAREER

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| POST | /api/career/skill-gap | PLANNED | Compute skill gap vs target role |
| POST | /api/career/roadmap | PLANNED | Generate personalized roadmap |

## CHAT

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| POST | /api/chat/message | PLANNED | Send message to Career Mentor |

## INTERVIEW

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| POST | /api/interview/start | PLANNED | Start a mock interview |
| POST | /api/interview/answer | PLANNED | Submit an answer |
| GET | /api/interview/result | PLANNED | Fetch interview feedback |

## PROGRESS

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | /api/progress/dashboard | PLANNED | Dashboard summary |
| PUT | /api/progress/update | PLANNED | Update task completion |

## AI TEST

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| POST | /api/ai/test | IMPLEMENTED | Verify Qwen connectivity |

## Cross-Cutting Conventions

- Authentication is required for all non-auth endpoints.
- Resource access is authorized by the authenticated user's ID (never trust client-provided user IDs).
- Request bodies are validated with Pydantic schemas.
- Errors use a consistent JSON shape; no stack traces in production.
