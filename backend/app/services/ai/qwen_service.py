"""Qwen connectivity via Alibaba Cloud Model Studio (DashScope).

Uses the OpenAI-compatible endpoint so all provider-specific details stay in
this module. Only sanitized errors are raised upward — no keys, stack traces,
or provider internals escape this service.
"""

import logging
import time
from urllib.parse import urlparse

from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AsyncOpenAI,
    AuthenticationError,
    BadRequestError,
    NotFoundError,
    OpenAIError,
    RateLimitError,
)

from app import config

logger = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None


class AIServiceError(Exception):
    """Provider failure with a message that is safe to surface to clients."""


class AIConfigurationError(AIServiceError):
    """AI credentials/settings are missing (a setup problem, not a provider
    failure). Routes map this to HTTP 503 so clients can tell the difference
    between "the server is not set up" and "the provider is down"."""


def _base_url_host() -> str:
    """Hostname of the configured base URL — safe for logs (no credentials,
    no API keys, no path/query components)."""
    try:
        return urlparse(config.QWEN_BASE_URL).hostname or "unknown"
    except ValueError:
        return "unknown"


def _get_client() -> AsyncOpenAI:
    """Return the shared OpenAI-compatible client for DashScope.

    ``max_retries=0`` disables the SDK's built-in auto-retry so that our
    application-level retry logic (e.g. resume analyzer corrective prompt)
    has full control over retry behaviour.
    """
    global _client
    if _client is None:
        if not config.ALIBABA_CLOUD_API_KEY:
            logger.error(
                "Qwen client NOT initialized: ALIBABA_CLOUD_API_KEY is empty "
                "(api_key_configured=false, base_url_host=%s, model=%s)",
                _base_url_host(),
                config.QWEN_MODEL,
            )
            raise AIConfigurationError(
                "AI service is not configured: ALIBABA_CLOUD_API_KEY is missing "
                "in backend/.env"
            )
        _client = AsyncOpenAI(
            api_key=config.ALIBABA_CLOUD_API_KEY,
            base_url=config.QWEN_BASE_URL,
            max_retries=0,
        )
        logger.info(
            "Qwen client initialized (api_key_configured=true, base_url_host=%s, "
            "model=%s)",
            _base_url_host(),
            config.QWEN_MODEL,
        )
    return _client


async def chat(
    user_message: str,
    system_prompt: str | None = None,
    temperature: float | None = None,
    timeout: float | None = None,
    extra_body: dict | None = None,
    history: list[dict] | None = None,
) -> tuple[str, str]:
    """Send a message to Qwen, optionally with prior conversation turns.

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
    history : earlier conversation turns as ``{"role", "content"}`` dicts,
        replayed between the system prompt and the current user message.
        Only ``user``/``assistant`` turns with non-empty content are sent;
        malformed entries are skipped.
    """
    client = _get_client()
    messages: list[dict] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    for turn in history or []:
        if not isinstance(turn, dict):
            continue
        role = turn.get("role")
        content = turn.get("content")
        if role in ("user", "assistant") and isinstance(content, str) and content.strip():
            messages.append({"role": role, "content": content})
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
    logger.debug(
        "Qwen request started (model=%s, messages=%d, timeout=%.0fs, base_url_host=%s)",
        config.QWEN_MODEL,
        len(messages),
        effective_timeout,
        _base_url_host(),
    )
    try:
        completion = await client.chat.completions.create(**kwargs)
    except APITimeoutError as exc:
        duration = time.monotonic() - t0
        # Log duration + context; never expose keys or request bodies.
        logger.error(
            "Qwen request timed out after %.1fs (limit %.0fs, model=%s)",
            duration,
            effective_timeout,
            config.QWEN_MODEL,
        )
        raise AIServiceError(
            f"AI provider request timed out after {effective_timeout:.0f}s"
        ) from exc
    except AuthenticationError as exc:
        duration = time.monotonic() - t0
        logger.error(
            "Qwen rejected the configured API key (HTTP 401) after %.1fs",
            duration,
        )
        raise AIServiceError(
            "AI provider rejected the configured API key (HTTP 401)"
        ) from exc
    except NotFoundError as exc:
        duration = time.monotonic() - t0
        logger.error(
            "Qwen model/endpoint not found (HTTP 404) after %.1fs "
            "(model=%s, base_url_host=%s)",
            duration,
            config.QWEN_MODEL,
            _base_url_host(),
        )
        raise AIServiceError(
            "AI provider did not recognize the configured model or endpoint "
            "(HTTP 404)"
        ) from exc
    except BadRequestError as exc:
        duration = time.monotonic() - t0
        # Provider error body can explain the bad parameter — safe to log
        # server-side (contains no secrets), truncated.
        logger.error(
            "Qwen rejected request parameters (HTTP 400) after %.1fs "
            "(model=%s): %.300s",
            duration,
            config.QWEN_MODEL,
            exc,
        )
        raise AIServiceError(
            "AI provider rejected the request parameters (HTTP 400)"
        ) from exc
    except RateLimitError as exc:
        duration = time.monotonic() - t0
        logger.error("Qwen rate limit reached (HTTP 429) after %.1fs", duration)
        raise AIServiceError(
            "AI provider rate limit reached; please try again shortly"
        ) from exc
    except APIConnectionError as exc:
        duration = time.monotonic() - t0
        logger.error(
            "Qwen connection failed after %.1fs (base_url_host=%s): %.300s",
            duration,
            _base_url_host(),
            exc,
        )
        raise AIServiceError("Could not connect to the AI provider") from exc
    except APIStatusError as exc:
        duration = time.monotonic() - t0
        status_code = getattr(exc, "status_code", "?")
        logger.error(
            "Qwen HTTP error %s after %.1fs (model=%s): %.300s",
            status_code,
            duration,
            config.QWEN_MODEL,
            exc,
        )
        raise AIServiceError(
            f"AI provider returned an error (HTTP {status_code})"
        ) from exc
    except OpenAIError as exc:
        duration = time.monotonic() - t0
        logger.error(
            "Qwen request failed after %.1fs [%s]: %.300s",
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
