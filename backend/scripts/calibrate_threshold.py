"""CareerPilot AI — Relevance Threshold Calibration Script.

Runs 20 in-domain queries and 20 out-of-domain queries against the knowledge base,
computes top-1 cosine similarity distributions, and determines optimal
RAG_MIN_SIMILARITY (grounded) and RAG_WEAK_SIMILARITY (weak vs no_context) thresholds.
"""

import asyncio
import math
from pathlib import Path
import statistics
import sys
import time

# Ensure UTF-8 output on Windows console
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from app import config
from app.database.mongodb import close_db, connect_db, get_db
from app.services import rag_service
from app.services.ai import embedding_service
from app.services.knowledge_seeder import seed_knowledge

IN_DOMAIN_QUERIES = [
    "What skills does a junior backend developer need?",
    "FastAPI dependency injection and routing best practices",
    "How to format an ATS friendly single column resume",
    "STAR method behavioral interview question answers",
    "Docker containerization and multi-stage Dockerfiles",
    "Data analyst SQL interview questions and window functions",
    "Continuous integration and automated testing with GitHub Actions",
    "How Pakistani software engineers find remote freelancing clients",
    "Frontend developer React state management and hooks",
    "Full stack engineer REST APIs and database modeling",
    "Mobile developer Flutter and React Native architecture",
    "DevOps infrastructure as code and Terraform basics",
    "Machine learning model evaluation metrics precision recall",
    "QA automation test frameworks Pytest and Selenium",
    "PostgreSQL vs MongoDB indexing and query optimization",
    "System design caching strategies Redis and CDN",
    "Git version control branching strategies and pull requests",
    "Data structures algorithms time complexity Big O notation",
    "Quantified resume bullets using Google XYZ formula",
    "Pakistan software houses hiring entry tests and technical probation",
]

OUT_OF_DOMAIN_QUERIES = [
    # Cooking
    "how to bake artisan sourdough bread with crispy crust",
    "authentic traditional Italian carbonara recipe with guanciale",
    "internal temperature to roast a whole chicken in oven",
    "best chewy chocolate chip cookie ingredients and baking time",
    # Sports
    "English Premier League football match schedule and standings",
    "how to improve basketball free throw shooting percentage",
    "Wimbledon tennis championship mens singles tournament results",
    "cricket spin bowling wrist technique and leg break delivery",
    # Politics
    "presidential election voter registration deadlines and ballots",
    "parliamentary debate rules filibuster and cloture procedures",
    "history of the European Union Maastricht Treaty formation",
    "United Nations Security Council resolutions voting powers",
    # Medical
    "symptoms of acute viral bronchitis and home recovery remedies",
    "natural methods to lower high blood pressure and hypertension",
    "diagnosis and management of type 2 diabetes mellitus",
    "side effects and drug interactions of ibuprofen with acetaminophen",
    # Nonsense
    "asdfqwerty zxcvbnm 123456 qwertyuiop",
    "flim flam bim bam boozle noodle doodle",
    "purple elephant dancing on the moon wearing sunglasses",
    "xyzpdq 998877 qwertyuiop mnbvcxz lkjhgf",
]


async def score_query(query: str, db) -> float:
    """Generate embedding for query and compute top-1 cosine similarity against global chunks."""
    query_vec = await embedding_service.embed_query(query)
    if not query_vec:
        query_vec = rag_service.compute_text_vector(query, vocab_dim=256)

    # 1. Try Atlas Vector Search
    if db is not None and hasattr(db, rag_service.RAG_CHUNKS_COLLECTION):
        try:
            results = await rag_service.execute_vector_search(
                query_vec=query_vec,
                scope="global",
                limit=1,
                num_candidates=100,
                db=db,
            )
            if results and results[0].get("embedding"):
                return round(rag_service.cosine_similarity(query_vec, results[0]["embedding"]), 4)
            elif results and "vector_score" in results[0]:
                # Atlas vectorSearchScore for cosine is (1 + cos_sim) / 2
                atlas_score = float(results[0]["vector_score"])
                return round(max(-1.0, min(1.0, 2.0 * atlas_score - 1.0)), 4)
        except Exception:
            pass

    # 2. Fall back to in-memory cosine comparison across chunks
    all_chunks = []
    if db is not None and hasattr(db, "rag_chunks"):
        try:
            cursor = db.rag_chunks.find({"scope": "global"})
            all_chunks = await cursor.to_list(length=500)
        except Exception:
            all_chunks = []

    if not all_chunks:
        all_chunks = [c for c in rag_service._offline_rag_chunks.values() if c.get("scope") == "global"]

    top_sim = 0.0
    for c in all_chunks:
        c_vec = c.get("embedding")
        if not c_vec:
            continue
        sim = rag_service.cosine_similarity(query_vec, c_vec)
        if sim > top_sim:
            top_sim = sim

    return round(top_sim, 4)


def percentile(data: list[float], p: float) -> float:
    """Compute empirical percentile."""
    if not data:
        return 0.0
    k = (len(data) - 1) * p
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return data[int(k)]
    return data[f] * (c - k) + data[c] * (k - f)


async def main():
    db = None
    connected = await connect_db()
    if connected:
        try:
            db = get_db()
        except Exception:
            db = None

    if db is None:
        print("[INFO] MongoDB unavailable; ensuring offline seeded chunks are loaded...")
        await seed_knowledge(offline=True)

    print("\n" + "=" * 76)
    print("CAREERPILOT AI — RELEVANCE THRESHOLD CALIBRATOR")
    print("=" * 76)
    print(f"Target Cluster:   {'MongoDB Atlas (Connected)' if db is not None else 'Offline In-Memory Cache'}")
    print(f"Embedding Model:  {config.EMBEDDING_MODEL} ({config.EMBEDDING_DIMENSIONS}d)")
    print(f"Test Queries:     {len(IN_DOMAIN_QUERIES)} in-domain, {len(OUT_OF_DOMAIN_QUERIES)} out-of-domain")
    print("=" * 76 + "\n")

    in_domain_scores: list[float] = []
    print("--> Evaluating In-Domain Queries:")
    for idx, q in enumerate(IN_DOMAIN_QUERIES, 1):
        t0 = time.perf_counter()
        score = await score_query(q, db=db)
        dt = (time.perf_counter() - t0) * 1000.0
        in_domain_scores.append(score)
        print(f"  [{idx:2d}/20] score={score:.4f} ({dt:5.1f}ms) | '{q}'")

    out_domain_scores: list[float] = []
    print("\n--> Evaluating Out-of-Domain Queries:")
    for idx, q in enumerate(OUT_OF_DOMAIN_QUERIES, 1):
        t0 = time.perf_counter()
        score = await score_query(q, db=db)
        dt = (time.perf_counter() - t0) * 1000.0
        out_domain_scores.append(score)
        print(f"  [{idx:2d}/20] score={score:.4f} ({dt:5.1f}ms) | '{q}'")

    in_domain_scores.sort()
    out_domain_scores.sort()

    print("\n" + "=" * 76)
    print("SCORE DISTRIBUTION SUMMARY (Top-1 Cosine Similarity)")
    print("=" * 76)
    print(f"{'Metric':<18} | {'In-Domain (Career/Tech)':<24} | {'Out-of-Domain':<24}")
    print("-" * 76)
    print(f"{'Count':<18} | {len(in_domain_scores):<24} | {len(out_domain_scores):<24}")
    print(f"{'Min':<18} | {min(in_domain_scores):<24.4f} | {min(out_domain_scores):<24.4f}")
    print(f"{'Max':<18} | {max(in_domain_scores):<24.4f} | {max(out_domain_scores):<24.4f}")
    print(f"{'Mean':<18} | {statistics.mean(in_domain_scores):<24.4f} | {statistics.mean(out_domain_scores):<24.4f}")
    print(f"{'Median (p50)':<18} | {statistics.median(in_domain_scores):<24.4f} | {statistics.median(out_domain_scores):<24.4f}")
    print(f"{'25th Percentile':<18} | {percentile(in_domain_scores, 0.25):<24.4f} | {percentile(out_domain_scores, 0.25):<24.4f}")
    print(f"{'75th Percentile':<18} | {percentile(in_domain_scores, 0.75):<24.4f} | {percentile(out_domain_scores, 0.75):<24.4f}")
    print("=" * 76)

    # Find optimal separating threshold
    best_acc = 0.0
    best_thresh = 0.40
    for t_step in range(10, 95):
        t = t_step / 100.0
        in_pass = sum(1 for s in in_domain_scores if s >= t)
        out_pass = sum(1 for s in out_domain_scores if s >= t)
        acc = (in_pass + (len(out_domain_scores) - out_pass)) / (len(in_domain_scores) + len(out_domain_scores))
        if acc > best_acc:
            best_acc = acc
            best_thresh = t

    # Recommended grounded threshold: separates in-domain from out-of-domain
    rec_grounded = best_thresh
    # Recommended weak threshold: halfway between max out-of-domain and min in-domain (or below)
    rec_weak = round(max(0.15, min(out_domain_scores[-3], best_thresh - 0.12)), 2)

    print("\nRECOMMENDED CONFIGURATION VALUES:")
    print(f"  - RAG_MIN_SIMILARITY   = {rec_grounded:.2f}  (Optimal classification accuracy: {best_acc*100:.1f}%)")
    print(f"  - RAG_WEAK_SIMILARITY  = {rec_weak:.2f}  (Boundary for 'weak' vs 'no_context')")
    print("=" * 76 + "\n")

    if db is not None:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main())
