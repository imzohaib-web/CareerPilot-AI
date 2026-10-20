"""Unit tests for the verify_vector_search diagnostic script.

Covers:
1. Missing index (Index check FAILs)
2. Wrong dimension (Index check FAILs on dimension mismatch)
3. Empty results with existing chunks (Vector search check FAILs)
4. Healthy run (All checks PASS with exit code 0)
5. Graceful handling of non-Atlas or local MongoDB deployments
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app import config
from app.services.rag_service import (
    ATLAS_VECTOR_INDEX_NAME,
    VECTOR_EMBEDDING_FIELD,
    VECTOR_FILTER_FIELDS,
)
from scripts.verify_vector_search import (
    check_config,
    check_data,
    check_index,
    check_query_embedding,
    check_vector_search,
    run_diagnostics,
)


def _make_mock_db(
    total_chunks: int = 10,
    matching_chunks: int = 10,
    mismatched_chunks: int = 0,
    indexes: list | None = None,
):
    """Helper to build a mock AsyncIOMotorDatabase with realistic collections."""
    db = MagicMock()
    db.command = AsyncMock(return_value={"ok": 1})

    chunks_col = MagicMock()

    # Async count_documents mock
    async def mock_count(filter_dict=None):
        filter_dict = filter_dict or {}
        if "$or" in filter_dict:
            return mismatched_chunks
        if "embedding_model" in filter_dict:
            return matching_chunks
        if filter_dict.get("scope") == "global":
            return total_chunks // 2
        if filter_dict.get("scope") == "user":
            return total_chunks // 2
        return total_chunks

    chunks_col.count_documents = AsyncMock(side_effect=mock_count)

    # Async aggregate mock (for $listSearchIndexes)
    async def mock_to_list(length=100):
        return indexes if indexes is not None else []

    cursor = MagicMock()
    cursor.to_list = AsyncMock(side_effect=mock_to_list)
    chunks_col.aggregate = MagicMock(return_value=cursor)

    db.rag_chunks = chunks_col
    return db


def _make_valid_index_doc(
    index_name: str = ATLAS_VECTOR_INDEX_NAME,
    dimensions: int = 1024,
    similarity: str = "cosine",
    include_all_filters: bool = True,
):
    """Generate a valid Atlas Vector Search index definition document."""
    fields = [
        {
            "type": "vector",
            "path": VECTOR_EMBEDDING_FIELD,
            "numDimensions": dimensions,
            "similarity": similarity,
        }
    ]
    if include_all_filters:
        for f in VECTOR_FILTER_FIELDS:
            fields.append({"type": "filter", "path": f})

    return {
        "name": index_name,
        "type": "vectorSearch",
        "status": "READY",
        "queryable": True,
        "latestDefinition": {"fields": fields},
    }


# ── Test 1: Healthy Run ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_verify_vector_search_healthy_run():
    valid_index = _make_valid_index_doc(dimensions=config.EMBEDDING_DIMENSIONS)
    mock_db = _make_mock_db(total_chunks=10, indexes=[valid_index])

    mock_vec = [0.05] * config.EMBEDDING_DIMENSIONS
    mock_search_results = [
        {
            "chunk_id": "c1",
            "document_title": "Junior Backend Guide",
            "scope": "global",
            "vector_score": 0.88,
            "content": "Python, FastAPI, and PostgreSQL are foundational skills for backend engineers.",
        },
        {
            "chunk_id": "c2",
            "document_title": "Database Guide",
            "scope": "global",
            "vector_score": 0.82,
            "content": "Indexing and transaction isolation levels in PostgreSQL.",
        },
    ]

    with patch.object(config, "MONGODB_URI", "mongodb+srv://mock.atlas/db"):
        with patch.object(config, "ALIBABA_CLOUD_API_KEY", "mock-key-123"):
            with patch("app.services.ai.embedding_service.embed_query", AsyncMock(return_value=mock_vec)):
                with patch("app.services.rag_service.execute_vector_search", AsyncMock(return_value=mock_search_results)):
                    results, exit_code = await run_diagnostics(
                        query="What skills does a junior backend developer need?",
                        scope="global",
                        db=mock_db,
                    )

                    assert exit_code == 0
                    statuses = {r.name: r.status for r in results}
                    assert statuses["Config Check"] == "PASS"
                    assert statuses["Connection Check"] == "PASS"
                    assert statuses["Data Check"] == "PASS"
                    assert statuses["Index Check"] == "PASS"
                    assert statuses["Query Embedding Check"] == "PASS"
                    assert statuses["Vector Search Check"] == "PASS"
                    assert statuses["Isolation Check"] == "PASS"
                    assert statuses["Fallback Check"] == "PASS"


# ── Test 2: Missing Index ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_verify_vector_search_missing_index():
    # Empty index list -> index does not exist
    mock_db = _make_mock_db(total_chunks=10, indexes=[])

    result = await check_index(mock_db)
    assert result.status == "FAIL"
    assert "not found" in result.details.lower()

    with patch.object(config, "MONGODB_URI", "mongodb+srv://mock.atlas/db"):
        with patch.object(config, "ALIBABA_CLOUD_API_KEY", "mock-key-123"):
            results, exit_code = await run_diagnostics(db=mock_db)
            assert exit_code == 1
            idx_check = next(r for r in results if r.name == "Index Check")
            assert idx_check.status == "FAIL"


# ── Test 3: Wrong Dimension ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_verify_vector_search_wrong_dimension():
    # Index has 768 dimensions while config specifies 1024
    bad_index = _make_valid_index_doc(dimensions=768)
    mock_db = _make_mock_db(total_chunks=10, indexes=[bad_index])

    result = await check_index(mock_db)
    assert result.status == "FAIL"
    assert "dimension mismatch" in result.details.lower()

    with patch.object(config, "MONGODB_URI", "mongodb+srv://mock.atlas/db"):
        with patch.object(config, "ALIBABA_CLOUD_API_KEY", "mock-key-123"):
            results, exit_code = await run_diagnostics(db=mock_db)
            assert exit_code == 1
            idx_check = next(r for r in results if r.name == "Index Check")
            assert idx_check.status == "FAIL"


# ── Test 4: Empty Results with Existing Chunks ─────────────────────────────

@pytest.mark.asyncio
async def test_verify_vector_search_empty_results():
    mock_db = _make_mock_db(total_chunks=25)
    query_vec = [0.1] * config.EMBEDDING_DIMENSIONS

    with patch("app.services.rag_service.execute_vector_search", AsyncMock(return_value=[])):
        result, res_list, _ = await check_vector_search(
            db=mock_db,
            query_vec=query_vec,
            scope="global",
            user_id=None,
            limit=5,
            total_chunks=25,
        )
        assert result.status == "FAIL"
        assert "zero vector search results returned" in result.details.lower()


# ── Test 5: Graceful Handling on Non-Atlas Deployments ──────────────────────

@pytest.mark.asyncio
async def test_verify_vector_search_non_atlas_graceful():
    mock_db = MagicMock()
    mock_db.command = AsyncMock(return_value={"ok": 1})

    chunks_col = MagicMock()
    chunks_col.count_documents = AsyncMock(return_value=10)
    # Simulate non-Atlas Mongo where $listSearchIndexes fails with CommandNotFound
    chunks_col.aggregate = MagicMock(side_effect=Exception("no such command: $listSearchIndexes"))
    mock_db.rag_chunks = chunks_col

    result = await check_index(mock_db)
    assert result.status == "WARN"
    assert "not supported on this deployment" in result.details
