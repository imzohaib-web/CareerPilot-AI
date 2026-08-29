# CareerPilot AI — Architecture

## High-Level Architecture

```
React (Vite + TypeScript + Tailwind)
  ↓ HTTP (REST, JSON)
FastAPI (Python)
  ↓
Services
  ├── Authentication
  ├── Career Profile
  ├── Resume
  ├── Skill Gap
  ├── Roadmap
  ├── Interview
  ├── Mentor
  └── AI
        ↓
   Alibaba Cloud Model Studio / Qwen
        ↓
FastAPI → MongoDB (Motor async driver)
```

## Technology Decision

The backend is **Python + FastAPI**. It is NOT Node.js + Express with a separate Python AI service.

Reason: CareerPilot is AI-heavy and benefits from Python's ecosystem for:

- PDF processing (resume parsing)
- AI/LLM integration
- RAG (optional, post-MVP)
- Embeddings
- Agent workflows
- Data processing

Do not introduce a second backend unless a real technical requirement appears.

## Current Stack (verified in repository)

| Layer | Technology | Status |
|-------|-----------|--------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 3, React Router 7, Axios | Scaffolded (template App.tsx pending replacement) |
| Backend | Python, FastAPI, Uvicorn | Scaffolded (`/api/health` only) |
| Database | MongoDB via Motor / PyMongo | Driver installed, connection not wired |
| Auth | python-jose (JWT), passlib + bcrypt | Installed, not implemented |
| AI | Alibaba Cloud Model Studio / Qwen | API key env var reserved, not implemented |

## Repository Layout

```
backend/
├── app/
│   ├── main.py              # FastAPI app entrypoint
│   ├── config.py            # Environment-based configuration
│   ├── routes/              # Thin API route handlers
│   ├── schemas/             # Pydantic request/response validation
│   ├── models/              # MongoDB document shapes
│   ├── services/            # Business logic layer
│   │   └── ai/              # All Qwen/AI integrations (isolated)
│   └── database/            # MongoDB connection & collection access
├── requirements.txt
├── .env.example
└── .env                     # Local secrets only, never committed

frontend/
├── src/
│   ├── components/          # Reusable UI components
│   ├── pages/               # Route-level pages
│   ├── layouts/             # Page layouts/shells
│   ├── hooks/               # Custom React hooks
│   ├── services/            # API client layer (axios) — all HTTP calls live here
│   └── types/               # Shared TypeScript types
└── vite.config.ts           # Will include dev proxy to FastAPI
```

## Layering Rules

```
Frontend
↓
API routes
↓
Schemas / validation
↓
Services
↓
Database / AI integrations
```

Rules:

- Routes must remain thin — parse/validate input, call a service, return the result.
- Business logic belongs in services, never in routes.
- Database access must not be scattered across routes — only through `app/database` + services.
- AI calls must be isolated inside `app/services/ai`.
- API keys must never be exposed to React.
- Frontend must communicate with AI through FastAPI only.
- AI outputs must be validated before being stored or displayed.
- Avoid circular dependencies.
- Avoid unnecessary abstractions.
- Avoid unnecessary microservices.

## Cross-Cutting Concerns

- **CORS:** configured in `main.py` for the frontend origin only.
- **Errors:** consistent JSON error shape from FastAPI; no stack traces in production responses.
- **Config:** all secrets and environment-specific values via environment variables loaded by `config.py`.
