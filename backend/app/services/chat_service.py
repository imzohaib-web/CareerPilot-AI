"""Career Mentor chat business logic.

Orchestrates one mentor turn for an authenticated user:

  load conversation + grounding context → ask the mentor
  (``app/services/ai``) → persist both messages.

Ownership is always derived from the JWT user id — client-supplied
conversation ids are only ever used as a lookup hint validated against the
authenticated user.

Conversation shape (docs/DATABASE_SCHEMA.md):

  conversations: {user_id, messages: [{role, content, ts}],
                  created_at, updated_at}
"""

import asyncio
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
import json
import logging

from bson import ObjectId
from fastapi import Request

from app import config
from app.database.mongodb import get_db
from app.schemas.chat import ChatMessage, MentorChatResponse, MentorHistoryResponse
from app.schemas.resume import ResumeAnalysis
from app.services.ai.career_mentor import ask_mentor, stream_mentor
from app.services.ai.qwen_service import AIConfigurationError, AIServiceError

logger = logging.getLogger(__name__)

# ── Public exceptions ─────────────────────────────────────────────────────


class ChatValidationError(Exception):
    """Client-fixable request problem (user-safe message)."""


class ConversationNotFoundError(Exception):
    """The referenced conversation does not exist for this user."""


class ChatPersistenceError(Exception):
    """Conversation storage failure (user-safe message)."""


# ── Context strategy (docs/AI_ARCHITECTURE.md — bounded prompts) ──────────

# Conversation turns replayed to the model (most recent kept).
_HISTORY_MAX_TURNS = 16
# Total character budget for replayed history; older turns drop first.
_HISTORY_MAX_CHARS = 24_000
# Hard cap on messages kept per conversation document.
_MAX_STORED_MESSAGES = 100
# Cap on a single stored message's content (chars).
_MAX_STORED_CONTENT_CHARS = 10_000

_VALID_ROLES = ("user", "assistant")


# ── Public API ────────────────────────────────────────────────────────────


async def send_message(
    user_id: str, message: str, conversation_id: str | None
) -> MentorChatResponse:
    """Process one mentor turn: ground → ask → persist.

    Raises ``ChatValidationError`` (malformed conversation id),
    ``ConversationNotFoundError`` (id not owned by this user),
    ``AIServiceError`` (Qwen failure — the route maps this to 502), or
    ``ChatPersistenceError`` (MongoDB write failure).
    """
    oid = ObjectId(user_id)

    conversation_doc, profile_doc, resume_doc = await asyncio.gather(
        _resolve_conversation(oid, conversation_id),
        _fetch_profile(oid),
        _fetch_latest_resume(oid),
    )

    resume = _parse_resume_analysis(resume_doc)
    history = _build_model_history(conversation_doc)

    citations = []
    rag_sources = []
    try:
        from app.services import rag_service
        target_role = (profile_doc.get("target_role") if profile_doc else None) or None
        chunks = await rag_service.retrieve_for_mentor(
            message=message,
            role=target_role,
            top_k=3,
            user_id=str(oid),
            db=get_db(),
        )
        if chunks:
            rag_sources = chunks
            citations = [
                rag_service.chunk_to_citation(c, idx)
                for idx, c in enumerate(chunks, 1)
            ]
    except Exception as exc:
        logger.warning("RAG retrieval for mentor chat failed gracefully (%s)", exc)
        rag_sources = []
        citations = []

    reply, model = await ask_mentor(message, profile_doc, resume, history, sources=rag_sources)

    # Post-validate citations if the model used bracket references e.g. [1]
    if rag_sources and citations:
        try:
            from app.services.rag_service import parse_and_validate_citations
            cleaned_reply, validated_cites = parse_and_validate_citations(reply, rag_sources)
            if validated_cites:
                reply = cleaned_reply
                citations = validated_cites
        except Exception:
            pass

    # Persist both messages atomically and return the (possibly truncated)
    # stored content so the client and the stored history stay consistent.
    stored_reply = reply[:_MAX_STORED_CONTENT_CHARS]
    now = datetime.now(timezone.utc)
    new_messages = [
        {"role": "user", "content": message, "ts": now},
        {"role": "assistant", "content": stored_reply, "ts": now},
    ]

    if conversation_doc is None:
        conv_id = await _create_conversation(oid, new_messages)
    else:
        await _append_messages(conversation_doc["_id"], new_messages)
        conv_id = str(conversation_doc["_id"])

    return MentorChatResponse(
        conversation_id=conv_id,
        message=ChatMessage(role="assistant", content=stored_reply, created_at=now),
        model=model,
        citations=citations,
    )


async def stream_message(
    user_id: str,
    message: str,
    conversation_id: str | None,
    request: Request | None = None,
) -> AsyncGenerator[str, None]:
    """Process one mentor turn with token streaming and SSE event framing.

    SSE Protocol:
      - {"type":"start", "conversation_id":"..."}
      - {"type":"delta", "text":"..."} (many)
      - {"type":"done", ...final payload matching MentorChatResponse}
      - {"type":"error", "message":"...", "code":"..."} (terminal)
      - ": ping" heartbeat line every 15s before first token.

    Atomically persists conversation turn ONLY after the stream completes successfully.
    If the stream fails or client disconnects, nothing is persisted.
    """
    try:
        oid = ObjectId(user_id)
    except Exception:
        yield f"data: {json.dumps({'type': 'error', 'message': 'Invalid user ID', 'code': 'VALIDATION_ERROR'})}\n\n"
        return

    try:
        conversation_doc, profile_doc, resume_doc = await asyncio.gather(
            _resolve_conversation(oid, conversation_id),
            _fetch_profile(oid),
            _fetch_latest_resume(oid),
        )
    except ChatValidationError as exc:
        yield f"data: {json.dumps({'type': 'error', 'message': str(exc), 'code': 'VALIDATION_ERROR'})}\n\n"
        return
    except ConversationNotFoundError:
        yield f"data: {json.dumps({'type': 'error', 'message': 'Conversation not found', 'code': 'NOT_FOUND'})}\n\n"
        return
    except Exception as exc:
        logger.error("Failed to resolve chat context for stream: %s", exc)
        yield f"data: {json.dumps({'type': 'error', 'message': 'Failed to initialize conversation', 'code': 'INTERNAL_ERROR'})}\n\n"
        return

    if conversation_doc is not None:
        target_conv_oid = conversation_doc["_id"]
        conv_id = str(target_conv_oid)
        is_new_conv = False
    else:
        target_conv_oid = ObjectId()
        conv_id = str(target_conv_oid)
        is_new_conv = True

    # Emit start event
    yield f"data: {json.dumps({'type': 'start', 'conversation_id': conv_id})}\n\n"

    resume = _parse_resume_analysis(resume_doc)
    history = _build_model_history(conversation_doc)

    citations = []
    rag_sources = []
    try:
        from app.services import rag_service
        target_role = (profile_doc.get("target_role") if profile_doc else None) or None
        chunks = await rag_service.retrieve_for_mentor(
            message=message,
            role=target_role,
            top_k=3,
            user_id=str(oid),
            db=get_db(),
        )
        if chunks:
            rag_sources = chunks
            citations = [
                rag_service.chunk_to_citation(c, idx)
                for idx, c in enumerate(chunks, 1)
            ]
    except Exception as exc:
        logger.warning("RAG retrieval for mentor stream failed gracefully (%s)", exc)
        rag_sources = []
        citations = []

    accumulated_deltas: list[str] = []

    try:
        stream_gen = stream_mentor(
            user_message=message,
            profile=profile_doc,
            resume=resume,
            history=history,
            sources=rag_sources,
        )

        # Pull first token with heartbeat pings
        token_task = asyncio.create_task(stream_gen.__anext__())
        has_first_token = False
        first_delta = None
        while not has_first_token:
            if request and await request.is_disconnected():
                token_task.cancel()
                logger.info("Client disconnected before first token received in mentor stream")
                return

            done, _ = await asyncio.wait(
                [token_task], timeout=config.STREAMING_HEARTBEAT_INTERVAL
            )
            if done:
                has_first_token = True
                try:
                    first_delta = token_task.result()
                except StopAsyncIteration:
                    first_delta = None
            else:
                yield ": ping\n\n"

        if first_delta:
            accumulated_deltas.append(first_delta)
            yield f"data: {json.dumps({'type': 'delta', 'text': first_delta})}\n\n"

        async for delta in stream_gen:
            if request and await request.is_disconnected():
                logger.info("Client disconnected during mentor stream; aborting without persistence")
                return
            accumulated_deltas.append(delta)
            yield f"data: {json.dumps({'type': 'delta', 'text': delta})}\n\n"

    except AIConfigurationError as exc:
        logger.error("AI configuration error in mentor stream: %s", exc)
        yield f"data: {json.dumps({'type': 'error', 'message': str(exc), 'code': 'AI_NOT_CONFIGURED'})}\n\n"
        return
    except AIServiceError as exc:
        logger.error("AI provider error in mentor stream: %s", exc)
        yield f"data: {json.dumps({'type': 'error', 'message': str(exc), 'code': 'AI_PROVIDER_ERROR'})}\n\n"
        return
    except asyncio.CancelledError:
        logger.info("Mentor stream cancelled; aborting without persistence")
        return
    except Exception as exc:
        logger.exception("Unexpected error during mentor stream: %s", exc)
        yield f"data: {json.dumps({'type': 'error', 'message': 'An unexpected error occurred during streaming', 'code': 'STREAMING_ERROR'})}\n\n"
        return

    full_reply = "".join(accumulated_deltas)
    if rag_sources and citations:
        try:
            from app.services.rag_service import parse_and_validate_citations
            cleaned_reply, validated_cites = parse_and_validate_citations(full_reply, rag_sources)
            if validated_cites:
                full_reply = cleaned_reply
                citations = validated_cites
        except Exception:
            pass

    stored_reply = full_reply[:_MAX_STORED_CONTENT_CHARS]
    now = datetime.now(timezone.utc)
    new_messages = [
        {"role": "user", "content": message, "ts": now},
        {"role": "assistant", "content": stored_reply, "ts": now},
    ]

    try:
        if is_new_conv:
            await _create_conversation(oid, new_messages, custom_id=target_conv_oid)
        else:
            await _append_messages(target_conv_oid, new_messages)
    except Exception as exc:
        logger.error("Persistence failed after mentor stream completed: %s", exc)
        yield f"data: {json.dumps({'type': 'error', 'message': 'Failed to save the conversation.', 'code': 'PERSISTENCE_ERROR'})}\n\n"
        return

    done_payload = {
        "type": "done",
        "conversation_id": conv_id,
        "message": {
            "role": "assistant",
            "content": stored_reply,
            "created_at": now.isoformat(),
        },
        "model": config.QWEN_MODEL,
        "citations": [
            c.model_dump() if hasattr(c, "model_dump") else c
            for c in citations
        ],
    }
    yield f"data: {json.dumps(done_payload)}\n\n"


async def get_history(
    user_id: str, conversation_id: str | None
) -> MentorHistoryResponse:
    """Return the user's mentor conversation (latest when no id given)."""
    conversation_doc = await _resolve_conversation(
        ObjectId(user_id), conversation_id
    )
    if conversation_doc is None:
        return MentorHistoryResponse()

    messages = []
    for raw in conversation_doc.get("messages", []):
        parsed = _parse_stored_message(raw)
        if parsed is not None:
            messages.append(parsed)

    return MentorHistoryResponse(
        conversation_id=str(conversation_doc["_id"]),
        messages=messages,
        created_at=conversation_doc.get("created_at"),
        updated_at=conversation_doc.get("updated_at"),
    )


# ── Conversation resolution ───────────────────────────────────────────────


async def _resolve_conversation(
    user_id: ObjectId, conversation_id: str | None
) -> dict | None:
    """Find the conversation to operate on, scoped to *user_id*.

    - ``conversation_id`` given → must be a valid ObjectId owned by this
      user, otherwise ``ConversationNotFoundError`` (no information leak
      about other users' conversations).
    - ``conversation_id`` omitted → the user's most recent conversation,
      or None (a new one is created on the next message).
    """
    if conversation_id is not None:
        if not _is_valid_object_id(conversation_id):
            raise ChatValidationError("Invalid conversation id")
        query = {"_id": ObjectId(conversation_id), "user_id": user_id}
        doc = await get_db().conversations.find_one(query)
        if doc is None:
            raise ConversationNotFoundError("Conversation not found")
        return doc

    return await get_db().conversations.find_one(
        {"user_id": user_id}, sort=[("updated_at", -1)]
    )


def _is_valid_object_id(value: str) -> bool:
    try:
        ObjectId(value)
        return True
    except Exception:
        return False


# ── Grounding context ─────────────────────────────────────────────────────


async def _fetch_profile(user_id: ObjectId) -> dict | None:
    """Fetch the user's career profile document, or None."""
    return await get_db().career_profiles.find_one({"user_id": user_id})


async def _fetch_latest_resume(user_id: ObjectId) -> dict | None:
    """Fetch the user's most recent resume analysis document, or None."""
    return await get_db().resumes.find_one(
        {"user_id": user_id}, sort=[("analyzed_at", -1)]
    )


def _parse_resume_analysis(doc: dict | None) -> ResumeAnalysis | None:
    """Validate the stored analysis sub-document.

    A corrupt stored analysis is treated as "no resume context" rather than
    feeding the mentor misleading defaults (e.g. a phantom score of 0).
    """
    if doc is None:
        return None
    try:
        return ResumeAnalysis.model_validate(doc.get("analysis", {}))
    except Exception:
        logger.warning("Stored resume analysis failed validation; treating as absent")
        return None


# ── History handling ──────────────────────────────────────────────────────


def _build_model_history(conversation_doc: dict | None) -> list[dict[str, str]]:
    """Build the bounded conversation history for the model call.

    Walks newest → oldest, keeping at most ``_HISTORY_MAX_TURNS`` turns
    within ``_HISTORY_MAX_CHARS`` total characters, then restores
    chronological order.  Malformed stored messages are skipped.
    """
    if conversation_doc is None:
        return []

    kept: list[dict[str, str]] = []
    total_chars = 0
    for raw in reversed(conversation_doc.get("messages", [])):
        role = raw.get("role") if isinstance(raw, dict) else None
        content = raw.get("content") if isinstance(raw, dict) else None
        if role not in _VALID_ROLES or not isinstance(content, str):
            continue
        content = content.strip()
        if not content:
            continue
        if len(kept) >= _HISTORY_MAX_TURNS:
            break
        if kept and total_chars + len(content) > _HISTORY_MAX_CHARS:
            break
        kept.append({"role": role, "content": content})
        total_chars += len(content)

    kept.reverse()
    return kept


def _parse_stored_message(raw: object) -> ChatMessage | None:
    """Convert a stored message into an API model, or None if malformed."""
    if not isinstance(raw, dict):
        return None
    role = raw.get("role")
    content = raw.get("content")
    ts = raw.get("ts")
    if role not in _VALID_ROLES or not isinstance(content, str) or not isinstance(ts, datetime):
        return None
    return ChatMessage(role=role, content=content, created_at=ts)


# ── Persistence ───────────────────────────────────────────────────────────


async def _create_conversation(
    user_id: ObjectId, messages: list[dict], custom_id: ObjectId | None = None
) -> str:
    """Insert a new conversation and return its id as a string."""
    now = datetime.now(timezone.utc)
    document = {
        "user_id": user_id,
        "messages": messages,
        "created_at": now,
        "updated_at": now,
    }
    if custom_id is not None:
        document["_id"] = custom_id
    try:
        result = await get_db().conversations.insert_one(document)
    except Exception as exc:
        logger.error("MongoDB insert failed for conversation: %s", exc)
        raise ChatPersistenceError("Failed to save the conversation.") from exc
    return str(custom_id if custom_id is not None else result.inserted_id)


async def _append_messages(
    conversation_oid: ObjectId, messages: list[dict]
) -> None:
    """Append messages to an existing conversation.

    ``$slice`` keeps the document bounded: the most recent
    ``_MAX_STORED_MESSAGES`` messages are retained.
    """
    try:
        result = await get_db().conversations.update_one(
            {"_id": conversation_oid},
            {
                "$push": {
                    "messages": {
                        "$each": messages,
                        "$slice": -_MAX_STORED_MESSAGES,
                    }
                },
                "$set": {"updated_at": datetime.now(timezone.utc)},
            },
        )
    except Exception as exc:
        logger.error("MongoDB update failed for conversation: %s", exc)
        raise ChatPersistenceError("Failed to save the conversation.") from exc

    if result.matched_count == 0:
        logger.warning("Conversation %s disappeared before append", conversation_oid)
        raise ConversationNotFoundError("Conversation not found")
