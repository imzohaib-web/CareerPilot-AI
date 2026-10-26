import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'

import { useAuth } from '../context/AuthContext'

/** Renders children only for authenticated users; redirects to /login otherwise. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const {
    isAuthenticated,
    isRestoringSession,
    isWakingUp,
    sessionRestoreError,
    retryRestore,
  } = useAuth()
  const location = useLocation()

  if (sessionRestoreError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 text-center">
        <div className="w-full max-w-sm rounded-xl border border-rose-200 bg-white p-6 shadow-sm">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Session Restore Failed</h3>
          <p className="text-xs text-slate-500 mb-4">{sessionRestoreError}</p>
          <button
            type="button"
            onClick={retryRestore}
            className="inline-flex w-full items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-brand-700 transition cursor-pointer"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (isRestoringSession) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 text-slate-500 p-4 text-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
        <span className="text-sm font-medium text-slate-700">Loading session…</span>
        {isWakingUp && (
          <p
            role="status"
            aria-live="polite"
            className="text-xs text-slate-500 max-w-xs animate-fade-in"
          >
            Waking up the demo server. This can take up to a minute.
          </p>
        )}
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return <>{children}</>
}
