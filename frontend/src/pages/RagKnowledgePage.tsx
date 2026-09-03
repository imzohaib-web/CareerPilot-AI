import { useCallback, useEffect, useState } from 'react'
import {
  BookOpen,
  Database,
  Search,
  UploadCloud,
  Trash2,
  Send,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Bot,
  User,
  MessageSquare,
} from 'lucide-react'

import { MessageContent } from '../components/chat/MessageContent'
import { describeApiError } from '../services/apiClient'
import * as ragService from '../services/rag'
import type {
  ChunkSource,
  DocumentInfo,
} from '../types'

interface ChatMessage {
  id: string
  sender: 'user' | 'ai'
  text: string
  sources?: ChunkSource[]
  modelUsed?: string
  timestamp: string
}

function categoryBadge(category: string): { bg: string; color: string; label: string } {
  switch (category) {
    case 'job_description':
      return { bg: 'bg-indigo-50 border-indigo-200', color: 'text-indigo-700', label: 'Job Description' }
    case 'interview_guide':
      return { bg: 'bg-slate-100 border-slate-200', color: 'text-slate-800', label: 'Interview Guide' }
    case 'skill_framework':
      return { bg: 'bg-teal-50 border-teal-200', color: 'text-teal-700', label: 'Skill Framework' }
    default:
      return { bg: 'bg-slate-100 border-slate-200', color: 'text-slate-700', label: 'General' }
  }
}

export function RagKnowledgePage() {
  const [activeTab, setActiveTab] = useState<'chat' | 'documents' | 'query'>('chat')
  const [documents, setDocuments] = useState<DocumentInfo[]>([])
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
      text: 'Hello! I am your **Grounded Career Advisor**. Upload target job descriptions, industry rubrics, or interview guides in the **Knowledge Base**, and ask any questions. I will cite answers directly from your documents.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [isSendingChat, setIsSendingChat] = useState(false)
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({})

  // ── Load User Documents ──────────────────────────────────────────────────
  const loadDocuments = useCallback(async () => {
    setError(null)
    try {
      const data = await ragService.fetchDocuments()
      setDocuments(data)
    } catch (err) {
      setError(describeApiError(err).message)
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
      setSuccessMsg('Document removed from knowledge base.')
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
      const res = await ragService.sendRagChat({ message: msg, top_k: 4 })
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
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            RAG Grounded Career Advisor
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 max-w-2xl">
            Ingest custom job specs, rubrics, and career guides into vector storage for grounded, verified AI guidance.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 self-start sm:self-auto text-xs">
          {[
            { id: 'chat' as const, label: 'Advisor Chat', icon: MessageSquare },
            { id: 'documents' as const, label: `Knowledge Base (${documents.length})`, icon: Database },
            { id: 'query' as const, label: 'Vector Search', icon: Search },
          ].map((t) => {
            const Icon = t.icon
            const isSelected = activeTab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition ${
                  isSelected
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Global Alerts */}
      {successMsg && (
        <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 animate-fade-in">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {successMsg}
          </span>
          <button type="button" onClick={() => setSuccessMsg(null)} className="font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 animate-fade-in">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600" />
            {error}
          </span>
          <button type="button" onClick={() => setError(null)} className="font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      {/* ── Tab 1: RAG Chat ─────────────────────────────────────────────── */}
      {activeTab === 'chat' && (
        <div className="flex flex-col min-h-[450px] space-y-4">
          {documents.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 flex items-start justify-between gap-3">
              <div className="space-y-0.5 text-xs">
                <p className="font-semibold text-amber-900">Knowledge Base is currently empty</p>
                <p className="text-amber-700">
                  Switch to the <button type="button" onClick={() => setActiveTab('documents')} className="underline font-semibold">Knowledge Base tab</button> to ingest job specs or company guides for grounded answers.
                </p>
              </div>
            </div>
          )}

          {/* Chat Messages */}
          <div className="space-y-4">
            {chatMessages.map((msg) => {
              const isUser = msg.sender === 'user'
              const isSourcesExpanded = expandedSources[msg.id]

              return (
                <div key={msg.id} className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white shadow-xs mt-0.5">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-xl p-3.5 sm:p-4 text-xs ${
                      isUser
                        ? 'bg-slate-900 text-white rounded-br-xs'
                        : 'clean-card text-slate-800 rounded-bl-xs'
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                    ) : (
                      <div className="leading-relaxed prose prose-xs max-w-none text-slate-800 prose-headings:text-slate-900">
                        <MessageContent content={msg.text} />
                      </div>
                    )}

                    {/* Grounded Document Citations */}
                    {!isUser && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedSources((prev) => ({
                              ...prev,
                              [msg.id]: !prev[msg.id],
                            }))
                          }
                          className="flex items-center justify-between w-full text-[11px] font-medium text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200"
                        >
                          <span className="flex items-center gap-1.5">
                            <BookOpen className="h-3.5 w-3.5 text-slate-500" />
                            <span>Grounded in {msg.sources.length} Verified Sources</span>
                          </span>
                          {isSourcesExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>

                        {isSourcesExpanded && (
                          <div className="mt-2 space-y-1.5">
                            {msg.sources.map((src, idx) => (
                              <div
                                key={idx}
                                className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 text-[11px] space-y-0.5"
                              >
                                <div className="flex items-center justify-between text-slate-700 font-semibold">
                                  <span>{src.document_title}</span>
                                  <span className="text-[10px] text-slate-500">
                                    Sim: {(src.similarity_score * 100).toFixed(0)}%
                                  </span>
                                </div>
                                <p className="text-slate-500 line-clamp-3 leading-relaxed">
                                  {src.content}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div
                      className={`mt-1.5 flex items-center justify-between text-[10px] ${
                        isUser ? 'text-slate-400' : 'text-slate-400'
                      }`}
                    >
                      <span>{msg.timestamp}</span>
                      {msg.modelUsed && <span>Model: {msg.modelUsed}</span>}
                    </div>
                  </div>

                  {isUser && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-700 shadow-xs mt-0.5">
                      <User className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
              )
            })}

            {isSendingChat && (
              <div className="flex gap-2 items-center text-xs text-slate-500">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-600" />
                <span>Searching vector store & drafting response…</span>
              </div>
            )}
          </div>

          {/* Floating Composer */}
          <div className="sticky bottom-0 z-10 bg-slate-50/95 pt-2 pb-4">
            <form
              onSubmit={handleSendChat}
              className="clean-card p-1.5 flex items-center gap-2 focus-within:border-slate-400"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask any question grounded in your uploaded career documents..."
                className="flex-1 border-0 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSendingChat || !inputMessage.trim()}
                className="btn-primary text-xs py-1.5 px-3.5 shrink-0"
              >
                <span>Send</span>
                <Send className="h-3 w-3" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Tab 2: Knowledge Base (Document Management) ──────────────────── */}
      {activeTab === 'documents' && (
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          {/* Upload Document Form */}
          <div className="lg:col-span-5 clean-card p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <UploadCloud className="h-4 w-4 text-slate-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                Ingest Document
              </h2>
            </div>

            <form onSubmit={handleIngest} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Document Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. OpenAI Senior Backend Job Spec"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(
                      e.target.value as
                        | 'job_description'
                        | 'interview_guide'
                        | 'skill_framework'
                        | 'general'
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition"
                >
                  <option value="job_description">Job Description</option>
                  <option value="interview_guide">Interview Guide</option>
                  <option value="skill_framework">Skill Framework / Rubric</option>
                  <option value="general">General Documentation</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Text Content <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={8}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste text, requirements, or rubrics here..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition resize-none leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={isUploading || !title.trim() || !content.trim()}
                className="w-full btn-primary text-xs py-2 px-4"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Chunking & Embedding…</span>
                  </>
                ) : (
                  <>
                    <Database className="h-3.5 w-3.5" />
                    <span>Ingest Document</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Document Library Table */}
          <div className="lg:col-span-7 clean-card p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">
                Indexed Documents ({documents.length})
              </h3>
              <button
                type="button"
                onClick={loadDocuments}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Refresh</span>
              </button>
            </div>

            {documents.length > 0 ? (
              <div className="space-y-2">
                {documents.map((doc) => {
                  const badge = categoryBadge(doc.category)
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 hover:bg-white transition"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-900">{doc.title}</span>
                          <span
                            className={`rounded px-1.5 py-0.2 text-[10px] font-semibold border ${badge.bg} ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {doc.chunk_count} Vector Chunks · Added {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDelete(doc.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition"
                        title="Delete document"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No documents in knowledge base yet. Ingest your first document on the left.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 3: Vector Explorer ──────────────────────────────────────── */}
      {activeTab === 'query' && (
        <div className="clean-card p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Semantic Vector Search</h2>
            <p className="text-xs text-slate-500">
              Query vector embeddings directly to inspect matching text chunks and cosine similarity scores.
            </p>
          </div>

          <form onSubmit={handleVectorSearch} className="flex gap-2">
            <input
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="e.g. distributed systems requirements, system design principles"
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isSearching || !queryText.trim()}
              className="btn-primary text-xs py-2 px-4 shrink-0"
            >
              {isSearching ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              <span>Search Chunks</span>
            </button>
          </form>

          {queryResults.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Top Matching Chunks ({queryResults.length})
              </h3>

              <div className="grid gap-3 sm:grid-cols-2">
                {queryResults.map((chunk, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between text-slate-700 font-semibold">
                      <span className="truncate max-w-[180px]">{chunk.document_title}</span>
                      <span className="rounded bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.2 text-[10px]">
                        {(chunk.similarity_score * 100).toFixed(1)}% Match
                      </span>
                    </div>
                    <p className="text-slate-600 leading-relaxed text-[11px]">{chunk.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
