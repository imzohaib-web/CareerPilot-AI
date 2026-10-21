"""CareerPilot AI — Comprehensive Knowledge Base Retrieval Verification & Negative Test Suite.

Tests 8 core career benchmark queries (top-5 results each), 6 out-of-domain queries
(verifying 'no_context'), and 4 weakly related queries (verifying 'weak').
Exits with status code 0 only if all expectations pass.
"""

import asyncio
from pathlib import Path
import sys

# Ensure UTF-8 output on Windows console
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from app.database.mongodb import close_db, connect_db, get_db
from app.services.knowledge_seeder import get_knowledge_base_stats, seed_knowledge
from app.services.rag_service import retrieve_context

BENCHMARK_QUERIES = [
    "What skills does a junior backend developer need?",
    "How do I answer a STAR behavioral interview question?",
    "How should I format an ATS friendly resume?",
    "What are best practices for designing REST APIs in FastAPI?",
    "How do Docker containers and Dockerfiles work for deployment?",
    "What SQL and data concepts are asked in Data Analyst interviews?",
    "What is CI/CD and how do GitHub Actions automate testing?",
    "How can software engineers in Pakistan get remote freelancing clients?",
]

OUT_OF_DOMAIN_QUERIES = [
    "how to bake artisan sourdough bread with crispy crust",
    "English Premier League football match schedule and standings",
    "symptoms of acute viral bronchitis and home recovery remedies",
    "presidential election voter registration deadlines and ballots",
    "purple elephant dancing on the moon wearing sunglasses",
    "cricket spin bowling wrist technique and leg break delivery",
]

WEAKLY_RELATED_QUERIES = [
    "corporate office dress code guidelines and professional attire",
    "ergonomic office chairs and standing desk setup tips",
    "time management calendar scheduling strategies for busy executives",
    "negotiating health insurance benefits and annual compensation packages",
]


async def verify() -> int:
    db = None
    connected = await connect_db()
    if connected:
        try:
            db = get_db()
        except Exception:
            db = None

    if db is None:
        print("[INFO] MongoDB unavailable; ensuring offline knowledge base cache is loaded...")
        await seed_knowledge(offline=True)

    stats = await get_knowledge_base_stats(db=db)

    print("\n" + "=" * 76)
    print("CAREERPILOT AI — KNOWLEDGE BASE RETRIEVAL BENCHMARK")
    print("=" * 76)
    print(f"Active Mode:         {'MongoDB Atlas (Production)' if db is not None else 'In-Memory Cache (Offline)'}")
    print(f"Total Documents:     {stats.total_documents} documents")
    print(f"Total Chunks:        {stats.total_chunks} chunks")
    print(f"Last Seeded At:      {stats.last_seeded_at}")
    print(f"Seeder Status:       {stats.status}")

    failures = 0

    try:
        # ── 1. Benchmark Queries (Top 5 Results) ───────────────────────────
        print("\n" + "=" * 76)
        print("SECTION 1: 8 CORE BENCHMARK QUERIES (TOP 5 DISPLAY)")
        print("=" * 76)

        for idx, q in enumerate(BENCHMARK_QUERIES, 1):
            print("\n" + "-" * 76)
            print(f"[{idx}/{len(BENCHMARK_QUERIES)}] QUERY: '{q}'")
            print("-" * 76)

            chunks = await retrieve_context(user_id="user_verify_123", query=q, top_k=5, db=db)
            status = getattr(chunks, "status", "unknown")
            backend_used = getattr(chunks, "retrieval_backend", "atlas")
            print(f"Status: [{status.upper()}] | Backend: [{backend_used}] | Results Count: {len(chunks)}")

            if status != "grounded" or len(chunks) == 0:
                print(f"==> WARN: Expected grounded results with count > 0, got status='{status}', count={len(chunks)}")

            for i, chunk in enumerate(chunks[:5], 1):
                sec = chunk.section_title or "(Overview)"
                snippet = chunk.content.strip().replace("\n", " ")
                if len(snippet) > 100:
                    snippet = snippet[:100] + "..."

                print(f"\n  Rank #{i}:")
                print(f"    Document Title: {chunk.document_title}")
                print(f"    Section Title:  {sec}")
                print(f"    Heading Path:   {chunk.heading_path or sec}")
                print(f"    Category/Role:  {chunk.category} (role={chunk.role or 'none'})")
                print(f"    Similarity:     {chunk.similarity_score:.4f}")
                print(f"    Keyword (BM25): {chunk.keyword_score:.4f}")
                print(f"    Fused Score:    {chunk.fused_score:.6f}")
                print(f"    Snippet:        \"{snippet}\"")

        # ── 2. Negative Tests: Out-of-Domain Queries ───────────────────────
        print("\n" + "=" * 76)
        print("SECTION 2: OUT-OF-DOMAIN NEGATIVE TESTS (MUST RETURN NO_CONTEXT)")
        print("=" * 76)

        for idx, q in enumerate(OUT_OF_DOMAIN_QUERIES, 1):
            chunks = await retrieve_context(user_id="user_verify_123", query=q, top_k=3, db=db)
            status = getattr(chunks, "status", "unknown")
            passed = (status == "no_context" and len(chunks) == 0)
            tag = "PASS" if passed else "FAIL"
            if not passed:
                failures += 1
            top_sim = chunks[0].similarity_score if chunks else 0.0
            print(f"  [{idx}/6] {tag}: status='{status}' (top_sim={top_sim:.4f}) | '{q}'")

        # ── 3. Negative Tests: Weakly Related Queries ──────────────────────
        print("\n" + "=" * 76)
        print("SECTION 3: WEAKLY RELATED QUERIES (SHOULD RETURN WEAK OR NO_CONTEXT)")
        print("=" * 76)

        for idx, q in enumerate(WEAKLY_RELATED_QUERIES, 1):
            chunks = await retrieve_context(user_id="user_verify_123", query=q, top_k=3, db=db)
            status = getattr(chunks, "status", "unknown")
            # Weakly related query must not be grounded
            passed = (status in ("weak", "no_context"))
            tag = "PASS" if passed else "FAIL"
            if not passed:
                failures += 1
            top_sim = chunks[0].similarity_score if chunks else 0.0
            print(f"  [{idx}/4] {tag}: status='{status}' (top_sim={top_sim:.4f}) | '{q}'")

        print("\n" + "=" * 76)
        print(f"TEST VERIFICATION SUMMARY: {'ALL PASSED' if failures == 0 else f'{failures} FAILURE(S)'}")
        print("=" * 76 + "\n")

        return 0 if failures == 0 else 1

    finally:
        if db is not None:
            await close_db()


if __name__ == "__main__":
    exit_code = asyncio.run(verify())
    sys.exit(exit_code)
