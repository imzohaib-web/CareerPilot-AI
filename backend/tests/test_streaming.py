"""Tests for SSE token streaming in Career Mentor (/api/chat/message/stream)
and RAG Advisor (/api/rag/chat/stream).

Covers:
  - SSE event protocol order: start -> (sources) -> delta* -> done
  - Atomic persistence only after success (never on error or disconnect)
  - Refusal path on no_context never invokes the LLM
  - In-text citation validation in the terminal done event
  - Rolling buffer detection for forbidden markers split across deltas
  - Idle timeout enforcement
  - STREAMING_ENABLED=false returning 501
  - Auth enforcement (401 without token)
  - Stream response headers (no-cache, no-transform, keep-alive, no-buffering)
"""

import asyncio
from datetime import datetime, timezone
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from bson import ObjectId
from httpx import ASGITransport, AsyncClient

from app import config
from app.main import app
from app.schemas.rag import ChunkSource
from app.services.rag_service import ChunkSourceList
from app.services.ai import qwen_service
from app.services.ai.qwen_service import AIConfigurationError, AIServiceError
from app.services.dependencies import get_current_user

FAKE_USER_ID = ObjectId()
FAKE_USER = {
    "_id": FAKE_USER_ID,
    "name": "Stream Test User",
    "email": "stream@example.com",
    "password_hash": "hash",
    "created_at": datetime.now(timezone.utc),
}


class MockStream:
    """Mock async generator representing AsyncOpenAI streaming response."""

    def __init__(self, chunks: list[str], delay: float = 0.0):
        self.chunks = chunks
        self.delay = delay
        self.index = 0
        self.closed = False

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self.delay > 0:
            await asyncio.sleep(self.delay)
        if self.index >= len(self.chunks):
            raise StopAsyncIteration
        text = self.chunks[self.index]
        self.index += 1
        return SimpleNamespace(
            choices=[SimpleNamespace(delta=SimpleNamespace(content=text))]
        )

    async def aclose(self):
        self.closed = True

    def close(self):
        self.closed = True


def _make_api_client(overrides: dict | None = None) -> AsyncClient:
    transport = ASGITransport(app=app)
    client = AsyncClient(transport=transport, base_url="http://testserver")
    if overrides:
        app.dependency_overrides.update(overrides)
    return client


def _override_user(user: dict | None = None) -> dict:
    return {get_current_user: lambda: user or FAKE_USER}


def parse_sse_events(raw_body: str) -> list[dict]:
    events = []
    for line in raw_body.splitlines():
        line = line.strip()
        if line.startswith("data:"):
            payload = line[5:].strip()
            if payload:
                events.append(json.loads(payload))
    return events


@pytest.fixture(autouse=True)
def _cleanup_overrides():
    yield
    app.dependency_overrides.clear()


# ── AI Career Mentor Streaming ─────────────────────────────────────────────


class TestCareerMentorStreaming:
    @pytest.mark.asyncio
    async def test_mentor_stream_event_order_and_success(self):
        """Mentor streaming yields start -> delta* -> done with full payload."""
        mock_stream = MockStream(["Focus on ", "building a ", "portfolio project."])
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_stream)

        mock_db = MagicMock()
        mock_db.conversations.find_one = AsyncMock(return_value=None)
        mock_db.conversations.insert_one = AsyncMock(
            return_value=SimpleNamespace(inserted_id=ObjectId())
        )
        mock_db.career_profiles.find_one = AsyncMock(return_value=None)
        mock_db.resumes.find_one = AsyncMock(return_value=None)

        client = _make_api_client(_override_user())
        with (
            patch.object(qwen_service, "_get_client", return_value=mock_client),
            patch("app.database.mongodb.get_db", return_value=mock_db),
            patch("app.services.chat_service.get_db", return_value=mock_db),
            patch("app.services.rag_service.retrieve_for_mentor", new_callable=AsyncMock, return_value=[]),
        ):
            resp = await client.post(
                "/api/chat/message/stream",
                json={"message": "What should I do first?", "conversation_id": None},
            )

            assert resp.status_code == 200
            assert resp.headers["content-type"].startswith("text/event-stream")
            assert resp.headers["cache-control"] == "no-cache, no-transform"
            assert resp.headers["connection"] == "keep-alive"
            assert resp.headers["x-accel-buffering"] == "no"

            events = parse_sse_events(resp.text)
            assert len(events) >= 3
            assert events[0]["type"] == "start"
            assert "conversation_id" in events[0]

            deltas = [e["text"] for e in events if e["type"] == "delta"]
            full_text = "".join(deltas)
            assert full_text == "Focus on building a portfolio project."

            done = events[-1]
            assert done["type"] == "done"
            assert done["message"]["content"] == "Focus on building a portfolio project."
            assert done["message"]["role"] == "assistant"

            # Verify atomic persistence occurred
            assert mock_db.conversations.insert_one.called

    @pytest.mark.asyncio
    async def test_mentor_stream_no_persistence_on_error(self):
        """If LLM stream fails, an error event is sent and nothing is persisted."""
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(
            side_effect=AIServiceError("Provider failure")
        )

        mock_db = MagicMock()
        mock_db.conversations.find_one = AsyncMock(return_value=None)
        mock_db.conversations.insert_one = AsyncMock()
        mock_db.conversations.update_one = AsyncMock()
        mock_db.career_profiles.find_one = AsyncMock(return_value=None)
        mock_db.resumes.find_one = AsyncMock(return_value=None)

        client = _make_api_client(_override_user())
        with (
            patch.object(qwen_service, "_get_client", return_value=mock_client),
            patch("app.database.mongodb.get_db", return_value=mock_db),
            patch("app.services.chat_service.get_db", return_value=mock_db),
            patch("app.services.rag_service.retrieve_for_mentor", new_callable=AsyncMock, return_value=[]),
        ):
            resp = await client.post(
                "/api/chat/message/stream",
                json={"message": "Help me", "conversation_id": None},
            )

            assert resp.status_code == 200
            events = parse_sse_events(resp.text)
            assert events[0]["type"] == "start"
            assert events[-1]["type"] == "error"
            assert "Provider failure" in events[-1]["message"]

            # Must NOT persist any conversation turn on error
            assert not mock_db.conversations.insert_one.called
            assert not mock_db.conversations.update_one.called

    @pytest.mark.asyncio
    async def test_mentor_stream_leak_marker_split_across_deltas(self):
        """Rolling buffer detects forbidden marker 'USER CONTEXT' split across deltas."""
        mock_stream = MockStream(["Here is your USER ", "CONTEXT: sensitive internal data"])
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_stream)

        mock_db = MagicMock()
        mock_db.conversations.find_one = AsyncMock(return_value=None)
        mock_db.conversations.insert_one = AsyncMock()
        mock_db.conversations.update_one = AsyncMock()
        mock_db.career_profiles.find_one = AsyncMock(return_value=None)
        mock_db.resumes.find_one = AsyncMock(return_value=None)

        client = _make_api_client(_override_user())
        with (
            patch.object(qwen_service, "_get_client", return_value=mock_client),
            patch("app.database.mongodb.get_db", return_value=mock_db),
            patch("app.services.chat_service.get_db", return_value=mock_db),
            patch("app.services.rag_service.retrieve_for_mentor", new_callable=AsyncMock, return_value=[]),
        ):
            resp = await client.post(
                "/api/chat/message/stream",
                json={"message": "Show context", "conversation_id": None},
            )

            events = parse_sse_events(resp.text)
            # The terminal event must be an error
            assert events[-1]["type"] == "error"
            # The forbidden marker itself was never emitted to deltas
            for e in events:
                if e["type"] == "delta":
                    assert "USER CONTEXT" not in e["text"]

            # Must NOT persist
            assert not mock_db.conversations.insert_one.called
            assert not mock_db.conversations.update_one.called

    @pytest.mark.asyncio
    async def test_mentor_stream_idle_timeout(self):
        """Idle timeout raises an error when chunks stall."""
        # Chunk 1 arrives immediately, chunk 2 stalls for 0.2s while idle_timeout is 0.05s
        mock_stream = MockStream(["First token", "Delayed token"], delay=0.15)
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_stream)

        with (
            patch.object(qwen_service, "_get_client", return_value=mock_client),
            patch.object(config, "STREAMING_IDLE_TIMEOUT", 0.05),
        ):
            messages = [{"role": "user", "content": "hi"}]
            gen = qwen_service.stream_chat_completion(
                messages, idle_timeout=0.05
            )
            with pytest.raises(AIServiceError, match="idle timeout"):
                async for _ in gen:
                    pass

    @pytest.mark.asyncio
    async def test_mentor_stream_disabled_returns_501(self):
        """When STREAMING_ENABLED is False, route returns 501."""
        client = _make_api_client(_override_user())
        with patch.object(config, "STREAMING_ENABLED", False):
            resp = await client.post(
                "/api/chat/message/stream",
                json={"message": "hi", "conversation_id": None},
            )
            assert resp.status_code == 501
            assert "disabled" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_mentor_stream_requires_auth(self):
        """Unauthenticated request returns 401."""
        client = _make_api_client()
        resp = await client.post(
            "/api/chat/message/stream",
            json={"message": "hi", "conversation_id": None},
        )
        assert resp.status_code == 401


# ── Grounded RAG Advisor Streaming ─────────────────────────────────────────


class TestRAGAdvisorStreaming:
    @pytest.mark.asyncio
    async def test_rag_stream_no_context_never_calls_llm(self):
        """When retrieval has no context, refusal delta and done are sent with 0 LLM calls."""
        client = _make_api_client(_override_user())
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock()

        with (
            patch.object(qwen_service, "_get_client", return_value=mock_client),
            patch("app.services.rag_service.retrieve_context", new_callable=AsyncMock) as mock_retrieval,
        ):
            # Return empty or no_context status
            res = ChunkSourceList([], status="no_context")
            mock_retrieval.return_value = res

            resp = await client.post(
                "/api/rag/chat/stream",
                json={"message": "Unrelated question", "top_k": 3},
            )

            assert resp.status_code == 200
            events = parse_sse_events(resp.text)

            assert events[0]["type"] == "start"
            deltas = [e["text"] for e in events if e["type"] == "delta"]
            assert len(deltas) == 1
            assert "could not find any relevant information" in deltas[0]

            done = events[-1]
            assert done["type"] == "done"
            assert done["retrieval_status"] == "no_context"
            assert done["citations"] == []

            # LLM was NEVER called
            assert not mock_client.chat.completions.create.called

    @pytest.mark.asyncio
    async def test_rag_stream_sources_event_and_citations_validated(self):
        """RAG stream emits early 'sources' event and validates citations on done."""
        fake_chunks = ChunkSourceList(
            [
                ChunkSource(
                    chunk_id="chk1",
                    document_id="doc1",
                    document_title="FastAPI Guide",
                    section_title="Routing",
                    heading_path="Overview > Routing",
                    chunk_index=0,
                    content="FastAPI uses APIRouter for modular routing.",
                    similarity_score=0.88,
                    category="technical",
                    scope="global",
                )
            ],
            status="grounded",
        )

        # Model generates a valid [1] citation and an invalid [99] citation
        mock_stream = MockStream([
            "According to the guide [1], ",
            "APIRouter is used. ",
            "Also see [99].",
        ])
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_stream)

        client = _make_api_client(_override_user())
        with (
            patch.object(qwen_service, "_get_client", return_value=mock_client),
            patch("app.services.rag_service.retrieve_context", new_callable=AsyncMock, return_value=fake_chunks),
        ):
            resp = await client.post(
                "/api/rag/chat/stream",
                json={"message": "How does routing work in FastAPI?", "top_k": 3},
            )

            assert resp.status_code == 200
            events = parse_sse_events(resp.text)

            # Event 0: start
            assert events[0]["type"] == "start"
            # Event 1: early sources event
            assert events[1]["type"] == "sources"
            assert len(events[1]["sources"]) == 1
            assert events[1]["sources"][0]["document_title"] == "FastAPI Guide"

            # Terminal event: done with post-validated citations
            done = events[-1]
            assert done["type"] == "done"
            # [1] is valid, [99] was stripped
            assert len(done["citations"]) == 1
            assert done["citations"][0]["id"] == 1
            assert done["citations"][0]["document_title"] == "FastAPI Guide"
            assert "[99]" not in done["answer"]

    @pytest.mark.asyncio
    async def test_rag_stream_disabled_returns_501(self):
        """When STREAMING_ENABLED is False, RAG stream route returns 501."""
        client = _make_api_client(_override_user())
        with patch.object(config, "STREAMING_ENABLED", False):
            resp = await client.post(
                "/api/rag/chat/stream",
                json={"message": "hi"},
            )
            assert resp.status_code == 501

    @pytest.mark.asyncio
    async def test_rag_stream_requires_auth(self):
        """Unauthenticated RAG stream request returns 401."""
        client = _make_api_client()
        resp = await client.post(
            "/api/rag/chat/stream",
            json={"message": "hi"},
        )
        assert resp.status_code == 401
