"""Roadmap routes: generate and manage personalized learning plans."""

import logging

from fastapi import APIRouter, Body, Depends, HTTPException, Path, status

from app.schemas.roadmap import (
    RoadmapRequest,
    RoadmapResponse,
    TaskToggleRequest,
)
from app.services import roadmap_service
from app.services.ai.qwen_service import AIServiceError
from app.services.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/roadmap", tags=["roadmap"])


@router.post("/generate", response_model=RoadmapResponse)
async def generate_roadmap_route(
    payload: RoadmapRequest = Body(...),
    current_user: dict = Depends(get_current_user),
) -> RoadmapResponse:
    """Generate a personalized phased learning roadmap and persist it."""
    try:
        return await roadmap_service.generate_roadmap(str(current_user["_id"]), payload)
    except AIServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        )


@router.get("/latest", response_model=RoadmapResponse)
async def get_latest_roadmap_route(
    current_user: dict = Depends(get_current_user),
) -> RoadmapResponse:
    """Fetch the latest learning roadmap for the authenticated user."""
    result = await roadmap_service.get_latest_roadmap(str(current_user["_id"]))
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No roadmap found.",
        )
    return result


@router.put("/{roadmap_id}/tasks/{task_id}/toggle", response_model=RoadmapResponse)
async def toggle_task_route(
    roadmap_id: str = Path(..., description="ID of the roadmap"),
    task_id: str = Path(..., description="ID of the task to toggle"),
    payload: TaskToggleRequest = Body(...),
    current_user: dict = Depends(get_current_user),
) -> RoadmapResponse:
    """Toggle a task's completed status on the user's roadmap."""
    try:
        return await roadmap_service.toggle_task(
            user_id=str(current_user["_id"]),
            roadmap_id=roadmap_id,
            task_id=task_id,
            completed=payload.completed,
        )
    except AIServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
