import React from 'react'

export type SkeletonVariant = 'text' | 'circular' | 'rectangular' | 'card'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant
  width?: string | number
  height?: string | number
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rectangular',
  width,
  height,
  className = '',
  style,
  ...props
}) => {
  const baseClasses = 'bg-slate-200/70 animate-pulse rounded-md'

  let variantClasses = ''
  if (variant === 'text') {
    variantClasses = 'h-4 w-3/4 rounded'
  } else if (variant === 'circular') {
    variantClasses = 'rounded-full h-10 w-10 shrink-0'
  } else if (variant === 'card') {
    return (
      <div
        role="status"
        aria-label="Loading content"
        className={`rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-card ${className}`}
        {...props}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-slate-200/70 animate-pulse shrink-0" />
          <div className="space-y-1.5 flex-1">
            <div className="h-4 w-1/3 bg-slate-200/70 rounded animate-pulse" />
            <div className="h-3 w-1/2 bg-slate-200/50 rounded animate-pulse" />
          </div>
        </div>
        <div className="space-y-2 pt-2">
          <div className="h-3 w-full bg-slate-200/60 rounded animate-pulse" />
          <div className="h-3 w-5/6 bg-slate-200/60 rounded animate-pulse" />
        </div>
      </div>
    )
  }

  const computedStyle: React.CSSProperties = {
    ...style,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
  }

  return (
    <div
      role="status"
      aria-label="Loading"
      className={`${baseClasses} ${variantClasses} ${className}`}
      style={computedStyle}
      {...props}
    />
  )
}
