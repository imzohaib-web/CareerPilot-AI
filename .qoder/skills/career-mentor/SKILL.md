---
name: career-mentor
description: Provide context-aware conversational career guidance grounded in the user's profile, skill gaps, roadmap, and progress. Use when implementing or debugging the Career Mentor chat feature.
---

# Career Mentoring

Implement the Career Mentoring contract defined in `docs/AGENT_SKILLS.md` (section 5).

## Rules

- Ground every answer in the user's stored context: profile, gaps, roadmap, progress, and recent conversation history.
- Inject only the context the current question needs; avoid leaking unrelated PII into prompts.
- Stay within career scope; never fabricate facts about the user.
- Call Qwen only through `app/services/ai`.
- Output is conversational text (light markdown/lists allowed).
- Validate: response is non-empty; no secrets or internal prompts leak; refuse out-of-scope/harmful requests.

## Failure cases

- Off-topic request → politely redirect to career topics.
- Missing profile → suggest completing the career profile first.
