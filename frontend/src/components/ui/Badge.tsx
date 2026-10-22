import React from 'react'

export type BadgeVariant =
  | 'default'
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'

export type BadgeSize = 'sm' | 'md'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
  dot?: boolean
  icon?: React.ReactNode
}

const variantStyles: Record<
  BadgeVariant,
  { container: string; dot: string; text: string }
> = {
  default: {
    container: 'bg-slate-100 text-slate-800 border-slate-200/90',
    dot: 'bg-slate-500',
    text: 'text-slate-800',
  },
  brand: {
    container: 'bg-brand-50 text-brand-900 border-brand-200',
    dot: 'bg-brand-600',
    text: 'text-brand-900',
  },
  success: {
    container: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    dot: 'bg-emerald-600',
    text: 'text-emerald-900',
  },
  warning: {
    container: 'bg-amber-50 text-amber-950 border-amber-200',
    dot: 'bg-amber-500',
    text: 'text-amber-950',
  },
  danger: {
    container: 'bg-rose-50 text-rose-950 border-rose-200',
    dot: 'bg-rose-600',
    text: 'text-rose-950',
  },
  info: {
    container: 'bg-sky-50 text-sky-950 border-sky-200',
    dot: 'bg-sky-500',
    text: 'text-sky-950',
  },
  neutral: {
    container: 'bg-white text-slate-700 border-slate-200 shadow-2xs',
    dot: 'bg-slate-400',
    text: 'text-slate-700',
  },
}

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'text-[10px] px-2 py-0.5 gap-1 rounded font-semibold',
  md: 'text-xs px-2.5 py-1 gap-1.5 rounded-md font-medium',
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'md',
  dot = false,
  icon,
  className = '',
  children,
  ...props
}) => {
  const styles = variantStyles[variant]

  return (
    <span
      className={`inline-flex items-center border tracking-wide select-none ${
        styles.container
      } ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full shrink-0 ${styles.dot}`}
          aria-hidden="true"
        />
      )}
      {icon && <span className="shrink-0" aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </span>
  )
}

export const StatusPill = Badge
