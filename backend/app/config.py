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

# --- CORS (comma-separated list of allowed frontend origins) ---
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
CORS_ORIGINS = [origin.strip() for origin in FRONTEND_ORIGIN.split(",") if origin.strip()]
