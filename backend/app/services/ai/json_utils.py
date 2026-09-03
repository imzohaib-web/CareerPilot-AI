"""Shared lenient JSON extraction/parsing for Qwen (LLM) responses.

LLM output is untrusted and frequently *almost* valid JSON: literal control
characters (raw newlines, tabs) inside string values, markdown code fences,
or Qwen3 ``thinking`` blocks wrapping the payload. These helpers tolerate
those artifacts while still requiring syntactically valid JSON — schema and
business validation remain the caller's responsibility (output trust policy
in docs/AI_ARCHITECTURE.md).
"""

import json
import re

# Closed Qwen3 thinking blocks (angle-bracket think tags) are removed before
# brace matching — a think block may itself contain braces.
_THINK_BLOCK_RE = re.compile(r"<think>.*?</think>", re.DOTALL)


def extract_json_block(text: str) -> str | None:
    """Extract the first JSON object (or array) from *text*.

    Tolerates markdown code fences and Qwen3 ``thinking`` blocks. Returns the
    candidate JSON substring, or ``None`` when no JSON can be located.
    """
    # Thinking blocks may contain braces that break the brace-matching
    # fallback below — remove them first.
    cleaned = _THINK_BLOCK_RE.sub("", text)

    stripped = cleaned.strip()
    if stripped.startswith("```"):
        # Remove opening fence (```json or ```) and closing fence.
        stripped = re.sub(r"^```(?:json)?\s*", "", stripped)
        stripped = re.sub(r"\s*```\s*$", "", stripped)

    if stripped.startswith("{") or stripped.startswith("["):
        return stripped

    # Fallback: find first { ... last }.
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        return cleaned[start : end + 1]

    return None


def loads_lenient(raw_json: str) -> object:
    """``json.loads`` with ``strict=False``.

    Qwen routinely emits literal control characters (raw newlines, tabs)
    inside JSON string values. Strict JSON parsing rejects these even though
    the rest of the document is valid, so parse leniently instead of failing
    the whole request. Raises ``json.JSONDecodeError`` for genuinely invalid
    JSON (the caller decides whether to retry).
    """
    return json.loads(raw_json, strict=False)
