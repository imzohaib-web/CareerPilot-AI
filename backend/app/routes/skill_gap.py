"""Skill gap routes: compare resume data vs target job requirements."""

import logging

from fastapi import APIRouter, Body, Depends, HTTPException, status

from app.schemas.skill_gap import SkillGapRequest, SkillGapResponse
from app.services import skill_gap_service
from app.services.ai.qwen_service import AIServiceError
from app.services.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["skill-gap"])


@router.post("/analyze-gap", response_model=SkillGapResponse)
async def analyze_gap_route(
    payload: SkillGapRequest = Body(...),
    current_user: dict = Depends(get_current_user),
) -> SkillGapResponse:
    """Analyze missing skills for the user's target role and persist the result."""
    try:
        return await skill_gap_service.analyze_gap(str(current_user["_id"]), payload)
    except AIServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        )


@router.get("/analyze-gap/latest", response_model=SkillGapResponse)
async def get_latest_gap_route(
    current_user: dict = Depends(get_current_user),
) -> SkillGapResponse:
    """Fetch the latest skill gap result for the authenticated user."""
    result = await skill_gap_service.get_latest_gap(str(current_user["_id"]))
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No skill gap analysis found.",
        )
    return result
