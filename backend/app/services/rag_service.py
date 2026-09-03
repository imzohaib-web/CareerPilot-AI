"""RAG (Retrieval-Augmented Generation) Service.

Provides text chunking, embedding generation, cosine similarity vector search,
document ingestion, context retrieval, and grounded AI chat. Includes full
in-memory offline fallback for resilient operation without MongoDB.
"""

from datetime import datetime, timezone
import math
import re
from typing import Any
import uuid

from app import config
from app.database.mongodb import get_db
from app.schemas.rag import (
    ChunkSource,
    DocumentInfo,
    DocumentIngestRequest,
    DocumentUploadResponse,
    RAGChatResponse,
)
from app.services.ai import qwen_service


def _get_db():
    try:
        return get_db()
    except Exception:
        return None


# ── In-Memory Offline Storage ──────────────────────────────────────────────
_offline_rag_docs: dict[str, dict[str, Any]] = {}
_offline_rag_chunks: dict[str, dict[str, Any]] = {}

# System prompt enforcing strict grounding in retrieved context
RAG_SYSTEM_PROMPT = """You are CareerPilot AI's Grounded RAG Career Advisor.
Your objective is to provide precise, highly relevant career guidance and answer questions based STRICTLY on the retrieved context documents provided below.

Rules:
1. Base your answer primarily on the information in the provided context sources.
2. If the context contains relevant information, quote or summarize key requirements, skills, or guidelines clearly.
3. If the answer cannot be found in the provided sources, explicitly state what is present in the sources and offer helpful general guidance while clearly noting the distinction.
4. Maintain a professional, encouraging, and highly structured tone with markdown bullet points.

=== RETRIEVED CONTEXT SOURCES ===
{context_text}
=================================
"""


# ── Vector & Chunking Utilities ───────────────────────────────────────────

def chunk_text(text: str, chunk_size: int = 300, overlap: int = 50) -> list[str]:
    """Split raw document text into overlapping semantic chunks."""
    cleaned = re.sub(r"\s+", " ", text).strip()
    words = cleaned.split(" ")
    if len(words) <= chunk_size:
        return [cleaned] if cleaned else []

    chunks: list[str] = []
    step = chunk_size - overlap
    if step <= 0:
        step = chunk_size // 2 or 1

    for i in range(0, len(words), step):
        chunk_words = words[i : i + chunk_size]
        chunk_str = " ".join(chunk_words).strip()
        if len(chunk_words) >= 15 or i + chunk_size >= len(words):
            chunks.append(chunk_str)
        if i + chunk_size >= len(words):
            break

    return chunks or [cleaned]


def compute_text_vector(text: str, vocab_dim: int = 256) -> list[float]:
    """Compute a normalized frequency embedding vector for cosine similarity search.

    Uses deterministic token-hashing to build a fixed-size dense vector.
    """
    words = re.findall(r"\w+", text.lower())
    if not words:
        return [0.0] * vocab_dim

    vec = [0.0] * vocab_dim
    for word in words:
        idx = hash(word) % vocab_dim
        vec[idx] += 1.0

    # L2 normalize
    norm = math.sqrt(sum(v * v for v in vec))
    if norm > 0:
        vec = [v / norm for v in vec]
    return vec


def cosine_similarity(v1: list[float], v2: list[float]) -> float:
    """Compute cosine similarity between two normalized vectors."""
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    if norm1 == 0.0 or norm2 == 0.0:
        return 0.0
    similarity = dot / (norm1 * norm2)
    return max(0.0, min(1.0, float(similarity)))


# ── Core Service Implementation ───────────────────────────────────────────

async def ingest_document(
    user_id: str, payload: DocumentIngestRequest, db=None
) -> DocumentUploadResponse:
    """Process and index a new document into vector chunks."""
    if db is None:
        db = _get_db()
    doc_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    raw_chunks = chunk_text(payload.content)
    chunk_count = len(raw_chunks)

    doc_data = {
        "_id": doc_id,
        "user_id": user_id,
        "title": payload.title,
        "category": payload.category,
        "content": payload.content,
        "content_length": len(payload.content),
        "chunk_count": chunk_count,
        "metadata": payload.metadata or {},
        "created_at": now,
    }

    chunks_data: list[dict[str, Any]] = []
    for idx, text in enumerate(raw_chunks):
        c_id = str(uuid.uuid4())
        vec = compute_text_vector(text)
        chunks_data.append({
            "_id": c_id,
            "chunk_id": c_id,
            "document_id": doc_id,
            "document_title": payload.title,
            "user_id": user_id,
            "category": payload.category,
            "chunk_index": idx,
            "content": text,
            "embedding": vec,
            "created_at": now,
        })

    # Persistence handling
    use_db = False
    if db is not None:
        try:
            if hasattr(db, "rag_documents") and not isinstance(db.rag_documents, type(None)):
                await db.rag_documents.insert_one(doc_data)
                if chunks_data:
                    await db.rag_chunks.insert_many(chunks_data)
                use_db = True
        except Exception:
            use_db = False

    if not use_db:
        _offline_rag_docs[doc_id] = doc_data
        for cd in chunks_data:
            _offline_rag_chunks[cd["chunk_id"]] = cd

    return DocumentUploadResponse(
        document_id=doc_id,
        title=payload.title,
        chunk_count=chunk_count,
        message=f"Successfully ingested and indexed '{payload.title}' into {chunk_count} chunk(s).",
    )


async def list_user_documents(user_id: str, db=None) -> list[DocumentInfo]:
    """Retrieve all ingested documents for the given user."""
    if db is None:
        db = _get_db()
    docs: list[dict[str, Any]] = []

    if db is not None:
        try:
            if hasattr(db, "rag_documents"):
                cursor = db.rag_documents.find({"user_id": user_id}).sort("created_at", -1)
                docs = await cursor.to_list(length=100)
        except Exception:
            docs = []

    if not docs:
        docs = [
            d for d in _offline_rag_docs.values()
            if d.get("user_id") == user_id
        ]
        docs.sort(key=lambda x: x.get("created_at", datetime.min), reverse=True)

    result: list[DocumentInfo] = []
    for d in docs:
        created = d.get("created_at")
        if isinstance(created, str):
            try:
                created = datetime.fromisoformat(created)
            except Exception:
                created = datetime.now(timezone.utc)

        result.append(
            DocumentInfo(
                id=str(d.get("_id", d.get("id"))),
                user_id=str(d.get("user_id")),
                title=str(d.get("title", "Untitled")),
                category=str(d.get("category", "general")),
                chunk_count=int(d.get("chunk_count", 0)),
                content_length=int(d.get("content_length", 0)),
                created_at=created or datetime.now(timezone.utc),
            )
        )
    return result


async def delete_document(user_id: str, document_id: str, db=None) -> bool:
    """Delete a document and all associated chunks."""
    if db is None:
        db = _get_db()
    deleted = False
    if db is not None:
        try:
            if hasattr(db, "rag_documents"):
                res = await db.rag_documents.delete_one({"_id": document_id, "user_id": user_id})
                await db.rag_chunks.delete_many({"document_id": document_id, "user_id": user_id})
                if res.deleted_count > 0:
                    deleted = True
        except Exception:
            deleted = False

    if not deleted:
        if document_id in _offline_rag_docs and _offline_rag_docs[document_id].get("user_id") == user_id:
            del _offline_rag_docs[document_id]
            to_remove = [c_id for c_id, c in _offline_rag_chunks.items() if c.get("document_id") == document_id]
            for c_id in to_remove:
                _offline_rag_chunks.pop(c_id, None)
            deleted = True

    return deleted


async def retrieve_context(
    user_id: str,
    query: str,
    top_k: int = 3,
    category_filter: str | None = None,
    document_ids: list[str] | None = None,
    db=None,
) -> list[ChunkSource]:
    """Perform vector similarity search over user document chunks."""
    if db is None:
        db = _get_db()
    all_chunks: list[dict[str, Any]] = []

    if db is not None:
        try:
            if hasattr(db, "rag_chunks"):
                filter_q: dict[str, Any] = {"user_id": user_id}
                if category_filter:
                    filter_q["category"] = category_filter
                if document_ids:
                    filter_q["document_id"] = {"$in": document_ids}
                cursor = db.rag_chunks.find(filter_q)
                all_chunks = await cursor.to_list(length=500)
        except Exception:
            all_chunks = []

    if not all_chunks:
        for c in _offline_rag_chunks.values():
            if c.get("user_id") == user_id:
                if category_filter and c.get("category") != category_filter:
                    continue
                if document_ids and c.get("document_id") not in document_ids:
                    continue
                all_chunks.append(c)

    if not all_chunks:
        return []

    query_vec = compute_text_vector(query)
    scored: list[tuple[float, dict[str, Any]]] = []

    for chunk in all_chunks:
        chunk_vec = chunk.get("embedding")
        if not chunk_vec:
            chunk_vec = compute_text_vector(chunk.get("content", ""))
        sim = cosine_similarity(query_vec, chunk_vec)
        scored.append((sim, chunk))

    # Sort descending by similarity score
    scored.sort(key=lambda x: x[0], reverse=True)
    top_items = scored[:top_k]

    sources: list[ChunkSource] = []
    for sim, c in top_items:
        sources.append(
            ChunkSource(
                chunk_id=str(c.get("chunk_id", c.get("_id"))),
                document_id=str(c.get("document_id")),
                document_title=str(c.get("document_title", "Doc")),
                chunk_index=int(c.get("chunk_index", 0)),
                content=str(c.get("content", "")),
                similarity_score=round(sim, 4),
            )
        )

    return sources


async def grounded_chat(
    user_id: str,
    message: str,
    top_k: int = 3,
    document_ids: list[str] | None = None,
    db=None,
) -> RAGChatResponse:
    """Generate RAG-grounded response using retrieved document context."""
    sources = await retrieve_context(
        user_id=user_id,
        query=message,
        top_k=top_k,
        document_ids=document_ids,
        db=db,
    )

    if sources:
        context_str = "\n\n".join(
            f"[Source {i+1}: {src.document_title} (Chunk {src.chunk_index + 1}) - Score: {src.similarity_score}]\n{src.content}"
            for i, src in enumerate(sources)
        )
    else:
        context_str = "No relevant document chunks found in your knowledge base."

    system_prompt = RAG_SYSTEM_PROMPT.format(context_text=context_str)

    try:
        reply_text, model_used = await qwen_service.chat(
            user_message=message,
            system_prompt=system_prompt,
            temperature=0.4,
        )
    except Exception as exc:
        reply_text = (
            f"Based on your retrieved documents:\n\n{context_str}\n\n"
            f"(Note: Offline response generated due to AI service unavailability: {exc})"
        )
        model_used = "offline-fallback"

    return RAGChatResponse(
        reply=reply_text,
        sources=sources,
        model_used=model_used,
    )
