"""Tests for the Roadmap Generator schemas and routes."""

import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from bson import ObjectId
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.schemas.roadmap import (
    RoadmapContent,
    RoadmapPhase,
    RoadmapRequest,
    RoadmapResponse,
    RoadmapTask,
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

VALID_ROADMAP_JSON = json.dumps(
    {
        "title": "Frontend Developer Mastery Roadmap",
        "target_role": "Frontend Developer",
        "total_duration_weeks": 8,
        "summary": "A targeted roadmap focusing on TypeScript, modern React, and performance optimization.",
        "phases": [
            {
                "phase_number": 1,
                "name": "Phase 1: TypeScript & State Architecture",
                "duration_weeks": 4,
                "focus": "Transition from plain JavaScript to robust TypeScript and advanced state management.",
                "tasks": [
                    {
                        "id": "task-1",
                        "title": "Master TypeScript Generics & Types",
                        "skill": "TypeScript",
                        "description": "Learn strict typing, utility types, and interfaces.",
                        "action": "Migrate a small React project to strict TypeScript.",
                        "resource": "Official TypeScript Documentation",
                        "milestone": "Publish typecheck-passing GitHub repository",
                        "estimated_hours": 10,
                    },
                    {
                        "id": "task-2",
                        "title": "Modern State Management with Zustand",
                        "skill": "State Management",
                        "description": "Understand global stores and asynchronous state.",
                        "action": "Build a shopping cart or dashboard with Zustand.",
                        "resource": "Zustand Documentation",
                        "milestone": "Working prototype with persistent local storage",
                        "estimated_hours": 8,
                    },
                ],
            },
            {
                "phase_number": 2,
                "name": "Phase 2: Testing & CI/CD",
                "duration_weeks": 4,
                "focus": "Unit testing and automated deployment.",
                "tasks": [
                    {
                        "id": "task-3",
                        "title": "Component Testing with Vitest & Testing Library",
                        "skill": "Testing",
                        "description": "Write accessible and robust unit tests.",
                        "action": "Achieve 80% coverage on core components.",
                        "resource": "React Testing Library Guides",
                        "milestone": "Passing automated test suite in GitHub Actions",
                        "estimated_hours": 12,
                    }
                ],
            },
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


class TestRoadmapSchemas:
    def test_valid_roadmap_schema(self):
        content = RoadmapContent.model_validate(json.loads(VALID_ROADMAP_JSON))
        assert content.title == "Frontend Developer Mastery Roadmap"
        assert content.total_duration_weeks == 8
        assert len(content.phases) == 2
        assert content.phases[0].tasks[0].id == "task-1"
        assert content.phases[0].tasks[0].estimated_hours == 10

    def test_roadmap_request_coercion(self):
        req = RoadmapRequest(
            target_role="Frontend Engineer",
            skill_gaps="TypeScript, Testing, Docker",  # type: ignore[arg-type]
            time_frame_weeks=12,
            weekly_hours=15,
        )
        assert req.skill_gaps == ["TypeScript", "Testing", "Docker"]
        assert req.time_frame_weeks == 12

    def test_roadmap_response_schema(self):
        content = RoadmapContent.model_validate(json.loads(VALID_ROADMAP_JSON))
        res = RoadmapResponse(
            id=str(ObjectId()),
            user_id=str(FAKE_USER_ID),
            target_role="Frontend Developer",
            time_frame_weeks=8,
            weekly_hours=10,
            roadmap=content,
            completed_tasks=["task-1"],
            created_at=datetime.now(timezone.utc),
        )
        assert res.completed_tasks == ["task-1"]
        assert res.roadmap.phases[0].tasks[0].title == "Master TypeScript Generics & Types"


@pytest.mark.asyncio
async def test_generate_roadmap_unauthenticated():
    app.dependency_overrides.clear()
    async with _make_api_client() as client:
        response = await client.post(
            "/api/roadmap/generate",
            json={"target_role": "Frontend Developer", "skill_gaps": ["TypeScript"]},
        )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_generate_roadmap_success():
    app.dependency_overrides.clear()
    app.dependency_overrides.update(_override_user())

    mock_response = RoadmapResponse(
        id=str(ObjectId()),
        user_id=str(FAKE_USER_ID),
        target_role="Frontend Developer",
        time_frame_weeks=8,
        weekly_hours=10,
        roadmap=RoadmapContent.model_validate(json.loads(VALID_ROADMAP_JSON)),
        completed_tasks=[],
        created_at=datetime.now(timezone.utc),
    )

    with patch("app.services.roadmap_service.generate_roadmap", new=AsyncMock(return_value=mock_response)):
        async with _make_api_client() as client:
            response = await client.post(
                "/api/roadmap/generate",
                json={
                    "target_role": "Frontend Developer",
                    "skill_gaps": ["TypeScript", "Testing"],
                    "time_frame_weeks": 8,
                    "weekly_hours": 10,
                },
            )

    assert response.status_code == 200
    data = response.json()
    assert data["target_role"] == "Frontend Developer"
    assert data["roadmap"]["title"] == "Frontend Developer Mastery Roadmap"
    assert len(data["roadmap"]["phases"]) == 2
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_generate_roadmap_ai_error():
    app.dependency_overrides.clear()
    app.dependency_overrides.update(_override_user())

    with patch(
        "app.services.roadmap_service.generate_roadmap",
        side_effect=AIServiceError("AI service is not configured"),
    ):
        async with _make_api_client() as client:
            response = await client.post(
                "/api/roadmap/generate",
                json={"target_role": "Frontend Developer"},
            )

    assert response.status_code == 502
    assert "AI service is not configured" in response.json()["detail"]
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_latest_roadmap_not_found():
    app.dependency_overrides.clear()
    app.dependency_overrides.update(_override_user())

    with patch("app.services.roadmap_service.get_latest_roadmap", new=AsyncMock(return_value=None)):
        async with _make_api_client() as client:
            response = await client.get("/api/roadmap/latest")

    assert response.status_code == 404
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_latest_roadmap_success():
    app.dependency_overrides.clear()
    app.dependency_overrides.update(_override_user())

    mock_response = RoadmapResponse(
        id=str(ObjectId()),
        user_id=str(FAKE_USER_ID),
        target_role="Frontend Developer",
        time_frame_weeks=8,
        weekly_hours=10,
        roadmap=RoadmapContent.model_validate(json.loads(VALID_ROADMAP_JSON)),
        completed_tasks=["task-1"],
        created_at=datetime.now(timezone.utc),
    )

    with patch("app.services.roadmap_service.get_latest_roadmap", new=AsyncMock(return_value=mock_response)):
        async with _make_api_client() as client:
            response = await client.get("/api/roadmap/latest")

    assert response.status_code == 200
    data = response.json()
    assert data["completed_tasks"] == ["task-1"]
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_toggle_task_route():
    app.dependency_overrides.clear()
    app.dependency_overrides.update(_override_user())

    mock_response = RoadmapResponse(
        id=str(ObjectId()),
        user_id=str(FAKE_USER_ID),
        target_role="Frontend Developer",
        time_frame_weeks=8,
        weekly_hours=10,
        roadmap=RoadmapContent.model_validate(json.loads(VALID_ROADMAP_JSON)),
        completed_tasks=["task-1"],
        created_at=datetime.now(timezone.utc),
    )

    with patch("app.services.roadmap_service.toggle_task", new=AsyncMock(return_value=mock_response)):
        async with _make_api_client() as client:
            response = await client.put(
                f"/api/roadmap/{mock_response.id}/tasks/task-1/toggle",
                json={"completed": True},
            )

    assert response.status_code == 200
    data = response.json()
    assert "task-1" in data["completed_tasks"]
    app.dependency_overrides.clear()


def test_roadmap_completed_and_verified_tasks_union():
    """Verify that serialization and progress calculation use the UNION of completed_tasks and verified_tasks."""
    from app.services.progress_service import _build_roadmap_progress
    from app.services.roadmap_service import _serialize

    content = RoadmapContent(
        title="Test Track",
        target_role="Engineer",
        phases=[
            RoadmapPhase(
                phase_number=1,
                name="Phase 1",
                duration_weeks=4,
                tasks=[
                    RoadmapTask(id="task-1", title="Task 1", skill="Python", description="d", action="a", milestone="m"),
                    RoadmapTask(id="task-2", title="Task 2", skill="Docker", description="d", action="a", milestone="m"),
                    RoadmapTask(id="task-3", title="Task 3", skill="FastAPI", description="d", action="a", milestone="m"),
                ],
            )
        ],
    )

    # 1. Legacy roadmap (completed_tasks only)
    legacy_doc = {
        "_id": ObjectId(),
        "user_id": ObjectId(),
        "target_role": "Engineer",
        "completed_tasks": ["task-1"],
        "roadmap": content.model_dump(),
    }
    legacy_res = _serialize(legacy_doc, content)
    assert legacy_res.completed_tasks == ["task-1"]
    legacy_prog = _build_roadmap_progress(legacy_doc)
    assert legacy_prog.completed_tasks_count == 1
    assert legacy_prog.total_tasks == 3

    # 2. New roadmap (verified_tasks only)
    new_doc = {
        "_id": ObjectId(),
        "user_id": ObjectId(),
        "target_role": "Engineer",
        "verified_tasks": ["task-2"],
        "roadmap": content.model_dump(),
    }
    new_res = _serialize(new_doc, content)
    assert new_res.completed_tasks == ["task-2"]
    new_prog = _build_roadmap_progress(new_doc)
    assert new_prog.completed_tasks_count == 1

    # 3. Mixed roadmap (both lists present with overlapping task-2)
    mixed_doc = {
        "_id": ObjectId(),
        "user_id": ObjectId(),
        "target_role": "Engineer",
        "completed_tasks": ["task-1", "task-2"],
        "verified_tasks": ["task-2", "task-3"],
        "roadmap": content.model_dump(),
    }
    mixed_res = _serialize(mixed_doc, content)
    assert set(mixed_res.completed_tasks) == {"task-1", "task-2", "task-3"}
    assert len(mixed_res.completed_tasks) == 3
    mixed_prog = _build_roadmap_progress(mixed_doc)
    assert mixed_prog.completed_tasks_count == 3
    assert mixed_prog.completion_percentage == 100
