# CareerPilot AI — Development Plan

**Build window: 29 August – 4 September 2026 (7 days).** This supersedes the earlier 22–27 August plan.

The original 6-day plan is extended to the new 7-day window; the extra day is used for integration/polish buffer and final testing before the demo.

---

## Day 1 — 29 August: Foundation + Architecture + AI Connection

- **Objective:** Working end-to-end skeleton: auth, profile, and a verified Qwen connection.
- **Tasks:**
  - Wire MongoDB connection (Motor) + app startup/shutdown.
  - CORS configuration for the frontend origin.
  - Authentication (register/login/me) with JWT.
  - Career Profile CRUD + career goal.
  - Qwen connection via `app/services/ai` + `POST /api/ai/test`.
  - Frontend API client (axios) + proxy in `vite.config.ts`.
- **Deliverables:** User can register, log in, save a profile, and the AI test endpoint returns a Qwen response.
- **Dependencies:** `.env` populated (`MONGODB_URI`, `JWT_SECRET`, `ALIBABA_CLOUD_API_KEY`).
- **Definition of Done:** End-to-end verified in browser; no secrets committed.

## Day 2 — 30 August: Resume Analyzer

- **Objective:** Upload + AI-analyze a resume.
- **Tasks:** Upload endpoint with file validation, text extraction, AI analysis service, schema validation, store result, display in UI.
- **Deliverables:** Resume analysis page showing score, strengths, weaknesses, improvements.
- **Dependencies:** Day 1 auth + AI connection.
- **Definition of Done:** A real resume uploads, parses, validates, and renders correctly; invalid files rejected gracefully.

## Day 3 — 31 August: Skill Gap + Personalized Roadmap

- **Objective:** Turn analysis into gaps and a roadmap.
- **Tasks:** Skill gap service (target role vs extracted skills), roadmap generator service, storage, UI pages.
- **Deliverables:** Skill gap view + phased roadmap view.
- **Dependencies:** Resume analysis from Day 2 + career goal.
- **Definition of Done:** Gap list and roadmap generated, validated, stored, and displayed.

## Day 4 — 1 September: AI Mentor + Mock Interview

- **Objective:** Conversational mentor and mock interview.
- **Tasks:** Mentor chat service grounded in user context, conversation persistence, interview start/answer/result flow, feedback UI.
- **Deliverables:** Working mentor chat + mock interview with scored feedback.
- **Dependencies:** Profile, gaps, roadmap context from Days 1–3.
- **Definition of Done:** Mentor responds using user context; interview produces validated feedback.

## Day 5 — 2 September: Integration + UI Polish + Optional Bonus

- **Objective:** Cohesive product + dashboard + polish; bonus only if must-haves are green.
- **Tasks:** Student dashboard aggregating progress, loading/error/empty states, navigation, visual polish. Optional bonus (e.g. GitHub analysis) ONLY if no must-have is at risk.
- **Deliverables:** Polished dashboard and consistent UX.
- **Dependencies:** All core features from Days 1–4.
- **Definition of Done:** Full user journey works without console errors.

## Day 6 — 3 September: Testing + Stabilization

- **Objective:** Harden the product.
- **Tasks:** End-to-end testing of every must-have, fix edge cases, AI output validation review, error handling, remove dead code.
- **Deliverables:** Stable build, known issues documented.
- **Dependencies:** Day 5 integrated product.
- **Definition of Done:** All must-haves pass manual end-to-end checks.

## Day 7 — 4 September: Deployment + Presentation

- **Objective:** Deploy and prepare the demo.
- **Tasks:** Deploy backend + frontend, configure production env vars, verify live endpoints, finalize DEMO_FLOW, rehearse pitch.
- **Deliverables:** Live deployment + rehearsed demo.
- **Dependencies:** Day 6 stable build.
- **Definition of Done:** Demo runs reliably against the deployed app.

---

## Guardrails

- A smaller complete product beats a large incomplete one.
- Never start a bonus feature while a must-have is broken.
- Test before merging to `dev`; see `docs/GIT_WORKFLOW.md`.
