import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  Terminal,
  Send,
  RefreshCw,
  AlertCircle,
  Cpu,
} from 'lucide-react'

import { describeApiError } from '../services/apiClient'
import * as aiService from '../services/ai'

export function AiTestPage() {
  const [message, setMessage] = useState('')
  const [response, setResponse] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setResponse(null)
    setModel(null)
    setIsSending(true)
    try {
      const result = await aiService.testAi(message)
      setResponse(result.message)
      setModel(result.model)
    } catch (err) {
      setError(describeApiError(err).message)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 border border-slate-200 mb-2">
          <Terminal className="h-3.5 w-3.5 text-slate-600" />
          <span>Alibaba Cloud Connectivity Console</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Qwen AI Diagnostic Test
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Direct test console to verify that the Alibaba Cloud Model Studio API key, FastAPI proxy layer, and Qwen LLM are responding with low latency.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-card space-y-4 text-xs"
      >
        <div className="flex items-center justify-between">
          <label className="font-bold text-slate-700">Test Prompt</label>
          <span className="text-[11px] text-slate-400">Endpoint: /api/ai/test</span>
        </div>

        <textarea
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs text-slate-900 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition resize-none"
          placeholder="e.g. Hello Qwen! Provide a 1-sentence career advice quote for a junior engineer."
        />

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSending || message.trim().length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 active:scale-98 transition disabled:opacity-50"
          >
            {isSending ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Contacting Qwen…</span>
              </>
            ) : (
              <>
                <span>Send Diagnostic</span>
                <Send className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-800">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {response !== null && (
        <div className="rounded-3xl border border-brand-200 bg-brand-50/40 p-6 shadow-card space-y-3 animate-fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-brand-100">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-800">
              <Cpu className="h-4 w-4 text-brand-600" />
              <span>Qwen Model Response</span>
            </span>
            {model && (
              <span className="rounded-full bg-white border border-brand-200 px-2.5 py-0.5 text-[10px] font-mono font-bold text-brand-700">
                {model}
              </span>
            )}
          </div>
          <p className="whitespace-pre-wrap text-xs text-slate-800 leading-relaxed font-mono bg-white p-4 rounded-2xl border border-brand-100">
            {response}
          </p>
        </div>
      )}
    </div>
  )
}
