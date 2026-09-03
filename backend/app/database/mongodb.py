"""MongoDB connection lifecycle using Motor.

A single AsyncIOMotorClient is created at application startup and closed at
shutdown. Services obtain the database through ``get_db``.

Production notes:

- Configuration comes exclusively from environment variables (``MONGODB_URI``,
  ``MONGODB_NAME``); the local ``backend/.env`` is only a development fallback
  and never overrides real environment variables (Render dashboard values win).
- Connection diagnostics are sanitized: exception class names and coarse
  categories only — the URI, credentials, and raw provider messages are never
  logged or surfaced to clients.
- Failed connections self-heal: ``connect_db`` retries (throttled) when polled
  by the health endpoint, so a transient startup failure (DNS propagation, an
  Atlas IP whitelist added after deploy) recovers without a restart.
"""

import asyncio
import logging
import time

import dns.exception
import dns.resolver
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app import config

logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None
_connect_lock: asyncio.Lock | None = None
_last_attempt: float = 0.0
_uri_missing_logged: bool = False

# Minimum seconds between lazy reconnection attempts (driven by /api/health).
_RETRY_INTERVAL_SECONDS = 10.0
# Atlas server-selection window; fails fast enough for health checks.
_SERVER_SELECTION_TIMEOUT_MS = 5000


def _enable_public_dns_fallback() -> None:
    """Prepend public resolvers (Google/Cloudflare) for Atlas SRV lookups.

    Workaround for local networks whose DNS cannot resolve ``mongodb+srv``
    records. Applied lazily — only after a DNS-related connection failure —
    so production containers keep using their platform's own resolver.
    """
    try:
        resolver = dns.resolver.Resolver(configure=True)
        public = ["8.8.8.8", "1.1.1.1"]
        resolver.nameservers = public + [
            ns for ns in resolver.nameservers if ns not in public
        ]
        dns.resolver.default_resolver = resolver
        logger.info("Enabled public DNS fallback for MongoDB SRV resolution")
    except Exception:
        logger.debug("Could not enable public DNS fallback")


def _is_dns_error(exc: Exception) -> bool:
    """Whether the failure looks like DNS/SRV resolution.

    ``str(exc)`` is inspected to decide the category only — it is never logged.
    """
    if isinstance(exc, dns.exception.DNSException):
        return True
    if type(exc).__name__ in ("InvalidURI", "ConfigurationError"):
        text = str(exc).lower()
        return any(key in text for key in ("dns", "resolve", "srv", "timeout"))
    return False


def _classify_error(exc: Exception) -> str:
    """Coarse, credential-free category safe for production logs."""
    name = type(exc).__name__
    code = getattr(exc, "code", None)
    if name == "ServerSelectionTimeoutError":
        return (
            "server_selection_timeout: no MongoDB host reachable in time — "
            "check Atlas Network Access IP whitelist, cluster state, or URI host"
        )
    if name == "OperationFailure":
        if code in (18, 33):
            return (
                f"authentication_failed (code={code}): check the Atlas "
                "database user credentials in MONGODB_URI"
            )
        if code == 13:
            return (
                f"permission_denied (code={code}): the database user lacks "
                "required privileges"
            )
        return f"operation_failed (code={code})"
    if _is_dns_error(exc):
        return "dns_resolution_failed: could not resolve the MongoDB SRV hostname"
    if name in ("InvalidURI", "ConfigurationError"):
        return "invalid_uri_or_configuration: check the MONGODB_URI format"
    return name


async def connect_db() -> bool:
    """Connect to MongoDB (idempotent, throttled) and ensure indexes exist.

    Returns True when the database is connected. On failure the application
    keeps running in offline mode; later calls retry after
    ``_RETRY_INTERVAL_SECONDS`` so transient failures self-heal through the
    health endpoint instead of requiring a restart.
    """
    global _connect_lock, _last_attempt, _uri_missing_logged
    if _client is not None:
        return True

    if not config.MONGODB_URI:
        if not _uri_missing_logged:
            logger.warning(
                "MONGODB_URI is not configured; running in offline mode "
                "(uri_configured=false)"
            )
            _uri_missing_logged = True
        return False

    now = time.monotonic()
    if _last_attempt and (now - _last_attempt) < _RETRY_INTERVAL_SECONDS:
        return False
    _last_attempt = now

    if _connect_lock is None:
        _connect_lock = asyncio.Lock()
    async with _connect_lock:
        if _client is not None:
            return True
        logger.info(
            "MongoDB connection attempt started (uri_configured=true, "
            "database=%s)",
            config.MONGODB_NAME,
        )
        return await _attempt_connect()


async def _attempt_connect() -> bool:
    """Create the Motor client, verify connectivity with a ping, set ``_client``."""
    global _client
    try:
        client = AsyncIOMotorClient(
            config.MONGODB_URI,
            serverSelectionTimeoutMS=_SERVER_SELECTION_TIMEOUT_MS,
        )
    except Exception as exc:
        category = _classify_error(exc)
        if _is_dns_error(exc):
            # One retry through public resolvers — fixes local networks whose
            # DNS cannot resolve Atlas SRV records without forcing public DNS
            # onto production containers.
            logger.warning(
                "MongoDB client creation failed (%s); retrying with public "
                "DNS resolvers",
                category,
            )
            _enable_public_dns_fallback()
            try:
                client = AsyncIOMotorClient(
                    config.MONGODB_URI,
                    serverSelectionTimeoutMS=_SERVER_SELECTION_TIMEOUT_MS,
                )
            except Exception as retry_exc:
                logger.warning(
                    "MongoDB connection failed (%s); running in offline mode",
                    _classify_error(retry_exc),
                )
                return False
        else:
            logger.warning(
                "MongoDB connection failed (%s); running in offline mode",
                category,
            )
            return False

    try:
        await client.admin.command("ping")
    except Exception as exc:
        client.close()
        logger.warning(
            "MongoDB ping failed (%s); running in offline mode",
            _classify_error(exc),
        )
        return False

    _client = client
    logger.info(
        "Connected to MongoDB database '%s' (ping=ok)", config.MONGODB_NAME
    )
    await _ensure_indexes()
    return True


async def _ensure_indexes() -> None:
    """Create required indexes (idempotent — existing data is preserved).

    Best effort: an index failure (e.g. a restricted database user) must not
    discard an otherwise working connection, so it only logs a warning.
    """
    client = _client
    if client is None:
        return
    db = client[config.MONGODB_NAME]
    try:
        await db.users.create_index("email", unique=True)
        await db.career_profiles.create_index("user_id", unique=True)
        await db.resumes.create_index("user_id")
        await db.skill_gap_analyses.create_index("user_id")
        await db.conversations.create_index("user_id")
        await db.roadmaps.create_index("user_id")
        await db.interviews.create_index("user_id")
        await db.rag_documents.create_index("user_id")
        await db.rag_chunks.create_index([("document_id", 1), ("user_id", 1)])
        logger.info("MongoDB indexes verified for database '%s'", config.MONGODB_NAME)
    except Exception as exc:
        logger.warning(
            "Could not ensure MongoDB indexes (%s); continuing without them",
            _classify_error(exc),
        )


async def close_db() -> None:
    """Close the MongoDB connection during shutdown."""
    global _client
    if _client is not None:
        _client.close()
        _client = None
        logger.info("Closed MongoDB connection")


def get_db() -> AsyncIOMotorDatabase:
    """Return the shared database handle for services and routes."""
    if _client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available",
        )
    return _client[config.MONGODB_NAME]
