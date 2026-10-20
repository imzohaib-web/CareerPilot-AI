"""Unit tests for the curated knowledge base seeder.

Verifies:
1. Front matter parsing (valid YAML, missing delimiters, malformed YAML, empty body).
2. Idempotency (second run makes ZERO embedding calls).
3. Graceful handling of malformed files (skips and logs without raising).
4. Pruning of orphaned documents when files are removed.
5. Knowledge base statistics generation and REST API endpoint.
"""

from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services import knowledge_seeder, rag_service
from app.services.knowledge_seeder import (
    get_knowledge_base_stats,
    parse_knowledge_file,
    seed_knowledge,
)


@pytest.fixture(autouse=True)
def clean_offline_storage():
    """Ensure in-memory offline RAG cache is clean before and after each test."""
    rag_service._offline_rag_docs.clear()
    rag_service._offline_rag_chunks.clear()
    yield
    rag_service._offline_rag_docs.clear()
    rag_service._offline_rag_chunks.clear()


# ── 1. Front Matter Parser Tests ───────────────────────────────────────────

def test_parse_knowledge_file_success(tmp_path: Path):
    doc_path = tmp_path / "valid_doc.md"
    doc_path.write_text(
        "---\n"
        "title: \"Test Document Title\"\n"
        "category: \"test_category\"\n"
        "role: \"backend\"\n"
        "source_note: \"Verified test reference\"\n"
        "---\n\n"
        "# Test Document Title\n\n"
        "This is the comprehensive body of the test document for parsing.\n",
        encoding="utf-8",
    )

    info = parse_knowledge_file(doc_path)
    assert info is not None
    assert info["file_name"] == "valid_doc.md"
    assert info["title"] == "Test Document Title"
    assert info["category"] == "test_category"
    assert info["role"] == "backend"
    assert info["source_note"] == "Verified test reference"
    assert "This is the comprehensive body" in info["body"]
    assert len(info["content_hash"]) == 64  # SHA-256


def test_parse_knowledge_file_missing_front_matter(tmp_path: Path):
    doc_path = tmp_path / "no_fm.md"
    doc_path.write_text(
        "# Just a Header\n\nPlain text content without YAML delimiters.",
        encoding="utf-8",
    )
    info = parse_knowledge_file(doc_path)
    assert info is None


def test_parse_knowledge_file_missing_closing_delimiter(tmp_path: Path):
    doc_path = tmp_path / "unclosed.md"
    doc_path.write_text(
        "---\ntitle: Unclosed\ncategory: test\nbody without closing dashes",
        encoding="utf-8",
    )
    info = parse_knowledge_file(doc_path)
    assert info is None


def test_parse_knowledge_file_malformed_yaml(tmp_path: Path):
    doc_path = tmp_path / "bad_yaml.md"
    doc_path.write_text(
        "---\n"
        "title: [invalid yaml unclosed bracket\n"
        "category: %%%\n"
        "---\n\n"
        "# Body Header\nSome body text.\n",
        encoding="utf-8",
    )
    info = parse_knowledge_file(doc_path)
    assert info is None


def test_parse_knowledge_file_empty_body(tmp_path: Path):
    doc_path = tmp_path / "empty_body.md"
    doc_path.write_text(
        "---\ntitle: Empty Body\ncategory: test\n---\n",
        encoding="utf-8",
    )
    info = parse_knowledge_file(doc_path)
    assert info is None


# ── 2. Idempotency & Zero Embedding Calls on Second Run ────────────────────

@pytest.mark.asyncio
async def test_seeder_idempotency_zero_embedding_calls_on_second_run(tmp_path: Path):
    # Create 2 test markdown files
    file_1 = tmp_path / "doc_1.md"
    file_1.write_text(
        "---\ntitle: Doc One\ncategory: role_matrix\nrole: backend\n---\n\n"
        "# Doc One\n\nMust have skills for backend developers include Python and databases.",
        encoding="utf-8",
    )

    file_2 = tmp_path / "doc_2.md"
    file_2.write_text(
        "---\ntitle: Doc Two\ncategory: interview_guide\nrole: general\n---\n\n"
        "# Doc Two\n\nBehavioral questions require the STAR method for clear answers.",
        encoding="utf-8",
    )

    fake_embeddings = [[0.1] * 256]
    embed_mock = AsyncMock(return_value=fake_embeddings)

    with patch("app.services.ai.embedding_service.embed_texts", embed_mock):
        # First Run: Seeds both files
        result_1 = await seed_knowledge(knowledge_dir=tmp_path, offline=True)
        assert result_1["status"] == "success"
        assert result_1["seeded"] == 2
        assert result_1["skipped"] == 0
        first_run_calls = embed_mock.call_count
        assert first_run_calls > 0

        # Second Run: All files unchanged -> 0 new embedding calls
        result_2 = await seed_knowledge(knowledge_dir=tmp_path, offline=True)
        assert result_2["status"] == "success"
        assert result_2["seeded"] == 0
        assert result_2["skipped"] == 2
        assert embed_mock.call_count == first_run_calls  # ZERO new calls!


# ── 3. Malformed File Graceful Handling ────────────────────────────────────

@pytest.mark.asyncio
async def test_seeder_handles_malformed_file_gracefully(tmp_path: Path):
    # 1 valid file
    valid = tmp_path / "valid.md"
    valid.write_text(
        "---\ntitle: Valid Doc\ncategory: learning_path\n---\n\n# Valid Doc\nValid body text.",
        encoding="utf-8",
    )

    # 1 malformed file (invalid YAML)
    malformed = tmp_path / "malformed.md"
    malformed.write_text(
        "---\n: : broken yaml : :\n---\n# Malformed\nText.",
        encoding="utf-8",
    )

    # 1 file with missing front matter
    no_fm = tmp_path / "no_fm.md"
    no_fm.write_text("Just raw markdown without delimiters.", encoding="utf-8")

    fake_embeddings = [[0.05] * 256]
    with patch("app.services.ai.embedding_service.embed_texts", AsyncMock(return_value=fake_embeddings)):
        # Must not raise an exception
        result = await seed_knowledge(knowledge_dir=tmp_path, offline=True)
        assert result["status"] == "success"
        assert result["total_files"] == 3
        assert result["valid_files"] == 1
        assert result["seeded"] == 1


# ── 4. Pruning of Orphaned Documents ───────────────────────────────────────

@pytest.mark.asyncio
async def test_seeder_removes_orphaned_docs(tmp_path: Path):
    file_a = tmp_path / "doc_a.md"
    file_a.write_text(
        "---\ntitle: Doc A\ncategory: test\n---\n\n# Doc A\nBody content for A.",
        encoding="utf-8",
    )

    file_b = tmp_path / "doc_b.md"
    file_b.write_text(
        "---\ntitle: Doc B\ncategory: test\n---\n\n# Doc B\nBody content for B.",
        encoding="utf-8",
    )

    fake_embeddings = [[0.02] * 256]
    with patch("app.services.ai.embedding_service.embed_texts", AsyncMock(return_value=fake_embeddings)):
        # Initial seed: both docs added
        r1 = await seed_knowledge(knowledge_dir=tmp_path, offline=True)
        assert r1["seeded"] == 2
        assert len(rag_service._offline_rag_docs) == 2

        # Delete doc_b.md
        file_b.unlink()
        assert not file_b.exists()

        # Second seed: doc_b is orphaned and should be removed
        r2 = await seed_knowledge(knowledge_dir=tmp_path, offline=True)
        assert r2["removed"] == 1
        assert r2["skipped"] == 1
        assert len(rag_service._offline_rag_docs) == 1

        # Confirm surviving document is Doc A
        surviving = list(rag_service._offline_rag_docs.values())[0]
        assert surviving["title"] == "Doc A"


# ── 5. Knowledge Base Stats & REST API Endpoint ────────────────────────────

@pytest.mark.asyncio
async def test_get_knowledge_base_stats(tmp_path: Path):
    file_test = tmp_path / "sample.md"
    file_test.write_text(
        "---\ntitle: Sample\ncategory: career_guide\n---\n\n# Sample\nSample body text.",
        encoding="utf-8",
    )

    fake_embeddings = [[0.01] * 256]
    with patch("app.services.ai.embedding_service.embed_texts", AsyncMock(return_value=fake_embeddings)):
        await seed_knowledge(knowledge_dir=tmp_path, offline=True)

    stats = await get_knowledge_base_stats()
    assert stats.total_documents == 1
    assert stats.total_chunks >= 1
    assert "career_guide" in stats.categories
    assert stats.categories["career_guide"] == 1
    assert stats.status == "ready"
    assert stats.last_seeded_at is not None


@pytest.mark.asyncio
async def test_stats_endpoint_via_api():
    # Ensure at least 1 document in cache
    rag_service._offline_rag_docs["doc_test_1"] = {
        "_id": "doc_test_1",
        "title": "API Test Doc",
        "category": "role_matrix",
        "scope": "global",
        "content": "API test content",
        "chunk_count": 2,
    }
    rag_service._offline_rag_chunks["chunk_test_1"] = {
        "_id": "chunk_test_1",
        "chunk_id": "chunk_test_1",
        "document_id": "doc_test_1",
        "category": "role_matrix",
        "scope": "global",
        "content": "chunk content",
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/rag/knowledge-base/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert "total_documents" in data
        assert "total_chunks" in data
        assert "categories" in data
        assert "status" in data
        assert data["total_documents"] >= 1
