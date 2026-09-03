"""CORS preflight and cross-origin regression tests.

Reproduces the production bug where ``OPTIONS /api/auth/login`` returned
HTTP 400 because the request origin was not in the configured allow list
(Starlette's CORSMiddleware rejects disallowed preflight origins with 400
"Disallowed CORS origin").

The app under test uses the default FRONTEND_ORIGIN (localhost dev ports),
so ``http://localhost:5173`` is allowed and any other origin is rejected.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

ALLOWED_ORIGIN = "http://localhost:5173"
DISALLOWED_ORIGIN = "https://evil.example.com"


def _preflight_headers(origin: str) -> dict:
    return {
        "Origin": origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization, content-type",
    }


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver")


class TestCorsPreflight:
    """Preflight (OPTIONS) behaviour for allowed and disallowed origins."""

    @pytest.mark.asyncio
    async def test_preflight_login_from_allowed_origin(self):
        async with _client() as client:
            resp = await client.options(
                "/api/auth/login", headers=_preflight_headers(ALLOWED_ORIGIN)
            )
        assert resp.status_code == 200
        assert resp.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
        assert "POST" in resp.headers["access-control-allow-methods"].upper()
        allow_headers = resp.headers["access-control-allow-headers"].lower()
        assert "authorization" in allow_headers
        assert "content-type" in allow_headers

    @pytest.mark.asyncio
    async def test_preflight_login_from_disallowed_origin_rejected(self):
        """Unknown origins must be rejected — never an open CORS policy."""
        async with _client() as client:
            resp = await client.options(
                "/api/auth/login", headers=_preflight_headers(DISALLOWED_ORIGIN)
            )
        assert resp.status_code == 400
        assert "access-control-allow-origin" not in resp.headers

    @pytest.mark.asyncio
    async def test_preflight_key_endpoints_from_allowed_origin(self):
        """Every browser-facing endpoint must preflight successfully."""
        paths = [
            "/api/auth/register",
            "/api/auth/login",
            "/api/auth/me",
            "/api/profile",
            "/api/resume/analyze",
            "/api/chat/message",
            "/api/interview/start",
            "/api/analyze-gap",
            "/api/roadmap/generate",
        ]
        async with _client() as client:
            for path in paths:
                resp = await client.options(
                    path, headers=_preflight_headers(ALLOWED_ORIGIN)
                )
                assert resp.status_code == 200, path
                assert (
                    resp.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
                ), path


class TestCorsSimpleRequests:
    """Non-preflight requests with an Origin header."""

    @pytest.mark.asyncio
    async def test_login_from_allowed_origin_reaches_auth_handler(self):
        """Cross-origin login must reach the auth logic (401 bad creds),
        not be rejected by CORS (400), and carry the allow-origin header."""
        async with _client() as client:
            resp = await client.post(
                "/api/auth/login",
                json={"email": "nobody@example.com", "password": "wrong"},
                headers={"Origin": ALLOWED_ORIGIN},
            )
        assert resp.status_code == 401
        assert resp.headers["access-control-allow-origin"] == ALLOWED_ORIGIN

    @pytest.mark.asyncio
    async def test_login_from_disallowed_origin_gets_no_cors_headers(self):
        async with _client() as client:
            resp = await client.post(
                "/api/auth/login",
                json={"email": "nobody@example.com", "password": "wrong"},
                headers={"Origin": DISALLOWED_ORIGIN},
            )
        assert resp.status_code == 401  # handler still runs
        assert "access-control-allow-origin" not in resp.headers


class TestOriginNormalization:
    """FRONTEND_ORIGIN parsing must tolerate common config mistakes."""

    def test_normalization(self):
        from app.config import _parse_origins

        assert _parse_origins(
            "http://localhost:5173, https://app.vercel.app/"
        ) == ["http://localhost:5173", "https://app.vercel.app"]

    def test_quotes_and_brackets_stripped(self):
        from app.config import _parse_origins

        assert _parse_origins(
            '[ "http://localhost:5173" , \'https://app.vercel.app/\' ]'
        ) == ["http://localhost:5173", "https://app.vercel.app"]

    def test_empty_entries_and_duplicates_removed(self):
        from app.config import _parse_origins

        assert _parse_origins(
            "http://localhost:5173,, ,HTTP://LOCALHOST:5173"
        ) == ["http://localhost:5173"]

    def test_wildcard_rejected(self):
        from app.config import _parse_origins

        assert _parse_origins("*") == []
        assert _parse_origins("http://localhost:5173,*") == ["http://localhost:5173"]
