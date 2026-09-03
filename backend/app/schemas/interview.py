"""Schemas for the AI Mock Interview module."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class InterviewQuestion(BaseModel):
    """A role-specific question generated for the mock interview."""

    id: str = Field(..., description="Unique question ID, e.g. 'q-1'")
    question: str = Field(..., description="The interview question text")
    category: str = Field(
        default="technical",
        description="Question category: technical, behavioral, or situational",
    )
    hint: str = Field(
        default="",
        description="Guidance or STAR framework tip to help the candidate",
    )


class UserAnswer(BaseModel):
    """Candidate's submitted answer to a specific question."""

    question_id: str = Field(..., description="ID of the answered question")
    answer: str = Field(default="", description="Candidate's spoken or written answer")


class QuestionEvaluation(BaseModel):
    """AI evaluation and feedback for a single question response."""

    question_id: str = Field(..., description="ID of the question evaluated")
    score: int = Field(default=0, ge=0, le=100, description="Score from 0 to 100")
    strengths: list[str] = Field(default_factory=list, description="Key strengths observed")
    improvements: list[str] = Field(default_factory=list, description="Areas for improvement")
    ideal_answer: str = Field(default="", description="Model benchmark answer or best practice")


class InterviewFeedback(BaseModel):
    """Aggregated evaluation and scoring for the entire interview."""

    overall_score: int = Field(default=0, ge=0, le=100, description="Overall score 0-100")
    summary: str = Field(default="", description="Executive summary of the candidate's performance")
    evaluations: list[QuestionEvaluation] = Field(
        default_factory=list, description="Per-question evaluation breakdown"
    )
    recommended_actions: list[str] = Field(
        default_factory=list, description="Concrete next steps to prepare for real interviews"
    )


class InterviewStartRequest(BaseModel):
    """Input payload to initialize a new mock interview session."""

    target_role: str = Field(..., min_length=1, description="Target job title")
    experience_level: Optional[str] = Field(default="student", description="Experience level")
    question_count: int = Field(default=3, ge=1, le=5, description="Number of questions (1-5)")
    focus_skills: list[str] = Field(
        default_factory=list, description="Specific skills to test (e.g. from Skill Gap)"
    )

    @field_validator("focus_skills", mode="before")
    @classmethod
    def _coerce_skills(cls, v: object) -> list[str]:
        if isinstance(v, str):
            return [s.strip() for s in v.split(",") if s.strip()]
        if isinstance(v, list):
            return [str(item).strip() for item in v if str(item).strip()]
        return []


class InterviewSubmitRequest(BaseModel):
    """Input payload when submitting answers for evaluation."""

    answers: list[UserAnswer] = Field(..., min_length=1, description="List of candidate answers")


class InterviewResponse(BaseModel):
    """Stored and returned interview session representation."""

    id: str
    user_id: str
    target_role: str
    experience_level: str = ""
    questions: list[InterviewQuestion] = Field(default_factory=list)
    answers: list[UserAnswer] = Field(default_factory=list)
    feedback: Optional[InterviewFeedback] = None
    status: str = "in_progress"
    created_at: datetime
    completed_at: Optional[datetime] = None
