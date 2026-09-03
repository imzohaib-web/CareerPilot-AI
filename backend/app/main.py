"""CareerPilot AI — FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import config
from app.database.mongodb import close_db, connect_db, get_db
from app.routes import ai, auth, chat, interview, profile, progress, rag, resume, roadmap, skill_gap

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()


app = FastAPI(title="CareerPilot AI API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(ai.router)
app.include_router(resume.router)
app.include_router(skill_gap.router)
app.include_router(roadmap.router)
app.include_router(interview.router)
app.include_router(rag.router)
app.include_router(progress.router)
app.include_router(chat.router)


@app.get("/api/health")
async def health_check() -> dict:
    """Report API health and MongoDB connectivity (lightweight ping)."""
    database = "connected"
    try:
        # Throttled reconnect attempt — no-op when already connected. A
        # transient startup failure (DNS propagation, Atlas IP whitelist
        # added after deploy) therefore self-heals without a restart.
        await connect_db()
        await get_db().command("ping")
    except Exception:
        database = "disconnected"
    return {"status": "ok", "database": database}


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Return a controlled JSON error; never expose stack traces."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
