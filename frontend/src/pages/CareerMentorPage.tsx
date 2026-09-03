import { useCallback, useEffect, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'

import { MessageContent } from '../components/chat/MessageContent'
import { describeApiError } from '../services/apiClient'
import * as chatService from '../services/chat'
import * as progressService from '../services/progress'
import type { ChatMessage } from '../types'

// Keep in sync with the backend limit (backend/app/schemas/chat.py).
const MAX_MESSAGE_CHARS = 4000

const STARTER_PROMPTS = [
  'How can I improve my career profile?',
  'What should I focus on to become job-ready?',
  'How can I improve my resume?',
  'What skills should I prioritize next?',
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

// ── Main page ────────────────────────────────────────────────────────────

export function CareerMentorPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [contextInfo, setContextInfo] = useState<MentorContextInfo | null>(null)

  // Restore the stored conversation on mount.
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

  // Check whether the backend has profile/resume data to ground answers.
  // The banner is supplementary — the chat itself works either way.
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
        // Leave the banner hidden when availability is unknown.
      }
    }
    loadContext()
    return () => {
      cancelled = true
    }
  }, [])

  // Keep the newest message in view as the conversation grows.
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
        conversationId ?? undefined,
      )
      if (response.conversation_id) {
        setConversationId(response.conversation_id)
      }
      if (!response.message?.content?.trim()) {
        throw new Error('EMPTY_REPLY')
      }
      setMessages((prev) => [...prev, response.message])
    } catch (err) {
      // Roll back the optimistic message and restore the input — the failed
      // turn was never persisted server-side, so the UI must stay in sync.
      setMessages((prev) => prev.filter((m) => m !== optimisticMessage))
      setInput(text)
      setSendError(
        err instanceof Error && err.message === 'EMPTY_REPLY'
          ? 'The mentor returned an empty response. Please try again.'
          : describeApiError(err).message,
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
    <div className="mx-auto flex min-h-[calc(100dvh-4.5rem)] w-full max-w-3xl flex-col px-4 pt-8">
      {/* Heading */}
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Career Mentor</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ask career questions and get personalized, actionable guidance. Your conversation is
          saved, so you can pick up where you left off.
        </p>
      </header>

      {/* Personalization / setup banner */}
      {contextInfo && <ContextBanner info={contextInfo} />}

      {/* Conversation */}
      <div className="mt-6 flex-1 space-y-5 pb-4">
        {isLoadingHistory ? (
          <ConversationSkeleton />
        ) : messages.length === 0 ? (
          <EmptyConversation
            prompts={STARTER_PROMPTS}
            disabled={isSending}
            onPromptClick={(prompt) => void sendMessage(prompt)}
          />
        ) : (
          messages.map((message, index) => <MessageBubble key={index} message={message} />)
        )}

        {isSending && <ThinkingIndicator />}
      </div>

      {/* Composer — sticky so it stays reachable while reading history */}
      <div className="sticky bottom-0 z-10 bg-slate-50/95 pb-3 pt-2 backdrop-blur">
        {historyError && (
          <div
            role="alert"
            className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <span>Couldn&apos;t load your previous conversation. {historyError}</span>
            <button
              type="button"
              onClick={() => void loadHistory()}
              className="shrink-0 rounded-lg bg-red-100 px-3 py-1.5 font-medium text-red-700 hover:bg-red-200"
            >
              Try again
            </button>
          </div>
        )}

        {sendError && (
          <div role="alert" className="mb-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {sendError}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-300 bg-white shadow-sm focus-within:border-violet-500"
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
            placeholder="Ask a career question…"
            className="block w-full resize-none rounded-t-2xl border-0 px-4 pt-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div className="flex items-center justify-between gap-3 rounded-b-2xl border-t border-slate-100 px-3 py-2">
            <span className="hidden text-[11px] text-slate-400 sm:inline">
              Enter to send · Shift+Enter for a new line
            </span>
            <span className="text-[11px] text-slate-400 sm:hidden" aria-live="polite">
              {input.length}/{MAX_MESSAGE_CHARS}
            </span>
            <button
              type="submit"
              disabled={isSending || input.trim().length === 0}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Personalization banner ──────────────────────────────────────────────

function ContextBanner({ info }: { info: MentorContextInfo }) {
  if (info.hasProfile && info.hasResume) {
    return (
      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
        <SparkIcon className="mt-0.5 text-violet-500" />
        <p className="text-sm text-violet-700">
          Career Mentor uses your <span className="font-medium">career profile</span> and{' '}
          <span className="font-medium">resume analysis</span> to personalize its guidance.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <p>
        Add{' '}
        {!info.hasProfile && 'your career profile'}
        {!info.hasProfile && !info.hasResume && ' and '}
        {!info.hasResume && 'a resume analysis'}
        {" so the mentor can personalize its guidance."}
      </p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-medium">
        {!info.hasProfile && (
          <Link
            to="/profile"
            className="underline decoration-amber-400 underline-offset-2 hover:text-amber-900"
          >
            Create your profile
          </Link>
        )}
        {!info.hasResume && (
          <Link
            to="/resume"
            className="underline decoration-amber-400 underline-offset-2 hover:text-amber-900"
          >
            Analyze your resume
          </Link>
        )}
      </div>
    </div>
  )
}

// ── Conversation pieces ──────────────────────────────────────────────────

function SparkIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className={`h-4 w-4 shrink-0 ${className}`}
    >
      <path d="M10 1.5l2.1 5.2 5.6.5-4.2 3.7 1.3 5.5L10 13.4l-4.8 3 1.3-5.5L2.3 7.2l5.6-.5L10 1.5z" />
    </svg>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const time = formatTime(message.created_at)

  if (message.role === 'user') {
    return (
      <div className="flex flex-col items-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-violet-600 px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm sm:max-w-[75%]">
          {message.content}
        </div>
        {time && <span className="mt-1 pr-1 text-[11px] text-slate-400">{time}</span>}
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      <div
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600"
      >
        <SparkIcon />
      </div>
      <div className="min-w-0 max-w-[85%] sm:max-w-[75%]">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-slate-900">CareerPilot</span>
          {time && <span className="text-[11px] text-slate-400">{time}</span>}
        </div>
        <div className="mt-1 rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <MessageContent content={message.content} />
        </div>
      </div>
    </div>
  )
}

function ThinkingIndicator() {
  return (
    <div className="flex gap-3">
      <div
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600"
      >
        <SparkIcon />
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-slate-900">CareerPilot</span>
        </div>
        <div
          role="status"
          className="mt-1 flex items-center gap-2.5 rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 shadow-sm"
        >
          <span className="flex gap-1" aria-hidden="true">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400" />
          </span>
          <span className="text-sm text-slate-500">Thinking…</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          Generating personalized guidance — this can take a few seconds.
        </p>
      </div>
    </div>
  )
}

function EmptyConversation({
  prompts,
  disabled,
  onPromptClick,
}: {
  prompts: string[]
  disabled: boolean
  onPromptClick: (prompt: string) => void
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Start a conversation
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Ask anything about your career — goals, skills, resumes, interviews — or start with one of
        these:
      </p>
      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={disabled}
            onClick={() => onPromptClick(prompt)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  )
}

function ConversationSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="flex justify-end">
        <div className="h-10 w-40 animate-pulse rounded-2xl bg-slate-200" />
      </div>
      <div className="flex gap-3">
        <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-slate-200" />
        <div className="w-3/4 space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
          <div className="h-24 animate-pulse rounded-2xl bg-slate-200" />
        </div>
      </div>
    </div>
  )
}
