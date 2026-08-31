"""Request/response schemas for the AI Resume Analyzer."""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator


# ── Sub-models for structured AI analysis output ──────────────────────────


class ResumeSectionEducation(BaseModel):
    """Education entry extracted from a resume."""

    institution: str = ""
    degree: str = ""
    field_of_study: str = ""
    year: str = ""


class ResumeSectionExperience(BaseModel):
    """Work experience entry extracted from a resume."""

    company: str = ""
    role: str = ""
    duration: str = ""
    description: str = ""


class ResumeSectionProject(BaseModel):
    """Project entry extracted from a resume."""

    name: str = ""
    description: str = ""
    technologies: list[str] = Field(default_factory=list)


class ResumeSections(BaseModel):
    """Structured sections detected in the resume text."""

    education: list[ResumeSectionEducation] = Field(default_factory=list)
    experience: list[ResumeSectionExperience] = Field(default_factory=list)
    projects: list[ResumeSectionProject] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)


# ── Top-level analysis result ─────────────────────────────────────────────


class ResumeAnalysis(BaseModel):
    """Validated AI analysis of a resume.

    Every field has a safe default so that partial or incomplete Qwen output
    does not crash the pipeline — missing sections simply remain empty.
    """

    score: int = Field(default=0, ge=0, le=100, description="ATS / job-readiness score 0-100")
    summary: str = ""
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    missing_info: list[str] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)
    skills_detected: list[str] = Field(default_factory=list)
    sections: ResumeSections = Field(default_factory=ResumeSections)

    @field_validator("summary")
    @classmethod
    def _strip_summary(cls, v: str) -> str:
        return v.strip()

    @field_validator("strengths", "weaknesses", "missing_info", "improvements", "skills_detected", mode="before")
    @classmethod
    def _coerce_string_lists(cls, v: object) -> list[str]:
        """Tolerate Qwen returning a single string instead of a list."""
        if isinstance(v, str):
            return [v.strip()] if v.strip() else []
        if isinstance(v, list):
            return [str(item).strip() for item in v if str(item).strip()]
        return []


# ── API response ──────────────────────────────────────────────────────────


class ResumeAnalysisResponse(BaseModel):
    """Response returned to the frontend after upload + analysis."""

    id: str
    user_id: str
    filename: str
    extracted_text_length: int
    analysis: ResumeAnalysis
    analyzed_at: datetime
    model: str
