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

Day 1 — 29 August 2026 (Foundation + architecture + AI connection)

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

## Current task

Day 1 COMPLETE. Next: Day 2 — Resume Analyzer.

## Key decisions

- Single FastAPI backend (no Node backend, no microservices)
- Qwen only through backend; outputs validated
- bcrypt used directly (passlib 1.7.4 incompatible with bcrypt 5)
- Qwen via Alibaba Cloud Model Studio OpenAI-compatible endpoint; model/base URL env-configurable (`ALIBABA_CLOUD_MODEL`, `ALIBABA_CLOUD_BASE_URL`)
- `backend/.env` is loaded by absolute path so the backend starts from any working directory
- MCP & RAG are optional, post-MVP
- Cut order under pressure: BONUS → SHOULD HAVE → never MUST HAVE

## Known issues

- None blocking. Root has two untracked E2E screenshot artifacts (`e2e-step3-profile-saved.png`, `e2e-step6-qwen-response.png`) — safe to delete

## Next task

Day 2 — Resume Analyzer (`docs/DEVELOPMENT_PLAN.md`).

## Team

- Member 1: Frontend / Full Stack
- Member 2: Backend / AI

## Repo & branches

- https://github.com/imzohaib-web/CareerPilot-AI
- `main` → release; `dev` → integration; `feature/*` → work branches
