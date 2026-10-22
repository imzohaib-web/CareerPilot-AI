"""Qwen connectivity via Alibaba Cloud Model Studio (DashScope).

Uses the OpenAI-compatible endpoint so all provider-specific details stay in
this module. Only sanitized errors are raised upward — no keys, stack traces,
or provider internals escape this service.
"""

import asyncio
from collections.abc import AsyncGenerator
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


def _map_openai_error(
    exc: Exception, duration: float, effective_timeout: float
) -> AIServiceError:
    """Map provider exceptions to user-safe sanitized AIServiceError instances."""
    if isinstance(exc, APITimeoutError):
        logger.error(
            "Qwen request timed out after %.1fs (limit %.0fs, model=%s)",
            duration,
            effective_timeout,
            config.QWEN_MODEL,
        )
        return AIServiceError(f"AI provider request timed out after {effective_timeout:.0f}s")
    if isinstance(exc, AuthenticationError):
        logger.error(
            "Qwen rejected the configured API key (HTTP 401) after %.1fs",
            duration,
        )
        return AIServiceError("AI provider rejected the configured API key (HTTP 401)")
    if isinstance(exc, NotFoundError):
        logger.error(
            "Qwen model/endpoint not found (HTTP 404) after %.1fs (model=%s, base_url_host=%s)",
            duration,
            config.QWEN_MODEL,
            _base_url_host(),
        )
        return AIServiceError("AI provider did not recognize the configured model or endpoint (HTTP 404)")
    if isinstance(exc, BadRequestError):
        logger.error(
            "Qwen rejected request parameters (HTTP 400) after %.1fs (model=%s): %.300s",
            duration,
            config.QWEN_MODEL,
            exc,
        )
        return AIServiceError("AI provider rejected the request parameters (HTTP 400)")
    if isinstance(exc, RateLimitError):
        logger.error("Qwen rate limit reached (HTTP 429) after %.1fs", duration)
        return AIServiceError("AI provider rate limit reached; please try again shortly")
    if isinstance(exc, APIConnectionError):
        logger.error(
            "Qwen connection failed after %.1fs (base_url_host=%s): %.300s",
            duration,
            _base_url_host(),
            exc,
        )
        return AIServiceError("Could not connect to the AI provider")
    if isinstance(exc, APIStatusError):
        status_code = getattr(exc, "status_code", "?")
        logger.error(
            "Qwen HTTP error %s after %.1fs (model=%s): %.300s",
            status_code,
            duration,
            config.QWEN_MODEL,
            exc,
        )
        return AIServiceError(f"AI provider returned an error (HTTP {status_code})")
    if isinstance(exc, OpenAIError):
        logger.error(
            "Qwen request failed after %.1fs [%s]: %.300s",
            duration,
            type(exc).__name__,
            exc,
        )
        return AIServiceError("AI provider request failed")
    logger.error("Qwen unexpected error after %.1fs: %.300s", duration, exc)
    return AIServiceError("AI provider request failed")


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
    except Exception as exc:
        duration = time.monotonic() - t0
        raise _map_openai_error(exc, duration, effective_timeout) from exc

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


async def stream_chat_completion(
    messages: list[dict],
    temperature: float | None = None,
    timeout: float | None = None,
    idle_timeout: float | None = None,
    extra_body: dict | None = None,
) -> AsyncGenerator[str, None]:
    """Stream text deltas from Qwen via the OpenAI-compatible client.

    Yields non-empty text deltas only.
    Enforces overall timeout and idle timeout (no token for idle_timeout seconds).
    Never logs prompt, token content, or secrets.
    """
    client = _get_client()
    effective_timeout = timeout if timeout is not None else config.QWEN_TIMEOUT
    effective_idle_timeout = (
        idle_timeout if idle_timeout is not None else config.STREAMING_IDLE_TIMEOUT
    )

    body = dict(extra_body) if extra_body else {}
    body.setdefault("enable_thinking", False)

    kwargs: dict = {
        "model": config.QWEN_MODEL,
        "messages": messages,
        "stream": True,
        "timeout": effective_timeout,
        "extra_body": body,
    }
    if temperature is not None:
        kwargs["temperature"] = temperature

    t0 = time.monotonic()
    total_deadline = t0 + effective_timeout

    logger.debug(
        "Qwen streaming request started (model=%s, messages=%d, timeout=%.0fs, idle_timeout=%.0fs, base_url_host=%s)",
        config.QWEN_MODEL,
        len(messages),
        effective_timeout,
        effective_idle_timeout,
        _base_url_host(),
    )

    try:
        stream = await client.chat.completions.create(**kwargs)
    except AIServiceError:
        raise
    except OpenAIError as exc:
        duration = time.monotonic() - t0
        raise _map_openai_error(exc, duration, effective_timeout) from exc
    except Exception as exc:
        duration = time.monotonic() - t0
        logger.error("Qwen unexpected error creating stream after %.1fs: %.300s", duration, exc)
        raise AIServiceError("Failed to initiate AI streaming response") from exc

    try:
        while True:
            time_left = total_deadline - time.monotonic()
            if time_left <= 0:
                duration = time.monotonic() - t0
                logger.error(
                    "Qwen stream total timeout reached after %.1fs (limit %.0fs)",
                    duration,
                    effective_timeout,
                )
                raise AIServiceError(f"AI provider request timed out after {effective_timeout:.0f}s")

            wait_time = min(time_left, effective_idle_timeout)
            try:
                # Use stream.__anext__() to pull next chunk with idle timeout
                chunk = await asyncio.wait_for(stream.__anext__(), timeout=wait_time)
            except StopAsyncIteration:
                break
            except asyncio.TimeoutError as exc:
                duration = time.monotonic() - t0
                if time.monotonic() >= total_deadline:
                    logger.error(
                        "Qwen stream total timeout reached after %.1fs (limit %.0fs)",
                        duration,
                        effective_timeout,
                    )
                    raise AIServiceError(f"AI provider request timed out after {effective_timeout:.0f}s") from exc
                else:
                    logger.error(
                        "Qwen stream idle timeout (no token for %.0fs, total elapsed %.1fs)",
                        effective_idle_timeout,
                        duration,
                    )
                    raise AIServiceError(
                        f"AI provider stream idle timeout: no token received for {effective_idle_timeout:.0f}s"
                    ) from exc
            except OpenAIError as exc:
                duration = time.monotonic() - t0
                raise _map_openai_error(exc, duration, effective_timeout) from exc
            except asyncio.CancelledError:
                logger.info("Qwen stream cancelled by caller after %.1fs", time.monotonic() - t0)
                raise
            except Exception as exc:
                duration = time.monotonic() - t0
                logger.error("Qwen stream iteration error after %.1fs: %.300s", duration, exc)
                raise AIServiceError("AI provider streaming failed") from exc

            choices = getattr(chunk, "choices", None) or []
            if choices:
                delta = getattr(choices[0], "delta", None)
                delta_content = getattr(delta, "content", None) if delta else None
                if delta_content and isinstance(delta_content, str):
                    yield delta_content

    finally:
        try:
            if hasattr(stream, "close"):
                res = stream.close()
                if asyncio.iscoroutine(res):
                    await res
            elif hasattr(stream, "aclose"):
                res = stream.aclose()
                if asyncio.iscoroutine(res):
                    await res
        except Exception:
            pass
