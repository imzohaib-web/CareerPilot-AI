import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'

import { useAuth } from '../context/AuthContext'

/** Renders children only for authenticated users; redirects to /login otherwise. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isRestoringSession } = useAuth()
  const location = useLocation()

  if (isRestoringSession) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Loading session…
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return <>{children}</>
}
