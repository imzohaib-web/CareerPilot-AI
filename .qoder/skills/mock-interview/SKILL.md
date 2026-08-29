---
name: mock-interview
description: Run a role-specific mock interview via Qwen, generating questions and scoring the user's answers with structured feedback. Use when implementing or debugging the mock interview feature.
---

# Mock Interview

Implement the Mock Interview contract defined in `docs/AGENT_SKILLS.md` (section 4).

## Rules

- Requires target role, experience level, and (ideally) a resume summary.
- Generate a question set via Qwen through `app/services/ai`.
- After each answer, evaluate relevance, depth, and structure; produce per-question and overall feedback.
- Require structured JSON: `{ questions: [{question, topic}], feedback: [{score, strengths, improvements}] }`.
- Validate: scores are 0–100; feedback exists for every answered question.
- Persist interview state so users can resume or review later.

## Failure cases

- Empty answer → gentle re-prompt.
- User exits early → save partial progress.
