"""Resume routes: upload + AI analysis (all authenticated)."""

import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.schemas.resume import ResumeAnalysisResponse
from app.services import resume_service
from app.services.ai.qwen_service import AIConfigurationError, AIServiceError
from app.services.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/resume", tags=["resume"])


@router.post("/analyze", response_model=ResumeAnalysisResponse)
async def upload_and_analyze(
    file: UploadFile = File(..., description="PDF resume file"),
    current_user: dict = Depends(get_current_user),
) -> ResumeAnalysisResponse:
    """Upload a PDF resume, extract text, run AI analysis, store, and return result."""
    # 1. Validate PDF + extract text
    try:
        extracted_text, filename = await resume_service.validate_and_extract(file)
    except resume_service.ResumeValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    # 2. AI analysis + MongoDB persistence.
    #    AIConfigurationError (missing setup) → 503.
    #    AIServiceError (Qwen failure) → 502.
    #    Any other unexpected error falls through to the global handler (500).
    try:
        return await resume_service.upload_and_analyze(
            user_id=str(current_user["_id"]),
            extracted_text=extracted_text,
            filename=filename,
        )
    except AIConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )
    except AIServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        )


@router.get("/latest", response_model=ResumeAnalysisResponse)
async def get_latest_resume(
    current_user: dict = Depends(get_current_user),
) -> ResumeAnalysisResponse:
    """Fetch the most recent resume analysis for the authenticated user."""
    result = await resume_service.get_latest_analysis(str(current_user["_id"]))
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No resume analysis found. Upload a resume first.",
        )
    return result
