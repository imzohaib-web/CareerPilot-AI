"""Verification script to test offline seeding and context retrieval on target queries."""

import asyncio
from pathlib import Path
import sys

# Ensure UTF-8 output on Windows console
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from app.services.knowledge_seeder import get_knowledge_base_stats, seed_knowledge
from app.services.rag_service import retrieve_context


async def verify():
    # 1. Seed knowledge in offline mode
    seed_res = await seed_knowledge(offline=True)
    stats = await get_knowledge_base_stats()

    print("\n" + "=" * 70)
    print("OFFLINE KNOWLEDGE BASE VERIFICATION")
    print("=" * 70)
    print(f"Total Seeded Docs:   {stats.total_documents}")
    print(f"Total Seeded Chunks: {stats.total_chunks}")
    print(f"Last Seeded At:      {stats.last_seeded_at}")
    print(f"Status:              {stats.status}")

    queries = [
        "What skills does a junior backend developer need?",
        "How do I answer a STAR behavioral question?",
        "How should I write ATS-friendly bullet points?",
    ]

    for q in queries:
        print("\n" + "-" * 70)
        print(f"QUERY: '{q}'")
        print("-" * 70)

        chunks = await retrieve_context(user_id="user_verify_123", query=q, top_k=3)
        status = getattr(chunks, "status", "unknown")
        print(f"Retrieval Status: {status} | Top Chunks Retrieved: {len(chunks)}")

        for i, chunk in enumerate(chunks[:3], 1):
            print(f"\n  Rank {i}:")
            print(f"    Title:         {chunk.document_title}")
            print(f"    Section:       {chunk.section_title or '(Introduction)'}")
            print(f"    Category:      {chunk.category}")
            print(f"    Scope:         {chunk.scope}")
            print(f"    Sim Score:     {chunk.similarity_score:.4f}")
            print(f"    Keyword Score: {chunk.keyword_score:.4f}")
            print(f"    Fused Score:   {chunk.fused_score:.4f}")
            preview = chunk.content.strip().replace("\n", " ")
            if len(preview) > 180:
                preview = preview[:180] + "..."
            print(f"    Snippet:       \"{preview}\"")

    print("\n" + "=" * 70 + "\n")


if __name__ == "__main__":
    asyncio.run(verify())
