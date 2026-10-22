import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { ErrorBoundary } from './components/common/ErrorBoundary'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { AppLayout } from './layouts/AppLayout'
import { CareerMentorPage } from './pages/CareerMentorPage'
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

function App() {
  return (
    <ErrorBoundary fallbackTitle="Application Error" fallbackMessage="CareerPilot AI encountered an unexpected error.">
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
          <Routes>
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
                path="/"
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
