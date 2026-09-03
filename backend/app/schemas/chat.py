"""Request/response schemas for the AI Career Mentor chat."""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

# Hard limit on a single user message (chars).  Keeps prompts bounded and
# blocks abuse — far more than any career question needs.
MAX_MESSAGE_CHARS = 4_000


class MentorChatRequest(BaseModel):
    """A single turn sent to the Career Mentor.

    ``conversation_id`` is optional: omit it to continue the user's most
    recent conversation (a new one is created when none exists).  Ownership
    is always resolved from the JWT — never from this payload.
    """

    message: str = Field(min_length=1, max_length=MAX_MESSAGE_CHARS)
    conversation_id: str | None = Field(default=None, max_length=64)

    @field_validator("message")
    @classmethod
    def validate_message(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Message must not be blank")
        return stripped

    @field_validator("conversation_id")
    @classmethod
    def normalize_conversation_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class ChatMessage(BaseModel):
    """One message in a mentor conversation."""

    role: str  # "user" | "assistant"
    content: str
    created_at: datetime


class MentorChatResponse(BaseModel):
    """Reply to one mentor chat turn."""

    conversation_id: str
    message: ChatMessage
    model: str


class MentorHistoryResponse(BaseModel):
    """Stored mentor conversation (empty when the user has none yet)."""

    conversation_id: str | None = None
    messages: list[ChatMessage] = Field(default_factory=list)
    created_at: datetime | None = None
    updated_at: datetime | None = None
