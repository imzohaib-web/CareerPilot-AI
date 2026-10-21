import { useCallback, useEffect, useState } from 'react'
import {
  Database,
  Search,
  UploadCloud,
  Trash2,
  Send,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Bot,
  User,
  MessageSquare,
  Sparkles,
  Layers,
  ShieldCheck,
} from 'lucide-react'

import { MessageContent } from '../components/chat/MessageContent'
import { GroundedSourcesSection } from '../components/common/GroundedSourcesSection'
import { describeApiError } from '../services/apiClient'
import * as ragService from '../services/rag'
import type {
  ChunkSource,
  CitationRef,
  DocumentInfo,
  KnowledgeBaseStats,
} from '../types'

interface ChatMessage {
  id: string
  sender: 'user' | 'ai'
  text: string
  sources?: ChunkSource[]
  citations?: CitationRef[]
  retrievalStatus?: 'grounded' | 'weak' | 'no_context' | string
  modelUsed?: string
  isSearchOnly?: boolean
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
    case 'role_matrix':
      return { bg: 'bg-purple-50 border-purple-200', color: 'text-purple-700', label: 'Role Matrix' }
    default:
      return { bg: 'bg-slate-100 border-slate-200', color: 'text-slate-700', label: 'General' }
  }
}

export function RagKnowledgePage() {
  const [activeTab, setActiveTab] = useState<'chat' | 'documents' | 'query'>('chat')
  const [documents, setDocuments] = useState<DocumentInfo[]>([])
  const [kbStats, setKbStats] = useState<KnowledgeBaseStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Document Ingestion State
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<'job_description' | 'interview_guide' | 'skill_framework' | 'general'>('job_description')
  const [isUploading, setIsUploading] = useState(false)

  // Search-Only Mode Toggle (for judges to inspect retrieval without LLM)
  const [searchOnlyMode, setSearchOnlyMode] = useState(false)

  // Vector Query State
  const [queryText, setQueryText] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [queryResults, setQueryResults] = useState<ChunkSource[]>([])

  // RAG Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: 'Hello! I am your **Grounded Career Advisor**. All answers are strictly grounded in our verified knowledge base and your uploaded documents, complete with verifiable in-text citations [1].',
      retrievalStatus: 'grounded',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [isSendingChat, setIsSendingChat] = useState(false)
  const [activeCitation, setActiveCitation] = useState<CitationRef | null>(null)

  // ── Load KB Stats and Documents ─────────────────────────────────────────
  const loadData = useCallback(async () => {
    setError(null)
    try {
      const [docs, stats] = await Promise.all([
        ragService.fetchDocuments(),
        ragService.fetchKnowledgeBaseStats().catch(() => null),
      ])
      setDocuments(docs)
      if (stats) setKbStats(stats)
    } catch (err) {
      setError(describeApiError(err).message)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

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
      await loadData()
    } catch (err) {
      setError(describeApiError(err).message)
    } finally {
      setIsUploading(false)
    }
  }

  // ── Handle Delete Document (Own Documents Only) ───────────────────────────
  async function handleDelete(docId: string, scope?: string) {
    if (scope === 'global') {
      setError('Built-in system documents are read-only and cannot be deleted.')
      return
    }

    setError(null)
    setSuccessMsg(null)
    try {
      await ragService.deleteDocument(docId)
      setDocuments((prev) => prev.filter((d) => d.id !== docId))
      setSuccessMsg('Document removed from knowledge base.')
      await loadData()
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
      const res = await ragService.queryKnowledgeBase({ query: queryText.trim(), top_k: 6 })
      setQueryResults(res.chunks)
    } catch (err) {
      setError(describeApiError(err).message)
    } finally {
      setIsSearching(false)
    }
  }

  // ── Handle RAG Chat / Search-Only ─────────────────────────────────────────
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

    if (searchOnlyMode) {
      // Search-Only Mode: retrieves and shows fused ranks without LLM generation
      try {
        const res = await ragService.queryKnowledgeBase({ query: msg, top_k: 5 })
        const searchMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: `Retrieved **${res.chunks.length} candidate chunks** using hybrid vector + BM25 fusion across knowledge base documents. Inspection view (no LLM generation called):`,
          sources: res.chunks,
          isSearchOnly: true,
          retrievalStatus: res.status || 'grounded',
          modelUsed: 'hybrid-retriever-only',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
        setChatMessages((prev) => [...prev, searchMsg])
      } catch (err) {
        setError(describeApiError(err).message)
      } finally {
        setIsSendingChat(false)
      }
      return
    }

    // Grounded Chat Mode: calls /api/rag/chat
    try {
      const res = await ragService.sendRagChat({ message: msg, top_k: 4 })
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: res.answer || res.reply,
        sources: res.sources,
        citations: res.citations || [],
        retrievalStatus: res.retrieval_status || 'grounded',
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
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              RAG Grounded Career Advisor
            </h1>
            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
              Hybrid Grounded
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 max-w-2xl">
            Strictly grounded in verified industry competencies, interview question banks, and your uploaded documents with source citations.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 self-start sm:self-auto text-xs">
          {[
            { id: 'chat' as const, label: 'Advisor Chat', icon: MessageSquare },
            { id: 'documents' as const, label: `Knowledge Base (${documents.length})`, icon: Database },
            { id: 'query' as const, label: 'Vector Explorer', icon: Search },
          ].map((t) => {
            const Icon = t.icon
            const isSelected = activeTab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition cursor-pointer ${
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

      {/* ── Knowledge Base Status Header ─────────────────────────────────── */}
      {kbStats && (
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span className="font-semibold text-slate-900">Knowledge Base Status</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-600 font-mono text-[11px]">
                {kbStats.retrieval_backend} ({kbStats.vector_dimension}d)
              </span>
            </div>
            {kbStats.last_updated && (
              <span className="text-[11px] text-slate-500">
                Updated {new Date(kbStats.last_updated).toLocaleDateString()} {new Date(kbStats.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200/60">
              <span className="text-[10px] uppercase font-bold text-slate-400">Global Documents</span>
              <p className="text-base font-bold text-slate-900 mt-0.5">{kbStats.global_documents}</p>
              <p className="text-[10px] text-slate-500">{kbStats.global_chunks} verified chunks</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200/60">
              <span className="text-[10px] uppercase font-bold text-slate-400">Your Documents</span>
              <p className="text-base font-bold text-slate-900 mt-0.5">{kbStats.user_documents}</p>
              <p className="text-[10px] text-slate-500">{kbStats.user_chunks} custom chunks</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200/60">
              <span className="text-[10px] uppercase font-bold text-slate-400">Embedding Engine</span>
              <p className="text-xs font-bold text-slate-900 mt-1 truncate">{kbStats.embedding_model}</p>
              <p className="text-[10px] text-emerald-600 font-medium">DashScope Native</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200/60">
              <span className="text-[10px] uppercase font-bold text-slate-400">Corpus Categories</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {kbStats.categories.slice(0, 3).map((cat) => (
                  <span key={cat} className="rounded bg-white px-1.5 py-0.5 text-[9px] font-medium border border-slate-200 text-slate-700">
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Alerts */}
      {successMsg && (
        <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 animate-fade-in">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            {successMsg}
          </span>
          <button type="button" onClick={() => setSuccessMsg(null)} className="font-medium underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 animate-fade-in">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            {error}
          </span>
          <button type="button" onClick={() => setError(null)} className="font-medium underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* ── Tab 1: RAG Chat ─────────────────────────────────────────────── */}
      {activeTab === 'chat' && (
        <div className="flex flex-col min-h-[480px] space-y-4">
          {/* Mode Bar: Search Only vs Grounded Chat */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-200 bg-white text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-slate-600" />
              <span className="font-semibold text-slate-800">
                Mode: {searchOnlyMode ? 'Search Only (Inspection)' : 'Grounded AI Advisor'}
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-[11px] text-slate-500">
                {searchOnlyMode
                  ? 'Retrieves vector + BM25 ranked chunks without invoking Qwen generation'
                  : 'Answers strictly from knowledge base with verifiable citations [1]'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setSearchOnlyMode((prev) => !prev)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition border cursor-pointer ${
                searchOnlyMode
                  ? 'bg-amber-500 text-white border-amber-600'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
              }`}
            >
              {searchOnlyMode ? 'Switch to Chat Mode' : 'Inspect Search Only (No LLM)'}
            </button>
          </div>

          {/* Chat Messages */}
          <div className="space-y-4">
            {chatMessages.map((msg) => {
              const isUser = msg.sender === 'user'
              const isNoContext = msg.retrievalStatus === 'no_context'
              const isWeak = msg.retrievalStatus === 'weak'

              return (
                <div key={msg.id} className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white shadow-xs mt-0.5">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-xl p-3.5 sm:p-4 text-xs space-y-2.5 ${
                      isUser
                        ? 'bg-slate-900 text-white rounded-br-xs'
                        : 'clean-card text-slate-800 rounded-bl-xs'
                    }`}
                  >
                    {/* Status Badge */}
                    {!isUser && msg.retrievalStatus && (
                      <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                        {msg.retrievalStatus === 'grounded' && (
                          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                            Grounded in Knowledge Base
                          </span>
                        )}
                        {isWeak && (
                          <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 text-amber-600" />
                            Limited Coverage — Answered Cautiously
                          </span>
                        )}
                        {isNoContext && (
                          <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3 text-slate-500" />
                            Refusal Path: No Relevant Context
                          </span>
                        )}
                      </div>
                    )}

                    {/* Content Display */}
                    {isUser ? (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                    ) : isNoContext ? (
                      /* Distinct No-Context Refusal Card with Upload CTA */
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3.5 space-y-3">
                        <div className="flex items-start gap-2.5">
                          <AlertCircle className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-900">No Knowledge Base Coverage</p>
                            <p className="text-slate-600 leading-relaxed text-[11px]">{msg.text}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab('documents')}
                          className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <UploadCloud className="h-3.5 w-3.5" />
                          <span>Upload a Document to Knowledge Base</span>
                        </button>
                      </div>
                    ) : (
                      <div className="leading-relaxed prose prose-xs max-w-none text-slate-800 prose-headings:text-slate-900">
                        <MessageContent content={msg.text} />
                      </div>
                    )}

                    {/* Search-Only Mode Inspection Cards */}
                    {msg.isSearchOnly && msg.sources && (
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-900">
                          <Layers className="h-3.5 w-3.5 text-slate-600" />
                          <span>Retrieved Candidates (Hybrid Fused Ranks)</span>
                        </div>
                        <div className="space-y-1.5">
                          {msg.sources.map((src, i) => (
                            <div key={i} className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-[11px] space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-900 truncate">
                                  #{i + 1} · {src.document_title}
                                </span>
                                <span className="rounded bg-slate-200/80 px-1.5 py-0.2 font-mono text-[10px] text-slate-800">
                                  Sim: {(src.similarity_score * 100).toFixed(1)}%
                                </span>
                              </div>
                              <p className="text-slate-600 leading-relaxed text-[10px] line-clamp-3">
                                {src.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Inline Citation Chips */}
                    {!isUser && msg.citations && msg.citations.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Citations:
                          </span>
                          {msg.citations.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setActiveCitation(activeCitation?.id === c.id ? null : c)}
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold border transition cursor-pointer ${
                                activeCitation?.id === c.id
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                              }`}
                            >
                              <span>[{c.id}]</span>
                              <span className="truncate max-w-[130px] font-normal">{c.document_title}</span>
                            </button>
                          ))}
                        </div>

                        {/* Active Citation Card */}
                        {activeCitation && (
                          <div className="rounded-lg border border-slate-300 bg-white p-2.5 text-[11px] space-y-1.5 shadow-xs animate-fade-in">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-900">
                                [{activeCitation.id}] {activeCitation.document_title}
                              </span>
                              <span className="rounded px-1.5 py-0.2 text-[10px] font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700">
                                {activeCitation.scope === 'global' ? 'Built-in' : 'Your Document'} · {(activeCitation.similarity * 100).toFixed(0)}% Match
                              </span>
                            </div>
                            <p className="text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 leading-relaxed text-[10px]">
                              {activeCitation.snippet}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Collapsible Source List */}
                    {!isUser && msg.citations && msg.citations.length > 0 && (
                      <GroundedSourcesSection sources={msg.citations} title="Referenced Knowledge Sources" />
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
                <span>Searching vector store & applying hybrid ranking…</span>
              </div>
            )}
          </div>

          {/* Floating Composer */}
          <div className="sticky bottom-0 z-10 bg-slate-50/95 pt-2 pb-4">
            <form
              onSubmit={handleSendChat}
              className="clean-card p-1.5 flex items-center gap-2 focus-within:border-slate-400 shadow-sm"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={
                  searchOnlyMode
                    ? 'Search knowledge base chunks directly (e.g. FastAPI routing, STAR method)...'
                    : 'Ask any question grounded in knowledge base documents...'
                }
                className="flex-1 border-0 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSendingChat || !inputMessage.trim()}
                className="btn-primary text-xs py-1.5 px-3.5 shrink-0 cursor-pointer"
              >
                <span>{searchOnlyMode ? 'Search' : 'Ask'}</span>
                {searchOnlyMode ? <Search className="h-3 w-3" /> : <Send className="h-3 w-3" />}
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
                Ingest Career Document
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
                  placeholder="Paste requirements, rubrics, or curriculum here..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition resize-none leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={isUploading || !title.trim() || !content.trim()}
                className="w-full btn-primary text-xs py-2 px-4 cursor-pointer"
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
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Document Library ({documents.length})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Built-in documents are accessible to all users; your uploaded documents are private to you.
                </p>
              </div>
              <button
                type="button"
                onClick={loadData}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Refresh</span>
              </button>
            </div>

            {documents.length > 0 ? (
              <div className="space-y-2">
                {documents.map((doc) => {
                  const badge = categoryBadge(doc.category)
                  const isGlobal = doc.scope === 'global'

                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 hover:bg-white transition"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-slate-900 truncate max-w-[240px]">
                            {doc.title}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.2 text-[10px] font-semibold border ${badge.bg} ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.2 text-[10px] font-semibold border ${
                              isGlobal
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            }`}
                          >
                            {isGlobal ? 'Built-in' : 'Your Document'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {doc.chunk_count} Vector Chunks · Added {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Delete only allowed for user documents */}
                      {!isGlobal ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(doc.id, doc.scope)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer shrink-0"
                          title="Delete your document"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <span
                          className="text-[10px] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 border border-slate-200 shrink-0"
                          title="Built-in documents cannot be deleted"
                        >
                          Protected
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No documents found in knowledge base.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 3: Vector Explorer ──────────────────────────────────────── */}
      {activeTab === 'query' && (
        <div className="clean-card p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Semantic Vector & BM25 Explorer</h2>
            <p className="text-xs text-slate-500">
              Query vector embeddings directly to inspect matching text chunks, fused ranks, and cosine similarity scores.
            </p>
          </div>

          <form onSubmit={handleVectorSearch} className="flex gap-2">
            <input
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="e.g. distributed systems requirements, system design principles, FastAPI"
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isSearching || !queryText.trim()}
              className="btn-primary text-xs py-2 px-4 shrink-0 cursor-pointer"
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
                    className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-1.5 text-xs shadow-2xs"
                  >
                    <div className="flex items-center justify-between text-slate-700 font-semibold">
                      <span className="truncate max-w-[200px] text-slate-900">
                        #{idx + 1} · {chunk.document_title}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="rounded bg-indigo-50 border border-indigo-200 text-indigo-700 px-1.5 py-0.2 text-[10px] font-medium">
                          {chunk.scope === 'global' ? 'Built-in' : 'User'}
                        </span>
                        <span className="rounded bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.2 text-[10px] font-mono">
                          {(chunk.similarity_score * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    {chunk.section_title && (
                      <p className="text-[10px] text-slate-500 font-medium truncate">
                        Section: {chunk.section_title}
                      </p>
                    )}
                    <p className="text-slate-600 leading-relaxed text-[11px] bg-white p-2 rounded border border-slate-100 line-clamp-4">
                      {chunk.content}
                    </p>
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
