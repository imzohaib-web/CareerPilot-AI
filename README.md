# CareerPilot AI

> **Your Personal AI Career Mentor & Interview Coach**

AI-powered career-readiness platform that helps students assess their resume, close skill gaps, and prepare for interviews — all in one guided journey.

Built for the **Alibaba Cloud AI Hackathon Pakistan 2026** · Theme: *AI for Pakistan's Future*

---

## Overview

CareerPilot AI connects six AI-driven modules into a single guided career experience. Data flows automatically from resume analysis through skill gap identification, personalized learning roadmaps, conversational mentoring, and mock interview practice — with a progress dashboard aggregating results across all modules.

**Target users:** university students, fresh graduates, and early-career developers preparing for internships or full-time roles.

## Problem Statement

Students entering the job market face a common set of challenges:

- They don't know whether their resume is job-ready
- They can't identify which skills they're missing for a target role
- They lack a structured learning plan to close those gaps
- They have no realistic way to practice interviews with feedback
- No single tool connects all of these into one guided experience

CareerPilot AI addresses each of these with purpose-built AI modules that work together as a unified career journey.

## Key Features

| # | Module | Description |
|---|--------|-------------|
| 1 | **AI Resume Analyzer** | Upload a PDF resume, receive a job-readiness score (0–100) and actionable feedback |
| 2 | **Skill Gap Analysis** | Compare your extracted skills against a target role and see your match percentage |
| 3 | **Personalized Roadmap** | Get a time-boxed learning plan generated from your identified skill gaps |
| 4 | **AI Career Mentor** | Conversational career guidance grounded in your profile, resume, and progress |
| 5 | **AI Mock Interview** | Role-specific practice questions with scored, structured feedback |
| 6 | **Progress Dashboard** | Aggregated readiness scores, milestones, and next steps across all modules |

**Cross-module data flow:**

```
Register → Login → Profile → Resume → Skill Gap → Roadmap → Mentor → Interview → Dashboard
```

Modules are connected with auto-fill and contextual navigation — resume analysis feeds into skill gap analysis, profile data auto-fills target roles, and skill gap results link directly to the roadmap generator.

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS 3, React Router 7, Axios, Framer Motion, Lucide Icons |
| **Backend** | Python, FastAPI 0.141, Uvicorn, Pydantic 2 |
| **Database** | MongoDB via Motor 3.7 async driver (with offline-mode fallback) |
| **Authentication** | JWT (python-jose, HS256) + bcrypt password hashing |
| **AI Engine** | Alibaba Cloud Model Studio / Qwen (`qwen-plus` via OpenAI-compatible API) |
| **PDF Processing** | PyMuPDF |
| **Testing** | pytest (171 tests), oxlint, TypeScript strict mode |
| **Deployment** | Vercel (frontend) · Render (backend) · MongoDB Atlas (database) |

## System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  Frontend (Vercel)                       │
│         React 19 + TypeScript + Vite + Tailwind          │
└────────────────────────┬─────────────────────────────────┘
                         │  HTTP / REST + JWT Bearer
                         ▼
┌──────────────────────────────────────────────────────────┐
│                  Backend (Render)                        │
│                   Python + FastAPI                       │
│  ┌─────────────────────────────────────────────────┐    │
│  │  10 Routers · Pydantic Schemas · Service Layer  │    │
│  └────────────────────────┬────────────────────────┘    │
└───────────────────────────┼──────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌──────────────────────┐   ┌──────────────────────────────┐
│   MongoDB Atlas      │   │  Alibaba Cloud Model Studio  │
│   (Motor async)      │   │  Qwen AI (qwen-plus)        │
└──────────────────────┘   └──────────────────────────────┘
```

> Place a detailed architecture diagram at `docs/architecture.png` to replace this text diagram. See the [Architecture Diagram](#architecture-diagram) section below for details.

**Architecture principles:**

- **Single backend** — Python + FastAPI only; no Node/Express layer
- **AI isolation** — Qwen is accessed exclusively through `app/services/ai`; API keys never reach the frontend
- **Validation pipeline** — AI outputs go through Generation → Parsing → Schema Validation → Business Validation before being stored or displayed
- **Offline mode** — all modules work without MongoDB (in-memory fallback) for demo reliability

## Application Workflow

```
User registers and logs in
        │
        ▼
Completes career profile (target role, current skills, experience)
        │
        ▼
Uploads resume (PDF) → AI extracts sections and scores readiness
        │
        ▼
Skill Gap Analysis → compares extracted skills vs. target role requirements
        │
        ▼
Roadmap Generator → creates personalized time-boxed learning plan
        │
        ├──► AI Career Mentor → context-aware guidance using profile + progress data
        │
        ├──► Mock Interview → role-specific questions with scored feedback
        │
        └──► Progress Dashboard → aggregates scores and milestones across modules
```

## Screenshots / Demo

![Uploading Screenshot 2026-09-07 221723.png…]()


## Local Setup

### Prerequisites

- **Python 3.13+** with `venv`
- **Node.js 18+** with `npm`
- An **Alibaba Cloud API key** (required for AI features)
- **MongoDB** (optional — the app includes an offline-mode fallback)

### 1. Clone the Repository

```bash
git clone https://github.com/imzohaib-web/CareerPilot-AI.git
cd CareerPilot-AI
```

### 2. Backend

```powershell
cd backend

# Create virtual environment and install dependencies
python -m venv venv
.\venv\Scripts\pip install -r requirements.txt

# Configure environment variables
copy .env.example .env
# Edit .env — fill in your secrets (see Environment Variables below)

# Start the API server (http://localhost:8000)
.\venv\Scripts\python -m uvicorn app.main:app --reload
```

### 3. Frontend

```powershell
cd frontend

# Install dependencies
npm install

# Start the dev server (http://localhost:5173)
npm run dev
```

### 4. Open the Application

Navigate to **http://localhost:5173**, register an account, and begin your career journey.

## Environment Variables

### Backend (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` and configure:

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `MONGODB_URI` | Production | — | MongoDB Atlas connection string |
| `JWT_SECRET` | Yes | — | Secret key for signing JWT tokens |
| `ALIBABA_CLOUD_API_KEY` | Yes | — | Alibaba Cloud / Qwen API key |
| `MONGODB_NAME` | No | `careerpilot_ai` | Database name |
| `JWT_EXPIRES_MINUTES` | No | `1440` (24 h) | Token validity duration |
| `ALIBABA_CLOUD_BASE_URL` | No | DashScope URL | OpenAI-compatible endpoint |
| `ALIBABA_CLOUD_MODEL` | No | `qwen-plus` | Qwen model name |
| `QWEN_TIMEOUT` | No | `60` | Qwen request timeout (seconds) |
| `FRONTEND_ORIGIN` | No | `localhost:5173–5175` | Comma-separated CORS origins |
| `RESUME_MAX_SIZE_MB` | No | `5` | Maximum resume upload size |

### Frontend (`frontend/.env`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Backend API base URL (no trailing slash) |

> **Security:** Never commit `.env` files. All secrets stay server-side. API keys never reach the frontend.

## API & Backend

### Health Check

```
GET /api/health → { "status": "ok", "database": "connected" }
```

### API Routers (10 modules)

| Router | Prefix | Purpose |
|--------|--------|---------|
| `auth` | `/api/auth` | Registration, login, JWT management |
| `profile` | `/api/profile` | Career profile and target role |
| `resume` | `/api/resume` | PDF upload, AI analysis, readiness score |
| `skill_gap` | `/api` | Skill extraction and gap analysis |
| `roadmap` | `/api/roadmap` | Personalized learning roadmap generation |
| `interview` | `/api/interview` | Mock interview questions and scoring |
| `ai` | `/api/ai` | General AI endpoints (career mentor) |
| `chat` | `/api/chat` | Conversational chat with persistent context |
| `rag` | `/api/rag` | RAG knowledge base queries |
| `progress` | `/api/progress` | Progress tracking and dashboard aggregation |

### Running Tests

```powershell
# Backend — 171 tests
cd backend
.\venv\Scripts\python -m pytest tests/ -v

# Frontend
cd frontend
npx tsc --noEmit          # TypeScript type checking
npx oxlint                # Lint checks
npx vite build            # Production build verification
```

## Project Structure

```
CareerPilot-AI/
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
│   ├── tests/               # 171 pytest tests
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable React components
│   │   ├── context/         # AuthContext (JWT state management)
│   │   ├── layouts/         # AppLayout + sidebar navigation
│   │   ├── pages/           # 10 page components
│   │   ├── services/        # API client layer (Axios)
│   │   └── types/           # TypeScript type definitions
│   ├── package.json
│   ├── vercel.json          # Vercel SPA rewrite rules
│   └── .env.example
├── docs/                    # Architecture, specs, and plans
├── render.yaml              # Render deployment blueprint
└── README.md
```

## Deployment

### Frontend — Vercel

1. Import the repository into Vercel; set root directory to `frontend`.
2. Add `VITE_API_BASE_URL` pointing to your backend URL (no trailing slash).
3. Vercel auto-detects the Vite build (`npm run build`). Deploy.
4. SPA routing is handled by `frontend/vercel.json`.

### Backend — Render

1. Create a **Web Service** on Render; connect your GitHub repository.
2. Set root directory to `backend`.
3. **Build command:** `pip install -r requirements.txt`
4. **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Configure environment variables in the Render dashboard (see [Environment Variables](#environment-variables)).
6. **Health check path:** `/api/health`

A `render.yaml` blueprint is included at the repository root for one-click deploy.

### Database — MongoDB Atlas

Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/atlas). The `MONGODB_URI` should include database user credentials. Indexes are auto-created on first connection.

### Architecture Diagram

To add a visual architecture diagram:

1. Create your diagram (draw.io, Excalidraw, or similar) and export as PNG.
2. Save it as **`docs/architecture.png`**.
3. The README already references this path — no further changes needed.

## Team

| Role | Focus |
|------|-------|
| Full-Stack Developer | Frontend (React + TypeScript), UI/UX, integration |
| Backend / AI Developer | FastAPI, Qwen AI integration, MongoDB, testing |

## Future Improvements

- **GitHub repository analysis** — scan a user's GitHub repos to auto-extract skills and projects
- **LinkedIn profile optimization** — AI-powered suggestions for LinkedIn headlines, summaries, and keywords
- **Voice-enabled mock interviews** — speech-to-text for natural interview practice
- **AI cover letter generator** — tailored cover letters based on resume + job description
- **Daily career challenges** — bite-sized tasks to build skills incrementally
- **MCP-powered tool integrations** — extended AI agent capabilities via Model Context Protocol
- **Multi-language resume support** — parse and analyze resumes in Urdu and other languages

---

Built for the **Alibaba Cloud AI Hackathon Pakistan 2026** · Build window: 29 August – 4 September 2026
