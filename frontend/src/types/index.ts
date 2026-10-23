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

// ── Skill Gap Analyzer ───────────────────────────────────────────────────

export interface RequiredProficiency {
  area: string
  skills: string[]
}

export interface SkillGapAnalysis {
  summary: string
  missing_technical_skills: string[]
  missing_soft_skills: string[]
  required_proficiencies: RequiredProficiency[]
  match_score: number
}

export interface SkillGapRequest {
  resume_data: string
  target_role: string
  target_job_description: string
}

export interface SkillGapResponse {
  id: string
  user_id: string
  target_role: string
  target_job_description: string
  analysis: SkillGapAnalysis
  sources?: CitationRef[]
  created_at: string
}

// ── Roadmap Generator ───────────────────────────────────────────────────

export interface RoadmapTask {
  id: string
  title: string
  skill: string
  description: string
  action: string
  resource: string
  milestone: string
  estimated_hours: number
  source_refs?: string[]
}

export interface RoadmapPhase {
  phase_number: number
  name: string
  duration_weeks: number
  focus: string
  tasks: RoadmapTask[]
}

export interface RoadmapContent {
  title: string
  target_role: string
  total_duration_weeks: number
  summary: string
  phases: RoadmapPhase[]
}

export interface RoadmapRequest {
  target_role: string
  skill_gaps: string[]
  time_frame_weeks: number
  weekly_hours: number
  experience_level?: string
  additional_context?: string
}

export interface RoadmapResponse {
  id: string
  user_id: string
  target_role: string
  time_frame_weeks: number
  weekly_hours: number
  roadmap: RoadmapContent
  completed_tasks: string[]
  sources?: CitationRef[]
  created_at: string
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

export interface RoadmapProgress {
  has_roadmap: boolean
  title: string
  target_role: string
  total_tasks: number
  completed_tasks_count: number
  completion_percentage: number
}

export interface NextStep {
  label: string
  action: string
  priority: 'high' | 'medium' | 'low'
}

export interface DashboardResponse {
  profile: ProfileProgress
  resume: ResumeProgress
  roadmap?: RoadmapProgress
  interview?: InterviewProgress
  verified_skills: VerifiedSkill[]
  readiness_score: number
  overall_progress: number
  next_steps: NextStep[]
}

export interface VerifiedSkill {
  name: string
  score: number
  verified_at: string
}

export interface SkillQuizQuestion {
  id: string
  question: string
  options: string[]
}

export interface SkillQuizResponse {
  id: string
  roadmap_id: string
  task_id: string
  skill: string
  questions: SkillQuizQuestion[]
}

export interface SkillQuizAnswer {
  question_id: string
  selected_option: number
}

export interface SkillQuizResult {
  id: string
  task_id: string
  skill: string
  score: number
  passed: boolean
  correct_answers: number
  total_questions: number
  completed_at: string
}

export interface LearningAlert {
  id: string
  title: string
  message: string
  category: string
  is_read: boolean
  email_status: string
  created_at: string
}

export interface LearningAlertsResponse {
  alerts: LearningAlert[]
  unread_count: number
}

export interface StudyDayRecord {
  date: string
  minutes: number
  note: string
  updated_at: string
}

export interface StudyCalendarResponse {
  roadmap_id: string
  roadmap_title: string
  roadmap_start_date: string
  month: string
  timezone: string
  storage_mode: 'mongodb' | 'memory'
  days: StudyDayRecord[]
  missed_day_threshold: number
  active_missed_days: number
  missed_alert: string | null
}

export interface StudyDayUpdate {
  completed: boolean
  minutes: number
  note: string
}

export interface StudyPreferencesUpdate {
  missed_day_threshold: number
  timezone: string
}

export interface StudyPreferencesResponse {
  missed_day_threshold: number
  timezone: string
}

// ── Mock Interview ───────────────────────────────────────────────────────

export interface InterviewQuestion {
  id: string
  question: string
  category: 'technical' | 'behavioral' | 'situational' | string
  hint: string
}

export interface UserAnswer {
  question_id: string
  answer: string
}

export interface QuestionEvaluation {
  question_id: string
  score: number
  strengths: string[]
  improvements: string[]
  ideal_answer: string
}

export interface InterviewFeedback {
  overall_score: number
  summary: string
  evaluations: QuestionEvaluation[]
  recommended_actions: string[]
  rubric_sources?: CitationRef[]
}

export interface InterviewStartRequest {
  target_role: string
  experience_level?: string
  question_count: number
  focus_skills: string[]
}

export interface InterviewSubmitRequest {
  answers: UserAnswer[]
}

export interface InterviewResponse {
  id: string
  user_id: string
  target_role: string
  experience_level: string
  questions: InterviewQuestion[]
  answers: UserAnswer[]
  feedback?: InterviewFeedback | null
  status: 'in_progress' | 'completed' | string
  created_at: string
  completed_at?: string | null
}

export interface InterviewProgress {
  has_interview: boolean
  latest_score: number
  total_interviews: number
  target_role: string
}

// ── RAG & Knowledge Base ──

export interface CitationRef {
  id: number
  source_id: string
  document_title: string
  section_title?: string | null
  heading_path?: string | null
  snippet: string
  similarity: number
  scope: 'global' | 'user' | string
}

export interface KnowledgeBaseStats {
  total_documents?: number
  total_chunks?: number
  global_documents: number
  global_chunks: number
  user_documents: number
  user_chunks: number
  categories: string[]
  categories_map?: Record<string, number>
  category_list?: string[]
  embedding_model: string
  vector_dimension: number
  retrieval_backend: string
  storage_mode?: 'mongodb' | 'memory' | string
  database_name?: string | null
  last_updated: string | null
  last_seeded_at?: string | null
  status?: string
}

export interface DocumentIngestRequest {
  title: string
  content: string
  category?:
    | 'job_description'
    | 'interview_guide'
    | 'skill_framework'
    | 'role_matrix'
    | 'learning_path'
    | 'career_guide'
    | 'general'
    | string
  metadata?: Record<string, unknown>
}

export interface DocumentInfo {
  id: string
  user_id: string | null
  title: string
  category: string
  chunk_count: number
  content_length: number
  created_at: string
  scope?: 'global' | 'user' | string
  deletable?: boolean
}

export interface DocumentUploadResponse {
  document_id: string
  title: string
  chunk_count: number
  message: string
}

export interface RAGQueryRequest {
  query: string
  top_k?: number
  category_filter?: string
}

export interface ChunkSource {
  chunk_id: string
  document_id: string
  document_title: string
  section_title?: string | null
  heading_path?: string | null
  chunk_index: number
  content: string
  similarity_score: number
  category?: string
  scope?: 'global' | 'user' | string
  fused_rank?: number
}

export interface RetrievalResult {
  query: string
  chunks: ChunkSource[]
  total_retrieved: number
  status?: 'grounded' | 'weak' | 'no_context' | string
  retrieval_backend?: string
}

export interface RAGChatRequest {
  message: string
  top_k?: number
  document_ids?: string[]
  allow_general_knowledge?: boolean
}

export interface RAGChatResponse {
  reply: string
  answer?: string
  sources: ChunkSource[]
  citations?: CitationRef[]
  model_used: string
  status?: string
  retrieval_status?: 'grounded' | 'weak' | 'no_context' | string
  used_general_knowledge?: boolean
}

// ── Career Mentor ────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  created_at: string
  citations?: CitationRef[]
  isStreaming?: boolean
  isStopped?: boolean
}

export interface MentorChatResponse {
  conversation_id: string
  message: ChatMessage
  model: string
  citations?: CitationRef[]
}

export interface MentorHistoryResponse {
  conversation_id: string | null
  messages: ChatMessage[]
  created_at: string | null
  updated_at: string | null
}
