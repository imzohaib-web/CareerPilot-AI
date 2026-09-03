"""AI Mock Interview service: generate role-specific questions and evaluate candidate answers."""

import json
import logging
import re
import time
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from pydantic import BaseModel, Field, ValidationError

from app.database.mongodb import get_db
from app.schemas.interview import (
    InterviewFeedback,
    InterviewQuestion,
    InterviewResponse,
    InterviewStartRequest,
    InterviewSubmitRequest,
    QuestionEvaluation,
    UserAnswer,
)
from app.services.ai.qwen_service import AIServiceError, chat as qwen_chat

logger = logging.getLogger(__name__)

_INTERVIEW_TEMPERATURE = 0.3
_INTERVIEW_TIMEOUT = float(120)

# In-memory cache for offline mode (interview_id -> interview document)
_offline_interviews: dict[str, dict] = {}


class _QuestionListWrapper(BaseModel):
    questions: list[InterviewQuestion] = Field(default_factory=list)


QUESTION_SYSTEM_PROMPT = """\
You are an expert technical interviewer and hiring manager at a top tech company.
Generate realistic, high-yield interview questions tailored to the candidate's target role, experience level, and focus skills.

STRICT RULES:
- Return ONLY valid JSON. No markdown fences, no explanatory text.
- Balance technical concepts and behavioral/situational questions.
- Provide a helpful hint for each question (e.g. suggesting the STAR method: Situation, Task, Action, Result for behavioral questions).
- The JSON must match this exact schema:
{
  "questions": [
    {
      "id": "q-1",
      "question": "<The question to ask the candidate>",
      "category": "<technical | behavioral | situational>",
      "hint": "<Actionable tip or STAR suggestion to guide the candidate's answer>"
    }
  ]
}
- Question IDs must be sequential: q-1, q-2, q-3, etc.
- Match question difficulty directly to candidate's experience level.
"""

EVALUATION_SYSTEM_PROMPT = """\
You are an expert interview coach and senior evaluator.
Evaluate the candidate's answers to the interview questions.

STRICT RULES:
- Return ONLY valid JSON. No markdown fences, no explanatory text.
- For behavioral/situational questions, evaluate if the candidate used the STAR framework (Situation, Task, Action, Result).
- For technical questions, evaluate technical accuracy, depth, clarity, and trade-offs.
- Score each question objectively from 0 to 100 based on completeness and relevance.
- Provide constructive strengths, clear improvement points, and a concise "ideal_answer" benchmark for each question.
- Calculate an honest overall_score (0-100) reflecting candidate job readiness.
- The JSON must match this exact schema:
{
  "overall_score": <integer 0-100>,
  "summary": "<2-3 sentence overall assessment of performance, communication, and readiness>",
  "evaluations": [
    {
      "question_id": "<matching question id, e.g. q-1>",
      "score": <integer 0-100>,
      "strengths": ["<strength 1>", "<strength 2>"],
      "improvements": ["<improvement 1>", "<improvement 2>"],
      "ideal_answer": "<2-3 sentence model answer demonstrating best practices>"
    }
  ],
  "recommended_actions": [
    "<actionable suggestion 1>",
    "<actionable suggestion 2>"
  ]
}
"""


async def start_interview(
    user_id: str, payload: InterviewStartRequest
) -> InterviewResponse:
    """Generate interview questions using Qwen and initialize an interview session."""
    if not payload.target_role.strip():
        raise AIServiceError("Target role is required for interview generation")

    skills_str = (
        ", ".join(payload.focus_skills)
        if payload.focus_skills
        else "Standard core competencies for this role"
    )
    user_message = (
        f"Target Role: {payload.target_role.strip()}\n"
        f"Experience Level: {payload.experience_level or 'Student / Early Career'}\n"
        f"Number of Questions: {payload.question_count}\n"
        f"Focus Skills / Topics: {skills_str}"
    )

    questions, model = await _generate_questions(user_message)
    now = datetime.now(timezone.utc)

    doc_id = ObjectId()
    document = {
        "_id": doc_id,
        "user_id": ObjectId(user_id),
        "target_role": payload.target_role.strip(),
        "experience_level": payload.experience_level or "student",
        "questions": [q.model_dump() for q in questions],
        "answers": [],
        "feedback": None,
        "status": "in_progress",
        "model": model,
        "created_at": now,
        "completed_at": None,
    }

    try:
        db = get_db()
        await db.interviews.insert_one(document)
        logger.info("Interview session created in MongoDB for user %s", user_id)
    except Exception as exc:
        logger.warning("Could not save interview to MongoDB (%s); using in-memory cache", exc)
        _offline_interviews[str(doc_id)] = document

    return _serialize(document)


async def submit_interview(
    user_id: str, interview_id: str, payload: InterviewSubmitRequest
) -> InterviewResponse:
    """Evaluate candidate answers using Qwen and record the scored feedback."""
    doc = await _fetch_raw_interview(user_id, interview_id)
    if doc is None:
        raise AIServiceError("Interview session not found")

    questions_map = {q["id"]: q for q in doc.get("questions", [])}
    answers_map = {a.question_id: a.answer for a in payload.answers}

    # Format evaluation prompt
    eval_text_parts = [f"Target Role: {doc.get('target_role')}\nCandidate Responses:\n"]
    for q_id, q_data in questions_map.items():
        ans_text = answers_map.get(q_id, "").strip() or "(No answer provided)"
        eval_text_parts.append(
            f"Question ID: {q_id}\n"
            f"Category: {q_data.get('category')}\n"
            f"Question: {q_data.get('question')}\n"
            f"Candidate Answer: {ans_text}\n"
        )

    user_eval_message = "\n".join(eval_text_parts)
    feedback, model = await _evaluate_answers(user_eval_message)

    now = datetime.now(timezone.utc)
    answers_data = [a.model_dump() for a in payload.answers]
    feedback_data = feedback.model_dump()

    db_updated = False
    try:
        db = get_db()
        updated_doc = await db.interviews.find_one_and_update(
            {"_id": ObjectId(interview_id), "user_id": ObjectId(user_id)},
            {
                "$set": {
                    "answers": answers_data,
                    "feedback": feedback_data,
                    "status": "completed",
                    "completed_at": now,
                }
            },
            return_document=True,
        )
        if updated_doc:
            doc = updated_doc
            db_updated = True
    except Exception as exc:
        logger.warning("Could not update interview in MongoDB (%s); using in-memory cache", exc)

    if not db_updated:
        doc["answers"] = answers_data
        doc["feedback"] = feedback_data
        doc["status"] = "completed"
        doc["completed_at"] = now
        _offline_interviews[interview_id] = doc

    return _serialize(doc)


async def get_latest_interview(user_id: str) -> Optional[InterviewResponse]:
    """Fetch the most recent mock interview for the authenticated user."""
    try:
        db = get_db()
        doc = await db.interviews.find_one(
            {"user_id": ObjectId(user_id)}, sort=[("created_at", -1)]
        )
        if doc is not None:
            return _serialize(doc)
    except Exception as exc:
        logger.debug("Could not fetch interview from MongoDB (%s); checking cache", exc)

    # Search in-memory cache
    matching = [
        d for d in _offline_interviews.values() if str(d.get("user_id")) == user_id
    ]
    if matching:
        matching.sort(key=lambda x: x.get("created_at", datetime.min), reverse=True)
        return _serialize(matching[0])

    return None


async def get_interview_by_id(
    user_id: str, interview_id: str
) -> Optional[InterviewResponse]:
    """Fetch a specific interview session by ID."""
    doc = await _fetch_raw_interview(user_id, interview_id)
    if doc:
        return _serialize(doc)
    return None


async def _fetch_raw_interview(user_id: str, interview_id: str) -> Optional[dict]:
    """Fetch raw interview document from MongoDB or offline cache."""
    try:
        db = get_db()
        doc = await db.interviews.find_one(
            {"_id": ObjectId(interview_id), "user_id": ObjectId(user_id)}
        )
        if doc is not None:
            return doc
    except Exception as exc:
        logger.debug("MongoDB fetch error for interview (%s); checking cache", exc)

    if interview_id in _offline_interviews:
        cached = _offline_interviews[interview_id]
        if str(cached.get("user_id")) == user_id:
            return cached

    return None


async def _generate_questions(
    user_message: str,
) -> tuple[list[InterviewQuestion], str]:
    """Call Qwen to generate questions and parse into InterviewQuestion list."""
    t0 = time.monotonic()
    reply, model = await qwen_chat(
        user_message,
        system_prompt=QUESTION_SYSTEM_PROMPT,
        temperature=_INTERVIEW_TEMPERATURE,
        timeout=_INTERVIEW_TIMEOUT,
        extra_body={"enable_thinking": False},
    )

    questions = _parse_questions(reply)
    if questions:
        logger.info(
            "Generated %d interview questions in %.1fs (model=%s)",
            len(questions),
            time.monotonic() - t0,
            model,
        )
        return questions, model

    # Retry once
    logger.warning("Question parsing failed; retrying with corrective prompt")
    corrective = (
        user_message
        + "\n\nIMPORTANT: Return ONLY valid JSON matching the schema: {\"questions\": [...]}. No extra text."
    )
    reply, model = await qwen_chat(
        corrective,
        system_prompt=QUESTION_SYSTEM_PROMPT,
        temperature=_INTERVIEW_TEMPERATURE,
        timeout=_INTERVIEW_TIMEOUT,
        extra_body={"enable_thinking": False},
    )
    questions = _parse_questions(reply)
    if not questions:
        raise AIServiceError("AI returned an unparseable question set after retry")

    return questions, model


def _parse_questions(text: str) -> list[InterviewQuestion] | None:
    """Extract and validate questions list from AI output."""
    raw_json = _extract_json(text)
    if not raw_json:
        return None
    try:
        data = json.loads(raw_json)
        if isinstance(data, list):
            data = {"questions": data}
        wrapper = _QuestionListWrapper.model_validate(data)
        return wrapper.questions if wrapper.questions else None
    except Exception as exc:
        logger.warning("Failed to parse interview questions: %s", exc)
        return None


async def _evaluate_answers(
    user_message: str,
) -> tuple[InterviewFeedback, str]:
    """Call Qwen to evaluate answers and validate against InterviewFeedback schema."""
    t0 = time.monotonic()
    reply, model = await qwen_chat(
        user_message,
        system_prompt=EVALUATION_SYSTEM_PROMPT,
        temperature=_INTERVIEW_TEMPERATURE,
        timeout=_INTERVIEW_TIMEOUT,
        extra_body={"enable_thinking": False},
    )

    feedback = _parse_feedback(reply)
    if feedback:
        logger.info(
            "Evaluated interview answers in %.1fs (score=%d, model=%s)",
            time.monotonic() - t0,
            feedback.overall_score,
            model,
        )
        return feedback, model

    # Retry once
    logger.warning("Feedback parsing failed; retrying with corrective prompt")
    corrective = (
        user_message
        + "\n\nIMPORTANT: Return ONLY valid JSON matching the schema with overall_score and evaluations array."
    )
    reply, model = await qwen_chat(
        corrective,
        system_prompt=EVALUATION_SYSTEM_PROMPT,
        temperature=_INTERVIEW_TEMPERATURE,
        timeout=_INTERVIEW_TIMEOUT,
        extra_body={"enable_thinking": False},
    )
    feedback = _parse_feedback(reply)
    if not feedback:
        raise AIServiceError("AI returned an unparseable interview evaluation after retry")

    return feedback, model


def _parse_feedback(text: str) -> InterviewFeedback | None:
    """Extract and validate InterviewFeedback from AI output."""
    raw_json = _extract_json(text)
    if not raw_json:
        return None
    try:
        data = json.loads(raw_json)
        return InterviewFeedback.model_validate(data)
    except Exception as exc:
        logger.warning("Failed to parse interview feedback: %s", exc)
        return None


def _extract_json(text: str) -> str | None:
    """Extract JSON from text, tolerating markdown fences."""
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*", "", stripped)
        stripped = re.sub(r"\s*```\s*$", "", stripped)

    if stripped.startswith("{") or stripped.startswith("["):
        return stripped

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start : end + 1]
    return None


def _serialize(doc: dict) -> InterviewResponse:
    """Convert raw MongoDB or cache doc to InterviewResponse."""
    feedback_data = doc.get("feedback")
    feedback = None
    if feedback_data:
        try:
            feedback = InterviewFeedback.model_validate(feedback_data)
        except Exception:
            feedback = None

    raw_questions = doc.get("questions", [])
    questions = []
    for q in raw_questions:
        try:
            questions.append(InterviewQuestion.model_validate(q))
        except Exception:
            pass

    raw_answers = doc.get("answers", [])
    answers = []
    for a in raw_answers:
        try:
            answers.append(UserAnswer.model_validate(a))
        except Exception:
            pass

    return InterviewResponse(
        id=str(doc["_id"]),
        user_id=str(doc["user_id"]),
        target_role=doc.get("target_role", ""),
        experience_level=doc.get("experience_level", ""),
        questions=questions,
        answers=answers,
        feedback=feedback,
        status=doc.get("status", "in_progress"),
        created_at=doc.get("created_at", datetime.now(timezone.utc)),
        completed_at=doc.get("completed_at"),
    )
