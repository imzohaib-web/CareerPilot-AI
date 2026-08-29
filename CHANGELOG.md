# Changelog

All notable changes to CareerPilot AI are documented here.

## 2026-08-29 — Project Initialization

### Added

- CareerPilot architecture documentation (`docs/ARCHITECTURE.md`)
- AI architecture & output-trust policy (`docs/AI_ARCHITECTURE.md`)
- Agent Skills contracts (`docs/AGENT_SKILLS.md`)
- Specialized agents overview (`docs/AGENTS.md`)
- MCP plan (`docs/MCP_PLAN.md`)
- Memory plan (`docs/MEMORY_PLAN.md`)
- Database schema plan (`docs/DATABASE_SCHEMA.md`)
- API specification (`docs/API_SPEC.md`)
- MVP scope control (`docs/MVP_SCOPE.md`)
- Development plan (`docs/DEVELOPMENT_PLAN.md`)
- Demo flow (`docs/DEMO_FLOW.md`)
- Git workflow (`docs/GIT_WORKFLOW.md`)
- Qoder project rules (coding standards, architecture, security, UI/UX)
- Qoder Agent Skills (resume-analysis, skill-gap, roadmap-generation, mock-interview, career-mentor)

### Architecture decisions

- Python + FastAPI selected instead of Node.js + Express.
- Single backend selected instead of multiple backend services.
- Qwen accessed only through the backend; keys never exposed to the frontend.
- AI outputs are validated (parsed → schema → business) before storage or display.
- MCP/RAG treated as optional extensions, not core MVP requirements.
- Agent Skills defined as contracts before implementation.
- Development window set to 29 August – 4 September 2026.
