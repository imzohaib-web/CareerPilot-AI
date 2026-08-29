# CareerPilot AI

> Your Personal AI Career Mentor & Interview Coach

CareerPilot AI is an AI-powered career-readiness platform that helps students understand where they stand, close their skill gaps, and prepare for the jobs they want.

## Problem

Students often don't know whether their resume is job-ready, which skills they're missing, what to learn next, or how to prepare for interviews.

## Solution

CareerPilot combines AI-driven tools into one guided experience:

1. **AI Resume Analyzer** — upload a resume, get a readiness score and actionable feedback
2. **Skill Gap Analysis** — compare your skills against your target role
3. **Personalized Roadmap** — a time-boxed plan to close your gaps
4. **AI Career Mentor** — conversational guidance grounded in your profile
5. **AI Mock Interview** — practice questions with scored feedback
6. **Progress Tracking** — see how far you've come

## Architecture

```
React (Vite + TS + Tailwind) → FastAPI (Python) → Services → Alibaba Cloud Model Studio / Qwen
                                       ↓
                                    MongoDB
```

- Single backend: **Python + FastAPI**.
- Qwen is accessed **only through the backend**; keys never reach the frontend.
- AI outputs are validated before being stored or displayed.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, React Router, Axios |
| Backend | Python, FastAPI, Uvicorn |
| Database | MongoDB (Motor async driver) |
| Auth | JWT (python-jose) + bcrypt/passlib |
| AI | Alibaba Cloud Model Studio / Qwen |

## Development Setup

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
copy .env.example .env       # then fill in your secrets
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret for signing JWTs |
| `ALIBABA_CLOUD_API_KEY` | Qwen / Model Studio API key |

> Never commit `.env`. Keep all secrets server-side.

## Documentation

Architecture, specs, and plans live in [`docs/`](docs/PROJECT_SPEC.md).

## Team

2 developers — Frontend/Full Stack and Backend/AI.

## Hackathon

Built for the **Alibaba Cloud AI Hackathon Pakistan 2026** — theme: *AI for Pakistan's Future*.
Build window: **29 August – 4 September 2026**.
