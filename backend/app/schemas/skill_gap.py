"""Schemas for the skill gap analyzer module."""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class RequiredProficiency(BaseModel):
    """A category of role-specific skills needed for the target job."""

    area: str = ""
    skills: list[str] = Field(default_factory=list)


class SkillGapAnalysis(BaseModel):
    """Validated Qwen output for a skill gap comparison."""

    summary: str = ""
    missing_technical_skills: list[str] = Field(default_factory=list)
    missing_soft_skills: list[str] = Field(default_factory=list)
    required_proficiencies: list[RequiredProficiency] = Field(default_factory=list)
    match_score: int = Field(default=0, ge=0, le=100)

    @field_validator("summary")
    @classmethod
    def _strip_summary(cls, v: str) -> str:
        return v.strip()

    @field_validator(
        "missing_technical_skills",
        "missing_soft_skills",
        mode="before",
    )
    @classmethod
    def _coerce_string_lists(cls, v: object) -> list[str]:
        if isinstance(v, str):
            return [v.strip()] if v.strip() else []
        if isinstance(v, list):
            return [str(item).strip() for item in v if str(item).strip()]
        return []


class SkillGapRequest(BaseModel):
    """Input payload accepted by the skill gap endpoint."""

    resume_data: str = Field(default="", description="Current resume text or summary")
    target_role: str = Field(..., min_length=1, description="Target job title")
    target_job_description: str = Field(..., min_length=1, description="Target job description")


class SkillGapResponse(BaseModel):
    """Stored and returned skill gap result for the authenticated user."""

    id: str
    user_id: str
    target_role: str
    target_job_description: str
    analysis: SkillGapAnalysis
    created_at: datetime
