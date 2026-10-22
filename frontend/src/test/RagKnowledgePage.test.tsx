import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { AxiosError } from 'axios'
import { RagKnowledgePage } from '../pages/RagKnowledgePage'
import * as ragService from '../services/rag'
import type { DocumentInfo, KnowledgeBaseStats } from '../types'

vi.mock('../services/rag', () => ({
  fetchDocuments: vi.fn(),
  fetchKnowledgeBaseStats: vi.fn(),
  uploadDocument: vi.fn(),
  deleteDocument: vi.fn(),
  queryKnowledgeBase: vi.fn(),
  sendRagChat: vi.fn(),
}))

describe('RagKnowledgePage Resilience & Rendering Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders successfully with normal data and displays documents and stats without throwing', async () => {
    const mockDocs: DocumentInfo[] = [
      {
        id: 'doc-1',
        user_id: null,
        title: 'Backend Engineering Guide',
        category: 'role_matrix',
        chunk_count: 2,
        content_length: 1200,
        scope: 'global',
        created_at: '2026-03-01T12:00:00Z',
        deletable: false,
      },
      {
        id: 'doc-2',
        user_id: 'user-123',
        title: 'Personal Resume 2026',
        category: 'resume_guide',
        chunk_count: 1,
        content_length: 800,
        scope: 'user',
        created_at: '2026-03-02T15:30:00Z',
        deletable: true,
      },
    ]

    const mockStats: KnowledgeBaseStats = {
      total_documents: 2,
      total_chunks: 3,
      global_documents: 1,
      global_chunks: 2,
      user_documents: 1,
      user_chunks: 1,
      categories: ['role_matrix', 'resume_guide'],
      embedding_model: 'DashScope text-embedding-v3',
      vector_dimension: 256,
      retrieval_backend: 'atlas',
      storage_mode: 'mongodb',
      last_updated: '2026-03-02T15:30:00Z',
    }

    vi.mocked(ragService.fetchDocuments).mockResolvedValue(mockDocs)
    vi.mocked(ragService.fetchKnowledgeBaseStats).mockResolvedValue(mockStats)

    render(<RagKnowledgePage />)

    // Verify main title renders
    expect(screen.getByText('RAG Grounded Career Advisor')).toBeInTheDocument()

    // Wait for stats to load
    await waitFor(() => {
      expect(screen.getByText('Knowledge Base Status')).toBeInTheDocument()
      expect(screen.getByText(/MongoDB Atlas/i)).toBeInTheDocument()
    })

    // Switch to Knowledge Base tab
    const kbTab = screen.getByRole('button', { name: /Knowledge Base/i })
    fireEvent.click(kbTab)

    // Verify document library cards render
    await waitFor(() => {
      expect(screen.getByText('Backend Engineering Guide')).toBeInTheDocument()
      expect(screen.getByText('Personal Resume 2026')).toBeInTheDocument()
    })

    // Verify global doc shows Built-in and delete is not permitted
    expect(screen.getAllByText('Built-in').length).toBeGreaterThanOrEqual(1)
    // User doc has deletable trash icon
    expect(screen.getByRole('button', { name: /Delete Personal Resume 2026/i })).toBeInTheDocument()
  })

  it('renders correctly with empty data and shows clean empty state without throwing', async () => {
    vi.mocked(ragService.fetchDocuments).mockResolvedValue([])
    vi.mocked(ragService.fetchKnowledgeBaseStats).mockResolvedValue({
      total_documents: 0,
      total_chunks: 0,
      global_documents: 0,
      global_chunks: 0,
      user_documents: 0,
      user_chunks: 0,
      categories: [],
      embedding_model: 'DashScope',
      vector_dimension: 256,
      retrieval_backend: 'memory',
      storage_mode: 'memory',
      last_updated: null,
    })

    render(<RagKnowledgePage />)

    await waitFor(() => {
      expect(screen.getByText('Knowledge Base Status')).toBeInTheDocument()
    })

    const kbTab = screen.getByRole('button', { name: /Knowledge Base \(0\)/i })
    fireEvent.click(kbTab)

    await waitFor(() => {
      expect(screen.getByText('No documents found in knowledge base.')).toBeInTheDocument()
    })
  })

  it('handles missing optional fields, undefined dates, and dict categories safely without throwing', async () => {
    // Malformed document with missing or undefined fields
    const malformedDocs = [
      {
        id: 'doc-incomplete',
        user_id: null,
        title: '',
        category: '',
        chunk_count: (undefined as unknown) as number,
        content_length: 0,
        scope: undefined,
        created_at: (null as unknown) as string,
        deletable: undefined,
      },
    ] as DocumentInfo[]

    // Stats with categories as an object (the exact API bug)
    const malformedStats = {
      total_documents: 1,
      total_chunks: 1,
      global_documents: 1,
      global_chunks: 1,
      user_documents: 0,
      user_chunks: 0,
      categories: { career_guide: 1, role_matrix: 1 } as unknown as string[],
      embedding_model: '',
      vector_dimension: 0,
      retrieval_backend: 'memory',
      storage_mode: 'memory',
      last_updated: undefined,
    } as unknown as KnowledgeBaseStats

    vi.mocked(ragService.fetchDocuments).mockResolvedValue(malformedDocs)
    vi.mocked(ragService.fetchKnowledgeBaseStats).mockResolvedValue(malformedStats)

    expect(() => render(<RagKnowledgePage />)).not.toThrow()

    await waitFor(() => {
      expect(screen.getByText('Knowledge Base Status')).toBeInTheDocument()
    })

    const kbTab = screen.getByRole('button', { name: /Knowledge Base/i })
    fireEvent.click(kbTab)

    await waitFor(() => {
      expect(screen.getByText('Untitled Document')).toBeInTheDocument()
      expect(screen.getByText(/0 Vector Chunks/i)).toBeInTheDocument()
    })
  })

  it('handles 500 server error gracefully without a blank page, showing actionable retry UI', async () => {
    const error500 = new AxiosError(
      'Request failed with status code 500',
      '500',
      undefined,
      undefined,
      {
        status: 500,
        statusText: 'Internal Server Error',
        data: { detail: 'Internal database query failure' },
        headers: {},
        config: {} as any,
      }
    )

    vi.mocked(ragService.fetchDocuments).mockRejectedValue(error500)
    vi.mocked(ragService.fetchKnowledgeBaseStats).mockRejectedValue(error500)

    render(<RagKnowledgePage />)

    // Switch to Knowledge Base tab to verify error container
    const kbTab = screen.getByRole('button', { name: /Knowledge Base/i })
    fireEvent.click(kbTab)

    await waitFor(() => {
      const errMsgs = screen.getAllByText(/Internal database query failure/i)
      expect(errMsgs.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByRole('button', { name: /Retry Documents/i })).toBeInTheDocument()
    })

    // Page must remain responsive and not blank
    expect(screen.getByText('RAG Grounded Career Advisor')).toBeInTheDocument()
  })

  it('handles network error (backend offline) gracefully showing clear connection advice', async () => {
    const networkError = new AxiosError('Network Error', 'ERR_NETWORK')

    vi.mocked(ragService.fetchDocuments).mockRejectedValue(networkError)
    vi.mocked(ragService.fetchKnowledgeBaseStats).mockRejectedValue(networkError)

    render(<RagKnowledgePage />)

    const kbTab = screen.getByRole('button', { name: /Knowledge Base/i })
    fireEvent.click(kbTab)

    await waitFor(() => {
      const errMsgs = screen.getAllByText(/Cannot reach the server. Check that the backend is running/i)
      expect(errMsgs.length).toBeGreaterThanOrEqual(1)
    })

    expect(screen.getByRole('button', { name: /Retry Documents/i })).toBeInTheDocument()
    expect(screen.getByText('RAG Grounded Career Advisor')).toBeInTheDocument()
  })
})
