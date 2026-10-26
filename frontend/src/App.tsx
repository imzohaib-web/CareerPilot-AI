import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { ErrorBoundary } from './components/common/ErrorBoundary'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { AppLayout } from './layouts/AppLayout'
import { CareerMentorPage } from './pages/CareerMentorPage'
import { LearningAlertsPage } from './pages/LearningAlertsPage'
import { DesignSystemPage } from './pages/DesignSystemPage'
import { LoginPage } from './pages/LoginPage'
import { MockInterviewPage } from './pages/MockInterviewPage'
import { ProfilePage } from './pages/ProfilePage'
import { ProgressDashboardPage } from './pages/ProgressDashboardPage'
import { RagKnowledgePage } from './pages/RagKnowledgePage'
import { RegisterPage } from './pages/RegisterPage'
import { ResumeAnalyzerPage } from './pages/ResumeAnalyzerPage'
import { RoadmapPage } from './pages/RoadmapPage'
import { SkillGapPage } from './pages/SkillGapPage'
import { StudyCalendarPage } from './pages/StudyCalendarPage'

import { LandingPage } from './pages/LandingPage'
import { useAuth } from './context/AuthContext'
import { getToken } from './services/apiClient'

function LandingRoute() {
  const { isAuthenticated, isRestoringSession, isWakingUp } = useAuth()
  const hasTokenHint = Boolean(getToken())

  // If a login hint is present and session restoration is actively in progress,
  // do not flash the public landing page to returning visitors.
  if (hasTokenHint && isRestoringSession) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 text-slate-500 p-4 text-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
        <span className="text-sm font-medium text-slate-700">Loading session…</span>
        {isWakingUp && (
          <p
            role="status"
            aria-live="polite"
            className="text-xs text-slate-500 max-w-xs animate-fade-in"
          >
            Waking up the demo server. This can take up to a minute.
          </p>
        )}
      </div>
    )
  }

  // Authenticated visitors visiting / are redirected to the existing dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  // Logged-out visitors render the public landing page immediately without any API request
  return <LandingPage />
}

function App() {
  return (
    <ErrorBoundary fallbackTitle="Application Error" fallbackMessage="CareerPilot AI encountered an unexpected error.">
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
          <Routes>
            {/* Public Landing Route */}
            <Route
              path="/"
              element={
                <ErrorBoundary fallbackTitle="Landing Error">
                  <LandingRoute />
                </ErrorBoundary>
              }
            />

            <Route
              path="/login"
              element={
                <ErrorBoundary fallbackTitle="Login Error">
                  <LoginPage />
                </ErrorBoundary>
              }
            />
            <Route
              path="/register"
              element={
                <ErrorBoundary fallbackTitle="Registration Error">
                  <RegisterPage />
                </ErrorBoundary>
              }
            />

            {/* Dev-Only Accessible Route (Hidden in Production) */}
            {import.meta.env.DEV && (
              <Route
                path="/design-system"
                element={
                  <ErrorBoundary fallbackTitle="Design System Error">
                    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
                      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
                        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-14">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm tracking-tight">CareerPilot AI</span>
                            <span className="rounded bg-brand-50 border border-brand-200 px-1.5 py-0.5 text-[10px] font-bold text-brand-900">
                              Design System Dev Route
                            </span>
                          </div>
                          <a
                            href="/"
                            className="text-xs font-semibold text-slate-700 hover:text-slate-900 transition"
                          >
                            ← Back to App
                          </a>
                        </div>
                      </header>
                      <main className="flex-1 pb-16">
                        <DesignSystemPage />
                      </main>
                    </div>
                  </ErrorBoundary>
                }
              />
            )}

            {/* Dev preview route to test AppLayout shell directly */}
            {import.meta.env.DEV && (
              <Route path="/preview-shell" element={<AppLayout />}>
                <Route index element={<ProgressDashboardPage />} />
                <Route path="design-system" element={<DesignSystemPage />} />
              </Route>
            )}

            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route
                path="/dashboard"
                element={
                  <ErrorBoundary fallbackTitle="Dashboard Error">
                    <ProgressDashboardPage />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/profile"
                element={
                  <ErrorBoundary fallbackTitle="Profile Error">
                    <ProfilePage />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/resume"
                element={
                  <ErrorBoundary fallbackTitle="Resume Analyzer Error">
                    <ResumeAnalyzerPage />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/skill-gap"
                element={
                  <ErrorBoundary fallbackTitle="Skill Gap Error">
                    <SkillGapPage />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/roadmap"
                element={
                  <ErrorBoundary fallbackTitle="Roadmap Error">
                    <RoadmapPage />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/alerts"
                element={
                  <ErrorBoundary fallbackTitle="Learning Alerts Error">
                    <LearningAlertsPage />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/calendar"
                element={
                  <ErrorBoundary fallbackTitle="Learning Calendar Error">
                    <StudyCalendarPage />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/mentor"
                element={
                  <ErrorBoundary fallbackTitle="Career Mentor Error">
                    <CareerMentorPage />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/interview"
                element={
                  <ErrorBoundary fallbackTitle="Mock Interview Error">
                    <MockInterviewPage />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/rag"
                element={
                  <ErrorBoundary fallbackTitle="Knowledge Base Error" fallbackMessage="An error occurred while displaying the RAG Knowledge Base.">
                    <RagKnowledgePage />
                  </ErrorBoundary>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
