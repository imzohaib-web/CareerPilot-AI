"""Tests for RAG schemas, services, and REST API endpoints."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from bson import ObjectId
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.schemas.rag import (
    ChunkSource,
    DocumentInfo,
    DocumentIngestRequest,
    DocumentUploadResponse,
    RAGChatRequest,
    RAGChatResponse,
    RAGQueryRequest,
    RetrievalResult,
)
from app.services import rag_service
from app.services.dependencies import get_current_user

FAKE_USER_ID = ObjectId()
FAKE_USER = {
    "_id": FAKE_USER_ID,
    "name": "Test User",
    "email": "test@example.com",
    "password_hash": "hash",
    "created_at": datetime.now(timezone.utc),
}


def _override_user():
    return {get_current_user: lambda: FAKE_USER}


def _make_api_client(overrides: dict | None = None) -> AsyncClient:
    transport = ASGITransport(app=app)
    client = AsyncClient(transport=transport, base_url="http://testserver")
    if overrides:
        app.dependency_overrides.update(overrides)
    return client


class TestRAGUnitFunctions:
    def test_chunk_text_small(self):
        text = "Short text example for testing chunking strategy."
        chunks = rag_service.chunk_text(text, chunk_size=100)
        assert len(chunks) == 1
        assert chunks[0] == text

    def test_chunk_text_overlapping(self):
        words = ["word"] * 500
        text = " ".join(words)
        chunks = rag_service.chunk_text(text, chunk_size=200, overlap=50)
        assert len(chunks) >= 3

    def test_vector_and_cosine_similarity(self):
        v1 = rag_service.compute_text_vector("FastAPI Python backend web development")
        v2 = rag_service.compute_text_vector("Python FastAPI web development framework")
        v3 = rag_service.compute_text_vector("Unrelated recipe about chocolate chip cookies")

        sim_high = rag_service.cosine_similarity(v1, v2)
        sim_low = rag_service.cosine_similarity(v1, v3)

        assert sim_high > sim_low
        assert sim_high > 0.4


class TestRAGSchemas:
    def test_document_ingest_schema(self):
        req = DocumentIngestRequest(
            title="Senior Backend Engineer JD",
            content="We are looking for a Senior Backend Engineer proficient in Python, FastAPI, and Docker.",
            category="job_description",
        )
        assert req.title == "Senior Backend Engineer JD"
        assert req.category == "job_description"

    def test_rag_query_schema(self):
        query = RAGQueryRequest(query="FastAPI skills", top_k=5)
        assert query.query == "FastAPI skills"
        assert query.top_k == 5


@pytest.mark.asyncio
async def test_upload_document_endpoint():
    app.dependency_overrides.clear()
    app.dependency_overrides.update(_override_user())

    mock_response = DocumentUploadResponse(
        document_id="doc-123",
        title="Senior Python Developer JD",
        chunk_count=2,
        message="Successfully ingested document",
    )

    with patch(
        "app.services.rag_service.ingest_document",
        new=AsyncMock(return_value=mock_response),
    ):
        async with _make_api_client() as client:
            response = await client.post(
                "/api/rag/documents/upload",
                json={
                    "title": "Senior Python Developer JD",
                    "content": "We require Python, FastAPI, PostgreSQL, Docker, and Kubernetes expertise.",
                    "category": "job_description",
                },
            )

    assert response.status_code == 201
    data = response.json()
    assert data["document_id"] == "doc-123"
    assert data["chunk_count"] == 2
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_list_documents_endpoint():
    app.dependency_overrides.clear()
    app.dependency_overrides.update(_override_user())

    mock_docs = [
        DocumentInfo(
            id="doc-1",
            user_id=str(FAKE_USER_ID),
            title="Python Developer JD",
            category="job_description",
            chunk_count=3,
            content_length=1200,
            created_at=datetime.now(timezone.utc),
        )
    ]

    with patch(
        "app.services.rag_service.list_user_documents",
        new=AsyncMock(return_value=mock_docs),
    ):
        async with _make_api_client() as client:
            response = await client.get("/api/rag/documents")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "Python Developer JD"
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_query_knowledge_base_endpoint():
    app.dependency_overrides.clear()
    app.dependency_overrides.update(_override_user())

    mock_chunks = [
        ChunkSource(
            chunk_id="c-1",
            document_id="doc-1",
            document_title="Python Developer JD",
            chunk_index=0,
            content="Strong proficiency in Python, FastAPI, and async I/O.",
            similarity_score=0.88,
        )
    ]

    with patch(
        "app.services.rag_service.retrieve_context",
        new=AsyncMock(return_value=mock_chunks),
    ):
        async with _make_api_client() as client:
            response = await client.post(
                "/api/rag/query",
                json={"query": "FastAPI async", "top_k": 3},
            )

    assert response.status_code == 200
    data = response.json()
    assert data["total_retrieved"] == 1
    assert data["chunks"][0]["similarity_score"] == 0.88
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_rag_chat_endpoint():
    app.dependency_overrides.clear()
    app.dependency_overrides.update(_override_user())

    mock_chat_response = RAGChatResponse(
        reply="Based on your uploaded job description, the top required skills are Python and FastAPI.",
        sources=[
            ChunkSource(
                chunk_id="c-1",
                document_id="doc-1",
                document_title="Python Developer JD",
                chunk_index=0,
                content="Required skills: Python, FastAPI, Docker.",
                similarity_score=0.92,
            )
        ],
        model_used="qwen3.7-plus",
    )

    with patch(
        "app.services.rag_service.grounded_chat",
        new=AsyncMock(return_value=mock_chat_response),
    ):
        async with _make_api_client() as client:
            response = await client.post(
                "/api/rag/chat",
                json={"message": "What skills are required for this role?", "top_k": 3},
            )

    assert response.status_code == 200
    data = response.json()
    assert "Python and FastAPI" in data["reply"]
    assert len(data["sources"]) == 1
    assert data["model_used"] == "qwen3.7-plus"
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_fallback_marks_hash_256_fallback():
    """When the embedding API fails or API key is missing, fallback uses hash-256-fallback."""
    user_id = str(FAKE_USER_ID)
    payload = DocumentIngestRequest(
        title="Test Offline Document",
        content="This is sample content for testing offline fallback embedding marking.",
        category="general",
    )

    with patch.object(rag_service.config, "ALIBABA_CLOUD_API_KEY", ""):
        res = await rag_service.ingest_document(user_id=user_id, payload=payload, db=None)

    assert res.chunk_count >= 1
    chunk = next(c for c in rag_service._offline_rag_chunks.values() if c.get("document_id") == res.document_id)
    assert chunk["embedding_model"] == "hash-256-fallback"
    assert chunk["embedding_dim"] == 256
    assert len(chunk["embedding"]) == 256


@pytest.mark.asyncio
async def test_ingest_uses_real_semantic_embeddings():
    """When embedding API succeeds, chunk is marked with text-embedding-v3 and dimension 1024."""
    user_id = str(FAKE_USER_ID)
    payload = DocumentIngestRequest(
        title="Test Real Embedding Document",
        content="Testing real DashScope semantic embedding indexing.",
        category="job_description",
    )

    mock_vec = [0.05] * 1024
    norm = sum(x * x for x in mock_vec) ** 0.5
    normalized_vec = [x / norm for x in mock_vec]

    with patch.object(rag_service.config, "ALIBABA_CLOUD_API_KEY", "mock-key"):
        with patch(
            "app.services.ai.embedding_service.embed_texts",
            new=AsyncMock(return_value=[normalized_vec]),
        ):
            res = await rag_service.ingest_document(user_id=user_id, payload=payload, db=None)

    chunk = next(c for c in rag_service._offline_rag_chunks.values() if c.get("document_id") == res.document_id)
    assert chunk["embedding_model"] == "text-embedding-v3"
    assert chunk["embedding_dim"] == 1024
    assert len(chunk["embedding"]) == 1024


@pytest.mark.asyncio
async def test_mismatched_model_chunks_excluded_from_search():
    """Never mix vectors of different models: mismatched model chunks are excluded."""
    user_id = str(FAKE_USER_ID)

    doc_id = "test-doc-mismatch"
    c1 = {
        "_id": "chunk-hash",
        "chunk_id": "chunk-hash",
        "document_id": doc_id,
        "document_title": "Old Doc",
        "user_id": user_id,
        "category": "general",
        "chunk_index": 0,
        "content": "Python backend engineer role with FastAPI",
        "embedding": rag_service.compute_text_vector("Python backend engineer role with FastAPI"),
        "embedding_model": "hash-256-fallback",
        "embedding_dim": 256,
    }
    c2 = {
        "_id": "chunk-v3",
        "chunk_id": "chunk-v3",
        "document_id": doc_id,
        "document_title": "New Doc",
        "user_id": user_id,
        "category": "general",
        "chunk_index": 1,
        "content": "Python backend engineer role with FastAPI",
        "embedding": [1.0 / (1024**0.5)] * 1024,
        "embedding_model": "text-embedding-v3",
        "embedding_dim": 1024,
    }
    rag_service._offline_rag_chunks["chunk-hash"] = c1
    rag_service._offline_rag_chunks["chunk-v3"] = c2

    query_vec = [1.0 / (1024**0.5)] * 1024
    with patch.object(rag_service.config, "ALIBABA_CLOUD_API_KEY", "mock-key"):
        with patch(
            "app.services.ai.embedding_service.embed_query",
            new=AsyncMock(return_value=query_vec),
        ):
            results = await rag_service.retrieve_context(
                user_id=user_id,
                query="Python backend engineer",
                top_k=5,
                db=None,
            )

    retrieved_ids = [r.chunk_id for r in results]
    assert "chunk-v3" in retrieved_ids
    assert "chunk-hash" not in retrieved_ids


@pytest.mark.asyncio
async def test_query_chunk_dimension_consistency():
    """Dimension and model consistency must hold in both directions."""
    user_id = str(FAKE_USER_ID)

    doc_id = "test-doc-dim-consistency"
    c1 = {
        "_id": "chunk-hash-only",
        "chunk_id": "chunk-hash-only",
        "document_id": doc_id,
        "document_title": "Hash Doc",
        "user_id": user_id,
        "category": "general",
        "chunk_index": 0,
        "content": "FastAPI async development",
        "embedding": rag_service.compute_text_vector("FastAPI async development"),
        "embedding_model": "hash-256-fallback",
        "embedding_dim": 256,
    }
    c2 = {
        "_id": "chunk-v3-only",
        "chunk_id": "chunk-v3-only",
        "document_id": doc_id,
        "document_title": "V3 Doc",
        "user_id": user_id,
        "category": "general",
        "chunk_index": 1,
        "content": "FastAPI async development",
        "embedding": [1.0 / (1024**0.5)] * 1024,
        "embedding_model": "text-embedding-v3",
        "embedding_dim": 1024,
    }
    rag_service._offline_rag_chunks["chunk-hash-only"] = c1
    rag_service._offline_rag_chunks["chunk-v3-only"] = c2

    # Query in offline fallback mode (no key) -> query model is hash-256-fallback
    with patch.object(rag_service.config, "ALIBABA_CLOUD_API_KEY", ""):
        results = await rag_service.retrieve_context(
            user_id=user_id,
            query="FastAPI",
            top_k=5,
            db=None,
        )

    retrieved_ids = [r.chunk_id for r in results]
    assert "chunk-hash-only" in retrieved_ids
    assert "chunk-v3-only" not in retrieved_ids


@pytest.mark.asyncio
async def test_reembed_migration_script():
    """Verify scripts/reembed_chunks.py is idempotent and updates only mismatched chunks."""
    from scripts.reembed_chunks import reembed_all_chunks

    mock_db = MagicMock()
    mock_chunks = [
        {
            "_id": "c1",
            "content": "Text chunk 1",
            "embedding": [0.1] * 256,
            "embedding_model": "hash-256-fallback",
            "embedding_dim": 256,
        },
        {
            "_id": "c2",
            "content": "Text chunk 2",
            "embedding": [0.2] * 256,
        },
    ]

    mock_cursor = MagicMock()
    mock_cursor.to_list = AsyncMock(return_value=mock_chunks)
    mock_db.rag_chunks.find = MagicMock(return_value=mock_cursor)
    mock_db.rag_chunks.count_documents = AsyncMock(return_value=3)
    mock_db.rag_chunks.update_one = AsyncMock()

    mock_embeddings = [[0.05] * 1024, [0.06] * 1024]
    with patch(
        "app.services.ai.embedding_service.embed_texts",
        new=AsyncMock(return_value=mock_embeddings),
    ):
        result = await reembed_all_chunks(db=mock_db)

    assert result["migrated"] == 2
    assert result["skipped"] == 1
    assert mock_db.rag_chunks.update_one.call_count == 2
