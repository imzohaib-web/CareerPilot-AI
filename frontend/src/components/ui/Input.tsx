import React, { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  leadingIcon?: React.ReactNode
  trailingIcon?: React.ReactNode
  isPassword?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      hint,
      error,
      leadingIcon,
      trailingIcon,
      isPassword = false,
      type = 'text',
      id,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false)
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined)
    const hintId = hint ? `${inputId}-hint` : undefined
    const errorId = error ? `${inputId}-error` : undefined

    const computedType = isPassword ? (showPassword ? 'text' : 'password') : type

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-slate-800"
          >
            {label}
            {props.required && <span className="text-rose-600 ml-0.5">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {leadingIcon && (
            <div className="pointer-events-none absolute left-3 flex items-center text-slate-400">
              {leadingIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            type={computedType}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            className={`w-full rounded-lg border bg-white py-2 text-xs text-slate-900 placeholder:text-slate-400 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 focus-visible:ring-offset-white disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed ${
              leadingIcon ? 'pl-9' : 'pl-3'
            } ${isPassword || trailingIcon ? 'pr-9' : 'pr-3'} ${
              error
                ? 'border-rose-300 focus-visible:ring-rose-500'
                : 'border-slate-300 hover:border-slate-400 focus-visible:border-brand-600'
            } ${className}`}
            {...props}
          />

          {isPassword ? (
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2.5 p-1 rounded-md text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 transition"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          ) : (
            trailingIcon && (
              <div className="pointer-events-none absolute right-3 flex items-center text-slate-400">
                {trailingIcon}
              </div>
            )
          )}
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

Input.displayName = 'Input'
