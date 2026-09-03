"""RAG (Retrieval-Augmented Generation) REST API routes."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database.mongodb import get_db
from app.schemas.rag import (
    DocumentInfo,
    DocumentIngestRequest,
    DocumentUploadResponse,
    RAGChatRequest,
    RAGChatResponse,
    RAGQueryRequest,
    RetrievalResult,
)
from app.services import rag_service
from app.services.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/rag", tags=["RAG & Knowledge Base"])


@router.post("/documents/upload", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    payload: DocumentIngestRequest,
    current_user: dict = Depends(get_current_user),
) -> DocumentUploadResponse:
    """Ingest a new job description or career document into vector chunks."""
    user_id = str(current_user["_id"])
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
async def query_knowledge_base(
    payload: RAGQueryRequest,
    current_user: dict = Depends(get_current_user),
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
    )


@router.post("/chat", response_model=RAGChatResponse)
async def grounded_chat(
    payload: RAGChatRequest,
    current_user: dict = Depends(get_current_user),
) -> RAGChatResponse:
    """Ask a question and receive an AI answer grounded in retrieved document context."""
    user_id = str(current_user["_id"])
    try:
        return await rag_service.grounded_chat(
            user_id=user_id,
            message=payload.message,
            top_k=payload.top_k,
            document_ids=payload.document_ids,
        )
    except Exception as exc:
        logger.exception("Failed to execute RAG chat for user %s", user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate grounded RAG response",
        ) from exc
