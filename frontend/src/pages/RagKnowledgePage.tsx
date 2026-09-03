import { useCallback, useEffect, useState } from 'react'
import {
  BookOpen,
  Sparkles,
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
      return { bg: 'bg-purple-50 border-purple-200', color: 'text-purple-700', label: 'Interview Guide' }
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
      text: 'Hello! I am your **RAG Grounded Career Advisor**. Upload target job descriptions, industry rubrics, or interview guides in the **Knowledge Hub**, and ask me any questions! I will ground my answers strictly in your uploaded knowledge base with source citations.',
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
      setSuccessMsg('Document removed successfully from knowledge base.')
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
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 border border-brand-200/60 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-brand-600" />
            <span>MongoDB Vector Store + Qwen-Max RAG</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            RAG Grounded Career Advisor
          </h1>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">
            Ingest custom job specs, interview rubrics, and career guides into vector storage for hallucination-free, verified AI guidance.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex rounded-2xl bg-slate-100 p-1.5 border border-slate-200 self-start sm:self-auto text-xs">
          {[
            { id: 'chat' as const, label: 'RAG Advisor Chat', icon: Sparkles },
            { id: 'documents' as const, label: `Knowledge Hub (${documents.length})`, icon: Database },
            { id: 'query' as const, label: 'Vector Explorer', icon: Search },
          ].map((t) => {
            const Icon = t.icon
            const isSelected = activeTab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-bold transition ${
                  isSelected
                    ? 'bg-white text-brand-700 shadow-xs'
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
        <div className="flex items-center justify-between rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-800 animate-fade-in">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {successMsg}
          </span>
          <button type="button" onClick={() => setSuccessMsg(null)} className="font-bold underline">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-800 animate-fade-in">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600" />
            {error}
          </span>
          <button type="button" onClick={() => setError(null)} className="font-bold underline">
            Dismiss
          </button>
        </div>
      )}

      {/* ── Tab 1: RAG Chat ─────────────────────────────────────────────── */}
      {activeTab === 'chat' && (
        <div className="flex flex-col min-h-[500px] space-y-6">
          {documents.length === 0 && (
            <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-6 flex items-start justify-between gap-4">
              <div className="space-y-1 text-xs">
                <p className="font-bold text-amber-900">Knowledge Hub is currently empty</p>
                <p className="text-amber-700">
                  Switch to the <button type="button" onClick={() => setActiveTab('documents')} className="underline font-semibold">Knowledge Hub tab</button> to upload job descriptions or interview guides. Answers will then be cited directly from your docs.
                </p>
              </div>
            </div>
          )}

          {/* Chat Messages */}
          <div className="space-y-5">
            {chatMessages.map((msg) => {
              const isUser = msg.sender === 'user'
              const isSourcesExpanded = expandedSources[msg.id]

              return (
                <div key={msg.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-700 to-indigo-600 text-white shadow-xs">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-3xl p-4 sm:p-5 shadow-xs ${
                      isUser
                        ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white rounded-br-xs'
                        : 'bg-white border border-slate-200/80 text-slate-800 rounded-bl-xs'
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>
                    ) : (
                      <div className="text-sm leading-relaxed prose prose-sm max-w-none text-slate-800">
                        <MessageContent content={msg.text} />
                      </div>
                    )}

                    {/* Grounded Document Citations */}
                    {!isUser && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedSources((prev) => ({
                              ...prev,
                              [msg.id]: !prev[msg.id],
                            }))
                          }
                          className="flex items-center justify-between w-full text-[11px] font-bold text-brand-700 bg-brand-50/60 p-2 rounded-xl border border-brand-100"
                        >
                          <span className="flex items-center gap-1.5">
                            <BookOpen className="h-3.5 w-3.5" />
                            <span>Grounded in {msg.sources.length} Verified Sources</span>
                          </span>
                          {isSourcesExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>

                        {isSourcesExpanded && (
                          <div className="mt-2 space-y-2">
                            {msg.sources.map((src, idx) => (
                              <div
                                key={idx}
                                className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-[11px] space-y-1"
                              >
                                <div className="flex items-center justify-between text-slate-600 font-bold">
                                  <span>{src.document_title}</span>
                                  <span className="text-[10px] text-brand-600">
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
                      className={`mt-2 flex items-center justify-between text-[10px] ${
                        isUser ? 'text-brand-200' : 'text-slate-400'
                      }`}
                    >
                      <span>{msg.timestamp}</span>
                      {msg.modelUsed && <span>Model: {msg.modelUsed}</span>}
                    </div>
                  </div>

                  {isUser && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-700 shadow-xs">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              )
            })}

            {isSendingChat && (
              <div className="flex gap-3 items-center text-xs text-slate-500 animate-pulse">
                <RefreshCw className="h-4 w-4 animate-spin text-brand-600" />
                <span>Searching vector chunks & generating grounded response…</span>
              </div>
            )}
          </div>

          {/* Floating Composer */}
          <div className="sticky bottom-0 z-10 bg-slate-50/95 pt-2 pb-4 backdrop-blur-md">
            <form
              onSubmit={handleSendChat}
              className="rounded-3xl border border-slate-300/90 bg-white shadow-card p-2 flex items-center gap-2 focus-within:border-brand-500"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask any question grounded in your uploaded career documents..."
                className="flex-1 border-0 px-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSendingChat || !inputMessage.trim()}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:brightness-110 active:scale-98 disabled:opacity-50 transition shrink-0"
              >
                <span>Send</span>
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Tab 2: Knowledge Hub (Document Management) ──────────────────── */}
      {activeTab === 'documents' && (
        <div className="grid gap-8 lg:grid-cols-12 items-start">
          {/* Upload Document Form */}
          <div className="lg:col-span-5 rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-card space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UploadCloud className="h-4 w-4 text-brand-600" />
              <span>Ingest Document to Vector Store</span>
            </h2>

            <form onSubmit={handleIngest} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Document Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. OpenAI Senior Backend Job Spec"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Category</label>
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition"
                >
                  <option value="job_description">Job Description</option>
                  <option value="interview_guide">Interview Guide</option>
                  <option value="skill_framework">Skill Framework / Rubric</option>
                  <option value="general">General Documentation</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Text Content <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={8}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste raw text, requirements, or rubrics here. The system will chunk and embed it automatically into vector space."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition resize-none leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={isUploading || !title.trim() || !content.trim()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 px-5 py-3 text-xs font-bold text-white shadow-md shadow-brand-600/20 hover:brightness-110 active:scale-98 transition disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Chunking & Embedding…</span>
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4" />
                    <span>Ingest Document</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Document Library Table */}
          <div className="lg:col-span-7 rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Vector Knowledge Base ({documents.length})
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
              <div className="space-y-3">
                {documents.map((doc) => {
                  const badge = categoryBadge(doc.category)
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/40 p-4 hover:bg-white hover:shadow-xs transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{doc.title}</span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.bg} ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {doc.chunk_count} Vector Chunks · Ingested {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDelete(doc.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                        title="Delete document"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400 font-medium">
                No documents in knowledge base yet. Ingest your first document on the left.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 3: Vector Explorer ──────────────────────────────────────── */}
      {activeTab === 'query' && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-card space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Semantic Vector Search Tester</h2>
            <p className="text-xs text-slate-500">
              Query your MongoDB vector embeddings to inspect the most similar text chunks and relevance scores.
            </p>
          </div>

          <form onSubmit={handleVectorSearch} className="flex gap-2">
            <input
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="e.g. distributed systems requirements, behavioral leadership principles"
              className="flex-1 rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-xs text-slate-900 focus:border-brand-500 focus:bg-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={isSearching || !queryText.trim()}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition shrink-0"
            >
              {isSearching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span>Search Chunks</span>
            </button>
          </form>

          {queryResults.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Top Matching Vector Chunks ({queryResults.length})
              </h3>

              <div className="grid gap-3 sm:grid-cols-2">
                {queryResults.map((chunk, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between text-slate-700 font-bold">
                      <span className="truncate max-w-[200px]">{chunk.document_title}</span>
                      <span className="rounded-full bg-brand-50 text-brand-700 border border-brand-200 px-2 py-0.5 text-[10px]">
                        Similarity: {(chunk.similarity_score * 100).toFixed(1)}%
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
