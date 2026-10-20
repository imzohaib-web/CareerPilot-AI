"""One-off migration script to re-embed all existing RAG chunks with DashScope.

Idempotent and resumable:
Skips any chunks already embedded with the target model and dimension.
Batches updates according to config.EMBEDDING_BATCH_SIZE.
"""

import asyncio
import logging
import os
import sys
from pathlib import Path
from typing import Any

# Ensure backend root is in sys.path
backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from app import config
from app.database.mongodb import close_db, connect_db, get_db
from app.services.ai import embedding_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("reembed_chunks")


async def reembed_all_chunks(db=None) -> dict[str, int]:
    """Re-embed chunks in MongoDB that do not match the target embedding model.

    Returns a summary dict with counts of total, processed, and skipped chunks.
    """
    if db is None:
        db = get_db()

    target_model = config.EMBEDDING_MODEL
    target_dim = config.EMBEDDING_DIMENSIONS
    batch_size = max(1, config.EMBEDDING_BATCH_SIZE)

    logger.info(
        "Starting re-embedding migration (target_model=%s, target_dim=%d, batch_size=%d)",
        target_model,
        target_dim,
        batch_size,
    )

    if not hasattr(db, "rag_chunks") or db.rag_chunks is None:
        logger.warning("Database or 'rag_chunks' collection not available.")
        return {"total_found": 0, "migrated": 0, "skipped": 0, "errors": 0}

    # Query for chunks not yet migrated to the target model
    query = {
        "$or": [
            {"embedding_model": {"$ne": target_model}},
            {"embedding_model": {"$exists": False}},
            {"embedding_dim": {"$ne": target_dim}},
        ]
    }

    cursor = db.rag_chunks.find(query)
    chunks_to_migrate: list[dict[str, Any]] = await cursor.to_list(length=10000)
    total_found = len(chunks_to_migrate)

    # Count total chunks in collection for reporting
    try:
        total_in_db = await db.rag_chunks.count_documents({})
    except Exception:
        total_in_db = total_found
    already_migrated = max(0, total_in_db - total_found)

    logger.info(
        "Found %d chunks to migrate (%d already up to date with %s)",
        total_found,
        already_migrated,
        target_model,
    )

    if total_found == 0:
        logger.info("All chunks are already on %s. Nothing to do.", target_model)
        return {
            "total_found": 0,
            "migrated": 0,
            "skipped": already_migrated,
            "errors": 0,
        }

    migrated_count = 0
    error_count = 0

    for i in range(0, total_found, batch_size):
        batch = chunks_to_migrate[i : i + batch_size]
        texts = [c.get("content", "") for c in batch]

        try:
            embeddings = await embedding_service.embed_texts(texts)
            for chunk, emb in zip(batch, embeddings):
                dim = len(emb)
                await db.rag_chunks.update_one(
                    {"_id": chunk["_id"]},
                    {
                        "$set": {
                            "embedding": emb,
                            "embedding_model": target_model,
                            "embedding_dim": dim,
                        }
                    },
                )
                migrated_count += 1
            logger.info("Migrated %d / %d chunks...", migrated_count, total_found)
        except Exception as exc:
            logger.error("Failed to re-embed batch %d-%d: %s", i, i + len(batch), exc)
            error_count += len(batch)

    logger.info(
        "Re-embedding migration completed: %d migrated, %d errors, %d already up to date.",
        migrated_count,
        error_count,
        already_migrated,
    )
    return {
        "total_found": total_found,
        "migrated": migrated_count,
        "skipped": already_migrated,
        "errors": error_count,
    }


async def main() -> None:
    try:
        await connect_db()
        await reembed_all_chunks()
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main())
