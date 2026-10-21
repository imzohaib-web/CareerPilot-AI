"""AI routes: connectivity test only (Day 1).

The Career Mentor and feature-specific AI endpoints are intentionally NOT
implemented here yet.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.rate_limit import limiter, medium_cost_rate_limit, require_medium_cost_quota
from app.schemas.ai import AITestRequest, AITestResponse
from app.services.ai import qwen_service
from app.services.dependencies import get_current_user

router = APIRouter(prefix="/api/ai", tags=["ai"])

TEST_SYSTEM_PROMPT = (
    "You are CareerPilot AI, a concise and encouraging career assistant for "
    "students and early-career developers. Keep replies short and helpful."
)


@router.post("/test", response_model=AITestResponse)
@limiter.limit(medium_cost_rate_limit)
async def ai_test(
    request: Request,
    body: AITestRequest,
    _: dict = Depends(get_current_user),
    __: None = Depends(require_medium_cost_quota),
) -> AITestResponse:
    """Verify end-to-end Qwen connectivity for the authenticated user."""
    try:
        reply, model = await qwen_service.chat(body.message, TEST_SYSTEM_PROMPT)
    except qwen_service.AIServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        )
    return AITestResponse(success=True, message=reply, model=model)
