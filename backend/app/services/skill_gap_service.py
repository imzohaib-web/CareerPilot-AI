"""Skill gap business logic: compare resume skills to target role and persist results."""

import json
import logging
import re
import time
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from pydantic import ValidationError

from app.database.mongodb import get_db
from app.schemas.skill_gap import SkillGapAnalysis, SkillGapRequest, SkillGapResponse
from app.services.ai.qwen_service import AIServiceError, chat as qwen_chat

logger = logging.getLogger(__name__)

_SKILL_GAP_TEMPERATURE = 0.2
_SKILL_GAP_TIMEOUT = float(120)

# In-memory cache for offline mode (user_id -> latest analysis)
_offline_cache: dict[str, dict] = {}

SYSTEM_PROMPT = """\
You are CareerPilot AI, a senior career analyst for students and early-career professionals.
Compare the user's current skills against the target job requirements and identify the most important missing capabilities.

STRICT RULES:
- Return ONLY valid JSON. No markdown fences, no commentary, no extra text.
- Base the analysis on the provided resume data and the target job description.
- Be realistic and honest. Do not invent skills the user does not show evidence for.
- Prioritize the most relevant missing skills, especially technical gaps and role-critical soft skills.
- The JSON must match this exact schema:
{
  "summary": "<2-3 sentence overall assessment>",
  "missing_technical_skills": ["<skill 1>", "<skill 2>"],
  "missing_soft_skills": ["<soft skill 1>", "<soft skill 2>"],
  "required_proficiencies": [
    {"area": "<e.g. backend, frontend, data, cloud, communication>", "skills": ["<skill 1>", "<skill 2>"]}
  ],
  "match_score": <integer 0-100>
}
- Set match_score to a realistic percentage reflecting readiness for the target role.
- Keep lists concise and prioritized, not bloated.
"""


async def analyze_gap(user_id: str, payload: SkillGapRequest) -> SkillGapResponse:
    """Run Qwen analysis for the supplied resume data and target role, then save it."""
    if not payload.resume_data.strip():
        raise AIServiceError("Resume data is required for skill gap analysis")
    if not payload.target_role.strip():
        raise AIServiceError("Target role is required")
    if not payload.target_job_description.strip():
        raise AIServiceError("Target job description is required")

    analysis, model = await _call_and_parse(payload)
    now = datetime.now(timezone.utc)

    document = {
        "_id": ObjectId(),
        "user_id": ObjectId(user_id),
        "target_role": payload.target_role.strip(),
        "target_job_description": payload.target_job_description.strip(),
        "analysis": analysis.model_dump(),
        "model": model,
        "created_at": now,
    }

    # Try to save to database; fall back to in-memory cache on offline
    try:
        db = get_db()
        result = await db.skill_gap_analyses.insert_one(document)
        document["_id"] = result.inserted_id
        logger.info("Skill gap analysis saved to MongoDB for user %s", user_id)
    except Exception as exc:
        logger.warning("Could not save to MongoDB (%s); using in-memory cache", exc)
        _offline_cache[user_id] = document

    return _serialize(document, analysis)


async def get_latest_gap(user_id: str) -> Optional[SkillGapResponse]:
    """Fetch the most recent skill gap analysis for the authenticated user."""
    # Try database first
    try:
        db = get_db()
        doc = await db.skill_gap_analyses.find_one(
            {"user_id": ObjectId(user_id)}, sort=[("created_at", -1)]
        )
        if doc is not None:
            try:
                analysis = SkillGapAnalysis.model_validate(doc.get("analysis", {}))
            except Exception:
                analysis = SkillGapAnalysis()
            return _serialize(doc, analysis)
    except Exception as exc:
        logger.debug("Could not fetch from MongoDB (%s); checking cache", exc)

    # Fall back to in-memory cache
    if user_id in _offline_cache:
        doc = _offline_cache[user_id]
        try:
            analysis = SkillGapAnalysis.model_validate(doc.get("analysis", {}))
        except Exception:
            analysis = SkillGapAnalysis()
        return _serialize(doc, analysis)

    return None


async def _call_and_parse(payload: SkillGapRequest) -> tuple[SkillGapAnalysis, str]:
    """Call Qwen, extract JSON, validate the schema, and return the analysis."""
    user_message = (
        "Resume data:\n"
        f"{payload.resume_data.strip()}\n\n"
        "Target role:\n"
        f"{payload.target_role.strip()}\n\n"
        "Target job description:\n"
        f"{payload.target_job_description.strip()}"
    )

    t0 = time.monotonic()
    analysis, model = await _call_and_validate(user_message)
    if analysis is not None:
        logger.info("Qwen skill gap analysis succeeded in %.1fs (model=%s)", time.monotonic() - t0, model)
        return analysis, model

    logger.warning("Skill gap validation failed on first attempt; retrying with corrective prompt")
    corrective = (
        user_message
        + "\n\nIMPORTANT: Your previous response was not valid JSON. Return ONLY the JSON object described in the schema."
    )
    analysis, model = await _call_and_validate(corrective)
    if analysis is None:
        raise AIServiceError("AI returned an unparseable skill gap analysis after retry")

    return analysis, model


async def _call_and_validate(user_message: str) -> tuple[SkillGapAnalysis | None, str]:
    """Call Qwen and validate the response against the skill-gap schema."""
    try:
        reply, model = await qwen_chat(
            user_message,
            system_prompt=SYSTEM_PROMPT,
            temperature=_SKILL_GAP_TEMPERATURE,
            timeout=_SKILL_GAP_TIMEOUT,
            extra_body={"enable_thinking": False},
        )
    except AIServiceError:
        raise

    raw_json = _extract_json(reply)
    if raw_json is None:
        logger.warning("Could not extract JSON from Qwen response: %s", reply[:200])
        return None, model

    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError as exc:
        logger.warning("Skill gap JSON parse error: %s — snippet: %s", exc, raw_json[:200])
        return None, model

    try:
        analysis = SkillGapAnalysis.model_validate(data)
    except ValidationError as exc:
        logger.warning("Skill gap schema validation failed: %s", exc)
        return None, model

    return analysis, model


def _extract_json(text: str) -> str | None:
    """Extract the first JSON object from text, tolerating code fences."""
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*", "", stripped)
        stripped = re.sub(r"\s*```\s*$", "", stripped)

    if stripped.startswith("{"):
        return stripped

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start : end + 1]
    return None


def _serialize(doc: dict, analysis: SkillGapAnalysis) -> SkillGapResponse:
    return SkillGapResponse(
        id=str(doc["_id"]),
        user_id=str(doc["user_id"]),
        target_role=doc.get("target_role", ""),
        target_job_description=doc.get("target_job_description", ""),
        analysis=analysis,
        created_at=doc.get("created_at", datetime.now(timezone.utc)),
    )
