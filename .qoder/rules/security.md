---
trigger: always_on
---

# CareerPilot AI — Security

## Secrets

- Secrets live ONLY in `.env` (gitignored). `.env.example` holds placeholders only.
- Never commit `.env`, JWT secrets, or Qwen/Alibaba Cloud API keys.
- Qwen/Alibaba Cloud keys must never be exposed to the frontend.
- Avoid logging secrets.

## Backend

- Validate every file upload (type, size) and every request body (Pydantic).
- Authenticate all protected endpoints (JWT).
- Authorize resources by the authenticated user's ID.
- Never trust client-provided user IDs.
- Hash passwords with bcrypt; never store or compare plaintext.
- Avoid exposing stack traces in production responses.

## Frontend

- No secrets or API keys in frontend code or bundles.
- Store tokens safely; do not log tokens.

## AI

- Do not send secrets or unrelated PII into model prompts.
- Treat model output as untrusted input; validate before use.
