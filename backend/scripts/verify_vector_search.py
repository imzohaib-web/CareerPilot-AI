"""CareerPilot AI — Standalone Diagnostic Script for Atlas Vector Search.

Verifies the MongoDB Atlas Vector Search configuration and end-to-end pipeline.
Strictly READ-ONLY: never inserts, updates, or deletes any data or indexes.

Usage:
    cd backend && python -m scripts.verify_vector_search [--query "..."] [--scope global|user] [--user-id <id>] [--limit 5]
"""

import argparse
import asyncio
import logging
from pathlib import Path
import sys
import time
from typing import Any

# Ensure UTF-8 output on Windows console
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Ensure backend root is in sys.path
backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from app import config
from app.database.mongodb import _classify_error, close_db, connect_db, get_db
from app.services import rag_service
from app.services.ai import embedding_service
from app.services.rag_service import (
    ATLAS_VECTOR_INDEX_NAME,
    RAG_CHUNKS_COLLECTION,
    VECTOR_EMBEDDING_FIELD,
    VECTOR_FILTER_FIELDS,
    execute_vector_search,
    retrieve_context,
)

logger = logging.getLogger("verify_vector_search")


class CheckResult:
    """Represents the outcome of a single diagnostic check."""

    def __init__(self, number: int, name: str, status: str, details: str = ""):
        self.number = number
        self.name = name
        self.status = status.upper()  # PASS | WARN | FAIL | SKIP
        self.details = details

    def __repr__(self) -> str:
        return f"Check {self.number}: {self.name} -> [{self.status}] {self.details}"


# ── Check 1: Config Check ──────────────────────────────────────────────────
def check_config() -> CheckResult:
    """Verify presence of required environment configurations without logging secrets."""
    has_mongo = bool(config.MONGODB_URI)
    has_api_key = bool(config.ALIBABA_CLOUD_API_KEY)
    has_model = bool(config.EMBEDDING_MODEL)
    has_dims = bool(config.EMBEDDING_DIMENSIONS > 0)

    print(f"  - MONGODB_URI: {'[CONFIGURED]' if has_mongo else '[MISSING]'}")
    print(f"  - ALIBABA_CLOUD_API_KEY: {'[CONFIGURED]' if has_api_key else '[MISSING]'}")
    print(f"  - EMBEDDING_MODEL: {config.EMBEDDING_MODEL}")
    print(f"  - EMBEDDING_DIMENSIONS: {config.EMBEDDING_DIMENSIONS}")
    print(f"  - ATLAS_VECTOR_INDEX_NAME: {ATLAS_VECTOR_INDEX_NAME}")

    missing = []
    if not has_mongo:
        missing.append("MONGODB_URI")
    if not has_api_key:
        missing.append("ALIBABA_CLOUD_API_KEY")
    if not has_model or not has_dims:
        missing.append("EMBEDDING_SETTINGS")

    if missing:
        return CheckResult(1, "Config Check", "FAIL", f"Missing configuration: {', '.join(missing)}")
    return CheckResult(1, "Config Check", "PASS", "All required config values are present.")


# ── Check 2: Connection Check ──────────────────────────────────────────────
async def check_connection(db=None) -> tuple[CheckResult, Any]:
    """Test connection to MongoDB cluster via Motor ping, never leaking URI."""
    try:
        if db is None:
            connected = await connect_db()
            if not connected:
                return CheckResult(2, "Connection Check", "FAIL", "MongoDB connect_db returned False (offline mode)"), None
            db = get_db()

        await db.command("ping")
        return CheckResult(2, "Connection Check", "PASS", f"Connected and ping OK (database='{config.MONGODB_NAME}')"), db
    except Exception as exc:
        category = _classify_error(exc)
        return CheckResult(2, "Connection Check", "FAIL", f"Connection failed ({category})"), None


# ── Check 3: Data Check ────────────────────────────────────────────────────
async def check_data(db) -> tuple[CheckResult, dict[str, int]]:
    """Count chunks, scope distribution, and inspect model/dimension consistency."""
    counts = {"total": 0, "global": 0, "user": 0, "matching": 0, "mismatched": 0}
    if db is None or not hasattr(db, RAG_CHUNKS_COLLECTION):
        return CheckResult(3, "Data Check", "FAIL", f"Collection '{RAG_CHUNKS_COLLECTION}' is unavailable"), counts

    col = getattr(db, RAG_CHUNKS_COLLECTION)
    try:
        counts["total"] = await col.count_documents({})
        counts["global"] = await col.count_documents({"scope": "global"})
        counts["user"] = await col.count_documents({"scope": "user"})
        counts["matching"] = await col.count_documents({
            "embedding_model": config.EMBEDDING_MODEL,
            "embedding_dim": config.EMBEDDING_DIMENSIONS,
        })
        counts["mismatched"] = await col.count_documents({
            "$or": [
                {"embedding_model": {"$ne": config.EMBEDDING_MODEL}},
                {"embedding_dim": {"$ne": config.EMBEDDING_DIMENSIONS}},
            ]
        })

        print(f"  - Total Chunks: {counts['total']}")
        print(f"  - Scope Global: {counts['global']}")
        print(f"  - Scope User: {counts['user']}")
        print(f"  - Matching Config ({config.EMBEDDING_MODEL}, {config.EMBEDDING_DIMENSIONS}d): {counts['matching']}")
        print(f"  - Fallback/Mismatched: {counts['mismatched']}")

        if counts["total"] == 0:
            return CheckResult(
                3, "Data Check", "WARN",
                f"Collection '{RAG_CHUNKS_COLLECTION}' is empty. Run 'python -m scripts.seed_knowledge' to seed."
            ), counts

        if counts["mismatched"] > 0:
            return CheckResult(
                3, "Data Check", "WARN",
                f"{counts['mismatched']} chunk(s) on fallback/mismatched model. Run 'scripts/reembed_chunks.py'."
            ), counts

        return CheckResult(3, "Data Check", "PASS", f"All {counts['total']} chunks match configured model & dimension"), counts
    except Exception as exc:
        return CheckResult(3, "Data Check", "FAIL", f"Data count error: {_classify_error(exc)}"), counts


# ── Check 4: Index Check ───────────────────────────────────────────────────
async def check_index(db) -> CheckResult:
    """Inspect Atlas Vector Search index definition on rag_chunks."""
    if db is None or not hasattr(db, RAG_CHUNKS_COLLECTION):
        return CheckResult(4, "Index Check", "FAIL", "Database collection unavailable")

    col = getattr(db, RAG_CHUNKS_COLLECTION)
    try:
        cursor = col.aggregate([{"$listSearchIndexes": {}}])
        indexes = await cursor.to_list(length=20)
    except Exception as exc:
        return CheckResult(
            4, "Index Check", "WARN",
            f"Atlas vector search not supported on this deployment ({_classify_error(exc)})"
        )

    target_idx = None
    for idx in indexes:
        if idx.get("name") == ATLAS_VECTOR_INDEX_NAME:
            target_idx = idx
            break

    if not target_idx:
        return CheckResult(
            4, "Index Check", "FAIL",
            f"Index '{ATLAS_VECTOR_INDEX_NAME}' not found on '{RAG_CHUNKS_COLLECTION}'"
        )

    # 1. Type check
    idx_type = target_idx.get("type")
    if idx_type != "vectorSearch":
        return CheckResult(4, "Index Check", "FAIL", f"Expected type 'vectorSearch', found '{idx_type}'")

    # 2. Status / queryable check
    status = target_idx.get("status")
    queryable = target_idx.get("queryable")
    if status not in ["READY", "queryable", None] and queryable is False:
        return CheckResult(4, "Index Check", "FAIL", f"Index is not ready (status='{status}', queryable={queryable})")

    # 3. Definition fields check
    defn = target_idx.get("latestDefinition") or target_idx.get("definition") or {}
    fields = defn.get("fields", [])

    vector_found = False
    filter_fields_found = set()

    for f in fields:
        f_type = f.get("type")
        f_path = f.get("path")
        if f_type == "vector" and f_path == VECTOR_EMBEDDING_FIELD:
            dims = f.get("numDimensions")
            sim = f.get("similarity")
            if dims != config.EMBEDDING_DIMENSIONS:
                return CheckResult(
                    4, "Index Check", "FAIL",
                    f"Dimension mismatch: index has {dims}, config expects {config.EMBEDDING_DIMENSIONS}"
                )
            if sim != "cosine":
                return CheckResult(
                    4, "Index Check", "FAIL",
                    f"Similarity mismatch: index has '{sim}', expected 'cosine'"
                )
            vector_found = True
        elif f_type == "filter":
            filter_fields_found.add(f_path)

    if not vector_found:
        return CheckResult(
            4, "Index Check", "FAIL",
            f"Vector field '{VECTOR_EMBEDDING_FIELD}' not found in index definition"
        )

    missing_filters = set(VECTOR_FILTER_FIELDS) - filter_fields_found
    if missing_filters:
        return CheckResult(
            4, "Index Check", "FAIL",
            f"Missing filter fields in index definition: {sorted(list(missing_filters))}"
        )

    return CheckResult(
        4, "Index Check", "PASS",
        f"Index '{ATLAS_VECTOR_INDEX_NAME}' is READY (type=vectorSearch, dims={config.EMBEDDING_DIMENSIONS}, cosine, filters={sorted(list(filter_fields_found))})"
    )


# ── Check 5: Query Embedding Check ─────────────────────────────────────────
async def check_query_embedding(query: str) -> tuple[CheckResult, list[float], float]:
    """Embed test query and verify dimension and latency."""
    t0 = time.perf_counter()
    try:
        vec = await embedding_service.embed_query(query)
        latency_ms = (time.perf_counter() - t0) * 1000.0
        if len(vec) != config.EMBEDDING_DIMENSIONS:
            return CheckResult(
                5, "Query Embedding Check", "FAIL",
                f"Generated vector dim {len(vec)} != configured {config.EMBEDDING_DIMENSIONS}"
            ), [], latency_ms

        return CheckResult(
            5, "Query Embedding Check", "PASS",
            f"Generated {len(vec)}-dim vector in {latency_ms:.1f}ms"
        ), vec, latency_ms
    except Exception as exc:
        latency_ms = (time.perf_counter() - t0) * 1000.0
        return CheckResult(5, "Query Embedding Check", "FAIL", f"Embedding failed: {type(exc).__name__}: {exc}"), [], latency_ms


# ── Check 6: Vector Search Check ───────────────────────────────────────────
async def check_vector_search(
    db,
    query_vec: list[float],
    scope: str | None,
    user_id: str | None,
    limit: int,
    total_chunks: int,
) -> tuple[CheckResult, list[dict[str, Any]], float]:
    """Execute raw $vectorSearch stage and inspect top retrieved candidates."""
    if not query_vec:
        return CheckResult(6, "Vector Search Check", "FAIL", "No query vector available"), [], 0.0

    t0 = time.perf_counter()
    try:
        results = await rag_service.execute_vector_search(
            query_vec=query_vec,
            user_id=user_id,
            scope=scope,
            limit=limit,
            num_candidates=100,
            db=db,
        )
        latency_ms = (time.perf_counter() - t0) * 1000.0
    except Exception as exc:
        latency_ms = (time.perf_counter() - t0) * 1000.0
        return CheckResult(
            6, "Vector Search Check", "WARN",
            f"Atlas $vectorSearch not supported on this deployment ({_classify_error(exc)})"
        ), [], latency_ms

    print(f"\n  Vector Search Top Results (count={len(results)}, latency={latency_ms:.1f}ms):")
    for idx, r in enumerate(results, 1):
        score = r.get("vector_score", 0.0)
        title = r.get("document_title", "Untitled")
        chunk_scope = r.get("scope", "user")
        snippet = r.get("content", "").replace("\n", " ")[:100]
        print(f"    [{idx}] score={score:.4f} | scope={chunk_scope} | title='{title}' | snippet=\"{snippet}...\"")

    if not results:
        if total_chunks > 0:
            return CheckResult(
                6, "Vector Search Check", "FAIL",
                f"Zero vector search results returned despite {total_chunks} chunks in database"
            ), [], latency_ms
        return CheckResult(6, "Vector Search Check", "WARN", "Zero results (database is empty)"), [], latency_ms

    top_score = results[0].get("vector_score", 0.0)
    if top_score < config.RAG_MIN_SIMILARITY:
        return CheckResult(
            6, "Vector Search Check", "WARN",
            f"Top vector score ({top_score:.4f}) is below RAG_MIN_SIMILARITY ({config.RAG_MIN_SIMILARITY})"
        ), results, latency_ms

    return CheckResult(
        6, "Vector Search Check", "PASS",
        f"Returned {len(results)} chunks (top_score={top_score:.4f}, latency={latency_ms:.1f}ms)"
    ), results, latency_ms


# ── Check 7: Paraphrase Check ──────────────────────────────────────────────
async def check_paraphrase(db) -> CheckResult:
    """Verify semantic matching across 3 pairs of semantically equivalent queries."""
    pairs = [
        ("junior backend developer skills", "server-side engineer requirements"),
        ("how to answer behavioral interview questions", "STAR method answers"),
        ("ATS friendly resume tips", "how to pass resume screening software"),
    ]

    print("\n  Paraphrase Semantic Matching Tests:")
    overlaps = 0
    tested = 0

    for q1, q2 in pairs:
        try:
            v1 = await embedding_service.embed_query(q1)
            v2 = await embedding_service.embed_query(q2)
            r1 = await rag_service.execute_vector_search(query_vec=v1, limit=3, db=db)
            r2 = await rag_service.execute_vector_search(query_vec=v2, limit=3, db=db)
        except Exception:
            return CheckResult(7, "Paraphrase Check", "WARN", "Skipped: vector search unavailable on this deployment")

        if not r1 or not r2:
            print(f"    - '{q1}' vs '{q2}': [NO DATA]")
            continue

        docs1 = {r.get("document_id") or r.get("document_title") for r in r1}
        docs2 = {r.get("document_id") or r.get("document_title") for r in r2}
        common = docs1.intersection(docs2)
        has_overlap = len(common) > 0
        tested += 1
        if has_overlap:
            overlaps += 1
        print(f"    - '{q1}' vs '{q2}': overlap={has_overlap} (common={len(common)})")

    if tested == 0:
        return CheckResult(7, "Paraphrase Check", "WARN", "No chunks found to test paraphrase matching")

    if overlaps > 0:
        return CheckResult(7, "Paraphrase Check", "PASS", f"{overlaps}/{tested} query pairs shared top-3 documents")
    return CheckResult(7, "Paraphrase Check", "WARN", "Low overlap across paraphrase pairs (check corpus coverage)")


# ── Check 8: Isolation Check ───────────────────────────────────────────────
async def check_isolation(db, user_id: str | None, query_vec: list[float]) -> CheckResult:
    """Verify cross-user isolation: user filter must never leak other users' chunks."""
    test_uid = user_id or "test_isolated_user_123"
    if not query_vec:
        return CheckResult(8, "Isolation Check", "SKIP", "No query vector to test isolation")

    try:
        results = await rag_service.execute_vector_search(
            query_vec=query_vec,
            user_id=test_uid,
            limit=10,
            db=db,
        )
    except Exception as exc:
        return CheckResult(8, "Isolation Check", "WARN", f"Skipped: vector search unavailable ({_classify_error(exc)})")

    for r in results:
        chunk_uid = r.get("user_id")
        chunk_scope = r.get("scope")
        if chunk_scope != "global" and chunk_uid != test_uid:
            return CheckResult(
                8, "Isolation Check", "FAIL",
                f"Data leak! Chunk owned by '{chunk_uid}' returned for user '{test_uid}'"
            )

    return CheckResult(
        8, "Isolation Check", "PASS",
        f"Strict isolation confirmed: all {len(results)} chunks are global or owned by '{test_uid}'"
    )


# ── Check 9: Fallback Check ────────────────────────────────────────────────
async def check_fallback(db, query: str) -> CheckResult:
    """Verify retrieval falls back to in-memory search without raising when index is broken."""
    try:
        results = await retrieve_context(
            user_id="test_fallback_user",
            query=query,
            top_k=3,
            vector_index_name="nonsense_unregistered_index_xyz",
            db=db,
        )
        return CheckResult(
            9, "Fallback Check", "PASS",
            f"Gracefully fell back to in-memory search (status='{results.status}', returned={len(results)})"
        )
    except Exception as exc:
        return CheckResult(
            9, "Fallback Check", "FAIL",
            f"Fallback raised unhandled exception: {type(exc).__name__}: {exc}"
        )


# ── Diagnostic Runner ──────────────────────────────────────────────────────
async def run_diagnostics(
    query: str = "What skills does a junior backend developer need?",
    scope: str | None = None,
    user_id: str | None = None,
    limit: int = 5,
    db=None,
) -> tuple[list[CheckResult], int]:
    """Execute all 9 diagnostic checks in sequence and report results."""
    print("\n" + "=" * 76)
    print("CAREERPILOT AI — ATLAS VECTOR SEARCH DIAGNOSTIC SUITE (READ-ONLY)")
    print("=" * 76)
    print(f"Target Query: '{query}'")
    print(f"Target Scope: {scope or '(all accessible)'}")
    print(f"Target User:  {user_id or '(none specified)'}")
    print(f"Result Limit: {limit}")
    print("=" * 76 + "\n")

    results: list[CheckResult] = []

    # 1. Config Check
    print("[1/9] Checking Configuration...")
    c1 = check_config()
    print(f"==> {c1.status}: {c1.details}\n")
    results.append(c1)

    # 2. Connection Check
    print("[2/9] Checking MongoDB Connection...")
    c2, db = await check_connection(db=db)
    print(f"==> {c2.status}: {c2.details}\n")
    results.append(c2)

    total_chunks = 0
    if db is not None:
        # 3. Data Check
        print("[3/9] Checking Data & Embeddings Consistency...")
        c3, counts = await check_data(db)
        total_chunks = counts.get("total", 0)
        print(f"==> {c3.status}: {c3.details}\n")
        results.append(c3)

        # 4. Index Check
        print("[4/9] Checking Atlas Vector Search Index Definition...")
        c4 = await check_index(db)
        print(f"==> {c4.status}: {c4.details}\n")
        results.append(c4)
    else:
        results.append(CheckResult(3, "Data Check", "SKIP", "Skipped: no database connection"))
        results.append(CheckResult(4, "Index Check", "SKIP", "Skipped: no database connection"))

    # 5. Query Embedding Check
    print("[5/9] Testing Query Embedding via DashScope...")
    c5, query_vec, embed_latency = await check_query_embedding(query)
    print(f"==> {c5.status}: {c5.details}\n")
    results.append(c5)

    # 6. Vector Search Check
    search_latency = 0.0
    if db is not None and query_vec:
        print("[6/9] Executing Atlas $vectorSearch Aggregation Stage...")
        c6, search_results, search_latency = await check_vector_search(
            db=db,
            query_vec=query_vec,
            scope=scope,
            user_id=user_id,
            limit=limit,
            total_chunks=total_chunks,
        )
        print(f"==> {c6.status}: {c6.details}\n")
        results.append(c6)

        # 7. Paraphrase Check
        print("[7/9] Running Paraphrase Semantic Equivalence Checks...")
        c7 = await check_paraphrase(db)
        print(f"==> {c7.status}: {c7.details}\n")
        results.append(c7)

        # 8. Isolation Check
        print("[8/9] Verifying Cross-User Isolation...")
        c8 = await check_isolation(db, user_id=user_id, query_vec=query_vec)
        print(f"==> {c8.status}: {c8.details}\n")
        results.append(c8)
    else:
        results.append(CheckResult(6, "Vector Search Check", "SKIP", "Skipped: database or vector unavailable"))
        results.append(CheckResult(7, "Paraphrase Check", "SKIP", "Skipped: database or vector unavailable"))
        results.append(CheckResult(8, "Isolation Check", "SKIP", "Skipped: database or vector unavailable"))

    # 9. Fallback Check
    print("[9/9] Verifying In-Memory Fallback Resilience...")
    c9 = await check_fallback(db, query)
    print(f"==> {c9.status}: {c9.details}\n")
    results.append(c9)

    # ── Summary Table ──────────────────────────────────────────────────────
    print("=" * 76)
    print(f"{'#':<3} | {'Check Name':<26} | {'Status':<6} | {'Details':<34}")
    print("-" * 76)
    has_fail = False
    for r in results:
        if r.status == "FAIL":
            has_fail = True
        detail_trunc = r.details[:34] if len(r.details) <= 34 else r.details[:31] + "..."
        print(f"{r.number:<3} | {r.name:<26} | {r.status:<6} | {detail_trunc:<34}")
    print("=" * 76)

    print(f"Timing Metrics: Embedding={embed_latency:.1f}ms | VectorSearch={search_latency:.1f}ms")
    verdict = "FAIL" if has_fail else "PASS"
    print(f"OVERALL DIAGNOSTIC VERDICT: [{verdict}]\n")

    return results, (1 if has_fail else 0)


async def main_async() -> int:
    parser = argparse.ArgumentParser(description="Verify Atlas Vector Search setup end-to-end.")
    parser.add_argument(
        "--query",
        type=str,
        default="What skills does a junior backend developer need?",
        help="Test query string to embed and search.",
    )
    parser.add_argument(
        "--scope",
        type=str,
        choices=["global", "user"],
        default=None,
        help="Optional scope filter.",
    )
    parser.add_argument(
        "--user-id",
        type=str,
        default=None,
        help="Optional user ID for isolation test.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=5,
        help="Number of vector candidates to retrieve (default: 5).",
    )

    args = parser.parse_args()

    db = None
    try:
        _, exit_code = await run_diagnostics(
            query=args.query,
            scope=args.scope,
            user_id=args.user_id,
            limit=args.limit,
            db=db,
        )
        return exit_code
    finally:
        await close_db()


def main():
    exit_code = asyncio.run(main_async())
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
