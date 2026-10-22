import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Send,
  User,
  Bot,
  Compass,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Square,
  ArrowDown,
  Info,
} from 'lucide-react'

import { GroundedSourcesSection } from '../components/common/GroundedSourcesSection'
import { MessageContent } from '../components/chat/MessageContent'
import { describeApiError } from '../services/apiClient'
import * as chatService from '../services/chat'
import * as progressService from '../services/progress'
import type { ChatMessage } from '../types'

const MAX_MESSAGE_CHARS = 4000

const STARTER_PROMPTS = [
  'How can I become job-ready as an AI Engineer?',
  'Review my current skill gaps and suggest priorities.',
  'What key technical projects should I build next?',
  'Help me prepare for an upcoming technical interview.',
]

interface MentorContextInfo {
  hasProfile: boolean
  hasResume: boolean
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** Sanitize incremental markdown to prevent broken code fences from flicking mid-stream */
function sanitizeIncrementalMarkdown(text: string): string {
  const codeBlockCount = (text.match(/```/g) || []).length
  if (codeBlockCount % 2 !== 0) {
    return `${text}\n\`\`\``
  }
  return text
}

export function CareerMentorPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [contextInfo, setContextInfo] = useState<MentorContextInfo | null>(null)
  const [showScrollBottom, setShowScrollBottom] = useState(false)
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const pendingDeltasRef = useRef<string>('')
  const rafIdRef = useRef<number | null>(null)
  const isNearBottomRef = useRef<boolean>(true)
  const fallbackCountRef = useRef<number>(0)

  // Track window scroll to determine whether to auto-scroll or display the scroll-to-latest button
  useEffect(() => {
    function handleScroll() {
      const scrollHeight = document.documentElement.scrollHeight
      const currentScroll = window.innerHeight + window.scrollY
      const isNear = scrollHeight - currentScroll <= 150
      isNearBottomRef.current = isNear
      if (isNear) {
        setShowScrollBottom(false)
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToBottomIfNear = useCallback(() => {
    if (isNearBottomRef.current) {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
    } else {
      setShowScrollBottom(true)
    }
  }, [])

  // Restore stored conversation on mount
  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true)
    setHistoryError(null)
    try {
      const history = await chatService.fetchMentorHistory()
      setMessages(history.messages)
      setConversationId(history.conversation_id)
    } catch (err) {
      setHistoryError(describeApiError(err).message)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // Check profile/resume context
  useEffect(() => {
    let cancelled = false
    async function loadContext() {
      try {
        const dashboard = await progressService.fetchDashboard()
        if (!cancelled) {
          setContextInfo({
            hasProfile: dashboard.profile.has_profile,
            hasResume: dashboard.resume.has_analysis,
          })
        }
      } catch {
        // Leave banner hidden if unavailable
      }
    }
    loadContext()
    return () => {
      cancelled = true
    }
  }, [])

  // Batch rAF update flush
  const flushRafUpdate = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    const chunk = pendingDeltasRef.current
    if (chunk) {
      pendingDeltasRef.current = ''
      setMessages((prev) => {
        if (prev.length === 0) return prev
        const next = [...prev]
        const lastIdx = next.length - 1
        const last = next[lastIdx]
        if (last && last.role === 'assistant') {
          next[lastIdx] = {
            ...last,
            content: last.content + chunk,
          }
        }
        return next
      })
      scrollToBottomIfNear()
    }
  }, [scrollToBottomIfNear])

  const scheduleRafUpdate = useCallback(() => {
    if (rafIdRef.current !== null) return
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null
      flushRafUpdate()
    })
  }, [flushRafUpdate])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }
      abortControllerRef.current?.abort()
    }
  }, [])

  function handleStop() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    flushRafUpdate()
    setIsStreaming(false)
    setIsSending(false)
    setMessages((prev) => {
      if (prev.length === 0) return prev
      const next = [...prev]
      const lastIdx = next.length - 1
      const last = next[lastIdx]
      if (last && last.role === 'assistant') {
        const content = last.content.trim()
          ? `${last.content}\n\n*(Generation stopped)*`
          : '*(Generation stopped)*'
        next[lastIdx] = {
          ...last,
          content,
          isStreaming: false,
          isStopped: true,
        }
      }
      return next
    })
  }

  const fallbackToNonStreaming = useCallback(
    async (text: string) => {
      fallbackCountRef.current += 1
      if (fallbackCountRef.current > 1) {
        setFallbackNotice('Streaming is currently unavailable; response loaded via standard mode.')
      }
      try {
        setIsSending(true)
        const response = await chatService.sendMentorMessage(text, conversationId ?? undefined)
        if (response.conversation_id) {
          setConversationId(response.conversation_id)
        }
        setMessages((prev) => {
          const next = [...prev]
          const lastIdx = next.length - 1
          if (lastIdx >= 0 && next[lastIdx]?.role === 'assistant') {
            next[lastIdx] = {
              ...response.message,
              citations: response.citations,
              isStreaming: false,
            }
          }
          return next
        })
        scrollToBottomIfNear()
      } catch (err) {
        // Remove both optimistic user message and empty assistant bubble on failure
        setMessages((prev) => prev.slice(0, -2))
        setInput(text)
        setSendError(describeApiError(err).message)
      } finally {
        setIsSending(false)
        setIsStreaming(false)
      }
    },
    [conversationId, scrollToBottomIfNear]
  )

  async function sendMessage(rawText: string) {
    const text = rawText.trim()
    if (!text || isSending || isStreaming) return

    setSendError(null)
    const optimisticUser: ChatMessage = {
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    const optimisticAssistant: ChatMessage = {
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      isStreaming: true,
    }

    setMessages((prev) => [...prev, optimisticUser, optimisticAssistant])
    setInput('')
    setIsSending(true)
    setIsStreaming(true)
    scrollToBottomIfNear()

    const abortController = new AbortController()
    abortControllerRef.current = abortController
    let hasReceivedToken = false

    try {
      await chatService.streamMentorMessage(
        text,
        conversationId ?? undefined,
        {
          onStart: (data) => {
            if (data.conversation_id) {
              setConversationId(data.conversation_id)
            }
          },
          onDelta: (delta) => {
            hasReceivedToken = true
            pendingDeltasRef.current += delta
            scheduleRafUpdate()
          },
          onDone: (payload) => {
            flushRafUpdate()
            setIsStreaming(false)
            setIsSending(false)
            abortControllerRef.current = null
            if (payload.conversation_id) {
              setConversationId(payload.conversation_id)
            }
            setMessages((prev) => {
              const next = [...prev]
              const lastIdx = next.length - 1
              if (lastIdx >= 0 && next[lastIdx]?.role === 'assistant') {
                next[lastIdx] = {
                  ...next[lastIdx],
                  content: payload.message.content,
                  citations: payload.citations,
                  created_at: payload.message.created_at,
                  isStreaming: false,
                }
              }
              return next
            })
            scrollToBottomIfNear()
          },
          onError: (err) => {
            flushRafUpdate()
            setIsStreaming(false)
            setIsSending(false)
            abortControllerRef.current = null

            if (err.category === 'aborted') {
              return
            }

            if (!hasReceivedToken) {
              void fallbackToNonStreaming(text)
            } else {
              setSendError(err.message)
              setMessages((prev) => {
                const next = [...prev]
                const lastIdx = next.length - 1
                if (lastIdx >= 0 && next[lastIdx]?.role === 'assistant') {
                  next[lastIdx] = {
                    ...next[lastIdx],
                    isStreaming: false,
                  }
                }
                return next
              })
            }
          },
        },
        abortController.signal
      )
    } catch (err: unknown) {
      flushRafUpdate()
      setIsStreaming(false)
      setIsSending(false)
      abortControllerRef.current = null

      if (abortController.signal.aborted) {
        return
      }

      if (!hasReceivedToken) {
        void fallbackToNonStreaming(text)
      } else {
        setSendError(describeApiError(err).message)
      }
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void sendMessage(input)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendMessage(input)
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4.5rem)] w-full max-w-4xl flex-col px-4 sm:px-6 lg:px-8 py-6 relative">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">AI Career Mentor</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Ask career strategy questions, request portfolio feedback, and explore actionable learning steps.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 self-start sm:self-auto">
          <ShieldCheck className="h-3.5 w-3.5 text-slate-500" />
          <span className="font-medium text-[11px]">Context Grounded · Real-Time Stream</span>
        </div>
      </header>

      {/* ── Context Grounding Banner ─────────────────────────────────────── */}
      {contextInfo && <ContextBanner info={contextInfo} />}

      {/* ── Conversation Thread ─────────────────────────────────────────── */}
      <div className="mt-4 flex-1 space-y-4 pb-6">
        {isLoadingHistory ? (
          <ConversationSkeleton />
        ) : messages.length === 0 ? (
          <EmptyConversationState
            prompts={STARTER_PROMPTS}
            disabled={isSending || isStreaming}
            onPromptClick={(prompt) => void sendMessage(prompt)}
          />
        ) : (
          messages.map((message, index) => (
            <MessageBubble key={index} message={message} />
          ))
        )}
      </div>

      {/* ── Floating Scroll-to-Latest Button ─────────────────────────────── */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={() => {
            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
            setShowScrollBottom(false)
            isNearBottomRef.current = true
          }}
          className="fixed bottom-24 right-8 z-30 flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-slate-800 transition animate-fade-in cursor-pointer"
          aria-label="Scroll to latest messages"
        >
          <ArrowDown className="h-3.5 w-3.5" />
          <span>Scroll to latest</span>
        </button>
      )}

      {/* ── Sticky Composer Box ──────────────────────────────────────────── */}
      <div className="sticky bottom-0 z-20 bg-slate-50/95 pb-4 pt-2">
        {fallbackNotice && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 animate-fade-in">
            <div className="flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span>{fallbackNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setFallbackNotice(null)}
              className="text-[11px] font-medium text-amber-800 underline hover:text-amber-950"
            >
              Dismiss
            </button>
          </div>
        )}

        {historyError && (
          <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <span>Could not restore chat history: {historyError}</span>
            <button
              type="button"
              onClick={() => void loadHistory()}
              className="font-medium underline text-rose-900"
            >
              Retry
            </button>
          </div>
        )}

        {sendError && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{sendError}</span>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="clean-card p-0 focus-within:border-slate-400 overflow-hidden transition"
        >
          <label htmlFor="mentor-message" className="sr-only">
            Message your Career Mentor
          </label>
          <textarea
            id="mentor-message"
            rows={2}
            value={input}
            maxLength={MAX_MESSAGE_CHARS}
            disabled={isSending || isStreaming}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isStreaming
                ? 'AI Mentor is answering...'
                : 'Ask your mentor anything about your career path, resume, or skills...'
            }
            className="block w-full resize-none border-0 px-4 pt-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
          />
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-3.5 py-2 bg-slate-50/70">
            <span className="hidden sm:inline text-[11px] text-slate-400">
              Press <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">Enter</kbd> to send · <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">Shift+Enter</kbd> for new line
            </span>
            <span className="sm:hidden text-[11px] text-slate-400">
              {input.length}/{MAX_MESSAGE_CHARS}
            </span>

            {isStreaming ? (
              <button
                type="button"
                onClick={handleStop}
                aria-label="Stop generating response"
                className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold py-1.5 px-3 inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1"
              >
                <Square className="h-3 w-3 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSending || input.trim().length === 0}
                className="btn-primary text-xs py-1.5 px-3"
              >
                {isSending ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Thinking…</span>
                  </>
                ) : (
                  <>
                    <span>Send</span>
                    <Send className="h-3 w-3" />
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Context Banner ───────────────────────────────────────────────────────

function ContextBanner({ info }: { info: MentorContextInfo }) {
  if (info.hasProfile && info.hasResume) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-700">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
        <span>
          Personalized using your <strong className="font-semibold text-slate-900">Career Profile</strong> and <strong className="font-semibold text-slate-900">Resume Analysis</strong>.
        </span>
      </div>
    )
  }

  return (
    <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3.5 py-2 text-xs text-amber-900">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
        <span>
          Add {!info.hasProfile && 'your Career Profile'}
          {!info.hasProfile && !info.hasResume && ' and '}
          {!info.hasResume && 'a Resume Analysis'} for tailored recommendations.
        </span>
      </div>
      <div className="flex items-center gap-2 font-medium">
        {!info.hasProfile && (
          <Link to="/profile" className="underline hover:text-amber-950">
            Profile →
          </Link>
        )}
        {!info.hasResume && (
          <Link to="/resume" className="underline hover:text-amber-950">
            Resume →
          </Link>
        )}
      </div>
    </div>
  )
}

// ── Message Bubble ───────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  const time = formatTime(message.created_at)

  return (
    <div className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
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
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        ) : (
          <div
            aria-live="polite"
            aria-busy={message.isStreaming ? 'true' : 'false'}
          >
            {message.isStreaming && !message.content ? (
              <InlineThinkingDots />
            ) : (
              <div className="leading-relaxed prose prose-xs max-w-none text-slate-800 prose-headings:text-slate-900 prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5">
                <MessageContent content={sanitizeIncrementalMarkdown(message.content)} />
              </div>
            )}

            {message.isStopped && (
              <p className="mt-2 text-[11px] italic text-slate-400">
                Generation stopped by user
              </p>
            )}

            {message.citations && message.citations.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-slate-100">
                <GroundedSourcesSection
                  sources={message.citations}
                  title="Grounded Mentor Knowledge Sources"
                />
              </div>
            )}
          </div>
        )}

        {time && (
          <p
            className={`mt-1.5 text-[10px] ${
              isUser ? 'text-slate-400 text-right' : 'text-slate-400'
            }`}
          >
            {time}
          </p>
        )}
      </div>

      {isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-700 shadow-xs mt-0.5">
          <User className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  )
}

function InlineThinkingDots() {
  return (
    <div className="flex items-center gap-2 py-0.5" aria-hidden="true">
      <span className="flex space-x-1">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce motion-reduce:animate-none" />
        <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce motion-reduce:animate-none [animation-delay:0.2s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-slate-600 animate-bounce motion-reduce:animate-none [animation-delay:0.4s]" />
      </span>
      <span className="text-[11px] text-slate-400 font-medium">Qwen is thinking…</span>
    </div>
  )
}

function EmptyConversationState({
  prompts,
  disabled,
  onPromptClick,
}: {
  prompts: string[]
  disabled: boolean
  onPromptClick: (p: string) => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center space-y-5">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
        <Compass className="h-6 w-6" />
      </div>

      <div className="space-y-1 max-w-sm">
        <h3 className="text-base font-bold text-slate-900">Career Strategy Assistant</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Ask questions about roles, interview preparation, portfolio strategy, or skill improvements.
        </p>
      </div>

      <div className="w-full max-w-lg space-y-2 pt-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Suggested Conversation Starters
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {prompts.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              disabled={disabled}
              onClick={() => onPromptClick(prompt)}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition group disabled:opacity-50"
            >
              <span>{prompt}</span>
              <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-slate-700 shrink-0 ml-1.5" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ConversationSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-12 w-2/3 rounded-xl bg-slate-200/70" />
      <div className="h-16 w-3/4 rounded-xl bg-slate-200/70 ml-auto" />
      <div className="h-20 w-4/5 rounded-xl bg-slate-200/70" />
    </div>
  )
}
