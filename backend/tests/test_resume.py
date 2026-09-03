"""Tests for the AI Resume Analyzer backend module.

Covers:
  - Pydantic schema validation
  - PDF validation (file type, size, magic bytes, empty/malformed)
  - JSON extraction from AI responses
  - API route authentication + authorization
  - Successful upload + analysis pipeline (mocked AI + MongoDB)
  - AI provider failure handling
  - User isolation
  - Oversized file rejection
"""

import io
import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pymupdf
import pytest
from bson import ObjectId
from fastapi import UploadFile
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.schemas.resume import (
    ResumeAnalysis,
    ResumeAnalysisResponse,
    ResumeSections,
)
from app.services.ai.qwen_service import AIServiceError
from app.services.ai.resume_analyzer import _extract_json
from app.services.dependencies import get_current_user
from app.services.resume_service import ResumeValidationError, validate_and_extract


# ── Helpers ───────────────────────────────────────────────────────────────

FAKE_USER_ID = ObjectId()
FAKE_USER = {
    "_id": FAKE_USER_ID,
    "name": "Test User",
    "email": "test@example.com",
    "password_hash": "hash",
    "created_at": datetime.now(timezone.utc),
}

VALID_ANALYSIS_JSON = json.dumps(
    {
        "score": 72,
        "summary": "A solid early-career CS graduate with React and Python experience.",
        "strengths": ["Clear project descriptions", "Relevant technical stack"],
        "weaknesses": ["No quantified achievements", "Missing GPA"],
        "missing_info": ["LinkedIn profile", "Portfolio link"],
        "improvements": [
            "Add measurable outcomes to projects",
            "Include a professional summary",
        ],
        "skills_detected": ["React", "Python", "MongoDB", "JavaScript"],
        "sections": {
            "education": [
                {
                    "institution": "FAST NUCES",
                    "degree": "BS",
                    "field_of_study": "Computer Science",
                    "year": "2025",
                }
            ],
            "experience": [
                {
                    "company": "Acme Corp",
                    "role": "Intern",
                    "duration": "3 months",
                    "description": "Built REST APIs with FastAPI",
                }
            ],
            "projects": [
                {
                    "name": "CareerPilot",
                    "description": "AI career assistant",
                    "technologies": ["React", "FastAPI"],
                }
            ],
            "certifications": ["AWS Cloud Practitioner"],
        },
    }
)


def _make_pdf(text: str = "John Doe\nSoftware Engineer\nReact, Python") -> bytes:
    """Create a minimal valid PDF with the given text."""
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 72), text, fontsize=11)
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


def _make_upload(
    filename: str = "resume.pdf",
    content: bytes | None = None,
    content_type: str = "application/pdf",
) -> UploadFile:
    """Build a FastAPI UploadFile from raw bytes."""
    if content is None:
        content = _make_pdf()
    return UploadFile(
        file=io.BytesIO(content),
        filename=filename,
        headers={"content-type": content_type},
    )


def _override_user():
    """Return a dependency override dict for authenticated requests."""
    return {get_current_user: AsyncMock(return_value=FAKE_USER)}


def _make_api_client(overrides: dict | None = None) -> AsyncClient:
    transport = ASGITransport(app=app)
    client = AsyncClient(transport=transport, base_url="http://testserver")
    if overrides:
        app.dependency_overrides.update(overrides)
    return client


# ── Schema tests ──────────────────────────────────────────────────────────


class TestResumeAnalysisSchema:
    """ResumeAnalysis Pydantic model validation."""

    def test_valid_full_payload(self):
        data = json.loads(VALID_ANALYSIS_JSON)
        analysis = ResumeAnalysis.model_validate(data)
        assert analysis.score == 72
        assert len(analysis.strengths) == 2
        assert analysis.sections.education[0].institution == "FAST NUCES"
        assert "React" in analysis.skills_detected

    def test_empty_payload_uses_defaults(self):
        analysis = ResumeAnalysis.model_validate({})
        assert analysis.score == 0
        assert analysis.summary == ""
        assert analysis.strengths == []
        assert analysis.sections.projects == []

    def test_score_clamped_above_100(self):
        with pytest.raises(Exception):
            ResumeAnalysis.model_validate({"score": 150})

    def test_score_clamped_below_0(self):
        with pytest.raises(Exception):
            ResumeAnalysis.model_validate({"score": -10})

    def test_string_coerced_to_list(self):
        """Tolerate Qwen returning a single string instead of a list."""
        analysis = ResumeAnalysis.model_validate({"strengths": "just one thing"})
        assert analysis.strengths == ["just one thing"]

    def test_response_schema(self):
        data = json.loads(VALID_ANALYSIS_JSON)
        resp = ResumeAnalysisResponse(
            id=str(ObjectId()),
            user_id=str(FAKE_USER_ID),
            filename="resume.pdf",
            extracted_text_length=500,
            analysis=ResumeAnalysis.model_validate(data),
            analyzed_at=datetime.now(timezone.utc),
            model="qwen-plus",
        )
        assert resp.analysis.score == 72
        assert resp.filename == "resume.pdf"


# ── JSON extraction tests ────────────────────────────────────────────────


class TestExtractJson:
    """Test _extract_json from AI responses."""

    def test_plain_json(self):
        result = _extract_json('{"score": 50}')
        assert result == '{"score": 50}'

    def test_json_in_markdown_fence(self):
        text = '```json\n{"score": 50}\n```'
        result = _extract_json(text)
        assert result is not None
        assert json.loads(result)["score"] == 50

    def test_json_with_surrounding_text(self):
        text = 'Here is the analysis:\n{"score": 80}\nDone.'
        result = _extract_json(text)
        assert result is not None
        assert json.loads(result)["score"] == 80

    def test_no_json_returns_none(self):
        assert _extract_json("I cannot analyze this resume.") is None

    def test_empty_string(self):
        assert _extract_json("") is None


# ── PDF validation tests ──────────────────────────────────────────────────


class TestPdfValidation:
    """validate_and_extract — file-level checks."""

    @pytest.mark.asyncio
    async def test_no_file(self):
        with pytest.raises(ResumeValidationError, match="No file"):
            await validate_and_extract(None)

    @pytest.mark.asyncio
    async def test_no_filename(self):
        upload = _make_upload(filename="")
        with pytest.raises(ResumeValidationError, match="no filename"):
            await validate_and_extract(upload)

    @pytest.mark.asyncio
    async def test_wrong_extension(self):
        upload = _make_upload(filename="resume.docx")
        with pytest.raises(ResumeValidationError, match="PDF"):
            await validate_and_extract(upload)

    @pytest.mark.asyncio
    async def test_non_pdf_magic_bytes(self):
        upload = _make_upload(filename="resume.pdf", content=b"This is not a PDF at all")
        with pytest.raises(ResumeValidationError, match="invalid header"):
            await validate_and_extract(upload)

    @pytest.mark.asyncio
    async def test_empty_file(self):
        upload = _make_upload(filename="resume.pdf", content=b"")
        with pytest.raises(ResumeValidationError, match="empty"):
            await validate_and_extract(upload)

    @pytest.mark.asyncio
    async def test_oversized_file(self):
        # Override the max to 1 byte for the test.
        big_content = _make_pdf() + b"\x00" * 100
        with patch("app.config.RESUME_MAX_SIZE_BYTES", 10):
            upload = _make_upload(content=big_content)
            with pytest.raises(ResumeValidationError, match="too large"):
                await validate_and_extract(upload)

    @pytest.mark.asyncio
    async def test_valid_pdf_extracts_text(self):
        upload = _make_upload()
        text, filename = await validate_and_extract(upload)
        assert filename == "resume.pdf"
        assert "John Doe" in text or "Software" in text
        assert len(text) > 0

    @pytest.mark.asyncio
    async def test_empty_pdf_no_text(self):
        """A valid PDF with no text content should fail gracefully."""
        doc = pymupdf.open()
        doc.new_page()  # blank page
        buf = io.BytesIO()
        doc.save(buf)
        doc.close()
        upload = _make_upload(content=buf.getvalue())
        with pytest.raises(ResumeValidationError, match="No extractable text"):
            await validate_and_extract(upload)

    @pytest.mark.asyncio
    async def test_malformed_pdf(self):
        # Starts with %PDF but is garbage after that.
        upload = _make_upload(content=b"%PDF-1.4 this is garbage not a real pdf")
        with pytest.raises(ResumeValidationError):
            await validate_and_extract(upload)


# ── API route tests ──────────────────────────────────────────────────────


class TestResumeRoutes:
    """Test POST /api/resume/analyze and GET /api/resume/latest."""

    @pytest.fixture(autouse=True)
    def _cleanup_overrides(self):
        """Ensure dependency overrides are cleared after each test."""
        yield
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_analyze_requires_auth(self):
        """Unauthenticated request must return 401/403."""
        app.dependency_overrides.clear()
        async with _make_api_client() as client:
            resp = await client.post(
                "/api/resume/analyze",
                files={"file": ("resume.pdf", _make_pdf(), "application/pdf")},
            )
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_analyze_valid_pdf(self):
        """Full happy path with mocked AI + MongoDB."""
        app.dependency_overrides[get_current_user] = lambda: FAKE_USER

        mock_inserted_id = ObjectId()
        mock_collection = AsyncMock()
        mock_collection.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=mock_inserted_id)
        )

        mock_db = MagicMock()
        mock_db.resumes = mock_collection

        with (
            patch(
                "app.services.resume_service.get_db", return_value=mock_db
            ),
            patch(
                "app.services.ai.resume_analyzer.qwen_chat",
                new_callable=AsyncMock,
                return_value=(VALID_ANALYSIS_JSON, "qwen-plus"),
            ),
        ):
            async with _make_api_client() as client:
                resp = await client.post(
                    "/api/resume/analyze",
                    files={
                        "file": ("resume.pdf", _make_pdf(), "application/pdf")
                    },
                )

        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["analysis"]["score"] == 72
        assert body["filename"] == "resume.pdf"
        assert body["model"] == "qwen-plus"
        assert "React" in body["analysis"]["skills_detected"]

    @pytest.mark.asyncio
    async def test_analyze_rejects_non_pdf(self):
        app.dependency_overrides[get_current_user] = lambda: FAKE_USER

        async with _make_api_client() as client:
            resp = await client.post(
                "/api/resume/analyze",
                files={
                    "file": (
                        "resume.txt",
                        b"not a pdf",
                        "text/plain",
                    )
                },
            )
        assert resp.status_code == 400
        assert "PDF" in resp.json()["detail"]

    @pytest.mark.asyncio
    async def test_analyze_rejects_empty_file(self):
        app.dependency_overrides[get_current_user] = lambda: FAKE_USER

        async with _make_api_client() as client:
            resp = await client.post(
                "/api/resume/analyze",
                files={"file": ("resume.pdf", b"", "application/pdf")},
            )
        assert resp.status_code == 400
        assert "empty" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_analyze_ai_provider_failure(self):
        """Qwen failure must map to 502."""
        app.dependency_overrides[get_current_user] = lambda: FAKE_USER

        from app.services.ai.qwen_service import AIServiceError

        with patch(
            "app.services.ai.resume_analyzer.qwen_chat",
            new_callable=AsyncMock,
            side_effect=AIServiceError("AI provider request failed"),
        ):
            async with _make_api_client() as client:
                resp = await client.post(
                    "/api/resume/analyze",
                    files={
                        "file": ("resume.pdf", _make_pdf(), "application/pdf")
                    },
                )
        assert resp.status_code == 502
        assert "AI" in resp.json()["detail"] or "provider" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_analyze_invalid_ai_json(self):
        """Qwen returning garbage JSON after retry must map to 502."""
        app.dependency_overrides[get_current_user] = lambda: FAKE_USER

        with patch(
            "app.services.ai.resume_analyzer.qwen_chat",
            new_callable=AsyncMock,
            return_value=("This is not JSON at all", "qwen-plus"),
        ):
            async with _make_api_client() as client:
                resp = await client.post(
                    "/api/resume/analyze",
                    files={
                        "file": ("resume.pdf", _make_pdf(), "application/pdf")
                    },
                )
        assert resp.status_code == 502

    @pytest.mark.asyncio
    async def test_latest_not_found(self):
        app.dependency_overrides[get_current_user] = lambda: FAKE_USER

        mock_collection = AsyncMock()
        mock_collection.find_one = AsyncMock(return_value=None)
        mock_db = MagicMock()
        mock_db.resumes = mock_collection

        with patch("app.services.resume_service.get_db", return_value=mock_db):
            async with _make_api_client() as client:
                resp = await client.get("/api/resume/latest")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_latest_returns_stored_analysis(self):
        app.dependency_overrides[get_current_user] = lambda: FAKE_USER

        now = datetime.now(timezone.utc)
        stored_doc = {
            "_id": ObjectId(),
            "user_id": FAKE_USER_ID,
            "filename": "my_resume.pdf",
            "stored_path": "",
            "extracted_text": "John Doe\nSoftware Engineer",
            "analysis": json.loads(VALID_ANALYSIS_JSON),
            "model": "qwen-plus",
            "uploaded_at": now,
            "analyzed_at": now,
        }

        mock_collection = AsyncMock()
        mock_collection.find_one = AsyncMock(return_value=stored_doc)
        mock_db = MagicMock()
        mock_db.resumes = mock_collection

        with patch("app.services.resume_service.get_db", return_value=mock_db):
            async with _make_api_client() as client:
                resp = await client.get("/api/resume/latest")

        assert resp.status_code == 200
        body = resp.json()
        assert body["filename"] == "my_resume.pdf"
        assert body["analysis"]["score"] == 72

    @pytest.mark.asyncio
    async def test_user_isolation_uses_jwt_user_id(self):
        """The route must use the JWT user, not a client-provided one."""
        app.dependency_overrides[get_current_user] = lambda: FAKE_USER

        now = datetime.now(timezone.utc)
        stored_doc = {
            "_id": ObjectId(),
            "user_id": FAKE_USER_ID,
            "filename": "test.pdf",
            "stored_path": "",
            "extracted_text": "text",
            "analysis": json.loads(VALID_ANALYSIS_JSON),
            "model": "qwen-plus",
            "uploaded_at": now,
            "analyzed_at": now,
        }

        mock_collection = AsyncMock()
        mock_collection.find_one = AsyncMock(return_value=stored_doc)
        mock_db = MagicMock()
        mock_db.resumes = mock_collection

        with patch("app.services.resume_service.get_db", return_value=mock_db):
            async with _make_api_client() as client:
                resp = await client.get("/api/resume/latest")

        assert resp.status_code == 200
        # Verify the service queried with the JWT user's ID, not any other ID.
        call_args = mock_collection.find_one.call_args
        query = call_args[0][0]
        assert query["user_id"] == FAKE_USER_ID

    @pytest.mark.asyncio
    async def test_analyze_oversized_file(self):
        app.dependency_overrides[get_current_user] = lambda: FAKE_USER

        big_pdf = _make_pdf() + b"\x00" * 100
        with patch("app.config.RESUME_MAX_SIZE_BYTES", 10):
            async with _make_api_client() as client:
                resp = await client.post(
                    "/api/resume/analyze",
                    files={
                        "file": ("big.pdf", big_pdf, "application/pdf")
                    },
                )
        assert resp.status_code == 400
        assert "too large" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_analyze_mongodb_persistence(self):
        """Verify the analysis document is stored with the correct structure."""
        app.dependency_overrides[get_current_user] = lambda: FAKE_USER

        captured_doc = {}
        mock_inserted_id = ObjectId()

        async def fake_insert(doc):
            captured_doc.update(doc)
            return MagicMock(inserted_id=mock_inserted_id)

        mock_collection = AsyncMock()
        mock_collection.insert_one = fake_insert
        mock_db = MagicMock()
        mock_db.resumes = mock_collection

        with (
            patch("app.services.resume_service.get_db", return_value=mock_db),
            patch(
                "app.services.ai.resume_analyzer.qwen_chat",
                new_callable=AsyncMock,
                return_value=(VALID_ANALYSIS_JSON, "qwen-plus"),
            ),
        ):
            async with _make_api_client() as client:
                resp = await client.post(
                    "/api/resume/analyze",
                    files={
                        "file": ("resume.pdf", _make_pdf(), "application/pdf")
                    },
                )

        assert resp.status_code == 200
        # Verify stored document structure
        assert captured_doc["user_id"] == FAKE_USER_ID
        assert captured_doc["filename"] == "resume.pdf"
        assert "extracted_text" in captured_doc
        assert "analysis" in captured_doc
        assert captured_doc["analysis"]["score"] == 72
        assert captured_doc["model"] == "qwen-plus"
        assert "uploaded_at" in captured_doc
        assert "analyzed_at" in captured_doc


# ── Timeout + thinking mode tests ─────────────────────────────────────────


class TestTimeoutAndThinkingMode:
    """Verify timeout handling and thinking mode configuration."""

    @pytest.fixture(autouse=True)
    def _cleanup_overrides(self):
        yield
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_timeout_returns_502_with_timed_out_message(self):
        """A Qwen timeout must return 502 with a 'timed out' detail."""
        app.dependency_overrides[get_current_user] = lambda: FAKE_USER

        with patch(
            "app.services.ai.resume_analyzer.qwen_chat",
            new_callable=AsyncMock,
            side_effect=AIServiceError("AI provider request timed out"),
        ):
            async with _make_api_client() as client:
                resp = await client.post(
                    "/api/resume/analyze",
                    files={"file": ("resume.pdf", _make_pdf(), "application/pdf")},
                )
        assert resp.status_code == 502
        assert "timed out" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_thinking_mode_disabled_by_default(self):
        """extra_body must include enable_thinking=False by default."""
        app.dependency_overrides[get_current_user] = lambda: FAKE_USER

        mock_inserted_id = ObjectId()
        mock_collection = AsyncMock()
        mock_collection.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=mock_inserted_id)
        )
        mock_db = MagicMock()
        mock_db.resumes = mock_collection

        captured_kwargs = {}

        async def fake_qwen_chat(*args, **kwargs):
            captured_kwargs.update(kwargs)
            return VALID_ANALYSIS_JSON, "qwen-plus"

        with (
            patch("app.services.resume_service.get_db", return_value=mock_db),
            patch(
                "app.services.ai.resume_analyzer.qwen_chat",
                new_callable=AsyncMock,
                side_effect=fake_qwen_chat,
            ),
        ):
            async with _make_api_client() as client:
                resp = await client.post(
                    "/api/resume/analyze",
                    files={"file": ("resume.pdf", _make_pdf(), "application/pdf")},
                )

        assert resp.status_code == 200
        # Verify thinking mode is disabled and timeout is set
        assert captured_kwargs.get("extra_body") == {"enable_thinking": False}
        assert captured_kwargs.get("timeout") == 120.0

    @pytest.mark.asyncio
    async def test_long_resume_truncated(self):
        """Resume text exceeding _MAX_TEXT_CHARS is truncated before sending."""
        app.dependency_overrides[get_current_user] = lambda: FAKE_USER

        mock_inserted_id = ObjectId()
        mock_collection = AsyncMock()
        mock_collection.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=mock_inserted_id)
        )
        mock_db = MagicMock()
        mock_db.resumes = mock_collection

        captured_args = {}

        async def fake_qwen_chat(user_message, **kwargs):
            captured_args["user_message"] = user_message
            return VALID_ANALYSIS_JSON, "qwen-plus"

        long_text = "A" * 20_000  # exceeds _MAX_TEXT_CHARS (15_000)

        with (
            patch("app.services.resume_service.get_db", return_value=mock_db),
            patch(
                "app.services.ai.resume_analyzer.qwen_chat",
                new_callable=AsyncMock,
                side_effect=fake_qwen_chat,
            ),
        ):
            async with _make_api_client() as client:
                resp = await client.post(
                    "/api/resume/analyze",
                    files={
                        "file": (
                            "long_resume.pdf",
                            _make_pdf(long_text),
                            "application/pdf",
                        )
                    },
                )

        assert resp.status_code == 200
        # The user message should contain truncated text (15_000 chars + prefix)
        msg = captured_args["user_message"]
        # The message starts with "Analyze the following resume text:\n\n"
        # followed by at most 15_000 chars of text
        text_part = msg.split("\n\n", 1)[1]
        assert len(text_part) <= 15_000
