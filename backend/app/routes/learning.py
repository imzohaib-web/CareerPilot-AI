"""Authenticated roadmap assessment and learning-alert routes."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.core.rate_limit import high_cost_rate_limit, limiter, require_high_cost_quota
from app.schemas.learning import (
    LearningAlert,
    LearningAlertsResponse,
    SkillQuizResponse,
    SkillQuizResult,
    SkillQuizSubmission,
    VerifiedSkill,
)
from app.schemas.study_tracker import (
    StudyCalendarResponse,
    StudyDayUpdate,
    StudyPreferencesResponse,
    StudyPreferencesUpdate,
)
from app.services import learning_service
from app.services import study_tracker_service
from app.services.ai.qwen_service import AIServiceError
from app.services.dependencies import get_current_user

router = APIRouter(tags=["learning"])


@router.get("/api/learning/calendar", response_model=StudyCalendarResponse)
async def get_study_calendar(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    timezone_name: str = Query(default="UTC", alias="timezone", min_length=1, max_length=64),
    current_user: dict = Depends(get_current_user),
) -> StudyCalendarResponse:
    """Return the signed-in user's roadmap study log and missed-day status."""
    return await study_tracker_service.get_calendar(
        str(current_user["_id"]), month, timezone_name
    )


@router.put(
    "/api/learning/calendar/preferences",
    response_model=StudyPreferencesResponse,
)
async def update_study_preferences(
    payload: StudyPreferencesUpdate,
    current_user: dict = Depends(get_current_user),
) -> StudyPreferencesResponse:
    """Set the user's missed-learning-day alert threshold."""
    return await study_tracker_service.update_preferences(
        str(current_user["_id"]), payload
    )


@router.put("/api/learning/calendar/{study_date}", status_code=204)
async def update_study_day(
    study_date: date,
    payload: StudyDayUpdate,
    current_user: dict = Depends(get_current_user),
) -> None:
    """Mark or unmark one calendar day for the signed-in user's latest roadmap."""
    await study_tracker_service.update_study_day(
        str(current_user["_id"]), study_date, payload
    )


@router.post(
    "/api/learning/roadmaps/{roadmap_id}/tasks/{task_id}/assessment",
    response_model=SkillQuizResponse,
)
@limiter.limit(high_cost_rate_limit)
async def start_skill_quiz(
    request: Request,
    roadmap_id: str,
    task_id: str,
    current_user: dict = Depends(get_current_user),
    _: None = Depends(require_high_cost_quota),
) -> SkillQuizResponse:
    """Generate a skill quiz for a task in the current user's roadmap."""
    try:
        return await learning_service.start_quiz(
            str(current_user["_id"]), roadmap_id, task_id
        )
    except AIServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc


@router.post(
    "/api/learning/assessments/{assessment_id}/submit",
    response_model=SkillQuizResult,
)
async def submit_skill_quiz(
    assessment_id: str,
    submission: SkillQuizSubmission,
    current_user: dict = Depends(get_current_user),
) -> SkillQuizResult:
    """Grade a skill assessment and update verified skills on a pass."""
    return await learning_service.submit_quiz(
        str(current_user["_id"]),
        assessment_id,
        submission,
        current_user["email"],
    )


@router.get("/api/alerts", response_model=LearningAlertsResponse)
async def get_learning_alerts(
    current_user: dict = Depends(get_current_user),
) -> LearningAlertsResponse:
    """List learning alerts for the authenticated user."""
    await study_tracker_service.refresh_missed_alert(str(current_user["_id"]))
    return await learning_service.get_alerts(str(current_user["_id"]))


@router.put("/api/alerts/{alert_id}/read", response_model=LearningAlert)
async def read_learning_alert(
    alert_id: str,
    current_user: dict = Depends(get_current_user),
) -> LearningAlert:
    """Mark an owned learning alert as read."""
    return await learning_service.mark_alert_read(str(current_user["_id"]), alert_id)
