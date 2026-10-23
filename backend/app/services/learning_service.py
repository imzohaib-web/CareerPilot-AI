"""Per-user roadmap skill assessments, verification, and alerts."""

import asyncio
import json
import logging
import re
import smtplib
import ssl
from datetime import datetime, timezone
from email.message import EmailMessage

from bson import ObjectId
from fastapi import HTTPException
from pydantic import BaseModel, Field, ValidationError

from app import config
from app.database.mongodb import get_db
from app.schemas.learning import (
    LearningAlert,
    LearningAlertsResponse,
    SkillQuizAnswer,
    SkillQuizQuestion,
    SkillQuizResponse,
    SkillQuizResult,
    SkillQuizSubmission,
    VerifiedSkill,
)
from app.services.ai.qwen_service import AIServiceError, chat as qwen_chat

logger = logging.getLogger(__name__)
PASS_THRESHOLD = 70
_offline_assessments: dict[str, dict] = {}
_offline_verified: dict[str, list[dict]] = {}
_offline_alerts: dict[str, list[dict]] = {}
_background_tasks: set[asyncio.Task] = set()

_QUIZ_PROMPT = """\
Create exactly ten practical multiple-choice questions that assess whether a learner
understands the given roadmap task and skill. Return only JSON:
{"questions":[{"id":"q-1","question":"...","options":["...","...","...","..."],"correct_option":0}]}
Use IDs q-1 through q-10. Each question must have four distinct plausible options and
one unambiguous correct option indexed 0-3. Assess application, not trivia.
Do not output markdown or text outside the JSON.
"""


class _StoredQuestion(BaseModel):
    id: str
    question: str
    options: list[str] = Field(min_length=4, max_length=4)
    correct_option: int = Field(ge=0, le=3)


class _QuestionSet(BaseModel):
    questions: list[_StoredQuestion] = Field(min_length=10, max_length=10)


async def start_quiz(user_id: str, roadmap_id: str, task_id: str) -> SkillQuizResponse:
    """Generate a quiz for a task on the authenticated user's latest roadmap."""
    roadmap = await _get_owned_roadmap(user_id, roadmap_id)
    task = next(
        (
            task
            for phase in roadmap.get("roadmap", {}).get("phases", [])
            for task in phase.get("tasks", [])
            if task.get("id") == task_id
        ),
        None,
    )
    if task is None:
        raise HTTPException(status_code=404, detail="Roadmap task not found.")

    skill = (task.get("skill") or task.get("title") or "Roadmap skill").strip()
    context = (
        f"Target role: {roadmap.get('target_role', '')}\n"
        f"Skill: {skill}\nTask: {task.get('title', '')}\n"
        f"Learning objective: {task.get('description', '')}\n"
        f"Hands-on action: {task.get('action', '')}\nMilestone: {task.get('milestone', '')}"
    )
    questions, model = await _generate_quiz(context)
    document = {
        "_id": ObjectId(),
        "user_id": ObjectId(user_id),
        "roadmap_id": ObjectId(roadmap_id),
        "task_id": task_id,
        "skill": skill,
        "questions": [question.model_dump() for question in questions],
        "status": "in_progress",
        "model": model,
        "created_at": datetime.now(timezone.utc),
    }
    try:
        await get_db().learning_assessments.insert_one(document)
    except Exception as exc:
        logger.warning("Could not save assessment (%s); using offline cache", type(exc).__name__)
        _offline_assessments[str(document["_id"])] = document
    return _quiz_response(document)


async def submit_quiz(
    user_id: str,
    assessment_id: str,
    submission: SkillQuizSubmission,
    user_email: str,
) -> SkillQuizResult:
    """Grade answers on the server and update verified skills on a passing score."""
    if not ObjectId.is_valid(assessment_id):
        raise HTTPException(status_code=404, detail="Assessment not found.")
    document = await _get_owned_assessment(user_id, assessment_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Assessment not found.")
    if document.get("status") != "in_progress":
        raise HTTPException(status_code=409, detail="Assessment already submitted.")

    questions = document["questions"]
    answer_map = _validate_answers(questions, submission.answers)
    correct_count = sum(
        answer_map[question["id"]] == question["correct_option"]
        for question in questions
    )
    score = round(correct_count / len(questions) * 100)
    passed = score >= PASS_THRESHOLD
    completed_at = datetime.now(timezone.utc)
    result_data = {
        "status": "completed",
        "score": score,
        "passed": passed,
        "correct_answers": correct_count,
        "total_questions": len(questions),
        "completed_at": completed_at,
    }
    await _store_quiz_result(user_id, assessment_id, document, result_data)

    skill = document["skill"]
    if passed:
        await _mark_task_verified(user_id, document)
        await _save_verified_skill(user_id, skill, score, completed_at)
        title = f"Skill verified: {skill}"
        message = (
            f"You scored {score}% on your {skill} skill check. "
            "The roadmap task is complete and your dashboard now shows this verified skill."
        )
        category = "skill_verified"
    else:
        title = f"Keep learning: {skill}"
        message = (
            f"You scored {score}% on your {skill} skill check. "
            f"Review the roadmap resources and try again; {PASS_THRESHOLD}% is required to pass."
        )
        category = "assessment_retry"
    await _create_alert(user_id, user_email, title, message, category)
    return SkillQuizResult(
        id=assessment_id,
        task_id=document["task_id"],
        skill=skill,
        score=score,
        passed=passed,
        correct_answers=correct_count,
        total_questions=len(questions),
        completed_at=completed_at,
    )


async def get_verified_skills(user_id: str) -> list[VerifiedSkill]:
    """Return skills with a passing assessment for the signed-in user."""
    try:
        cursor = get_db().verified_skills.find({"user_id": ObjectId(user_id)}).sort(
            "verified_at", -1
        )
        docs = await cursor.to_list(length=100)
    except Exception as exc:
        logger.warning("Could not read verified skills (%s); using offline cache", type(exc).__name__)
        docs = _offline_verified.get(user_id, [])
    return [
        VerifiedSkill(
            name=doc["name"], score=doc["score"], verified_at=doc["verified_at"]
        )
        for doc in docs
        if doc.get("name") and doc.get("score", 0) >= PASS_THRESHOLD
    ]


async def get_alerts(user_id: str) -> LearningAlertsResponse:
    """Return recent alerts scoped to the authenticated user."""
    from app.services.study_tracker_service import refresh_missed_alert

    await refresh_missed_alert(user_id)
    try:
        cursor = get_db().learning_alerts.find({"user_id": ObjectId(user_id)}).sort(
            "created_at", -1
        )
        docs = await cursor.to_list(length=50)
    except Exception as exc:
        logger.warning("Could not read learning alerts (%s); using offline cache", type(exc).__name__)
        docs = _offline_alerts.get(user_id, [])[:50]
    alerts = [_alert_response(doc) for doc in docs]
    return LearningAlertsResponse(
        alerts=alerts, unread_count=sum(not alert.is_read for alert in alerts)
    )


async def mark_alert_read(user_id: str, alert_id: str) -> LearningAlert:
    """Mark one alert as read without allowing cross-user access."""
    if not ObjectId.is_valid(alert_id):
        raise HTTPException(status_code=404, detail="Alert not found.")
    oid = ObjectId(alert_id)
    try:
        doc = await get_db().learning_alerts.find_one_and_update(
            {"_id": oid, "user_id": ObjectId(user_id)},
            {"$set": {"is_read": True}},
            return_document=True,
        )
        if doc is not None:
            return _alert_response(doc)
    except Exception as exc:
        logger.warning("Could not update learning alert (%s); checking cache", type(exc).__name__)
    for doc in _offline_alerts.get(user_id, []):
        if doc["_id"] == oid:
            doc["is_read"] = True
            return _alert_response(doc)
    raise HTTPException(status_code=404, detail="Alert not found.")


def _validate_answers(
    questions: list[dict], answers: list[SkillQuizAnswer]
) -> dict[str, int]:
    expected = {question["id"] for question in questions}
    received = [answer.question_id for answer in answers]
    if len(received) != len(set(received)) or set(received) != expected:
        raise HTTPException(
            status_code=422,
            detail="Submit exactly one answer for each assessment question.",
        )
    return {answer.question_id: answer.selected_option for answer in answers}


async def _generate_quiz(context: str) -> tuple[list[_StoredQuestion], str]:
    reply, model = await qwen_chat(
        context,
        system_prompt=_QUIZ_PROMPT,
        temperature=0.2,
        timeout=120,
        extra_body={"enable_thinking": False},
    )
    parsed = _parse_questions(reply)
    if parsed is None:
        reply, model = await qwen_chat(
            context + '\nReturn exactly ten questions in the JSON format specified.',
            system_prompt=_QUIZ_PROMPT,
            temperature=0.2,
            timeout=120,
            extra_body={"enable_thinking": False},
        )
        parsed = _parse_questions(reply)
    if parsed is None:
        raise AIServiceError("AI returned an invalid skill assessment after retry.")
    if [question.id for question in parsed] != [f"q-{i}" for i in range(1, 11)]:
        raise AIServiceError("AI returned questions with invalid assessment IDs.")
    return parsed, model


def _parse_questions(reply: str) -> list[_StoredQuestion] | None:
    text = reply.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```\s*$", "", text)
    if not text.startswith("{"):
        start, end = text.find("{"), text.rfind("}")
        if start < 0 or end <= start:
            return None
        text = text[start : end + 1]
    try:
        question_set = _QuestionSet.model_validate(json.loads(text))
    except (json.JSONDecodeError, ValidationError):
        return None
    if any(len({option.casefold() for option in q.options}) != 4 for q in question_set.questions):
        return None
    return question_set.questions


async def _get_owned_roadmap(user_id: str, roadmap_id: str) -> dict:
    if not ObjectId.is_valid(roadmap_id):
        raise HTTPException(status_code=404, detail="Roadmap not found.")
    user_oid, roadmap_oid = ObjectId(user_id), ObjectId(roadmap_id)
    try:
        doc = await get_db().roadmaps.find_one(
            {"_id": roadmap_oid, "user_id": user_oid}
        )
        if doc is not None:
            return doc
    except Exception as exc:
        logger.warning("Could not read roadmap (%s); checking offline cache", type(exc).__name__)
    from app.services.roadmap_service import _offline_roadmaps

    doc = _offline_roadmaps.get(user_id)
    if doc and doc.get("_id") == roadmap_oid:
        return doc
    raise HTTPException(status_code=404, detail="Roadmap not found.")


async def _get_owned_assessment(user_id: str, assessment_id: str) -> dict | None:
    oid, user_oid = ObjectId(assessment_id), ObjectId(user_id)
    try:
        doc = await get_db().learning_assessments.find_one(
            {"_id": oid, "user_id": user_oid}
        )
        if doc is not None:
            return doc
    except Exception as exc:
        logger.warning("Could not read assessment (%s); checking offline cache", type(exc).__name__)
    doc = _offline_assessments.get(assessment_id)
    return doc if doc and doc.get("user_id") == user_oid else None


async def _store_quiz_result(
    user_id: str, assessment_id: str, document: dict, result_data: dict
) -> None:
    try:
        result = await get_db().learning_assessments.update_one(
            {
                "_id": ObjectId(assessment_id),
                "user_id": ObjectId(user_id),
                "status": "in_progress",
            },
            {"$set": result_data},
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=409, detail="Assessment already submitted.")
    except HTTPException as exc:
        if exc.status_code == 409:
            raise
        logger.warning("Could not save assessment result; using offline cache")
    except Exception as exc:
        logger.warning("Could not save assessment result (%s); using offline cache", type(exc).__name__)
    document.update(result_data)
    _offline_assessments[assessment_id] = document


async def _mark_task_verified(user_id: str, document: dict) -> None:
    roadmap_id, task_id = document["roadmap_id"], document["task_id"]
    try:
        await get_db().roadmaps.update_one(
            {"_id": roadmap_id, "user_id": ObjectId(user_id)},
            {
                "$addToSet": {
                    "completed_tasks": task_id,
                    "verified_tasks": task_id,
                }
            },
        )
    except Exception as exc:
        logger.warning("Could not persist verified roadmap task (%s)", type(exc).__name__)
        from app.services.roadmap_service import _offline_roadmaps

        roadmap = _offline_roadmaps.get(user_id)
        if roadmap and roadmap.get("_id") == roadmap_id:
            for key in ("completed_tasks", "verified_tasks"):
                roadmap.setdefault(key, [])
                if task_id not in roadmap[key]:
                    roadmap[key].append(task_id)


async def _save_verified_skill(
    user_id: str, name: str, score: int, verified_at: datetime
) -> None:
    key = name.casefold()
    doc = {
        "user_id": ObjectId(user_id),
        "skill_key": key,
        "name": name,
        "score": score,
        "verified_at": verified_at,
    }
    try:
        await get_db().verified_skills.update_one(
            {"user_id": ObjectId(user_id), "skill_key": key},
            {"$set": {key: value for key, value in doc.items() if key != "user_id"}},
            upsert=True,
        )
    except Exception as exc:
        logger.warning("Could not persist verified skill (%s); using cache", type(exc).__name__)
        skills = _offline_verified.setdefault(user_id, [])
        skills[:] = [entry for entry in skills if entry["skill_key"] != key]
        skills.append(doc)


async def _create_alert(
    user_id: str, email: str, title: str, message: str, category: str
) -> None:
    doc = {
        "_id": ObjectId(),
        "user_id": ObjectId(user_id),
        "title": title,
        "message": message,
        "category": category,
        "is_read": False,
        "email_status": "not_configured",
        "created_at": datetime.now(timezone.utc),
    }
    try:
        await get_db().learning_alerts.insert_one(doc)
    except Exception as exc:
        logger.warning("Could not persist learning alert (%s); using cache", type(exc).__name__)
        _offline_alerts.setdefault(user_id, []).insert(0, doc)

    if config.SMTP_HOST and config.SMTP_SENDER:
        task = asyncio.create_task(
            _send_alert_email_background(doc["_id"], doc["user_id"], email, title, message)
        )
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)


async def _send_alert_email_background(
    doc_id: ObjectId, user_id: ObjectId, recipient: str, title: str, message: str
) -> None:
    """Non-blocking background email delivery; guarantees credentials are never logged."""
    status = "failed"
    try:
        await asyncio.to_thread(_send_email, recipient, title, message)
        status = "sent"
    except (OSError, smtplib.SMTPException) as exc:
        logger.error("Learning alert email delivery failed (%s)", type(exc).__name__)
    except Exception as exc:
        logger.error("Learning alert email unexpected error (%s)", type(exc).__name__)

    try:
        await get_db().learning_alerts.update_one(
            {"_id": doc_id, "user_id": user_id},
            {"$set": {"email_status": status}},
        )
    except Exception as exc:
        logger.debug("Could not save background email status (%s)", type(exc).__name__)


def _send_email(recipient: str, subject: str, body: str) -> None:
    mail = EmailMessage()
    mail["Subject"] = f"CareerPilot AI: {subject}"
    mail["From"] = config.SMTP_SENDER
    mail["To"] = recipient
    mail.set_content(body)
    with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=10) as smtp:
        if config.SMTP_USE_STARTTLS:
            smtp.starttls(context=ssl.create_default_context())
        if config.SMTP_USERNAME:
            smtp.login(config.SMTP_USERNAME, config.SMTP_PASSWORD)
        smtp.send_message(mail)


def _quiz_response(document: dict) -> SkillQuizResponse:
    return SkillQuizResponse(
        id=str(document["_id"]),
        roadmap_id=str(document["roadmap_id"]),
        task_id=document["task_id"],
        skill=document["skill"],
        questions=[
            SkillQuizQuestion(
                id=question["id"],
                question=question["question"],
                options=question["options"],
            )
            for question in document["questions"]
        ],
    )


def _alert_response(document: dict) -> LearningAlert:
    return LearningAlert(
        id=str(document["_id"]),
        title=document["title"],
        message=document["message"],
        category=document["category"],
        is_read=document.get("is_read", False),
        email_status=document.get("email_status", "not_configured"),
        created_at=document["created_at"],
    )
