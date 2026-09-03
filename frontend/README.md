# CareerPilot AI — Frontend

React 19 + TypeScript frontend for [CareerPilot AI](../README.md), built with Vite and Tailwind CSS.

## Getting Started

```powershell
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev
```

The frontend connects to the backend at `http://localhost:8000` by default. Override with:

```
VITE_API_BASE_URL=http://your-backend-url
```

in a `.env` file (copy from `.env.example`).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server with HMR |
| `npx tsc --noEmit` | TypeScript type check (no output files) |
| `npx oxlint` | Lint with oxlint |
| `npx vite build` | Production build to `dist/` |

## Project Structure

```
frontend/src/
├── assets/          # Static assets (images, SVGs)
├── components/      # Reusable React components
│   └── chat/        # Chat-specific components (MessageContent)
├── context/         # React Context providers (AuthContext for JWT state)
├── hooks/           # Custom React hooks
├── layouts/         # Page layouts (AppLayout with sidebar)
├── pages/           # Route-level page components
├── services/        # API client layer (Axios wrappers per module)
└── types/           # TypeScript type definitions (index.ts)
```

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/login` | LoginPage | User login (public) |
| `/register` | RegisterPage | User registration (public) |
| `/` | ProgressDashboardPage | Dashboard aggregating all modules |
| `/profile` | ProfilePage | Career profile management |
| `/resume` | ResumeAnalyzerPage | AI resume upload & analysis |
| `/skill-gap` | SkillGapPage | Skill gap analysis (auto-fills from resume) |
| `/roadmap` | RoadmapPage | Personalized learning roadmap |
| `/mentor` | CareerMentorPage | AI career mentor chat |
| `/interview` | MockInterviewPage | AI mock interview practice |
| `/rag` | RagKnowledgePage | RAG knowledge base management |
| `/ai-test` | AiTestPage | AI integration test page |

All authenticated routes are wrapped in `ProtectedRoute` and redirect unauthenticated users to `/login`.

## API Services

All HTTP calls go through `services/apiClient.ts` (Axios with JWT interceptor). Each module has its own service file:

- `auth.ts` — login, register, session
- `profile.ts` — career profile CRUD
- `resume.ts` — resume upload & analysis
- `skillGap.ts` — skill gap analysis
- `roadmap.ts` — roadmap generation & progress updates
- `interview.ts` — mock interview start & submit
- `chat.ts` — career mentor conversation
- `rag.ts` — knowledge base documents & queries
- `progress.ts` — dashboard progress aggregation
- `ai.ts` — health check & model info

## Conventions

- **TypeScript** for all new code; no `any` unless justified
- **No direct fetch/axios** in components — always use the service layer
- **Tailwind utility classes** for styling; no inline layout styles
- Every data-driven view handles **loading, error, and empty** states
