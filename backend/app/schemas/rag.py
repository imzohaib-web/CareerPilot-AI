"""Pydantic schemas for RAG (Retrieval-Augmented Generation) system."""

from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, Field


class DocumentIngestRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="Document title or job description name")
    content: str = Field(..., min_length=10, description="Raw text content of the job description or career document")
    category: str = Field(
        default="job_description", description="Category of document (e.g. role_matrix, learning_path, interview_guide, resume_guide, career_guide)"
    )
    metadata: dict[str, Any] | None = Field(default_factory=dict, description="Optional extra key-value tags")


class DocumentChunk(BaseModel):
    chunk_id: str
    document_id: str
    document_title: str
    chunk_index: int
    content: str
    embedding: list[float] | None = None
    embedding_model: str = Field(default="hash-256-fallback", description="Name of the embedding model used")
    embedding_dim: int = Field(default=256, description="Dimension of the embedding vector")
    scope: Literal["global", "user"] = Field(default="user", description="Chunk visibility scope")
    section_title: str | None = Field(default=None, description="Optional section heading")
    heading_path: str | None = Field(default=None, description="Optional breadcrumb heading path")
    role: str | None = Field(default=None, description="Associated role tag")
    user_id: str | None = Field(default=None, description="Owner user ID or None for global")
    created_at: datetime


class DocumentInfo(BaseModel):
    id: str
    user_id: str | None = Field(default=None, description="Owner user ID or None for global documents")
    title: str
    category: str
    chunk_count: int
    content_length: int
    scope: Literal["global", "user"] = Field(default="user", description="Document visibility scope")
    created_at: datetime
    deletable: bool = Field(default=False, description="Whether the document can be deleted by the requesting user")


class DocumentUploadResponse(BaseModel):
    document_id: str
    title: str
    chunk_count: int
    message: str


class RAGQueryRequest(BaseModel):
    query: str = Field(..., min_length=2, description="Search query or candidate target role")
    top_k: int = Field(default=5, ge=1, le=10, description="Number of context chunks to retrieve")
    category_filter: str | None = Field(default=None, description="Optional filter by document category")


class ChunkSource(BaseModel):
    chunk_id: str
    document_id: str
    document_title: str
    chunk_index: int
    content: str
    similarity_score: float = Field(default=0.0, description="Cosine similarity relevance score")
    similarity: float = Field(default=0.0, description="Cosine similarity score")
    keyword_score: float = Field(default=0.0, description="BM25/keyword relevance score")
    fused_score: float = Field(default=0.0, description="Reciprocal Rank Fusion score")
    rank: int = Field(default=1, description="Fused ranking position")
    category: str = Field(default="general", description="Document category")
    role: str | None = Field(default=None, description="Target role tag")
    scope: str = Field(default="user", description="Scope: user or global")
    section_title: str | None = Field(default=None, description="Section heading")
    heading_path: str | None = Field(default=None, description="Breadcrumb heading path")


class RetrievalResult(BaseModel):
    query: str
    chunks: list[ChunkSource]
    total_retrieved: int
    status: Literal["grounded", "weak", "no_context"] = Field(
        default="grounded", description="Retrieval confidence status"
    )
    retrieval_backend: Literal["atlas", "memory"] = Field(
        default="atlas", description="Backend used for vector retrieval ('atlas' or 'memory')"
    )



class CitationRef(BaseModel):
    id: int = Field(..., description="1-based citation index matching [1], [2] in answer text")
    source_id: str = Field(default="", description="Chunk or document identifier")
    document_title: str = Field(default="Untitled", description="Title of the cited document")
    section_title: str | None = Field(default=None, description="Section heading")
    heading_path: str | None = Field(default=None, description="Breadcrumb heading path")
    snippet: str = Field(default="", description="Relevant snippet of chunk content")
    similarity: float = Field(default=0.0, description="Cosine similarity score")
    scope: str = Field(default="global", description="Scope: global or user")


class RAGChatRequest(BaseModel):
    message: str = Field(..., min_length=2, description="User question for RAG grounded advisor")
    top_k: int = Field(default=5, ge=1, le=10, description="Number of context chunks to retrieve")
    document_ids: list[str] | None = Field(default=None, description="Optional document ID scoping")
    allow_general_knowledge: bool = Field(default=False, description="Allow falling back to general model knowledge")


class RAGChatResponse(BaseModel):
    reply: str
    answer: str = Field(default="", description="Grounded answer text (same as reply)")
    sources: list[ChunkSource] = Field(default_factory=list, description="All retrieved context chunks")
    citations: list[CitationRef] = Field(default_factory=list, description="Validated citations referenced in the answer")
    model_used: str
    status: Literal["grounded", "weak", "no_context"] = Field(
        default="grounded", description="Retrieval confidence status"
    )
    retrieval_status: Literal["grounded", "weak", "no_context"] = Field(
        default="grounded", description="Retrieval confidence status (alias)"
    )
    used_general_knowledge: bool = Field(
        default=False, description="Whether outside general knowledge was utilized"
    )


class KnowledgeBaseStats(BaseModel):
    total_documents: int = Field(default=0, description="Total number of global knowledge base documents")
    total_chunks: int = Field(default=0, description="Total number of global knowledge base chunks")
    global_documents: int = Field(default=0, description="Count of global curated documents")
    global_chunks: int = Field(default=0, description="Count of global curated chunks")
    user_documents: int = Field(default=0, description="Count of user-uploaded documents")
    user_chunks: int = Field(default=0, description="Count of user-uploaded chunks")
    categories: dict[str, int] = Field(default_factory=dict, description="Document counts grouped by category")
    category_list: list[str] = Field(default_factory=list, description="List of unique category names")
    chunks_by_category: dict[str, int] = Field(default_factory=dict, description="Chunk counts grouped by category")
    last_seeded_at: datetime | None = Field(default=None, description="Timestamp of the most recent seed execution")
    last_updated: datetime | None = Field(default=None, description="Timestamp of the most recent update")
    embedding_model: str = Field(default="text-embedding-v3", description="Active embedding model name")
    vector_dimension: int = Field(default=1024, description="Embedding vector dimension")
    retrieval_backend: str = Field(default="atlas", description="Retrieval backend in use ('atlas' or 'memory')")
    storage_mode: str = Field(default="mongodb", description="Storage mode: 'mongodb' or 'memory'")
    database_name: str | None = Field(default="careerpilot_ai", description="Name of the active database")
    status: str = Field(default="ready", description="Knowledge base readiness status (ready, seeding, unseeded, error)")
