"""Roadmap business logic: generate phased learning paths from skill gaps and persist results."""

import json
import logging
import time
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from pydantic import ValidationError

from app.database.mongodb import get_db
from app.schemas.roadmap import (
    RoadmapContent,
    RoadmapRequest,
    RoadmapResponse,
)
from app.services.ai.json_utils import extract_json_block, loads_lenient
from app.services.ai.qwen_service import AIServiceError, chat as qwen_chat

logger = logging.getLogger(__name__)

_ROADMAP_TEMPERATURE = 0.2
_ROADMAP_TIMEOUT = float(120)

# In-memory cache for offline mode (user_id -> latest roadmap document)
_offline_roadmaps: dict[str, dict] = {}

SYSTEM_PROMPT = """\
You are CareerPilot AI, an expert technical career advisor and curriculum architect.
Your mission is to construct a personalized, time-boxed, phased learning roadmap to help a student or early-career professional achieve their target role and close their skill gaps.

STRICT RULES:
- Return ONLY valid JSON. No markdown fences, no explanatory text, no intro/outro.
- The JSON must match this exact schema:
{
  "title": "<Concise roadmap title, e.g. Full-Stack Web Development Roadmap>",
  "target_role": "<Target job role>",
  "total_duration_weeks": <integer, matching the requested time frame>,
  "summary": "<2-3 sentence strategic roadmap summary explaining how this plan bridges the gaps>",
  "phases": [
    {
      "phase_number": <1-indexed integer>,
      "name": "<Phase name, e.g. Phase 1: Core Fundamentals & TypeScript>",
      "duration_weeks": <integer duration in weeks>,
      "focus": "<1-2 sentence core objective of this phase>",
      "tasks": [
        {
          "id": "task-<number, e.g. task-1, task-2>",
          "title": "<Specific task title>",
          "skill": "<The primary skill targeted>",
          "description": "<What needs to be learned and why>",
          "action": "<Hands-on action item, project, or exercise>",
          "resource": "<High-quality recommended documentation, tutorial, or platform, e.g. official docs or MDN>",
          "milestone": "<Concrete deliverable demonstrating mastery, e.g. Build and deploy a typed REST API>",
          "estimated_hours": <realistic integer hours within weekly budget>
        }
      ]
    }
  ]
}
- Break the journey into 2 to 4 logical, sequential phases spanning the total weeks.
- Ensure task IDs are unique (task-1, task-2, task-3, etc.).
- Prioritize high-priority skill gaps in earlier phases.
- Keep task milestones concrete, testable, and portfolio-worthy.
- Respect the user's weekly available hours.
"""


async def generate_roadmap(user_id: str, payload: RoadmapRequest) -> RoadmapResponse:
    """Run Qwen roadmap generation for the supplied request and persist the result."""
    if not payload.target_role.strip():
        raise AIServiceError("Target role is required for roadmap generation")

    content, model = await _call_and_parse(payload)
    now = datetime.now(timezone.utc)

    document = {
        "_id": ObjectId(),
        "user_id": ObjectId(user_id),
        "target_role": payload.target_role.strip(),
        "time_frame_weeks": payload.time_frame_weeks,
        "weekly_hours": payload.weekly_hours,
        "roadmap": content.model_dump(),
        "completed_tasks": [],
        "model": model,
        "created_at": now,
    }

    try:
        db = get_db()
        result = await db.roadmaps.insert_one(document)
        document["_id"] = result.inserted_id
        logger.info("Roadmap saved to MongoDB for user %s", user_id)
    except Exception as exc:
        logger.warning("Could not save roadmap to MongoDB (%s); using in-memory cache", exc)
        _offline_roadmaps[user_id] = document

    return _serialize(document, content)


async def get_latest_roadmap(user_id: str) -> Optional[RoadmapResponse]:
    """Fetch the most recent roadmap for the authenticated user."""
    try:
        db = get_db()
        doc = await db.roadmaps.find_one(
            {"user_id": ObjectId(user_id)}, sort=[("created_at", -1)]
        )
        if doc is not None:
            try:
                content = RoadmapContent.model_validate(doc.get("roadmap", {}))
            except Exception:
                content = RoadmapContent()
            return _serialize(doc, content)
    except Exception as exc:
        logger.debug("Could not fetch roadmap from MongoDB (%s); checking cache", exc)

    if user_id in _offline_roadmaps:
        doc = _offline_roadmaps[user_id]
        try:
            content = RoadmapContent.model_validate(doc.get("roadmap", {}))
        except Exception:
            content = RoadmapContent()
        return _serialize(doc, content)

    return None


async def toggle_task(
    user_id: str, roadmap_id: str, task_id: str, completed: bool
) -> RoadmapResponse:
    """Toggle a task completion status within a roadmap."""
    oid = ObjectId(roadmap_id)
    u_oid = ObjectId(user_id)

    db_updated = False
    doc = None
    try:
        db = get_db()
        if completed:
            doc = await db.roadmaps.find_one_and_update(
                {"_id": oid, "user_id": u_oid},
                {"$addToSet": {"completed_tasks": task_id}},
                return_document=True,
            )
        else:
            doc = await db.roadmaps.find_one_and_update(
                {"_id": oid, "user_id": u_oid},
                {"$pull": {"completed_tasks": task_id}},
                return_document=True,
            )
        if doc:
            db_updated = True
    except Exception as exc:
        logger.warning("MongoDB update failed for roadmap task toggle (%s)", exc)

    if not db_updated:
        # Fall back to in-memory cache
        if user_id in _offline_roadmaps:
            doc = _offline_roadmaps[user_id]
            if str(doc.get("_id")) == roadmap_id:
                completed_list = doc.setdefault("completed_tasks", [])
                if completed and task_id not in completed_list:
                    completed_list.append(task_id)
                elif not completed and task_id in completed_list:
                    completed_list.remove(task_id)

    if not doc:
        raise AIServiceError("Roadmap not found or unauthorized")

    try:
        content = RoadmapContent.model_validate(doc.get("roadmap", {}))
    except Exception:
        content = RoadmapContent()

    return _serialize(doc, content)


async def _call_and_parse(payload: RoadmapRequest) -> tuple[RoadmapContent, str]:
    """Call Qwen, extract JSON, validate against schema, retry once if needed."""
    gaps_str = ", ".join(payload.skill_gaps) if payload.skill_gaps else "None specified (focus on core competencies)"
    exp_str = payload.experience_level or "Student / Early Career"
    ctx_str = payload.additional_context or "Standard industry readiness"

    user_message = (
        f"Target Role: {payload.target_role.strip()}\n"
        f"Skill Gaps to Address: {gaps_str}\n"
        f"Experience Level: {exp_str}\n"
        f"Timeframe: {payload.time_frame_weeks} weeks\n"
        f"Weekly Study Budget: {payload.weekly_hours} hours/week\n"
        f"Additional Context / Goals: {ctx_str}"
    )

    t0 = time.monotonic()
    content, model = await _call_and_validate(user_message)
    if content is not None:
        logger.info("Qwen roadmap generation succeeded in %.1fs (model=%s)", time.monotonic() - t0, model)
        return content, model

    logger.warning("Roadmap validation failed on first attempt; retrying with corrective prompt")
    corrective = (
        user_message
        + "\n\nIMPORTANT: Your previous response was not valid JSON matching the schema. Return ONLY valid JSON."
    )
    content, model = await _call_and_validate(corrective)
    if content is None:
        raise AIServiceError("AI returned an unparseable roadmap after retry")

    return content, model


async def _call_and_validate(user_message: str) -> tuple[RoadmapContent | None, str]:
    """Call Qwen and validate response against RoadmapContent schema."""
    try:
        reply, model = await qwen_chat(
            user_message,
            system_prompt=SYSTEM_PROMPT,
            temperature=_ROADMAP_TEMPERATURE,
            timeout=_ROADMAP_TIMEOUT,
            extra_body={"enable_thinking": False},
        )
    except AIServiceError:
        raise

    raw_json = extract_json_block(reply)
    if raw_json is None:
        logger.warning("Could not extract JSON from Qwen response: %s", reply[:200])
        return None, model

    try:
        # Lenient parse tolerates control characters inside strings (json_utils).
        data = loads_lenient(raw_json)
    except json.JSONDecodeError as exc:
        logger.warning("Roadmap JSON parse error: %s — snippet: %s", exc, raw_json[:200])
        return None, model

    try:
        content = RoadmapContent.model_validate(data)
    except ValidationError as exc:
        logger.warning("Roadmap schema validation failed: %s", exc)
        return None, model

    return content, model


def _serialize(doc: dict, content: RoadmapContent) -> RoadmapResponse:
    return RoadmapResponse(
        id=str(doc["_id"]),
        user_id=str(doc["user_id"]),
        target_role=doc.get("target_role", ""),
        time_frame_weeks=doc.get("time_frame_weeks", 8),
        weekly_hours=doc.get("weekly_hours", 10),
        roadmap=content,
        completed_tasks=doc.get("completed_tasks", []),
        created_at=doc.get("created_at", datetime.now(timezone.utc)),
    )
