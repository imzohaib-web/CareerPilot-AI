"""Password hashing and JWT utilities.

Uses bcrypt directly (passlib is intentionally not used: passlib 1.7.4 is
incompatible with bcrypt >= 4.1).
"""

from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app import config


def hash_password(password: str) -> str:
    """Hash a plaintext password with bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Check a plaintext password against a stored bcrypt hash."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: str) -> str:
    """Create a JWT containing only the user id and expiry."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=config.JWT_EXPIRES_MINUTES)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM)


def decode_access_token(token: str) -> str | None:
    """Return the user id from a valid JWT, or None if invalid/expired."""
    try:
        payload = jwt.decode(
            token, config.JWT_SECRET, algorithms=[config.JWT_ALGORITHM]
        )
    except JWTError:
        return None
    return payload.get("sub")
