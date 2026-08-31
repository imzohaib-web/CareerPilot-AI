"""Progress dashboard business logic.

Aggregates career profile and resume analysis data into a single dashboard
response. All data is derived from existing MongoDB collections — no new
collection is required.

The response is designed so future modules (skill gap, roadmap, interview,
mentor) can add their own progress sections without breaking the API.
"""

import asyncio
import logging

from bson import ObjectId

from app.database.mongodb import get_db
from app.schemas.progress import (
    DashboardResponse,
    NextStep,
    ProfileProgress,
    ResumeProgress,
)
from app.schemas.resume import ResumeAnalysis

logger = logging.getLogger(__name__)

# Weighting for overall progress calculation.
# Profile completeness contributes 40%; resume score contributes 60%.
_PROFILE_WEIGHT = 0.4
_RESUME_WEIGHT = 0.6

# Fields checked for profile completeness (each worth equal share).
_PROFILE_FIELDS = ("education", "university", "target_role", "career_goal", "skills")


# ── Public API ────────────────────────────────────────────────────────────


async def get_dashboard(user_id: str) -> DashboardResponse:
    """Build an aggregated dashboard response for the authenticated user.

    Queries career_profiles and resumes in parallel, then assembles the
    dashboard from whatever data exists.  Missing data is represented as
    explicit zero / not-started states — never fabricated values.
    """
    oid = ObjectId(user_id)

    profile_doc, latest_resume_doc, total_analyses = await asyncio.gather(
        _fetch_profile(oid),
        _fetch_latest_resume(oid),
        _count_resumes(oid),
    )

    profile_progress = _build_profile_progress(profile_doc)
    resume_progress = _build_resume_progress(latest_resume_doc, total_analyses)

    readiness_score = resume_progress.score if resume_progress.has_analysis else 0

    overall_progress = round(
        profile_progress.completeness * _PROFILE_WEIGHT
        + readiness_score * _RESUME_WEIGHT
    )
    overall_progress = max(0, min(100, overall_progress))

    next_steps = _build_next_steps(profile_progress, resume_progress)

    return DashboardResponse(
        profile=profile_progress,
        resume=resume_progress,
        readiness_score=readiness_score,
        overall_progress=overall_progress,
        next_steps=next_steps,
    )


# ── Profile progress ──────────────────────────────────────────────────────


def _build_profile_progress(doc: dict | None) -> ProfileProgress:
    """Derive profile progress from the stored career_profiles document."""
    if doc is None:
        return ProfileProgress()

    completeness = _compute_profile_completeness(doc)

    return ProfileProgress(
        has_profile=True,
        completeness=completeness,
        target_role=doc.get("target_role", ""),
        experience_level=doc.get("experience_level", ""),
        career_goal=doc.get("career_goal", ""),
        skills_count=len(doc.get("skills", [])),
        skills=doc.get("skills", []),
    )


def _compute_profile_completeness(doc: dict) -> int:
    """Return 0–100 based on how many key profile fields are filled."""
    if not _PROFILE_FIELDS:
        return 0

    filled = 0
    for field in _PROFILE_FIELDS:
        value = doc.get(field)
        if isinstance(value, list):
            if len(value) > 0:
                filled += 1
        elif isinstance(value, str):
            if value.strip():
                filled += 1
        elif value is not None:
            filled += 1

    return round((filled / len(_PROFILE_FIELDS)) * 100)


# ── Resume progress ──────────────────────────────────────────────────────


def _build_resume_progress(
    doc: dict | None, total_analyses: int
) -> ResumeProgress:
    """Derive resume progress from the latest stored resume analysis."""
    if doc is None:
        return ResumeProgress(total_analyses=total_analyses)

    try:
        analysis = ResumeAnalysis.model_validate(doc.get("analysis", {}))
    except Exception:
        logger.warning("Failed to validate stored resume analysis; using defaults")
        analysis = ResumeAnalysis()

    return ResumeProgress(
        has_analysis=True,
        score=analysis.score,
        skills_detected=analysis.skills_detected,
        skills_count=len(analysis.skills_detected),
        improvements_count=len(analysis.improvements),
        improvements=analysis.improvements,
        analyzed_at=doc.get("analyzed_at", doc.get("uploaded_at")),
        total_analyses=total_analyses,
    )


# ── Next steps ───────────────────────────────────────────────────────────


def _build_next_steps(
    profile: ProfileProgress,
    resume: ResumeProgress,
) -> list[NextStep]:
    """Generate deterministic next-step suggestions based on current data.

    No AI is involved — steps are derived from what is missing or incomplete.
    Future modules can append their own steps to the returned list.
    """
    steps: list[NextStep] = []

    if not profile.has_profile:
        steps.append(NextStep(
            label="Create your career profile",
            action="/profile",
            priority="high",
        ))
    elif profile.completeness < 100:
        steps.append(NextStep(
            label="Complete your career profile",
            action="/profile",
            priority="medium",
        ))

    if not resume.has_analysis:
        steps.append(NextStep(
            label="Upload and analyze your resume",
            action="/resume",
            priority="high",
        ))
    elif resume.improvements_count > 0:
        steps.append(NextStep(
            label=f"Address {resume.improvements_count} resume improvement{'s' if resume.improvements_count != 1 else ''}",
            action="/resume",
            priority="medium",
        ))

    if not steps:
        steps.append(NextStep(
            label="Your profile and resume look good — keep building skills!",
            action="/resume",
            priority="low",
        ))

    return steps


# ── MongoDB queries ───────────────────────────────────────────────────────


async def _fetch_profile(oid: ObjectId) -> dict | None:
    """Fetch the user's career profile document, or None."""
    return await get_db().career_profiles.find_one({"user_id": oid})


async def _fetch_latest_resume(oid: ObjectId) -> dict | None:
    """Fetch the user's most recent resume analysis, or None."""
    return await get_db().resumes.find_one(
        {"user_id": oid}, sort=[("analyzed_at", -1)]
    )


async def _count_resumes(oid: ObjectId) -> int:
    """Count total resume analyses for this user."""
    return await get_db().resumes.count_documents({"user_id": oid})
