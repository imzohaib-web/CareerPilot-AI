import { useState } from 'react'
import type { FormEvent } from 'react'
import {
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
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Qwen AI Diagnostic Console
        </h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Direct test console to verify Alibaba Cloud Model Studio API connectivity and Qwen LLM response latency.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="clean-card p-5 space-y-3 text-xs"
      >
        <div className="flex items-center justify-between">
          <label className="font-semibold text-slate-700">Test Prompt</label>
          <span className="text-[11px] text-slate-400 font-mono">POST /api/ai/test</span>
        </div>

        <textarea
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-300 bg-white p-3 text-xs text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition resize-none"
          placeholder="e.g. Hello Qwen! Provide a 1-sentence career advice quote for a junior engineer."
        />

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isSending || message.trim().length === 0}
            className="btn-primary text-xs py-2 px-4"
          >
            {isSending ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Contacting Qwen…</span>
              </>
            ) : (
              <>
                <span>Send Diagnostic</span>
                <Send className="h-3 w-3" />
              </>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {response !== null && (
        <div className="clean-card p-5 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900">
              <Cpu className="h-4 w-4 text-slate-700" />
              <span>Model Output</span>
            </span>
            {model && (
              <span className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-mono font-medium text-slate-700">
                {model}
              </span>
            )}
          </div>
          <p className="whitespace-pre-wrap text-xs text-slate-800 leading-relaxed font-mono bg-slate-50 p-3 rounded-lg border border-slate-200">
            {response}
          </p>
        </div>
      )}
    </div>
  )
}
