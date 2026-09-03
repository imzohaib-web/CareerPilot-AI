"""Tests for the AI Career Mentor chat backend module.

Covers:
  - Pydantic schema validation (blank / oversized messages, id normalization)
  - qwen_service multi-turn history pass-through
  - Mentor context block construction (missing profile / resume handling)
  - History size limits (turn cap, character budget, malformed entries)
  - API route authentication + authorization
  - Successful mentor turn with mocked Qwen + MongoDB
  - Conversation persistence (create + append paths)
  - Conversation ownership / user isolation
  - AI provider failure handling (502)
  - Reply validation (empty / internal-context leak)
  - MongoDB failure handling
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from bson import ObjectId
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.schemas.chat import MAX_MESSAGE_CHARS, MentorChatRequest
from app.schemas.resume import ResumeAnalysis
from app.services.ai.qwen_service import AIServiceError
from app.services.dependencies import get_current_user

# ── Helpers ───────────────────────────────────────────────────────────────

FAKE_USER_ID = ObjectId()
FAKE_USER = {
    "_id": FAKE_USER_ID,
    "name": "Test User",
    "email": "test@example.com",
    "password_hash": "hash",
    "created_at": datetime.now(timezone.utc),
}

MENTOR_REPLY = (
    "Based on your goal, focus on TypeScript first — it is the highest-impact "
    "skill gap for your target role."
)


def _make_api_client(overrides: dict | None = None) -> AsyncClient:
    transport = ASGITransport(app=app)
    client = AsyncClient(transport=transport, base_url="http://testserver")
    if overrides:
        app.dependency_overrides.update(overrides)
    return client


def _override_user(user: dict | None = None) -> dict:
    return {get_current_user: lambda: user or FAKE_USER}


def _make_profile_doc(user_id: ObjectId | None = None, **overrides) -> dict:
    if user_id is None:
        user_id = FAKE_USER_ID
    doc = {
        "_id": ObjectId(),
        "user_id": user_id,
        "education": "BS Computer Science",
        "university": "FAST NUCES",
        "experience_level": "student",
        "target_role": "Full Stack Developer",
        "career_goal": "Become job-ready for junior developer roles.",
        "skills": ["React", "Python", "MongoDB"],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    doc.update(overrides)
    return doc


def _make_resume_doc(user_id: ObjectId | None = None, **overrides) -> dict:
    if user_id is None:
        user_id = FAKE_USER_ID
    doc = {
        "_id": ObjectId(),
        "user_id": user_id,
        "filename": "resume.pdf",
        "stored_path": "",
        "extracted_text": "John Doe\nSoftware Engineer",
        "analysis": {
            "score": 72,
            "summary": "A solid resume with clear projects.",
            "strengths": ["Clear project descriptions"],
            "weaknesses": ["No quantified achievements"],
            "missing_info": ["LinkedIn profile"],
            "improvements": ["Add measurable outcomes to projects"],
            "skills_detected": ["React", "Python", "MongoDB", "JavaScript"],
            "sections": {
                "education": [],
                "experience": [],
                "projects": [],
                "certifications": [],
            },
        },
        "model": "qwen-plus",
        "uploaded_at": datetime.now(timezone.utc),
        "analyzed_at": datetime.now(timezone.utc),
    }
    doc.update(overrides)
    return doc


def _make_conversation_doc(
    user_id: ObjectId | None = None, messages: list | None = None, **overrides
) -> dict:
    if user_id is None:
        user_id = FAKE_USER_ID
    now = datetime.now(timezone.utc)
    doc = {
        "_id": ObjectId(),
        "user_id": user_id,
        "messages": messages if messages is not None else [],
        "created_at": now,
        "updated_at": now,
    }
    doc.update(overrides)
    return doc


def _stored_message(role: str, content: str) -> dict:
    return {"role": role, "content": content, "ts": datetime.now(timezone.utc)}


def _mock_db(
    profile_doc=None,
    resume_doc=None,
    conversation_doc=None,
    conversation_insert_error=None,
    conversation_update_error=None,
    conversation_update_matched=1,
) -> MagicMock:
    """Build a mock database handle with configurable collection behaviours."""
    mock_db = MagicMock()

    mock_profiles = AsyncMock()
    mock_profiles.find_one = AsyncMock(return_value=profile_doc)
    mock_db.career_profiles = mock_profiles

    mock_resumes = AsyncMock()
    mock_resumes.find_one = AsyncMock(return_value=resume_doc)
    mock_db.resumes = mock_resumes

    mock_conversations = AsyncMock()
    mock_conversations.find_one = AsyncMock(return_value=conversation_doc)
    if conversation_insert_error is not None:
        mock_conversations.insert_one = AsyncMock(
            side_effect=conversation_insert_error
        )
    else:
        mock_conversations.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=ObjectId())
        )
    if conversation_update_error is not None:
        mock_conversations.update_one = AsyncMock(
            side_effect=conversation_update_error
        )
    else:
        mock_conversations.update_one = AsyncMock(
            return_value=MagicMock(matched_count=conversation_update_matched)
        )
    mock_db.conversations = mock_conversations

    return mock_db


def _qwen_mock(reply: str = MENTOR_REPLY, capture: dict | None = None):
    """Return an AsyncMock for career_mentor.qwen_chat that captures calls."""

    async def fake_qwen(user_message, **kwargs):
        if capture is not None:
            capture["user_message"] = user_message
            capture["kwargs"] = kwargs
        return reply, "qwen-plus"

    return AsyncMock(side_effect=fake_qwen)


def _fake_completion(content: str = "Hello", model: str = "qwen-plus") -> MagicMock:
    completion = MagicMock()
    completion.choices = [MagicMock()]
    completion.choices[0].message.content = content
    completion.model = model
    return completion


# ── Schema tests ──────────────────────────────────────────────────────────


class TestChatSchemas:
    """MentorChatRequest Pydantic validation."""

    def test_valid_payload(self):
        req = MentorChatRequest.model_validate({"message": "  What next?  "})
        assert req.message == "What next?"
        assert req.conversation_id is None

    def test_blank_message_rejected(self):
        with pytest.raises(Exception):
            MentorChatRequest.model_validate({"message": "   "})

    def test_empty_message_rejected(self):
        with pytest.raises(Exception):
            MentorChatRequest.model_validate({"message": ""})

    def test_missing_message_rejected(self):
        with pytest.raises(Exception):
            MentorChatRequest.model_validate({})

    def test_oversized_message_rejected(self):
        with pytest.raises(Exception):
            MentorChatRequest.model_validate({"message": "a" * (MAX_MESSAGE_CHARS + 1)})

    def test_conversation_id_normalized(self):
        req = MentorChatRequest.model_validate(
            {"message": "hi", "conversation_id": "  abc123  "}
        )
        assert req.conversation_id == "abc123"

    def test_blank_conversation_id_becomes_none(self):
        req = MentorChatRequest.model_validate(
            {"message": "hi", "conversation_id": "   "}
        )
        assert req.conversation_id is None


# ── qwen_service multi-turn pass-through ──────────────────────────────────


class TestQwenHistoryPassThrough:
    """qwen_service.chat must replay validated history turns to the provider."""

    @pytest.mark.asyncio
    async def test_history_replayed_between_system_and_user(self):
        from app.services.ai.qwen_service import chat as qwen_chat

        client = MagicMock()
        client.chat.completions.create = AsyncMock(
            return_value=_fake_completion("Hello!")
        )
        with patch("app.services.ai.qwen_service._get_client", return_value=client):
            reply, model = await qwen_chat(
                "hi",
                system_prompt="sys",
                history=[
                    {"role": "user", "content": "past question"},
                    {"role": "assistant", "content": "past answer"},
                ],
            )

        assert reply == "Hello!"
        assert model == "qwen-plus"
        sent = client.chat.completions.create.call_args.kwargs["messages"]
        assert [m["role"] for m in sent] == ["system", "user", "assistant", "user"]
        assert sent[-1]["content"] == "hi"

    @pytest.mark.asyncio
    async def test_malformed_history_entries_skipped(self):
        from app.services.ai.qwen_service import chat as qwen_chat

        client = MagicMock()
        client.chat.completions.create = AsyncMock(
            return_value=_fake_completion("ok")
        )
        history = [
            {"role": "system", "content": "not allowed"},
            {"role": "user", "content": "   "},
            {"role": "user", "content": "valid turn"},
            "garbage-entry",
            {"role": "assistant"},
        ]
        with patch("app.services.ai.qwen_service._get_client", return_value=client):
            await qwen_chat("hi", history=history)

        sent = client.chat.completions.create.call_args.kwargs["messages"]
        assert [m["role"] for m in sent] == ["user", "user"]
        assert sent[0]["content"] == "valid turn"

    @pytest.mark.asyncio
    async def test_no_system_prompt_no_history(self):
        from app.services.ai.qwen_service import chat as qwen_chat

        client = MagicMock()
        client.chat.completions.create = AsyncMock(
            return_value=_fake_completion("ok")
        )
        with patch("app.services.ai.qwen_service._get_client", return_value=client):
            await qwen_chat("hi")

        sent = client.chat.completions.create.call_args.kwargs["messages"]
        assert sent == [{"role": "user", "content": "hi"}]

    @pytest.mark.asyncio
    async def test_empty_provider_reply_raises(self):
        from app.services.ai.qwen_service import chat as qwen_chat

        client = MagicMock()
        client.chat.completions.create = AsyncMock(
            return_value=_fake_completion("   ")
        )
        with patch("app.services.ai.qwen_service._get_client", return_value=client):
            with pytest.raises(AIServiceError):
                await qwen_chat("hi")


# ── Mentor context block ──────────────────────────────────────────────────


class TestContextBlock:
    """career_mentor._build_context_block grounding and missing-data handling."""

    def _build(self, profile, resume):
        from app.services.ai.career_mentor import _build_context_block

        return _build_context_block(profile, resume)

    def test_full_context_includes_profile_and_resume(self):
        resume = ResumeAnalysis.model_validate(_make_resume_doc()["analysis"])
        block = self._build(_make_profile_doc(), resume)

        assert "Full Stack Developer" in block
        assert "Become job-ready" in block
        assert "React" in block
        assert "72/100" in block
        assert "Add measurable outcomes" in block
        # Sensitive fields must not be injected.
        assert "test@example.com" not in block
        assert "password" not in block.lower()

    def test_missing_profile_stated_explicitly(self):
        resume = ResumeAnalysis.model_validate(_make_resume_doc()["analysis"])
        block = self._build(None, resume)
        assert "Career profile: not set up yet" in block

    def test_missing_resume_stated_explicitly(self):
        block = self._build(_make_profile_doc(), None)
        assert "no resume analyzed yet" in block

    def test_both_missing(self):
        block = self._build(None, None)
        assert "not set up yet" in block
        assert "no resume analyzed yet" in block

    def test_empty_profile_fields_marked_not_provided(self):
        empty = _make_profile_doc(
            education="",
            university="",
            target_role="",
            career_goal="",
            skills=[],
        )
        block = self._build(empty, None)
        assert "not provided" in block
        assert "none listed" in block


# ── History size limits ───────────────────────────────────────────────────


class TestBuildModelHistory:
    """chat_service._build_model_history — bounded prompt context."""

    def _build(self, conversation_doc):
        from app.services.chat_service import _build_model_history

        return _build_model_history(conversation_doc)

    def test_none_conversation(self):
        assert self._build(None) == []

    def test_empty_messages(self):
        assert self._build(_make_conversation_doc(messages=[])) == []

    def test_turn_cap_keeps_most_recent(self):
        messages = [
            _stored_message("user" if i % 2 == 0 else "assistant", f"msg {i}")
            for i in range(30)
        ]
        history = self._build(_make_conversation_doc(messages=messages))

        from app.services.chat_service import _HISTORY_MAX_TURNS

        assert len(history) == _HISTORY_MAX_TURNS
        assert history[0]["content"] == f"msg {30 - _HISTORY_MAX_TURNS}"
        assert history[-1]["content"] == "msg 29"

    def test_character_budget_keeps_most_recent(self):
        messages = [
            _stored_message("user", "x" * 5_000) for i in range(10)
        ]
        history = self._build(_make_conversation_doc(messages=messages))

        # 24k budget / 5k per message → the 4 newest messages fit.
        assert len(history) == 4
        assert history[-1]["content"] == "x" * 5_000

    def test_first_message_always_included_even_if_huge(self):
        messages = [_stored_message("user", "y" * 30_000)]
        history = self._build(_make_conversation_doc(messages=messages))
        assert len(history) == 1

    def test_chronological_order_preserved(self):
        messages = [
            _stored_message("user", "first"),
            _stored_message("assistant", "second"),
            _stored_message("user", "third"),
        ]
        history = self._build(_make_conversation_doc(messages=messages))
        assert [m["content"] for m in history] == ["first", "second", "third"]

    def test_malformed_messages_skipped(self):
        messages = [
            {"role": "system", "content": "no"},
            {"role": "user", "content": None},
            "not-a-dict",
            {"role": "user", "content": "  "},
            _stored_message("user", "kept"),
        ]
        history = self._build(_make_conversation_doc(messages=messages))
        assert history == [{"role": "user", "content": "kept"}]


# ── API route tests ───────────────────────────────────────────────────────


class TestChatRoutes:
    """POST /api/chat/message and GET /api/chat/history."""

    @pytest.fixture(autouse=True)
    def _cleanup_overrides(self):
        yield
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_send_message_requires_auth(self):
        async with _make_api_client() as client:
            resp = await client.post(
                "/api/chat/message", json={"message": "Hello mentor"}
            )
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_history_requires_auth(self):
        async with _make_api_client() as client:
            resp = await client.get("/api/chat/history")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_empty_message_rejected(self):
        app.dependency_overrides.update(_override_user())
        async with _make_api_client() as client:
            resp = await client.post("/api/chat/message", json={"message": ""})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_whitespace_message_rejected(self):
        app.dependency_overrides.update(_override_user())
        async with _make_api_client() as client:
            resp = await client.post("/api/chat/message", json={"message": "   "})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_successful_first_message(self):
        """Happy path: no prior conversation → create one with both messages."""
        app.dependency_overrides.update(_override_user())

        captured_doc = {}
        mock_conversations = AsyncMock()
        mock_conversations.find_one = AsyncMock(return_value=None)

        async def fake_insert(doc):
            captured_doc.update(doc)
            return MagicMock(inserted_id=ObjectId())

        mock_conversations.insert_one = fake_insert
        mock_db = MagicMock()
        mock_db.career_profiles = AsyncMock()
        mock_db.career_profiles.find_one = AsyncMock(
            return_value=_make_profile_doc()
        )
        mock_db.resumes = AsyncMock()
        mock_db.resumes.find_one = AsyncMock(return_value=_make_resume_doc())
        mock_db.conversations = mock_conversations

        qwen_capture = {}
        with (
            patch("app.services.chat_service.get_db", return_value=mock_db),
            patch(
                "app.services.ai.career_mentor.qwen_chat",
                new=_qwen_mock(capture=qwen_capture),
            ),
        ):
            async with _make_api_client() as client:
                resp = await client.post(
                    "/api/chat/message", json={"message": "What should I focus on?"}
                )

        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["message"]["role"] == "assistant"
        assert body["message"]["content"] == MENTOR_REPLY
        assert body["message"]["created_at"] is not None
        assert body["model"] == "qwen-plus"
        assert body["conversation_id"]

        # Persisted document structure
        assert captured_doc["user_id"] == FAKE_USER_ID
        assert len(captured_doc["messages"]) == 2
        assert captured_doc["messages"][0]["role"] == "user"
        assert captured_doc["messages"][0]["content"] == "What should I focus on?"
        assert captured_doc["messages"][1]["role"] == "assistant"
        assert captured_doc["messages"][1]["content"] == MENTOR_REPLY
        assert "created_at" in captured_doc and "updated_at" in captured_doc

    @pytest.mark.asyncio
    async def test_user_context_injected_into_prompt(self):
        """The mentor prompt must contain real profile + resume data."""
        app.dependency_overrides.update(_override_user())
        mock = _mock_db(
            profile_doc=_make_profile_doc(),
            resume_doc=_make_resume_doc(),
            conversation_doc=None,
        )

        qwen_capture = {}
        with (
            patch("app.services.chat_service.get_db", return_value=mock),
            patch(
                "app.services.ai.career_mentor.qwen_chat",
                new=_qwen_mock(capture=qwen_capture),
            ),
        ):
            async with _make_api_client() as client:
                resp = await client.post(
                    "/api/chat/message", json={"message": "What should I focus on?"}
                )

        assert resp.status_code == 200
        system_prompt = qwen_capture["kwargs"]["system_prompt"]
        assert "Full Stack Developer" in system_prompt
        assert "React" in system_prompt
        assert "72/100" in system_prompt
        # The user's message is the final user turn, not baked into the prompt.
        assert qwen_capture["user_message"] == "What should I focus on?"
        assert qwen_capture["kwargs"]["history"] == []

    @pytest.mark.asyncio
    async def test_missing_profile_still_answers(self):
        """Missing career profile is not an error — mentor is told it's absent."""
        app.dependency_overrides.update(_override_user())
        mock = _mock_db(
            profile_doc=None, resume_doc=_make_resume_doc(), conversation_doc=None
        )

        qwen_capture = {}
        with (
            patch("app.services.chat_service.get_db", return_value=mock),
            patch(
                "app.services.ai.career_mentor.qwen_chat",
                new=_qwen_mock(capture=qwen_capture),
            ),
        ):
            async with _make_api_client() as client:
                resp = await client.post(
                    "/api/chat/message", json={"message": "Help me plan my career"}
                )

        assert resp.status_code == 200
        assert "Career profile: not set up yet" in qwen_capture["kwargs"]["system_prompt"]

    @pytest.mark.asyncio
    async def test_missing_resume_still_answers(self):
        """Missing resume analysis is not an error — mentor is told it's absent."""
        app.dependency_overrides.update(_override_user())
        mock = _mock_db(
            profile_doc=_make_profile_doc(), resume_doc=None, conversation_doc=None
        )

        qwen_capture = {}
        with (
            patch("app.services.chat_service.get_db", return_value=mock),
            patch(
                "app.services.ai.career_mentor.qwen_chat",
                new=_qwen_mock(capture=qwen_capture),
            ),
        ):
            async with _make_api_client() as client:
                resp = await client.post(
                    "/api/chat/message", json={"message": "What should I focus on?"}
                )

        assert resp.status_code == 200
        assert "no resume analyzed yet" in qwen_capture["kwargs"]["system_prompt"]

    @pytest.mark.asyncio
    async def test_corrupt_stored_resume_treated_as_absent(self):
        """A stored analysis that fails validation must not mislead the mentor."""
        app.dependency_overrides.update(_override_user())
        corrupt = _make_resume_doc(analysis={"score": "not_a_number", "junk": 42})
        mock = _mock_db(
            profile_doc=_make_profile_doc(), resume_doc=corrupt, conversation_doc=None
        )

        qwen_capture = {}
        with (
            patch("app.services.chat_service.get_db", return_value=mock),
            patch(
                "app.services.ai.career_mentor.qwen_chat",
                new=_qwen_mock(capture=qwen_capture),
            ),
        ):
            async with _make_api_client() as client:
                resp = await client.post(
                    "/api/chat/message", json={"message": "What should I focus on?"}
                )

        assert resp.status_code == 200
        assert "no resume analyzed yet" in qwen_capture["kwargs"]["system_prompt"]

    @pytest.mark.asyncio
    async def test_qwen_failure_returns_502(self):
        app.dependency_overrides.update(_override_user())
        mock = _mock_db(
            profile_doc=_make_profile_doc(),
            resume_doc=_make_resume_doc(),
            conversation_doc=None,
        )

        with (
            patch("app.services.chat_service.get_db", return_value=mock),
            patch(
                "app.services.ai.career_mentor.qwen_chat",
                new_callable=AsyncMock,
                side_effect=AIServiceError("AI provider request failed"),
            ),
        ):
            async with _make_api_client() as client:
                resp = await client.post(
                    "/api/chat/message", json={"message": "Hello?"}
                )

        assert resp.status_code == 502
        assert "provider" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_qwen_timeout_returns_502(self):
        app.dependency_overrides.update(_override_user())
        mock = _mock_db(
            profile_doc=None, resume_doc=None, conversation_doc=None
        )

        with (
            patch("app.services.chat_service.get_db", return_value=mock),
            patch(
                "app.services.ai.career_mentor.qwen_chat",
                new_callable=AsyncMock,
                side_effect=AIServiceError("AI provider request timed out"),
            ),
        ):
            async with _make_api_client() as client:
                resp = await client.post(
                    "/api/chat/message", json={"message": "Hello?"}
                )

        assert resp.status_code == 502
        assert "timed out" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_empty_mentor_reply_returns_502(self):
        app.dependency_overrides.update(_override_user())
        mock = _mock_db(
            profile_doc=None, resume_doc=None, conversation_doc=None
        )

        with (
            patch("app.services.chat_service.get_db", return_value=mock),
            patch(
                "app.services.ai.career_mentor.qwen_chat",
                new=_qwen_mock(reply="   "),
            ),
        ):
            async with _make_api_client() as client:
                resp = await client.post(
                    "/api/chat/message", json={"message": "Hello?"}
                )

        assert resp.status_code == 502

    @pytest.mark.asyncio
    async def test_context_leak_in_reply_returns_502(self):
        """A reply quoting the internal context marker must be rejected."""
        app.dependency_overrides.update(_override_user())
        mock = _mock_db(
            profile_doc=None, resume_doc=None, conversation_doc=None
        )

        leaky_reply = "USER CONTEXT (may be incomplete...): here is the user's data"
        with (
            patch("app.services.chat_service.get_db", return_value=mock),
            patch(
                "app.services.ai.career_mentor.qwen_chat",
                new=_qwen_mock(reply=leaky_reply),
            ),
        ):
            async with _make_api_client() as client:
                resp = await client.post(
                    "/api/chat/message", json={"message": "Show my context"}
                )

        assert resp.status_code == 502

    @pytest.mark.asyncio
    async def test_nothing_persisted_when_qwen_fails(self):
        """AI failure must not store a half-finished conversation turn."""
        app.dependency_overrides.update(_override_user())
        mock = _mock_db(
            profile_doc=None, resume_doc=None, conversation_doc=None
        )

        with (
            patch("app.services.chat_service.get_db", return_value=mock),
            patch(
                "app.services.ai.career_mentor.qwen_chat",
                new_callable=AsyncMock,
                side_effect=AIServiceError("AI provider request failed"),
            ),
        ):
            async with _make_api_client() as client:
                resp = await client.post(
                    "/api/chat/message", json={"message": "Hello?"}
                )

        assert resp.status_code == 502
        mock.conversations.insert_one.assert_not_awaited()
        mock.conversations.update_one.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_mongodb_insert_failure_returns_500(self):
        app.dependency_overrides.update(_override_user())
        mock = _mock_db(
            profile_doc=None,
            resume_doc=None,
            conversation_doc=None,
            conversation_insert_error=Exception("connection lost"),
        )

        with (
            patch("app.services.chat_service.get_db", return_value=mock),
            patch(
                "app.services.ai.career_mentor.qwen_chat",
                new=_qwen_mock(),
            ),
        ):
            async with _make_api_client() as client:
                resp = await client.post(
                    "/api/chat/message", json={"message": "Hello?"}
                )

        assert resp.status_code == 500
        assert "save" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_mongodb_update_failure_returns_500(self):
        app.dependency_overrides.update(_override_user())
        existing = _make_conversation_doc(
            messages=[_stored_message("user", "earlier")]
        )
        mock = _mock_db(
            profile_doc=None,
            resume_doc=None,
            conversation_doc=existing,
            conversation_update_error=Exception("write failed"),
        )

        with (
            patch("app.services.chat_service.get_db", return_value=mock),
            patch(
                "app.services.ai.career_mentor.qwen_chat",
                new=_qwen_mock(),
            ),
        ):
            async with _make_api_client() as client:
                resp = await client.post(
                    "/api/chat/message",
                    json={"message": "Hello?", "conversation_id": str(existing["_id"])},
                )

        assert resp.status_code == 500

    @pytest.mark.asyncio
    async def test_malformed_conversation_id_returns_400(self):
        app.dependency_overrides.update(_override_user())
        mock = _mock_db(
            profile_doc=None, resume_doc=None, conversation_doc=None
        )

        with (
            patch("app.services.chat_service.get_db", return_value=mock),
            patch(
                "app.services.ai.career_mentor.qwen_chat",
                new=_qwen_mock(),
            ),
        ):
            async with _make_api_client() as client:
                resp = await client.post(
                    "/api/chat/message",
                    json={"message": "Hello?", "conversation_id": "not-an-objectid"},
                )

        assert resp.status_code == 400


# ── Conversation continuity + ownership ───────────────────────────────────


class TestConversationContinuity:
    """Multiple messages in the same conversation."""

    @pytest.fixture(autouse=True)
    def _cleanup_overrides(self):
        yield
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_second_message_appends_and_replays_history(self):
        """A follow-up turn must $push both messages and replay prior turns."""
        app.dependency_overrides.update(_override_user())

        existing = _make_conversation_doc(
            messages=[
                _stored_message("user", "What should I focus on?"),
                _stored_message("assistant", MENTOR_REPLY),
            ]
        )
        mock = _mock_db(
            profile_doc=_make_profile_doc(),
            resume_doc=_make_resume_doc(),
            conversation_doc=existing,
        )

        qwen_capture = {}
        with (
            patch("app.services.chat_service.get_db", return_value=mock),
            patch(
                "app.services.ai.career_mentor.qwen_chat",
                new=_qwen_mock(capture=qwen_capture),
            ),
        ):
            async with _make_api_client() as client:
                resp = await client.post(
                    "/api/chat/message",
                    json={
                        "message": "How do I start with that?",
                        "conversation_id": str(existing["_id"]),
                    },
                )

        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["conversation_id"] == str(existing["_id"])

        # History replayed to the model in chronological order
        history = qwen_capture["kwargs"]["history"]
        assert [m["content"] for m in history] == [
            "What should I focus on?",
            MENTOR_REPLY,
        ]

        # Both new messages appended atomically with a bounded document.
        mock.conversations.update_one.assert_awaited_once()
        call = mock.conversations.update_one.call_args
        query = call.args[0]
        assert query == {"_id": existing["_id"]}
        update = call.args[1]
        pushed = update["$push"]["messages"]
        assert [m["role"] for m in pushed["$each"]] == ["user", "assistant"]
        assert pushed["$each"][0]["content"] == "How do I start with that?"
        assert pushed["$each"][1]["content"] == MENTOR_REPLY
        assert pushed["$slice"] == -100
        assert "updated_at" in update["$set"]

    @pytest.mark.asyncio
    async def test_latest_conversation_used_when_id_omitted(self):
        """Without a conversation_id the user's most recent conversation is used."""
        app.dependency_overrides.update(_override_user())

        captured_query = {}

        async def fake_find(query, sort=None):
            captured_query.update(query)
            captured_query["sort"] = sort
            return _make_conversation_doc(
                messages=[_stored_message("user", "earlier")]
            )

        mock = MagicMock()
        mock.career_profiles = AsyncMock()
        mock.career_profiles.find_one = AsyncMock(return_value=None)
        mock.resumes = AsyncMock()
        mock.resumes.find_one = AsyncMock(return_value=None)
        mock.conversations = AsyncMock()
        mock.conversations.find_one = fake_find
        mock.conversations.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )

        with (
            patch("app.services.chat_service.get_db", return_value=mock),
            patch(
                "app.services.ai.career_mentor.qwen_chat",
                new=_qwen_mock(),
            ),
        ):
            async with _make_api_client() as client:
                resp = await client.post(
                    "/api/chat/message", json={"message": "Follow-up"}
                )

        assert resp.status_code == 200
        assert captured_query["user_id"] == FAKE_USER_ID
        assert captured_query["sort"] == [("updated_at", -1)]
        mock.conversations.update_one.assert_awaited_once()


class TestConversationOwnership:
    """A user must never access another user's conversation."""

    @pytest.fixture(autouse=True)
    def _cleanup_overrides(self):
        yield
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_foreign_conversation_id_returns_404(self):
        """A valid ObjectId owned by someone else must 404, not leak data."""
        app.dependency_overrides.update(_override_user())

        foreign_id = str(ObjectId())
        captured_query = {}

        async def fake_find(query):
            captured_query.update(query)
            return None  # scoped by user_id → foreign conversation "not found"

        mock = MagicMock()
        mock.career_profiles = AsyncMock()
        mock.career_profiles.find_one = AsyncMock(return_value=None)
        mock.resumes = AsyncMock()
        mock.resumes.find_one = AsyncMock(return_value=None)
        mock.conversations = AsyncMock()
        mock.conversations.find_one = fake_find

        with patch("app.services.chat_service.get_db", return_value=mock):
            async with _make_api_client() as client:
                resp = await client.post(
                    "/api/chat/message",
                    json={"message": "Hello?", "conversation_id": foreign_id},
                )

        assert resp.status_code == 404
        assert captured_query["_id"] == ObjectId(foreign_id)
        assert captured_query["user_id"] == FAKE_USER_ID

    @pytest.mark.asyncio
    async def test_conversation_lookup_scoped_by_jwt_user(self):
        """Every conversation query includes the authenticated user's id."""
        app.dependency_overrides.update(_override_user())

        existing = _make_conversation_doc(
            messages=[_stored_message("user", "earlier")]
        )
        mock = _mock_db(
            profile_doc=None, resume_doc=None, conversation_doc=existing
        )

        with (
            patch("app.services.chat_service.get_db", return_value=mock),
            patch(
                "app.services.ai.career_mentor.qwen_chat",
                new=_qwen_mock(),
            ),
        ):
            async with _make_api_client() as client:
                resp = await client.post(
                    "/api/chat/message",
                    json={
                        "message": "Hello?",
                        "conversation_id": str(existing["_id"]),
                    },
                )

        assert resp.status_code == 200
        query = mock.conversations.find_one.call_args.args[0]
        assert query["user_id"] == FAKE_USER_ID
        assert query["_id"] == existing["_id"]

    @pytest.mark.asyncio
    async def test_inserted_conversation_owned_by_jwt_user(self):
        app.dependency_overrides.update(_override_user())

        captured_doc = {}
        mock_conversations = AsyncMock()
        mock_conversations.find_one = AsyncMock(return_value=None)

        async def fake_insert(doc):
            captured_doc.update(doc)
            return MagicMock(inserted_id=ObjectId())

        mock_conversations.insert_one = fake_insert
        mock = MagicMock()
        mock.career_profiles = AsyncMock()
        mock.career_profiles.find_one = AsyncMock(return_value=None)
        mock.resumes = AsyncMock()
        mock.resumes.find_one = AsyncMock(return_value=None)
        mock.conversations = mock_conversations

        with (
            patch("app.services.chat_service.get_db", return_value=mock),
            patch(
                "app.services.ai.career_mentor.qwen_chat",
                new=_qwen_mock(),
            ),
        ):
            async with _make_api_client() as client:
                resp = await client.post(
                    "/api/chat/message", json={"message": "Hello?"}
                )

        assert resp.status_code == 200
        assert captured_doc["user_id"] == FAKE_USER_ID


# ── History endpoint ──────────────────────────────────────────────────────


class TestHistoryEndpoint:
    """GET /api/chat/history."""

    @pytest.fixture(autouse=True)
    def _cleanup_overrides(self):
        yield
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_empty_history_when_no_conversation(self):
        app.dependency_overrides.update(_override_user())
        mock = _mock_db(conversation_doc=None)

        with patch("app.services.chat_service.get_db", return_value=mock):
            async with _make_api_client() as client:
                resp = await client.get("/api/chat/history")

        assert resp.status_code == 200
        body = resp.json()
        assert body["conversation_id"] is None
        assert body["messages"] == []

    @pytest.mark.asyncio
    async def test_history_returns_stored_messages(self):
        app.dependency_overrides.update(_override_user())
        now = datetime.now(timezone.utc)
        existing = _make_conversation_doc(
            messages=[
                {"role": "user", "content": "first question", "ts": now},
                {"role": "assistant", "content": "first answer", "ts": now},
            ]
        )
        mock = _mock_db(conversation_doc=existing)

        with patch("app.services.chat_service.get_db", return_value=mock):
            async with _make_api_client() as client:
                resp = await client.get("/api/chat/history")

        assert resp.status_code == 200
        body = resp.json()
        assert body["conversation_id"] == str(existing["_id"])
        assert [m["role"] for m in body["messages"]] == ["user", "assistant"]
        assert body["messages"][0]["content"] == "first question"
        assert body["messages"][0]["created_at"] is not None
        assert body["created_at"] is not None
        assert body["updated_at"] is not None

    @pytest.mark.asyncio
    async def test_history_skips_malformed_stored_messages(self):
        app.dependency_overrides.update(_override_user())
        existing = _make_conversation_doc(
            messages=[
                {"role": "system", "content": "bad"},
                {"role": "user", "content": "ok", "ts": datetime.now(timezone.utc)},
                {"role": "assistant", "content": "missing ts"},
            ]
        )
        mock = _mock_db(conversation_doc=existing)

        with patch("app.services.chat_service.get_db", return_value=mock):
            async with _make_api_client() as client:
                resp = await client.get("/api/chat/history")

        assert resp.status_code == 200
        assert len(resp.json()["messages"]) == 1

    @pytest.mark.asyncio
    async def test_history_foreign_conversation_404(self):
        app.dependency_overrides.update(_override_user())
        mock = _mock_db(conversation_doc=None)

        with patch("app.services.chat_service.get_db", return_value=mock):
            async with _make_api_client() as client:
                resp = await client.get(
                    "/api/chat/history",
                    params={"conversation_id": str(ObjectId())},
                )

        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_history_malformed_conversation_id_400(self):
        app.dependency_overrides.update(_override_user())
        mock = _mock_db(conversation_doc=None)

        with patch("app.services.chat_service.get_db", return_value=mock):
            async with _make_api_client() as client:
                resp = await client.get(
                    "/api/chat/history", params={"conversation_id": "zzz"}
                )

        assert resp.status_code == 400


# ── Service-level error propagation ───────────────────────────────────────


class TestChatServiceErrors:
    """Unexpected MongoDB read failures propagate (global handler → 500).

    httpx's ASGI transport re-raises unhandled server exceptions before
    FastAPI's global handler can produce a response, so these are verified
    at the service layer (same approach as test_progress.py).
    """

    @pytest.mark.asyncio
    async def test_conversation_read_failure_propagates(self):
        from app.services import chat_service

        mock = _mock_db(conversation_doc=None)
        mock.conversations.find_one = AsyncMock(
            side_effect=Exception("MongoDB connection lost")
        )

        with (
            patch("app.services.chat_service.get_db", return_value=mock),
            patch(
                "app.services.ai.career_mentor.qwen_chat",
                new=_qwen_mock(),
            ),
        ):
            with pytest.raises(Exception, match="MongoDB connection lost"):
                await chat_service.send_message(str(FAKE_USER_ID), "Hello?", None)

    @pytest.mark.asyncio
    async def test_update_matched_zero_raises_not_found(self):
        """A conversation deleted mid-request surfaces as ConversationNotFound."""
        from app.services import chat_service

        existing = _make_conversation_doc(
            messages=[_stored_message("user", "earlier")]
        )
        mock = _mock_db(
            conversation_doc=existing, conversation_update_matched=0
        )

        with (
            patch("app.services.chat_service.get_db", return_value=mock),
            patch(
                "app.services.ai.career_mentor.qwen_chat",
                new=_qwen_mock(),
            ),
        ):
            with pytest.raises(chat_service.ConversationNotFoundError):
                await chat_service.send_message(
                    str(FAKE_USER_ID), "Hello?", str(existing["_id"])
                )
