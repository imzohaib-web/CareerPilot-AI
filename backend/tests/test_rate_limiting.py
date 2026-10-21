"""Tests for rate limiting, email lockout, cost-aware AI quotas, circuit breaker, and upload caps."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from bson import ObjectId
from httpx import ASGITransport, AsyncClient

from app import config
from app.core import rate_limit
from app.core.rate_limit import (
    AccountLockoutException,
    CircuitBreakerExceeded,
    DailyQuotaExceeded,
    check_and_increment_quota,
    check_and_record_llm_call,
    limiter,
)
from app.main import app
from app.services.dependencies import get_current_user


def _make_client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://testserver")


@pytest.fixture
def enable_rate_limiting():
    """Context fixture to explicitly enable rate limiting for a test."""
    old_enabled = config.RATE_LIMIT_ENABLED
    config.RATE_LIMIT_ENABLED = True
    limiter.enabled = True
    rate_limit._offline_usage_counters.clear()
    rate_limit._offline_login_attempts.clear()
    rate_limit._llm_call_timestamps.clear()
    rate_limit._demo_user_ids.clear()
    yield
    config.RATE_LIMIT_ENABLED = old_enabled
    limiter.enabled = old_enabled
    rate_limit._offline_usage_counters.clear()
    rate_limit._offline_login_attempts.clear()
    rate_limit._llm_call_timestamps.clear()
    rate_limit._demo_user_ids.clear()


@pytest.mark.asyncio
async def test_login_rate_limit_triggers_on_6th_attempt(enable_rate_limiting):
    """POST /api/auth/login allows 5 requests/minute per IP; 6th attempt returns 429."""
    app.dependency_overrides.clear()
    client_ip = "192.168.1.100"
    headers = {"X-Forwarded-For": client_ip}

    async with _make_client() as client:
        # First 5 attempts from this IP return 401 Unauthorized
        for i in range(5):
            res = await client.post(
                "/api/auth/login",
                json={"email": f"user{i}@example.com", "password": "wrongpassword"},
                headers=headers,
            )
            assert res.status_code == 401, f"Attempt {i+1} failed: {res.status_code}"

        # 6th attempt from the same IP must be throttled by slowapi
        res6 = await client.post(
            "/api/auth/login",
            json={"email": "user6@example.com", "password": "wrongpassword"},
            headers=headers,
        )
        assert res6.status_code == 429
        assert "Retry-After" in res6.headers
        data = res6.json()
        assert "detail" in data
        assert "Rate limit exceeded" in data["detail"]


@pytest.mark.asyncio
async def test_lockout_by_email_after_10_failed_attempts(enable_rate_limiting):
    """10 failed attempts for the same email within 15 mins triggers lockout (429 with generic message)."""
    app.dependency_overrides.clear()
    target_email = "victim@example.com"

    async with _make_client() as client:
        # Send 10 failed login attempts from distinct IPs so IP rate limit is not tripped
        for i in range(10):
            res = await client.post(
                "/api/auth/login",
                json={"email": target_email, "password": f"wrong_{i}"},
                headers={"X-Forwarded-For": f"10.0.1.{i+1}"},
            )
            assert res.status_code == 401

        # 11th attempt with the locked email must return 429 with generic message
        res11 = await client.post(
            "/api/auth/login",
            json={"email": target_email, "password": "new_attempt"},
            headers={"X-Forwarded-For": "10.0.2.1"},
        )
        assert res11.status_code == 429
        assert "Retry-After" in res11.headers
        data = res11.json()
        assert data["detail"] == "Too many failed login attempts. Please try again later."

        # A different email from another IP is NOT locked out
        other_res = await client.post(
            "/api/auth/login",
            json={"email": "innocent@example.com", "password": "wrong"},
            headers={"X-Forwarded-For": "10.0.2.2"},
        )
        assert other_res.status_code == 401


@pytest.mark.asyncio
async def test_user_a_quota_does_not_affect_user_b(enable_rate_limiting):
    """User A exhausting their daily AI quota does not block User B."""
    user_a_id = "user_a_123"
    user_b_id = "user_b_456"

    # Consume all 40 quota slots for user A
    for _ in range(config.AI_HIGH_COST_DAILY_LIMIT):
        await check_and_increment_quota(user_id=user_a_id, cost_class="high")

    # User A's 41st call raises DailyQuotaExceeded
    with pytest.raises(DailyQuotaExceeded) as exc_info:
        await check_and_increment_quota(user_id=user_a_id, cost_class="high")
    assert exc_info.value.status_code == 429
    assert exc_info.value.detail == "Daily AI usage limit reached"
    assert exc_info.value.reset_at is not None

    # User B's quota is unaffected and increments normally
    await check_and_increment_quota(user_id=user_b_id, cost_class="high")


@pytest.mark.asyncio
async def test_quota_resets_by_date(enable_rate_limiting):
    """When the calendar date rolls over, user quota is completely refreshed."""
    user_id = "daily_user_789"

    # Exhaust user's quota on day 1
    with patch("app.core.rate_limit._get_reset_metadata") as mock_meta:
        mock_meta.return_value = ("2026-10-21", "2026-10-22T00:00:00Z", 3600)
        for _ in range(config.AI_HIGH_COST_DAILY_LIMIT):
            await check_and_increment_quota(user_id=user_id, cost_class="high")

        # 41st attempt on day 1 is blocked
        with pytest.raises(DailyQuotaExceeded):
            await check_and_increment_quota(user_id=user_id, cost_class="high")

    # Day 2: Date changes to 2026-10-22
    with patch("app.core.rate_limit._get_reset_metadata") as mock_meta:
        mock_meta.return_value = ("2026-10-22", "2026-10-23T00:00:00Z", 86400)
        # Call succeeds because quota resets for new date
        await check_and_increment_quota(user_id=user_id, cost_class="high")


@pytest.mark.asyncio
async def test_429_response_shape(enable_rate_limiting):
    """All 429 responses return the standard sanitized JSON shape: {"detail": ...}."""
    app.dependency_overrides.clear()

    # 1. Test slowapi 429 shape
    async with _make_client() as client:
        headers = {"X-Forwarded-For": "192.168.10.1"}
        for _ in range(5):
            await client.post(
                "/api/auth/login",
                json={"email": "shape@test.com", "password": "wrong"},
                headers=headers,
            )
        resp = await client.post(
            "/api/auth/login",
            json={"email": "shape@test.com", "password": "wrong"},
            headers=headers,
        )
        assert resp.status_code == 429
        data = resp.json()
        assert "detail" in data
        assert isinstance(data["detail"], str)
        assert "Retry-After" in resp.headers

    # 2. Test DailyQuotaExceeded exception response shape
    fake_user = {"_id": ObjectId(), "email": "quota_test@example.com"}
    app.dependency_overrides[get_current_user] = lambda: fake_user

    user_id = str(fake_user["_id"])
    for _ in range(config.AI_HIGH_COST_DAILY_LIMIT):
        await check_and_increment_quota(user_id=user_id, cost_class="high")

    async with _make_client() as client:
        resp = await client.post(
            "/api/roadmap/generate",
            json={"target_role": "Backend Engineer"},
            headers={"X-Forwarded-For": "192.168.10.2"},
        )
        assert resp.status_code == 429
        quota_data = resp.json()
        assert quota_data["detail"] == "Daily AI usage limit reached"
        assert "reset_at" in quota_data
        assert "Retry-After" in resp.headers


@pytest.mark.asyncio
async def test_health_endpoint_never_limited(enable_rate_limiting):
    """GET /api/health is an unthrottled probe and must never return 429."""
    app.dependency_overrides.clear()
    async with _make_client() as client:
        for _ in range(25):
            res = await client.get("/api/health")
            assert res.status_code == 200
            assert res.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_global_circuit_breaker(enable_rate_limiting):
    """Global circuit breaker trips when total LLM calls per minute exceed threshold."""
    with patch.object(config, "GLOBAL_LLM_CALLS_PER_MINUTE", 5):
        # 5 calls are permitted
        for _ in range(5):
            check_and_record_llm_call()

        # 6th call trips the breaker
        with pytest.raises(CircuitBreakerExceeded) as exc_info:
            check_and_record_llm_call()

        assert exc_info.value.status_code == 429
        assert "Global AI capacity reached" in exc_info.value.detail
        assert exc_info.value.retry_after == 60


@pytest.mark.asyncio
async def test_demo_user_receives_5x_limits(enable_rate_limiting):
    """Users listed in ALLOWED_DEMO_USERS receive a 5x multiplier on daily quotas."""
    demo_email = "demo@careerpilot.ai"
    with patch.object(config, "ALLOWED_DEMO_USERS", [demo_email]):
        user_id = "demo_user_uuid"
        # Standard limit is 40. Demo limit is 40 * 5 = 200.
        # User should easily exceed 40 without raising DailyQuotaExceeded.
        for _ in range(80):
            await check_and_increment_quota(
                user_id=user_id, cost_class="high", email=demo_email
            )


@pytest.mark.asyncio
async def test_rag_upload_document_caps(enable_rate_limiting):
    """Document upload is capped at 20 documents and 2 MB text."""
    app.dependency_overrides.clear()
    fake_user = {"_id": ObjectId(), "email": "uploader@test.com"}
    app.dependency_overrides[get_current_user] = lambda: fake_user

    async with _make_client() as client:
        # 1. Exceed single document size (2 MB)
        oversized_content = "X" * (2 * 1024 * 1024 + 10)
        res = await client.post(
            "/api/rag/documents/upload",
            json={"title": "Too Large", "content": oversized_content, "category": "general"},
        )
        assert res.status_code == 400
        assert "Document exceeds maximum allowable text size" in res.json()["detail"]

        # 2. Exceed 20 documents cap
        mock_docs = [
            AsyncMock(scope="user", user_id=str(fake_user["_id"]), content_length=100)
            for _ in range(20)
        ]
        with patch("app.services.rag_service.list_user_documents", new=AsyncMock(return_value=mock_docs)):
            res2 = await client.post(
                "/api/rag/documents/upload",
                json={"title": "21st Doc", "content": "Valid short text", "category": "general"},
            )
            assert res2.status_code == 400
            assert "Document upload cap reached" in res2.json()["detail"]
