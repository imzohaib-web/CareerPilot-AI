"""Pydantic schemas for RAG (Retrieval-Augmented Generation) system."""

from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, Field


class DocumentIngestRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="Document title or job description name")
    content: str = Field(..., min_length=10, description="Raw text content of the job description or career document")
    category: Literal["job_description", "interview_guide", "skill_framework", "general"] = Field(
        default="job_description", description="Category of document"
    )
    metadata: dict[str, Any] | None = Field(default_factory=dict, description="Optional extra key-value tags")


class DocumentChunk(BaseModel):
    chunk_id: str
    document_id: str
    document_title: str
    chunk_index: int
    content: str
    embedding: list[float] | None = None
    created_at: datetime


class DocumentInfo(BaseModel):
    id: str
    user_id: str
    title: str
    category: str
    chunk_count: int
    content_length: int
    created_at: datetime


class DocumentUploadResponse(BaseModel):
    document_id: str
    title: str
    chunk_count: int
    message: str


class RAGQueryRequest(BaseModel):
    query: str = Field(..., min_length=2, description="Search query or candidate target role")
    top_k: int = Field(default=3, ge=1, le=10, description="Number of context chunks to retrieve")
    category_filter: str | None = Field(default=None, description="Optional filter by document category")


class ChunkSource(BaseModel):
    chunk_id: str
    document_id: str
    document_title: str
    chunk_index: int
    content: str
    similarity_score: float = Field(..., ge=0.0, le=1.0, description="Cosine similarity relevance score")


class RetrievalResult(BaseModel):
    query: str
    chunks: list[ChunkSource]
    total_retrieved: int


class RAGChatRequest(BaseModel):
    message: str = Field(..., min_length=2, description="User question for RAG grounded advisor")
    top_k: int = Field(default=3, ge=1, le=10, description="Number of context chunks to retrieve")
    document_ids: list[str] | None = Field(default=None, description="Optional document ID scoping")


class RAGChatResponse(BaseModel):
    reply: str
    sources: list[ChunkSource]
    model_used: str
