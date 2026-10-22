import React from 'react'

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 sm:p-12 text-center flex flex-col items-center justify-center ${className}`}
      {...props}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-700 shadow-sm mb-3.5">
        {icon}
      </div>
      <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>
      <p className="mt-1 text-xs text-slate-600 max-w-sm leading-relaxed">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
