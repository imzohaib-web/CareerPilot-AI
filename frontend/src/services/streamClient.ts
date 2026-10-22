import { clearToken, getToken } from './apiClient'

export interface StreamError {
  category:
    | 'network'
    | 'validation'
    | 'authentication'
    | 'rate-limit'
    | 'ai-provider'
    | 'server'
    | 'streaming-disabled'
    | 'aborted'
    | 'timeout'
  message: string
  code?: string
  status?: number
  retryAfter?: number
}

export interface StreamHandlers<TDone = unknown> {
  onStart?: (data: { conversation_id?: string; [key: string]: unknown }) => void
  onSources?: (data: { sources: unknown[]; retrieval_status?: string; [key: string]: unknown }) => void
  onDelta?: (delta: string) => void
  onDone?: (payload: TDone) => void
  onError?: (error: StreamError) => void
}

export interface StreamPostOptions<TDone = unknown> {
  path: string
  body: unknown
  handlers: StreamHandlers<TDone>
  signal?: AbortSignal
  /** Timeout in ms to receive first token/delta before triggering buffering fallback (default 10000) */
  firstTokenTimeoutMs?: number
}

/**
 * Perform a typed streaming POST request reading text/event-stream SSE frames.
 *
 * Robustly parses split chunks, multi-byte UTF-8 boundaries, comment heartbeats (: ping),
 * handles 401/429/501/502 HTTP errors, respects AbortSignal, and detects proxy buffering timeouts.
 */
export async function streamPost<TDone = unknown>(
  pathOrOptions: string | StreamPostOptions<TDone>,
  bodyArg?: unknown,
  handlersArg?: StreamHandlers<TDone>,
  signalArg?: AbortSignal,
): Promise<void> {
  let path: string
  let body: unknown
  let handlers: StreamHandlers<TDone>
  let signal: AbortSignal | undefined
  let firstTokenTimeoutMs = 10000

  if (typeof pathOrOptions === 'string') {
    path = pathOrOptions
    body = bodyArg
    handlers = handlersArg ?? {}
    signal = signalArg
  } else {
    path = pathOrOptions.path
    body = pathOrOptions.body
    handlers = pathOrOptions.handlers
    signal = pathOrOptions.signal
    if (pathOrOptions.firstTokenTimeoutMs !== undefined) {
      firstTokenTimeoutMs = pathOrOptions.firstTokenTimeoutMs
    }
  }

  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
  const url = `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  }

  const token = getToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    })
  } catch (err: unknown) {
    if (signal?.aborted) {
      const abortErr: StreamError = {
        category: 'aborted',
        message: 'Request was cancelled',
      }
      handlers.onError?.(abortErr)
      throw abortErr
    }
    const netErr: StreamError = {
      category: 'network',
      message: 'Cannot reach the server. Check your connection or backend status.',
    }
    handlers.onError?.(netErr)
    throw netErr
  }

  if (!response.ok) {
    const status = response.status
    let errorDetail = ''
    try {
      const errorJson = await response.json()
      if (typeof errorJson?.detail === 'string') {
        errorDetail = errorJson.detail
      } else if (Array.isArray(errorJson?.detail) && errorJson.detail[0]?.msg) {
        errorDetail = errorJson.detail[0].msg
      }
    } catch {
      // not JSON
    }

    if (status === 401) {
      clearToken()
      const err: StreamError = {
        category: 'authentication',
        message: errorDetail || 'Authentication failed. Please sign in again.',
        status: 401,
      }
      handlers.onError?.(err)
      throw err
    }

    if (status === 429) {
      const rawRetry = response.headers.get('retry-after')
      let retryAfterSec: number | undefined
      if (rawRetry) {
        const parsed = parseInt(rawRetry, 10)
        if (!isNaN(parsed) && parsed > 0) {
          retryAfterSec = parsed
        }
      }
      let msg = errorDetail || 'Rate limit reached. Please wait before retrying.'
      if (retryAfterSec && !msg.includes(`${retryAfterSec}s`)) {
        msg = `${msg.replace(/\.$/, '')}. Please retry in ${retryAfterSec}s.`
      }
      const err: StreamError = {
        category: 'rate-limit',
        message: msg,
        status: 429,
        retryAfter: retryAfterSec,
      }
      handlers.onError?.(err)
      throw err
    }

    if (status === 501 || status === 404) {
      const err: StreamError = {
        category: 'streaming-disabled',
        message: errorDetail || 'Streaming is currently disabled on the server.',
        status,
      }
      handlers.onError?.(err)
      throw err
    }

    const err: StreamError = {
      category: status === 502 ? 'ai-provider' : 'server',
      message: errorDetail || `Server returned error (${status})`,
      status,
    }
    handlers.onError?.(err)
    throw err
  }

  if (!response.body) {
    const err: StreamError = {
      category: 'network',
      message: 'Response body is empty',
    }
    handlers.onError?.(err)
    throw err
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let receivedFirstDelta = false
  let isDone = false

  // First token delivery timeout watchdog (proxy buffering detection)
  let watchdogTimer: ReturnType<typeof setTimeout> | null = null
  if (firstTokenTimeoutMs > 0) {
    watchdogTimer = setTimeout(() => {
      if (!receivedFirstDelta && !isDone) {
        try {
          reader.cancel()
        } catch {
          // ignore
        }
        const timeoutErr: StreamError = {
          category: 'timeout',
          message: 'No incremental tokens received within 10s (possible proxy buffering)',
        }
        handlers.onError?.(timeoutErr)
      }
    }, firstTokenTimeoutMs)
  }

  function cleanupWatchdog() {
    if (watchdogTimer) {
      clearTimeout(watchdogTimer)
      watchdogTimer = null
    }
  }

  const onAbort = () => {
    try {
      void reader.cancel()
    } catch {
      // ignore
    }
  }
  signal?.addEventListener('abort', onAbort, { once: true })

  try {
    while (true) {
      if (signal?.aborted) {
        break
      }

      const { done, value } = await reader.read()
      if (done || signal?.aborted) {
        break
      }

      // decode chunk stream-aware (handles multi-byte boundaries across chunks)
      buffer += decoder.decode(value, { stream: true })

      let boundaryIndex: number
      while ((boundaryIndex = buffer.indexOf('\n\n')) !== -1) {
        const rawFrame = buffer.slice(0, boundaryIndex)
        buffer = buffer.slice(boundaryIndex + 2)
        processFrame(rawFrame)
      }
    }

    if (signal?.aborted) {
      const abortErr: StreamError = {
        category: 'aborted',
        message: 'Stream stopped by user',
      }
      handlers.onError?.(abortErr)
      return
    }

    // Flush any remaining trailing frames
    buffer += decoder.decode()
    if (buffer.trim()) {
      processFrame(buffer)
    }
  } catch (err: unknown) {
    cleanupWatchdog()
    if (signal?.aborted) {
      const abortErr: StreamError = {
        category: 'aborted',
        message: 'Stream stopped by user',
      }
      handlers.onError?.(abortErr)
      return
    }
    const streamErr: StreamError = {
      category: 'network',
      message: err instanceof Error ? err.message : 'Stream connection error',
    }
    handlers.onError?.(streamErr)
    throw streamErr
  } finally {
    signal?.removeEventListener('abort', onAbort)
    cleanupWatchdog()
  }

  function processFrame(frame: string) {
    const lines = frame.split(/\r?\n/)
    for (const rawLine of lines) {
      const line = rawLine.trim()
      // Ignore comment lines (e.g. ": ping") and empty lines
      if (!line || line.startsWith(':')) {
        continue
      }

      if (line.startsWith('data:')) {
        const dataStr = line.slice(5).trim()
        if (!dataStr) continue

        try {
          const payload = JSON.parse(dataStr) as Record<string, unknown>
          const type = payload?.type

          if (type === 'start') {
            handlers.onStart?.(payload)
          } else if (type === 'sources') {
            handlers.onSources?.(
              payload as { sources: unknown[]; retrieval_status?: string }
            )
          } else if (type === 'delta') {
            receivedFirstDelta = true
            cleanupWatchdog()
            if (typeof payload.text === 'string') {
              handlers.onDelta?.(payload.text)
            }
          } else if (type === 'done') {
            isDone = true
            cleanupWatchdog()
            handlers.onDone?.(payload as unknown as TDone)
          } else if (type === 'error') {
            cleanupWatchdog()
            const err: StreamError = {
              category: payload.code === 'AI_NOT_CONFIGURED' ? 'server' : 'ai-provider',
              message: (payload.message as string) || 'Stream error',
              code: payload.code as string,
            }
            handlers.onError?.(err)
          }
        } catch (jsonErr) {
          console.warn('Failed to parse SSE JSON payload:', dataStr, jsonErr)
        }
      }
    }
  }
}
