"""Tests for per-user daily roadmap learning records and missed-day alerts."""

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest
from bson import ObjectId
from fastapi import HTTPException

from app.schemas.study_tracker import StudyDayUpdate, StudyPreferencesUpdate
from app.services import learning_service, roadmap_service, study_tracker_service


@pytest.fixture
def tracker_user(monkeypatch):
    user_id = str(ObjectId())
    roadmap_id = ObjectId()
    roadmap = {
        "_id": roadmap_id,
        "user_id": ObjectId(user_id),
        "created_at": datetime.now(timezone.utc) - timedelta(days=5),
        "target_role": "Backend Engineer",
        "roadmap": {"title": "Backend Engineer Roadmap"},
    }
    roadmap_service._offline_roadmaps[user_id] = roadmap
    study_tracker_service._offline_preferences.pop(user_id, None)
    for key in list(study_tracker_service._offline_days):
        if key[0] == user_id:
            study_tracker_service._offline_days.pop(key)
    learning_service._offline_alerts.pop(user_id, None)

    def no_database():
        raise HTTPException(status_code=503, detail="database offline")

    monkeypatch.setattr(study_tracker_service, "get_db", no_database)
    monkeypatch.setattr(learning_service, "get_db", no_database)
    monkeypatch.setattr(study_tracker_service, "is_connected", lambda: False)
    yield user_id, roadmap

    roadmap_service._offline_roadmaps.pop(user_id, None)
    study_tracker_service._offline_preferences.pop(user_id, None)
    for key in list(study_tracker_service._offline_days):
        if key[0] == user_id:
            study_tracker_service._offline_days.pop(key)
    learning_service._offline_alerts.pop(user_id, None)


@pytest.mark.asyncio
async def test_study_day_is_saved_per_user_and_roadmap(tracker_user):
    user_id, roadmap = tracker_user
    day = datetime.now(timezone.utc).date() - timedelta(days=1)

    await study_tracker_service.update_study_day(
        user_id, day, StudyDayUpdate(completed=True, minutes=45, note="Read API docs")
    )
    calendar = await study_tracker_service.get_calendar(
        user_id, day.strftime("%Y-%m"), "UTC"
    )

    assert calendar.roadmap_id == str(roadmap["_id"])
    assert calendar.storage_mode == "memory"
    record = next(item for item in calendar.days if item.date == day)
    assert record.minutes == 45
    assert record.note == "Read API docs"
    with pytest.raises(HTTPException) as error:
        await study_tracker_service.get_calendar(str(ObjectId()), day.strftime("%Y-%m"), "UTC")
    assert error.value.status_code == 404


@pytest.mark.asyncio
async def test_future_and_pre_roadmap_days_cannot_be_marked(tracker_user):
    user_id, roadmap = tracker_user
    with pytest.raises(HTTPException) as future_error:
        await study_tracker_service.update_study_day(
            user_id,
            datetime.now(timezone.utc).date() + timedelta(days=1),
            StudyDayUpdate(completed=True),
        )
    assert future_error.value.status_code == 422

    before_start = roadmap["created_at"].date() - timedelta(days=1)
    with pytest.raises(HTTPException) as old_error:
        await study_tracker_service.update_study_day(
            user_id, before_start, StudyDayUpdate(completed=True)
        )
    assert old_error.value.status_code == 422


@pytest.mark.asyncio
async def test_missed_day_threshold_is_user_configurable_and_alert_deduplicated(tracker_user):
    user_id, _ = tracker_user
    await study_tracker_service.update_preferences(
        user_id,
        StudyPreferencesUpdate(missed_day_threshold=2, timezone="UTC"),
    )
    calendar = await study_tracker_service.get_calendar(
        user_id, datetime.now(timezone.utc).strftime("%Y-%m"), "UTC"
    )
    alerts = await learning_service.get_alerts(user_id)

    assert calendar.missed_day_threshold == 2
    assert calendar.active_missed_days >= 2
    assert calendar.missed_alert is not None
    assert alerts.unread_count == 1
    assert alerts.alerts[0].category == "missed_learning"

    await study_tracker_service.refresh_missed_alert(user_id)
    refreshed = await learning_service.get_alerts(user_id)
    assert refreshed.unread_count == 1

    today = datetime.now(timezone.utc).date()
    await study_tracker_service.update_study_day(
        user_id, today, StudyDayUpdate(completed=True, minutes=20)
    )
    recovered = await study_tracker_service.get_calendar(
        user_id, today.strftime("%Y-%m"), "UTC"
    )
    assert recovered.active_missed_days == 0
    assert recovered.missed_alert is None


def test_naive_mongo_timestamp_is_interpreted_as_utc_for_local_day():
    timestamp = datetime(2026, 10, 22, 1)
    assert study_tracker_service._as_date(
        timestamp, ZoneInfo("America/Los_Angeles")
    ).isoformat() == "2026-10-21"


@pytest.mark.asyncio
async def test_asia_karachi_timezone_handling(tracker_user):
    """Confirm calendar functions cleanly with Asia/Karachi timezone."""
    user_id, roadmap = tracker_user
    prefs = await study_tracker_service.update_preferences(
        user_id,
        StudyPreferencesUpdate(missed_day_threshold=3, timezone="Asia/Karachi"),
    )
    assert prefs.timezone == "Asia/Karachi"

    karachi_tz = ZoneInfo("Asia/Karachi")
    now_karachi = datetime.now(karachi_tz)
    calendar = await study_tracker_service.get_calendar(
        user_id, now_karachi.strftime("%Y-%m"), "Asia/Karachi"
    )
    assert calendar.timezone == "Asia/Karachi"
    assert calendar.roadmap_id == str(roadmap["_id"])
