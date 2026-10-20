"""RAG (Retrieval-Augmented Generation) Service.

Provides scoped (global + user) hybrid search with relevance thresholds,
Atlas Vector Search with pure-Python BM25 and Reciprocal Rank Fusion (RRF),
heading-aware semantic text chunking, and grounded AI chat.
Includes full in-memory offline fallback for resilient operation without MongoDB.
"""

from datetime import datetime, timezone
import logging
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
from app.services.ai import embedding_service, qwen_service
from app.services.ai.qwen_service import AIConfigurationError

logger = logging.getLogger(__name__)


def _get_db():
    try:
        return get_db()
    except Exception:
        return None


class ChunkSourceList(list):
    """List of ChunkSource items with an attached retrieval confidence status."""

    def __init__(
        self,
        items: list[ChunkSource] | None = None,
        status: str = "grounded",
    ):
        super().__init__(items or [])
        self.status = status


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


# ── Heading-Aware Semantic Chunking ───────────────────────────────────────

def _extract_heading(line: str) -> str | None:
    """Detect and clean Markdown or structural section headings."""
    line_s = line.strip()
    if not line_s:
        return None
    # Markdown headings: # Heading 1, ## Heading 2, etc.
    m_md = re.match(r"^#{1,6}\s+(.+)$", line_s)
    if m_md:
        return m_md.group(1).strip()
    # Structural headings with trailing colon (e.g. "Requirements:", "TECHNICAL SKILLS:")
    m_sec = re.match(r"^(?:(?:Section|Chapter|Part)\s+\d+[:\s]+|)([A-Z][A-Za-z0-9\s\-_/]{2,50}):$", line_s)
    if m_sec:
        return m_sec.group(1).strip()
    return None


def _split_into_sentences(text: str, max_words: int = 300, overlap_words: int = 45) -> list[str]:
    """Split text on sentence boundaries without breaking mid-sentence, unless oversized."""
    raw = re.split(r"(?<=[.!?])\s+", text)
    sentences: list[str] = []
    for s in raw:
        s_clean = s.strip()
        if not s_clean:
            continue
        words = s_clean.split()
        if len(words) > max_words:
            # Unavoidable: break oversized sentence/run-on text by words
            step = max(1, max_words - overlap_words)
            for i in range(0, len(words), step):
                chunk_w = words[i : i + max_words]
                if chunk_w:
                    sentences.append(" ".join(chunk_w))
                if i + max_words >= len(words):
                    break
        else:
            sentences.append(s_clean)
    return sentences or ([text.strip()] if text.strip() else [])


def chunk_document(
    text: str,
    target_words: int = 300,
    overlap_words: int = 45,
) -> list[dict[str, Any]]:
    """Split raw text into semantic chunks respecting headings, paragraphs, and sentence boundaries.

    Returns a list of dicts: ``{"content": chunk_text, "section_title": heading_or_none}``.
    Target size: ~250-350 words with ~15% overlap. Avoids mid-sentence splits.
    """
    cleaned = text.strip()
    if not cleaned:
        return []

    lines = cleaned.splitlines()
    blocks: list[tuple[str | None, list[str]]] = []
    current_heading: str | None = None
    current_para_lines: list[str] = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current_para_lines:
                para_text = " ".join(current_para_lines).strip()
                if para_text:
                    blocks.append((current_heading, _split_into_sentences(para_text, target_words, overlap_words)))
                current_para_lines = []
            continue

        heading = _extract_heading(stripped)
        if heading:
            if current_para_lines:
                para_text = " ".join(current_para_lines).strip()
                if para_text:
                    blocks.append((current_heading, _split_into_sentences(para_text, target_words, overlap_words)))
                current_para_lines = []
            current_heading = heading
        else:
            current_para_lines.append(stripped)

    if current_para_lines:
        para_text = " ".join(current_para_lines).strip()
        if para_text:
            blocks.append((current_heading, _split_into_sentences(para_text, target_words, overlap_words)))

    if not blocks:
        return [{"content": cleaned, "section_title": None}]

    chunks: list[dict[str, Any]] = []
    current_chunk_sentences: list[str] = []
    current_chunk_words = 0
    current_chunk_heading: str | None = None

    for heading, sentences in blocks:
        for sentence in sentences:
            s_words = len(sentence.split())
            if current_chunk_words + s_words > target_words and current_chunk_words >= min(100, target_words // 2):
                chunk_str = " ".join(current_chunk_sentences).strip()
                if chunk_str:
                    chunks.append({
                        "content": chunk_str,
                        "section_title": current_chunk_heading,
                    })

                # Select overlap sentences from the end of the previous chunk
                overlap_sents: list[str] = []
                overlap_count = 0
                for prev_sent in reversed(current_chunk_sentences):
                    cnt = len(prev_sent.split())
                    if overlap_count + cnt <= overlap_words or not overlap_sents:
                        overlap_sents.insert(0, prev_sent)
                        overlap_count += cnt
                    else:
                        break

                current_chunk_sentences = list(overlap_sents)
                current_chunk_words = sum(len(s.split()) for s in current_chunk_sentences)

            if not current_chunk_sentences:
                current_chunk_heading = heading
            elif heading and heading != current_chunk_heading and current_chunk_words < 100:
                current_chunk_heading = heading

            current_chunk_sentences.append(sentence)
            current_chunk_words += s_words

    if current_chunk_sentences:
        chunk_str = " ".join(current_chunk_sentences).strip()
        if chunk_str:
            chunks.append({
                "content": chunk_str,
                "section_title": current_chunk_heading,
            })

    return chunks or [{"content": cleaned, "section_title": None}]


def chunk_text(text: str, chunk_size: int = 300, overlap: int = 50) -> list[str]:
    """Split raw document text into overlapping semantic chunk strings (backwards compatible)."""
    return [c["content"] for c in chunk_document(text, target_words=chunk_size, overlap_words=overlap)]


def compute_text_vector(text: str, vocab_dim: int = 256) -> list[float]:
    """Compute a normalized frequency embedding vector for cosine similarity search (fallback)."""
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
    return max(0.0, min(1.0, float(dot)))


# ── Hybrid Retrieval: BM25 & Reciprocal Rank Fusion ─────────────────────────

def compute_bm25_scores(query: str, chunks: list[dict[str, Any]]) -> dict[str, float]:
    """Compute pure-Python Okapi BM25 relevance scores (k1=1.5, b=0.75)."""
    if not chunks or not query:
        return {str(c.get("chunk_id", c.get("_id"))): 0.0 for c in chunks}

    query_tokens = [t for t in re.findall(r"\w+", query.lower()) if len(t) > 1]
    if not query_tokens:
        return {str(c.get("chunk_id", c.get("_id"))): 0.0 for c in chunks}

    doc_tokens_list: list[list[str]] = []
    chunk_ids: list[str] = []
    for c in chunks:
        cid = str(c.get("chunk_id", c.get("_id")))
        chunk_ids.append(cid)
        tokens = re.findall(r"\w+", c.get("content", "").lower())
        doc_tokens_list.append(tokens)

    N = len(chunks)
    avgdl = sum(len(d) for d in doc_tokens_list) / max(1, N)
    k1 = 1.5
    b = 0.75

    # Document frequency per query term
    df: dict[str, int] = {}
    for t in set(query_tokens):
        df[t] = sum(1 for d in doc_tokens_list if t in d)

    scores: dict[str, float] = {}
    for cid, d_tokens in zip(chunk_ids, doc_tokens_list):
        doc_len = len(d_tokens)
        score = 0.0
        tf_dict: dict[str, int] = {}
        for t in d_tokens:
            if t in df:
                tf_dict[t] = tf_dict.get(t, 0) + 1

        for q in query_tokens:
            n_q = df.get(q, 0)
            if n_q == 0:
                continue
            idf = math.log(1.0 + (N - n_q + 0.5) / (n_q + 0.5))
            f = tf_dict.get(q, 0)
            if f > 0:
                denom = f + k1 * (1.0 - b + b * (doc_len / avgdl if avgdl > 0 else 1.0))
                score += idf * (f * (k1 + 1.0)) / denom

        scores[cid] = round(score, 4)

    return scores


def reciprocal_rank_fusion(
    vector_ranked_ids: list[str],
    keyword_ranked_ids: list[str],
    k: int = 60,
) -> dict[str, float]:
    """Compute Reciprocal Rank Fusion (RRF) scores across vector and keyword rankings."""
    rrf_scores: dict[str, float] = {}

    for rank, cid in enumerate(vector_ranked_ids, start=1):
        rrf_scores[cid] = rrf_scores.get(cid, 0.0) + (1.0 / (k + rank))

    for rank, cid in enumerate(keyword_ranked_ids, start=1):
        rrf_scores[cid] = rrf_scores.get(cid, 0.0) + (1.0 / (k + rank))

    return {cid: round(score, 6) for cid, score in rrf_scores.items()}


# ── Core Service Implementation ───────────────────────────────────────────

async def ingest_document(
    user_id: str | None,
    payload: DocumentIngestRequest,
    scope: str = "user",
    db=None,
) -> DocumentUploadResponse:
    """Process and index a new document into vector chunks.

    Uploads via the user endpoint are always scope="user".
    Global documents (scope="global") have user_id=None.
    """
    if db is None:
        db = _get_db()

    clean_scope = "global" if scope == "global" else "user"
    clean_user_id = None if clean_scope == "global" else str(user_id)

    doc_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    raw_chunk_items = chunk_document(payload.content)
    chunk_count = len(raw_chunk_items)
    raw_texts = [item["content"] for item in raw_chunk_items]

    doc_data = {
        "_id": doc_id,
        "user_id": clean_user_id,
        "title": payload.title,
        "category": payload.category,
        "scope": clean_scope,
        "content": payload.content,
        "content_length": len(payload.content),
        "chunk_count": chunk_count,
        "metadata": payload.metadata or {},
        "created_at": now,
    }

    # Generate embeddings via DashScope embedding service with fallback
    model_name = config.EMBEDDING_MODEL
    dim = config.EMBEDDING_DIMENSIONS
    embeddings: list[list[float]] = []

    try:
        if not config.ALIBABA_CLOUD_API_KEY:
            raise AIConfigurationError("ALIBABA_CLOUD_API_KEY is not configured")
        embeddings = await embedding_service.embed_texts(raw_texts)
        if embeddings and len(embeddings[0]) > 0:
            dim = len(embeddings[0])
    except Exception as exc:
        logger.warning(
            "Embedding API failed or unconfigured (%s: %s); falling back to hash-256 vectors",
            type(exc).__name__,
            exc,
        )
        model_name = "hash-256-fallback"
        dim = 256
        embeddings = [compute_text_vector(t, vocab_dim=256) for t in raw_texts]

    chunks_data: list[dict[str, Any]] = []
    for idx, item in enumerate(raw_chunk_items):
        c_id = str(uuid.uuid4())
        vec = embeddings[idx] if idx < len(embeddings) else compute_text_vector(item["content"], vocab_dim=256)
        chunks_data.append({
            "_id": c_id,
            "chunk_id": c_id,
            "document_id": doc_id,
            "document_title": payload.title,
            "user_id": clean_user_id,
            "category": payload.category,
            "scope": clean_scope,
            "chunk_index": idx,
            "section_title": item.get("section_title"),
            "content": item["content"],
            "embedding": vec,
            "embedding_model": model_name,
            "embedding_dim": dim,
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
        message=f"Successfully ingested and indexed '{payload.title}' into {chunk_count} chunk(s) (scope={clean_scope}).",
    )


async def list_user_documents(user_id: str, db=None) -> list[DocumentInfo]:
    """Retrieve all ingested documents accessible to the given user (user docs + global docs)."""
    if db is None:
        db = _get_db()
    docs: list[dict[str, Any]] = []

    if db is not None:
        try:
            if hasattr(db, "rag_documents"):
                cursor = db.rag_documents.find(
                    {"$or": [{"user_id": user_id}, {"scope": "global"}]}
                ).sort("created_at", -1)
                docs = await cursor.to_list(length=100)
        except Exception:
            docs = []

    if not docs:
        docs = [
            d for d in _offline_rag_docs.values()
            if d.get("user_id") == user_id or d.get("scope") == "global"
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
                user_id=d.get("user_id"),
                title=str(d.get("title", "Untitled")),
                category=str(d.get("category", "general")),
                chunk_count=int(d.get("chunk_count", 0)),
                content_length=int(d.get("content_length", 0)),
                scope=d.get("scope", "user"),
                created_at=created or datetime.now(timezone.utc),
            )
        )
    return result


async def delete_document(user_id: str, document_id: str, db=None) -> bool:
    """Delete an ingested document. Users can delete ONLY their own documents (never global docs)."""
    if db is None:
        db = _get_db()
    deleted = False

    if db is not None:
        try:
            if hasattr(db, "rag_documents"):
                res = await db.rag_documents.delete_one({
                    "_id": document_id,
                    "user_id": user_id,
                    "scope": {"$ne": "global"},
                })
                await db.rag_chunks.delete_many({
                    "document_id": document_id,
                    "user_id": user_id,
                    "scope": {"$ne": "global"},
                })
                if res.deleted_count > 0:
                    deleted = True
        except Exception:
            deleted = False

    if not deleted:
        doc = _offline_rag_docs.get(document_id)
        if doc and doc.get("user_id") == user_id and doc.get("scope") != "global":
            del _offline_rag_docs[document_id]
            to_remove = [c_id for c_id, c in _offline_rag_chunks.items() if c.get("document_id") == document_id]
            for c_id in to_remove:
                _offline_rag_chunks.pop(c_id, None)
            deleted = True

    return deleted


async def retrieve_context(
    user_id: str,
    query: str,
    top_k: int = 5,
    category_filter: str | None = None,
    document_ids: list[str] | None = None,
    db=None,
) -> ChunkSourceList:
    """Perform scoped hybrid retrieval (Atlas Vector Search + BM25 keyword fusion).

    Searches current user's chunks PLUS global chunks. Cross-user isolation is strictly enforced.
    Drops candidate chunks whose cosine similarity falls below config.RAG_MIN_SIMILARITY.
    Returns ChunkSourceList with status: 'grounded' | 'weak' | 'no_context'.
    """
    if db is None:
        db = _get_db()

    target_top_k = min(10, max(1, top_k))

    # 1. Compute query vector
    query_vec: list[float] = []
    query_model = config.EMBEDDING_MODEL
    query_dim = config.EMBEDDING_DIMENSIONS

    try:
        if not config.ALIBABA_CLOUD_API_KEY:
            raise AIConfigurationError("ALIBABA_CLOUD_API_KEY is not configured")
        query_vec = await embedding_service.embed_query(query)
        if query_vec:
            query_dim = len(query_vec)
    except Exception as exc:
        logger.warning(
            "Query embedding failed or unconfigured (%s); falling back to hash-256 vector",
            type(exc).__name__,
        )
        query_model = "hash-256-fallback"
        query_dim = 256
        query_vec = compute_text_vector(query, vocab_dim=256)

    # 2. Scope pre-filter: user chunks OR global chunks
    scope_filter: dict[str, Any] = {
        "$or": [
            {"scope": "global"},
            {"user_id": user_id, "scope": {"$ne": "global"}},
        ]
    }

    # 3. Retrieve Vector Candidates (Atlas $vectorSearch or in-memory fallback)
    vector_candidates: list[dict[str, Any]] = []

    if db is not None and hasattr(db, "rag_chunks"):
        try:
            # Build Atlas $vectorSearch pipeline with pre-filter
            filter_clauses: list[dict[str, Any]] = [
                {"$or": [{"scope": "global"}, {"user_id": user_id}]}
            ]
            if category_filter:
                filter_clauses.append({"category": category_filter})
            if document_ids:
                filter_clauses.append({"document_id": {"$in": document_ids}})

            v_filter = {"$and": filter_clauses} if len(filter_clauses) > 1 else filter_clauses[0]

            pipeline = [
                {
                    "$vectorSearch": {
                        "index": "rag_chunks_vector",
                        "path": "embedding",
                        "queryVector": query_vec,
                        "numCandidates": 100,
                        "limit": 30,
                        "filter": v_filter,
                    }
                },
                {
                    "$project": {
                        "_id": 1,
                        "chunk_id": 1,
                        "document_id": 1,
                        "document_title": 1,
                        "user_id": 1,
                        "category": 1,
                        "scope": 1,
                        "chunk_index": 1,
                        "section_title": 1,
                        "content": 1,
                        "embedding": 1,
                        "embedding_model": 1,
                        "embedding_dim": 1,
                        "vector_score": {"$meta": "vectorSearchScore"},
                    }
                },
            ]
            cursor = db.rag_chunks.aggregate(pipeline)
            vector_candidates = await cursor.to_list(length=30)
        except Exception as exc:
            logger.debug(
                "Atlas $vectorSearch not available (%s); using in-memory cosine fallback",
                type(exc).__name__,
            )
            vector_candidates = []

    # If $vectorSearch is unavailable or returned empty, perform in-memory cosine fallback
    if not vector_candidates:
        fallback_chunks: list[dict[str, Any]] = []
        if db is not None and hasattr(db, "rag_chunks"):
            try:
                base_q: dict[str, Any] = dict(scope_filter)
                if category_filter:
                    base_q["category"] = category_filter
                if document_ids:
                    base_q["document_id"] = {"$in": document_ids}
                cursor = db.rag_chunks.find(base_q)
                fallback_chunks = await cursor.to_list(length=500)
            except Exception:
                fallback_chunks = []

        if not fallback_chunks:
            for c in _offline_rag_chunks.values():
                is_global = c.get("scope") == "global"
                is_user = c.get("user_id") == user_id
                if not (is_global or is_user):
                    continue
                if category_filter and c.get("category") != category_filter:
                    continue
                if document_ids and c.get("document_id") not in document_ids:
                    continue
                fallback_chunks.append(c)

        scored_vec: list[tuple[float, dict[str, Any]]] = []
        for c in fallback_chunks:
            c_model = c.get("embedding_model")
            c_dim = c.get("embedding_dim")
            c_vec = c.get("embedding")
            if not c_model:
                if c_vec and len(c_vec) == 256:
                    c_model = "hash-256-fallback"
                    c_dim = 256
                elif c_vec:
                    c_dim = len(c_vec)

            # Strict model and dimension consistency
            if c_model != query_model or c_dim != query_dim:
                continue

            if not c_vec:
                if c_model == "hash-256-fallback":
                    c_vec = compute_text_vector(c.get("content", ""), vocab_dim=256)
                else:
                    continue

            sim = cosine_similarity(query_vec, c_vec)
            scored_vec.append((sim, c))

        scored_vec.sort(key=lambda x: x[0], reverse=True)
        vector_candidates = [c for _, c in scored_vec[:30]]

    # 4. Retrieve Keyword Candidates via Mongo text index (or scope pool)
    keyword_candidates: list[dict[str, Any]] = []
    if db is not None and hasattr(db, "rag_chunks"):
        try:
            text_filter = dict(scope_filter)
            text_filter["$text"] = {"$search": query}
            if category_filter:
                text_filter["category"] = category_filter
            if document_ids:
                text_filter["document_id"] = {"$in": document_ids}
            cursor = db.rag_chunks.find(text_filter).limit(30)
            keyword_candidates = await cursor.to_list(length=30)
        except Exception:
            keyword_candidates = []

    # 5. Build combined candidate pool
    candidate_dict: dict[str, dict[str, Any]] = {}
    for c in vector_candidates + keyword_candidates:
        cid = str(c.get("chunk_id", c.get("_id")))
        # Double check cross-user isolation
        c_scope = c.get("scope", "user")
        c_uid = c.get("user_id")
        if c_scope != "global" and c_uid != user_id:
            continue
        candidate_dict[cid] = c

    if not candidate_dict:
        return ChunkSourceList([], status="no_context")

    # 6. Compute exact cosine similarity and apply RAG_MIN_SIMILARITY threshold
    filtered_candidates: dict[str, dict[str, Any]] = {}
    similarity_map: dict[str, float] = {}

    for cid, c in candidate_dict.items():
        c_vec = c.get("embedding")
        c_model = c.get("embedding_model")
        c_dim = c.get("embedding_dim")
        if not c_model:
            if c_vec and len(c_vec) == 256:
                c_model = "hash-256-fallback"
                c_dim = 256
            elif c_vec:
                c_dim = len(c_vec)

        if c_model != query_model or c_dim != query_dim:
            continue

        if not c_vec:
            if c_model == "hash-256-fallback":
                c_vec = compute_text_vector(c.get("content", ""), vocab_dim=256)
            else:
                continue

        sim = cosine_similarity(query_vec, c_vec)
        # Drop candidates below minimum relevance threshold
        threshold = 0.05 if query_model == "hash-256-fallback" else config.RAG_MIN_SIMILARITY
        if sim >= threshold:
            similarity_map[cid] = sim
            filtered_candidates[cid] = c

    if not filtered_candidates:
        return ChunkSourceList([], status="no_context")

    surviving_chunks = list(filtered_candidates.values())

    # 7. Compute BM25 keyword relevance scores
    bm25_scores = compute_bm25_scores(query, surviving_chunks)

    # 8. Reciprocal Rank Fusion (k=60)
    # Sort for vector rank: descending similarity, tie-break by cid
    vector_ranked_ids = sorted(
        similarity_map.keys(),
        key=lambda x: (similarity_map[x], x),
        reverse=True,
    )
    # Sort for keyword rank: descending BM25, tie-break by cid
    keyword_ranked_ids = sorted(
        similarity_map.keys(),
        key=lambda x: (bm25_scores.get(x, 0.0), x),
        reverse=True,
    )

    rrf_scores = reciprocal_rank_fusion(
        vector_ranked_ids=vector_ranked_ids,
        keyword_ranked_ids=keyword_ranked_ids,
        k=60,
    )

    # 9. Final deterministic sort: fused_score desc, similarity desc, cid asc
    sorted_cids = sorted(
        similarity_map.keys(),
        key=lambda x: (-rrf_scores.get(x, 0.0), -similarity_map[x], x),
    )

    top_cids = sorted_cids[:target_top_k]

    # 10. Determine retrieval confidence status
    has_strong_chunk = any(
        similarity_map[cid] >= config.RAG_STRONG_SIMILARITY for cid in top_cids
    )
    status = "grounded" if has_strong_chunk else "weak"

    sources: list[ChunkSource] = []
    for rank, cid in enumerate(top_cids, start=1):
        c = filtered_candidates[cid]
        sim = similarity_map[cid]
        kw = bm25_scores.get(cid, 0.0)
        fused = rrf_scores.get(cid, 0.0)

        sources.append(
            ChunkSource(
                chunk_id=cid,
                document_id=str(c.get("document_id")),
                document_title=str(c.get("document_title", "Doc")),
                chunk_index=int(c.get("chunk_index", 0)),
                content=str(c.get("content", "")),
                similarity_score=round(sim, 4),
                similarity=round(sim, 4),
                keyword_score=round(kw, 4),
                fused_score=round(fused, 6),
                rank=rank,
                category=str(c.get("category", "general")),
                scope=str(c.get("scope", "user")),
                section_title=c.get("section_title"),
            )
        )

    return ChunkSourceList(sources, status=status)


async def grounded_chat(
    user_id: str,
    message: str,
    top_k: int = 5,
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
    status = getattr(sources, "status", "grounded")

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
        status=status,
    )
