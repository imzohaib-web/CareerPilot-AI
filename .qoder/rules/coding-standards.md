---
trigger: always_on
---

# CareerPilot AI — Coding Standards

## Frontend (React + TypeScript)

- TypeScript for all new code; no `any` unless justified.
- Reusable components in `frontend/src/components`; pages in `frontend/src/pages`.
- All API calls go through the service layer (`frontend/src/services`) using axios — never call fetch/axios directly in components.
- No hardcoded production data; no secrets in frontend code.
- Every data-driven view must handle loading, error, and empty states.
- Styling via Tailwind utility classes; no inline styles for layout.

## Backend (Python + FastAPI)

- Python type hints on all function signatures.
- Pydantic models in `app/schemas` for all request/response validation.
- Route handlers stay thin: validate input → call service → return result.
- Business logic belongs in `app/services`; database access only via `app/database`.
- AI/LLM calls only inside `app/services/ai`.
- Clear exception handling with controlled JSON errors; never expose stack traces.
- Environment-based configuration via `app/config.py`; no secrets in source.

## General

- Small functions, meaningful names, no duplication.
- Avoid unnecessary abstraction and premature optimization.
- Do not rewrite working code unnecessarily; do not modify unrelated files.
- Prefer incremental, testable changes.
