import asyncio
import json
import smtplib
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


@pytest.mark.asyncio
async def test_quiz_response_never_leaks_correct_answers_or_explanations(
    learning_user, offline_roadmap, monkeypatch
):
    """Ensure that quiz initiation never includes correct answers, solutions, or explanations."""
    def no_database():
        raise HTTPException(status_code=503, detail="database offline")

    monkeypatch.setattr(learning_service, "get_db", no_database)
    quiz = await _start_test_quiz(learning_user, offline_roadmap)
    quiz_dict = quiz.model_dump()

    # Check root level
    forbidden_keys = {"correct_option", "correct_answers", "answer", "answers", "explanation", "solution"}
    assert not any(k in quiz_dict for k in forbidden_keys)

    # Check each question
    for q in quiz_dict["questions"]:
        assert set(q.keys()) == {"id", "question", "options"}
        assert len(q["options"]) == 4
        assert not any(k in q for k in forbidden_keys)


@pytest.mark.asyncio
async def test_smtp_alert_handling_without_credentials_and_nonblocking(
    learning_user, offline_roadmap, monkeypatch
):
    """Confirm app runs without SMTP credentials and alert creation remains non-blocking."""
    def no_database():
        raise HTTPException(status_code=503, detail="database offline")

    monkeypatch.setattr(learning_service, "get_db", no_database)
    from app import config

    # 1. Without SMTP env vars
    monkeypatch.setattr(config, "SMTP_HOST", "")
    monkeypatch.setattr(config, "SMTP_SENDER", "")

    quiz = await _start_test_quiz(learning_user, offline_roadmap)
    result = await learning_service.submit_quiz(
        learning_user,
        quiz.id,
        SkillQuizSubmission(answers=_answer_set(10)),
        "learner@example.com",
    )
    assert result.passed is True
    alerts = await learning_service.get_alerts(learning_user)
    assert len(alerts.alerts) >= 1
    assert alerts.alerts[0].email_status == "not_configured"

    # 2. When SMTP is configured, confirm non-blocking background dispatch via asyncio.to_thread
    # and retention in _background_tasks set
    monkeypatch.setattr(config, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(config, "SMTP_SENDER", "alerts@careerpilot.ai")
    monkeypatch.setattr(config, "SMTP_PORT", 587)
    monkeypatch.setattr(config, "SMTP_USERNAME", "user")
    monkeypatch.setattr(config, "SMTP_PASSWORD", "secret_pass")

    email_sent = False
    thread_dispatched = False

    def mock_send(rec, subj, body):
        nonlocal email_sent
        email_sent = True
        # Ensure credentials are never in subject or body
        assert "secret_pass" not in body
        assert "secret_pass" not in subj

    orig_to_thread = asyncio.to_thread

    async def mock_to_thread(func, *args, **kwargs):
        nonlocal thread_dispatched
        thread_dispatched = True
        return await orig_to_thread(func, *args, **kwargs)

    monkeypatch.setattr(asyncio, "to_thread", mock_to_thread)
    monkeypatch.setattr(learning_service, "_send_email", mock_send)
    await learning_service._create_alert(
        learning_user, "learner@example.com", "Test Title", "Test Message", "test_category"
    )
    await asyncio.sleep(0.05)
    assert email_sent is True
    assert thread_dispatched is True
    # Ensure task was tracked and cleaned up on completion
    assert len(learning_service._background_tasks) == 0

    # 3. Confirm SMTP exception is caught cleanly without leaking credentials
    def mock_send_fail(rec, subj, body):
        raise smtplib.SMTPAuthenticationError(535, b"secret_pass failed")

    monkeypatch.setattr(learning_service, "_send_email", mock_send_fail)
    await learning_service._create_alert(
        learning_user, "learner@example.com", "Fail Title", "Fail Message", "test_category"
    )
    await asyncio.sleep(0.05)
    assert len(learning_service._background_tasks) == 0
