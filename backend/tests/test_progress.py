"""Tests for the progress dashboard endpoint.

Covers:
  - Authentication required (401)
  - User with full data (profile + resume)
  - User with profile only (no resume)
  - User with resume only (no profile)
  - User with no data at all
  - Profile completeness calculation
  - Overall progress weighting
  - Next-step generation
  - User isolation (JWT user ID, not client-provided)
  - MongoDB failure handling
"""

import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from bson import ObjectId
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services import progress_service
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


def _make_api_client(overrides: dict | None = None) -> AsyncClient:
    transport = ASGITransport(app=app)
    client = AsyncClient(transport=transport, base_url="http://testserver")
    if overrides:
        app.dependency_overrides.update(overrides)
    return client


def _override_user(user: dict | None = None) -> dict:
    if user is None:
        user = FAKE_USER
    return {get_current_user: lambda: user}


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
            "summary": "A solid resume.",
            "strengths": ["Clear projects", "Relevant skills"],
            "weaknesses": ["No quantified achievements"],
            "missing_info": ["LinkedIn profile"],
            "improvements": [
                "Add measurable outcomes",
                "Include a professional summary",
            ],
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


def _mock_db(
    profile_doc=None,
    resume_doc=None,
    resume_count=0,
    profile_side_effect=None,
    resume_side_effect=None,
    count_side_effect=None,
) -> MagicMock:
    """Build a mock database handle with configurable collection behaviours."""
    mock_db = MagicMock()

    # career_profiles collection
    mock_profiles = AsyncMock()
    if profile_side_effect:
        mock_profiles.find_one = AsyncMock(side_effect=profile_side_effect)
    else:
        mock_profiles.find_one = AsyncMock(return_value=profile_doc)
    mock_db.career_profiles = mock_profiles

    # resumes collection
    mock_resumes = AsyncMock()
    if resume_side_effect:
        mock_resumes.find_one = AsyncMock(side_effect=resume_side_effect)
    else:
        mock_resumes.find_one = AsyncMock(return_value=resume_doc)

    if count_side_effect:
        mock_resumes.count_documents = AsyncMock(side_effect=count_side_effect)
    else:
        mock_resumes.count_documents = AsyncMock(return_value=resume_count)

    mock_db.resumes = mock_resumes
    return mock_db


# ── Authentication tests ─────────────────────────────────────────────────


class TestProgressAuth:
    """Unauthenticated requests must be rejected."""

    @pytest.fixture(autouse=True)
    def _cleanup(self):
        yield
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_unauthenticated_request(self):
        async with _make_api_client() as client:
            resp = await client.get("/api/progress")
        assert resp.status_code in (401, 403)


# ── Dashboard with full data ─────────────────────────────────────────────


class TestProgressFullData:
    """User with both profile and resume analysis."""

    @pytest.fixture(autouse=True)
    def _cleanup(self):
        yield
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_full_data_dashboard(self):
        app.dependency_overrides.update(_override_user())
        mock = _mock_db(
            profile_doc=_make_profile_doc(),
            resume_doc=_make_resume_doc(),
            resume_count=3,
        )

        with patch("app.services.progress_service.get_db", return_value=mock):
            async with _make_api_client() as client:
                resp = await client.get("/api/progress")

        assert resp.status_code == 200
        body = resp.json()

        # Profile
        assert body["profile"]["has_profile"] is True
        assert body["profile"]["completeness"] == 100
        assert body["profile"]["target_role"] == "Full Stack Developer"
        assert body["profile"]["experience_level"] == "student"
        assert body["profile"]["skills_count"] == 3
        assert body["profile"]["skills"] == ["React", "Python", "MongoDB"]

        # Resume
        assert body["resume"]["has_analysis"] is True
        assert body["resume"]["score"] == 72
        assert body["resume"]["skills_count"] == 4
        assert body["resume"]["skills_detected"] == [
            "React", "Python", "MongoDB", "JavaScript"
        ]
        assert body["resume"]["improvements_count"] == 2
        assert body["resume"]["total_analyses"] == 3
        assert body["resume"]["analyzed_at"] is not None

        # Scores
        assert body["readiness_score"] == 72
        # overall = round(100 * 0.4 + 72 * 0.6) = round(83.2) = 83
        assert body["overall_progress"] == 83

    @pytest.mark.asyncio
    async def test_response_schema_shape(self):
        """Verify the response contains all expected top-level keys."""
        app.dependency_overrides.update(_override_user())
        mock = _mock_db(
            profile_doc=_make_profile_doc(),
            resume_doc=_make_resume_doc(),
            resume_count=1,
        )

        with patch("app.services.progress_service.get_db", return_value=mock):
            async with _make_api_client() as client:
                resp = await client.get("/api/progress")

        assert resp.status_code == 200
        body = resp.json()
        assert "profile" in body
        assert "resume" in body
        assert "readiness_score" in body
        assert "overall_progress" in body
        assert "next_steps" in body


# ── No data scenarios ─────────────────────────────────────────────────────


class TestProgressNoData:
    """Users with partial or no data."""

    @pytest.fixture(autouse=True)
    def _cleanup(self):
        yield
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_no_data_at_all(self):
        app.dependency_overrides.update(_override_user())
        mock = _mock_db(profile_doc=None, resume_doc=None, resume_count=0)

        with patch("app.services.progress_service.get_db", return_value=mock):
            async with _make_api_client() as client:
                resp = await client.get("/api/progress")

        assert resp.status_code == 200
        body = resp.json()

        assert body["profile"]["has_profile"] is False
        assert body["profile"]["completeness"] == 0
        assert body["profile"]["skills_count"] == 0
        assert body["profile"]["skills"] == []

        assert body["resume"]["has_analysis"] is False
        assert body["resume"]["score"] == 0
        assert body["resume"]["skills_count"] == 0
        assert body["resume"]["total_analyses"] == 0

        assert body["readiness_score"] == 0
        assert body["overall_progress"] == 0

        # Next steps should suggest creating profile + uploading resume
        labels = [s["label"] for s in body["next_steps"]]
        assert any("profile" in lbl.lower() for lbl in labels)
        assert any("resume" in lbl.lower() for lbl in labels)

    @pytest.mark.asyncio
    async def test_profile_only_no_resume(self):
        app.dependency_overrides.update(_override_user())
        mock = _mock_db(
            profile_doc=_make_profile_doc(),
            resume_doc=None,
            resume_count=0,
        )

        with patch("app.services.progress_service.get_db", return_value=mock):
            async with _make_api_client() as client:
                resp = await client.get("/api/progress")

        assert resp.status_code == 200
        body = resp.json()

        assert body["profile"]["has_profile"] is True
        assert body["profile"]["completeness"] == 100

        assert body["resume"]["has_analysis"] is False
        assert body["resume"]["score"] == 0
        assert body["resume"]["total_analyses"] == 0

        assert body["readiness_score"] == 0
        # overall = round(100 * 0.4 + 0 * 0.6) = 40
        assert body["overall_progress"] == 40

        # Should suggest uploading resume
        labels = [s["label"] for s in body["next_steps"]]
        assert any("resume" in lbl.lower() for lbl in labels)

    @pytest.mark.asyncio
    async def test_resume_only_no_profile(self):
        app.dependency_overrides.update(_override_user())
        mock = _mock_db(
            profile_doc=None,
            resume_doc=_make_resume_doc(),
            resume_count=1,
        )

        with patch("app.services.progress_service.get_db", return_value=mock):
            async with _make_api_client() as client:
                resp = await client.get("/api/progress")

        assert resp.status_code == 200
        body = resp.json()

        assert body["profile"]["has_profile"] is False
        assert body["profile"]["completeness"] == 0

        assert body["resume"]["has_analysis"] is True
        assert body["resume"]["score"] == 72

        assert body["readiness_score"] == 72
        # overall = round(0 * 0.4 + 72 * 0.6) = round(43.2) = 43
        assert body["overall_progress"] == 43

        # Should suggest creating profile
        labels = [s["label"] for s in body["next_steps"]]
        assert any("profile" in lbl.lower() for lbl in labels)


# ── Profile completeness calculation ─────────────────────────────────────


class TestProfileCompleteness:
    """Verify the completeness formula (5 fields, 20% each)."""

    @pytest.fixture(autouse=True)
    def _cleanup(self):
        yield
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_all_fields_filled(self):
        app.dependency_overrides.update(_override_user())
        mock = _mock_db(
            profile_doc=_make_profile_doc(),
            resume_doc=None,
            resume_count=0,
        )

        with patch("app.services.progress_service.get_db", return_value=mock):
            async with _make_api_client() as client:
                resp = await client.get("/api/progress")

        assert resp.status_code == 200
        assert resp.json()["profile"]["completeness"] == 100

    @pytest.mark.asyncio
    async def test_partial_profile(self):
        """3 of 5 fields → 60%."""
        app.dependency_overrides.update(_override_user())
        partial = _make_profile_doc(
            education="",
            university="",
            target_role="Developer",
            career_goal="Get a job",
            skills=["Python"],
        )
        mock = _mock_db(profile_doc=partial, resume_doc=None, resume_count=0)

        with patch("app.services.progress_service.get_db", return_value=mock):
            async with _make_api_client() as client:
                resp = await client.get("/api/progress")

        assert resp.status_code == 200
        assert resp.json()["profile"]["completeness"] == 60

    @pytest.mark.asyncio
    async def test_empty_profile_fields(self):
        """All string fields blank, no skills → 0%."""
        app.dependency_overrides.update(_override_user())
        empty = _make_profile_doc(
            education="",
            university="",
            target_role="",
            career_goal="",
            skills=[],
        )
        mock = _mock_db(profile_doc=empty, resume_doc=None, resume_count=0)

        with patch("app.services.progress_service.get_db", return_value=mock):
            async with _make_api_client() as client:
                resp = await client.get("/api/progress")

        assert resp.status_code == 200
        assert resp.json()["profile"]["completeness"] == 0

    @pytest.mark.asyncio
    async def test_one_field_filled(self):
        """1 of 5 fields → 20%."""
        app.dependency_overrides.update(_override_user())
        one = _make_profile_doc(
            education="BS CS",
            university="",
            target_role="",
            career_goal="",
            skills=[],
        )
        mock = _mock_db(profile_doc=one, resume_doc=None, resume_count=0)

        with patch("app.services.progress_service.get_db", return_value=mock):
            async with _make_api_client() as client:
                resp = await client.get("/api/progress")

        assert resp.status_code == 200
        assert resp.json()["profile"]["completeness"] == 20

    @pytest.mark.asyncio
    async def test_empty_skills_list_counts_as_unfilled(self):
        """An empty skills list should NOT count as filled."""
        app.dependency_overrides.update(_override_user())
        doc = _make_profile_doc(
            education="BS CS",
            university="MIT",
            target_role="Dev",
            career_goal="Job",
            skills=[],
        )
        mock = _mock_db(profile_doc=doc, resume_doc=None, resume_count=0)

        with patch("app.services.progress_service.get_db", return_value=mock):
            async with _make_api_client() as client:
                resp = await client.get("/api/progress")

        assert resp.status_code == 200
        # 4 of 5 fields (education, university, target_role, career_goal)
        assert resp.json()["profile"]["completeness"] == 80


# ── Overall progress weighting ───────────────────────────────────────────


class TestOverallProgress:
    """Verify overall_progress = profile*0.4 + resume*0.6."""

    @pytest.fixture(autouse=True)
    def _cleanup(self):
        yield
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_zero_everything(self):
        app.dependency_overrides.update(_override_user())
        mock = _mock_db(profile_doc=None, resume_doc=None, resume_count=0)

        with patch("app.services.progress_service.get_db", return_value=mock):
            async with _make_api_client() as client:
                resp = await client.get("/api/progress")

        assert resp.status_code == 200
        assert resp.json()["overall_progress"] == 0
        assert resp.json()["readiness_score"] == 0

    @pytest.mark.asyncio
    async def test_perfect_profile_no_resume(self):
        """100% profile, no resume → 40."""
        app.dependency_overrides.update(_override_user())
        mock = _mock_db(
            profile_doc=_make_profile_doc(),
            resume_doc=None,
            resume_count=0,
        )

        with patch("app.services.progress_service.get_db", return_value=mock):
            async with _make_api_client() as client:
                resp = await client.get("/api/progress")

        assert resp.status_code == 200
        assert resp.json()["overall_progress"] == 40

    @pytest.mark.asyncio
    async def test_no_profile_perfect_resume(self):
        """No profile, score 100 → 60."""
        app.dependency_overrides.update(_override_user())
        perfect_resume = _make_resume_doc(
            analysis={
                "score": 100,
                "summary": "Perfect",
                "strengths": [],
                "weaknesses": [],
                "missing_info": [],
                "improvements": [],
                "skills_detected": [],
                "sections": {
                    "education": [],
                    "experience": [],
                    "projects": [],
                    "certifications": [],
                },
            }
        )
        mock = _mock_db(
            profile_doc=None,
            resume_doc=perfect_resume,
            resume_count=1,
        )

        with patch("app.services.progress_service.get_db", return_value=mock):
            async with _make_api_client() as client:
                resp = await client.get("/api/progress")

        assert resp.status_code == 200
        assert resp.json()["overall_progress"] == 60

    @pytest.mark.asyncio
    async def test_score_never_exceeds_100(self):
        """Clamp overall_progress to [0, 100]."""
        app.dependency_overrides.update(_override_user())
        mock = _mock_db(
            profile_doc=_make_profile_doc(),
            resume_doc=_make_resume_doc(),
            resume_count=1,
        )

        with patch("app.services.progress_service.get_db", return_value=mock):
            async with _make_api_client() as client:
                resp = await client.get("/api/progress")

        assert resp.status_code == 200
        assert 0 <= resp.json()["overall_progress"] <= 100


# ── Next steps ───────────────────────────────────────────────────────────


class TestNextSteps:
    """Verify deterministic next-step generation."""

    @pytest.fixture(autouse=True)
    def _cleanup(self):
        yield
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_no_data_suggests_profile_and_resume(self):
        app.dependency_overrides.update(_override_user())
        mock = _mock_db(profile_doc=None, resume_doc=None, resume_count=0)

        with patch("app.services.progress_service.get_db", return_value=mock):
            async with _make_api_client() as client:
                resp = await client.get("/api/progress")

        assert resp.status_code == 200
        steps = resp.json()["next_steps"]
        labels = [s["label"] for s in steps]
        assert any("profile" in lbl.lower() for lbl in labels)
        assert any("resume" in lbl.lower() for lbl in labels)

    @pytest.mark.asyncio
    async def test_complete_profile_no_resume(self):
        app.dependency_overrides.update(_override_user())
        mock = _mock_db(
            profile_doc=_make_profile_doc(),
            resume_doc=None,
            resume_count=0,
        )

        with patch("app.services.progress_service.get_db", return_value=mock):
            async with _make_api_client() as client:
                resp = await client.get("/api/progress")

        assert resp.status_code == 200
        steps = resp.json()["next_steps"]
        labels = [s["label"] for s in steps]
        assert any("resume" in lbl.lower() for lbl in labels)

    @pytest.mark.asyncio
    async def test_all_complete_has_low_priority_step(self):
        """Fully complete user gets a positive low-priority message."""
        app.dependency_overrides.update(_override_user())
        complete_resume = _make_resume_doc(
            analysis={
                "score": 95,
                "summary": "Excellent",
                "strengths": ["Great projects"],
                "weaknesses": [],
                "missing_info": [],
                "improvements": [],
                "skills_detected": ["React", "Python"],
                "sections": {
                    "education": [],
                    "experience": [],
                    "projects": [],
                    "certifications": [],
                },
            }
        )
        mock = _mock_db(
            profile_doc=_make_profile_doc(),
            resume_doc=complete_resume,
            resume_count=1,
        )

        with patch("app.services.progress_service.get_db", return_value=mock):
            async with _make_api_client() as client:
                resp = await client.get("/api/progress")

        assert resp.status_code == 200
        steps = resp.json()["next_steps"]
        assert len(steps) > 0
        assert steps[0]["priority"] == "low"

    @pytest.mark.asyncio
    async def test_improvement_count_in_next_step_label(self):
        """When resume has improvements, the step label mentions the count."""
        app.dependency_overrides.update(_override_user())
        mock = _mock_db(
            profile_doc=_make_profile_doc(),
            resume_doc=_make_resume_doc(),  # has 2 improvements
            resume_count=1,
        )

        with patch("app.services.progress_service.get_db", return_value=mock):
            async with _make_api_client() as client:
                resp = await client.get("/api/progress")

        assert resp.status_code == 200
        steps = resp.json()["next_steps"]
        resume_steps = [s for s in steps if "improvement" in s["label"].lower()]
        assert len(resume_steps) > 0
        assert "2" in resume_steps[0]["label"]


# ── User isolation ───────────────────────────────────────────────────────


class TestUserIsolation:
    """Dashboard must use JWT user ID, never a client-provided one."""

    @pytest.fixture(autouse=True)
    def _cleanup(self):
        yield
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_uses_jwt_user_id(self):
        app.dependency_overrides.update(_override_user())

        captured_profile_query = {}
        captured_resume_query = {}
        captured_count_query = {}

        async def mock_profile_find_one(query):
            captured_profile_query.update(query)
            return _make_profile_doc()

        async def mock_resume_find_one(query, sort=None):
            captured_resume_query.update(query)
            return _make_resume_doc()

        async def mock_count(query):
            captured_count_query.update(query)
            return 1

        mock_db = MagicMock()
        mock_db.career_profiles = AsyncMock()
        mock_db.career_profiles.find_one = mock_profile_find_one
        mock_db.resumes = AsyncMock()
        mock_db.resumes.find_one = mock_resume_find_one
        mock_db.resumes.count_documents = mock_count

        with patch("app.services.progress_service.get_db", return_value=mock_db):
            async with _make_api_client() as client:
                resp = await client.get("/api/progress")

        assert resp.status_code == 200
        assert captured_profile_query["user_id"] == FAKE_USER_ID
        assert captured_resume_query["user_id"] == FAKE_USER_ID
        assert captured_count_query["user_id"] == FAKE_USER_ID

    @pytest.mark.asyncio
    async def test_different_user_gets_own_data(self):
        """A different JWT user ID must query with their own ObjectId."""
        other_id = ObjectId()
        other_user = {
            "_id": other_id,
            "name": "Other User",
            "email": "other@example.com",
            "password_hash": "hash",
            "created_at": datetime.now(timezone.utc),
        }
        app.dependency_overrides.update(_override_user(other_user))

        captured_query = {}

        async def mock_profile_find_one(query):
            captured_query.update(query)
            return None

        mock_db = MagicMock()
        mock_db.career_profiles = AsyncMock()
        mock_db.career_profiles.find_one = mock_profile_find_one
        mock_db.resumes = AsyncMock()
        mock_db.resumes.find_one = AsyncMock(return_value=None)
        mock_db.resumes.count_documents = AsyncMock(return_value=0)

        with patch("app.services.progress_service.get_db", return_value=mock_db):
            async with _make_api_client() as client:
                resp = await client.get("/api/progress")

        assert resp.status_code == 200
        assert captured_query["user_id"] == other_id
        assert captured_query["user_id"] != FAKE_USER_ID


# ── Error handling ───────────────────────────────────────────────────────


class TestProgressErrors:
    """MongoDB and service failures must propagate and not leak internals.

    These tests verify the service layer directly because httpx's ASGI
    transport re-raises unhandled server exceptions before FastAPI's global
    handler can return a 500 response.
    """

    @pytest.mark.asyncio
    async def test_mongodb_profile_failure(self):
        mock = _mock_db(
            profile_side_effect=Exception("MongoDB connection lost"),
            resume_doc=None,
            resume_count=0,
        )

        with patch("app.services.progress_service.get_db", return_value=mock):
            with pytest.raises(Exception, match="MongoDB connection lost"):
                await progress_service.get_dashboard(str(FAKE_USER_ID))

    @pytest.mark.asyncio
    async def test_mongodb_resume_failure(self):
        mock = _mock_db(
            profile_doc=None,
            resume_side_effect=Exception("Read timeout"),
            resume_count=0,
        )

        with patch("app.services.progress_service.get_db", return_value=mock):
            with pytest.raises(Exception, match="Read timeout"):
                await progress_service.get_dashboard(str(FAKE_USER_ID))

    @pytest.mark.asyncio
    async def test_mongodb_count_failure(self):
        mock = _mock_db(
            profile_doc=None,
            resume_doc=None,
            count_side_effect=Exception("Count failed"),
        )

        with patch("app.services.progress_service.get_db", return_value=mock):
            with pytest.raises(Exception, match="Count failed"):
                await progress_service.get_dashboard(str(FAKE_USER_ID))

    @pytest.mark.asyncio
    async def test_route_returns_500_on_service_error(self):
        """Verify the route lets the global handler catch service errors."""
        app.dependency_overrides.update(_override_user())
        mock = _mock_db(
            profile_side_effect=Exception("DB down"),
            resume_doc=None,
            resume_count=0,
        )

        with patch("app.services.progress_service.get_db", return_value=mock):
            async with _make_api_client() as client:
                # httpx ASGI transport re-raises the server exception.
                # The global handler in main.py logs it and would return 500
                # in a real HTTP context. Here we verify it propagates.
                with pytest.raises(Exception):
                    await client.get("/api/progress")

        app.dependency_overrides.clear()


# ── Malformed stored data ────────────────────────────────────────────────


class TestMalformedData:
    """Graceful handling of corrupt or incomplete stored documents."""

    @pytest.fixture(autouse=True)
    def _cleanup(self):
        yield
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_resume_with_empty_analysis(self):
        """Stored resume with missing analysis sub-document."""
        app.dependency_overrides.update(_override_user())
        doc = _make_resume_doc()
        doc["analysis"] = {}
        mock = _mock_db(profile_doc=None, resume_doc=doc, resume_count=1)

        with patch("app.services.progress_service.get_db", return_value=mock):
            async with _make_api_client() as client:
                resp = await client.get("/api/progress")

        assert resp.status_code == 200
        body = resp.json()
        assert body["resume"]["has_analysis"] is True
        assert body["resume"]["score"] == 0
        assert body["resume"]["skills_count"] == 0

    @pytest.mark.asyncio
    async def test_resume_with_malformed_analysis(self):
        """Stored resume with garbage analysis data falls back to defaults."""
        app.dependency_overrides.update(_override_user())
        doc = _make_resume_doc()
        doc["analysis"] = {"score": "not_a_number", "skills_detected": 42}
        mock = _mock_db(profile_doc=None, resume_doc=doc, resume_count=1)

        with patch("app.services.progress_service.get_db", return_value=mock):
            async with _make_api_client() as client:
                resp = await client.get("/api/progress")

        assert resp.status_code == 200
        # Should not crash; falls back to defaults
        assert resp.json()["resume"]["has_analysis"] is True
