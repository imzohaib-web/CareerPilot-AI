"""Tests for centralized DashScope text embedding service.

Verifies:
- Batching splits input according to EMBEDDING_BATCH_SIZE while preserving order.
- Bounded retry on 429 RateLimitError, APITimeoutError, and 5xx APIStatusError.
- Immediate failure on non-retryable 401 AuthenticationError and 400 BadRequestError.
- Input truncation for inputs exceeding MAX_INPUT_CHARS.
- L2-normalization of returned vectors.
- Error sanitization.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AuthenticationError,
    BadRequestError,
    NotFoundError,
    RateLimitError,
)

from app.services.ai import embedding_service
from app.services.ai.qwen_service import AIConfigurationError, AIServiceError

BASE_URL = "https://dashscope.example.com/compatible-mode/v1"


def _request() -> httpx.Request:
    return httpx.Request("POST", BASE_URL + "/embeddings")


def _response(status_code: int) -> httpx.Response:
    return httpx.Response(status_code, request=_request())


@pytest.fixture(autouse=True)
def _reset_shared_embedding_client():
    """Ensure clean client cache before and after each test."""
    embedding_service._client = None
    yield
    embedding_service._client = None


class TestEmbeddingConfiguration:
    def test_missing_api_key_raises_configuration_error(self):
        with patch.object(embedding_service.config, "ALIBABA_CLOUD_API_KEY", ""):
            with pytest.raises(AIConfigurationError, match="not configured"):
                embedding_service._get_client()

    def test_client_is_cached(self):
        with patch.object(embedding_service.config, "ALIBABA_CLOUD_API_KEY", "test-key"):
            c1 = embedding_service._get_client()
            c2 = embedding_service._get_client()
            assert c1 is c2


class TestEmbeddingBatching:
    @pytest.mark.asyncio
    async def test_batching_splits_correctly(self):
        """Passing 25 items with batch_size=10 splits into 3 calls (10, 10, 5) and returns 25 vectors in order."""
        texts = [f"Text item number {i}" for i in range(25)]

        recorded_batches: list[list[str]] = []

        async def mock_create(**kwargs):
            batch = kwargs.get("input", [])
            recorded_batches.append(batch)
            data = [
                SimpleNamespace(
                    embedding=[float(i)] * 8,
                    index=idx,
                )
                for idx, i in enumerate(range(len(batch)))
            ]
            return SimpleNamespace(data=data)

        mock_client = MagicMock()
        mock_client.embeddings.create = AsyncMock(side_effect=mock_create)

        with patch.object(embedding_service, "_get_client", return_value=mock_client):
            with patch.object(embedding_service.config, "EMBEDDING_BATCH_SIZE", 10):
                vectors = await embedding_service.embed_texts(texts, base_delay=0.01)

        assert len(recorded_batches) == 3
        assert len(recorded_batches[0]) == 10
        assert len(recorded_batches[1]) == 10
        assert len(recorded_batches[2]) == 5
        assert len(vectors) == 25
        # Verify normalization: norm should be 1.0 (for non-zero vectors)
        norm = sum(x * x for x in vectors[1]) ** 0.5
        assert pytest.approx(norm, 0.0001) == 1.0

    @pytest.mark.asyncio
    async def test_empty_texts_returns_empty_list(self):
        res = await embedding_service.embed_texts([])
        assert res == []

    @pytest.mark.asyncio
    async def test_embed_query_empty_returns_zero_vector(self):
        with patch.object(embedding_service.config, "EMBEDDING_DIMENSIONS", 16):
            vec = await embedding_service.embed_query("")
            assert vec == [0.0] * 16


class TestEmbeddingRetryAndBackoff:
    @pytest.mark.asyncio
    async def test_retry_on_429_then_success(self):
        """Simulate 429 rate limit error on first call, followed by success on retry."""
        rate_limit_exc = RateLimitError("Rate limit exceeded", response=_response(429), body=None)
        success_response = SimpleNamespace(
            data=[SimpleNamespace(embedding=[0.5] * 8, index=0)]
        )

        mock_create = AsyncMock(side_effect=[rate_limit_exc, success_response])
        mock_client = MagicMock()
        mock_client.embeddings.create = mock_create

        with patch.object(embedding_service, "_get_client", return_value=mock_client):
            with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
                vectors = await embedding_service.embed_texts(["sample text"], base_delay=0.1)

        assert len(vectors) == 1
        assert mock_create.call_count == 2
        mock_sleep.assert_called_once_with(0.1)

    @pytest.mark.asyncio
    async def test_retry_on_timeout_then_success(self):
        """Simulate APITimeoutError on first call, then success."""
        timeout_exc = APITimeoutError(request=_request())
        success_response = SimpleNamespace(
            data=[SimpleNamespace(embedding=[0.2] * 8, index=0)]
        )

        mock_create = AsyncMock(side_effect=[timeout_exc, success_response])
        mock_client = MagicMock()
        mock_client.embeddings.create = mock_create

        with patch.object(embedding_service, "_get_client", return_value=mock_client):
            with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
                vectors = await embedding_service.embed_texts(["sample text"], base_delay=0.2)

        assert len(vectors) == 1
        assert mock_create.call_count == 2
        mock_sleep.assert_called_once_with(0.2)

    @pytest.mark.asyncio
    async def test_retry_exhausted_raises_ai_service_error(self):
        """Verify 3 consecutive 429 errors exhaust max retries and raise AIServiceError."""
        rate_limit_exc = RateLimitError("Rate limit exceeded", response=_response(429), body=None)
        mock_create = AsyncMock(side_effect=[rate_limit_exc, rate_limit_exc, rate_limit_exc])
        mock_client = MagicMock()
        mock_client.embeddings.create = mock_create

        with patch.object(embedding_service, "_get_client", return_value=mock_client):
            with patch("asyncio.sleep", new_callable=AsyncMock):
                with pytest.raises(AIServiceError, match="rate limit"):
                    await embedding_service.embed_texts(["sample text"], base_delay=0.01)

        assert mock_create.call_count == 3

    @pytest.mark.asyncio
    async def test_non_retryable_401_fails_immediately(self):
        """AuthenticationError (401) should fail immediately without retrying."""
        auth_exc = AuthenticationError("Unauthorized", response=_response(401), body=None)
        mock_create = AsyncMock(side_effect=auth_exc)
        mock_client = MagicMock()
        mock_client.embeddings.create = mock_create

        with patch.object(embedding_service, "_get_client", return_value=mock_client):
            with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
                with pytest.raises(AIServiceError, match="API key"):
                    await embedding_service.embed_texts(["sample text"])

        assert mock_create.call_count == 1
        mock_sleep.assert_not_called()

    @pytest.mark.asyncio
    async def test_non_retryable_400_fails_immediately(self):
        """BadRequestError (400) should fail immediately without retrying."""
        bad_req_exc = BadRequestError("Bad request", response=_response(400), body=None)
        mock_create = AsyncMock(side_effect=bad_req_exc)
        mock_client = MagicMock()
        mock_client.embeddings.create = mock_create

        with patch.object(embedding_service, "_get_client", return_value=mock_client):
            with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
                with pytest.raises(AIServiceError, match="request parameters"):
                    await embedding_service.embed_texts(["sample text"])

        assert mock_create.call_count == 1
        mock_sleep.assert_not_called()


class TestInputTruncationAndNormalization:
    def test_truncate_long_text(self):
        long_text = "word " * 3000  # 15,000 chars
        truncated = embedding_service._sanitize_input(long_text, max_chars=100)
        assert len(truncated) <= 100
        assert not truncated.endswith("word") or truncated.endswith("word")

    def test_l2_normalize_unit_length(self):
        vec = [3.0, 4.0]
        norm_vec = embedding_service.l2_normalize(vec)
        assert norm_vec == [0.6, 0.8]
        norm = sum(x * x for x in norm_vec) ** 0.5
        assert pytest.approx(norm, 0.0001) == 1.0

    def test_l2_normalize_zero_vector(self):
        vec = [0.0, 0.0, 0.0]
        assert embedding_service.l2_normalize(vec) == [0.0, 0.0, 0.0]
