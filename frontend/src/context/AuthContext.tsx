import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { clearToken, getToken, setToken } from '../services/apiClient'
import * as authService from '../services/auth'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isRestoringSession: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isRestoringSession, setIsRestoringSession] = useState<boolean>(() => Boolean(getToken()))

  // Restore the session from a stored token on first load.
  useEffect(() => {
    let cancelled = false
    async function restore() {
      try {
        const me = await authService.fetchMe()
        if (!cancelled) setUser(me)
      } catch {
        if (!cancelled) {
          clearToken()
          setUser(null)
        }
      } finally {
        if (!cancelled) setIsRestoringSession(false)
      }
    }
    if (getToken()) {
      restore()
    }
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const result = await authService.login(email, password)
    setToken(result.access_token)
    setUser(result.user)
  }, [])

  const register = useCallback(async (name: string, email: string, password: string) => {
    const created = await authService.register(name, email, password)
    // Register then sign the user straight in.
    const result = await authService.login(email, password)
    setToken(result.access_token)
    setUser(result.user ?? created)
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isRestoringSession,
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
