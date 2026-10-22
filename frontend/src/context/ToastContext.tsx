import React, { createContext, useCallback, useContext, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react'
import { describeApiError } from '../services/apiClient'

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger'

export interface ToastItem {
  id: string
  variant: ToastVariant
  title?: string
  message: string
  duration?: number
}

interface ToastContextValue {
  toasts: ToastItem[]
  showToast: (options: Omit<ToastItem, 'id'>) => string
  showApiError: (error: unknown, fallbackMessage?: string) => string
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    ({ variant = 'info', title, message, duration = 5000 }: Omit<ToastItem, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const newItem: ToastItem = { id, variant, title, message, duration }

      setToasts((prev) => [...prev, newItem])

      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id)
        }, duration)
      }

      return id
    },
    [dismissToast]
  )

  const showApiError = useCallback(
    (error: unknown, fallbackMessage?: string) => {
      const errInfo = describeApiError(error)
      return showToast({
        variant: 'danger',
        title: errInfo.category === 'rate-limit' ? 'Rate Limit Reached' : 'Request Failed',
        message: errInfo.message || fallbackMessage || 'An unexpected error occurred.',
        duration: errInfo.category === 'rate-limit' ? 8000 : 5000,
      })
    },
    [showToast]
  )

  return (
    <ToastContext.Provider value={{ toasts, showToast, showApiError, dismissToast }}>
      {children}

      {/* Floating Toast Container */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((toast) => {
          const isDanger = toast.variant === 'danger'
          const isSuccess = toast.variant === 'success'
          const isWarning = toast.variant === 'warning'

          const bgClass = isDanger
            ? 'bg-rose-50 border-rose-200 text-rose-950'
            : isSuccess
            ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
            : isWarning
            ? 'bg-amber-50 border-amber-200 text-amber-950'
            : 'bg-sky-50 border-sky-200 text-sky-950'

          const IconComponent = isDanger
            ? AlertCircle
            : isSuccess
            ? CheckCircle2
            : isWarning
            ? AlertTriangle
            : Info

          const iconColor = isDanger
            ? 'text-rose-600'
            : isSuccess
            ? 'text-emerald-600'
            : isWarning
            ? 'text-amber-600'
            : 'text-sky-600'

          return (
            <div
              key={toast.id}
              role="alert"
              className={`pointer-events-auto rounded-xl border p-3.5 shadow-elevation-3 transition-all duration-200 animate-fade-in flex items-start gap-3 text-xs ${bgClass}`}
            >
              <IconComponent className={`h-4 w-4 shrink-0 mt-0.5 ${iconColor}`} aria-hidden="true" />
              <div className="flex-1 space-y-0.5">
                {toast.title && <p className="font-bold tracking-tight">{toast.title}</p>}
                <p className="leading-relaxed opacity-95">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss notification"
                className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-black/5 transition"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
