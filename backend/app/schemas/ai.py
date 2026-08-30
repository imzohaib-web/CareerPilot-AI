"""Request/response schemas for the AI connectivity test."""

from pydantic import BaseModel, Field, field_validator


class AITestRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)

    @field_validator("message")
    @classmethod
    def validate_message(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Message must not be blank")
        return stripped


class AITestResponse(BaseModel):
    success: bool
    message: str
    model: str
