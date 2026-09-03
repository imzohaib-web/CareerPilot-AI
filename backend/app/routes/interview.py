"""Mock interview routes: question generation, answer submission, and feedback."""

import logging

from fastapi import APIRouter, Body, Depends, HTTPException, Path, status

from app.schemas.interview import (
    InterviewResponse,
    InterviewStartRequest,
    InterviewSubmitRequest,
)
from app.services import interview_service
from app.services.ai.qwen_service import AIServiceError
from app.services.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/interview", tags=["interview"])


@router.post("/start", response_model=InterviewResponse)
async def start_interview_route(
    payload: InterviewStartRequest = Body(...),
    current_user: dict = Depends(get_current_user),
) -> InterviewResponse:
    """Start a new mock interview session and generate role-tailored questions."""
    try:
        return await interview_service.start_interview(
            str(current_user["_id"]), payload
        )
    except AIServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        )


@router.post("/{interview_id}/submit", response_model=InterviewResponse)
async def submit_interview_route(
    interview_id: str = Path(..., description="ID of the interview session"),
    payload: InterviewSubmitRequest = Body(...),
    current_user: dict = Depends(get_current_user),
) -> InterviewResponse:
    """Submit candidate answers to be evaluated and scored by AI."""
    try:
        return await interview_service.submit_interview(
            user_id=str(current_user["_id"]),
            interview_id=interview_id,
            payload=payload,
        )
    except AIServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        )


@router.get("/latest", response_model=InterviewResponse)
async def get_latest_interview_route(
    current_user: dict = Depends(get_current_user),
) -> InterviewResponse:
    """Fetch the most recent mock interview session for the user."""
    result = await interview_service.get_latest_interview(str(current_user["_id"]))
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No mock interview found.",
        )
    return result


@router.get("/{interview_id}", response_model=InterviewResponse)
async def get_interview_by_id_route(
    interview_id: str = Path(..., description="ID of the interview session"),
    current_user: dict = Depends(get_current_user),
) -> InterviewResponse:
    """Fetch a specific mock interview session by its ID."""
    result = await interview_service.get_interview_by_id(
        user_id=str(current_user["_id"]),
        interview_id=interview_id,
    )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview session not found.",
        )
    return result
