import os
from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env explicitly so the app works from any working directory.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

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

# --- CORS (comma-separated list of allowed frontend origins) ---
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175")
CORS_ORIGINS = [origin.strip() for origin in FRONTEND_ORIGIN.split(",") if origin.strip()]

# --- Resume upload ---
RESUME_MAX_SIZE_BYTES = int(os.getenv("RESUME_MAX_SIZE_MB", "5")) * 1024 * 1024
