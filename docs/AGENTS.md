# CareerPilot AI — Specialized Agents

> STATUS: PLANNED — documentation only. No agents are implemented.

Agents have clearly separated responsibilities. We avoid both a single giant "do everything" agent and over-engineering into many agents before the MVP requires it. Use the simplest architecture capable of satisfying the requirement.

| Agent | Responsibility | Inputs | Outputs |
|-------|---------------|--------|---------|
| **Career Mentor Agent** | Conversational career guidance grounded in user context | Profile, gaps, roadmap, progress, chat history | Guidance text |
| **Resume Analyzer Agent** | Parse + score resumes | Resume text | Structured analysis JSON |
| **Skill Gap Agent** | Compare skills vs target role | Extracted skills, target role | Prioritized gap list |
| **Roadmap Agent** | Build a personalized learning plan | Gaps, goal, time budget | Phased roadmap JSON |
| **Interview Agent** | Run mock interviews + feedback | Role, level, resume summary | Questions + scored feedback |

## Shared Rules

- Each agent reuses the single AI service layer (`app/services/ai`) — no agent talks to Qwen directly.
- Each agent's output passes through the same validation pipeline (see `AI_ARCHITECTURE.md`).
- For the MVP, these may be implemented as focused service functions rather than separate processes/frameworks. Promote to true multi-agent orchestration only if a real need appears.
