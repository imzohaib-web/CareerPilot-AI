"""MongoDB connection lifecycle using Motor.

A single AsyncIOMotorClient is created at application startup and closed at
shutdown. Services obtain the database through ``get_db``.
"""

import logging
import dns.resolver

from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app import config

logger = logging.getLogger(__name__)

# Configure DNS resolver to use Google DNS fallback if local system DNS fails SRV lookups
try:
    resolver = dns.resolver.Resolver(configure=True)
    resolver.nameservers = ['8.8.8.8', '1.1.1.1'] + resolver.nameservers
    dns.resolver.default_resolver = resolver
except Exception:
    pass

_client: AsyncIOMotorClient | None = None


async def connect_db() -> None:
    """Connect to MongoDB and ensure required indexes exist."""
    global _client
    if _client is not None:
        return
    if not config.MONGODB_URI:
        logger.warning("MONGODB_URI is not configured; running in offline mode")
        return

    try:
        _client = AsyncIOMotorClient(config.MONGODB_URI, serverSelectionTimeoutMS=5000)
        await _client.admin.command("ping")
        db = _client[config.MONGODB_NAME]
        await db.users.create_index("email", unique=True)
        await db.career_profiles.create_index("user_id", unique=True)
        await db.resumes.create_index("user_id")
        await db.skill_gap_analyses.create_index("user_id")
        await db.conversations.create_index("user_id")
        await db.roadmaps.create_index("user_id")
        await db.interviews.create_index("user_id")
        await db.rag_documents.create_index("user_id")
        await db.rag_chunks.create_index([("document_id", 1), ("user_id", 1)])
        logger.info("Connected to MongoDB database '%s'", config.MONGODB_NAME)
    except Exception as exc:
        _client = None
        logger.warning("Could not connect to MongoDB: %s (running in offline mode)", exc)


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
