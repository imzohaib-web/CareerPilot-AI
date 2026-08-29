# CareerPilot AI — Git Workflow

Repository: https://github.com/imzohaib-web/CareerPilot-AI

## Branch Model

```
main
  ↑  (release-ready, protected)
dev
  ↑  (integration branch — all features merge here first)
feature/*
```

## Current Branches (as of initialization)

| Branch | Purpose | Status |
|--------|---------|--------|
| main | Release-ready code | Pushed, protected in practice |
| dev | Integration branch | Up to date with origin/dev |
| feature/frontend-foundation | Frontend scaffolding (Merged via PR #2) | Merged |
| feature/backend-foundation | Backend scaffolding | Merged into dev |

## Team Responsibilities

| Member | Focus |
|--------|-------|
| Member 1 | Frontend / Full Stack |
| Member 2 | Backend / AI |

## Suggested Feature Branches

- `feature/frontend-foundation` ✓ (done)
- `feature/backend-foundation` ✓ (done)
- `feature/auth`
- `feature/resume-analyzer`
- `feature/skill-gap`
- `feature/roadmap`
- `feature/mentor-chat`
- `feature/mock-interview`
- `feature/dashboard`

## Rules

- Never develop directly on `main`.
- Do not overwrite another developer's work.
- Do not force-push shared branches (`main`, `dev`).
- Keep commits focused — one logical change per commit.
- Review changed files (`git diff`) before every commit.
- Test locally before merging into `dev`.
- Merge features into `dev` first; `main` only receives tested releases.
- Never commit `.env`, secrets, or API keys. `.env` is gitignored.
