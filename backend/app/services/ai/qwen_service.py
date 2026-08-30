"""Qwen connectivity via Alibaba Cloud Model Studio (DashScope).

Uses the OpenAI-compatible endpoint so all provider-specific details stay in
this module. Only sanitized errors are raised upward — no keys, stack traces,
or provider internals escape this service.
"""

import logging

from openai import AsyncOpenAI, OpenAIError

from app import config

logger = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None


class AIServiceError(Exception):
    """Provider failure with a message that is safe to surface to clients."""


def _get_client() -> AsyncOpenAI:
    """Return the shared OpenAI-compatible client for DashScope."""
    global _client
    if _client is None:
        if not config.ALIBABA_CLOUD_API_KEY:
            raise AIServiceError("AI service is not configured")
        _client = AsyncOpenAI(
            api_key=config.ALIBABA_CLOUD_API_KEY,
            base_url=config.QWEN_BASE_URL,
        )
    return _client


async def chat(user_message: str, system_prompt: str | None = None) -> tuple[str, str]:
    """Send a single-turn message to Qwen.

    Returns ``(reply_text, model)``. Raises ``AIServiceError`` on any
    provider failure.
    """
    client = _get_client()
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": user_message})

    try:
        completion = await client.chat.completions.create(
            model=config.QWEN_MODEL,
            messages=messages,
            timeout=60.0,
        )
    except OpenAIError as exc:
        # Log details server-side; never expose provider internals to clients.
        logger.error("Qwen request failed: %s", exc)
        raise AIServiceError("AI provider request failed") from exc

    if not completion.choices:
        raise AIServiceError("AI provider returned an empty response")
    content = (completion.choices[0].message.content or "").strip()
    if not content:
        raise AIServiceError("AI provider returned an empty response")
    return content, completion.model or config.QWEN_MODEL
