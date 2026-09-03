import { useCallback, useEffect, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles,
  Send,
  User,
  Bot,
  Compass,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'

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

export function CareerMentorPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [contextInfo, setContextInfo] = useState<MentorContextInfo | null>(null)

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

  // Auto-scroll on new message
  useEffect(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
  }, [messages, isSending])

  async function sendMessage(rawText: string) {
    const text = rawText.trim()
    if (!text || isSending) return

    setSendError(null)
    const optimisticMessage: ChatMessage = {
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticMessage])
    setInput('')
    setIsSending(true)

    try {
      const response = await chatService.sendMentorMessage(
        text,
        conversationId ?? undefined
      )
      if (response.conversation_id) {
        setConversationId(response.conversation_id)
      }
      if (!response.message?.content?.trim()) {
        throw new Error('EMPTY_REPLY')
      }
      setMessages((prev) => [...prev, response.message])
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m !== optimisticMessage))
      setInput(text)
      setSendError(
        err instanceof Error && err.message === 'EMPTY_REPLY'
          ? 'The mentor returned an empty response. Please try again.'
          : describeApiError(err).message
      )
    } finally {
      setIsSending(false)
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
    <div className="mx-auto flex min-h-[calc(100dvh-4.5rem)] w-full max-w-4xl flex-col px-4 sm:px-6 lg:px-8 pt-8 pb-4">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 border border-brand-200/60 mb-1.5">
            <Sparkles className="h-3.5 w-3.5 text-brand-600" />
            <span>Alibaba Cloud Qwen-Max Powered</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">AI Career Mentor</h1>
          <p className="text-xs text-slate-500">
            Ask career strategy questions, request portfolio feedback, and explore actionable learning steps.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 self-start sm:self-auto">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span className="font-semibold">Context Grounded</span>
        </div>
      </header>

      {/* ── Context Grounding Banner ─────────────────────────────────────── */}
      {contextInfo && <ContextBanner info={contextInfo} />}

      {/* ── Conversation Thread ─────────────────────────────────────────── */}
      <div className="mt-6 flex-1 space-y-6 pb-6">
        {isLoadingHistory ? (
          <ConversationSkeleton />
        ) : messages.length === 0 ? (
          <EmptyConversationState
            prompts={STARTER_PROMPTS}
            disabled={isSending}
            onPromptClick={(prompt) => void sendMessage(prompt)}
          />
        ) : (
          messages.map((message, index) => (
            <MessageBubble key={index} message={message} />
          ))
        )}

        {isSending && <ThinkingIndicator />}
      </div>

      {/* ── Sticky Composer Box ──────────────────────────────────────────── */}
      <div className="sticky bottom-0 z-20 bg-slate-50/95 pb-4 pt-2 backdrop-blur-md">
        {historyError && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
            <span>Could not restore your chat history. {historyError}</span>
            <button
              type="button"
              onClick={() => void loadHistory()}
              className="font-bold underline text-rose-900"
            >
              Retry
            </button>
          </div>
        )}

        {sendError && (
          <div className="mb-3 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{sendError}</span>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-slate-300/90 bg-white shadow-card focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all"
        >
          <label htmlFor="mentor-message" className="sr-only">
            Message your Career Mentor
          </label>
          <textarea
            id="mentor-message"
            rows={2}
            value={input}
            maxLength={MAX_MESSAGE_CHARS}
            disabled={isSending}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your mentor anything about your career path, resume, or skills..."
            className="block w-full resize-none rounded-t-3xl border-0 px-5 pt-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
          />
          <div className="flex items-center justify-between gap-3 rounded-b-3xl border-t border-slate-100 px-4 py-2.5 bg-slate-50/50">
            <span className="hidden sm:inline text-[11px] text-slate-400">
              Press <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">Enter</kbd> to send · <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">Shift+Enter</kbd> for new line
            </span>
            <span className="sm:hidden text-[11px] text-slate-400">
              {input.length}/{MAX_MESSAGE_CHARS}
            </span>

            <button
              type="submit"
              disabled={isSending || input.trim().length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:brightness-110 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isSending ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Thinking…</span>
                </>
              ) : (
                <>
                  <span>Send</span>
                  <Send className="h-3.5 w-3.5" />
                </>
              )}
            </button>
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
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50/70 px-4 py-3 text-xs text-brand-900">
        <Sparkles className="h-4 w-4 text-brand-600 shrink-0" />
        <span>
          Grounded with your <strong className="font-semibold">Career Profile</strong> and <strong className="font-semibold">Resume Analysis</strong> for hyper-personalized advice.
        </span>
      </div>
    )
  }

  return (
    <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-900">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
        <span>
          Add {!info.hasProfile && 'your Career Profile'}
          {!info.hasProfile && !info.hasResume && ' and '}
          {!info.hasResume && 'a Resume Analysis'} for tailored recommendations.
        </span>
      </div>
      <div className="flex items-center gap-3 font-semibold">
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
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
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
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        ) : (
          <div className="text-sm leading-relaxed prose prose-sm max-w-none text-slate-800 prose-headings:text-slate-900 prose-p:my-2 prose-ul:my-2 prose-li:my-0.5">
            <MessageContent content={message.content} />
          </div>
        )}

        {time && (
          <p
            className={`mt-2 text-[10px] ${
              isUser ? 'text-brand-200 text-right' : 'text-slate-400'
            }`}
          >
            {time}
          </p>
        )}
      </div>

      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-700 shadow-xs">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  )
}

// ── Thinking / Skeleton States ───────────────────────────────────────────

function ThinkingIndicator() {
  return (
    <div className="flex gap-3 items-start animate-fade-in">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-xs">
        <Bot className="h-4 w-4" />
      </div>
      <div className="rounded-3xl rounded-bl-xs border border-slate-200/80 bg-white p-4 shadow-xs flex items-center gap-2">
        <span className="flex space-x-1">
          <span className="h-2 w-2 rounded-full bg-brand-400 animate-bounce" />
          <span className="h-2 w-2 rounded-full bg-brand-500 animate-bounce [animation-delay:0.2s]" />
          <span className="h-2 w-2 rounded-full bg-brand-600 animate-bounce [animation-delay:0.4s]" />
        </span>
        <span className="text-xs text-slate-500 font-medium">Qwen is thinking…</span>
      </div>
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
    <div className="flex flex-col items-center justify-center py-10 text-center space-y-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-500/20">
        <Compass className="h-8 w-8" />
      </div>

      <div className="space-y-1 max-w-md">
        <h3 className="text-lg font-bold text-slate-900">Your AI Career Mentor is Ready</h3>
        <p className="text-xs text-slate-500">
          Get real-time insights tailored to your target roles, resume improvements, and career goals.
        </p>
      </div>

      <div className="w-full max-w-lg space-y-2 pt-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
          Suggested Topics
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {prompts.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              disabled={disabled}
              onClick={() => onPromptClick(prompt)}
              className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 text-left text-xs font-semibold text-slate-700 shadow-xs hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-900 transition group disabled:opacity-50"
            >
              <span>{prompt}</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-brand-600 shrink-0 ml-2" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ConversationSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-16 w-2/3 rounded-3xl bg-slate-200/70" />
      <div className="h-20 w-3/4 rounded-3xl bg-slate-200/70 ml-auto" />
      <div className="h-28 w-4/5 rounded-3xl bg-slate-200/70" />
    </div>
  )
}
