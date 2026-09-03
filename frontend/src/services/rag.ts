import { apiClient } from './apiClient'
import type {
  DocumentInfo,
  DocumentIngestRequest,
  DocumentUploadResponse,
  RAGChatRequest,
  RAGChatResponse,
  RAGQueryRequest,
  RetrievalResult,
} from '../types'

/** Upload and index a new career document or job description. */
export async function uploadDocument(
  payload: DocumentIngestRequest
): Promise<DocumentUploadResponse> {
  const { data } = await apiClient.post<DocumentUploadResponse>(
    '/api/rag/documents/upload',
    payload
  )
  return data
}

/** Retrieve all ingested documents for the current user. */
export async function fetchDocuments(): Promise<DocumentInfo[]> {
  const { data } = await apiClient.get<DocumentInfo[]>('/api/rag/documents')
  return data
}

/** Delete an ingested document and its vector chunks. */
export async function deleteDocument(documentId: string): Promise<void> {
  await apiClient.delete(`/api/rag/documents/${documentId}`)
}

/** Perform vector similarity search over the user's knowledge base. */
export async function queryKnowledgeBase(
  payload: RAGQueryRequest
): Promise<RetrievalResult> {
  const { data } = await apiClient.post<RetrievalResult>('/api/rag/query', payload)
  return data
}

/** Send a question to the RAG-grounded AI advisor. */
export async function sendRagChat(
  payload: RAGChatRequest
): Promise<RAGChatResponse> {
  const { data } = await apiClient.post<RAGChatResponse>('/api/rag/chat', payload)
  return data
}
