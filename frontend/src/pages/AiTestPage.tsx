import { useState } from 'react'
import type { FormEvent } from 'react'

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
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Qwen Connectivity Test</h1>
      <p className="mt-1 text-sm text-slate-500">
        Day 1 verification only — proves the Alibaba Cloud Qwen connection works. This is not the
        final Career Mentor.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <label className="block text-sm font-medium text-slate-700">
          Message
          <textarea
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-violet-500 focus:outline-none"
            placeholder="Hello CareerPilot"
          />
        </label>

        <button
          type="submit"
          disabled={isSending || message.trim().length === 0}
          className="mt-4 w-full rounded-lg bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {isSending ? 'Waiting for Qwen…' : 'Send'}
        </button>
      </form>

      {isSending && <p className="mt-6 text-slate-500">Contacting Qwen via the backend…</p>}

      {error && (
        <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {response !== null && (
        <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
            Qwen response{model ? ` · ${model}` : ''}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-slate-800">{response}</p>
        </div>
      )}
    </div>
  )
}
