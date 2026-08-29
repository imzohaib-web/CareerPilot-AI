# CareerPilot AI — AI Architecture

> STATUS: PLANNED — no AI feature is implemented yet.

## Planned AI Components

1. **Resume Analyzer** — parses an uploaded resume, extracts structured sections (education, skills, experience, projects), and scores job-readiness.
2. **Skill Gap Analyzer** — compares extracted skills against the target role's required skills and produces a prioritized gap list.
3. **Roadmap Generator** — converts skill gaps + career goal into a time-boxed, personalized learning roadmap.
4. **Career Mentor** — conversational assistant grounded in the user's profile, gaps, and roadmap.
5. **Mock Interview Coach** — generates role-specific questions, evaluates answers, and returns structured feedback.

## Conceptual Data Flow

```
User Context
+ Career Profile
+ Resume Analysis
+ Skill Gaps
+ Roadmap
+ Progress
+ Conversation Memory
        ↓
   AI Service (app/services/ai)
        ↓
   Qwen (Alibaba Cloud Model Studio)
        ↓
   Structured Output (JSON)
        ↓
   Validation (Pydantic + business rules)
        ↓
   Application (store + respond)
```

## Model Access

- Single provider: **Alibaba Cloud Model Studio / Qwen**.
- All model calls go through the backend service layer. The frontend never calls Qwen directly.
- The API key lives only in `backend/.env` (`ALIBABA_CLOUD_API_KEY`).
- Prefer structured/JSON outputs from the model where possible so results can be validated.

## Output Trust Policy (CRITICAL)

AI output must NOT be automatically trusted. Every important AI output goes through:

1. **Generated** by Qwen
2. **Parsed** (extract JSON from response text)
3. **Schema validated** (Pydantic model)
4. **Business validated** (ranges, enums, references to real user data)
5. **Stored** if appropriate
6. **Sent to frontend**

If parsing or validation fails, return a controlled error or retry once with a corrective prompt — never return raw model text as structured data.

## Prompting Guidelines

- System prompts are versioned in code/service files, not scattered in routes.
- Every prompt must inject only the user context that the specific feature needs (minimize tokens, avoid leaking unrelated PII).
- Deterministic-ish settings (low temperature) for structured analysis; higher allowed for mentor conversation.
