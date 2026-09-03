import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

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
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<ProgressDashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/resume" element={<ResumeAnalyzerPage />} />
            <Route path="/skill-gap" element={<SkillGapPage />} />
            <Route path="/roadmap" element={<RoadmapPage />} />
            <Route path="/mentor" element={<CareerMentorPage />} />
            <Route path="/interview" element={<MockInterviewPage />} />
            <Route path="/rag" element={<RagKnowledgePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
