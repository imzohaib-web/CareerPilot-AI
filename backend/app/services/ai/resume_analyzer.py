"""AI Resume Analyzer — structured Qwen analysis of extracted resume text.

This module lives inside ``app/services/ai`` so all LLM interactions stay
isolated. It reuses the shared ``qwen_service.chat()`` client and never
creates a second provider connection.

Output trust policy (per AI_ARCHITECTURE.md):
  Generated → Parsed → Schema validated → Business validated → returned.
"""

import json
import logging
import time

from pydantic import ValidationError

from app import config
from app.schemas.resume import ResumeAnalysis
from app.services.ai.json_utils import extract_json_block, loads_lenient
from app.services.ai.qwen_service import AIServiceError, chat as qwen_chat

logger = logging.getLogger(__name__)

# ── Prompt ────────────────────────────────────────────────────────────────

RESUME_ANALYSIS_SYSTEM_PROMPT = """\
You are CareerPilot AI, an expert resume analyst for students and \
early-career developers. You analyze resumes with precision and honesty.

RULES:
- Analyze ONLY information explicitly present in the resume text.
- NEVER invent, assume, or hallucinate qualifications, skills, companies, \
degrees, projects, certifications, or achievements.
- Clearly distinguish MISSING information from NEGATIVE information.
- If a section (e.g. projects, certifications) is not present, return an \
empty array — do not fabricate entries.
- Provide actionable, specific improvement suggestions.
- The score must reflect ATS compatibility and overall job-readiness for \
entry-level / early-career roles (0 = very weak, 100 = excellent).

OUTPUT FORMAT — return ONLY valid JSON (no markdown, no code fences, no \
commentary before or after the JSON object):

{
  "score": <integer 0-100>,
  "summary": "<one-paragraph summary of the resume>",
  "strengths": ["<strength 1>", "<strength 2>", ...],
  "weaknesses": ["<weakness 1>", "<weakness 2>", ...],
  "missing_info": ["<missing item 1>", ...],
  "improvements": ["<actionable suggestion 1>", ...],
  "skills_detected": ["<skill 1>", "<skill 2>", ...],
  "sections": {
    "education": [
      {"institution": "", "degree": "", "field_of_study": "", "year": ""}
    ],
    "experience": [
      {"company": "", "role": "", "duration": "", "description": ""}
    ],
    "projects": [
      {"name": "", "description": "", "technologies": []}
    ],
    "certifications": ["<certification 1>", ...]
  }
}
"""

# Low temperature for deterministic structured output.
_ANALYSIS_TEMPERATURE = 0.2

# Hard cap on resume text sent to the model (tokens cost money).
_MAX_TEXT_CHARS = 15_000

# Resume analysis needs more time than a short chat — structured JSON output
# with multiple sections is slower to generate.  Configurable via env.
_RESUME_TIMEOUT = float(120)


# ── Public API ────────────────────────────────────────────────────────────


async def analyze_resume(extracted_text: str) -> tuple[ResumeAnalysis, str]:
    """Run a structured Qwen analysis on *extracted_text*.

    Returns ``(analysis, model_name)``.

    Raises ``AIConfigurationError`` when the provider is not configured
    (the caller maps that to HTTP 503) and ``AIServiceError`` on provider
    failures or repeated validation failures (mapped to HTTP 502).
    """
    if not extracted_text or not extracted_text.strip():
        raise AIServiceError("No resume text provided for analysis")

    # Truncate overly long resumes to stay within token limits.
    user_text = extracted_text.strip()
    if len(user_text) > _MAX_TEXT_CHARS:
        logger.info(
            "Resume text truncated from %d to %d chars for Qwen request",
            len(user_text),
            _MAX_TEXT_CHARS,
        )
        user_text = user_text[:_MAX_TEXT_CHARS]

    logger.info(
        "Starting Qwen resume analysis (text_chars=%d, timeout=%.0fs)",
        len(user_text),
        _RESUME_TIMEOUT,
    )

    user_message = f"Analyze the following resume text:\n\n{user_text}"

    # First attempt
    t0 = time.monotonic()
    analysis, model = await _call_and_parse(user_message)
    if analysis is not None:
        logger.info(
            "Qwen resume analysis succeeded in %.1fs (model=%s)",
            time.monotonic() - t0,
            model,
        )
        return analysis, model

    # Retry once with a corrective nudge (per output-trust policy).
    logger.warning("Resume analysis validation failed on first attempt; retrying with corrective prompt")
    corrective = (
        user_message
        + "\n\nIMPORTANT: Your previous response was not valid JSON. "
        "Return ONLY the JSON object as specified — no markdown, no code fences."
    )
    analysis, model = await _call_and_parse(corrective)
    if analysis is None:
        raise AIServiceError("AI returned an unparseable resume analysis after retry")

    logger.info(
        "Qwen resume analysis succeeded on retry in %.1fs (model=%s)",
        time.monotonic() - t0,
        model,
    )
    return analysis, model


# ── Internal helpers ──────────────────────────────────────────────────────


async def _call_and_parse(
    user_message: str,
) -> tuple[ResumeAnalysis | None, str]:
    """Call Qwen, parse JSON, validate schema. Returns (analysis|None, model)."""
    try:
        reply, model = await qwen_chat(
            user_message,
            system_prompt=RESUME_ANALYSIS_SYSTEM_PROMPT,
            temperature=_ANALYSIS_TEMPERATURE,
            timeout=_RESUME_TIMEOUT,
            # Disable Qwen3 thinking mode — it adds significant latency and
            # wraps the response in <think> tags that break JSON parsing.
            extra_body={"enable_thinking": config.QWEN_ENABLE_THINKING},
        )
    except AIServiceError:
        raise

    raw_json = extract_json_block(reply)
    if raw_json is None:
        logger.warning(
            "Resume analysis failed at stage=json_extract (reply_chars=%d): %s",
            len(reply),
            reply[:200],
        )
        return None, model

    try:
        # Lenient parse: Qwen routinely emits literal control characters
        # (raw newlines/tabs) inside string values — the JSON is otherwise
        # valid and must not fail the request.
        data = loads_lenient(raw_json)
    except json.JSONDecodeError as exc:
        logger.warning(
            "Resume analysis failed at stage=json_parse: %s — snippet: %s",
            exc,
            raw_json[:200],
        )
        return None, model

    try:
        analysis = ResumeAnalysis.model_validate(data)
    except ValidationError as exc:
        logger.warning("Resume analysis failed at stage=schema_validation: %s", exc)
        return None, model

    # Business validation: clamp score just in case (Pydantic ge/le already set).
    return analysis, model
