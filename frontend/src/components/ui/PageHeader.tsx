import React from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  to?: string
}

export interface PageHeaderProps {
  title: string
  description?: React.ReactNode
  breadcrumbs?: BreadcrumbItem[]
  action?: React.ReactNode
  badge?: React.ReactNode
  className?: string
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  breadcrumbs,
  action,
  badge,
  className = '',
}) => {
  return (
    <header className={`pb-4 border-b border-slate-200/90 mb-6 ${className}`}>
      {/* Optional Breadcrumb Nav */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex items-center gap-1.5 text-xs text-slate-500">
            {breadcrumbs.map((item, idx) => {
              const isLast = idx === breadcrumbs.length - 1
              return (
                <li key={idx} className="flex items-center gap-1.5">
                  {idx > 0 && (
                    <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" aria-hidden="true" />
                  )}
                  {item.to && !isLast ? (
                    <Link
                      to={item.to}
                      className="hover:text-slate-900 transition-colors font-medium"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span
                      aria-current={isLast ? 'page' : undefined}
                      className={isLast ? 'font-semibold text-slate-800' : 'font-medium'}
                    >
                      {item.label}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </nav>
      )}

      {/* Title & Actions Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {title}
            </h1>
            {badge && <div>{badge}</div>}
          </div>
          {description && (
            <div className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
              {description}
            </div>
          )}
        </div>

        {action && <div className="self-start sm:self-auto shrink-0">{action}</div>}
      </div>
    </header>
  )
}
