"""Progress dashboard business logic.

Aggregates career profile, resume analysis, and roadmap data into a single dashboard
response. All data is derived from MongoDB collections.

The response is designed so future modules can add their own progress sections
without breaking the API.
"""

import asyncio
import logging
from datetime import datetime

from bson import ObjectId
from fastapi import HTTPException

from app.database.mongodb import get_db
from app.schemas.progress import (
    DashboardResponse,
    InterviewProgress,
    NextStep,
    ProfileProgress,
    ResumeProgress,
    RoadmapProgress,
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

    Queries career_profiles, resumes, roadmaps, and interviews in parallel, then assembles the
    dashboard from whatever data exists. Missing data is represented as
    explicit zero / not-started states — never fabricated values.
    """
    oid = ObjectId(user_id)

    (
        profile_doc,
        latest_resume_doc,
        total_analyses,
        latest_roadmap_doc,
        latest_interview_doc,
        total_interviews,
    ) = await asyncio.gather(
        _fetch_profile(oid),
        _fetch_latest_resume(oid),
        _count_resumes(oid),
        _fetch_latest_roadmap(oid),
        _fetch_latest_interview(oid),
        _count_interviews(oid),
    )

    profile_progress = _build_profile_progress(profile_doc)
    resume_progress = _build_resume_progress(latest_resume_doc, total_analyses)
    roadmap_progress = _build_roadmap_progress(latest_roadmap_doc)
    interview_progress = _build_interview_progress(latest_interview_doc, total_interviews)

    readiness_score = resume_progress.score if resume_progress.has_analysis else 0

    overall_progress = round(
        profile_progress.completeness * _PROFILE_WEIGHT
        + readiness_score * _RESUME_WEIGHT
    )
    overall_progress = max(0, min(100, overall_progress))

    next_steps = _build_next_steps(
        profile_progress, resume_progress, roadmap_progress, interview_progress
    )

    return DashboardResponse(
        profile=profile_progress,
        resume=resume_progress,
        roadmap=roadmap_progress,
        interview=interview_progress,
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


# ── Roadmap progress ──────────────────────────────────────────────────────


def _build_roadmap_progress(doc: dict | None) -> RoadmapProgress:
    """Derive roadmap progress from the latest stored roadmap document."""
    if doc is None:
        return RoadmapProgress()

    roadmap_data = doc.get("roadmap", {})
    title = roadmap_data.get("title", "")
    target_role = doc.get("target_role", "")
    phases = roadmap_data.get("phases", [])

    total_tasks = 0
    for phase in phases:
        tasks = phase.get("tasks", []) if isinstance(phase, dict) else getattr(phase, "tasks", [])
        total_tasks += len(tasks)

    completed_tasks = doc.get("completed_tasks", [])
    completed_count = len(completed_tasks)
    percentage = round((completed_count / total_tasks * 100)) if total_tasks > 0 else 0

    return RoadmapProgress(
        has_roadmap=True,
        title=title,
        target_role=target_role,
        total_tasks=total_tasks,
        completed_tasks_count=completed_count,
        completion_percentage=min(100, max(0, percentage)),
    )


def _build_interview_progress(
    doc: dict | None, total_interviews: int = 0
) -> InterviewProgress:
    """Derive mock interview progress from the latest stored interview."""
    if doc is None:
        return InterviewProgress(total_interviews=total_interviews)

    feedback = doc.get("feedback") or {}
    score = feedback.get("overall_score", 0) if isinstance(feedback, dict) else 0

    return InterviewProgress(
        has_interview=True,
        latest_score=score,
        total_interviews=total_interviews,
        target_role=doc.get("target_role", ""),
    )


# ── Next steps ───────────────────────────────────────────────────────────


def _build_next_steps(
    profile: ProfileProgress,
    resume: ResumeProgress,
    roadmap: RoadmapProgress | None = None,
    interview: InterviewProgress | None = None,
) -> list[NextStep]:
    """Generate deterministic next-step suggestions based on current data.

    No AI is involved — steps are derived from what is missing or incomplete.
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

    if roadmap and roadmap.has_roadmap and roadmap.completed_tasks_count < roadmap.total_tasks:
        steps.append(NextStep(
            label=f"Continue your learning roadmap ({roadmap.completed_tasks_count}/{roadmap.total_tasks} completed)",
            action="/roadmap",
            priority="medium",
        ))

    if interview and interview.has_interview and interview.latest_score < 70:
        steps.append(NextStep(
            label=f"Retake mock interview to improve your score ({interview.latest_score}/100)",
            action="/interview",
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
    try:
        return await get_db().career_profiles.find_one({"user_id": oid})
    except HTTPException:
        from app.services.profile_service import _offline_profiles
        return _offline_profiles.get(str(oid))


async def _fetch_latest_resume(oid: ObjectId) -> dict | None:
    """Fetch the user's most recent resume analysis, or None."""
    try:
        return await get_db().resumes.find_one(
            {"user_id": oid}, sort=[("analyzed_at", -1)]
        )
    except HTTPException:
        from app.services.resume_service import _offline_resumes
        return _offline_resumes.get(str(oid))


async def _count_resumes(oid: ObjectId) -> int:
    """Count total resume analyses for this user."""
    try:
        return await get_db().resumes.count_documents({"user_id": oid})
    except HTTPException:
        from app.services.resume_service import _offline_resumes
        return 1 if str(oid) in _offline_resumes else 0


async def _fetch_latest_roadmap(oid: ObjectId) -> dict | None:
    """Fetch the user's most recent roadmap, or None."""
    try:
        return await get_db().roadmaps.find_one(
            {"user_id": oid}, sort=[("created_at", -1)]
        )
    except HTTPException:
        from app.services.roadmap_service import _offline_roadmaps
        return _offline_roadmaps.get(str(oid))
    except Exception as exc:
        logger.debug("Could not fetch roadmap from database (%s); returning None", exc)
        return None


async def _fetch_latest_interview(oid: ObjectId) -> dict | None:
    """Fetch the user's most recent completed interview, or None."""
    try:
        return await get_db().interviews.find_one(
            {"user_id": oid, "status": "completed"},
            sort=[("completed_at", -1), ("created_at", -1)],
        )
    except HTTPException:
        from app.services.interview_service import _offline_interviews
        matching = [
            d
            for d in _offline_interviews.values()
            if str(d.get("user_id")) == str(oid) and d.get("status") == "completed"
        ]
        if matching:
            matching.sort(key=lambda x: x.get("created_at", datetime.min), reverse=True)
            return matching[0]
        return None
    except Exception as exc:
        logger.debug("Could not fetch interview (%s); returning None", exc)
        return None


async def _count_interviews(oid: ObjectId) -> int:
    """Count total completed mock interviews for this user."""
    try:
        return await get_db().interviews.count_documents(
            {"user_id": oid, "status": "completed"}
        )
    except HTTPException:
        from app.services.interview_service import _offline_interviews
        return sum(
            1
            for d in _offline_interviews.values()
            if str(d.get("user_id")) == str(oid) and d.get("status") == "completed"
        )
    except Exception:
        return 0

