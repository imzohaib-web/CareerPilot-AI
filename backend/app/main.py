"""CareerPilot AI — FastAPI application entry point (v1.1)."""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import config
from app.database.mongodb import (
    close_db,
    connect_db,
    get_connection_details,
    get_connection_status,
    get_db,
    is_connected,
)
from app.routes import (
    ai,
    auth,
    chat,
    interview,
    learning,
    profile,
    progress,
    rag,
    resume,
    roadmap,
    skill_gap,
)
from app.services.knowledge_seeder import seed_knowledge_background
from app.services.dependencies import get_current_user

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Origins are public URLs (no secrets) — logging them makes CORS
    # misconfiguration (the classic cause of preflight 400s) instantly
    # diagnosable in Render logs.
    logger.info(
        "CORS allowed origins: %s",
        ", ".join(config.CORS_ORIGINS) if config.CORS_ORIGINS else "(none configured)",
    )
    connected = await connect_db()
    if not connected:
        logger.warning("Running in memory mode: using local seed data")
        asyncio.create_task(seed_knowledge_background(offline=True))
    else:
        # Non-blocking startup seeding of curated knowledge base (background task)
        asyncio.create_task(seed_knowledge_background())

    # Create rate limiting and abuse prevention indexes
    try:
        db = get_db()
        if hasattr(db, "usage_counters"):
            await db.usage_counters.create_index("created_at", expireAfterSeconds=259200)
            await db.usage_counters.create_index([("user_id", 1), ("date", 1)], unique=True)
        if hasattr(db, "login_attempts"):
            await db.login_attempts.create_index("created_at", expireAfterSeconds=1800)
            await db.login_attempts.create_index("email", unique=True)
    except Exception as exc:
        logger.debug("Rate limit indexes skipped or pending connection: %s", exc)

    yield
    await close_db()


app = FastAPI(title="CareerPilot AI API", lifespan=lifespan)

# Attach SlowAPI Limiter to application state
from app.core.rate_limit import (
    AccountLockoutException,
    CircuitBreakerExceeded,
    DailyQuotaExceeded,
    RateLimitExceeded,
    limiter,
)

app.state.limiter = limiter

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    # Authentication uses JWT Bearer tokens in the Authorization header —
    # no browser cookies — so credentialed CORS is unnecessary.
    allow_credentials=False,
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
app.include_router(learning.router)
app.include_router(chat.router)


@app.get("/api/health")
async def health_check() -> dict:
    """Report API health, storage mode, and MongoDB connectivity. Never rate limited."""
    try:
        await connect_db()
        if is_connected():
            await get_db().command("ping")
    except Exception:
        pass
    return get_connection_status()


@app.get("/api/health/details")
async def health_check_details(_: dict = Depends(get_current_user)) -> dict:
    """Report detailed connection diagnostics for authenticated debugging."""
    try:
        await connect_db()
        if is_connected():
            await get_db().command("ping")
    except Exception:
        pass
    return get_connection_details()


@app.exception_handler(RateLimitExceeded)
async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Return standard sanitized JSON shape for slowapi rate limits with Retry-After header."""
    detail = f"Rate limit exceeded: {exc.detail}"
    response = JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"detail": detail},
    )
    view_rate_limit = getattr(request.state, "view_rate_limit", None)
    if view_rate_limit:
        response = limiter._inject_headers(response, view_rate_limit) or response
    else:
        response.headers["Retry-After"] = "60"
    return response


@app.exception_handler(DailyQuotaExceeded)
async def daily_quota_handler(request: Request, exc: DailyQuotaExceeded) -> JSONResponse:
    """Return 429 with detail and reset_at when daily AI budget is exceeded."""
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"detail": exc.detail, "reset_at": exc.reset_at},
        headers={"Retry-After": str(exc.retry_after)},
    )


@app.exception_handler(AccountLockoutException)
async def account_lockout_handler(request: Request, exc: AccountLockoutException) -> JSONResponse:
    """Return 429 with generic detail when repeated failed logins trigger lockout."""
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"detail": exc.detail},
        headers={"Retry-After": str(exc.retry_after)},
    )


@app.exception_handler(CircuitBreakerExceeded)
async def circuit_breaker_handler(request: Request, exc: CircuitBreakerExceeded) -> JSONResponse:
    """Return 429 when global cross-user LLM calls per minute limit is reached."""
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"detail": exc.detail},
        headers={"Retry-After": str(exc.retry_after)},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Return a controlled JSON error; never expose stack traces."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
