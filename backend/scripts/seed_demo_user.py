import asyncio
from datetime import datetime, timezone
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bson import ObjectId

from app.database.mongodb import close_db, connect_db, get_db
from app.services.security import hash_password, verify_password


async def seed_demo():
    await connect_db()
    db = get_db()
    email = "demo@careerpilot.ai"
    password = "CareerPilot2026!"
    pwd_hash = hash_password(password)
    now = datetime.now(timezone.utc)

    user = await db.users.find_one({"email": email})
    if user:
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"password_hash": pwd_hash, "name": "CareerPilot Demo", "updated_at": now}},
        )
        user_id = str(user["_id"])
        print(f"Updated existing demo user: {email} (ID: {user_id})")
    else:
        new_user = {
            "_id": ObjectId(),
            "name": "CareerPilot Demo",
            "email": email,
            "password_hash": pwd_hash,
            "created_at": now,
            "updated_at": now,
        }
        res = await db.users.insert_one(new_user)
        user_id = str(res.inserted_id)
        print(f"Created new demo user: {email} (ID: {user_id})")

    # Verify password verification works
    check = await db.users.find_one({"email": email})
    assert verify_password(password, check["password_hash"]), "Password verification check failed!"
    print(f"Password verified successfully for {email}")
    await close_db()


if __name__ == "__main__":
    asyncio.run(seed_demo())
