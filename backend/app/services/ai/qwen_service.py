"""Qwen connectivity via Alibaba Cloud Model Studio (DashScope).

Uses the OpenAI-compatible endpoint so all provider-specific details stay in
this module. Only sanitized errors are raised upward — no keys, stack traces,
or provider internals escape this service.
"""

import logging
import time

from openai import APITimeoutError, AsyncOpenAI, OpenAIError

from app import config

logger = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None


class AIServiceError(Exception):
    """Provider failure with a message that is safe to surface to clients."""


def _get_client() -> AsyncOpenAI:
    """Return the shared OpenAI-compatible client for DashScope.

    ``max_retries=0`` disables the SDK's built-in auto-retry so that our
    application-level retry logic (e.g. resume analyzer corrective prompt)
    has full control over retry behaviour.
    """
    global _client
    if _client is None:
        if not config.ALIBABA_CLOUD_API_KEY:
            raise AIServiceError("AI service is not configured")
        _client = AsyncOpenAI(
            api_key=config.ALIBABA_CLOUD_API_KEY,
            base_url=config.QWEN_BASE_URL,
            max_retries=0,
        )
    return _client


async def chat(
    user_message: str,
    system_prompt: str | None = None,
    temperature: float | None = None,
    timeout: float | None = None,
    extra_body: dict | None = None,
) -> tuple[str, str]:
    """Send a single-turn message to Qwen.

    Returns ``(reply_text, model)``. Raises ``AIServiceError`` on any
    provider failure.

    Parameters
    ----------
    temperature : optional override for the provider default (useful for
        deterministic structured-output prompts).
    timeout : per-request timeout in seconds.  Defaults to
        ``config.QWEN_TIMEOUT`` (60 s).  Callers with large prompts
        (e.g. resume analysis) should pass a longer value.
    extra_body : merged into the request body.  Used to control
        provider-specific options such as Qwen3 thinking mode.
    """
    client = _get_client()
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": user_message})

    effective_timeout = timeout if timeout is not None else config.QWEN_TIMEOUT

    kwargs: dict = {
        "model": config.QWEN_MODEL,
        "messages": messages,
        "timeout": effective_timeout,
    }
    if temperature is not None:
        kwargs["temperature"] = temperature
    if extra_body is not None:
        kwargs["extra_body"] = extra_body

    t0 = time.monotonic()
    try:
        completion = await client.chat.completions.create(**kwargs)
    except APITimeoutError as exc:
        duration = time.monotonic() - t0
        # Log exception type + duration; never expose keys or request bodies.
        logger.error(
            "Qwen request timed out after %.1fs (limit %.0fs): %s",
            duration,
            effective_timeout,
            type(exc).__name__,
        )
        raise AIServiceError("AI provider request timed out") from exc
    except OpenAIError as exc:
        duration = time.monotonic() - t0
        logger.error(
            "Qwen request failed after %.1fs [%s]: %s",
            duration,
            type(exc).__name__,
            exc,
        )
        raise AIServiceError("AI provider request failed") from exc

    duration = time.monotonic() - t0
    if not completion.choices:
        raise AIServiceError("AI provider returned an empty response")
    content = (completion.choices[0].message.content or "").strip()
    if not content:
        raise AIServiceError("AI provider returned an empty response")
    model = completion.model or config.QWEN_MODEL
    logger.info(
        "Qwen response received in %.1fs (model=%s, chars=%d)",
        duration,
        model,
        len(content),
    )
    return content, model
