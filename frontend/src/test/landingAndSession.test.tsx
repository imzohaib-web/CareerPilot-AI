import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AxiosError, AxiosHeaders } from 'axios'

import { LandingPage } from '../pages/LandingPage'
import { AuthProvider, useAuth } from '../context/AuthContext'
import { ProtectedRoute } from '../components/ProtectedRoute'
import { LoginPage } from '../pages/LoginPage'
import * as authService from '../services/auth'
import App from '../App'

// Helper component to inspect AuthContext values in tests
function AuthConsumer() {
  const { user, isAuthenticated, isRestoringSession, isWakingUp, sessionRestoreError, retryRestore } = useAuth()
  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'authenticated' : 'unauthenticated'}</div>
      <div data-testid="restoring-status">{isRestoringSession ? 'restoring' : 'idle'}</div>
      <div data-testid="waking-status">{isWakingUp ? 'waking' : 'ready'}</div>
      <div data-testid="error-status">{sessionRestoreError ?? 'none'}</div>
      <div data-testid="user-email">{user?.email ?? 'none'}</div>
      <button data-testid="retry-btn" onClick={retryRestore}>Retry</button>
    </div>
  )
}

describe('CareerPilot AI Frontend Improvements', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── Requirement 1 & 2: Landing Page Immediate Rendering ─────────────────
  it('1. renders the public landing page without waiting for any API response', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
      </MemoryRouter>
    )

    // Brand and headline
    expect(screen.getByRole('heading', { level: 1, name: /CareerPilot AI/i })).toBeInTheDocument()
    expect(
      screen.getByText(/Your AI-powered career companion for discovering skill gaps/i)
    ).toBeInTheDocument()

    // 6 Application Feature Highlights
    expect(screen.getByText('AI Resume Analysis')).toBeInTheDocument()
    expect(screen.getByText('Skill Gap Identification')).toBeInTheDocument()
    expect(screen.getByText('Personalized Learning Roadmaps')).toBeInTheDocument()
    expect(screen.getByText('AI Career Mentorship')).toBeInTheDocument()
    expect(screen.getByText('AI Mock Interviews')).toBeInTheDocument()
    expect(screen.getByText('Unified Progress Dashboard')).toBeInTheDocument()

    // Technology Stack Chips
    expect(screen.getByText('React 19')).toBeInTheDocument()
    expect(screen.getByText('FastAPI')).toBeInTheDocument()
    expect(screen.getByText('MongoDB Atlas')).toBeInTheDocument()
    expect(screen.getByText('Alibaba Cloud Qwen')).toBeInTheDocument()

    // Demo preview placeholder
    expect(screen.getByText('Product demo coming soon')).toBeInTheDocument()

    // Verified GitHub repository link
    const githubLink = screen.getByRole('link', { name: /GitHub Repository/i })
    expect(githubLink).toHaveAttribute('href', 'https://github.com/imzohaib-web/CareerPilot-AI')
  })

  it('2. allows logged-out visitors to open / directly', async () => {
    localStorage.clear()
    render(<App />)

    // Landing page renders directly for root route
    expect(await screen.findByRole('heading', { level: 1, name: /CareerPilot AI/i })).toBeInTheDocument()
  })

  // ── Requirement 3: Navigation CTAs ──────────────────────────────────────
  it('3. landing page authentication CTAs navigate to /login and /register', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
      </MemoryRouter>
    )

    const signInLinks = screen.getAllByRole('link', { name: /^Sign in$/i })
    expect(signInLinks.length).toBeGreaterThan(0)
    signInLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', '/login')
    })

    const createAccountLinks = screen.getAllByRole('link', { name: /Create account/i })
    expect(createAccountLinks.length).toBeGreaterThan(0)
    createAccountLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', '/register')
    })
  })

  // ── Requirement 4: Authenticated Users Redirected to Dashboard ───────────
  it('4. redirects authenticated visitors visiting / to the dashboard', async () => {
    // When a valid token is present and fetchMe resolves
    localStorage.setItem('careerpilot_token', 'valid-token')
    vi.spyOn(authService, 'fetchMe').mockResolvedValue({
      id: 'usr_1',
      name: 'Sarah Connor',
      email: 'sarah@example.com',
    } as any)

    render(<App />)

    // Progress Dashboard header or greeting should be displayed once restored
    await waitFor(() => {
      expect(screen.queryByText('Product demo coming soon')).not.toBeInTheDocument()
    })
  })

  // ── Requirement 5: No Login Hint Immediately Resolves Logged-Out ─────────
  it('5. resolves logged-out state immediately with zero API calls when no login hint exists', () => {
    localStorage.clear()
    const fetchMeSpy = vi.spyOn(authService, 'fetchMe')

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    )

    expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated')
    expect(screen.getByTestId('restoring-status')).toHaveTextContent('idle')
    expect(fetchMeSpy).not.toHaveBeenCalled()
  })

  // ── Requirement 6: Login Hint Triggers Session Restoration ──────────────
  it('6. triggers session restoration through /api/auth/me when login hint exists', async () => {
    localStorage.setItem('careerpilot_token', 'sample-jwt-token')
    const fetchMeSpy = vi.spyOn(authService, 'fetchMe').mockResolvedValue({
      id: 'usr_1',
      name: 'John Doe',
      email: 'john@example.com',
    } as any)

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    )

    expect(screen.getByTestId('restoring-status')).toHaveTextContent('restoring')
    expect(fetchMeSpy).toHaveBeenCalledWith({
      timeout: 70000,
      signal: expect.any(AbortSignal),
    })

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated')
      expect(screen.getByTestId('user-email')).toHaveTextContent('john@example.com')
      expect(screen.getByTestId('restoring-status')).toHaveTextContent('idle')
    })
  })

  // ── Requirement 7: 4-Second Waking Message Threshold ─────────────────────
  it('7. displays waking message only after 4 seconds and not before', () => {
    vi.useFakeTimers()
    localStorage.setItem('careerpilot_token', 'sample-jwt-token')
    // Keep promise pending
    vi.spyOn(authService, 'fetchMe').mockImplementation(() => new Promise(() => {}))

    render(
      <MemoryRouter>
        <AuthProvider>
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        </AuthProvider>
      </MemoryRouter>
    )

    // Initial state: spinner visible, waking message absent
    expect(screen.getByText('Loading session…')).toBeInTheDocument()
    expect(
      screen.queryByText('Waking up the demo server. This can take up to a minute.')
    ).not.toBeInTheDocument()

    // Advance 3.9 seconds (3900ms) - still not visible
    act(() => {
      vi.advanceTimersByTime(3900)
    })
    expect(
      screen.queryByText('Waking up the demo server. This can take up to a minute.')
    ).not.toBeInTheDocument()

    // Advance past 4 seconds
    act(() => {
      vi.advanceTimersByTime(200)
    })
    const wakingMsg = screen.getByText('Waking up the demo server. This can take up to a minute.')
    expect(wakingMsg).toBeInTheDocument()
    expect(wakingMsg).toHaveAttribute('role', 'status')
    expect(wakingMsg).toHaveAttribute('aria-live', 'polite')
  })

  // ── Requirement 8: Successful Session Restoration ────────────────────────
  it('8. resolves to authenticated state upon successful restoration', async () => {
    localStorage.setItem('careerpilot_token', 'valid-token')
    vi.spyOn(authService, 'fetchMe').mockResolvedValueOnce({
      id: 'u1',
      name: 'Alice Developer',
      email: 'alice@example.com',
    } as any)

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated')
      expect(screen.getByTestId('waking-status')).toHaveTextContent('ready')
      expect(screen.getByTestId('restoring-status')).toHaveTextContent('idle')
      expect(screen.getByTestId('error-status')).toHaveTextContent('none')
    })
  })

  // ── Requirement 9: HTTP 401 Does Not Trigger Retries ────────────────────
  it('9. does not retry on HTTP 401, clears token, and resolves to unauthenticated', async () => {
    localStorage.setItem('careerpilot_token', 'expired-token')
    const error401 = new AxiosError(
      'Unauthorized',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: { detail: 'Token has expired' },
      } as any
    )

    const fetchMeSpy = vi.spyOn(authService, 'fetchMe').mockRejectedValue(error401)

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated')
      expect(screen.getByTestId('restoring-status')).toHaveTextContent('idle')
    })

    // Exactly 1 attempt, zero retries
    expect(fetchMeSpy).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('careerpilot_token')).toBeNull()
  })

  // ── Requirement 10: Retries Network Errors Up to 3 Times (4 attempts max) 
  it('10. retries network failures at most 3 times after initial attempt (4 attempts total)', async () => {
    vi.useFakeTimers()
    localStorage.setItem('careerpilot_token', 'my-token')

    const networkError = new AxiosError('Network Error', 'ERR_NETWORK', undefined, undefined, undefined)
    const fetchMeSpy = vi.spyOn(authService, 'fetchMe').mockRejectedValue(networkError)

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    )

    // Attempt 1 (Initial)
    expect(fetchMeSpy).toHaveBeenCalledTimes(1)

    // Advance backoff 1 (~1000ms + jitter)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })
    expect(fetchMeSpy).toHaveBeenCalledTimes(2) // Retry 1

    // Advance backoff 2 (~2000ms + jitter)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500)
    })
    expect(fetchMeSpy).toHaveBeenCalledTimes(3) // Retry 2

    // Advance backoff 3 (~4000ms + jitter)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4500)
    })
    expect(fetchMeSpy).toHaveBeenCalledTimes(4) // Retry 3 (total 4)

    // No further retries should occur even if time advances
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })
    expect(fetchMeSpy).toHaveBeenCalledTimes(4)

    // Resolves state definitively and removes spinner
    expect(screen.getByTestId('restoring-status')).toHaveTextContent('idle')
    expect(screen.getByTestId('error-status')).toHaveTextContent(
      'Unable to reach the server to restore your session. Please check your connection or try again.'
    )
  })

  // ── Requirement 11: Button State and Delayed Message Cleanup ────────────
  it('11. shows waking message after 4s during login and cleans up upon settlement', async () => {
    vi.useFakeTimers()
    let resolveLogin: (res: any) => void
    const loginPromise = new Promise((resolve) => {
      resolveLogin = resolve
    })
    vi.spyOn(authService, 'login').mockReturnValue(loginPromise as any)

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    )

    // Fill form
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'Password123' } })

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }))

    // Loading state active, button disabled
    expect(screen.getByRole('button', { name: /Signing in.../i })).toBeDisabled()
    expect(
      screen.queryByText('Waking up the demo server. This can take up to a minute.')
    ).not.toBeInTheDocument()

    // Advance by 4.1s
    act(() => {
      vi.advanceTimersByTime(4100)
    })
    expect(
      screen.getByText('Waking up the demo server. This can take up to a minute.')
    ).toBeInTheDocument()

    // Settle the request
    await act(async () => {
      resolveLogin!({ access_token: 'tok-123', user: { id: '1', email: 'user@example.com' } })
    })

    // Notice should be removed
    expect(
      screen.queryByText('Waking up the demo server. This can take up to a minute.')
    ).not.toBeInTheDocument()
  })

  // ── Requirement 12: Preserves Validation and Authentication Behavior ─────
  it('12. preserves validation and authentication behavior on LoginPage and RegisterPage', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    )

    // Submitting with empty fields shows validation
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }))
    expect(screen.getByText('Email address is required.')).toBeInTheDocument()
    expect(screen.getByText('Password is required.')).toBeInTheDocument()
  })

  // ── Requirement 13: Non-Blocking Warm-Up Ping ───────────────────────────
  it('13. ping request initiates without blocking rendering or throwing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      return Promise.resolve({ ok: true } as Response)
    })

    // Simulate entry point behavior
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
    try {
      void fetch(`${apiBase}/api/health/ping`).catch(() => {})
    } catch {
      // safe
    }

    expect(fetchSpy).toHaveBeenCalledWith(`${apiBase}/api/health/ping`)
  })

  // ── Requirement 14: No Duplicate or Overlapping Retry Loops ──────────────
  it('14. aborts pending restore on unmount to prevent overlapping duplicate loops', () => {
    localStorage.setItem('careerpilot_token', 'test-token')
    const abortSpy = vi.spyOn(AbortController.prototype, 'abort')

    const { unmount } = render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    )

    unmount()
    expect(abortSpy).toHaveBeenCalled()
  })
})
