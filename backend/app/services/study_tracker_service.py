"""Per-user daily learning logs linked to the latest generated roadmap."""

import calendar
import logging
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from bson import ObjectId
from fastapi import HTTPException, status

from app.database.mongodb import get_db, is_connected
from app.schemas.study_tracker import (
    StudyCalendarResponse,
    StudyDayRecord,
    StudyDayUpdate,
    StudyPreferencesResponse,
    StudyPreferencesUpdate,
)
from app.services import roadmap_service

logger = logging.getLogger(__name__)
DEFAULT_MISSED_DAY_THRESHOLD = 1
_offline_days: dict[tuple[str, str, str], dict] = {}
_offline_preferences: dict[str, dict] = {}


async def get_calendar(
    user_id: str, month: str, timezone_name: str = "UTC"
) -> StudyCalendarResponse:
    """Return a month of study records and the user's current missed-day status."""
    month_start = _parse_month(month)
    month_end = date(
        month_start.year,
        month_start.month,
        calendar.monthrange(month_start.year, month_start.month)[1],
    )
    preferences = await _get_preferences(user_id, timezone_name)
    roadmap = await _get_latest_roadmap(user_id)
    tz = ZoneInfo(preferences["timezone"])
    roadmap_start = _as_date(
        roadmap.get("created_at") or datetime.now(timezone.utc), tz
    )
    today = datetime.now(tz).date()
    if month_end < roadmap_start:
        days: list[StudyDayRecord] = []
    else:
        start = max(month_start, roadmap_start)
        end = min(month_end, today)
        days = await _get_days(user_id, str(roadmap["_id"]), start, end) if start <= end else []

    all_days = await _get_days(
        user_id,
        str(roadmap["_id"]),
        roadmap_start,
        today,
    )
    missed_count = _consecutive_missed_days(
        roadmap_start, today, {record.date for record in all_days}
    )
    threshold = preferences["missed_day_threshold"]
    missed_alert = None
    if missed_count >= threshold:
        missed_alert = (
            f"You have missed {missed_count} consecutive learning "
            f"{'day' if missed_count == 1 else 'days'}. Log a study day to get back on track."
        )
        await _create_missed_alert(
            user_id,
            str(roadmap["_id"]),
            missed_count,
            threshold,
            all_days,
        )

    return StudyCalendarResponse(
        roadmap_id=str(roadmap["_id"]),
        roadmap_title=roadmap.get("roadmap", {}).get("title", roadmap.get("target_role", "Roadmap")),
        roadmap_start_date=roadmap_start,
        month=month,
        timezone=preferences["timezone"],
        storage_mode="mongodb" if is_connected() else "memory",
        days=days,
        missed_day_threshold=threshold,
        active_missed_days=missed_count,
        missed_alert=missed_alert,
    )


async def update_study_day(
    user_id: str,
    day: date,
    update: StudyDayUpdate,
) -> None:
    """Upsert or remove one user's study record for a roadmap day."""
    roadmap = await _get_latest_roadmap(user_id)
    preferences = await _get_preferences(user_id, "UTC")
    tz = ZoneInfo(preferences["timezone"])
    today = datetime.now(tz).date()
    roadmap_start = _as_date(
        roadmap.get("created_at") or datetime.now(timezone.utc), tz
    )
    if day > today:
        raise HTTPException(status_code=422, detail="Future days cannot be marked as studied.")
    if day < roadmap_start:
        raise HTTPException(
            status_code=422,
            detail="Study days must be on or after your roadmap start date.",
        )

    key = (user_id, str(roadmap["_id"]), day.isoformat())
    if not update.completed:
        try:
            await get_db().learning_days.delete_one(
                {
                    "user_id": ObjectId(user_id),
                    "roadmap_id": roadmap["_id"],
                    "date": day.isoformat(),
                }
            )
        except Exception as exc:
            logger.warning("Could not delete study day (%s); checking cache", type(exc).__name__)
        _offline_days.pop(key, None)
        return

    document = {
        "user_id": ObjectId(user_id),
        "roadmap_id": roadmap["_id"],
        "date": day.isoformat(),
        "minutes": update.minutes,
        "note": update.note.strip(),
        "updated_at": datetime.now(timezone.utc),
    }
    try:
        await get_db().learning_days.update_one(
            {
                "user_id": ObjectId(user_id),
                "roadmap_id": roadmap["_id"],
                "date": day.isoformat(),
            },
            {"$set": document},
            upsert=True,
        )
    except Exception as exc:
        logger.warning("Could not persist study day (%s); using offline cache", type(exc).__name__)
    _offline_days[key] = document


async def update_preferences(
    user_id: str, update: StudyPreferencesUpdate
) -> StudyPreferencesResponse:
    """Persist the user's missed-day notification threshold and timezone."""
    document = {
        "user_id": ObjectId(user_id),
        "missed_day_threshold": update.missed_day_threshold,
        "timezone": update.timezone,
    }
    try:
        await get_db().learning_preferences.update_one(
            {"user_id": ObjectId(user_id)},
            {"$set": {key: value for key, value in document.items() if key != "user_id"}},
            upsert=True,
        )
    except Exception as exc:
        logger.warning("Could not persist learning preferences (%s); using offline cache", type(exc).__name__)
    _offline_preferences[user_id] = document
    return StudyPreferencesResponse(
        missed_day_threshold=update.missed_day_threshold,
        timezone=update.timezone,
    )


async def refresh_missed_alert(user_id: str) -> None:
    """Generate a deduplicated in-app alert when the user's missed-day limit is met."""
    try:
        preferences = await _get_preferences(user_id, "UTC")
        roadmap = await _get_latest_roadmap(user_id)
    except HTTPException as exc:
        if exc.status_code == status.HTTP_404_NOT_FOUND:
            return
        raise

    timezone_name = preferences["timezone"]
    tz = ZoneInfo(timezone_name)
    start = _as_date(roadmap.get("created_at") or datetime.now(timezone.utc), tz)
    today = datetime.now(tz).date()
    records = await _get_days(
        user_id, str(roadmap["_id"]), start, today
    )
    missed_count = _consecutive_missed_days(
        start, today, {record.date for record in records}
    )
    if missed_count < preferences["missed_day_threshold"]:
        return
    await _create_missed_alert(
        user_id,
        str(roadmap["_id"]),
        missed_count,
        preferences["missed_day_threshold"],
        records,
    )


async def _get_latest_roadmap(user_id: str) -> dict:
    try:
        doc = await get_db().roadmaps.find_one(
            {"user_id": ObjectId(user_id)}, sort=[("created_at", -1)]
        )
    except Exception as exc:
        logger.debug("Could not read roadmap for study tracker (%s)", type(exc).__name__)
        doc = None
    if doc is None:
        doc = roadmap_service._offline_roadmaps.get(user_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Generate a roadmap to start tracking study days.")
    return doc


async def _get_preferences(user_id: str, timezone_fallback: str) -> dict:
    try:
        doc = await get_db().learning_preferences.find_one(
            {"user_id": ObjectId(user_id)}
        )
    except Exception as exc:
        logger.debug("Could not read learning preferences (%s)", type(exc).__name__)
        doc = None
    doc = doc or _offline_preferences.get(user_id, {})
    timezone_name = doc.get("timezone", timezone_fallback)
    try:
        ZoneInfo(timezone_name)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="Use a valid IANA timezone.") from exc
    if not doc and timezone_name != "UTC":
        try:
            await get_db().learning_preferences.update_one(
                {"user_id": ObjectId(user_id)},
                {
                    "$setOnInsert": {
                        "missed_day_threshold": DEFAULT_MISSED_DAY_THRESHOLD,
                        "timezone": timezone_name,
                    }
                },
                upsert=True,
            )
        except Exception as exc:
            logger.debug("Could not persist default learning preferences (%s)", type(exc).__name__)
        _offline_preferences[user_id] = {
            "user_id": ObjectId(user_id),
            "missed_day_threshold": DEFAULT_MISSED_DAY_THRESHOLD,
            "timezone": timezone_name,
        }
    return {
        "missed_day_threshold": int(
            doc.get("missed_day_threshold", DEFAULT_MISSED_DAY_THRESHOLD)
        ),
        "timezone": timezone_name,
    }


async def _get_days(
    user_id: str, roadmap_id: str, start: date, end: date
) -> list[StudyDayRecord]:
    if start > end:
        return []
    query = {
        "user_id": ObjectId(user_id),
        "roadmap_id": ObjectId(roadmap_id),
        "date": {"$gte": start.isoformat(), "$lte": end.isoformat()},
    }
    try:
        cursor = get_db().learning_days.find(query).sort("date", 1)
        documents = await cursor.to_list(length=400)
    except Exception as exc:
        logger.debug("Could not read study days (%s); checking cache", type(exc).__name__)
        documents = [
            document
            for (cached_user, cached_roadmap, cached_date), document in _offline_days.items()
            if cached_user == user_id
            and cached_roadmap == roadmap_id
            and start.isoformat() <= cached_date <= end.isoformat()
        ]
    for key, document in _offline_days.items():
        if (
            key[0] == user_id
            and key[1] == roadmap_id
            and start.isoformat() <= key[2] <= end.isoformat()
            and not any(existing.get("date") == key[2] for existing in documents)
        ):
            documents.append(document)
    return [
        StudyDayRecord(
            date=document["date"],
            minutes=document.get("minutes", 0),
            note=document.get("note", ""),
            updated_at=document["updated_at"],
        )
        for document in sorted(documents, key=lambda item: item["date"])
    ]


async def _create_missed_alert(
    user_id: str,
    roadmap_id: str,
    missed_count: int,
    threshold: int,
    records: list[StudyDayRecord],
) -> None:
    from app.services.learning_service import _offline_alerts

    last_study_day = max((record.date for record in records), default=None)
    streak_anchor = last_study_day.isoformat() if last_study_day else "no-study-day"
    dedupe_key = f"missed-learning:{roadmap_id}:{streak_anchor}"
    title = "Your learning streak needs attention"
    message = (
        f"You have missed {missed_count} consecutive learning "
        f"{'day' if missed_count == 1 else 'days'}, reaching your "
        f"{threshold}-day alert setting. Open your learning calendar to log a day and get back on track."
    )
    document = {
        "_id": ObjectId(),
        "user_id": ObjectId(user_id),
        "title": title,
        "message": message,
        "category": "missed_learning",
        "is_read": False,
        "email_status": "not_configured",
        "dedupe_key": dedupe_key,
        "created_at": datetime.now(timezone.utc),
    }
    try:
        db = get_db()
        existing = await db.learning_alerts.find_one(
            {"user_id": ObjectId(user_id), "dedupe_key": dedupe_key}
        )
        if existing is not None:
            return
        await db.learning_alerts.insert_one(document)
    except Exception as exc:
        logger.debug("Could not persist missed-day alert (%s); checking cache", type(exc).__name__)
        if any(item.get("dedupe_key") == dedupe_key for item in _offline_alerts.get(user_id, [])):
            return
        _offline_alerts.setdefault(user_id, []).insert(0, document)


def _parse_month(value: str) -> date:
    try:
        return datetime.strptime(value, "%Y-%m").date().replace(day=1)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Month must use YYYY-MM format.") from exc


def _as_date(value: datetime | date | str, tz: ZoneInfo) -> date:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(tz).date()
    if isinstance(value, date):
        return value
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(tz).date()


def _consecutive_missed_days(
    start_date: date, today: date, completed_dates: set[date]
) -> int:
    if today in completed_dates:
        return 0
    cursor = today - timedelta(days=1)
    count = 0
    while cursor >= start_date and cursor not in completed_dates:
        count += 1
        cursor -= timedelta(days=1)
    return count
