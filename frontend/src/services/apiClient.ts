import axios, { AxiosError } from 'axios'

const TOKEN_STORAGE_KEY = 'careerpilot_token'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
})

// Attach the JWT to every request from a single place.
apiClient.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}

/** Map any axios error to a user-friendly message and category. */
export function describeApiError(error: unknown): {
  category:
    | 'network'
    | 'validation'
    | 'authentication'
    | 'ai-provider'
    | 'server'
    | 'rate-limit'
  message: string
  retryAfter?: number
} {
  if (error instanceof AxiosError) {
    if (!error.response) {
      return {
        category: 'network',
        message: 'Cannot reach the server. Check that the backend is running.',
      }
    }
    const status = error.response.status
    const detail = extractDetail(error.response.data)

    if (status === 429) {
      const headers = error.response.headers
      const rawRetry =
        headers?.['retry-after'] ||
        (typeof headers?.get === 'function' ? headers.get('retry-after') : undefined)
      let retryAfterSec: number | undefined
      if (rawRetry) {
        const parsed = parseInt(String(rawRetry), 10)
        if (!isNaN(parsed) && parsed > 0) {
          retryAfterSec = parsed
        }
      }

      const resetAt = (error.response.data as { reset_at?: string })?.reset_at
      let timeNotice = ''
      if (retryAfterSec) {
        if (retryAfterSec < 60) {
          timeNotice = ` Please wait ${retryAfterSec}s before retrying.`
        } else {
          const minutes = Math.ceil(retryAfterSec / 60)
          timeNotice = ` Please wait ${minutes} minute${minutes > 1 ? 's' : ''} before retrying.`
        }
      } else if (resetAt) {
        try {
          const resetDate = new Date(resetAt)
          timeNotice = ` Limit resets at ${resetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
        } catch {
          // ignore date parse issues
        }
      }

      const baseMessage = detail ?? 'Too many requests. Rate limit reached.'
      return {
        category: 'rate-limit',
        message: `${baseMessage}${timeNotice}`,
        retryAfter: retryAfterSec,
      }
    }

    if (status === 401) {
      return { category: 'authentication', message: detail ?? 'Authentication failed.' }
    }
    if (status === 409) {
      return { category: 'validation', message: detail ?? 'Conflict with existing data.' }
    }
    if (status === 400) {
      return { category: 'validation', message: detail ?? 'Invalid request. Please check your input.' }
    }
    if (status === 413) {
      return { category: 'validation', message: detail ?? 'File is too large.' }
    }
    if (status === 422) {
      return { category: 'validation', message: detail ?? 'Please check the form input.' }
    }
    if (status === 503) {
      return {
        category: 'server',
        message: detail ?? 'The AI service is not configured on the server.',
      }
    }
    if (status === 502) {
      return { category: 'ai-provider', message: detail ?? 'The AI service is unavailable.' }
    }
    return { category: 'server', message: detail ?? 'Something went wrong on the server.' }
  }
  return { category: 'network', message: 'An unexpected error occurred.' }
}

function extractDetail(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const detail = (data as { detail?: unknown }).detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: string } | undefined
    if (first?.msg) return first.msg.replace(/^Value error,\s*/i, '')
  }
  return null
}
