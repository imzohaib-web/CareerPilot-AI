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

Day 1 — 29 August (Foundation + architecture + AI connection)

## Completed work

- Repository audit + architecture decision (Python + FastAPI)
- Full documentation/context system (`docs/`)
- Qoder rules + 5 Agent Skill contracts
- Backend & frontend scaffolds on `dev` branch

## Current task

Day 1: wire MongoDB + auth + career profile + Qwen connection + frontend API client.

## Key decisions

- Single FastAPI backend (no Node backend, no microservices)
- Qwen only through backend; outputs validated
- MCP & RAG are optional, post-MVP
- Cut order under pressure: BONUS → SHOULD HAVE → never MUST HAVE

## Known issues

- `frontend/src/App.tsx` is still the Vite starter template — replace with real UI
- No `.env` values committed; developer must populate `backend/.env`
- MongoDB connection and AI service not yet implemented

## Next task

Implement backend foundation (Day 1 checklist in `docs/DEVELOPMENT_PLAN.md`).

## Team

- Member 1: Frontend / Full Stack
- Member 2: Backend / AI

## Repo & branches

- https://github.com/imzohaib-web/CareerPilot-AI
- `main` → release; `dev` → integration; `feature/*` → work branches
