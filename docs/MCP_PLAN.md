# CareerPilot AI — MCP Plan

> STATUS: OPTIONAL — MCP is NOT part of the core MVP. Do not build MCP infrastructure now.

## Policy

- MCP is **optional** for the core MVP.
- Do not build MCP infrastructure now.
- Do not install random MCP servers.
- Do not add MCP merely for demonstration value.
- Introduce MCP **only after** the core product is stable.

## Candidate MCP Tools

| Priority | Tool | Purpose | Input | Output | Security concerns | Expected benefit |
|----------|------|---------|-------|--------|-------------------|------------------|
| **P1** | GitHub Analyzer | Analyze a user's public GitHub repos to infer real skills, project quality, and activity | GitHub username / repo list | Structured skill + project summary | Only public data; user must opt in; never request write scopes | Strengthens skill-gap accuracy with real evidence |
| **P2** | Career Resource Search | Find learning resources/courses for roadmap tasks | Skill/topic, level | Ranked resource list | Validate URLs; avoid untrusted sources | Makes roadmap actionable |
| **P3** | Job Skill/Requirement Search | Fetch current job-market requirements for a target role | Role, location/market | Common required skills | Rate limits; source reliability | Grounds skill-gap in real market data |

## Adoption Criteria

Only add an MCP tool when:

1. The core MVP feature it supports is already working, AND
2. There is a clear user-value gain (not just "it uses MCP"), AND
3. Security/privacy implications have been reviewed.
