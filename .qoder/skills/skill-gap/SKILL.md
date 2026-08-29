---
name: skill-gap
description: Compare a user's extracted skills against a target role's required skills and produce a prioritized gap list via Qwen. Use when implementing or debugging the skill gap analysis feature.
---

# Skill Gap Analysis

Implement the Skill Gap contract defined in `docs/AGENT_SKILLS.md` (section 2).

## Rules

- Requires an existing resume analysis and a set career goal/target role.
- Send extracted skills + target role to Qwen via `app/services/ai`.
- Require structured JSON: `{ target_role, gaps: [{skill, status, priority, reason}] }`.
- Validate: `status` in {have, partial, missing}; `priority` in {high, medium, low}; core role skills are covered.
- Store the validated result in the `skill_profiles` collection.

## Failure cases

- No target role → prompt the user to set one.
- Unknown role → fall back to a generic role template.
