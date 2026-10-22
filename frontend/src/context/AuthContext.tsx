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
          // 70-second timeout specifically for session restore check
          const me = await authService.fetchMe({ timeout: 70000 })
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

          // 401 must still log the user out as today (no retry)
          if (axios.isAxiosError(err) && err.response?.status === 401) {
            clearTimeout(wakeTimer)
            clearToken()
            setUser(null)
            setIsWakingUp(false)
            setSessionRestoreError(null)
            setIsRestoringSession(false)
            return
          }

          // Retry up to 3 times with exponential backoff on network errors or timeouts
          if (attempt < maxRetries) {
            attempt++
            const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
            await new Promise((resolve) => setTimeout(resolve, backoffMs))
          } else {
            clearTimeout(wakeTimer)
            setIsWakingUp(false)
            setSessionRestoreError(
              'Unable to reach the server to restore your session. Please check your connection or try again.'
            )
            return
          }
        }
      }
    }

    restore()

    return () => {
      cancelled = true
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
