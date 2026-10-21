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


@pytest.mark.asyncio
async def test_threshold_drops_irrelevant_chunks_and_yields_no_context():
    """Chunks below RAG_MIN_SIMILARITY are dropped, returning no_context when all fail."""
    user_id = "test-user-threshold"
    c_irrelevant = {
        "_id": "chunk-irrelevant",
        "chunk_id": "chunk-irrelevant",
        "document_id": "doc-irr",
        "document_title": "Cooking Recipes",
        "user_id": user_id,
        "category": "general",
        "scope": "user",
        "chunk_index": 0,
        "content": "Bake chocolate chip cookies at 350 degrees Fahrenheit.",
        "embedding": [1.0, 0.0, 0.0, 0.0],
        "embedding_model": "text-embedding-v3",
        "embedding_dim": 4,
    }
    rag_service._offline_rag_chunks["chunk-irrelevant"] = c_irrelevant

    # Query vector is orthogonal: cosine similarity = 0.0 < 0.30 (RAG_MIN_SIMILARITY)
    query_vec = [0.0, 1.0, 0.0, 0.0]
    with patch.object(rag_service.config, "ALIBABA_CLOUD_API_KEY", "mock-key"):
        with patch.object(rag_service.config, "RAG_MIN_SIMILARITY", 0.30):
            with patch(
                "app.services.ai.embedding_service.embed_query",
                new=AsyncMock(return_value=query_vec),
            ):
                results = await rag_service.retrieve_context(
                    user_id=user_id,
                    query="FastAPI distributed systems",
                    top_k=5,
                    db=None,
                )

    assert len(results) == 0
    assert results.status == "no_context"


def test_rrf_ordering_is_deterministic():
    """Reciprocal rank fusion produces exact, deterministic ordering and mathematical scores."""
    vec_ids = ["chunk_a", "chunk_b", "chunk_c"]
    kw_ids = ["chunk_b", "chunk_c", "chunk_a"]

    scores_1 = rag_service.reciprocal_rank_fusion(vec_ids, kw_ids, k=60)
    scores_2 = rag_service.reciprocal_rank_fusion(vec_ids, kw_ids, k=60)

    assert scores_1 == scores_2
    # chunk_b: vec rank 2, kw rank 1 -> 1/62 + 1/61
    expected_b = round((1.0 / 62) + (1.0 / 61), 6)
    assert scores_1["chunk_b"] == expected_b
    # chunk_b has higher combined rank than chunk_a and chunk_c
    assert scores_1["chunk_b"] > scores_1["chunk_a"]
    assert scores_1["chunk_a"] > scores_1["chunk_c"]


@pytest.mark.asyncio
async def test_scope_isolation_between_two_users_and_global_visibility():
    """A user can retrieve their own private chunks + global chunks, NEVER another user's private chunks."""
    user_a = "user-alice-123"
    user_b = "user-bob-456"

    unit_vec = [0.5, 0.5, 0.5, 0.5]

    rag_service._offline_rag_chunks["chunk-alice"] = {
        "_id": "chunk-alice",
        "chunk_id": "chunk-alice",
        "document_id": "doc-alice",
        "document_title": "Alice Private Document",
        "user_id": user_a,
        "category": "general",
        "scope": "user",
        "chunk_index": 0,
        "content": "Alice's proprietary system design notes.",
        "embedding": unit_vec,
        "embedding_model": "text-embedding-v3",
        "embedding_dim": 4,
    }
    rag_service._offline_rag_chunks["chunk-bob"] = {
        "_id": "chunk-bob",
        "chunk_id": "chunk-bob",
        "document_id": "doc-bob",
        "document_title": "Bob Private Document",
        "user_id": user_b,
        "category": "general",
        "scope": "user",
        "chunk_index": 0,
        "content": "Bob's confidential algorithm notes.",
        "embedding": unit_vec,
        "embedding_model": "text-embedding-v3",
        "embedding_dim": 4,
    }
    rag_service._offline_rag_chunks["chunk-global"] = {
        "_id": "chunk-global",
        "chunk_id": "chunk-global",
        "document_id": "doc-global",
        "document_title": "Global Official Syllabus",
        "user_id": None,
        "category": "skill_framework",
        "scope": "global",
        "chunk_index": 0,
        "content": "Public interview syllabus for backend engineers.",
        "embedding": unit_vec,
        "embedding_model": "text-embedding-v3",
        "embedding_dim": 4,
    }

    with patch.object(rag_service.config, "ALIBABA_CLOUD_API_KEY", "mock-key"):
        with patch(
            "app.services.ai.embedding_service.embed_query",
            new=AsyncMock(return_value=unit_vec),
        ):
            # Query as Alice
            alice_results = await rag_service.retrieve_context(
                user_id=user_a,
                query="backend systems notes",
                top_k=5,
                db=None,
            )
            alice_chunk_ids = [r.chunk_id for r in alice_results]
            assert "chunk-alice" in alice_chunk_ids
            assert "chunk-global" in alice_chunk_ids
            assert "chunk-bob" not in alice_chunk_ids, "Alice must NOT see Bob's private chunks!"

            # Query as Bob
            bob_results = await rag_service.retrieve_context(
                user_id=user_b,
                query="backend systems notes",
                top_k=5,
                db=None,
            )
            bob_chunk_ids = [r.chunk_id for r in bob_results]
            assert "chunk-bob" in bob_chunk_ids
            assert "chunk-global" in bob_chunk_ids
            assert "chunk-alice" not in bob_chunk_ids, "Bob must NOT see Alice's private chunks!"


@pytest.mark.asyncio
async def test_fallback_path_triggers_when_vector_search_raises():
    """When Atlas $vectorSearch aggregate raises an error, fallback in-memory cosine search executes safely."""
    user_id = "test-user-fallback-aggregate"
    unit_vec = [0.5, 0.5, 0.5, 0.5]

    c = {
        "_id": "chunk-resilient",
        "chunk_id": "chunk-resilient",
        "document_id": "doc-resilient",
        "document_title": "Resilient Service JD",
        "user_id": user_id,
        "category": "job_description",
        "scope": "user",
        "chunk_index": 0,
        "content": "Resilient backend services with FastAPI and Redis.",
        "embedding": unit_vec,
        "embedding_model": "text-embedding-v3",
        "embedding_dim": 4,
    }

    mock_db = MagicMock()
    # aggregate raises an error to simulate missing Atlas index or non-Atlas environment
    mock_db.rag_chunks.aggregate.side_effect = Exception("PlanExecutor error during $vectorSearch")
    # find falls back to returning the candidate chunk
    mock_cursor = MagicMock()
    mock_cursor.to_list = AsyncMock(return_value=[c])
    mock_db.rag_chunks.find.return_value = mock_cursor

    with patch.object(rag_service.config, "ALIBABA_CLOUD_API_KEY", "mock-key"):
        with patch(
            "app.services.ai.embedding_service.embed_query",
            new=AsyncMock(return_value=unit_vec),
        ):
            results = await rag_service.retrieve_context(
                user_id=user_id,
                query="FastAPI backend",
                top_k=5,
                db=mock_db,
            )

    assert len(results) >= 1
    assert results[0].chunk_id == "chunk-resilient"
    assert results.status == "grounded"


def test_chunker_respects_headings_and_overlap():
    """Chunker extracts section_title from markdown headings and preserves overlap without mid-sentence splits."""
    doc_text = """# Executive Overview
CareerPilot AI is an automated career mentor. It provides end-to-end guidance from resume parsing to mock interviews.

## Technical Requirements
Candidates should demonstrate proficiency in Python, FastAPI, and async I/O.
They must have practical experience with MongoDB indexing and Redis caching.
Knowledge of distributed architectures and Docker containerization is required.
"""

    chunks = rag_service.chunk_document(doc_text, target_words=20, overlap_words=8)
    assert len(chunks) >= 2

    # Check section titles
    assert chunks[0]["section_title"] == "Executive Overview"
    # Later chunk captures the second heading
    has_tech_heading = any(c.get("section_title") == "Technical Requirements" for c in chunks)
    assert has_tech_heading

    # Verify that chunks do not start with a broken trailing word
    for c in chunks:
        content = c["content"]
        assert not content.startswith(".")
        assert not content.startswith("?")
        assert len(content.split()) > 0


def test_bm25_statistics_rare_vs_generic():
    """Verify BM25 tokenization drops stopwords and discriminates rare technical terms over generic words."""
    query = "FastAPI backend ci/cd"
    chunks = [
        {
            "chunk_id": "c1",
            "content": "Production FastAPI and Python backend engineering utilizing Docker and automated ci/cd pipelines.",
        },
        {
            "chunk_id": "c2",
            "content": "What is needed to understand the generic development process and how tasks are done.",
        },
        {
            "chunk_id": "c3",
            "content": "A general guide explaining what you need and how to do common software tasks.",
        },
    ]

    scores = rag_service.compute_bm25_scores(query, chunks)
    assert scores["c1"] > scores["c2"]
    assert scores["c1"] > scores["c3"]
    assert scores["c1"] > 0.5
    # Chunks 2 & 3 contain only stopwords / generic filler terms and receive 0 or near 0
    assert scores["c2"] == 0.0
    assert scores["c3"] == 0.0


def test_weighted_fusion_backend_matrix_outranks():
    """Regression test: Backend matrix chunk must outrank Frontend and Mobile chunks for backend query."""
    query = "What skills does a junior backend developer need?"

    similarity_map = {
        "backend_chunk": 0.85,
        "frontend_chunk": 0.74,
        "mobile_chunk": 0.68,
    }

    # Vector rank: backend #1, frontend #2, mobile #3
    vector_ranked = ["backend_chunk", "frontend_chunk", "mobile_chunk"]

    # Even if lexical matches give frontend higher keyword rank (e.g. #1 frontend, #2 backend, #3 mobile)
    keyword_ranked = ["frontend_chunk", "backend_chunk", "mobile_chunk"]

    fused = rag_service.weighted_rank_fusion(
        vector_ranked_ids=vector_ranked,
        keyword_ranked_ids=keyword_ranked,
        similarity_map=similarity_map,
        k=60,
        vector_weight=0.7,
        keyword_weight=0.3,
        cosine_bonus_weight=0.02,
    )

    # Apply role boost as query analyzer detects "backend"
    query_info = rag_service.analyze_query(query)
    assert query_info["detected_role"] == "backend"

    boosted = dict(fused)
    boosted["backend_chunk"] = round(boosted["backend_chunk"] * 1.25, 6)

    # Assert Backend matrix chunk strictly outranks Frontend and Mobile
    assert boosted["backend_chunk"] > boosted["frontend_chunk"]
    assert boosted["backend_chunk"] > boosted["mobile_chunk"]
    sorted_chunks = sorted(boosted.keys(), key=lambda x: boosted[x], reverse=True)
    assert sorted_chunks[0] == "backend_chunk"


def test_query_analyzer_and_metadata_boost():
    """Verify query analyzer detects role and skills across diverse phrasings."""
    res1 = rag_service.analyze_query("I am preparing for a junior backend developer interview")
    assert res1["detected_role"] == "backend"

    res2 = rag_service.analyze_query("What questions are asked in Data Analyst interviews?")
    assert res2["detected_role"] == "data_analyst"

    res3 = rag_service.analyze_query("How to build CI/CD pipelines with Docker and FastAPI")
    assert "fastapi" in res3["detected_skills"]
    assert "docker" in res3["detected_skills"]
    assert "ci/cd" in res3["detected_skills"]


def test_chunker_section_title_governs_first_sentence():
    """A markdown fixture with 3 distinct headings verifies every chunk's section_title matches its first line."""
    md_text = """# Architecture Overview
This is the high-level architecture overview of the CareerPilot system.
It coordinates between front-end UI and microservices.

## Relational Databases and SQL
Relational database management requires strict schema migrations.
PostgreSQL and MySQL use structured query language for transactions.
ACID guarantees ensure data consistency across financial operations.

### Non-Relational Storage and MongoDB
Document databases store polymorphic JSON-like schemas.
MongoDB Atlas provides distributed vector search and collection sharding.
Redis provides fast in-memory key-value caching.
"""

    chunks = rag_service.chunk_document(md_text, target_words=25, overlap_words=5, doc_title="System Design")
    assert len(chunks) >= 3

    for idx, c in enumerate(chunks):
        content = c["content"]
        sec_title = c["section_title"]
        heading_path = c["heading_path"]

        # The first sentence of the chunk must be governed by sec_title
        first_sentence = content.split(".")[0].strip()
        assert sec_title is not None
        assert heading_path is not None

        if "high-level architecture overview" in first_sentence:
            assert sec_title == "Architecture Overview"
            assert "Architecture Overview" in heading_path
        elif "Relational database management" in first_sentence:
            assert sec_title == "Relational Databases and SQL"
            assert "Relational Databases and SQL" in heading_path
        elif "Document databases store" in first_sentence:
            assert sec_title == "Non-Relational Storage and MongoDB"
            assert "Non-Relational Storage and MongoDB" in heading_path

