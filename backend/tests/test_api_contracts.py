"""API contract tests for CareerPilot AI.

Asserts exact JSON key sets, data types, nullability, and optionality for:
  - GET /api/rag/documents
  - GET /api/rag/knowledge-base/stats
  - GET /api/progress
  - GET /api/roadmap/latest
  - GET /api/resume/latest
  - GET /api/analyze-gap/latest
  - GET /api/interview/latest

Covers both "has data" and "no data" cases.
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from bson import ObjectId
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.schemas.interview import (
    InterviewFeedback,
    InterviewQuestion,
    InterviewResponse,
    QuestionEvaluation,
    UserAnswer,
)
from app.schemas.progress import (
    DashboardResponse,
    InterviewProgress,
    NextStep,
    ProfileProgress,
    ResumeProgress,
    RoadmapProgress,
)
from app.schemas.rag import CitationRef, DocumentInfo, KnowledgeBaseStats
from app.schemas.resume import (
    ResumeAnalysis,
    ResumeAnalysisResponse,
    ResumeSectionEducation,
    ResumeSectionExperience,
    ResumeSectionProject,
    ResumeSections,
)
from app.schemas.roadmap import (
    RoadmapContent,
    RoadmapPhase,
    RoadmapResponse,
    RoadmapTask,
)
from app.schemas.skill_gap import (
    RequiredProficiency,
    SkillGapAnalysis,
    SkillGapResponse,
)
from app.services.dependencies import get_current_user

FAKE_USER_ID = ObjectId()
FAKE_USER = {
    "_id": FAKE_USER_ID,
    "name": "Contract Test User",
    "email": "contract_tester@example.com",
    "password_hash": "hash",
    "created_at": datetime.now(timezone.utc),
}


def _override_user():
    return {get_current_user: lambda: FAKE_USER}


@pytest.fixture(autouse=True)
def _cleanup_overrides():
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


def _make_client():
    transport = ASGITransport(app=app)
    return AsyncClient(
        transport=transport,
        base_url="http://testserver",
    )


# ── 1. GET /api/rag/documents ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_contract_rag_documents_no_data():
    """GET /api/rag/documents when user and knowledge base have no documents."""
    app.dependency_overrides.update(_override_user())
    with patch("app.services.rag_service.list_user_documents", new_callable=AsyncMock) as mock_list:
        mock_list.return_value = []
        async with _make_client() as client:
            resp = await client.get("/api/rag/documents")
            assert resp.status_code == 200
            data = resp.json()
            assert isinstance(data, list)
            assert len(data) == 0


@pytest.mark.asyncio
async def test_contract_rag_documents_has_data():
    """GET /api/rag/documents when documents exist; assert exact keys and types."""
    app.dependency_overrides.update(_override_user())
    now = datetime.now(timezone.utc)
    mock_docs = [
        DocumentInfo(
            id="doc-global-1",
            user_id=None,  # Global docs have null user_id
            title="Frontend Role Matrix",
            category="Role Matrix",
            chunk_count=3,
            content_length=1500,
            scope="global",
            created_at=now,
            deletable=False,
        ),
        DocumentInfo(
            id="doc-user-1",
            user_id=str(FAKE_USER_ID),
            title="My Target Job Description",
            category="Job Description",
            chunk_count=2,
            content_length=800,
            scope="user",
            created_at=now,
            deletable=True,
        ),
    ]

    with patch("app.services.rag_service.list_user_documents", new_callable=AsyncMock) as mock_list:
        mock_list.return_value = mock_docs
        async with _make_client() as client:
            resp = await client.get("/api/rag/documents")
            assert resp.status_code == 200
            data = resp.json()
            assert isinstance(data, list)
            assert len(data) == 2

            expected_keys = {
                "id",
                "user_id",
                "title",
                "category",
                "chunk_count",
                "content_length",
                "scope",
                "created_at",
                "deletable",
            }

            for doc in data:
                assert set(doc.keys()) == expected_keys
                assert isinstance(doc["id"], str)
                assert doc["user_id"] is None or isinstance(doc["user_id"], str)
                assert isinstance(doc["title"], str)
                assert isinstance(doc["category"], str)
                assert isinstance(doc["chunk_count"], int)
                assert isinstance(doc["content_length"], int)
                assert doc["scope"] in ("global", "user")
                assert isinstance(doc["created_at"], str)
                assert isinstance(doc["deletable"], bool)

            # Assert explicit nullability on global doc vs user doc
            assert data[0]["user_id"] is None
            assert data[0]["deletable"] is False
            assert data[1]["user_id"] == str(FAKE_USER_ID)
            assert data[1]["deletable"] is True


# ── 2. GET /api/rag/knowledge-base/stats ────────────────────────────────────────


@pytest.mark.asyncio
async def test_contract_rag_kb_stats():
    """GET /api/rag/knowledge-base/stats exact keys, types, and count map."""
    app.dependency_overrides.clear()
    now = datetime.now(timezone.utc)
    mock_stats = KnowledgeBaseStats(
        total_documents=34,
        total_chunks=72,
        global_documents=34,
        global_chunks=72,
        user_documents=0,
        user_chunks=0,
        categories={"Role Matrix": 12, "Learning Path": 10, "Career Guide": 8, "Interview Guide": 4},
        category_list=["Role Matrix", "Learning Path", "Career Guide", "Interview Guide"],
        chunks_by_category={"Role Matrix": 24, "Learning Path": 20, "Career Guide": 16, "Interview Guide": 12},
        last_seeded_at=now,
        last_updated=now,
        embedding_model="text-embedding-v3",
        vector_dimension=1024,
        retrieval_backend="atlas",
        storage_mode="mongodb",
        database_name="careerpilot_ai",
        status="ready",
    )

    with patch("app.services.knowledge_seeder.get_knowledge_base_stats", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_stats
        async with _make_client() as client:
            resp = await client.get("/api/rag/knowledge-base/stats")
            assert resp.status_code == 200
            data = resp.json()

            expected_keys = {
                "total_documents",
                "total_chunks",
                "global_documents",
                "global_chunks",
                "user_documents",
                "user_chunks",
                "categories",
                "category_list",
                "chunks_by_category",
                "last_seeded_at",
                "last_updated",
                "embedding_model",
                "vector_dimension",
                "retrieval_backend",
                "storage_mode",
                "database_name",
                "status",
            }
            assert set(data.keys()) == expected_keys
            assert isinstance(data["total_documents"], int)
            assert isinstance(data["total_chunks"], int)
            assert isinstance(data["global_documents"], int)
            assert isinstance(data["global_chunks"], int)
            assert isinstance(data["user_documents"], int)
            assert isinstance(data["user_chunks"], int)

            # categories is a dict mapping string -> int (category count map)
            assert isinstance(data["categories"], dict)
            for cat_name, cat_count in data["categories"].items():
                assert isinstance(cat_name, str)
                assert isinstance(cat_count, int)

            assert isinstance(data["category_list"], list)
            for cat in data["category_list"]:
                assert isinstance(cat, str)

            assert isinstance(data["chunks_by_category"], dict)
            assert data["last_seeded_at"] is None or isinstance(data["last_seeded_at"], str)
            assert data["last_updated"] is None or isinstance(data["last_updated"], str)
            assert isinstance(data["embedding_model"], str)
            assert isinstance(data["vector_dimension"], int)
            assert isinstance(data["retrieval_backend"], str)
            assert isinstance(data["storage_mode"], str)
            assert data["database_name"] is None or isinstance(data["database_name"], str)
            assert isinstance(data["status"], str)


# ── 3. GET /api/progress ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_contract_progress_no_data():
    """GET /api/progress when user has completed no sections."""
    app.dependency_overrides.update(_override_user())
    with patch("app.services.progress_service.get_dashboard", new_callable=AsyncMock) as mock_dash:
        mock_dash.return_value = DashboardResponse()
        async with _make_client() as client:
            resp = await client.get("/api/progress")
            assert resp.status_code == 200
            data = resp.json()

            expected_top_keys = {
                "profile",
                "resume",
                "roadmap",
                "interview",
                "verified_skills",
                "readiness_score",
                "overall_progress",
                "next_steps",
            }
            assert set(data.keys()) == expected_top_keys

            # Profile defaults
            assert set(data["profile"].keys()) == {
                "has_profile",
                "completeness",
                "target_role",
                "experience_level",
                "career_goal",
                "skills_count",
                "skills",
            }
            assert data["profile"]["has_profile"] is False
            assert data["profile"]["completeness"] == 0
            assert isinstance(data["profile"]["skills"], list)

            # Resume defaults
            assert set(data["resume"].keys()) == {
                "has_analysis",
                "score",
                "skills_detected",
                "skills_count",
                "improvements_count",
                "improvements",
                "analyzed_at",
                "total_analyses",
            }
            assert data["resume"]["has_analysis"] is False
            assert data["resume"]["analyzed_at"] is None

            # Roadmap defaults
            assert set(data["roadmap"].keys()) == {
                "has_roadmap",
                "title",
                "target_role",
                "total_tasks",
                "completed_tasks_count",
                "completion_percentage",
            }
            assert data["roadmap"]["has_roadmap"] is False

            # Interview defaults
            assert set(data["interview"].keys()) == {
                "has_interview",
                "latest_score",
                "total_interviews",
                "target_role",
            }
            assert data["interview"]["has_interview"] is False

            assert isinstance(data["readiness_score"], int)
            assert isinstance(data["overall_progress"], int)
            assert isinstance(data["next_steps"], list)


@pytest.mark.asyncio
async def test_contract_progress_has_data():
    """GET /api/progress when user has populated career data."""
    app.dependency_overrides.update(_override_user())
    now = datetime.now(timezone.utc)
    populated = DashboardResponse(
        profile=ProfileProgress(
            has_profile=True,
            completeness=90,
            target_role="Fullstack Engineer",
            experience_level="mid",
            career_goal="Lead Engineer",
            skills_count=4,
            skills=["Python", "TypeScript", "FastAPI", "React"],
        ),
        resume=ResumeProgress(
            has_analysis=True,
            score=85,
            skills_detected=["Python", "React"],
            skills_count=2,
            improvements_count=1,
            improvements=["Add metrics to bullet points"],
            analyzed_at=now,
            total_analyses=2,
        ),
        roadmap=RoadmapProgress(
            has_roadmap=True,
            title="Fullstack Mastery",
            target_role="Fullstack Engineer",
            total_tasks=10,
            completed_tasks_count=4,
            completion_percentage=40,
        ),
        interview=InterviewProgress(
            has_interview=True,
            latest_score=88,
            total_interviews=3,
            target_role="Fullstack Engineer",
        ),
        readiness_score=78,
        overall_progress=65,
        next_steps=[
            NextStep(label="Complete Task", action="/roadmap", priority="high"),
        ],
    )

    with patch("app.services.progress_service.get_dashboard", new_callable=AsyncMock) as mock_dash:
        mock_dash.return_value = populated
        async with _make_client() as client:
            resp = await client.get("/api/progress")
            assert resp.status_code == 200
            data = resp.json()

            assert data["profile"]["has_profile"] is True
            assert data["resume"]["has_analysis"] is True
            assert isinstance(data["resume"]["analyzed_at"], str)
            assert len(data["next_steps"]) == 1
            step = data["next_steps"][0]
            assert set(step.keys()) == {"label", "action", "priority"}
            assert step["priority"] in ("high", "medium", "low")


# ── 4. GET /api/roadmap/latest ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_contract_roadmap_latest_no_data():
    """GET /api/roadmap/latest when user has no roadmap returns 404."""
    app.dependency_overrides.update(_override_user())
    with patch("app.services.roadmap_service.get_latest_roadmap", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = None
        async with _make_client() as client:
            resp = await client.get("/api/roadmap/latest")
            assert resp.status_code == 404
            assert set(resp.json().keys()) == {"detail"}
            assert resp.json()["detail"] == "No roadmap found."


@pytest.mark.asyncio
async def test_contract_roadmap_latest_has_data():
    """GET /api/roadmap/latest when roadmap exists; assert exact keys and types."""
    app.dependency_overrides.update(_override_user())
    now = datetime.now(timezone.utc)
    mock_roadmap = RoadmapResponse(
        id="roadmap-123",
        user_id=str(FAKE_USER_ID),
        target_role="Frontend Engineer",
        time_frame_weeks=8,
        weekly_hours=10,
        roadmap=RoadmapContent(
            title="Frontend Engineer Learning Path",
            target_role="Frontend Engineer",
            total_duration_weeks=8,
            summary="Strategic 8-week path to mastering modern web development.",
            phases=[
                RoadmapPhase(
                    phase_number=1,
                    name="Phase 1: React & Architecture",
                    duration_weeks=4,
                    focus="State management and performance",
                    tasks=[
                        RoadmapTask(
                            id="task-1",
                            title="Master React Hooks",
                            skill="React",
                            description="Deep dive into useEffect and useMemo.",
                            action="Refactor components.",
                            resource="https://react.dev",
                            milestone="Clean lint checks.",
                            estimated_hours=6,
                            source_refs=["React Docs"],
                        )
                    ],
                )
            ],
        ),
        completed_tasks=["task-1"],
        sources=[
            CitationRef(
                id=1,
                source_id="chunk-1",
                document_title="React Architecture Guide",
                section_title="State",
                heading_path="Architecture > State",
                snippet="Hooks manage local component state.",
                similarity=0.91,
                scope="global",
            )
        ],
        created_at=now,
    )

    with patch("app.services.roadmap_service.get_latest_roadmap", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_roadmap
        async with _make_client() as client:
            resp = await client.get("/api/roadmap/latest")
            assert resp.status_code == 200
            data = resp.json()

            expected_top_keys = {
                "id",
                "user_id",
                "target_role",
                "time_frame_weeks",
                "weekly_hours",
                "roadmap",
                "completed_tasks",
                "sources",
                "created_at",
            }
            assert set(data.keys()) == expected_top_keys
            assert isinstance(data["id"], str)
            assert isinstance(data["user_id"], str)
            assert isinstance(data["target_role"], str)
            assert isinstance(data["time_frame_weeks"], int)
            assert isinstance(data["weekly_hours"], int)
            assert isinstance(data["completed_tasks"], list)
            assert isinstance(data["created_at"], str)

            # Roadmap content
            rc = data["roadmap"]
            assert set(rc.keys()) == {"title", "target_role", "total_duration_weeks", "summary", "phases"}
            assert isinstance(rc["phases"], list)
            assert len(rc["phases"]) == 1
            phase = rc["phases"][0]
            assert set(phase.keys()) == {"phase_number", "name", "duration_weeks", "focus", "tasks"}
            assert isinstance(phase["tasks"], list)
            assert len(phase["tasks"]) == 1
            task = phase["tasks"][0]
            assert set(task.keys()) == {
                "id",
                "title",
                "skill",
                "description",
                "action",
                "resource",
                "milestone",
                "estimated_hours",
                "source_refs",
            }

            # Sources
            assert isinstance(data["sources"], list)
            assert len(data["sources"]) == 1
            source = data["sources"][0]
            assert set(source.keys()) == {
                "id",
                "source_id",
                "document_title",
                "section_title",
                "heading_path",
                "snippet",
                "similarity",
                "scope",
            }
            assert source["section_title"] is None or isinstance(source["section_title"], str)
            assert source["heading_path"] is None or isinstance(source["heading_path"], str)


# ── 5. GET /api/resume/latest ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_contract_resume_latest_no_data():
    """GET /api/resume/latest when user has uploaded no resume returns 404."""
    app.dependency_overrides.update(_override_user())
    with patch("app.services.resume_service.get_latest_analysis", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = None
        async with _make_client() as client:
            resp = await client.get("/api/resume/latest")
            assert resp.status_code == 404
            assert set(resp.json().keys()) == {"detail"}
            assert resp.json()["detail"] == "No resume analysis found. Upload a resume first."


@pytest.mark.asyncio
async def test_contract_resume_latest_has_data():
    """GET /api/resume/latest when resume analysis exists; assert exact keys and types."""
    app.dependency_overrides.update(_override_user())
    now = datetime.now(timezone.utc)
    mock_analysis = ResumeAnalysisResponse(
        id="resume-123",
        user_id=str(FAKE_USER_ID),
        filename="resume.pdf",
        extracted_text_length=1200,
        analysis=ResumeAnalysis(
            score=82,
            summary="Solid engineering background with strong Python skills.",
            strengths=["FastAPI", "MongoDB"],
            weaknesses=["Cloud architecture"],
            missing_info=["Metrics in accomplishments"],
            improvements=["Highlight system design contributions"],
            skills_detected=["Python", "FastAPI", "Docker"],
            sections=ResumeSections(
                education=[
                    ResumeSectionEducation(
                        institution="MIT",
                        degree="BS",
                        field_of_study="Computer Science",
                        year="2024",
                    )
                ],
                experience=[
                    ResumeSectionExperience(
                        company="Tech Corp",
                        role="Backend Intern",
                        duration="Summer 2023",
                        description="Built microservices.",
                    )
                ],
                projects=[
                    ResumeSectionProject(
                        name="CareerPilot",
                        description="AI platform",
                        technologies=["FastAPI", "React"],
                    )
                ],
                certifications=["AWS Cloud Practitioner"],
            ),
        ),
        analyzed_at=now,
        model="qwen-plus",
    )

    with patch("app.services.resume_service.get_latest_analysis", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_analysis
        async with _make_client() as client:
            resp = await client.get("/api/resume/latest")
            assert resp.status_code == 200
            data = resp.json()

            expected_top_keys = {
                "id",
                "user_id",
                "filename",
                "extracted_text_length",
                "analysis",
                "analyzed_at",
                "model",
            }
            assert set(data.keys()) == expected_top_keys
            assert isinstance(data["id"], str)
            assert isinstance(data["user_id"], str)
            assert isinstance(data["filename"], str)
            assert isinstance(data["extracted_text_length"], int)
            assert isinstance(data["analyzed_at"], str)
            assert isinstance(data["model"], str)

            # Analysis sub-model
            analysis = data["analysis"]
            assert set(analysis.keys()) == {
                "score",
                "summary",
                "strengths",
                "weaknesses",
                "missing_info",
                "improvements",
                "skills_detected",
                "sections",
            }
            assert isinstance(analysis["score"], int)
            assert isinstance(analysis["summary"], str)
            assert isinstance(analysis["strengths"], list)
            assert isinstance(analysis["weaknesses"], list)
            assert isinstance(analysis["missing_info"], list)
            assert isinstance(analysis["improvements"], list)
            assert isinstance(analysis["skills_detected"], list)

            # Sections sub-model
            sections = analysis["sections"]
            assert set(sections.keys()) == {"education", "experience", "projects", "certifications"}
            assert isinstance(sections["education"], list)
            assert len(sections["education"]) == 1
            edu = sections["education"][0]
            assert set(edu.keys()) == {"institution", "degree", "field_of_study", "year"}

            assert isinstance(sections["experience"], list)
            assert len(sections["experience"]) == 1
            exp = sections["experience"][0]
            assert set(exp.keys()) == {"company", "role", "duration", "description"}

            assert isinstance(sections["projects"], list)
            assert len(sections["projects"]) == 1
            proj = sections["projects"][0]
            assert set(proj.keys()) == {"name", "description", "technologies"}

            assert isinstance(sections["certifications"], list)


# ── 6. GET /api/analyze-gap/latest ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_contract_analyze_gap_latest_no_data():
    """GET /api/analyze-gap/latest when user has no gap analysis returns 404."""
    app.dependency_overrides.update(_override_user())
    with patch("app.services.skill_gap_service.get_latest_gap", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = None
        async with _make_client() as client:
            resp = await client.get("/api/analyze-gap/latest")
            assert resp.status_code == 404
            assert set(resp.json().keys()) == {"detail"}
            assert resp.json()["detail"] == "No skill gap analysis found."


@pytest.mark.asyncio
async def test_contract_analyze_gap_latest_has_data():
    """GET /api/analyze-gap/latest when gap analysis exists; assert exact keys and types."""
    app.dependency_overrides.update(_override_user())
    now = datetime.now(timezone.utc)
    mock_gap = SkillGapResponse(
        id="gap-123",
        user_id=str(FAKE_USER_ID),
        target_role="Backend Engineer",
        target_job_description="Seeking a Python and cloud backend engineer.",
        analysis=SkillGapAnalysis(
            summary="Solid core Python backend skills, gaps in distributed systems.",
            missing_technical_skills=["Kubernetes", "gRPC"],
            missing_soft_skills=["Cross-team leadership"],
            required_proficiencies=[
                RequiredProficiency(area="Backend Frameworks", skills=["FastAPI", "Django"]),
                RequiredProficiency(area="Distributed Systems", skills=["Kafka", "Redis"]),
            ],
            match_score=75,
        ),
        sources=[
            CitationRef(
                id=1,
                source_id="chunk-2",
                document_title="Backend Competency Matrix",
                section_title="Architecture",
                heading_path="Backend > Architecture",
                snippet="Proficiency in distributed messaging is expected.",
                similarity=0.88,
                scope="global",
            )
        ],
        created_at=now,
    )

    with patch("app.services.skill_gap_service.get_latest_gap", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_gap
        async with _make_client() as client:
            resp = await client.get("/api/analyze-gap/latest")
            assert resp.status_code == 200
            data = resp.json()

            expected_top_keys = {
                "id",
                "user_id",
                "target_role",
                "target_job_description",
                "analysis",
                "sources",
                "created_at",
            }
            assert set(data.keys()) == expected_top_keys
            assert isinstance(data["id"], str)
            assert isinstance(data["user_id"], str)
            assert isinstance(data["target_role"], str)
            assert isinstance(data["target_job_description"], str)
            assert isinstance(data["created_at"], str)

            # Analysis sub-model
            analysis = data["analysis"]
            assert set(analysis.keys()) == {
                "summary",
                "missing_technical_skills",
                "missing_soft_skills",
                "required_proficiencies",
                "match_score",
            }
            assert isinstance(analysis["summary"], str)
            assert isinstance(analysis["missing_technical_skills"], list)
            assert isinstance(analysis["missing_soft_skills"], list)
            assert isinstance(analysis["required_proficiencies"], list)
            assert len(analysis["required_proficiencies"]) == 2
            prof = analysis["required_proficiencies"][0]
            assert set(prof.keys()) == {"area", "skills"}
            assert isinstance(prof["area"], str)
            assert isinstance(prof["skills"], list)
            assert isinstance(analysis["match_score"], int)

            # Sources
            assert isinstance(data["sources"], list)
            assert len(data["sources"]) == 1
            source = data["sources"][0]
            assert set(source.keys()) == {
                "id",
                "source_id",
                "document_title",
                "section_title",
                "heading_path",
                "snippet",
                "similarity",
                "scope",
            }


# ── 7. GET /api/interview/latest ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_contract_interview_latest_no_data():
    """GET /api/interview/latest when user has no mock interview returns 404."""
    app.dependency_overrides.update(_override_user())
    with patch("app.services.interview_service.get_latest_interview", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = None
        async with _make_client() as client:
            resp = await client.get("/api/interview/latest")
            assert resp.status_code == 404
            assert set(resp.json().keys()) == {"detail"}
            assert resp.json()["detail"] == "No mock interview found."


@pytest.mark.asyncio
async def test_contract_interview_latest_in_progress():
    """GET /api/interview/latest for session in progress (feedback and completed_at are None)."""
    app.dependency_overrides.update(_override_user())
    now = datetime.now(timezone.utc)
    mock_in_progress = InterviewResponse(
        id="interview-123",
        user_id=str(FAKE_USER_ID),
        target_role="AI Engineer",
        experience_level="student",
        questions=[
            InterviewQuestion(
                id="q-1",
                question="How does attention mechanism work in transformers?",
                category="technical",
                hint="Explain Query, Key, and Value vectors.",
            )
        ],
        answers=[UserAnswer(question_id="q-1", answer="It calculates scaled dot-product attention.")],
        feedback=None,  # Nullable in progress
        status="in_progress",
        created_at=now,
        completed_at=None,  # Nullable in progress
    )

    with patch("app.services.interview_service.get_latest_interview", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_in_progress
        async with _make_client() as client:
            resp = await client.get("/api/interview/latest")
            assert resp.status_code == 200
            data = resp.json()

            expected_top_keys = {
                "id",
                "user_id",
                "target_role",
                "experience_level",
                "questions",
                "answers",
                "feedback",
                "status",
                "created_at",
                "completed_at",
            }
            assert set(data.keys()) == expected_top_keys
            assert isinstance(data["id"], str)
            assert isinstance(data["user_id"], str)
            assert isinstance(data["target_role"], str)
            assert isinstance(data["experience_level"], str)
            assert data["status"] == "in_progress"
            assert isinstance(data["created_at"], str)

            # Nullable fields in progress
            assert data["feedback"] is None
            assert data["completed_at"] is None

            # Questions and answers
            assert isinstance(data["questions"], list)
            assert len(data["questions"]) == 1
            q = data["questions"][0]
            assert set(q.keys()) == {"id", "question", "category", "hint"}

            assert isinstance(data["answers"], list)
            assert len(data["answers"]) == 1
            a = data["answers"][0]
            assert set(a.keys()) == {"question_id", "answer"}


@pytest.mark.asyncio
async def test_contract_interview_latest_completed():
    """GET /api/interview/latest for completed session; assert feedback sub-model shape."""
    app.dependency_overrides.update(_override_user())
    now = datetime.now(timezone.utc)
    mock_completed = InterviewResponse(
        id="interview-123",
        user_id=str(FAKE_USER_ID),
        target_role="AI Engineer",
        experience_level="student",
        questions=[
            InterviewQuestion(
                id="q-1",
                question="How does attention mechanism work in transformers?",
                category="technical",
                hint="Explain Query, Key, and Value vectors.",
            )
        ],
        answers=[UserAnswer(question_id="q-1", answer="It calculates scaled dot-product attention.")],
        feedback=InterviewFeedback(
            overall_score=92,
            summary="Clear understanding of transformer fundamentals.",
            evaluations=[
                QuestionEvaluation(
                    question_id="q-1",
                    score=92,
                    strengths=["Accurate explanation of QKV"],
                    improvements=["Mention multi-head attention"],
                    ideal_answer="Scaled dot product attention with query, key, value matrices.",
                )
            ],
            recommended_actions=["Review multi-head projection layers"],
            rubric_sources=[
                CitationRef(
                    id=1,
                    source_id="chunk-3",
                    document_title="Interview Rubric Guide",
                    section_title="Transformers",
                    heading_path="AI > Rubric",
                    snippet="Clear explanation of attention matrices.",
                    similarity=0.94,
                    scope="global",
                )
            ],
        ),
        status="completed",
        created_at=now,
        completed_at=now,
    )

    with patch("app.services.interview_service.get_latest_interview", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_completed
        async with _make_client() as client:
            resp = await client.get("/api/interview/latest")
            assert resp.status_code == 200
            data = resp.json()

            assert data["status"] == "completed"
            assert isinstance(data["completed_at"], str)
            assert data["feedback"] is not None

            feedback = data["feedback"]
            assert set(feedback.keys()) == {
                "overall_score",
                "summary",
                "evaluations",
                "recommended_actions",
                "rubric_sources",
            }
            assert isinstance(feedback["overall_score"], int)
            assert isinstance(feedback["summary"], str)
            assert isinstance(feedback["evaluations"], list)
            assert len(feedback["evaluations"]) == 1
            eval_item = feedback["evaluations"][0]
            assert set(eval_item.keys()) == {
                "question_id",
                "score",
                "strengths",
                "improvements",
                "ideal_answer",
            }
            assert isinstance(feedback["recommended_actions"], list)
            assert isinstance(feedback["rubric_sources"], list)
