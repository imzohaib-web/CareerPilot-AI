"""Career profile business logic.

One profile per user, keyed by the authenticated user's id (never by a
client-provided id).
"""

from datetime import datetime, timezone

from bson import ObjectId

from app.database.mongodb import get_db
from app.schemas.profile import ProfileResponse, ProfileUpsertRequest


def serialize_profile(doc: dict) -> ProfileResponse:
    """Convert a stored profile document into an API response."""
    return ProfileResponse(
        id=str(doc["_id"]),
        user_id=str(doc["user_id"]),
        education=doc.get("education", ""),
        university=doc.get("university", ""),
        experience_level=doc.get("experience_level", "student"),
        target_role=doc.get("target_role", ""),
        career_goal=doc.get("career_goal", ""),
        skills=doc.get("skills", []),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


async def get_profile(user_id: str) -> ProfileResponse | None:
    """Return the user's profile, or None if not created yet."""
    doc = await get_db().career_profiles.find_one({"user_id": ObjectId(user_id)})
    if doc is None:
        return None
    return serialize_profile(doc)


async def upsert_profile(
    user_id: str, payload: ProfileUpsertRequest
) -> ProfileResponse:
    """Create or fully replace the user's career profile."""
    now = datetime.now(timezone.utc)
    collection = get_db().career_profiles
    existing = await collection.find_one({"user_id": ObjectId(user_id)})

    if existing is None:
        document = {
            "user_id": ObjectId(user_id),
            **payload.model_dump(),
            "created_at": now,
            "updated_at": now,
        }
        result = await collection.insert_one(document)
        document["_id"] = result.inserted_id
        return serialize_profile(document)

    await collection.update_one(
        {"_id": existing["_id"]},
        {"$set": {**payload.model_dump(), "updated_at": now}},
    )
    updated = await collection.find_one({"_id": existing["_id"]})
    return serialize_profile(updated)
