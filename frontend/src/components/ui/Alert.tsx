import React from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from 'lucide-react'

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger'

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant
  title?: string
  description?: React.ReactNode
  onDismiss?: () => void
  icon?: React.ReactNode
}

const variantStyles: Record<
  AlertVariant,
  {
    container: string
    title: string
    description: string
    icon: React.ReactNode
    closeBtn: string
  }
> = {
  info: {
    container: 'bg-sky-50 border-sky-200/90 text-sky-950',
    title: 'text-sky-950 font-bold',
    description: 'text-sky-900',
    icon: <Info className="h-4 w-4 text-sky-700 shrink-0" aria-hidden="true" />,
    closeBtn: 'text-sky-700 hover:text-sky-950 hover:bg-sky-100',
  },
  success: {
    container: 'bg-emerald-50 border-emerald-200/90 text-emerald-950',
    title: 'text-emerald-950 font-bold',
    description: 'text-emerald-900',
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />,
    closeBtn: 'text-emerald-700 hover:text-emerald-950 hover:bg-emerald-100',
  },
  warning: {
    container: 'bg-amber-50 border-amber-200/90 text-amber-950',
    title: 'text-amber-950 font-bold',
    description: 'text-amber-900',
    icon: <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" aria-hidden="true" />,
    closeBtn: 'text-amber-700 hover:text-amber-950 hover:bg-amber-100',
  },
  danger: {
    container: 'bg-rose-50 border-rose-200/90 text-rose-950',
    title: 'text-rose-950 font-bold',
    description: 'text-rose-900',
    icon: <AlertCircle className="h-4 w-4 text-rose-700 shrink-0" aria-hidden="true" />,
    closeBtn: 'text-rose-700 hover:text-rose-950 hover:bg-rose-100',
  },
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  description,
  onDismiss,
  icon,
  className = '',
  children,
  ...props
}) => {
  const styles = variantStyles[variant]

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border p-3.5 text-xs transition-all duration-150 animate-fade-in ${styles.container} ${className}`}
      {...props}
    >
      <div className="mt-0.5 shrink-0">{icon || styles.icon}</div>
      <div className="flex-1 space-y-0.5">
        {title && <p className={`text-xs ${styles.title}`}>{title}</p>}
        <div className={`leading-relaxed ${styles.description}`}>
          {description || children}
        </div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss alert"
          className={`-mr-1 -mt-1 p-1 rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${styles.closeBtn}`}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export const Toast: React.FC<AlertProps & { isVisible?: boolean }> = ({
  isVisible = true,
  className = '',
  ...props
}) => {
  if (!isVisible) return null

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm shadow-elevation-3">
      <Alert className={`shadow-lg ${className}`} {...props} />
    </div>
  )
}
