import React from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { Card } from './Card'

export interface StatProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: string | number
  subtext?: string
  icon?: React.ReactNode
  trend?: {
    value: string
    positive?: boolean
    label?: string
  }
}

export const Stat: React.FC<StatProps> = ({
  label,
  value,
  subtext,
  icon,
  trend,
  className = '',
  ...props
}) => {
  return (
    <Card className={`p-4 sm:p-5 flex flex-col justify-between ${className}`} {...props}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 block mb-1">
            {label}
          </span>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums tracking-tight">
            {value}
          </p>
        </div>
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 border border-slate-200/60 shadow-2xs">
            {icon}
          </div>
        )}
      </div>

      {(subtext || trend) && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          {subtext && <span>{subtext}</span>}
          {trend && (
            <div
              className={`flex items-center gap-1 font-semibold ${
                trend.positive ? 'text-emerald-800' : 'text-rose-800'
              }`}
            >
              {trend.positive ? (
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span className="tabular-nums">{trend.value}</span>
              {trend.label && (
                <span className="text-slate-500 font-normal ml-0.5">{trend.label}</span>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
