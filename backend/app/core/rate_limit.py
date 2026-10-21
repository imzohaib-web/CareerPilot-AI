"""Rate limiting, cost-aware AI quotas, circuit breaker, and lockout defense.

NOTE ON STORAGE:
slowapi's default storage is in-process memory, which is acceptable because
the app runs as a single uvicorn worker process on Render free tier (see Prompt 4
and render.yaml). A configurable storage URI (`config.RATE_LIMIT_STORAGE_URI`)
is supported for horizontal multi-worker scaling with Redis in the future.
"""

from collections import deque
from datetime import datetime, timedelta, timezone
import logging
import time
from typing import Any, Tuple

from fastapi import Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from starlette.responses import Response

from app import config
from app.database.mongodb import get_db
from app.services.dependencies import get_current_user
from app.services.security import decode_access_token

logger = logging.getLogger(__name__)

# ── In-Memory State for Offline & In-Process Limits ─────────────────────────
_offline_usage_counters: dict[tuple[str, str], dict[str, int]] = {}
_offline_login_attempts: dict[str, list[float]] = {}
_demo_user_ids: set[str] = set()

# Global circuit breaker: timestamps of LLM calls in the rolling 60-second window
_llm_call_timestamps: deque[float] = deque()


# ── Custom Exceptions for Uniform 429 Responses ───────────────────────────

class DailyQuotaExceeded(HTTPException):
    """Raised when an authenticated user exceeds their daily AI budget."""

    def __init__(self, detail: str, reset_at: str, retry_after: int):
        self.reset_at = reset_at
        self.retry_after = retry_after
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
            headers={"Retry-After": str(retry_after)},
        )


class AccountLockoutException(HTTPException):
    """Raised when an email exceeds failed login attempts."""

    def __init__(self, detail: str, retry_after: int):
        self.retry_after = retry_after
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
            headers={"Retry-After": str(retry_after)},
        )


class CircuitBreakerExceeded(HTTPException):
    """Raised when the global cross-user LLM calls per minute limit is hit."""

    def __init__(self, detail: str, retry_after: int = 60):
        self.retry_after = retry_after
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
            headers={"Retry-After": str(retry_after)},
        )


# ── Client IP & Rate Limit Key Functions ───────────────────────────────────

def get_real_client_ip(request: Request) -> str:
    """Extract real client IP safely behind Render reverse proxy.

    Only trusts the first hop of X-Forwarded-For when TRUSTED_PROXY is enabled.
    """
    if config.TRUSTED_PROXY:
        xff = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
        if xff:
            first_hop = xff.split(",")[0].strip()
            if first_hop:
                return first_hop
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


def get_rate_limit_key(request: Request) -> str:
    """Determine rate limit key:
    - Authenticated routes: key = user id from validated JWT (sub), never client body.
    - Unauthenticated routes: key = real client IP.
    """
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth and auth.startswith("Bearer "):
        token = auth.split(" ", 1)[1].strip()
        user_id = decode_access_token(token)
        if user_id:
            return f"user:{user_id}"
    return f"ip:{get_real_client_ip(request)}"


# ── SafeLimiter Subclass ───────────────────────────────────────────────────

class SafeLimiter(Limiter):
    """Limiter subclass that tolerates endpoints returning Pydantic models directly.

    Standard slowapi crashes with an Exception when headers_enabled=True if the
    endpoint does not explicitly take or return a Starlette Response object.
    """

    def _inject_headers(
        self, response: Response | None, current_limit: Tuple[Any, list[str]]
    ) -> Response | None:
        if response is None:
            return None
        return super()._inject_headers(response, current_limit)


# Initialize global limiter instance
limiter = SafeLimiter(
    key_func=get_rate_limit_key,
    headers_enabled=True,
    storage_uri=config.RATE_LIMIT_STORAGE_URI,
    enabled=config.RATE_LIMIT_ENABLED,
)


# ── Demo User Bypass (5x Limits) ──────────────────────────────────────────

def register_demo_user(email: str, user_id: str) -> None:
    """Register user_id as a demo account if its email is in ALLOWED_DEMO_USERS."""
    if email.strip().lower() in config.ALLOWED_DEMO_USERS:
        _demo_user_ids.add(str(user_id))


def is_demo_user_key(key: str) -> bool:
    """Check if rate limit key corresponds to a recognized demo user."""
    if key.startswith("user:"):
        user_id = key.removeprefix("user:")
        return user_id in _demo_user_ids
    return False


def is_demo_user(user_id: str | None = None, email: str | None = None) -> bool:
    """Check whether a user qualifies for the 5x demo limit multiplier."""
    if email and email.strip().lower() in config.ALLOWED_DEMO_USERS:
        return True
    if user_id and str(user_id) in _demo_user_ids:
        return True
    return False


def high_cost_rate_limit(key: str) -> str:
    mult = 5 if is_demo_user_key(key) else 1
    return f"{config.AI_HIGH_COST_PER_MINUTE * mult}/minute"


def medium_cost_rate_limit(key: str) -> str:
    mult = 5 if is_demo_user_key(key) else 1
    return f"{config.AI_MEDIUM_COST_PER_MINUTE * mult}/minute"


def low_cost_rate_limit(key: str) -> str:
    mult = 5 if is_demo_user_key(key) else 1
    return f"{config.AI_LOW_COST_PER_MINUTE * mult}/minute"


# ── Global Circuit Breaker ────────────────────────────────────────────────

def check_and_record_llm_call() -> None:
    """In-process counter limiting total LLM calls per minute across all users.

    Protects DashScope API quota from sudden traffic spikes or runaway loops.
    """
    if not config.RATE_LIMIT_ENABLED:
        return

    now = time.time()
    cutoff = now - 60.0

    # Prune calls older than 60 seconds
    while _llm_call_timestamps and _llm_call_timestamps[0] < cutoff:
        _llm_call_timestamps.popleft()

    if len(_llm_call_timestamps) >= config.GLOBAL_LLM_CALLS_PER_MINUTE:
        logger.warning(
            "Global LLM circuit breaker tripped: %d calls in the past minute (limit %d)",
            len(_llm_call_timestamps),
            config.GLOBAL_LLM_CALLS_PER_MINUTE,
        )
        raise CircuitBreakerExceeded(
            detail="Global AI capacity reached. Please try again in a few moments.",
            retry_after=60,
        )

    _llm_call_timestamps.append(now)


# ── Email Lockout Defense for Auth Login ───────────────────────────────────

async def check_email_lockout(email: str) -> None:
    """Check whether an email is temporarily locked out due to repeated failures."""
    if not config.RATE_LIMIT_ENABLED:
        return

    clean_email = email.strip().lower()
    mult = 5 if clean_email in config.ALLOWED_DEMO_USERS else 1
    max_attempts = config.AUTH_LOGIN_MAX_FAILED_ATTEMPTS * mult
    lockout_sec = config.AUTH_LOGIN_LOCKOUT_MINUTES * 60
    now = time.time()
    cutoff = now - lockout_sec

    attempts: list[float] = []

    # Check MongoDB if connected
    db = None
    try:
        db = get_db()
    except Exception:
        db = None

    if db is not None and hasattr(db, "login_attempts"):
        try:
            doc = await db.login_attempts.find_one({"email": clean_email})
            if doc:
                timestamps = doc.get("timestamps", [])
                attempts = [t for t in timestamps if t > cutoff]
        except Exception as exc:
            logger.warning("MongoDB login_attempts check failed (%s); using in-memory", exc)
            attempts = []

    if not attempts:
        raw = _offline_login_attempts.get(clean_email, [])
        attempts = [t for t in raw if t > cutoff]
        _offline_login_attempts[clean_email] = attempts

    if len(attempts) >= max_attempts:
        oldest = min(attempts)
        retry_after = max(1, int(oldest + lockout_sec - now))
        raise AccountLockoutException(
            detail="Too many failed login attempts. Please try again later.",
            retry_after=retry_after,
        )


async def record_failed_login(email: str) -> None:
    """Record a failed login attempt for the given email with a timestamp."""
    clean_email = email.strip().lower()
    now = time.time()
    lockout_sec = config.AUTH_LOGIN_LOCKOUT_MINUTES * 60
    cutoff = now - lockout_sec

    # Update in-memory fallback
    cur = [t for t in _offline_login_attempts.get(clean_email, []) if t > cutoff]
    cur.append(now)
    _offline_login_attempts[clean_email] = cur

    # Update MongoDB
    db = None
    try:
        db = get_db()
    except Exception:
        db = None

    if db is not None and hasattr(db, "login_attempts"):
        try:
            await db.login_attempts.update_one(
                {"email": clean_email},
                {
                    "$push": {"timestamps": now},
                    "$set": {"created_at": datetime.now(timezone.utc)},
                },
                upsert=True,
            )
        except Exception as exc:
            logger.warning("MongoDB record_failed_login failed: %s", exc)


async def clear_failed_logins(email: str) -> None:
    """Clear failed login attempts on successful authentication."""
    clean_email = email.strip().lower()
    _offline_login_attempts.pop(clean_email, None)

    db = None
    try:
        db = get_db()
    except Exception:
        db = None

    if db is not None and hasattr(db, "login_attempts"):
        try:
            await db.login_attempts.delete_one({"email": clean_email})
        except Exception as exc:
            logger.warning("MongoDB clear_failed_logins failed: %s", exc)


# ── Daily AI Quota Management (MongoDB usage_counters + TTL) ───────────────

def _get_reset_metadata() -> tuple[str, str, int]:
    """Calculate (today_str, reset_at_iso, retry_after_seconds) anchored to next UTC midnight."""
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    next_midnight = (now + timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    reset_at_iso = next_midnight.isoformat().replace("+00:00", "Z")
    retry_after = max(1, int((next_midnight - now).total_seconds()))
    return today_str, reset_at_iso, retry_after


async def check_and_increment_quota(
    user_id: str,
    cost_class: str,
    email: str | None = None,
) -> None:
    """Atomically check and increment the user's daily quota for the specified cost class.

    Cost classes: 'high', 'medium', 'low'.
    """
    if not config.RATE_LIMIT_ENABLED:
        return

    # Check demo bypass multiplier
    is_demo = is_demo_user(user_id=user_id, email=email)
    mult = 5 if is_demo else 1

    if cost_class == "high":
        limit = config.AI_HIGH_COST_DAILY_LIMIT * mult
    elif cost_class == "medium":
        limit = config.AI_MEDIUM_COST_DAILY_LIMIT * mult
    else:
        # low-cost has no daily cap, only per-minute and upload caps
        return

    today_str, reset_at_iso, retry_after = _get_reset_metadata()

    db = None
    try:
        db = get_db()
    except Exception:
        db = None

    if db is not None and hasattr(db, "usage_counters"):
        try:
            doc = await db.usage_counters.find_one({"user_id": user_id, "date": today_str})
            current_count = doc.get("counts", {}).get(cost_class, 0) if doc else 0
            if current_count >= limit:
                raise DailyQuotaExceeded(
                    detail="Daily AI usage limit reached",
                    reset_at=reset_at_iso,
                    retry_after=retry_after,
                )

            # Atomic increment with TTL creation
            await db.usage_counters.update_one(
                {"user_id": user_id, "date": today_str},
                {
                    "$inc": {f"counts.{cost_class}": 1},
                    "$setOnInsert": {"created_at": datetime.now(timezone.utc)},
                },
                upsert=True,
            )
            return
        except DailyQuotaExceeded:
            raise
        except Exception as exc:
            logger.warning("MongoDB usage_counters error (%s); falling back to in-memory", exc)

    # In-memory offline fallback
    key = (user_id, today_str)
    counts = _offline_usage_counters.setdefault(key, {})
    current = counts.get(cost_class, 0)
    if current >= limit:
        raise DailyQuotaExceeded(
            detail="Daily AI usage limit reached",
            reset_at=reset_at_iso,
            retry_after=retry_after,
        )
    counts[cost_class] = current + 1


# ── FastAPI Dependencies for Cost-Aware Route Protection ────────────────────

async def require_high_cost_quota(
    current_user: dict = Depends(get_current_user),
) -> None:
    """Enforce circuit breaker and high-cost daily AI quota (resume, roadmap, interview, gap)."""
    check_and_record_llm_call()
    user_id = str(current_user["_id"])
    email = current_user.get("email")
    if email:
        register_demo_user(email, user_id)
    await check_and_increment_quota(user_id=user_id, cost_class="high", email=email)


async def require_medium_cost_quota(
    current_user: dict = Depends(get_current_user),
) -> None:
    """Enforce circuit breaker and medium-cost daily AI quota (chat, rag chat, test)."""
    check_and_record_llm_call()
    user_id = str(current_user["_id"])
    email = current_user.get("email")
    if email:
        register_demo_user(email, user_id)
    await check_and_increment_quota(user_id=user_id, cost_class="medium", email=email)


async def require_low_cost_quota(
    current_user: dict = Depends(get_current_user),
) -> None:
    """Enforce low-cost tracking (rag query, rag upload)."""
    user_id = str(current_user["_id"])
    email = current_user.get("email")
    if email:
        register_demo_user(email, user_id)
    await check_and_increment_quota(user_id=user_id, cost_class="low", email=email)
