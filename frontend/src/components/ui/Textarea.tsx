import React, { forwardRef } from 'react'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
  showCount?: boolean
  maxLength?: number
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      hint,
      error,
      showCount = false,
      maxLength,
      value,
      defaultValue,
      id,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const textareaId = id || (label ? `textarea-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined)
    const hintId = hint ? `${textareaId}-hint` : undefined
    const errorId = error ? `${textareaId}-error` : undefined

    const currentLength = typeof value === 'string'
      ? value.length
      : typeof defaultValue === 'string'
      ? defaultValue.length
      : 0

    return (
      <div className="w-full space-y-1.5 text-left">
        <div className="flex items-center justify-between">
          {label && (
            <label
              htmlFor={textareaId}
              className="block text-xs font-semibold text-slate-800"
            >
              {label}
              {props.required && <span className="text-rose-600 ml-0.5">*</span>}
            </label>
          )}
          {showCount && maxLength && (
            <span className="text-[10px] text-slate-500 tabular-nums">
              {currentLength}/{maxLength}
            </span>
          )}
        </div>

        <textarea
          ref={ref}
          id={textareaId}
          disabled={disabled}
          maxLength={maxLength}
          value={value}
          defaultValue={defaultValue}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={`w-full rounded-lg border bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 focus-visible:ring-offset-white disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed leading-relaxed ${
            error
              ? 'border-rose-300 focus-visible:ring-rose-500'
              : 'border-slate-300 hover:border-slate-400 focus-visible:border-brand-600'
          } ${className}`}
          rows={props.rows ?? 3}
          {...props}
        />

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

Textarea.displayName = 'Textarea'
