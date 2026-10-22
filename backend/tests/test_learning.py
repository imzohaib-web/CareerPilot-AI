"""Tests for roadmap assessment, verified skill, and alert workflows."""

import json
from unittest.mock import AsyncMock, patch

import pytest
from bson import ObjectId
from fastapi import HTTPException

from app.schemas.learning import SkillQuizAnswer, SkillQuizSubmission
from app.services import learning_service, roadmap_service


def _fake_questions() -> str:
    return json.dumps(
        {
            "questions": [
                {
                    "id": f"q-{index}",
                    "question": f"Question {index}",
                    "options": ["Correct answer", "Wrong A", "Wrong B", "Wrong C"],
                    "correct_option": 0,
                }
                for index in range(1, 11)
            ]
        }
    )


@pytest.fixture
def learning_user():
    return str(ObjectId())


@pytest.fixture
def offline_roadmap(learning_user):
    roadmap_id = ObjectId()
    document = {
        "_id": roadmap_id,
        "user_id": ObjectId(learning_user),
        "target_role": "Backend Engineer",
        "roadmap": {
            "phases": [
                {
                    "tasks": [
                        {
                            "id": "task-1",
                            "title": "Build REST APIs",
                            "skill": "FastAPI",
                            "description": "Learn routing and validation",
                            "action": "Create a CRUD API",
                            "milestone": "Deploy an API",
                        }
                    ]
                }
            ]
        },
        "completed_tasks": [],
        "verified_tasks": [],
    }
    roadmap_service._offline_roadmaps[learning_user] = document
    learning_service._offline_assessments.clear()
    learning_service._offline_verified.clear()
    learning_service._offline_alerts.clear()
    yield document
    roadmap_service._offline_roadmaps.pop(learning_user, None)
    learning_service._offline_assessments.clear()
    learning_service._offline_verified.clear()
    learning_service._offline_alerts.clear()


def _answer_set(correct: int) -> list[SkillQuizAnswer]:
    return [
        SkillQuizAnswer(
            question_id=f"q-{index}",
            selected_option=0 if index <= correct else 1,
        )
        for index in range(1, 11)
    ]


async def _start_test_quiz(user_id: str, roadmap: dict):
    with patch(
        "app.services.learning_service.qwen_chat",
        new=AsyncMock(return_value=(_fake_questions(), "test-model")),
    ):
        return await learning_service.start_quiz(
            user_id, str(roadmap["_id"]), "task-1"
        )


@pytest.mark.asyncio
async def test_passing_quiz_verifies_skill_and_updates_task(
    learning_user, offline_roadmap, monkeypatch
):
    def no_database():
        raise HTTPException(status_code=503, detail="database offline")

    monkeypatch.setattr(learning_service, "get_db", no_database)
    quiz = await _start_test_quiz(learning_user, offline_roadmap)
    assert len(quiz.questions) == 10
    assert "correct_option" not in quiz.questions[0].model_dump()

    result = await learning_service.submit_quiz(
        learning_user,
        quiz.id,
        SkillQuizSubmission(answers=_answer_set(7)),
        "learner@example.com",
    )

    assert result.score == 70
    assert result.passed is True
    assert offline_roadmap["verified_tasks"] == ["task-1"]
    assert offline_roadmap["completed_tasks"] == ["task-1"]
    skills = await learning_service.get_verified_skills(learning_user)
    assert [(skill.name, skill.score) for skill in skills] == [("FastAPI", 70)]
    alerts = await learning_service.get_alerts(learning_user)
    assert alerts.unread_count == 1
    assert alerts.alerts[0].category == "skill_verified"


@pytest.mark.asyncio
async def test_failing_quiz_does_not_verify_or_complete(
    learning_user, offline_roadmap, monkeypatch
):
    def no_database():
        raise HTTPException(status_code=503, detail="database offline")

    monkeypatch.setattr(learning_service, "get_db", no_database)
    quiz = await _start_test_quiz(learning_user, offline_roadmap)
    result = await learning_service.submit_quiz(
        learning_user,
        quiz.id,
        SkillQuizSubmission(answers=_answer_set(6)),
        "learner@example.com",
    )

    assert result.score == 60
    assert not result.passed
    assert offline_roadmap["verified_tasks"] == []
    assert await learning_service.get_verified_skills(learning_user) == []
    alerts = await learning_service.get_alerts(learning_user)
    assert alerts.alerts[0].category == "assessment_retry"


@pytest.mark.asyncio
async def test_assessment_is_user_scoped_and_cannot_be_submitted_twice(
    learning_user, offline_roadmap, monkeypatch
):
    def no_database():
        raise HTTPException(status_code=503, detail="database offline")

    monkeypatch.setattr(learning_service, "get_db", no_database)
    quiz = await _start_test_quiz(learning_user, offline_roadmap)
    assert await learning_service._get_owned_assessment(str(ObjectId()), quiz.id) is None

    payload = SkillQuizSubmission(answers=_answer_set(10))
    await learning_service.submit_quiz(
        learning_user, quiz.id, payload, "learner@example.com"
    )
    with pytest.raises(HTTPException) as error:
        await learning_service.submit_quiz(
            learning_user, quiz.id, payload, "learner@example.com"
        )
    assert error.value.status_code == 409


@pytest.mark.asyncio
async def test_quiz_requires_all_unique_question_answers(
    learning_user, offline_roadmap, monkeypatch
):
    def no_database():
        raise HTTPException(status_code=503, detail="database offline")

    monkeypatch.setattr(learning_service, "get_db", no_database)
    quiz = await _start_test_quiz(learning_user, offline_roadmap)
    submission = SkillQuizSubmission(
        answers=[
            SkillQuizAnswer(question_id=f"q-{index}", selected_option=0)
            for index in range(1, 10)
        ] + [SkillQuizAnswer(question_id="q-9", selected_option=1)]
    )
    with pytest.raises(HTTPException) as error:
        await learning_service.submit_quiz(
            learning_user, quiz.id, submission, "learner@example.com"
        )
    assert error.value.status_code == 422


@pytest.mark.asyncio
async def test_roadmap_task_cannot_be_completed_without_skill_assessment():
    with pytest.raises(HTTPException) as error:
        await roadmap_service.toggle_task(
            str(ObjectId()), str(ObjectId()), "task-1", True
        )
    assert error.value.status_code == 409
