import React from 'react'
import { getProgressTier } from '../../utils/formatters'

export type ProgressBarVariant = 'automatic' | 'brand' | 'success' | 'warning' | 'danger'
export type ProgressBarSize = 'sm' | 'md' | 'lg'

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  variant?: ProgressBarVariant
  size?: ProgressBarSize
  showLabel?: boolean
  label?: string
}

const sizeHeights: Record<ProgressBarSize, string> = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  variant = 'automatic',
  size = 'md',
  showLabel = false,
  label,
  className = '',
  ...props
}) => {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)))

  // Determine bar color
  let barColor = 'bg-brand-600'
  if (variant === 'automatic') {
    const tier = getProgressTier(percentage)
    if (tier === 'danger') barColor = 'bg-rose-600'
    else if (tier === 'warning') barColor = 'bg-amber-500'
    else barColor = 'bg-emerald-600'
  } else if (variant === 'success') {
    barColor = 'bg-emerald-600'
  } else if (variant === 'warning') {
    barColor = 'bg-amber-500'
  } else if (variant === 'danger') {
    barColor = 'bg-rose-600'
  } else if (variant === 'brand') {
    barColor = 'bg-brand-600'
  }

  return (
    <div className={`w-full space-y-1.5 ${className}`} {...props}>
      {(showLabel || label) && (
        <div className="flex items-center justify-between text-xs font-medium text-slate-700">
          <span>{label || 'Progress'}</span>
          <span className="tabular-nums font-semibold text-slate-900">{percentage}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progress'}
        className={`w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200/60 ${sizeHeights[size]}`}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
