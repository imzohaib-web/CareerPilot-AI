"""CareerPilot AI — CLI Script to Seed the Curated Knowledge Base.

Usage:
    python -m scripts.seed_knowledge [--force] [--offline] [--dir PATH]

Parses markdown files with YAML front matter from backend/app/knowledge/
(or specified --dir), chunks them, embeds them, and upserts them into
global scope (scope="global", user_id=None).
"""

import argparse
import asyncio
import logging
from pathlib import Path
import sys

# Ensure backend root is in sys.path
backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from app.database.mongodb import close_db, connect_db, get_db
from app.services.knowledge_seeder import get_knowledge_base_stats, seed_knowledge

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("seed_knowledge")


async def main_async() -> int:
    parser = argparse.ArgumentParser(description="Seed CareerPilot AI curated knowledge base.")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force re-chunking and re-embedding of all files even if content hash is unchanged.",
    )
    parser.add_argument(
        "--offline",
        action="store_true",
        help="Seed into offline in-memory cache without connecting to MongoDB.",
    )
    parser.add_argument(
        "--dir",
        type=str,
        default=None,
        help="Custom directory path containing markdown knowledge files.",
    )

    args = parser.parse_args()

    db = None
    if not args.offline:
        logger.info("Attempting MongoDB connection...")
        connected = await connect_db()
        if connected:
            try:
                db = get_db()
            except Exception:
                db = None
        else:
            logger.warning("MongoDB unavailable; falling back to offline in-memory mode.")

    try:
        result = await seed_knowledge(
            db=db,
            knowledge_dir=args.dir,
            force=args.force,
            offline=args.offline or (db is None),
        )
        print("\n==================================================")
        print("KNOWLEDGE BASE SEED SUMMARY")
        print("==================================================")
        print(f"Status:          {result.get('status')}")
        print(f"Mode:            {result.get('mode')}")
        print(f"Total Files:     {result.get('total_files')}")
        print(f"Valid Files:     {result.get('valid_files')}")
        print(f"Seeded (New):    {result.get('seeded')}")
        print(f"Updated:         {result.get('updated')}")
        print(f"Skipped (Hash):  {result.get('skipped')}")
        print(f"Pruned (Orphan): {result.get('removed')}")
        print(f"Total Docs:      {result.get('total_documents')}")
        print(f"Total Chunks:    {result.get('total_chunks')}")
        print(f"Timestamp:       {result.get('last_seeded_at')}")

        stats = await get_knowledge_base_stats(db=db)
        print("\nCategories Breakdown:")
        for cat, cnt in sorted(stats.categories.items()):
            chunks_cnt = stats.chunks_by_category.get(cat, 0)
            print(f"  - {cat:20s}: {cnt:3d} doc(s), {chunks_cnt:4d} chunk(s)")
        print("==================================================\n")

        return 0
    except Exception as exc:
        logger.exception("Failed to seed knowledge base: %s", exc)
        return 1
    finally:
        if db is not None:
            await close_db()


def main():
    exit_code = asyncio.run(main_async())
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
