"""Tests for the AI Mock Interview schemas and routes."""

import json
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
    InterviewStartRequest,
    InterviewSubmitRequest,
    QuestionEvaluation,
    UserAnswer,
)
from app.services.ai.qwen_service import AIServiceError
from app.services.dependencies import get_current_user

FAKE_USER_ID = ObjectId()
FAKE_USER = {
    "_id": FAKE_USER_ID,
    "name": "Test User",
    "email": "test@example.com",
    "password_hash": "hash",
    "created_at": datetime.now(timezone.utc),
}

VALID_QUESTIONS_JSON = json.dumps(
    {
        "questions": [
            {
                "id": "q-1",
                "question": "Can you explain how FastAPI handles asynchronous requests?",
                "category": "technical",
                "hint": "Mention ASGI event loops and coroutines.",
            },
            {
                "id": "q-2",
                "question": "Tell me about a time you encountered a tight project deadline.",
                "category": "behavioral",
                "hint": "Use the STAR method: Situation, Task, Action, Result.",
            },
        ]
    }
)

VALID_FEEDBACK_JSON = json.dumps(
    {
        "overall_score": 85,
        "summary": "Strong technical foundation and clear communication. Good use of examples.",
        "evaluations": [
            {
                "question_id": "q-1",
                "score": 90,
                "strengths": ["Accurate explanation of ASGI", "Clear distinction from WSGI"],
                "improvements": ["Could mention async database drivers like Motor"],
                "ideal_answer": "FastAPI runs on ASGI servers like Uvicorn, executing async def endpoints on the asyncio event loop.",
            },
            {
                "question_id": "q-2",
                "score": 80,
                "strengths": ["Followed STAR structure", "Clear measurable outcome"],
                "improvements": ["Elaborate on team collaboration under stress"],
                "ideal_answer": "When facing a deadline, I prioritized MVP features, aligned with stakeholders, and delivered the core release.",
            },
        ],
        "recommended_actions": [
            "Practice explaining concurrency trade-offs",
            "Refine delivery pace on behavioral scenarios",
        ],
    }
)


def _override_user():
    return {get_current_user: lambda: FAKE_USER}


def _make_api_client(overrides: dict | None = None) -> AsyncClient:
    transport = ASGITransport(app=app)
    client = AsyncClient(transport=transport, base_url="http://testserver")
    if overrides:
        app.dependency_overrides.update(overrides)
    return client


class TestInterviewSchemas:
    def test_valid_question_schema(self):
        q = InterviewQuestion(
            id="q-1",
            question="What is dependency injection in FastAPI?",
            category="technical",
            hint="Think of the Depends keyword.",
        )
        assert q.id == "q-1"
        assert q.category == "technical"

    def test_valid_feedback_schema(self):
        feedback = InterviewFeedback.model_validate(json.loads(VALID_FEEDBACK_JSON))
        assert feedback.overall_score == 85
        assert len(feedback.evaluations) == 2
        assert feedback.evaluations[0].score == 90

    def test_start_request_skill_coercion(self):
        req = InterviewStartRequest(
            target_role="Backend Engineer",
            focus_skills="Python, FastAPI, Docker",  # type: ignore[arg-type]
            question_count=3,
        )
        assert req.focus_skills == ["Python", "FastAPI", "Docker"]
        assert req.question_count == 3


@pytest.mark.asyncio
async def test_start_interview_unauthenticated():
    app.dependency_overrides.clear()
    async with _make_api_client() as client:
        response = await client.post(
            "/api/interview/start",
            json={"target_role": "Backend Engineer"},
        )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_start_interview_success():
    app.dependency_overrides.clear()
    app.dependency_overrides.update(_override_user())

    questions_data = json.loads(VALID_QUESTIONS_JSON)["questions"]
    questions = [InterviewQuestion.model_validate(q) for q in questions_data]

    mock_response = InterviewResponse(
        id=str(ObjectId()),
        user_id=str(FAKE_USER_ID),
        target_role="Backend Engineer",
        experience_level="student",
        questions=questions,
        answers=[],
        feedback=None,
        status="in_progress",
        created_at=datetime.now(timezone.utc),
    )

    with patch(
        "app.services.interview_service.start_interview",
        new=AsyncMock(return_value=mock_response),
    ):
        async with _make_api_client() as client:
            response = await client.post(
                "/api/interview/start",
                json={
                    "target_role": "Backend Engineer",
                    "question_count": 2,
                    "focus_skills": ["Python", "FastAPI"],
                },
            )

    assert response.status_code == 200
    data = response.json()
    assert data["target_role"] == "Backend Engineer"
    assert len(data["questions"]) == 2
    assert data["status"] == "in_progress"
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_start_interview_ai_error():
    app.dependency_overrides.clear()
    app.dependency_overrides.update(_override_user())

    with patch(
        "app.services.interview_service.start_interview",
        side_effect=AIServiceError("AI service unavailable"),
    ):
        async with _make_api_client() as client:
            response = await client.post(
                "/api/interview/start",
                json={"target_role": "Backend Engineer"},
            )

    assert response.status_code == 502
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_submit_interview_success():
    app.dependency_overrides.clear()
    app.dependency_overrides.update(_override_user())

    interview_id = str(ObjectId())
    feedback = InterviewFeedback.model_validate(json.loads(VALID_FEEDBACK_JSON))
    questions_data = json.loads(VALID_QUESTIONS_JSON)["questions"]
    questions = [InterviewQuestion.model_validate(q) for q in questions_data]

    mock_response = InterviewResponse(
        id=interview_id,
        user_id=str(FAKE_USER_ID),
        target_role="Backend Engineer",
        experience_level="student",
        questions=questions,
        answers=[
            UserAnswer(question_id="q-1", answer="FastAPI uses asyncio for concurrency."),
            UserAnswer(question_id="q-2", answer="I prioritized key tasks and met the deadline."),
        ],
        feedback=feedback,
        status="completed",
        created_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
    )

    with patch(
        "app.services.interview_service.submit_interview",
        new=AsyncMock(return_value=mock_response),
    ):
        async with _make_api_client() as client:
            response = await client.post(
                f"/api/interview/{interview_id}/submit",
                json={
                    "answers": [
                        {"question_id": "q-1", "answer": "FastAPI uses asyncio for concurrency."},
                        {"question_id": "q-2", "answer": "I prioritized key tasks and met the deadline."},
                    ]
                },
            )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert data["feedback"]["overall_score"] == 85
    assert len(data["feedback"]["evaluations"]) == 2
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_latest_interview_not_found():
    app.dependency_overrides.clear()
    app.dependency_overrides.update(_override_user())

    with patch(
        "app.services.interview_service.get_latest_interview",
        new=AsyncMock(return_value=None),
    ):
        async with _make_api_client() as client:
            response = await client.get("/api/interview/latest")

    assert response.status_code == 404
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_latest_interview_success():
    app.dependency_overrides.clear()
    app.dependency_overrides.update(_override_user())

    interview_id = str(ObjectId())
    feedback = InterviewFeedback.model_validate(json.loads(VALID_FEEDBACK_JSON))
    mock_response = InterviewResponse(
        id=interview_id,
        user_id=str(FAKE_USER_ID),
        target_role="Backend Engineer",
        questions=[],
        answers=[],
        feedback=feedback,
        status="completed",
        created_at=datetime.now(timezone.utc),
    )

    with patch(
        "app.services.interview_service.get_latest_interview",
        new=AsyncMock(return_value=mock_response),
    ):
        async with _make_api_client() as client:
            response = await client.get("/api/interview/latest")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == interview_id
    assert data["feedback"]["overall_score"] == 85
    app.dependency_overrides.clear()
