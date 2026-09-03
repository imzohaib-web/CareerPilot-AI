import { useCallback, useEffect, useState } from 'react'
import { describeApiError } from '../services/apiClient'
import * as ragService from '../services/rag'
import type {
  ChunkSource,
  DocumentInfo,
  RAGChatResponse,
} from '../types'

interface ChatMessage {
  id: string
  sender: 'user' | 'ai'
  text: string
  sources?: ChunkSource[]
  modelUsed?: string
  timestamp: string
}

export function RagKnowledgePage() {
  const [activeTab, setActiveTab] = useState<'documents' | 'query' | 'chat'>('chat')
  const [documents, setDocuments] = useState<DocumentInfo[]>([])
  const [isLoadingDocs, setIsLoadingDocs] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Document Ingestion State
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<'job_description' | 'interview_guide' | 'skill_framework' | 'general'>('job_description')
  const [isUploading, setIsUploading] = useState(false)

  // Vector Query State
  const [queryText, setQueryText] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [queryResults, setQueryResults] = useState<ChunkSource[]>([])

  // RAG Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: 'Hello! I am your RAG Grounded Career Advisor. Upload target job descriptions or interview guides in the **Knowledge Hub** tab, and ask me any questions! I will ground my answers strictly in your source documents.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [isSendingChat, setIsSendingChat] = useState(false)

  // ── Load User Documents ──────────────────────────────────────────────────
  const loadDocuments = useCallback(async () => {
    setIsLoadingDocs(true)
    setError(null)
    try {
      const data = await ragService.fetchDocuments()
      setDocuments(data)
    } catch (err) {
      setError(describeApiError(err).message)
    } finally {
      setIsLoadingDocs(false)
    }
  }, [])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  // ── Handle Upload Document ───────────────────────────────────────────────
  async function handleIngest(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return

    setIsUploading(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const res = await ragService.uploadDocument({
        title: title.trim(),
        content: content.trim(),
        category,
      })
      setSuccessMsg(res.message)
      setTitle('')
      setContent('')
      await loadDocuments()
    } catch (err) {
      setError(describeApiError(err).message)
    } finally {
      setIsUploading(false)
    }
  }

  // ── Handle Delete Document ───────────────────────────────────────────────
  async function handleDelete(docId: string) {
    setError(null)
    setSuccessMsg(null)
    try {
      await ragService.deleteDocument(docId)
      setDocuments((prev) => prev.filter((d) => d.id !== docId))
      setSuccessMsg('Document removed successfully.')
    } catch (err) {
      setError(describeApiError(err).message)
    }
  }

  // ── Handle Vector Query ──────────────────────────────────────────────────
  async function handleVectorSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!queryText.trim()) return

    setIsSearching(true)
    setError(null)
    try {
      const res = await ragService.queryKnowledgeBase({ query: queryText.trim(), top_k: 5 })
      setQueryResults(res.chunks)
    } catch (err) {
      setError(describeApiError(err).message)
    } finally {
      setIsSearching(false)
    }
  }

  // ── Handle RAG Chat ──────────────────────────────────────────────────────
  async function handleSendChat(e: React.FormEvent) {
    e.preventDefault()
    const msg = inputMessage.trim()
    if (!msg || isSendingChat) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: msg,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setChatMessages((prev) => [...prev, userMsg])
    setInputMessage('')
    setIsSendingChat(true)
    setError(null)

    try {
      const res: RAGChatResponse = await ragService.sendRagChat({ message: msg, top_k: 3 })
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: res.reply,
        sources: res.sources,
        modelUsed: res.model_used,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setChatMessages((prev) => [...prev, aiMsg])
    } catch (err) {
      setError(describeApiError(err).message)
    } finally {
      setIsSendingChat(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      {/* Top Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-violet-100 p-2 text-violet-700 font-semibold text-lg">⚡ RAG</span>
            <h1 className="text-2xl font-bold text-slate-900">Knowledge Base & AI Advisor</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Upload target job descriptions & career guides to ground AI guidance strictly in real document context.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === 'chat' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            💬 Grounded Chat
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === 'documents' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📚 Knowledge Hub ({documents.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('query')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === 'query' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🔍 Vector Sandbox
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-700">
          {successMsg}
        </div>
      )}

      {/* ── TAB 1: RAG GROUNDED CHAT STUDIO ──────────────────────────────── */}
      {activeTab === 'chat' && (
        <div className="mt-6 flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm" style={{ minHeight: '520px' }}>
          {/* Chat Messages */}
          <div className="flex-1 space-y-4 overflow-y-auto p-6" style={{ maxHeight: '480px' }}>
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-2xl rounded-2xl p-4 text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-violet-600 text-white rounded-br-none'
                      : 'border border-slate-200 bg-slate-50 text-slate-800 rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {/* Sources Cards */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-4 border-t border-slate-200/60 pt-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-violet-700">
                        📌 Grounded Context Sources ({msg.sources.length}):
                      </span>
                      <div className="mt-2 space-y-2">
                        {msg.sources.map((src, i) => (
                          <div key={i} className="rounded-xl border border-violet-100 bg-white p-3 text-xs shadow-xs text-slate-700">
                            <div className="flex items-center justify-between font-medium text-violet-800">
                              <span>📄 {src.document_title} (Chunk #{src.chunk_index + 1})</span>
                              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-2xs font-semibold text-violet-700">
                                Match: {(src.similarity_score * 100).toFixed(0)}%
                              </span>
                            </div>
                            <p className="mt-1 font-mono text-3xs text-slate-600 line-clamp-2">
                              "{src.content}"
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className={`mt-2 flex items-center justify-between text-3xs ${
                    msg.sender === 'user' ? 'text-violet-200' : 'text-slate-400'
                  }`}>
                    <span>{msg.timestamp}</span>
                    {msg.modelUsed && <span>Model: {msg.modelUsed}</span>}
                  </div>
                </div>
              </div>
            ))}
            {isSendingChat && (
              <div className="flex items-center gap-2 text-xs font-medium text-violet-600 animate-pulse">
                <span className="h-2 w-2 rounded-full bg-violet-600"></span>
                RAG engine searching knowledge chunks & generating grounded answer...
              </div>
            )}
          </div>

          {/* Input Bar */}
          <form onSubmit={handleSendChat} className="border-t border-slate-200 p-4 bg-slate-50/50 rounded-b-2xl">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ask any question about your uploaded target role, skills, or guidelines..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={isSendingChat}
                className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm focus:border-violet-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSendingChat || !inputMessage.trim()}
                className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
              >
                Send RAG Query
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── TAB 2: KNOWLEDGE HUB (DOCUMENT UPLOAD & MANAGE) ──────────────── */}
      {activeTab === 'documents' && (
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {/* Upload Form */}
          <div className="md:col-span-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              📥 Ingest New Document
            </h3>
            <form onSubmit={handleIngest} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600">Document Title</label>
                <input
                  type="text"
                  placeholder="e.g. Senior Frontend Developer JD"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-violet-500 focus:outline-none"
                >
                  <option value="job_description">Job Description</option>
                  <option value="interview_guide">Interview Guide</option>
                  <option value="skill_framework">Skill Framework</option>
                  <option value="general">General Note</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600">Raw Document Text</label>
                <textarea
                  rows={8}
                  placeholder="Paste job description requirements, qualifications, company guidelines, or role specs..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-xs focus:border-violet-500 focus:outline-none font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={isUploading}
                className="w-full rounded-xl bg-violet-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
              >
                {isUploading ? 'Chunking & Indexing...' : 'Index Document Chunks'}
              </button>
            </form>
          </div>

          {/* Document List */}
          <div className="md:col-span-2 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              📑 Ingested Documents ({documents.length})
            </h3>
            {isLoadingDocs ? (
              <p className="text-xs text-slate-400 animate-pulse">Loading knowledge base documents...</p>
            ) : documents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center">
                <p className="text-xs font-medium text-slate-500">No documents ingested yet.</p>
                <p className="mt-1 text-3xs text-slate-400">Add a job description on the left to activate RAG contextual search!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 text-sm">{doc.title}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-3xs font-medium text-slate-600">
                          {doc.category}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {doc.chunk_count} vector chunks indexed • {doc.content_length} characters
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(doc.id)}
                      className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: VECTOR RETRIEVAL SANDBOX ────────────────────────────── */}
      {activeTab === 'query' && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
            🔍 Cosine Similarity Vector Retrieval Sandbox
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Test how candidate queries match against indexed document chunks in real time.
          </p>

          <form onSubmit={handleVectorSearch} className="mt-4 flex gap-2">
            <input
              type="text"
              placeholder="e.g. Python FastAPI async experience required"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-xs focus:border-violet-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isSearching}
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
            >
              {isSearching ? 'Searching...' : 'Run Vector Search'}
            </button>
          </form>

          {/* Results */}
          <div className="mt-6 space-y-3">
            {queryResults.map((chunk, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>📄 {chunk.document_title} (Chunk #{chunk.chunk_index + 1})</span>
                  <span className="rounded-md bg-violet-100 px-2 py-0.5 text-violet-700 font-mono text-3xs">
                    Relevance: {(chunk.similarity_score * 100).toFixed(1)}%
                  </span>
                </div>
                {/* Progress bar */}
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-violet-600"
                    style={{ width: `${Math.min(100, chunk.similarity_score * 100)}%` }}
                  />
                </div>
                <p className="mt-3 font-mono text-xs text-slate-600 leading-relaxed bg-white p-3 rounded-lg border border-slate-200/60">
                  "{chunk.content}"
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
