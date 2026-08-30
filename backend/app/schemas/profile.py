"""Request/response schemas for the career profile."""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

ALLOWED_EXPERIENCE_LEVELS = {"student", "fresh-graduate", "early-career"}


class ProfileUpsertRequest(BaseModel):
    education: str = Field(default="", max_length=200)
    university: str = Field(default="", max_length=200)
    experience_level: str = Field(default="student", max_length=50)
    target_role: str = Field(default="", max_length=200)
    career_goal: str = Field(default="", max_length=1000)
    skills: list[str] = Field(default_factory=list, max_length=50)

    @field_validator("experience_level")
    @classmethod
    def validate_experience_level(cls, value: str) -> str:
        normalized = value.strip().lower() or "student"
        if normalized not in ALLOWED_EXPERIENCE_LEVELS:
            raise ValueError(
                "experience_level must be one of: "
                + ", ".join(sorted(ALLOWED_EXPERIENCE_LEVELS))
            )
        return normalized

    @field_validator(
        "education", "university", "target_role", "career_goal"
    )
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("skills")
    @classmethod
    def clean_skills(cls, value: list[str]) -> list[str]:
        cleaned = [skill.strip() for skill in value if skill.strip()]
        return cleaned[:50]


class ProfileResponse(BaseModel):
    id: str
    user_id: str
    education: str
    university: str
    experience_level: str
    target_role: str
    career_goal: str
    skills: list[str]
    created_at: datetime
    updated_at: datetime
