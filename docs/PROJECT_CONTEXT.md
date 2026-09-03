# CareerPilot AI — Project Context (for AI sessions)

> Keep this file short and current. Update it at the end of each development day.

## What this is

CareerPilot AI — an AI career-readiness platform for students: resume analysis, skill-gap detection, personalized roadmap, AI career mentor, mock interview, and progress tracking. Built for the Alibaba Cloud AI Hackathon Pakistan 2026 (theme: *AI for Pakistan's Future*).

## Architecture (locked)

- Frontend: React 19 + TypeScript + Vite + Tailwind (`frontend/`)
- Backend: Python + FastAPI (`backend/app/`) — the ONLY backend
- Database: MongoDB (Motor)
- AI: Alibaba Cloud Model Studio / Qwen, accessed ONLY via `backend/app/services/ai`
- Flow: Frontend → FastAPI route → Pydantic schema → Service → DB / AI service
- AI outputs are validated before storage/display; keys never reach the frontend

## Build window

29 August – 4 September 2026 (7 days). See `docs/DEVELOPMENT_PLAN.md`.

## Current development day

Day 6 — 3 September 2026 (full integration on `main`)

## Completed work

- Repository audit + architecture decision (Python + FastAPI)
- Full documentation/context system (`docs/`)
- Qoder rules + 5 Agent Skill contracts
- Backend & frontend scaffolds on `dev` branch
- Day 1 backend foundation: CORS, Motor MongoDB lifecycle, routers `/api/auth`, `/api/profile`, `/api/ai`
- Authentication: bcrypt hashing (passlib removed), JWT (python-jose), register/login/me
- Career Profile: GET/POST/PUT on `career_profiles`, per-user isolation via JWT
- Qwen connectivity: `services/ai/qwen_service.py` (Alibaba Cloud Model Studio OpenAI-compatible workspace endpoint) + `POST /api/ai/test` — live-verified with model `qwen3.7-plus`
- Frontend: axios API client + interceptors, AuthContext, Login/Register/Profile/AI-Test pages, protected routes — full browser E2E passed (8/8)
- Day 2 Resume Analyzer: PDF upload + validation (extension, magic bytes, size, PyMuPDF extraction), structured Qwen analysis with retry, Pydantic validation, MongoDB persistence, full results UI — 31 backend tests pass, frontend tsc/lint/build clean, 35/35 live E2E checks pass
- Progress Dashboard: `GET /api/progress` aggregation service + frontend page (profile/resume status, readiness score, next steps)
- Day 4 AI Career Mentor backend: `POST /api/chat/message` + `GET /api/chat/history`, mentor grounded in career profile + latest resume analysis, bounded conversation history (16 turns / 24k chars), `conversations` collection with `user_id` index, multi-turn `qwen_service.chat(history=...)`, reply validation — 49 new tests (113 total pass), live Qwen smoke test passed with conversation continuity verified
- Day 4 AI Career Mentor frontend: `/mentor` page with markdown rendering, starter prompts, persistence across reloads, loading/error/empty states — full E2E verification passed
- Day 5 modules (implemented on `dev` lineage, merged to `main`): Skill Gap Analyzer (`/api/analyze-gap`), Roadmap Generator (`/api/roadmap` with task toggle), AI Mock Interview (`/api/interview` with AI-scored feedback), RAG Knowledge Base (`/api/rag` with chunked ingestion + grounded chat) — backend + frontend for each
- Day 6: `feature/career-mentor` merged into `main`; all six MVP modules integrated — 143 backend tests pass, frontend lint/build clean (see `docs/API_SPEC.md`)

## Current task

Integration complete. All six MVP modules live on `main` (see `docs/API_SPEC.md`).

## Key decisions

- Single FastAPI backend (no Node backend, no microservices)
- Qwen only through backend; outputs validated
- bcrypt used directly (passlib 1.7.4 incompatible with bcrypt 5)
- Qwen via Alibaba Cloud Model Studio OpenAI-compatible endpoint; model/base URL env-configurable (`ALIBABA_CLOUD_MODEL`, `ALIBABA_CLOUD_BASE_URL`)
- `backend/.env` is loaded by absolute path so the backend starts from any working directory
- RAG Knowledge Base shipped as an MVP module; MCP remains post-MVP
- Cut order under pressure: BONUS → SHOULD HAVE → never MUST HAVE
- Career Mentor: one conversation document per user turn flow in `conversations` (multiple allowed); `conversation_id` is optional — omitting it continues the most recent conversation; ownership always resolved from the JWT; mentor grounding uses profile + latest resume analysis only (never fabricated)

## Known issues

- None blocking. E2E screenshot artifacts were removed during integration. 9 cosmetic `set-state-in-effect` lint warnings remain codebase-wide (no errors).

## Next task

Final UI/UX polish and demo preparation (see `docs/DEMO_FLOW.md`).

## Team

- Member 1: Frontend / Full Stack
- Member 2: Backend / AI

## Repo & branches

- https://github.com/imzohaib-web/CareerPilot-AI
- `main` → release; `dev` → integration; `feature/*` → work branches
