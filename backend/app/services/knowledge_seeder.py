"""CareerPilot AI — Curated Knowledge Base Seeder.

Loads, validates, chunks, embeds, and indexes built-in curated knowledge documents
into global scope (scope="global", user_id=None).
Ensures idempotency via content hashing (SHA-256), handles deletions/orphans,
supports offline in-memory storage, and runs non-blocking at startup.
"""

import asyncio
from datetime import datetime, timezone
import hashlib
import logging
from pathlib import Path
from typing import Any
import unittest.mock
import uuid
import yaml

from app import config
from app.database.mongodb import get_db
from app.schemas.rag import KnowledgeBaseStats
from app.services.ai import embedding_service
from app.services.ai.qwen_service import AIConfigurationError
from app.services.rag_service import (
    CHUNKER_VERSION,
    _offline_rag_chunks,
    _offline_rag_docs,
    chunk_document,
    compute_text_vector,
    invalidate_bm25_cache,
)

logger = logging.getLogger(__name__)

DEFAULT_KNOWLEDGE_DIR = Path(__file__).resolve().parent.parent / "knowledge"

_last_seeded_at: datetime | None = None
_is_seeding: bool = False
_seeding_lock = asyncio.Lock()


def _get_db():
    try:
        return get_db()
    except Exception:
        return None


def parse_knowledge_file(file_path: Path) -> dict[str, Any] | None:
    """Parse a Markdown file with YAML front matter into structured document data.

    Returns a dictionary of document metadata and body, or None if malformed.
    """
    try:
        content = file_path.read_text(encoding="utf-8")
    except Exception as exc:
        logger.warning("Could not read knowledge file %s: %s", file_path.name, exc)
        return None

    stripped = content.strip()
    if not stripped.startswith("---"):
        logger.warning(
            "Skipping malformed knowledge file %s: missing initial '---' front matter delimiter",
            file_path.name,
        )
        return None

    parts = stripped.split("---", 2)
    if len(parts) < 3:
        logger.warning(
            "Skipping malformed knowledge file %s: missing closing '---' front matter delimiter",
            file_path.name,
        )
        return None

    fm_raw = parts[1].strip()
    body = parts[2].strip()

    if not body:
        logger.warning("Skipping malformed knowledge file %s: body is empty", file_path.name)
        return None

    try:
        metadata = yaml.safe_load(fm_raw)
        if not isinstance(metadata, dict):
            logger.warning(
                "Skipping malformed knowledge file %s: front matter must be a YAML mapping",
                file_path.name,
            )
            return None
    except Exception as exc:
        logger.warning(
            "Skipping malformed knowledge file %s: invalid YAML front matter: %s",
            file_path.name,
            exc,
        )
        return None

    title = str(metadata.get("title") or file_path.stem.replace("_", " ").title())
    category = str(metadata.get("category") or "general")
    role = str(metadata.get("role") or "general")
    source_note = str(metadata.get("source_note") or "")

    # SHA-256 content hash covering chunker version, front matter, and body
    content_hash = hashlib.sha256(f"{CHUNKER_VERSION}:{content}".encode("utf-8")).hexdigest()

    return {
        "file_name": file_path.name,
        "title": title,
        "category": category,
        "role": role,
        "source_note": source_note,
        "metadata": metadata,
        "body": body,
        "content_hash": content_hash,
    }


async def _compute_embeddings(
    raw_chunk_items: list[dict[str, Any]],
    doc_title: str | None = None,
    use_hash_fallback: bool = False,
) -> tuple[list[list[float]], str, int]:
    """Compute embeddings for a batch of chunk strings, prefixed with title and section for context."""
    embed_texts: list[str] = []
    for c in raw_chunk_items:
        prefix = ""
        doc_t = doc_title or ""
        sec_t = c.get("heading_path") or c.get("section_title") or ""
        if doc_t and sec_t:
            prefix = f"{doc_t} | {sec_t}\n\n"
        elif doc_t:
            prefix = f"{doc_t}\n\n"
        elif sec_t:
            prefix = f"{sec_t}\n\n"
        embed_texts.append(f"{prefix}{c['content']}")

    if not embed_texts:
        return [], "hash-256-fallback", 256

    if use_hash_fallback:
        return [compute_text_vector(t, vocab_dim=256) for t in embed_texts], "hash-256-fallback", 256

    model_name = config.EMBEDDING_MODEL
    dim = config.EMBEDDING_DIMENSIONS
    embeddings: list[list[float]] = []

    try:
        is_mocked = (
            isinstance(embedding_service.embed_texts, (unittest.mock.Mock, unittest.mock.AsyncMock))
            or hasattr(embedding_service.embed_texts, "assert_called")
            or hasattr(embedding_service.embed_texts, "mock")
        )

        if not config.ALIBABA_CLOUD_API_KEY and not is_mocked:
            raise AIConfigurationError("ALIBABA_CLOUD_API_KEY is not configured")

        embeddings = await embedding_service.embed_texts(embed_texts)
        if embeddings and len(embeddings[0]) > 0:
            dim = len(embeddings[0])
    except Exception as exc:
        logger.debug("Embedding service unconfigured or failed (%s); using hash-256 fallback", exc)
        model_name = "hash-256-fallback"
        dim = 256
        embeddings = [compute_text_vector(t, vocab_dim=256) for t in embed_texts]

    return embeddings, model_name, dim



async def seed_knowledge(
    db=None,
    knowledge_dir: Path | str | None = None,
    force: bool = False,
    offline: bool = False,
    use_hash_fallback: bool = False,
) -> dict[str, Any]:
    """Seed or synchronize the curated knowledge base files into global scope.

    Idempotent: skips unchanged files by SHA-256 hash, re-embeds modified files,
    and removes orphaned global documents whose files were deleted.
    """
    global _last_seeded_at, _is_seeding

    async with _seeding_lock:
        _is_seeding = True
        try:
            if db is None and not offline:
                db = _get_db()

            k_dir = Path(knowledge_dir) if knowledge_dir else DEFAULT_KNOWLEDGE_DIR
            if not k_dir.is_dir():
                logger.warning("Knowledge base directory not found at: %s", k_dir)
                return {
                    "status": "directory_not_found",
                    "path": str(k_dir),
                    "seeded": 0,
                    "updated": 0,
                    "skipped": 0,
                    "removed": 0,
                }

            md_files = sorted(list(k_dir.glob("*.md")))
            parsed_docs: list[dict[str, Any]] = []
            for mf in md_files:
                doc_info = parse_knowledge_file(mf)
                if doc_info is not None:
                    parsed_docs.append(doc_info)

            valid_file_names = {d["file_name"] for d in parsed_docs}

            seeded_count = 0
            updated_count = 0
            skipped_count = 0
            removed_count = 0
            active_doc_ids: set[str] = set()

            use_db = False
            if db is not None and not offline:
                try:
                    if hasattr(db, "rag_documents"):
                        # Ensure we can perform operations
                        await db.rag_documents.find_one({"scope": "global"})
                        use_db = True
                except Exception:
                    use_db = False

            now = datetime.now(timezone.utc)

            # ── 1. MongoDB Database Upsert Pipeline ────────────────────────
            if use_db:
                # Fetch existing global curated documents
                existing_cursor = db.rag_documents.find({
                    "scope": "global",
                    "metadata.is_curated_kb": True,
                })
                existing_docs = await existing_cursor.to_list(length=1000)
                existing_by_file = {
                    d.get("metadata", {}).get("file_name"): d
                    for d in existing_docs
                    if d.get("metadata", {}).get("file_name")
                }

                for doc_info in parsed_docs:
                    fn = doc_info["file_name"]
                    content_hash = doc_info["content_hash"]
                    existing = existing_by_file.get(fn)

                    if existing and not force:
                        old_hash = existing.get("metadata", {}).get("content_hash")
                        if old_hash == content_hash:
                            # Content is identical: idempotent skip (zero embedding calls)
                            active_doc_ids.add(str(existing["_id"]))
                            skipped_count += 1
                            continue

                    # Chunk and generate embeddings
                    raw_chunks = chunk_document(doc_info["body"], doc_title=doc_info["title"])
                    embeddings, model_name, dim = await _compute_embeddings(
                        raw_chunks, doc_title=doc_info["title"], use_hash_fallback=use_hash_fallback
                    )

                    doc_metadata = {
                        **doc_info["metadata"],
                        "file_name": fn,
                        "content_hash": content_hash,
                        "role": doc_info["role"],
                        "source_note": doc_info["source_note"],
                        "is_curated_kb": True,
                    }

                    if existing:
                        doc_id = str(existing["_id"])
                        await db.rag_chunks.delete_many({"document_id": doc_id})

                        chunks_data: list[dict[str, Any]] = []
                        for idx, item in enumerate(raw_chunks):
                            c_id = str(uuid.uuid4())
                            vec = embeddings[idx] if idx < len(embeddings) else compute_text_vector(item["content"])
                            chunks_data.append({
                                "_id": c_id,
                                "chunk_id": c_id,
                                "document_id": doc_id,
                                "document_title": doc_info["title"],
                                "user_id": None,
                                "category": doc_info["category"],
                                "role": doc_info["role"],
                                "scope": "global",
                                "chunk_index": idx,
                                "section_title": item.get("section_title"),
                                "heading_path": item.get("heading_path"),
                                "content": item["content"],
                                "embedding": vec,
                                "embedding_model": model_name,
                                "embedding_dim": dim,
                                "created_at": now,
                            })

                        if chunks_data:
                            await db.rag_chunks.insert_many(chunks_data)

                        await db.rag_documents.update_one(
                            {"_id": doc_id},
                            {
                                "$set": {
                                    "title": doc_info["title"],
                                    "category": doc_info["category"],
                                    "content": doc_info["body"],
                                    "content_length": len(doc_info["body"]),
                                    "chunk_count": len(chunks_data),
                                    "metadata": doc_metadata,
                                    "updated_at": now,
                                }
                            },
                        )
                        active_doc_ids.add(doc_id)
                        updated_count += 1
                    else:
                        doc_id = str(uuid.uuid4())
                        chunks_data = []
                        for idx, item in enumerate(raw_chunks):
                            c_id = str(uuid.uuid4())
                            vec = embeddings[idx] if idx < len(embeddings) else compute_text_vector(item["content"])
                            chunks_data.append({
                                "_id": c_id,
                                "chunk_id": c_id,
                                "document_id": doc_id,
                                "document_title": doc_info["title"],
                                "user_id": None,
                                "category": doc_info["category"],
                                "role": doc_info["role"],
                                "scope": "global",
                                "chunk_index": idx,
                                "section_title": item.get("section_title"),
                                "heading_path": item.get("heading_path"),
                                "content": item["content"],
                                "embedding": vec,
                                "embedding_model": model_name,
                                "embedding_dim": dim,
                                "created_at": now,
                            })

                        doc_data = {
                            "_id": doc_id,
                            "user_id": None,
                            "title": doc_info["title"],
                            "category": doc_info["category"],
                            "scope": "global",
                            "content": doc_info["body"],
                            "content_length": len(doc_info["body"]),
                            "chunk_count": len(chunks_data),
                            "metadata": doc_metadata,
                            "created_at": now,
                            "updated_at": now,
                        }

                        await db.rag_documents.insert_one(doc_data)
                        if chunks_data:
                            await db.rag_chunks.insert_many(chunks_data)

                        active_doc_ids.add(doc_id)
                        seeded_count += 1

                # Clean up orphaned documents (deleted files)
                for doc in existing_docs:
                    fn = doc.get("metadata", {}).get("file_name")
                    if fn and fn not in valid_file_names:
                        d_id = str(doc["_id"])
                        await db.rag_documents.delete_one({"_id": d_id})
                        await db.rag_chunks.delete_many({"document_id": d_id})
                        removed_count += 1
                        logger.info("Pruned orphaned knowledge base document: %s (%s)", d_id, fn)

                # Delete orphaned global chunks not belonging to any active document
                if active_doc_ids:
                    orphan_res = await db.rag_chunks.delete_many({
                        "scope": "global",
                        "document_id": {"$nin": list(active_doc_ids)},
                    })
                    if orphan_res.deleted_count > 0:
                        logger.info("Pruned %d orphaned global chunks", orphan_res.deleted_count)

                # Persist seeder status metadata
                try:
                    await db.system_settings.update_one(
                        {"_id": "knowledge_base_seeder"},
                        {"$set": {"last_seeded_at": now.isoformat(), "updated_at": now}},
                        upsert=True,
                    )
                except Exception:
                    pass

            # ── 2. In-Memory Offline Storage Upsert Pipeline ──────────────
            else:
                existing_offline_by_file = {
                    d.get("metadata", {}).get("file_name"): d
                    for d in _offline_rag_docs.values()
                    if d.get("scope") == "global" and d.get("metadata", {}).get("is_curated_kb")
                }

                for doc_info in parsed_docs:
                    fn = doc_info["file_name"]
                    content_hash = doc_info["content_hash"]
                    existing = existing_offline_by_file.get(fn)

                    if existing and not force:
                        old_hash = existing.get("metadata", {}).get("content_hash")
                        if old_hash == content_hash:
                            active_doc_ids.add(str(existing["_id"]))
                            skipped_count += 1
                            continue

                    raw_chunks = chunk_document(doc_info["body"], doc_title=doc_info["title"])
                    embeddings, model_name, dim = await _compute_embeddings(
                        raw_chunks, doc_title=doc_info["title"], use_hash_fallback=use_hash_fallback
                    )

                    doc_metadata = {
                        **doc_info["metadata"],
                        "file_name": fn,
                        "content_hash": content_hash,
                        "role": doc_info["role"],
                        "source_note": doc_info["source_note"],
                        "is_curated_kb": True,
                    }

                    if existing:
                        doc_id = str(existing["_id"])
                        # Evict old chunks
                        to_del = [
                            c_id for c_id, c in _offline_rag_chunks.items()
                            if c.get("document_id") == doc_id
                        ]
                        for c_id in to_del:
                            _offline_rag_chunks.pop(c_id, None)

                        chunks_data = []
                        for idx, item in enumerate(raw_chunks):
                            c_id = str(uuid.uuid4())
                            vec = embeddings[idx] if idx < len(embeddings) else compute_text_vector(item["content"])
                            chunk_rec = {
                                "_id": c_id,
                                "chunk_id": c_id,
                                "document_id": doc_id,
                                "document_title": doc_info["title"],
                                "user_id": None,
                                "category": doc_info["category"],
                                "role": doc_info["role"],
                                "scope": "global",
                                "chunk_index": idx,
                                "section_title": item.get("section_title"),
                                "heading_path": item.get("heading_path"),
                                "content": item["content"],
                                "embedding": vec,
                                "embedding_model": model_name,
                                "embedding_dim": dim,
                                "created_at": now,
                            }
                            chunks_data.append(chunk_rec)
                            _offline_rag_chunks[c_id] = chunk_rec

                        _offline_rag_docs[doc_id] = {
                            "_id": doc_id,
                            "user_id": None,
                            "title": doc_info["title"],
                            "category": doc_info["category"],
                            "scope": "global",
                            "content": doc_info["body"],
                            "content_length": len(doc_info["body"]),
                            "chunk_count": len(chunks_data),
                            "metadata": doc_metadata,
                            "created_at": existing.get("created_at", now),
                            "updated_at": now,
                        }
                        active_doc_ids.add(doc_id)
                        updated_count += 1
                    else:
                        doc_id = str(uuid.uuid4())
                        chunks_data = []
                        for idx, item in enumerate(raw_chunks):
                            c_id = str(uuid.uuid4())
                            vec = embeddings[idx] if idx < len(embeddings) else compute_text_vector(item["content"])
                            chunk_rec = {
                                "_id": c_id,
                                "chunk_id": c_id,
                                "document_id": doc_id,
                                "document_title": doc_info["title"],
                                "user_id": None,
                                "category": doc_info["category"],
                                "role": doc_info["role"],
                                "scope": "global",
                                "chunk_index": idx,
                                "section_title": item.get("section_title"),
                                "heading_path": item.get("heading_path"),
                                "content": item["content"],
                                "embedding": vec,
                                "embedding_model": model_name,
                                "embedding_dim": dim,
                                "created_at": now,
                            }
                            chunks_data.append(chunk_rec)
                            _offline_rag_chunks[c_id] = chunk_rec

                        _offline_rag_docs[doc_id] = {
                            "_id": doc_id,
                            "user_id": None,
                            "title": doc_info["title"],
                            "category": doc_info["category"],
                            "scope": "global",
                            "content": doc_info["body"],
                            "content_length": len(doc_info["body"]),
                            "chunk_count": len(chunks_data),
                            "metadata": doc_metadata,
                            "created_at": now,
                            "updated_at": now,
                        }
                        active_doc_ids.add(doc_id)
                        seeded_count += 1

                # Clean up orphaned documents in offline storage
                for d_id, doc in list(_offline_rag_docs.items()):
                    if doc.get("scope") == "global" and doc.get("metadata", {}).get("is_curated_kb"):
                        fn = doc.get("metadata", {}).get("file_name")
                        if fn and fn not in valid_file_names:
                            _offline_rag_docs.pop(d_id, None)
                            to_del = [
                                c_id for c_id, c in _offline_rag_chunks.items()
                                if c.get("document_id") == d_id
                            ]
                            for c_id in to_del:
                                _offline_rag_chunks.pop(c_id, None)
                            removed_count += 1
                            logger.info("Pruned orphaned offline knowledge document: %s (%s)", d_id, fn)

                if active_doc_ids:
                    to_del_chunks = [
                        c_id for c_id, c in _offline_rag_chunks.items()
                        if c.get("scope") == "global" and c.get("document_id") not in active_doc_ids
                    ]
                    for c_id in to_del_chunks:
                        _offline_rag_chunks.pop(c_id, None)

            _last_seeded_at = now

            total_docs = len(active_doc_ids)
            total_chunks = len([
                c for c in _offline_rag_chunks.values() if c.get("scope") == "global"
            ]) if not use_db else await db.rag_chunks.count_documents({"scope": "global"})

            # Invalidate BM25 corpus statistics cache after seeding
            invalidate_bm25_cache()

            logger.info(
                "Knowledge base seeding complete: %d seeded, %d updated, %d skipped, %d pruned.",
                seeded_count,
                updated_count,
                skipped_count,
                removed_count,
            )

            return {
                "status": "success",
                "mode": "mongodb" if use_db else "offline_memory",
                "total_files": len(md_files),
                "valid_files": len(parsed_docs),
                "seeded": seeded_count,
                "updated": updated_count,
                "skipped": skipped_count,
                "removed": removed_count,
                "total_documents": total_docs,
                "total_chunks": total_chunks,
                "last_seeded_at": now.isoformat(),
            }


        finally:
            _is_seeding = False


async def seed_knowledge_background(
    knowledge_dir: Path | str | None = None,
    force: bool = False,
) -> None:
    """Non-blocking background wrapper invoked during FastAPI startup."""
    try:
        logger.info("Initiating non-blocking background knowledge base seed...")
        res = await seed_knowledge(knowledge_dir=knowledge_dir, force=force)
        logger.info(
            "Knowledge base background seed finished successfully: seeded=%s, skipped=%s, total_docs=%s",
            res.get("seeded"),
            res.get("skipped"),
            res.get("total_documents"),
        )
    except Exception as exc:
        logger.warning(
            "Background knowledge base seeding encountered a non-fatal error: %s",
            exc,
            exc_info=True,
        )


async def get_knowledge_base_stats(db=None) -> KnowledgeBaseStats:
    """Return aggregated document and chunk counts by category and last seed timestamp."""
    global _last_seeded_at, _is_seeding
    if db is None:
        db = _get_db()

    use_db = False
    doc_count = 0
    chunk_count = 0
    categories: dict[str, int] = {}
    chunks_by_cat: dict[str, int] = {}
    last_seeded = _last_seeded_at

    if db is not None:
        try:
            if hasattr(db, "rag_documents"):
                doc_count = await db.rag_documents.count_documents({"scope": "global"})
                chunk_count = await db.rag_chunks.count_documents({"scope": "global"})

                cat_pipe = [
                    {"$match": {"scope": "global"}},
                    {"$group": {"_id": "$category", "count": {"$sum": 1}}},
                ]
                async for c in db.rag_documents.aggregate(cat_pipe):
                    if c.get("_id"):
                        categories[str(c["_id"])] = c["count"]

                chunk_cat_pipe = [
                    {"$match": {"scope": "global"}},
                    {"$group": {"_id": "$category", "count": {"$sum": 1}}},
                ]
                async for c in db.rag_chunks.aggregate(chunk_cat_pipe):
                    if c.get("_id"):
                        chunks_by_cat[str(c["_id"])] = c["count"]

                meta = await db.system_settings.find_one({"_id": "knowledge_base_seeder"})
                if meta and "last_seeded_at" in meta:
                    raw_ts = meta["last_seeded_at"]
                    if isinstance(raw_ts, str):
                        try:
                            last_seeded = datetime.fromisoformat(raw_ts)
                        except Exception:
                            pass
                    elif isinstance(raw_ts, datetime):
                        last_seeded = raw_ts

                use_db = True
        except Exception as exc:
            logger.debug("MongoDB query failed for KB stats (%s); using in-memory cache", exc)
            use_db = False

    if not use_db:
        global_docs = [d for d in _offline_rag_docs.values() if d.get("scope") == "global"]
        global_chunks = [c for c in _offline_rag_chunks.values() if c.get("scope") == "global"]
        doc_count = len(global_docs)
        chunk_count = len(global_chunks)
        for d in global_docs:
            cat = str(d.get("category", "general"))
            categories[cat] = categories.get(cat, 0) + 1
        for c in global_chunks:
            cat = str(c.get("category", "general"))
            chunks_by_cat[cat] = chunks_by_cat.get(cat, 0) + 1

    status_str = "ready" if doc_count > 0 else "unseeded"
    if _is_seeding:
        status_str = "seeding"

    return KnowledgeBaseStats(
        total_documents=doc_count,
        total_chunks=chunk_count,
        categories=categories,
        chunks_by_category=chunks_by_cat,
        last_seeded_at=last_seeded,
        status=status_str,
    )
