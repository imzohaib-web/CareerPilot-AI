import { useCallback, useEffect, useState } from 'react'
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
    <div className="mx-auto flex min-h-[calc(100dvh-4.5rem)] w-full max-w-4xl flex-col px-4 sm:px-6 lg:px-8 py-6">
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
          <span className="font-medium text-[11px]">Context Grounded</span>
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
      <div className="sticky bottom-0 z-20 bg-slate-50/95 pb-4 pt-2">
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
            disabled={isSending}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your mentor anything about your career path, resume, or skills..."
            className="block w-full resize-none border-0 px-4 pt-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
          />
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-3.5 py-2 bg-slate-50/70">
            <span className="hidden sm:inline text-[11px] text-slate-400">
              Press <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">Enter</kbd> to send · <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">Shift+Enter</kbd> for new line
            </span>
            <span className="sm:hidden text-[11px] text-slate-400">
              {input.length}/{MAX_MESSAGE_CHARS}
            </span>

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
          <div className="leading-relaxed prose prose-xs max-w-none text-slate-800 prose-headings:text-slate-900 prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5">
            <MessageContent content={message.content} />
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

// ── Thinking / Skeleton States ───────────────────────────────────────────

function ThinkingIndicator() {
  return (
    <div className="flex gap-2.5 items-start animate-fade-in">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white shadow-xs">
        <Bot className="h-3.5 w-3.5" />
      </div>
      <div className="rounded-xl rounded-bl-xs border border-slate-200 bg-white p-3 shadow-xs flex items-center gap-2">
        <span className="flex space-x-1">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:0.2s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-600 animate-bounce [animation-delay:0.4s]" />
        </span>
        <span className="text-[11px] text-slate-500 font-medium">Qwen is thinking…</span>
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
