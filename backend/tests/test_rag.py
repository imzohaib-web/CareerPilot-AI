"""Tests for RAG schemas, services, and REST API endpoints."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

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
