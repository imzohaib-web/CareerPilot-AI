import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { ErrorBoundary } from './components/common/ErrorBoundary'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import { AppLayout } from './layouts/AppLayout'
import { CareerMentorPage } from './pages/CareerMentorPage'
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
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
