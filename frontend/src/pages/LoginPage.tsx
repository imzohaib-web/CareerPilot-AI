import { useState, useRef, useEffect } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { describeApiError } from '../services/apiClient'
import { AuthLayout } from '../components/auth/AuthLayout'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Interaction tracking (never validate on initial load)
  const [emailTouched, setEmailTouched] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)

  // Inline validation errors
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // Server error banner
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [retrySeconds, setRetrySeconds] = useState<number>(0)

  const emailInputRef = useRef<HTMLInputElement>(null)

  // Autofocus first field on mount
  useEffect(() => {
    emailInputRef.current?.focus()
  }, [])

  // Retry countdown timer for 429 rate limit
  useEffect(() => {
    if (retrySeconds <= 0) return
    const timer = setInterval(() => {
      setRetrySeconds((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [retrySeconds])

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  function validateEmail(val: string): string | null {
    const trimmed = val.trim()
    if (!trimmed) {
      return 'Email address is required.'
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      return 'Enter a valid email address.'
    }
    return null
  }

  function validatePassword(val: string): string | null {
    if (!val) {
      return 'Password is required.'
    }
    return null
  }

  function handleEmailBlur() {
    setEmailTouched(true)
    setEmailError(validateEmail(email))
  }

  function handleEmailChange(val: string) {
    setEmail(val)
    if (emailTouched) {
      setEmailError(validateEmail(val))
    }
    if (serverError) setServerError(null)
  }

  function handlePasswordBlur() {
    setPasswordTouched(true)
    setPasswordError(validatePassword(password))
  }

  function handlePasswordChange(val: string) {
    setPassword(val)
    if (passwordTouched) {
      setPasswordError(validatePassword(val))
    }
    if (serverError) setServerError(null)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (isSubmitting || retrySeconds > 0) return

    // Validate on submit
    setEmailTouched(true)
    setPasswordTouched(true)

    const eErr = validateEmail(email)
    const pErr = validatePassword(password)
    setEmailError(eErr)
    setPasswordError(pErr)

    if (eErr || pErr) {
      if (eErr) emailInputRef.current?.focus()
      return
    }

    setServerError(null)
    setIsSubmitting(true)

    try {
      await login(email.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      const errInfo = describeApiError(err)

      // Map server error codes according to specification
      if (errInfo.category === 'rate-limit' || errInfo.message?.toLowerCase().includes('too many')) {
        const seconds = errInfo.retryAfter && errInfo.retryAfter > 0 ? errInfo.retryAfter : 60
        setRetrySeconds(seconds)
        setServerError(`Too many attempts. Try again in ${seconds} seconds.`)
      } else if (errInfo.category === 'authentication' || errInfo.message?.toLowerCase().includes('invalid')) {
        setServerError('Incorrect email or password.')
      } else if (errInfo.category === 'validation') {
        setServerError(errInfo.message || 'Please check your email and password.')
      } else if (errInfo.category === 'network') {
        setServerError('Unable to connect to the server. Please check your connection and retry.')
      } else {
        setServerError(errInfo.message || 'Something went wrong. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      heading="Welcome back"
      subtitle="Enter your email and password to access your account."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Email Field */}
        <div className="space-y-1">
          <label
            htmlFor="login-email"
            className="block text-xs font-medium text-slate-700"
          >
            Email address <span className="text-slate-400 font-normal">(required)</span>
          </label>
          <input
            ref={emailInputRef}
            id="login-email"
            type="email"
            name="email"
            autoComplete="username email"
            autoFocus
            disabled={isSubmitting}
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            onBlur={handleEmailBlur}
            placeholder="alex.johnson@example.com"
            aria-required="true"
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? 'login-email-error' : undefined}
            className={`w-full h-11 px-3.5 rounded-lg border text-sm text-slate-900 bg-white placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-slate-100 disabled:text-slate-500 ${
              emailError
                ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                : 'border-slate-300 focus:border-brand-600 focus:ring-brand-500/20'
            }`}
          />
          {emailError && (
            <p
              id="login-email-error"
              className="text-xs text-rose-600 font-medium flex items-center gap-1.5 pt-0.5"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{emailError}</span>
            </p>
          )}
        </div>

        {/* Password Field */}
        <div className="space-y-1">
          <label
            htmlFor="login-password"
            className="block text-xs font-medium text-slate-700"
          >
            Password <span className="text-slate-400 font-normal">(required)</span>
          </label>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              disabled={isSubmitting}
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              onBlur={handlePasswordBlur}
              placeholder="••••••••"
              aria-required="true"
              aria-invalid={Boolean(passwordError)}
              aria-describedby={passwordError ? 'login-password-error' : undefined}
              className={`w-full h-11 pl-3.5 pr-10 rounded-lg border text-sm text-slate-900 bg-white placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-slate-100 disabled:text-slate-500 ${
                passwordError
                  ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                  : 'border-slate-300 focus:border-brand-600 focus:ring-brand-500/20'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-pressed={showPassword}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500/20 rounded"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {passwordError && (
            <p
              id="login-password-error"
              className="text-xs text-rose-600 font-medium flex items-center gap-1.5 pt-0.5"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{passwordError}</span>
            </p>
          )}
        </div>

        {/* Server Error Alert Banner */}
        {serverError && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex items-start gap-2.5"
          >
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
            <span className="leading-relaxed font-medium">{serverError}</span>
          </div>
        )}

        {/* Primary Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || retrySeconds > 0}
          className="w-full h-11 rounded-lg bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-sm font-medium shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Signing in...</span>
            </>
          ) : retrySeconds > 0 ? (
            <span>Retry in {retrySeconds}s</span>
          ) : (
            <span>Sign in</span>
          )}
        </button>

        {/* Secondary Action: Plain Text Link */}
        <p className="text-center text-xs text-slate-500 pt-3">
          Don't have an account?{' '}
          <Link
            to="/register"
            className="font-semibold text-brand-600 hover:text-brand-700 underline underline-offset-2 transition-colors"
          >
            Create one
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
