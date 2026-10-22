"""Authenticated roadmap assessment and learning-alert routes."""

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.rate_limit import high_cost_rate_limit, limiter, require_high_cost_quota
from app.schemas.learning import (
    LearningAlert,
    LearningAlertsResponse,
    SkillQuizResponse,
    SkillQuizResult,
    SkillQuizSubmission,
    VerifiedSkill,
)
from app.services import learning_service
from app.services.ai.qwen_service import AIServiceError
from app.services.dependencies import get_current_user

router = APIRouter(tags=["learning"])


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
    return await learning_service.get_alerts(str(current_user["_id"]))


@router.put("/api/alerts/{alert_id}/read", response_model=LearningAlert)
async def read_learning_alert(
    alert_id: str,
    current_user: dict = Depends(get_current_user),
) -> LearningAlert:
    """Mark an owned learning alert as read."""
    return await learning_service.mark_alert_read(str(current_user["_id"]), alert_id)
