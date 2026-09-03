"""Schemas for the Roadmap Generator module."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class RoadmapTask(BaseModel):
    """An individual actionable task within a roadmap phase."""

    id: str = Field(..., description="Unique task identifier, e.g. 'task-1'")
    title: str = Field(..., description="Short task title")
    skill: str = Field(default="", description="The specific skill targeted")
    description: str = Field(default="", description="Task explanation")
    action: str = Field(default="", description="Concrete action step for the user")
    resource: str = Field(default="", description="Recommended tutorial, doc, or practice resource")
    milestone: str = Field(default="", description="Deliverable or proof of completion")
    estimated_hours: int = Field(default=5, ge=0, description="Estimated hours to complete")


class RoadmapPhase(BaseModel):
    """A time-boxed phase grouping related learning tasks."""

    phase_number: int = Field(..., ge=1, description="1-indexed phase number")
    name: str = Field(..., description="Phase title, e.g. 'Phase 1: Core Fundamentals'")
    duration_weeks: int = Field(default=2, ge=1, description="Duration of this phase in weeks")
    focus: str = Field(default="", description="High-level focus or outcome of the phase")
    tasks: list[RoadmapTask] = Field(default_factory=list, description="List of tasks in this phase")


class RoadmapContent(BaseModel):
    """Validated AI-generated roadmap plan."""

    title: str = Field(default="", description="Title for the roadmap")
    target_role: str = Field(default="", description="Target job role")
    total_duration_weeks: int = Field(default=8, ge=1, description="Total duration in weeks")
    summary: str = Field(default="", description="Strategic overview of the learning journey")
    phases: list[RoadmapPhase] = Field(default_factory=list, description="Phased roadmap sequence")

    @field_validator("summary", "title", mode="before")
    @classmethod
    def _strip_strings(cls, v: object) -> str:
        return str(v).strip() if v is not None else ""


class RoadmapRequest(BaseModel):
    """Input payload accepted by the roadmap generation endpoint."""

    target_role: str = Field(..., min_length=1, description="Target job role, e.g. 'Frontend Engineer'")
    skill_gaps: list[str] = Field(default_factory=list, description="List of missing skills to address")
    time_frame_weeks: int = Field(default=8, ge=2, le=52, description="Target timeframe in weeks")
    weekly_hours: int = Field(default=10, ge=1, le=80, description="Available study hours per week")
    experience_level: Optional[str] = Field(default=None, description="Current experience level")
    additional_context: Optional[str] = Field(default=None, description="Any specific goals or preferences")

    @field_validator("skill_gaps", mode="before")
    @classmethod
    def _coerce_skills(cls, v: object) -> list[str]:
        if isinstance(v, str):
            return [s.strip() for s in v.split(",") if s.strip()]
        if isinstance(v, list):
            return [str(item).strip() for item in v if str(item).strip()]
        return []


class RoadmapResponse(BaseModel):
    """Stored and returned roadmap for the authenticated user."""

    id: str
    user_id: str
    target_role: str
    time_frame_weeks: int
    weekly_hours: int
    roadmap: RoadmapContent
    completed_tasks: list[str] = Field(default_factory=list)
    created_at: datetime


class TaskToggleRequest(BaseModel):
    """Payload to toggle a task completion status."""

    completed: bool = Field(..., description="True if marked complete, False if incomplete")
