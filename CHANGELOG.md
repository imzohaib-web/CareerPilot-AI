# Changelog

All notable changes to CareerPilot AI are documented here.

## 2026-08-29 — Day 1: Foundation, Auth, Profile, Qwen Connectivity

### Added — Backend

- MongoDB lifecycle via Motor (`app/database/mongodb.py`): single client at startup, closed on shutdown, ping-based health, unique indexes on `users.email` and `career_profiles.user_id`
- CORS middleware restricted to configured frontend origins (`FRONTEND_ORIGIN`)
- Routers mounted: `/api/auth`, `/api/profile`, `/api/ai`; `/api/health` extended with database status
- Authentication: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- Password hashing with bcrypt directly; JWT (HS256, python-jose) with minimal claims (`sub`, `exp`)
- Reusable `get_current_user` dependency — identity always comes from the validated JWT
- Career Profile CRUD: `GET/POST/PUT /api/profile`, one profile per user, protected
- Qwen connectivity test: `POST /api/ai/test` via `app/services/ai/qwen_service.py` (Alibaba Cloud Model Studio OpenAI-compatible endpoint; base URL and model env-configurable via `ALIBABA_CLOUD_BASE_URL` / `ALIBABA_CLOUD_MODEL`)
- Pydantic schemas for auth, profile, and AI test requests/responses (`app/schemas`)
- Global exception handler returning controlled JSON errors (no stack traces)
- New env configuration: `MONGODB_NAME`, `JWT_EXPIRES_MINUTES`, `ALIBABA_CLOUD_BASE_URL`, `ALIBABA_CLOUD_MODEL`, `FRONTEND_ORIGIN`
- `backend/.env` loaded by absolute path — backend starts correctly from any working directory

### Added — Frontend

- Centralized axios client (`services/apiClient.ts`) with JWT interceptor and error categorization (network / validation / authentication / ai-provider / server)
- API service modules: `auth.ts`, `profile.ts`, `ai.ts`
- `AuthContext` with login/register/logout, session restore from stored token
- Pages: Login, Register, Career Profile form, Qwen connectivity test; protected routes via `ProtectedRoute`; app shell with navigation (`layouts/AppLayout.tsx`)
- `VITE_API_BASE_URL` env support with `.env.example`

### Changed

- Replaced Vite starter `App.tsx` with router-based Day 1 UI; starter `App.css` removed
- `index.css` reduced to Tailwind imports + base font
- `backend/.env.example` documented all configuration variables
- Root `.gitignore` now protects `.env.*` (`.env.example` excluded)

### Dependencies

- Added `openai` (DashScope OpenAI-compatible Qwen client)
- Removed `passlib` (incompatible with bcrypt >= 4.1; bcrypt used directly)

### Verified

- 17/17 offline logic checks pass (hashing, JWT round-trip, schema validation, error paths)
- 17/17 live backend endpoint tests pass against MongoDB Atlas: health, register/duplicate (409), login right/wrong, /me, invalid+missing JWT, profile GET/POST/PUT, user isolation, `/api/ai/test` with real Qwen (`qwen3.7-plus`) response, blank-message 422, unauthenticated 401
- AI provider failure handling verified (sanitized `AIServiceError`, no provider internals exposed)
- Full browser E2E passed 8/8: protected-route redirect, register, profile create/reload/update persistence, Qwen response display, logout, session restore
- Frontend lint (0 errors) and production build pass

## 2026-08-29 — Project Initialization

### Added

- CareerPilot architecture documentation (`docs/ARCHITECTURE.md`)
- AI architecture & output-trust policy (`docs/AI_ARCHITECTURE.md`)
- Agent Skills contracts (`docs/AGENT_SKILLS.md`)
- Specialized agents overview (`docs/AGENTS.md`)
- MCP plan (`docs/MCP_PLAN.md`)
- Memory plan (`docs/MEMORY_PLAN.md`)
- Database schema plan (`docs/DATABASE_SCHEMA.md`)
- API specification (`docs/API_SPEC.md`)
- MVP scope control (`docs/MVP_SCOPE.md`)
- Development plan (`docs/DEVELOPMENT_PLAN.md`)
- Demo flow (`docs/DEMO_FLOW.md`)
- Git workflow (`docs/GIT_WORKFLOW.md`)
- Qoder project rules (coding standards, architecture, security, UI/UX)
- Qoder Agent Skills (resume-analysis, skill-gap, roadmap-generation, mock-interview, career-mentor)

### Architecture decisions

- Python + FastAPI selected instead of Node.js + Express.
- Single backend selected instead of multiple backend services.
- Qwen accessed only through the backend; keys never exposed to the frontend.
- AI outputs are validated (parsed → schema → business) before storage or display.
- MCP/RAG treated as optional extensions, not core MVP requirements.
- Agent Skills defined as contracts before implementation.
- Development window set to 29 August – 4 September 2026.
