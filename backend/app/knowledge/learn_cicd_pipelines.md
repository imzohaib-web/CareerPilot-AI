---
title: "Continuous Integration and Continuous Deployment (CI/CD) with GitHub Actions"
category: "learning_path"
role: "devops"
source_note: "Curated learning guide for automated testing, linting, Docker image building, and cloud deployments."
---

# Continuous Integration and Continuous Deployment (CI/CD) with GitHub Actions

Continuous Integration (CI) is the practice of automating the building and testing of code every time a team member commits changes. Continuous Deployment (CD) automatically releases validated changes to staging or production environments. GitHub Actions is the leading cloud-native CI/CD platform integrated directly into Git repositories.

## Learning Roadmap

### Phase 1: Workflow Fundamentals
1. **Core Terminology**:
   - **Workflow**: Configured YAML file stored under `.github/workflows/`.
   - **Event / Trigger**: `on: [push, pull_request, workflow_dispatch, release]`.
   - **Job**: A set of steps executed on a runner (e.g., `runs-on: ubuntu-latest`). Jobs run in parallel by default unless configured with `needs`.
   - **Step**: An individual task executing shell commands (`run: ...`) or calling an Action (`uses: actions/checkout@v4`).
2. **Standard CI Workflow Steps**:
   - Checking out source code repository (`actions/checkout@v4`).
   - Setting up runtime environment (`actions/setup-python@v5`, `actions/setup-node@v4`) with dependency caching.
   - Installing project dependencies.
   - Running static analysis and linters (Ruff, Flake8, ESLint, Prettier).
   - Executing test suites (Pytest, Vitest) and uploading code coverage reports.

### Phase 2: Production Pipelines and Security
1. **GitHub Secrets and Environment Variables**: Safely passing API keys, registry credentials, and deployment tokens via repository secrets (`${{ secrets.DOCKER_PASSWORD }}`). Never committing secrets to YAML files.
2. **Matrix Builds**: Running automated test matrices across multiple operating systems (`ubuntu-latest`, `windows-latest`) or Python/Node versions concurrently.
3. **Docker Build and Push**: Using `docker/setup-buildx-action` and `docker/build-push-action` to build container images, tag them with the Git commit SHA or semantic version, and push them to GitHub Container Registry (GHCR) or Docker Hub.
4. **Continuous Deployment Stages**: Implementing protected environments with required reviewers so production deployments trigger only after manual approval.

---

## Recommended Free Official Resources

- **Official GitHub Actions Documentation (docs.github.com/actions)**: Comprehensive guide on workflow syntax, context objects, and runner specifications.
- **GitHub Skills - Continuous Integration (skills.github.com)**: Free interactive hands-on course building automated workflows step-by-step.
- **Awesome Actions**: Curated list of verified open-source GitHub Actions available in the GitHub Marketplace.

---

## Portfolio Project Idea: Complete End-to-End Automated CI/CD Pipeline

### Overview
Configure a multi-stage GitHub Actions pipeline for a full-stack web application repository that automates code quality verification, automated testing with database services, containerization, and staging deployment.

### Key Deliverables
- **PR Verification Job**: Triggers on pull requests targeting `main`. Runs linters, type checks, and spins up a temporary PostgreSQL/Redis container service to execute integration tests.
- **Security Audit Step**: Runs automated vulnerability scanning on dependencies using `pip-audit` or `npm audit`, failing the build on critical vulnerabilities.
- **Docker Build and Tagging Job**: On merges to `main`, builds optimized Docker containers, tags them with both `latest` and short commit SHA, and publishes to GitHub Container Registry (GHCR).
- **Deployment Webhook / Hook**: Triggers an automated redeployment to a cloud host (Render, Railway, or AWS ECS) using secure deploy tokens upon successful build completion.
