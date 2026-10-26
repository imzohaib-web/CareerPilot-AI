import { useState, useRef, useEffect } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AlertCircle, Check, Eye, EyeOff, Loader2 } from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { describeApiError } from '../services/apiClient'
import { AuthLayout } from '../components/auth/AuthLayout'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function RegisterPage() {
  const { register, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Interaction tracking (never validate untouched fields on page load)
  const [nameDirty, setNameDirty] = useState(false)
  const [emailDirty, setEmailDirty] = useState(false)
  const [passwordDirty, setPasswordDirty] = useState(false)
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)

  // Inline errors
  const [nameError, setNameError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null)

  // Server error banner
  const [serverError, setServerError] = useState<{ message: string; isConflict?: boolean } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isWakingUp, setIsWakingUp] = useState(false)
  const [retrySeconds, setRetrySeconds] = useState<number>(0)

  const nameInputRef = useRef<HTMLInputElement>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const passwordInputRef = useRef<HTMLInputElement>(null)
  const confirmPasswordInputRef = useRef<HTMLInputElement>(null)
  const wakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Autofocus first field on mount
  useEffect(() => {
    nameInputRef.current?.focus()
    return () => {
      if (wakeTimerRef.current) clearTimeout(wakeTimerRef.current)
    }
  }, [])

  // Retry countdown timer for 429
  useEffect(() => {
    if (retrySeconds <= 0) return
    const timer = setInterval(() => {
      setRetrySeconds((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [retrySeconds])

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  // Backend validation rules (schemas/auth.py: min 8, max 72)
  const hasMinLength = password.length >= 8
  const hasValidLength = password.length >= 8 && password.length <= 72

  function validateName(val: string): string | null {
    if (!val.trim()) {
      return 'Full name is required.'
    }
    return null
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
    if (val.length < 8) {
      return 'Password must be at least 8 characters long.'
    }
    if (val.length > 72) {
      return 'Password cannot exceed 72 characters.'
    }
    return null
  }

  function validateConfirmPassword(confirmVal: string, pwdVal: string): string | null {
    if (!confirmVal) {
      return 'Please confirm your password.'
    }
    if (confirmVal !== pwdVal) {
      return 'Passwords do not match.'
    }
    return null
  }

  function handleNameBlur() {
    // Only flag error on blur if user typed into field or submitted
    if (nameDirty || hasSubmitted) {
      setNameError(validateName(name))
    }
  }

  function handleNameChange(val: string) {
    setName(val)
    setNameDirty(true)
    if (nameDirty || hasSubmitted) {
      setNameError(validateName(val))
    }
    if (serverError) setServerError(null)
  }

  function handleEmailBlur() {
    if (emailDirty || hasSubmitted) {
      setEmailError(validateEmail(email))
    }
  }

  function handleEmailChange(val: string) {
    setEmail(val)
    setEmailDirty(true)
    if (emailDirty || hasSubmitted) {
      setEmailError(validateEmail(val))
    }
    if (serverError) setServerError(null)
  }

  function handlePasswordBlur() {
    if (passwordDirty || hasSubmitted) {
      setPasswordError(validatePassword(password))
    }
  }

  function handlePasswordChange(val: string) {
    setPassword(val)
    setPasswordDirty(true)
    if (passwordDirty || hasSubmitted) {
      setPasswordError(validatePassword(val))
    }
    // Re-validate Confirm Password when Password changes after Confirm was already touched
    if (confirmPasswordTouched || hasSubmitted) {
      setConfirmPasswordError(validateConfirmPassword(confirmPassword, val))
    }
    if (serverError) setServerError(null)
  }

  function handleConfirmPasswordBlur() {
    setConfirmPasswordTouched(true)
    setConfirmPasswordError(validateConfirmPassword(confirmPassword, password))
  }

  function handleConfirmPasswordChange(val: string) {
    setConfirmPassword(val)
    if (confirmPasswordTouched || hasSubmitted) {
      setConfirmPasswordError(validateConfirmPassword(val, password))
    }
    if (serverError) setServerError(null)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (isSubmitting || retrySeconds > 0) return

    setHasSubmitted(true)
    setNameDirty(true)
    setEmailDirty(true)
    setPasswordDirty(true)
    setConfirmPasswordTouched(true)

    const nErr = validateName(name)
    const eErr = validateEmail(email)
    const pErr = validatePassword(password)
    const cErr = validateConfirmPassword(confirmPassword, password)

    setNameError(nErr)
    setEmailError(eErr)
    setPasswordError(pErr)
    setConfirmPasswordError(cErr)

    // Block submit and move focus to first error field
    if (nErr || eErr || pErr || cErr) {
      if (nErr) {
        nameInputRef.current?.focus()
      } else if (eErr) {
        emailInputRef.current?.focus()
      } else if (pErr) {
        passwordInputRef.current?.focus()
      } else if (cErr) {
        confirmPasswordInputRef.current?.focus()
      }
      return
    }

    setServerError(null)
    setIsSubmitting(true)
    setIsWakingUp(false)

    if (wakeTimerRef.current) clearTimeout(wakeTimerRef.current)
    wakeTimerRef.current = setTimeout(() => {
      setIsWakingUp(true)
    }, 4000)

    // Client-side only confirm check; backend receives strictly { name, email, password }
    try {
      await register(name.trim(), email.trim(), password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const errInfo = describeApiError(err)

      // 409 Conflict: An account with this email already exists
      if (
        errInfo.category === 'validation' &&
        (errInfo.message?.toLowerCase().includes('already exists') ||
          errInfo.message?.toLowerCase().includes('conflict'))
      ) {
        setServerError({
          message: 'An account with this email already exists.',
          isConflict: true,
        })
      } else if (errInfo.category === 'rate-limit' || errInfo.message?.toLowerCase().includes('too many')) {
        const seconds = errInfo.retryAfter && errInfo.retryAfter > 0 ? errInfo.retryAfter : 60
        setRetrySeconds(seconds)
        setServerError({
          message: `Too many attempts. Try again in ${seconds} seconds.`,
        })
      } else if (errInfo.category === 'validation') {
        setServerError({
          message: errInfo.message || 'Please check your registration details.',
        })
      } else if (errInfo.category === 'network') {
        setServerError({
          message: 'Unable to connect to the server. Please check your connection and retry.',
        })
      } else {
        setServerError({
          message: errInfo.message || 'Unable to create account. Please try again.',
        })
      }
    } finally {
      if (wakeTimerRef.current) clearTimeout(wakeTimerRef.current)
      setIsWakingUp(false)
      setIsSubmitting(false)
    }
  }

  // Confirm password matches indicator
  const isPasswordsMatching =
    confirmPassword.length > 0 && confirmPassword === password && !confirmPasswordError

  return (
    <AuthLayout
      title="Create account"
      heading="Create your account"
      subtitle="Start your career preparation with personalized milestones and feedback."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Full Name */}
        <div className="space-y-1">
          <label
            htmlFor="register-name"
            className="block text-xs font-medium text-slate-700"
          >
            Full name <span className="text-slate-400 font-normal">(required)</span>
          </label>
          <input
            ref={nameInputRef}
            id="register-name"
            type="text"
            name="name"
            autoComplete="name"
            autoFocus
            disabled={isSubmitting}
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            onBlur={handleNameBlur}
            placeholder="Enter your full name"
            aria-required="true"
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? 'register-name-error' : undefined}
            className={`w-full h-11 px-3.5 rounded-lg border text-sm text-slate-900 bg-white placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-slate-100 disabled:text-slate-500 ${
              nameError
                ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                : 'border-slate-300 focus:border-brand-600 focus:ring-brand-500/20'
            }`}
          />
          {nameError && (
            <p
              id="register-name-error"
              className="text-xs text-rose-600 font-medium flex items-center gap-1.5 pt-0.5"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{nameError}</span>
            </p>
          )}
        </div>

        {/* Email Address */}
        <div className="space-y-1">
          <label
            htmlFor="register-email"
            className="block text-xs font-medium text-slate-700"
          >
            Email address <span className="text-slate-400 font-normal">(required)</span>
          </label>
          <input
            ref={emailInputRef}
            id="register-email"
            type="email"
            name="email"
            autoComplete="email"
            disabled={isSubmitting}
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            onBlur={handleEmailBlur}
            placeholder="Enter your email address"
            aria-required="true"
            aria-invalid={Boolean(emailError || serverError?.isConflict)}
            aria-describedby={emailError ? 'register-email-error' : undefined}
            className={`w-full h-11 px-3.5 rounded-lg border text-sm text-slate-900 bg-white placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-slate-100 disabled:text-slate-500 ${
              emailError || serverError?.isConflict
                ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                : 'border-slate-300 focus:border-brand-600 focus:ring-brand-500/20'
            }`}
          />
          {emailError && (
            <p
              id="register-email-error"
              className="text-xs text-rose-600 font-medium flex items-center gap-1.5 pt-0.5"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{emailError}</span>
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1">
          <label
            htmlFor="register-password"
            className="block text-xs font-medium text-slate-700"
          >
            Password <span className="text-slate-400 font-normal">(required)</span>
          </label>
          <div className="relative">
            <input
              ref={passwordInputRef}
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="new-password"
              disabled={isSubmitting}
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              onBlur={handlePasswordBlur}
              placeholder="Create a password"
              aria-required="true"
              aria-invalid={Boolean(passwordError)}
              aria-describedby={password.length > 0 ? 'password-hint' : undefined}
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

          {/* Compact backend-accurate password rule (appears once typing starts) */}
          {password.length > 0 && (
            <div id="password-hint" className="space-y-1 pt-1" aria-live="polite">
              {/* Thin strength meter bar */}
              <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 rounded-full ${
                    hasValidLength ? 'w-full bg-emerald-500' : 'w-1/3 bg-amber-500'
                  }`}
                />
              </div>
              <p
                className={`text-[11px] flex items-center gap-1.5 transition-colors ${
                  hasMinLength ? 'text-emerald-700 font-medium' : 'text-slate-500'
                }`}
              >
                <Check
                  className={`h-3 w-3 stroke-[2.5] ${
                    hasMinLength ? 'text-emerald-600' : 'text-slate-300'
                  }`}
                  aria-hidden="true"
                />
                <span>At least 8 characters (max 72)</span>
              </p>
            </div>
          )}

          {passwordError && (
            <p
              id="register-password-error"
              className="text-xs text-rose-600 font-medium flex items-center gap-1.5 pt-0.5"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{passwordError}</span>
            </p>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-1">
          <label
            htmlFor="register-confirm-password"
            className="block text-xs font-medium text-slate-700"
          >
            Confirm password <span className="text-slate-400 font-normal">(required)</span>
          </label>
          <div className="relative">
            <input
              ref={confirmPasswordInputRef}
              id="register-confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              name="confirmPassword"
              autoComplete="new-password"
              disabled={isSubmitting}
              value={confirmPassword}
              onChange={(e) => handleConfirmPasswordChange(e.target.value)}
              onBlur={handleConfirmPasswordBlur}
              placeholder="Re-enter your password"
              aria-required="true"
              aria-invalid={Boolean(confirmPasswordError)}
              aria-describedby={
                confirmPasswordError
                  ? 'register-confirm-password-error'
                  : isPasswordsMatching
                  ? 'register-confirm-password-match'
                  : undefined
              }
              className={`w-full h-11 pl-3.5 pr-10 rounded-lg border text-sm text-slate-900 bg-white placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-slate-100 disabled:text-slate-500 ${
                confirmPasswordError
                  ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                  : isPasswordsMatching
                  ? 'border-emerald-500 focus:border-emerald-600 focus:ring-emerald-500/20'
                  : 'border-slate-300 focus:border-brand-600 focus:ring-brand-500/20'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              aria-pressed={showConfirmPassword}
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500/20 rounded"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Inline Mismatch / Required Error */}
          {confirmPasswordError && (
            <p
              id="register-confirm-password-error"
              className="text-xs text-rose-600 font-medium flex items-center gap-1.5 pt-0.5"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{confirmPasswordError}</span>
            </p>
          )}

          {/* Success Check Icon when Passwords Match */}
          {isPasswordsMatching && (
            <p
              id="register-confirm-password-match"
              className="text-[11px] text-emerald-700 font-medium flex items-center gap-1.5 pt-0.5"
            >
              <Check className="h-3.5 w-3.5 text-emerald-600 stroke-[2.5]" aria-hidden="true" />
              <span>Passwords match</span>
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
            <div className="leading-relaxed">
              <span className="font-medium">{serverError.message}</span>
              {serverError.isConflict && (
                <Link
                  to="/login"
                  className="font-semibold text-brand-700 hover:text-brand-800 underline underline-offset-2 ml-1"
                >
                  Sign in instead
                </Link>
              )}
            </div>
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
              <span>Creating account...</span>
            </>
          ) : retrySeconds > 0 ? (
            <span>Retry in {retrySeconds}s</span>
          ) : (
            <span>Create account</span>
          )}
        </button>

        {/* 4-Second Demo Server Cold Start Notice */}
        {isWakingUp && isSubmitting && (
          <p
            role="status"
            aria-live="polite"
            className="text-xs text-slate-500 text-center animate-fade-in"
          >
            Waking up the demo server. This can take up to a minute.
          </p>
        )}

        {/* Secondary Action: Plain Text Link */}
        <p className="text-center text-xs text-slate-500 pt-3">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-semibold text-brand-600 hover:text-brand-700 underline underline-offset-2 transition-colors"
          >
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
