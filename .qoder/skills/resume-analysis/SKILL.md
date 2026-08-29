---
name: resume-analysis
description: Analyze an uploaded resume by extracting structured sections and computing a job-readiness score via Qwen. Use when implementing or debugging the resume upload/analysis feature, or when the user asks about parsing or scoring resumes.
---

# Resume Analysis

Implement the Resume Analyzer contract defined in `docs/AGENT_SKILLS.md` (section 1).

## Rules

- Extract text from the uploaded resume server-side; never trust client-extracted text.
- Send only the resume text (plus optional target role) to Qwen via `app/services/ai`.
- Require structured JSON output with keys: `summary`, `readiness_score`, `sections`, `strengths`, `weaknesses`, `improvements`.
- Validate: `readiness_score` is an integer 0–100; section keys exist even when empty; arrays are non-null.
- On parse/validation failure, return a controlled error or retry once with a corrective prompt — never return raw model text.

## Failure cases

- Unreadable/empty resume → controlled "could not parse" error.
- Wrong file type → reject at upload (validate extension + MIME + size).
