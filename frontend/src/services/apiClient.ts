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
  message: string
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
    if (status === 401) {
      return { category: 'authentication', message: detail ?? 'Authentication failed.' }
    }
    if (status === 409) {
      return { category: 'validation', message: detail ?? 'Conflict with existing data.' }
    }
    if (status === 422) {
      return { category: 'validation', message: detail ?? 'Please check the form input.' }
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
