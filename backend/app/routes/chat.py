"""Career Mentor chat routes: POST /api/chat/message, GET /api/chat/history.

All endpoints are authenticated; the acting user is always taken from the
JWT (never from the request body).  Handlers stay thin — validate → call
``chat_service`` → map service exceptions to HTTP codes.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse

from app import config
from app.core.rate_limit import limiter, medium_cost_rate_limit, require_medium_cost_quota
from app.schemas.chat import (
    MentorChatRequest,
    MentorChatResponse,
    MentorHistoryResponse,
)
from app.services import chat_service
from app.services.ai.qwen_service import AIServiceError
from app.services.dependencies import get_current_user

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/message", response_model=MentorChatResponse)
@limiter.limit(medium_cost_rate_limit)
async def send_message(
    request: Request,
    body: MentorChatRequest,
    current_user: dict = Depends(get_current_user),
    _: None = Depends(require_medium_cost_quota),
) -> MentorChatResponse:
    """Send one message to the AI Career Mentor and store the turn."""
    try:
        return await chat_service.send_message(
            str(current_user["_id"]), body.message, body.conversation_id
        )
    except chat_service.ChatValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except chat_service.ConversationNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )
    except chat_service.ChatPersistenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )
    except AIServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        )


@router.post("/message/stream")
@limiter.limit(medium_cost_rate_limit)
async def stream_message(
    request: Request,
    body: MentorChatRequest,
    current_user: dict = Depends(get_current_user),
    _: None = Depends(require_medium_cost_quota),
) -> StreamingResponse:
    """Stream token deltas for the AI Career Mentor as text/event-stream SSE events."""
    if not config.STREAMING_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Streaming is currently disabled",
        )

    headers = {
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(
        chat_service.stream_message(
            user_id=str(current_user["_id"]),
            message=body.message,
            conversation_id=body.conversation_id,
            request=request,
        ),
        media_type="text/event-stream",
        headers=headers,
    )


@router.get("/history", response_model=MentorHistoryResponse)
async def get_history(
    current_user: dict = Depends(get_current_user),
    conversation_id: str | None = None,
) -> MentorHistoryResponse:
    """Fetch the user's mentor conversation (latest when no id is given)."""
    try:
        return await chat_service.get_history(
            str(current_user["_id"]), conversation_id
        )
    except chat_service.ChatValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except chat_service.ConversationNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )
