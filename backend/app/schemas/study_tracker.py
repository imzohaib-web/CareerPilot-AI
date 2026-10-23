"""Daily roadmap learning tracker schemas."""

from datetime import date, datetime
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, Field, field_validator


class StudyDayRecord(BaseModel):
    date: date
    minutes: int = Field(default=0, ge=0, le=1440)
    note: str = Field(default="", max_length=500)
    updated_at: datetime


class StudyCalendarResponse(BaseModel):
    roadmap_id: str
    roadmap_title: str
    roadmap_start_date: date
    month: str
    timezone: str
    storage_mode: Literal["mongodb", "memory"]
    days: list[StudyDayRecord] = Field(default_factory=list)
    missed_day_threshold: int = Field(ge=1, le=30)
    active_missed_days: int = Field(ge=0)
    missed_alert: str | None = None


class StudyDayUpdate(BaseModel):
    completed: bool
    minutes: int = Field(default=0, ge=0, le=1440)
    note: str = Field(default="", max_length=500)


class StudyPreferencesUpdate(BaseModel):
    missed_day_threshold: int = Field(ge=1, le=30)
    timezone: str = Field(default="UTC", min_length=1, max_length=64)

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise ValueError("Use a valid IANA timezone.") from exc
        return value


class StudyPreferencesResponse(BaseModel):
    missed_day_threshold: int
    timezone: str
