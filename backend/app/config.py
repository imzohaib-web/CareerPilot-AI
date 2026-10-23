import os
from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env explicitly so the app works from any working directory.
# Real environment variables (e.g. Render dashboard values) always win —
# load_dotenv never overrides existing environment variables.
load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=True)


def _parse_origins(raw: str) -> list[str]:
    """Normalize a comma-separated CORS origin list.

    Tolerates common configuration mistakes so an origin like
    ``"https://app.vercel.app/"`` still matches the browser-sent
    ``https://app.vercel.app``:

    - surrounding brackets or quotes (copy/paste artifacts)
    - spaces before/after commas
    - trailing slashes
    - mixed case (origins are scheme/host/port, always lowercased by browsers)
    - empty entries

    Wildcards are rejected: this API uses authenticated requests, which
    require exact-origin matching.
    """
    cleaned = raw.strip().strip("[]")
    origins: list[str] = []
    for part in cleaned.split(","):
        origin = (
            part.strip()
            .strip("\"'")
            .rstrip("/")
            .strip()
            .lower()
        )
        if not origin or origin == "*":
            continue
        if origin not in origins:
            origins.append(origin)
    return origins

# --- Database ---
MONGODB_URI = os.getenv("MONGODB_URI", "")
MONGODB_NAME = os.getenv("MONGODB_NAME", "careerpilot_ai")

# --- Auth ---
JWT_SECRET = os.getenv("JWT_SECRET", "")
JWT_ALGORITHM = "HS256"
JWT_EXPIRES_MINUTES = int(os.getenv("JWT_EXPIRES_MINUTES", "1440"))

# --- AI (Alibaba Cloud Model Studio / Qwen) ---
ALIBABA_CLOUD_API_KEY = os.getenv("ALIBABA_CLOUD_API_KEY", "")
QWEN_BASE_URL = os.getenv(
    "ALIBABA_CLOUD_BASE_URL",
    os.getenv("QWEN_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
)
QWEN_MODEL = os.getenv("ALIBABA_CLOUD_MODEL", os.getenv("QWEN_MODEL", "qwen-plus"))

# Default timeout (seconds) for Qwen requests.  Short prompts (chat, test)
# finish well within this.  Feature-specific callers may override per-call.
QWEN_TIMEOUT = float(os.getenv("QWEN_TIMEOUT", "60"))

# Disable Qwen3 thinking mode for structured-output features (resume analysis,
# skill gap, etc.).  Thinking adds significant latency and wraps the response
# in <think> tags that break JSON parsing.
QWEN_ENABLE_THINKING = os.getenv("QWEN_ENABLE_THINKING", "false").lower() == "true"

# --- Streaming ---
STREAMING_ENABLED = os.getenv("STREAMING_ENABLED", "true").lower() == "true"
STREAMING_IDLE_TIMEOUT = float(os.getenv("STREAMING_IDLE_TIMEOUT", "30"))
STREAMING_HEARTBEAT_INTERVAL = float(os.getenv("STREAMING_HEARTBEAT_INTERVAL", "15"))

# --- Embeddings (Alibaba Cloud Model Studio / DashScope) ---
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-v3")
EMBEDDING_DIMENSIONS = int(os.getenv("EMBEDDING_DIMENSIONS", "1024"))
EMBEDDING_TIMEOUT = float(os.getenv("EMBEDDING_TIMEOUT", "30"))
EMBEDDING_BATCH_SIZE = int(os.getenv("EMBEDDING_BATCH_SIZE", "10"))
EMBEDDING_FALLBACK_MODEL = os.getenv("EMBEDDING_FALLBACK_MODEL", "")

# --- Vector Search & Collections ---
ATLAS_VECTOR_INDEX_NAME = os.getenv("ATLAS_VECTOR_INDEX_NAME", "rag_chunks_vector")
RAG_CHUNKS_COLLECTION = os.getenv("RAG_CHUNKS_COLLECTION", "rag_chunks")
RAG_DOCUMENTS_COLLECTION = os.getenv("RAG_DOCUMENTS_COLLECTION", "rag_documents")
VECTOR_EMBEDDING_FIELD = os.getenv("VECTOR_EMBEDDING_FIELD", "embedding")

# --- RAG Retrieval Pipeline ---
RAG_MIN_SIMILARITY = float(os.getenv("RAG_MIN_SIMILARITY", "0.58"))
RAG_WEAK_SIMILARITY = float(os.getenv("RAG_WEAK_SIMILARITY", "0.42"))
RAG_STRONG_SIMILARITY = float(os.getenv("RAG_STRONG_SIMILARITY", "0.75"))
RAG_VECTOR_WEIGHT = float(os.getenv("RAG_VECTOR_WEIGHT", "0.7"))
RAG_KEYWORD_WEIGHT = float(os.getenv("RAG_KEYWORD_WEIGHT", "0.3"))
RAG_ROLE_BOOST_FACTOR = float(os.getenv("RAG_ROLE_BOOST_FACTOR", "1.25"))

# --- CORS (comma-separated list of allowed frontend origins) ---
# Include BOTH local development and the production Vercel origin in
# deployment environments, e.g.
#   FRONTEND_ORIGIN=http://localhost:5173,https://your-app.vercel.app
FRONTEND_ORIGIN = os.getenv(
    "FRONTEND_ORIGIN",
    "http://localhost:5173,http://localhost:5174,http://localhost:5175,"
    "http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175",
)
CORS_ORIGINS = _parse_origins(FRONTEND_ORIGIN)

# --- Resume upload ---
RESUME_MAX_SIZE_BYTES = int(os.getenv("RESUME_MAX_SIZE_MB", "5")) * 1024 * 1024

# Optional SMTP delivery for learning assessment alerts.
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_SENDER = os.getenv("SMTP_SENDER", "")
SMTP_USE_STARTTLS = os.getenv("SMTP_USE_STARTTLS", "true").lower() == "true"

# --- Rate Limiting & Abuse Prevention ---
RATE_LIMIT_ENABLED = os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true"
RATE_LIMIT_STORAGE_URI = os.getenv("RATE_LIMIT_STORAGE_URI", None)
TRUSTED_PROXY = os.getenv("TRUSTED_PROXY", "true").lower() == "true"

# Auth Limits
AUTH_LOGIN_RATE_LIMIT = os.getenv("AUTH_LOGIN_RATE_LIMIT", "5/minute")
AUTH_LOGIN_RATE_LIMIT_HOUR = os.getenv("AUTH_LOGIN_RATE_LIMIT_HOUR", "20/hour")
AUTH_LOGIN_MAX_FAILED_ATTEMPTS = int(os.getenv("AUTH_LOGIN_MAX_FAILED_ATTEMPTS", "10"))
AUTH_LOGIN_LOCKOUT_MINUTES = int(os.getenv("AUTH_LOGIN_LOCKOUT_MINUTES", "15"))
AUTH_REGISTER_RATE_LIMIT = os.getenv("AUTH_REGISTER_RATE_LIMIT", "3/hour")

# AI Quotas & Limits
AI_HIGH_COST_PER_MINUTE = int(os.getenv("AI_HIGH_COST_PER_MINUTE", "6"))
AI_HIGH_COST_DAILY_LIMIT = int(os.getenv("AI_HIGH_COST_DAILY_LIMIT", "40"))

AI_MEDIUM_COST_PER_MINUTE = int(os.getenv("AI_MEDIUM_COST_PER_MINUTE", "20"))
AI_MEDIUM_COST_DAILY_LIMIT = int(os.getenv("AI_MEDIUM_COST_DAILY_LIMIT", "200"))

AI_LOW_COST_PER_MINUTE = int(os.getenv("AI_LOW_COST_PER_MINUTE", "30"))
RAG_MAX_DOCUMENTS_PER_USER = int(os.getenv("RAG_MAX_DOCUMENTS_PER_USER", "20"))
RAG_MAX_TEXT_BYTES_PER_USER = int(os.getenv("RAG_MAX_TEXT_BYTES_PER_USER", str(2 * 1024 * 1024)))

# Global Circuit Breaker
GLOBAL_LLM_CALLS_PER_MINUTE = int(os.getenv("GLOBAL_LLM_CALLS_PER_MINUTE", "120"))

# Demo Account Bypass (comma-separated emails with 5x limit multiplier)
ALLOWED_DEMO_USERS = [
    e.strip().lower()
    for e in os.getenv("ALLOWED_DEMO_USERS", "").split(",")
    if e.strip()
]
