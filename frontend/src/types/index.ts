export interface User {
  id: string
  name: string
  email: string
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: User
}

export type ExperienceLevel = 'student' | 'fresh-graduate' | 'early-career'

export interface CareerProfile {
  id: string
  user_id: string
  education: string
  university: string
  experience_level: ExperienceLevel
  target_role: string
  career_goal: string
  skills: string[]
  created_at: string
  updated_at: string
}

export interface ProfilePayload {
  education: string
  university: string
  experience_level: ExperienceLevel
  target_role: string
  career_goal: string
  skills: string[]
}

export interface AITestResponse {
  success: boolean
  message: string
  model: string
}

export interface HealthResponse {
  status: string
  database: string
}

// ── Resume Analyzer ──────────────────────────────────────────────────────

export interface ResumeEducation {
  institution: string
  degree: string
  field_of_study: string
  year: string
}

export interface ResumeExperience {
  company: string
  role: string
  duration: string
  description: string
}

export interface ResumeProject {
  name: string
  description: string
  technologies: string[]
}

export interface ResumeSections {
  education: ResumeEducation[]
  experience: ResumeExperience[]
  projects: ResumeProject[]
  certifications: string[]
}

export interface ResumeAnalysis {
  score: number
  summary: string
  strengths: string[]
  weaknesses: string[]
  missing_info: string[]
  improvements: string[]
  skills_detected: string[]
  sections: ResumeSections
}

export interface ResumeAnalysisResponse {
  id: string
  user_id: string
  filename: string
  extracted_text_length: number
  analysis: ResumeAnalysis
  analyzed_at: string
  model: string
}

// ── Progress Dashboard ──────────────────────────────────────────────────

export interface ProfileProgress {
  has_profile: boolean
  completeness: number
  target_role: string
  experience_level: string
  career_goal: string
  skills_count: number
  skills: string[]
}

export interface ResumeProgress {
  has_analysis: boolean
  score: number
  skills_detected: string[]
  skills_count: number
  improvements_count: number
  improvements: string[]
  analyzed_at: string | null
  total_analyses: number
}

export interface NextStep {
  label: string
  action: string
  priority: 'high' | 'medium' | 'low'
}

export interface DashboardResponse {
  profile: ProfileProgress
  resume: ResumeProgress
  readiness_score: number
  overall_progress: number
  next_steps: NextStep[]
}
