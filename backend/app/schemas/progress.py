"""Request/response schemas for the progress dashboard."""

from datetime import datetime

from pydantic import BaseModel, Field


class ProfileProgress(BaseModel):
    """Career profile progress summary."""

    has_profile: bool = False
    completeness: int = Field(default=0, ge=0, le=100)
    target_role: str = ""
    experience_level: str = ""
    career_goal: str = ""
    skills_count: int = 0
    skills: list[str] = Field(default_factory=list)


class ResumeProgress(BaseModel):
    """Resume analysis progress summary."""

    has_analysis: bool = False
    score: int = Field(default=0, ge=0, le=100)
    skills_detected: list[str] = Field(default_factory=list)
    skills_count: int = 0
    improvements_count: int = 0
    improvements: list[str] = Field(default_factory=list)
    analyzed_at: datetime | None = None
    total_analyses: int = 0


class NextStep(BaseModel):
    """An actionable next step for the user."""

    label: str
    action: str
    priority: str  # "high" | "medium" | "low"


class DashboardResponse(BaseModel):
    """Aggregated dashboard progress for the authenticated user."""

    profile: ProfileProgress = Field(default_factory=ProfileProgress)
    resume: ResumeProgress = Field(default_factory=ResumeProgress)
    readiness_score: int = Field(default=0, ge=0, le=100)
    overall_progress: int = Field(default=0, ge=0, le=100)
    next_steps: list[NextStep] = Field(default_factory=list)
