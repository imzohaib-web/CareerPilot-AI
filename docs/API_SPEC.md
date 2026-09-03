# CareerPilot AI — API Specification

> STATUS: All endpoints below are IMPLEMENTED on `main`. AI-backed endpoints call Alibaba Cloud Model Studio / Qwen through the backend only.

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
| POST | /api/resume/analyze | IMPLEMENTED | Upload PDF + AI analysis (combined upload/analyze) |
| GET | /api/resume/latest | IMPLEMENTED | Fetch most recent analysis for authenticated user |

## SKILL GAP

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| POST | /api/analyze-gap | IMPLEMENTED | Compute skill gap vs target role (AI) |
| GET | /api/analyze-gap/latest | IMPLEMENTED | Fetch most recent skill-gap analysis |

## ROADMAP

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| POST | /api/roadmap/generate | IMPLEMENTED | Generate personalized roadmap from skill gaps (AI) |
| GET | /api/roadmap/latest | IMPLEMENTED | Fetch the user's latest roadmap |
| PUT | /api/roadmap/{roadmap_id}/tasks/{task_id}/toggle | IMPLEMENTED | Toggle a roadmap task's completion |

## CAREER MENTOR (CHAT)

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| POST | /api/chat/message | IMPLEMENTED | Send message to Career Mentor (grounded in profile + latest resume analysis; persists the turn) |
| GET | /api/chat/history | IMPLEMENTED | Fetch the user's mentor conversation (latest when no `conversation_id` query param is given) |

## MOCK INTERVIEW

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| POST | /api/interview/start | IMPLEMENTED | Start a mock interview (AI generates role-specific questions) |
| POST | /api/interview/{interview_id}/submit | IMPLEMENTED | Submit answers and receive scored feedback (AI) |
| GET | /api/interview/{interview_id} | IMPLEMENTED | Fetch a specific interview with feedback |
| GET | /api/interview/latest | IMPLEMENTED | Fetch the user's most recent interview |

## RAG & KNOWLEDGE BASE

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| POST | /api/rag/documents/upload | IMPLEMENTED | Ingest a document (chunked into the knowledge base) |
| GET | /api/rag/documents | IMPLEMENTED | List the user's ingested documents |
| DELETE | /api/rag/documents/{document_id} | IMPLEMENTED | Delete a document and its chunks |
| POST | /api/rag/query | IMPLEMENTED | Retrieve relevant chunks for a query |
| POST | /api/rag/chat | IMPLEMENTED | Chat grounded in the user's knowledge base (AI) |

## PROGRESS

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | /api/progress | IMPLEMENTED | Dashboard summary (profile, resume, roadmap, interview status) |

## SYSTEM

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | /api/health | IMPLEMENTED | Report API health and MongoDB connectivity |
| POST | /api/ai/test | IMPLEMENTED | Verify Qwen connectivity |

## Cross-Cutting Conventions

- Authentication is required for all non-auth endpoints.
- Resource access is authorized by the authenticated user's ID (never trust client-provided user IDs).
- Request bodies are validated with Pydantic schemas.
- Errors use a consistent JSON shape; no stack traces in production.
