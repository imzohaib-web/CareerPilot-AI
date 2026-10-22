import React from 'react'
import { getProgressTier } from '../../utils/formatters'

export type ProgressRingVariant = 'automatic' | 'brand' | 'success' | 'warning' | 'danger'

export interface ProgressRingProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  size?: number
  strokeWidth?: number
  variant?: ProgressRingVariant
  showValue?: boolean
  label?: string
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  value,
  max = 100,
  size = 72,
  strokeWidth = 6,
  variant = 'automatic',
  showValue = true,
  label,
  className = '',
  ...props
}) => {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)))

  // Geometry
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  // Color selection
  let strokeColor = '#7c3aed' // brand
  let textColor = 'text-slate-900'

  if (variant === 'automatic') {
    const tier = getProgressTier(percentage)
    if (tier === 'danger') {
      strokeColor = '#e11d48'
      textColor = 'text-rose-900'
    } else if (tier === 'warning') {
      strokeColor = '#d97706'
      textColor = 'text-amber-900'
    } else {
      strokeColor = '#059669'
      textColor = 'text-emerald-900'
    }
  } else if (variant === 'success') {
    strokeColor = '#059669'
    textColor = 'text-emerald-900'
  } else if (variant === 'warning') {
    strokeColor = '#d97706'
    textColor = 'text-amber-900'
  } else if (variant === 'danger') {
    strokeColor = '#e11d48'
    textColor = 'text-rose-900'
  }

  return (
    <div
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || 'Score Gauge'}
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      {...props}
    >
      <svg width={size} height={size} className="rotate-[-90deg]">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#f1f5f9"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="border border-slate-200"
        />
        {/* Animated fill track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-500 ease-out"
        />
      </svg>

      {showValue && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className={`text-sm sm:text-base font-bold tabular-nums tracking-tight ${textColor}`}>
            {percentage}
          </span>
          {label && (
            <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold leading-none mt-0.5">
              {label}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
