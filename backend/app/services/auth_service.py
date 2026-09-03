"""Authentication business logic: registration, login, user serialization."""

from datetime import datetime, timezone

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from app.database.mongodb import get_db
from app.schemas.auth import UserResponse
from app.services.security import hash_password, verify_password


class EmailAlreadyRegisteredError(Exception):
    """Raised when a registration attempt uses an existing email."""


# In-memory user store for offline mode (email -> user document)
_offline_users: dict[str, dict] = {}


def serialize_user(user_doc: dict) -> UserResponse:
    """Build a safe user response; never exposes the password hash."""
    return UserResponse(
        id=str(user_doc["_id"]),
        name=user_doc["name"],
        email=user_doc["email"],
        created_at=user_doc["created_at"],
    )


async def register_user(name: str, email: str, password: str) -> UserResponse:
    """Create a new user with a hashed password and return a safe response."""
    # Check offline cache first
    if email in _offline_users:
        raise EmailAlreadyRegisteredError(email)

    now = datetime.now(timezone.utc)
    document = {
        "_id": ObjectId(),
        "name": name,
        "email": email,
        "password_hash": hash_password(password),
        "created_at": now,
        "updated_at": now,
    }

    # Try to save to database; fall back to in-memory cache on offline
    try:
        await get_db().users.insert_one(document)
    except DuplicateKeyError as exc:
        raise EmailAlreadyRegisteredError(email) from exc
    except Exception as exc:
        # Offline mode: use in-memory cache
        import logging
        logging.warning("Could not save user to MongoDB (%s); using in-memory cache", exc)
        _offline_users[email] = document

    return serialize_user(document)


async def authenticate_user(email: str, password: str) -> UserResponse | None:
    """Verify credentials and return the user, or None if invalid."""
    # Try database first
    try:
        user_doc = await get_db().users.find_one({"email": email})
        if user_doc is not None:
            if verify_password(password, user_doc["password_hash"]):
                return serialize_user(user_doc)
            return None
    except Exception:
        pass  # Fall through to offline cache

    # Check offline cache
    if email in _offline_users:
        user_doc = _offline_users[email]
        if verify_password(password, user_doc["password_hash"]):
            return serialize_user(user_doc)
    return None


async def get_user_by_id(user_id: str) -> dict | None:
    """Fetch the raw user document by id."""
    try:
        oid = ObjectId(user_id)
    except Exception:
        return None

    # Try database first
    try:
        user_doc = await get_db().users.find_one({"_id": oid})
        if user_doc is not None:
            return user_doc
    except Exception:
        pass  # Fall through to offline cache

    # Check offline cache
    for user_doc in _offline_users.values():
        if user_doc["_id"] == oid:
            return user_doc

    return None
