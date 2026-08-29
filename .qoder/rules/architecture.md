---
trigger: always_on
---

# CareerPilot AI — Architecture & Layering

## Stack (fixed)

- Frontend: React 19 + TypeScript + Vite + Tailwind (in `frontend/`).
- Backend: Python + FastAPI (in `backend/app/`). This is the ONLY backend.
- Database: MongoDB via Motor async driver.
- AI: Alibaba Cloud Model Studio / Qwen, accessed ONLY from the backend.

Do NOT introduce a Node/Express backend or a second separate AI service.

## Request Flow

```
Frontend → FastAPI route → Pydantic schema → Service → Database / AI service
```

## Rules

- Routes must remain thin; business logic lives in `app/services`.
- Database access must not be scattered across routes — only through `app/database`.
- All AI calls are isolated in `app/services/ai`.
- API keys must never reach the frontend; React talks to AI only through FastAPI.
- AI outputs are validated (parsed → schema-validated → business-validated) before storing or displaying. Never trust raw model output.
- Avoid circular dependencies and unnecessary abstraction.
- MCP and RAG are OPTIONAL post-MVP extensions — do not build them into core paths.

## Guardrail

Reliability > complexity. MVP completeness > feature count. Clarity > abstraction. Security > convenience. Real AI value > buzzwords.
