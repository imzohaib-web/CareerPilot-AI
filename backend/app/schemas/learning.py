"""Roadmap-linked skill assessment and alert schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class SkillQuizQuestion(BaseModel):
    id: str
    question: str
    options: list[str] = Field(min_length=4, max_length=4)


class SkillQuizResponse(BaseModel):
    id: str
    roadmap_id: str
    task_id: str
    skill: str
    questions: list[SkillQuizQuestion]


class SkillQuizAnswer(BaseModel):
    question_id: str
    selected_option: int = Field(ge=0, le=3)


class SkillQuizSubmission(BaseModel):
    answers: list[SkillQuizAnswer] = Field(min_length=10, max_length=10)


class SkillQuizResult(BaseModel):
    id: str
    task_id: str
    skill: str
    score: int = Field(ge=0, le=100)
    passed: bool
    correct_answers: int
    total_questions: int
    completed_at: datetime


class VerifiedSkill(BaseModel):
    name: str
    score: int = Field(ge=70, le=100)
    verified_at: datetime


class LearningAlert(BaseModel):
    id: str
    title: str
    message: str
    category: str
    is_read: bool
    email_status: str = "not_configured"
    created_at: datetime


class LearningAlertsResponse(BaseModel):
    alerts: list[LearningAlert] = Field(default_factory=list)
    unread_count: int = 0
