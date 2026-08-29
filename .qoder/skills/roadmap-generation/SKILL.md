---
name: roadmap-generation
description: Convert a user's skill gaps and career goal into a personalized, time-boxed learning roadmap via Qwen. Use when implementing or debugging the roadmap generation feature.
---

# Roadmap Generation

Implement the Roadmap Generation contract defined in `docs/AGENT_SKILLS.md` (section 3).

## Rules

- Requires skill gaps (and ideally career goal + weekly hours).
- Send gaps + goal + time budget to Qwen via `app/services/ai`.
- Require structured JSON: `{ goal, phases: [{name, duration_weeks, tasks:[{skill, action, resource, milestone}]}] }`.
- Validate: durations are positive numbers; every high-priority gap appears in the plan; no duplicate tasks.
- Keep the plan realistic for the user's time budget. Store the validated roadmap.

## Failure cases

- No gaps → return a "you are well aligned" message instead of an empty plan.
