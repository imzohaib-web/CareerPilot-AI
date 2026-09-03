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


class RoadmapProgress(BaseModel):
    """Roadmap learning progress summary."""

    has_roadmap: bool = False
    title: str = ""
    target_role: str = ""
    total_tasks: int = 0
    completed_tasks_count: int = 0
    completion_percentage: int = Field(default=0, ge=0, le=100)


class InterviewProgress(BaseModel):
    """Mock interview practice progress summary."""

    has_interview: bool = False
    latest_score: int = Field(default=0, ge=0, le=100)
    total_interviews: int = 0
    target_role: str = ""


class NextStep(BaseModel):
    """An actionable next step for the user."""

    label: str
    action: str
    priority: str  # "high" | "medium" | "low"


class DashboardResponse(BaseModel):
    """Aggregated dashboard progress for the authenticated user."""

    profile: ProfileProgress = Field(default_factory=ProfileProgress)
    resume: ResumeProgress = Field(default_factory=ResumeProgress)
    roadmap: RoadmapProgress = Field(default_factory=RoadmapProgress)
    interview: InterviewProgress = Field(default_factory=InterviewProgress)
    readiness_score: int = Field(default=0, ge=0, le=100)
    overall_progress: int = Field(default=0, ge=0, le=100)
    next_steps: list[NextStep] = Field(default_factory=list)
