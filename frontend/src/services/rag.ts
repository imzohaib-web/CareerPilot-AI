import { apiClient } from './apiClient'
import { streamPost, type StreamHandlers } from './streamClient'
import type {
  ChunkSource,
  CitationRef,
  DocumentInfo,
  DocumentIngestRequest,
  DocumentUploadResponse,
  KnowledgeBaseStats,
  RAGChatRequest,
  RAGChatResponse,
  RAGQueryRequest,
  RetrievalResult,
} from '../types'

// ── Normalization Helpers ──────────────────────────────────────────────────

export function normalizeDocumentInfo(item: unknown): DocumentInfo {
  const d = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
  const rawCreated = d.created_at
  let validIsoDate: string
  if (typeof rawCreated === 'string' && !isNaN(Date.parse(rawCreated))) {
    validIsoDate = rawCreated
  } else {
    validIsoDate = new Date().toISOString()
  }

  const rawChunkCount = Number(d.chunk_count)
  const rawContentLength = Number(d.content_length)
  const scopeStr = typeof d.scope === 'string' ? d.scope.toLowerCase() : 'user'
  const cleanScope = scopeStr === 'global' ? 'global' : 'user'

  const rawUserId = d.user_id != null ? String(d.user_id) : null
  const deletable = typeof d.deletable === 'boolean' ? d.deletable : cleanScope !== 'global'

  return {
    id: String(d.id ?? d._id ?? ''),
    user_id: rawUserId,
    title: typeof d.title === 'string' && d.title.trim() ? d.title.trim() : 'Untitled Document',
    category: typeof d.category === 'string' && d.category.trim() ? d.category.trim() : 'general',
    chunk_count: !isNaN(rawChunkCount) && rawChunkCount >= 0 ? Math.floor(rawChunkCount) : 0,
    content_length: !isNaN(rawContentLength) && rawContentLength >= 0 ? Math.floor(rawContentLength) : 0,
    created_at: validIsoDate,
    scope: cleanScope,
    deletable,
  }
}

export function normalizeKnowledgeBaseStats(data: unknown): KnowledgeBaseStats {
  const s = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>

  const totalDocs = Number(s.total_documents ?? s.global_documents ?? 0)
  const totalChunks = Number(s.total_chunks ?? s.global_chunks ?? 0)
  const userDocs = Number(s.user_documents ?? 0)
  const userChunks = Number(s.user_chunks ?? 0)

  // Safe category array extraction
  let categories: string[] = []
  let categoriesMap: Record<string, number> = {}

  if (Array.isArray(s.categories)) {
    categories = s.categories.map((c) => String(c).trim()).filter(Boolean)
  } else if (s.categories && typeof s.categories === 'object') {
    categoriesMap = s.categories as Record<string, number>
    categories = Object.keys(s.categories).filter((k) => typeof k === 'string' && k.trim())
  } else if (Array.isArray(s.category_list)) {
    categories = s.category_list.map((c) => String(c).trim()).filter(Boolean)
  }

  const rawUpdated = s.last_updated ?? s.last_seeded_at
  let lastUpdatedStr: string | null = null
  if (typeof rawUpdated === 'string' && !isNaN(Date.parse(rawUpdated))) {
    lastUpdatedStr = rawUpdated
  }

  const rawDim = Number(s.vector_dimension)

  return {
    total_documents: !isNaN(totalDocs) ? Math.max(0, totalDocs) : 0,
    total_chunks: !isNaN(totalChunks) ? Math.max(0, totalChunks) : 0,
    global_documents: !isNaN(totalDocs) ? Math.max(0, totalDocs) : 0,
    global_chunks: !isNaN(totalChunks) ? Math.max(0, totalChunks) : 0,
    user_documents: !isNaN(userDocs) ? Math.max(0, userDocs) : 0,
    user_chunks: !isNaN(userChunks) ? Math.max(0, userChunks) : 0,
    categories,
    categories_map: categoriesMap,
    category_list: categories,
    embedding_model: typeof s.embedding_model === 'string' && s.embedding_model ? s.embedding_model : 'text-embedding-v3',
    vector_dimension: !isNaN(rawDim) && rawDim > 0 ? Math.floor(rawDim) : 1024,
    retrieval_backend: typeof s.retrieval_backend === 'string' && s.retrieval_backend ? s.retrieval_backend : 'atlas',
    storage_mode: typeof s.storage_mode === 'string' ? s.storage_mode : 'mongodb',
    database_name: s.database_name != null ? String(s.database_name) : null,
    last_updated: lastUpdatedStr,
    last_seeded_at: lastUpdatedStr,
    status: typeof s.status === 'string' ? s.status : 'ready',
  }
}

export function normalizeChunkSource(item: unknown): ChunkSource {
  const c = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
  const rawSim = Number(c.similarity_score ?? c.similarity ?? 0)
  const cleanSim = !isNaN(rawSim) ? Math.max(0, Math.min(1, rawSim)) : 0
  const rawIdx = Number(c.chunk_index ?? 0)
  const rawRank = c.fused_rank != null ? Number(c.fused_rank) : c.rank != null ? Number(c.rank) : undefined

  return {
    chunk_id: String(c.chunk_id ?? c._id ?? ''),
    document_id: String(c.document_id ?? ''),
    document_title: typeof c.document_title === 'string' && c.document_title.trim() ? c.document_title.trim() : 'Document',
    section_title: c.section_title != null ? String(c.section_title) : null,
    heading_path: c.heading_path != null ? String(c.heading_path) : null,
    chunk_index: !isNaN(rawIdx) ? Math.max(0, Math.floor(rawIdx)) : 0,
    content: typeof c.content === 'string' ? c.content : '',
    similarity_score: cleanSim,
    category: typeof c.category === 'string' ? c.category : 'general',
    scope: c.scope === 'global' ? 'global' : 'user',
    fused_rank: rawRank != null && !isNaN(rawRank) ? Math.floor(rawRank) : undefined,
  }
}

export function normalizeCitationRef(item: unknown, fallbackId = 1): CitationRef {
  const c = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
  const rawId = Number(c.id)
  const cleanId = !isNaN(rawId) && rawId > 0 ? Math.floor(rawId) : fallbackId
  const rawSim = Number(c.similarity ?? c.similarity_score ?? 0)
  const cleanSim = !isNaN(rawSim) ? Math.max(0, Math.min(1, rawSim)) : 0

  return {
    id: cleanId,
    source_id: String(c.source_id ?? c.chunk_id ?? ''),
    document_title: typeof c.document_title === 'string' && c.document_title.trim() ? c.document_title.trim() : 'Untitled',
    section_title: c.section_title != null ? String(c.section_title) : null,
    heading_path: c.heading_path != null ? String(c.heading_path) : null,
    snippet: typeof c.snippet === 'string' ? c.snippet : '',
    similarity: cleanSim,
    scope: c.scope === 'global' ? 'global' : 'user',
  }
}

export function normalizeRetrievalResult(data: unknown): RetrievalResult {
  const r = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  const rawChunks = Array.isArray(r.chunks) ? r.chunks : []
  const cleanChunks = rawChunks.map(normalizeChunkSource)
  const total = Number(r.total_retrieved ?? cleanChunks.length)

  return {
    query: typeof r.query === 'string' ? r.query : '',
    chunks: cleanChunks,
    total_retrieved: !isNaN(total) ? Math.max(0, Math.floor(total)) : cleanChunks.length,
    status: typeof r.status === 'string' ? r.status : 'grounded',
    retrieval_backend: typeof r.retrieval_backend === 'string' ? r.retrieval_backend : 'atlas',
  }
}

export function normalizeRAGChatResponse(data: unknown): RAGChatResponse {
  const r = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  const text = typeof r.answer === 'string' && r.answer ? r.answer : typeof r.reply === 'string' ? r.reply : ''
  const rawSources = Array.isArray(r.sources) ? r.sources : []
  const rawCitations = Array.isArray(r.citations) ? r.citations : []

  return {
    reply: text,
    answer: text,
    sources: rawSources.map(normalizeChunkSource),
    citations: rawCitations.map((c, i) => normalizeCitationRef(c, i + 1)),
    model_used: typeof r.model_used === 'string' ? r.model_used : 'qwen-plus',
    status: typeof r.status === 'string' ? r.status : 'grounded',
    retrieval_status: typeof r.retrieval_status === 'string' ? r.retrieval_status : (typeof r.status === 'string' ? r.status : 'grounded'),
    used_general_knowledge: Boolean(r.used_general_knowledge),
  }
}

// ── API Methods ────────────────────────────────────────────────────────────

/** Upload and index a new career document or job description. */
export async function uploadDocument(
  payload: DocumentIngestRequest
): Promise<DocumentUploadResponse> {
  const { data } = await apiClient.post<DocumentUploadResponse>(
    '/api/rag/documents/upload',
    payload
  )
  const rawCount = Number(data?.chunk_count ?? 0)
  return {
    document_id: String(data?.document_id ?? ''),
    title: String(data?.title ?? payload.title),
    chunk_count: !isNaN(rawCount) ? Math.max(0, rawCount) : 0,
    message: String(data?.message ?? 'Document uploaded successfully'),
  }
}

/** Retrieve all ingested documents for the current user. */
export async function fetchDocuments(): Promise<DocumentInfo[]> {
  const { data } = await apiClient.get<unknown>('/api/rag/documents')
  if (!Array.isArray(data)) {
    return []
  }
  return data.map(normalizeDocumentInfo)
}

/** Delete an ingested document and its vector chunks. */
export async function deleteDocument(documentId: string): Promise<void> {
  await apiClient.delete(`/api/rag/documents/${documentId}`)
}

/** Fetch aggregated knowledge base statistics (global + user docs/chunks, categories, backend). */
export async function fetchKnowledgeBaseStats(): Promise<KnowledgeBaseStats> {
  const { data } = await apiClient.get<unknown>('/api/rag/knowledge-base/stats')
  return normalizeKnowledgeBaseStats(data)
}

/** Perform vector similarity search over the user's knowledge base. */
export async function queryKnowledgeBase(
  payload: RAGQueryRequest
): Promise<RetrievalResult> {
  const { data } = await apiClient.post<unknown>('/api/rag/query', payload)
  return normalizeRetrievalResult(data)
}

/** Send a question to the RAG-grounded AI advisor. */
export async function sendRagChat(
  payload: RAGChatRequest
): Promise<RAGChatResponse> {
  const { data } = await apiClient.post<unknown>('/api/rag/chat', payload)
  return normalizeRAGChatResponse(data)
}

/**
 * Stream a question to the RAG-grounded AI advisor using SSE.
 */
export async function streamRagChat(
  payload: RAGChatRequest,
  handlers: StreamHandlers<RAGChatResponse>,
  signal?: AbortSignal,
): Promise<void> {
  return streamPost<RAGChatResponse>({
    path: '/api/rag/chat/stream',
    body: payload,
    handlers: {
      ...handlers,
      onDone: (rawDone) => {
        const normalized = normalizeRAGChatResponse(rawDone)
        handlers.onDone?.(normalized)
      },
    },
    signal,
  })
}
