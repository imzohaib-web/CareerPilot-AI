import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import axios from 'axios'

import { clearToken, getToken, setToken } from '../services/apiClient'
import * as authService from '../services/auth'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isRestoringSession: boolean
  isWakingUp: boolean
  sessionRestoreError: string | null
  retryRestore: () => void
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isRestoringSession, setIsRestoringSession] = useState<boolean>(() => Boolean(getToken()))
  const [isWakingUp, setIsWakingUp] = useState<boolean>(false)
  const [sessionRestoreError, setSessionRestoreError] = useState<string | null>(null)
  const [restoreTrigger, setRestoreTrigger] = useState<number>(0)

  const retryRestore = useCallback(() => {
    setSessionRestoreError(null)
    setIsWakingUp(false)
    setIsRestoringSession(true)
    setRestoreTrigger((n) => n + 1)
  }, [])

  // Restore the session from a stored token on first load.
  useEffect(() => {
    const token = getToken()
    if (!token) {
      setIsRestoringSession(false)
      setIsWakingUp(false)
      setSessionRestoreError(null)
      setUser(null)
      return
    }

    let cancelled = false
    const abortController = new AbortController()
    setIsRestoringSession(true)
    setSessionRestoreError(null)
    setIsWakingUp(false)

    // If session restore takes >4 seconds, show friendly wake-up message under spinner
    const wakeTimer = setTimeout(() => {
      if (!cancelled) {
        setIsWakingUp(true)
      }
    }, 4000)

    async function restore() {
      const maxRetries = 3
      let attempt = 0

      while (!cancelled) {
        try {
          // 70-second per-attempt timeout specifically for session restore check
          const me = await authService.fetchMe({
            timeout: 70000,
            signal: abortController.signal,
          })
          if (!cancelled) {
            clearTimeout(wakeTimer)
            setIsWakingUp(false)
            setUser(me)
            setSessionRestoreError(null)
            setIsRestoringSession(false)
          }
          return
        } catch (err: unknown) {
          if (cancelled) return

          // Avoid retries for requests explicitly aborted by navigation or component cleanup
          if (
            axios.isCancel(err) ||
            (err instanceof Error && err.name === 'CanceledError')
          ) {
            return
          }

          // HTTP 401 must log the user out immediately without retry
          if (axios.isAxiosError(err) && err.response?.status === 401) {
            clearTimeout(wakeTimer)
            clearToken()
            setUser(null)
            setIsWakingUp(false)
            setSessionRestoreError(null)
            setIsRestoringSession(false)
            return
          }

          // Other HTTP responses are not retried per retry policy
          if (axios.isAxiosError(err) && err.response) {
            clearTimeout(wakeTimer)
            setIsWakingUp(false)
            setIsRestoringSession(false)
            setSessionRestoreError(
              'Unable to restore session due to a server error. Please try again.'
            )
            return
          }

          // Retries only for network errors and request timeouts (up to 3 retries after initial attempt)
          if (attempt < maxRetries) {
            attempt++
            // Exponential backoff with small random jitter
            const backoffMs = Math.min(
              1000 * Math.pow(2, attempt - 1) + Math.random() * 200,
              5000
            )
            await new Promise((resolve) => setTimeout(resolve, backoffMs))
          } else {
            clearTimeout(wakeTimer)
            setIsWakingUp(false)
            setIsRestoringSession(false)
            setSessionRestoreError(
              'Unable to reach the server to restore your session. Please check your connection or try again.'
            )
            return
          }
        }
      }
    }

    void restore()

    return () => {
      cancelled = true
      abortController.abort()
      clearTimeout(wakeTimer)
    }
  }, [restoreTrigger])

  const login = useCallback(async (email: string, password: string) => {
    const result = await authService.login(email, password)
    setToken(result.access_token)
    setUser(result.user)
    setSessionRestoreError(null)
    setIsRestoringSession(false)
  }, [])

  const register = useCallback(async (name: string, email: string, password: string) => {
    const created = await authService.register(name, email, password)
    // Register then sign the user straight in.
    const result = await authService.login(email, password)
    setToken(result.access_token)
    setUser(result.user ?? created)
    setSessionRestoreError(null)
    setIsRestoringSession(false)
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
    setSessionRestoreError(null)
    setIsRestoringSession(false)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isRestoringSession,
        isWakingUp,
        sessionRestoreError,
        retryRestore,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === null) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
