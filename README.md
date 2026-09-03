# CareerPilot AI

> Your Personal AI Career Mentor & Interview Coach

CareerPilot AI is an AI-powered career-readiness platform that helps students understand where they stand, close their skill gaps, and prepare for the jobs they want. Built for the **Alibaba Cloud AI Hackathon Pakistan 2026**.

## Problem

Students often don't know whether their resume is job-ready, which skills they're missing, what to learn next, or how to prepare for interviews. No single tool connects all of these into one guided experience.

## Solution

CareerPilot combines six AI-driven tools into one guided career journey:

1. **AI Resume Analyzer** — upload a PDF resume, get a readiness score (0-100) and actionable feedback
2. **Skill Gap Analysis** — compare your skills against your target role, see match percentage
3. **Personalized Roadmap** — a time-boxed learning plan to close your gaps
4. **AI Career Mentor** — conversational guidance grounded in your profile, resume, and progress
5. **AI Mock Interview** — role-specific practice questions with scored feedback
6. **Progress Dashboard** — see your readiness score, milestones, and next steps across all modules

Modules are connected: data flows automatically from Resume → Skill Gap → Roadmap → Mentor → Interview, with cross-module navigation guiding users through the journey.

## Architecture

```
Frontend (React 19 + TS + Vite + Tailwind)
        ↓  HTTP + JWT
Backend (Python + FastAPI) ── 10 routers, 27 endpoints
        ↓              ↓
   MongoDB          Alibaba Cloud Model Studio / Qwen
   (Motor async)    (backend-only, keys never reach frontend)
```

- **Single backend**: Python + FastAPI — no Node/Express layer
- **AI isolation**: Qwen is accessed only through `app/services/ai`; keys never reach the frontend
- **Validation pipeline**: AI outputs go through Generation → Parsing → Schema Validation → Business Validation before being stored or displayed
- **Offline mode**: All modules work without MongoDB (in-memory fallback) for hackathon demo reliability

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS 3, React Router 7, Axios |
| Backend | Python 3.13, FastAPI 0.116, Uvicorn, Pydantic 2 |
| Database | MongoDB (Motor 3.7 async driver) with offline fallback |
| Auth | JWT (python-jose, HS256) + bcrypt password hashing |
| AI | Alibaba Cloud Model Studio / Qwen (qwen-plus via OpenAI-compatible API) |
| Testing | pytest (143 tests), oxlint, TypeScript strict mode |

## Getting Started

### Prerequisites

- **Python 3.13+** with venv
- **Node.js 18+** with npm
- An **Alibaba Cloud API key** (for Qwen AI features)
- **MongoDB** (optional — the app has offline-mode fallback)

### 1. Backend

```powershell
cd "backend"

# Create virtual environment and install dependencies
python -m venv venv
.\venv\Scripts\pip install -r requirements.txt

# Configure environment
copy .env.example .env
# Edit .env and fill in your secrets (see Environment Variables below)

# Start the server (http://localhost:8000)
.\venv\Scripts\python -m uvicorn app.main:app --reload
```

### 2. Frontend

```powershell
cd "frontend"

# Install dependencies
npm install

# Start the dev server (http://localhost:5173)
npm run dev
```

### 3. Open the app

Navigate to **http://localhost:5173**, register an account, and start exploring.

## Environment Variables

### Backend (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Required | Purpose |
|----------|----------|--------|
| `MONGODB_URI` | No | MongoDB connection string (app works without it via offline mode) |
| `JWT_SECRET` | Yes | Secret key for signing JWT tokens |
| `ALIBABA_CLOUD_API_KEY` | Yes | Qwen / Alibaba Cloud Model Studio API key |
| `JWT_EXPIRATION_HOURS` | No | Token validity duration (default: 48) |
| `MONGODB_DB_NAME` | No | Database name (default: `career_pilot_ai`) |
| `CORS_ORIGINS` | No | Allowed origins (default: `http://localhost:5173`) |

### Frontend (`frontend/.env`) — Optional

| Variable | Default | Purpose |
|----------|---------|--------|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Backend API base URL (no trailing slash) |

> **Security**: Never commit `.env` files. Keep all secrets server-side. API keys never reach the frontend.

## Project Structure

```
CareerPilot AI/
├── backend/
│   ├── app/
│   │   ├── database/        # MongoDB connection + index creation
│   │   ├── models/          # Data models
│   │   ├── routes/          # 10 FastAPI routers (thin handlers)
│   │   ├── schemas/         # Pydantic request/response validation
│   │   ├── services/        # Business logic layer
│   │   │   └── ai/          # Qwen AI service (isolated)
│   │   ├── config.py        # Settings from environment
│   │   └── main.py          # App entry point + router registration
│   ├── tests/               # 143 pytest tests
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable React components
│   │   ├── context/         # AuthContext (JWT state)
│   │   ├── layouts/         # AppLayout + sidebar navigation
│   │   ├── pages/           # 11 page components
│   │   ├── services/        # API client layer (Axios)
│   │   └── types/           # TypeScript type definitions
│   ├── package.json
│   └── .env.example
└── docs/                    # Architecture, specs, plans
```

## Testing

```powershell
# Backend tests (143 tests)
cd "backend"
.\venv\Scripts\python -m pytest tests/ -v

# Frontend checks
cd "frontend"
npx tsc --noEmit          # TypeScript type check
npx oxlint                # Lint
npx vite build            # Production build
```

## User Journey

```
Register → Login → Profile → Resume → Skill Gap → Roadmap → Mentor → Interview → Dashboard
```

Modules are connected with auto-fill and cross-module navigation:
- **Resume analysis** auto-fills into Skill Gap Analysis
- **Profile** auto-fills target role across modules
- **Skill Gap results** link to Roadmap Generator
- **Roadmap** links to Mentor and Mock Interview
- **Dashboard** aggregates data from all modules

## Documentation

Architecture, specs, and plans live in [`docs/`](docs/PROJECT_SPEC.md):
- [Project Spec](docs/PROJECT_SPEC.md) · [Architecture](docs/ARCHITECTURE.md) · [AI Architecture](docs/AI_ARCHITECTURE.md)
- [API Spec](docs/API_SPEC.md) · [Database Schema](docs/DATABASE_SCHEMA.md) · [MVP Scope](docs/MVP_SCOPE.md)
- [Demo Flow](docs/DEMO_FLOW.md) · [Development Plan](docs/DEVELOPMENT_PLAN.md)

## Team

2 developers — Frontend/Full Stack and Backend/AI.

## Hackathon

Built for the **Alibaba Cloud AI Hackathon Pakistan 2026** — theme: *AI for Pakistan's Future*.
Build window: **29 August – 4 September 2026**.
