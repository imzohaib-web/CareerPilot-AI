"""Resume business logic: PDF validation, text extraction, AI analysis, storage.

Follows the project layering rules — business logic lives in services, database
access only through ``app.database``, and AI calls only through ``app.services.ai``.
"""

import io
import logging
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import UploadFile

from app import config
from app.database.mongodb import get_db
from app.schemas.resume import ResumeAnalysisResponse, ResumeAnalysis
from app.services.ai.resume_analyzer import analyze_resume
from app.services.ai.qwen_service import AIServiceError

logger = logging.getLogger(__name__)

# ── Public exceptions ─────────────────────────────────────────────────────


class ResumeValidationError(Exception):
    """Raised when the uploaded file fails validation (user-safe message)."""


# ── PDF validation + text extraction ─────────────────────────────────────


_PDF_MAGIC = b"%PDF"
_MAX_EXTRACTED_CHARS = 50_000  # safety cap on stored text length


async def validate_and_extract(file: UploadFile) -> tuple[str, str]:
    """Validate the upload and extract text from the PDF.

    Returns ``(extracted_text, original_filename)``.
    Raises ``ResumeValidationError`` with a user-safe message on any failure.
    """
    if file is None:
        raise ResumeValidationError("No file was uploaded")

    filename = (file.filename or "").strip()
    if not filename:
        raise ResumeValidationError("The uploaded file has no filename")

    # Extension check (not the only check — we also verify the magic bytes).
    if not filename.lower().endswith(".pdf"):
        raise ResumeValidationError(
            "Only PDF files are accepted. Please upload a .pdf file."
        )

    # Content-type check (informational — browsers may send varying MIME types).
    content_type = (file.content_type or "").lower()
    if content_type and "pdf" not in content_type and "octet-stream" not in content_type:
        raise ResumeValidationError(
            "The uploaded file does not appear to be a valid PDF."
        )

    # Read the file bytes (with size cap).
    max_size = config.RESUME_MAX_SIZE_BYTES
    try:
        contents = await file.read()
    except Exception as exc:
        logger.error("Failed to read uploaded file: %s", exc)
        raise ResumeValidationError("Could not read the uploaded file.") from exc

    if not contents:
        raise ResumeValidationError("The uploaded file is empty.")

    if len(contents) > max_size:
        max_mb = max_size / (1024 * 1024)
        raise ResumeValidationError(
            f"File is too large ({len(contents) / (1024*1024):.1f} MB). "
            f"Maximum allowed size is {max_mb:.0f} MB."
        )

    # Magic-bytes check: real PDFs start with %PDF.
    if not contents.lstrip()[:4].startswith(_PDF_MAGIC):
        raise ResumeValidationError(
            "The file does not appear to be a valid PDF (invalid header)."
        )

    # Extract text using PyMuPDF.
    extracted_text = _extract_pdf_text(contents)
    if not extracted_text or not extracted_text.strip():
        raise ResumeValidationError(
            "No extractable text was found in the PDF. "
            "Please upload a PDF with selectable text (scanned/image-only PDFs are not supported)."
        )

    if len(extracted_text) > _MAX_EXTRACTED_CHARS:
        extracted_text = extracted_text[:_MAX_EXTRACTED_CHARS]

    return extracted_text.strip(), filename


def _extract_pdf_text(pdf_bytes: bytes) -> str:
    """Extract readable text from a PDF using PyMuPDF.

    Returns the concatenated text of all pages, or raises
    ``ResumeValidationError`` on extraction failure.
    """
    try:
        import pymupdf  # PyMuPDF
    except ImportError as exc:
        raise ResumeValidationError("PDF processing library is not available.") from exc

    try:
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:
        logger.warning("PyMuPDF could not open PDF: %s", exc)
        raise ResumeValidationError(
            "The PDF file is malformed or corrupted and cannot be read."
        ) from exc

    if doc.page_count == 0:
        doc.close()
        raise ResumeValidationError("The PDF has no pages.")

    pages_text: list[str] = []
    try:
        for page in doc:
            text = page.get_text("text")
            if text:
                pages_text.append(text)
    except Exception as exc:
        logger.warning("Error reading PDF pages: %s", exc)
        raise ResumeValidationError("Failed to extract text from the PDF.") from exc
    finally:
        doc.close()

    return "\n".join(pages_text)


# ── Analysis + persistence ────────────────────────────────────────────────


async def upload_and_analyze(
    user_id: str, extracted_text: str, filename: str
) -> ResumeAnalysisResponse:
    """Run the full pipeline: AI analysis → MongoDB → response.

    Raises ``AIServiceError`` (mapped to HTTP 502 by the route) on Qwen
    failures, or ``ResumeValidationError`` on persistence problems.
    """
    analysis, model = await analyze_resume(extracted_text)

    now = datetime.now(timezone.utc)
    document = {
        "user_id": ObjectId(user_id),
        "filename": filename,
        "stored_path": "",  # MVP: file not kept on disk
        "extracted_text": extracted_text,
        "analysis": analysis.model_dump(),
        "model": model,
        "uploaded_at": now,
        "analyzed_at": now,
    }

    try:
        result = await get_db().resumes.insert_one(document)
    except Exception as exc:
        logger.error("MongoDB insert failed for resume: %s", exc)
        raise ResumeValidationError("Failed to save the resume analysis.") from exc

    document["_id"] = result.inserted_id
    return _serialize(document, analysis, model)


async def get_latest_analysis(user_id: str) -> ResumeAnalysisResponse | None:
    """Return the most recent resume analysis for this user, or None."""
    doc = await get_db().resumes.find_one(
        {"user_id": ObjectId(user_id)}, sort=[("analyzed_at", -1)]
    )
    if doc is None:
        return None

    try:
        analysis = ResumeAnalysis.model_validate(doc.get("analysis", {}))
    except Exception:
        analysis = ResumeAnalysis()

    return _serialize(doc, analysis, doc.get("model", "unknown"))


# ── Serialization ─────────────────────────────────────────────────────────


def _serialize(
    doc: dict, analysis: ResumeAnalysis, model: str
) -> ResumeAnalysisResponse:
    return ResumeAnalysisResponse(
        id=str(doc["_id"]),
        user_id=str(doc["user_id"]),
        filename=doc.get("filename", ""),
        extracted_text_length=len(doc.get("extracted_text", "")),
        analysis=analysis,
        analyzed_at=doc.get("analyzed_at", doc.get("uploaded_at", datetime.now(timezone.utc))),
        model=model,
    )
