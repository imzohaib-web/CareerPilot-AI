"""Tests for the centralized Qwen service: configuration + error mapping.

Every provider failure must be translated into a sanitized ``AIServiceError``
message (never raw provider payloads), and missing configuration must be
distinguishable (``AIConfigurationError``) from provider failures so routes
can return 503 vs 502 correctly.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from openai import (
    APIConnectionError,
    APITimeoutError,
    AuthenticationError,
    BadRequestError,
    InternalServerError,
    NotFoundError,
    RateLimitError,
)

from app.services.ai import qwen_service
from app.services.ai.qwen_service import AIConfigurationError, AIServiceError

BASE_URL = "https://dashscope.example.com/compatible-mode/v1"


def _request() -> httpx.Request:
    return httpx.Request("POST", BASE_URL + "/chat/completions")


def _response(status_code: int) -> httpx.Response:
    return httpx.Response(status_code, request=_request())


def _client_raising(exc: Exception) -> MagicMock:
    client = MagicMock()
    client.chat.completions.create = AsyncMock(side_effect=exc)
    return client


@pytest.fixture(autouse=True)
def _reset_shared_client():
    """Keep the module-global client isolated between tests."""
    qwen_service._client = None
    yield
    qwen_service._client = None


# ── Configuration ─────────────────────────────────────────────────────────


class TestConfiguration:
    def test_missing_api_key_raises_configuration_error(self):
        with patch.object(qwen_service.config, "ALIBABA_CLOUD_API_KEY", ""):
            with pytest.raises(AIConfigurationError, match="not configured"):
                qwen_service._get_client()

    def test_configuration_error_is_an_ai_service_error(self):
        # Routes that only catch AIServiceError must still handle it.
        assert issubclass(AIConfigurationError, AIServiceError)

    def test_client_is_shared_and_cached(self):
        with patch.object(qwen_service.config, "ALIBABA_CLOUD_API_KEY", "test-key"):
            first = qwen_service._get_client()
            assert qwen_service._get_client() is first


# ── Provider error mapping ────────────────────────────────────────────────


class TestErrorMapping:
    """Each provider failure type maps to a distinct sanitized message."""

    @pytest.mark.asyncio
    async def test_timeout(self):
        client = _client_raising(APITimeoutError(request=_request()))
        with patch.object(qwen_service, "_get_client", return_value=client):
            with pytest.raises(AIServiceError, match="timed out"):
                await qwen_service.chat("hi", timeout=5)

    @pytest.mark.asyncio
    async def test_invalid_api_key(self):
        exc = AuthenticationError("401 invalid key", response=_response(401), body=None)
        client = _client_raising(exc)
        with patch.object(qwen_service, "_get_client", return_value=client):
            with pytest.raises(AIServiceError, match="API key"):
                await qwen_service.chat("hi")

    @pytest.mark.asyncio
    async def test_invalid_model_or_endpoint(self):
        exc = NotFoundError("404 model not found", response=_response(404), body=None)
        client = _client_raising(exc)
        with patch.object(qwen_service, "_get_client", return_value=client):
            with pytest.raises(AIServiceError, match="model or endpoint"):
                await qwen_service.chat("hi")

    @pytest.mark.asyncio
    async def test_bad_request_parameters(self):
        exc = BadRequestError("400 bad parameter", response=_response(400), body=None)
        client = _client_raising(exc)
        with patch.object(qwen_service, "_get_client", return_value=client):
            with pytest.raises(AIServiceError, match="request parameters"):
                await qwen_service.chat("hi")

    @pytest.mark.asyncio
    async def test_rate_limit(self):
        exc = RateLimitError("429 too many requests", response=_response(429), body=None)
        client = _client_raising(exc)
        with patch.object(qwen_service, "_get_client", return_value=client):
            with pytest.raises(AIServiceError, match="rate limit"):
                await qwen_service.chat("hi")

    @pytest.mark.asyncio
    async def test_network_failure(self):
        exc = APIConnectionError(message="Connection error.", request=_request())
        client = _client_raising(exc)
        with patch.object(qwen_service, "_get_client", return_value=client):
            with pytest.raises(AIServiceError, match="Could not connect"):
                await qwen_service.chat("hi")

    @pytest.mark.asyncio
    async def test_generic_provider_http_error(self):
        exc = InternalServerError("500 boom", response=_response(500), body=None)
        client = _client_raising(exc)
        with patch.object(qwen_service, "_get_client", return_value=client):
            with pytest.raises(AIServiceError, match=r"HTTP 500"):
                await qwen_service.chat("hi")

    @pytest.mark.asyncio
    async def test_provider_messages_are_sanitized(self):
        """Raised messages must not leak the raw provider error body."""
        exc = AuthenticationError(
            "Error code: 401 - {'internal': 'secret details'}",
            response=_response(401),
            body=None,
        )
        client = _client_raising(exc)
        with patch.object(qwen_service, "_get_client", return_value=client):
            with pytest.raises(AIServiceError) as exc_info:
                await qwen_service.chat("hi")
        assert "secret details" not in str(exc_info.value)


# ── Successful request ────────────────────────────────────────────────────


class TestSuccessfulChat:
    @pytest.mark.asyncio
    async def test_returns_content_and_model(self):
        completion = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content="Hello!"))],
            model="qwen-plus",
        )
        client = MagicMock()
        client.chat.completions.create = AsyncMock(return_value=completion)
        with patch.object(qwen_service, "_get_client", return_value=client):
            reply, model = await qwen_service.chat("hi", system_prompt="be nice")

        assert reply == "Hello!"
        assert model == "qwen-plus"

    @pytest.mark.asyncio
    async def test_configured_model_is_forwarded_to_provider(self):
        completion = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content="ok"))],
            model="qwen-plus",
        )
        client = MagicMock()
        client.chat.completions.create = AsyncMock(return_value=completion)
        with patch.object(qwen_service, "_get_client", return_value=client):
            await qwen_service.chat("hi", system_prompt="be nice")

        kwargs = client.chat.completions.create.call_args.kwargs
        assert kwargs["model"] == qwen_service.config.QWEN_MODEL
        assert kwargs["messages"] == [
            {"role": "system", "content": "be nice"},
            {"role": "user", "content": "hi"},
        ]

    @pytest.mark.asyncio
    async def test_empty_completion_raises(self):
        completion = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content="   "))],
            model="qwen-plus",
        )
        client = MagicMock()
        client.chat.completions.create = AsyncMock(return_value=completion)
        with patch.object(qwen_service, "_get_client", return_value=client):
            with pytest.raises(AIServiceError, match="empty response"):
                await qwen_service.chat("hi")
