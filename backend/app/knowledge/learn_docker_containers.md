---
title: "Docker Containerization, Multi-Stage Builds, and Compose"
category: "learning_path"
role: "devops"
source_note: "Curated learning guide for Docker containerization, security hardening, and multi-service orchestration."
---

# Docker Containerization, Multi-Stage Builds, and Compose

Docker packages applications and their complete runtime dependencies into lightweight, portable containers. Containerization eliminates the classic "it works on my machine" dilemma and forms the bedrock of modern cloud-native deployments.

## Learning Roadmap

### Phase 1: Container Mechanics and Dockerfiles
1. **Images vs Containers**: An image is a read-only template with instructions; a container is a runnable, isolated instance of an image.
2. **Key Dockerfile Directives**:
   - `FROM`: Choosing minimal, verified base images (e.g., `python:3.11-slim`, `node:20-alpine`).
   - `WORKDIR`: Setting a predictable absolute working directory.
   - `COPY` vs `ADD`: Preferring `COPY` for simple file transfers; ordering copy steps to leverage Docker layer caching (copying dependency manifests before application code).
   - `RUN`: Executing build commands; chaining steps with `&&` to reduce image layers.
   - `ENV` and `ARG`: Distinguishing runtime environment variables from build-time arguments.
   - `EXPOSE`: Documenting listening ports.
   - `CMD` vs `ENTRYPOINT`: Setting default execution binaries and overridable flags.
3. **Security Hardening**: Never running containers as the `root` user in production. Adding a dedicated unprivileged user (`RUN useradd -m -u 1000 appuser && USER appuser`).
4. **`.dockerignore` Best Practices**: Excluding local virtual environments, `.git` histories, secrets (`.env`), cache files (`__pycache__`, `.pytest_cache`), and test reports from image builds.

### Phase 2: Multi-Stage Builds and Docker Compose
1. **Multi-Stage Builds**: Using separate builder stages to compile assets or install build-time compilers (like gcc or npm), and copying only the compiled artifacts into a clean, minimal runtime stage. Shrinks final images from over 1GB to under 150MB.
2. **Docker Compose (`docker-compose.yml`)**: Defining multi-container development environments:
   - Web application services.
   - Database services (PostgreSQL, MongoDB) with persistent named volumes.
   - In-memory caches (Redis).
   - Defining networks, dependency order (`depends_on`), health checks (`healthcheck`), and environment variable pass-through.
3. **CLI Operations**: `docker build -t app:v1 .`, `docker run -p 8000:8000 -d app:v1`, `docker logs -f <id>`, `docker exec -it <id> sh`, `docker compose up -d`, `docker compose down -v`.

---

## Recommended Free Official Resources

- **Official Docker Documentation (docs.docker.com)**: Official guides on Dockerfile syntax, compose specifications, and storage drivers.
- **Docker Curriculum by Prakhar Srivastav (docker-curriculum.com)**: Highly rated, hands-on beginner-to-advanced tutorial covering practical web application containerization.
- **Play with Docker (labs.play-with-docker.com)**: Free in-browser interactive Docker playground provided by Docker.

---

## Portfolio Project Idea: Production-Grade Containerized Micro-Stack

### Overview
Create a repository containing a complete containerized web stack featuring a FastAPI backend, a React/Vite frontend, a PostgreSQL database, and an Nginx reverse proxy routing traffic seamlessly.

### Key Deliverables
- **Optimized Multi-Stage Dockerfiles**: A backend multi-stage Dockerfile producing a slim Python container (<150MB) running as a non-root user, and a frontend Dockerfile building Vite assets and serving them via Nginx Alpine (<30MB).
- **Docker Compose Configuration**: An orchestration file linking backend, frontend, database, and reverse proxy with health checks ensuring backend waits for PostgreSQL to accept connections before starting.
- **Persistent Volume Verification**: Data persists safely across `docker compose down` and `docker compose up` cycles.
- **Automated Build Test**: A GitHub Actions workflow verifying that both images build cleanly and pass container vulnerability scans with Trivy.
