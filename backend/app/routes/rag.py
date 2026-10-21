"""RAG (Retrieval-Augmented Generation) REST API routes."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app import config
from app.core.rate_limit import (
    limiter,
    low_cost_rate_limit,
    medium_cost_rate_limit,
    require_low_cost_quota,
    require_medium_cost_quota,
)
from app.database.mongodb import get_db
from app.schemas.rag import (
    DocumentInfo,
    DocumentIngestRequest,
    DocumentUploadResponse,
    KnowledgeBaseStats,
    RAGChatRequest,
    RAGChatResponse,
    RAGQueryRequest,
    RetrievalResult,
)
from app.services import knowledge_seeder, rag_service
from app.services.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/rag", tags=["RAG & Knowledge Base"])


@router.post("/documents/upload", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(low_cost_rate_limit)
async def upload_document(
    request: Request,
    payload: DocumentIngestRequest,
    current_user: dict = Depends(get_current_user),
    _: None = Depends(require_low_cost_quota),
) -> DocumentUploadResponse:
    """Ingest a new job description or career document into vector chunks. Capped at 20 docs and 2 MB text."""
    user_id = str(current_user["_id"])
    content_bytes = len(payload.content.encode("utf-8"))

    if content_bytes > config.RAG_MAX_TEXT_BYTES_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document exceeds maximum allowable text size of {config.RAG_MAX_TEXT_BYTES_PER_USER // (1024 * 1024)} MB",
        )

    # Check user document count and cumulative text size caps
    existing = await rag_service.list_user_documents(user_id=user_id)
    user_docs = [d for d in existing if d.scope != "global" and d.user_id == user_id]

    if len(user_docs) >= config.RAG_MAX_DOCUMENTS_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document upload cap reached (maximum {config.RAG_MAX_DOCUMENTS_PER_USER} documents per user)",
        )

    cumulative_bytes = sum(getattr(d, "content_length", 0) for d in user_docs)
    if cumulative_bytes + content_bytes > config.RAG_MAX_TEXT_BYTES_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Total document storage limit reached (maximum {config.RAG_MAX_TEXT_BYTES_PER_USER // (1024 * 1024)} MB per user)",
        )

    try:
        return await rag_service.ingest_document(user_id=user_id, payload=payload)
    except Exception as exc:
        logger.exception("Failed to ingest document for user %s", user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to ingest document into knowledge base",
        ) from exc


@router.get("/documents", response_model=list[DocumentInfo])
async def list_documents(
    current_user: dict = Depends(get_current_user),
) -> list[DocumentInfo]:
    """Retrieve all ingested documents for the authenticated user."""
    user_id = str(current_user["_id"])
    return await rag_service.list_user_documents(user_id=user_id)


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
) -> None:
    """Delete an ingested document and its vector chunks."""
    user_id = str(current_user["_id"])
    deleted = await rag_service.delete_document(user_id=user_id, document_id=document_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied",
        )


@router.post("/query", response_model=RetrievalResult)
@limiter.limit(low_cost_rate_limit)
async def query_knowledge_base(
    request: Request,
    payload: RAGQueryRequest,
    current_user: dict = Depends(get_current_user),
    _: None = Depends(require_low_cost_quota),
) -> RetrievalResult:
    """Perform vector similarity search over knowledge base document chunks."""
    user_id = str(current_user["_id"])
    chunks = await rag_service.retrieve_context(
        user_id=user_id,
        query=payload.query,
        top_k=payload.top_k,
        category_filter=payload.category_filter,
    )
    return RetrievalResult(
        query=payload.query,
        chunks=chunks,
        total_retrieved=len(chunks),
        status=getattr(chunks, "status", "grounded"),
    )


@router.post("/chat", response_model=RAGChatResponse)
@limiter.limit(medium_cost_rate_limit)
async def grounded_chat(
    request: Request,
    payload: RAGChatRequest,
    current_user: dict = Depends(get_current_user),
    _: None = Depends(require_medium_cost_quota),
) -> RAGChatResponse:
    """Ask a question and receive an AI answer grounded in retrieved document context."""
    user_id = str(current_user["_id"])
    try:
        return await rag_service.grounded_chat(
            user_id=user_id,
            message=payload.message,
            top_k=payload.top_k,
            document_ids=payload.document_ids,
            allow_general_knowledge=payload.allow_general_knowledge,
        )
    except Exception as exc:
        logger.exception("Failed to execute RAG chat for user %s", user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate grounded RAG response",
        ) from exc


def _get_optional_db() -> AsyncIOMotorDatabase | None:
    """Return database handle if connected, otherwise None for resilient offline fallback."""
    try:
        return get_db()
    except Exception:
        return None


@router.get("/knowledge-base/stats", response_model=KnowledgeBaseStats)
async def get_knowledge_base_stats(
    db: AsyncIOMotorDatabase | None = Depends(_get_optional_db),
) -> KnowledgeBaseStats:
    """Retrieve curated global knowledge base statistics, category breakdown, and status."""
    return await knowledge_seeder.get_knowledge_base_stats(db=db)
