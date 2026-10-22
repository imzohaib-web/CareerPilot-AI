import React, { forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  error?: string
  options?: SelectOption[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      hint,
      error,
      options,
      id,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const selectId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined)
    const hintId = hint ? `${selectId}-hint` : undefined
    const errorId = error ? `${selectId}-error` : undefined

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-semibold text-slate-800"
          >
            {label}
            {props.required && <span className="text-rose-600 ml-0.5">*</span>}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            className={`w-full appearance-none rounded-lg border bg-white pl-3 pr-9 py-2 text-xs text-slate-900 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 focus-visible:ring-offset-white disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed ${
              error
                ? 'border-rose-300 focus-visible:ring-rose-500'
                : 'border-slate-300 hover:border-slate-400 focus-visible:border-brand-600'
            } ${className}`}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-slate-400">
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </div>
        </div>

        {error ? (
          <p id={errorId} className="text-[11px] font-medium text-rose-700 animate-fade-in">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="text-[11px] text-slate-500">
            {hint}
          </p>
        ) : null}
      </div>
    )
  }
)

Select.displayName = 'Select'
