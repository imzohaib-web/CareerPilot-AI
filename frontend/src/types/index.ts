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
