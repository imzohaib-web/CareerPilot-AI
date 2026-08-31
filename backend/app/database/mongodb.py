"""MongoDB connection lifecycle using Motor.

A single AsyncIOMotorClient is created at application startup and closed at
shutdown. Services obtain the database through ``get_db``.
"""

import logging

from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app import config

logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None


async def connect_db() -> None:
    """Connect to MongoDB and ensure required indexes exist."""
    global _client
    if _client is not None:
        return
    if not config.MONGODB_URI:
        raise RuntimeError("MONGODB_URI is not configured in the environment")

    _client = AsyncIOMotorClient(config.MONGODB_URI, serverSelectionTimeoutMS=5000)
    try:
        await _client.admin.command("ping")
    except Exception as exc:
        _client = None
        raise RuntimeError(f"Could not connect to MongoDB: {exc}") from exc

    db = _client[config.MONGODB_NAME]
    await db.users.create_index("email", unique=True)
    await db.career_profiles.create_index("user_id", unique=True)
    await db.resumes.create_index("user_id")
    logger.info("Connected to MongoDB database '%s'", config.MONGODB_NAME)


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
