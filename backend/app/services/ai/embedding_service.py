"""DashScope text embedding connectivity via Alibaba Cloud Model Studio.

Uses the OpenAI-compatible /embeddings endpoint so all provider-specific
details and credentials remain isolated in this module. Only sanitized
errors are raised upward.
"""

import asyncio
import logging
import math
import time
from typing import Any
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
from app.services.ai.qwen_service import AIConfigurationError, AIServiceError

logger = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None

# Max characters per input to safely stay within the model's 8192-token context limit
MAX_INPUT_CHARS: int = 8192
MAX_RETRIES: int = 3


def _base_url_host() -> str:
    """Hostname of the configured base URL — safe for logs."""
    try:
        return urlparse(config.QWEN_BASE_URL).hostname or "unknown"
    except ValueError:
        return "unknown"


def _get_client() -> AsyncOpenAI:
    """Return the shared OpenAI-compatible client for DashScope embeddings.

    max_retries=0 disables SDK-level auto-retries so that our application-level
    exponential backoff policy has full control.
    """
    global _client
    if _client is None:
        if not config.ALIBABA_CLOUD_API_KEY:
            logger.error(
                "Embedding client NOT initialized: ALIBABA_CLOUD_API_KEY is empty "
                "(api_key_configured=false, base_url_host=%s, model=%s)",
                _base_url_host(),
                config.EMBEDDING_MODEL,
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
            "Embedding client initialized (api_key_configured=true, base_url_host=%s, "
            "model=%s)",
            _base_url_host(),
            config.EMBEDDING_MODEL,
        )
    return _client


def l2_normalize(vector: list[float]) -> list[float]:
    """L2-normalize a floating point vector so cosine similarity is a dot product."""
    norm = math.sqrt(sum(x * x for x in vector))
    if norm > 0.0:
        return [x / norm for x in vector]
    return vector


def _sanitize_input(text: str, max_chars: int = MAX_INPUT_CHARS) -> str:
    """Sanitize and truncate text to stay within safe token/character limits."""
    if not text:
        return " "
    cleaned = text.strip()
    if not cleaned:
        return " "
    if len(cleaned) > max_chars:
        truncated = cleaned[:max_chars]
        last_space = truncated.rfind(" ")
        if last_space > int(max_chars * 0.8):
            cleaned = truncated[:last_space]
        else:
            cleaned = truncated
    return cleaned


def _extract_embedding(item: Any) -> list[float]:
    """Extract float vector from SDK response item or mock dictionary."""
    if isinstance(item, dict):
        return item.get("embedding", [])
    if hasattr(item, "embedding"):
        return item.embedding
    if isinstance(item, list):
        return item
    return []


async def _embed_batch_with_retry(
    client: AsyncOpenAI,
    batch: list[str],
    model: str,
    base_delay: float = 0.5,
) -> list[list[float]]:
    """Execute a single embedding batch request with bounded retry and exponential backoff."""
    kwargs: dict[str, Any] = {
        "model": model,
        "input": batch,
        "timeout": config.EMBEDDING_TIMEOUT,
    }
    if config.EMBEDDING_DIMENSIONS:
        kwargs["dimensions"] = config.EMBEDDING_DIMENSIONS

    for attempt in range(MAX_RETRIES):
        t0 = time.monotonic()
        try:
            logger.debug(
                "DashScope embedding request (model=%s, items=%d, attempt=%d/%d)",
                model,
                len(batch),
                attempt + 1,
                MAX_RETRIES,
            )
            response = await client.embeddings.create(**kwargs)
            duration = time.monotonic() - t0

            data = getattr(response, "data", [])
            # Sort by item index to preserve order
            sorted_data = sorted(data, key=lambda x: getattr(x, "index", 0) if not isinstance(x, dict) else x.get("index", 0))
            vectors = [l2_normalize(_extract_embedding(item)) for item in sorted_data]

            logger.debug(
                "DashScope embedding received in %.2fs (model=%s, returned=%d)",
                duration,
                model,
                len(vectors),
            )
            return vectors

        except APITimeoutError as exc:
            duration = time.monotonic() - t0
            logger.warning(
                "DashScope embedding timed out after %.1fs (attempt %d/%d, limit %.0fs, model=%s)",
                duration,
                attempt + 1,
                MAX_RETRIES,
                config.EMBEDDING_TIMEOUT,
                model,
            )
            if attempt == MAX_RETRIES - 1:
                raise AIServiceError(
                    f"Embedding provider request timed out after {config.EMBEDDING_TIMEOUT:.0f}s"
                ) from exc
            await asyncio.sleep(base_delay * (2 ** attempt))

        except RateLimitError as exc:
            duration = time.monotonic() - t0
            logger.warning(
                "DashScope embedding rate limit (HTTP 429) after %.1fs (attempt %d/%d)",
                duration,
                attempt + 1,
                MAX_RETRIES,
            )
            if attempt == MAX_RETRIES - 1:
                raise AIServiceError(
                    "Embedding provider rate limit reached; please try again shortly"
                ) from exc
            await asyncio.sleep(base_delay * (2 ** attempt))

        except APIConnectionError as exc:
            duration = time.monotonic() - t0
            logger.warning(
                "DashScope embedding connection failed after %.1fs (attempt %d/%d, host=%s): %.300s",
                duration,
                attempt + 1,
                MAX_RETRIES,
                _base_url_host(),
                exc,
            )
            if attempt == MAX_RETRIES - 1:
                raise AIServiceError("Could not connect to the embedding provider") from exc
            await asyncio.sleep(base_delay * (2 ** attempt))

        except AuthenticationError as exc:
            duration = time.monotonic() - t0
            logger.error(
                "DashScope embedding rejected API key (HTTP 401) after %.1fs",
                duration,
            )
            raise AIServiceError(
                "Embedding provider rejected the configured API key (HTTP 401)"
            ) from exc

        except BadRequestError as exc:
            duration = time.monotonic() - t0
            logger.error(
                "DashScope embedding rejected parameters (HTTP 400) after %.1fs (model=%s): %.300s",
                duration,
                model,
                exc,
            )
            raise AIServiceError(
                "Embedding provider rejected the request parameters (HTTP 400)"
            ) from exc

        except NotFoundError as exc:
            duration = time.monotonic() - t0
            logger.error(
                "DashScope embedding model/endpoint not found (HTTP 404) after %.1fs (model=%s)",
                duration,
                model,
            )
            if config.EMBEDDING_FALLBACK_MODEL and model != config.EMBEDDING_FALLBACK_MODEL:
                logger.info(
                    "Attempting embedding fallback from %s to %s",
                    model,
                    config.EMBEDDING_FALLBACK_MODEL,
                )
                return await _embed_batch_with_retry(
                    client=client,
                    batch=batch,
                    model=config.EMBEDDING_FALLBACK_MODEL,
                    base_delay=base_delay,
                )
            raise AIServiceError(
                "Embedding provider did not recognize the configured model or endpoint (HTTP 404)"
            ) from exc

        except APIStatusError as exc:
            duration = time.monotonic() - t0
            status_code = getattr(exc, "status_code", 500)
            if status_code >= 500 and attempt < MAX_RETRIES - 1:
                logger.warning(
                    "DashScope embedding HTTP %s after %.1fs (attempt %d/%d): %.300s",
                    status_code,
                    duration,
                    attempt + 1,
                    MAX_RETRIES,
                    exc,
                )
                await asyncio.sleep(base_delay * (2 ** attempt))
                continue

            logger.error(
                "DashScope embedding HTTP %s after %.1fs (model=%s): %.300s",
                status_code,
                duration,
                model,
                exc,
            )
            raise AIServiceError(
                f"Embedding provider returned an error (HTTP {status_code})"
            ) from exc

        except OpenAIError as exc:
            duration = time.monotonic() - t0
            logger.error(
                "DashScope embedding request failed after %.1fs [%s]: %.300s",
                duration,
                type(exc).__name__,
                exc,
            )
            raise AIServiceError("Embedding provider request failed") from exc

    raise AIServiceError("Embedding provider request failed after maximum retries")


async def embed_texts(texts: list[str], base_delay: float = 0.5) -> list[list[float]]:
    """Generate normalized dense embeddings for a list of texts in batches.

    Parameters
    ----------
    texts : list of raw text strings to embed.
    base_delay : initial backoff delay in seconds (used for testing and rate-limits).

    Returns
    -------
    list of L2-normalized float vectors.
    """
    if not texts:
        return []

    client = _get_client()
    batch_size = max(1, config.EMBEDDING_BATCH_SIZE)
    sanitized_texts = [_sanitize_input(t) for t in texts]

    all_embeddings: list[list[float]] = []
    for i in range(0, len(sanitized_texts), batch_size):
        batch = sanitized_texts[i : i + batch_size]
        batch_vecs = await _embed_batch_with_retry(
            client=client,
            batch=batch,
            model=config.EMBEDDING_MODEL,
            base_delay=base_delay,
        )
        all_embeddings.extend(batch_vecs)

    return all_embeddings


async def embed_query(text: str) -> list[float]:
    """Generate a single normalized dense embedding for a query string."""
    if not text or not text.strip():
        return [0.0] * config.EMBEDDING_DIMENSIONS

    embeddings = await embed_texts([text])
    if not embeddings or not embeddings[0]:
        return [0.0] * config.EMBEDDING_DIMENSIONS
    return embeddings[0]
