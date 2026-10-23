import { apiClient } from './apiClient'
import type {
  LearningAlert,
  LearningAlertsResponse,
  SkillQuizAnswer,
  SkillQuizResponse,
  SkillQuizResult,
  StudyCalendarResponse,
  StudyDayRecord,
  StudyDayUpdate,
  StudyPreferencesResponse,
  StudyPreferencesUpdate,
} from '../types'

export function normalizeLearningAlerts(data: unknown): LearningAlertsResponse {
  if (!data || typeof data !== 'object') {
    return { alerts: [], unread_count: 0 }
  }
  const obj = data as Record<string, unknown>
  const rawAlerts = Array.isArray(obj.alerts) ? obj.alerts : []
  const alerts: LearningAlert[] = rawAlerts.map((a: any) => ({
    id: String(a?.id || ''),
    title: String(a?.title || 'Learning notification'),
    message: String(a?.message || ''),
    category: String(a?.category || 'general'),
    is_read: Boolean(a?.is_read),
    email_status: String(a?.email_status || 'not_configured'),
    created_at: a?.created_at ? String(a.created_at) : new Date().toISOString(),
  }))
  return {
    alerts,
    unread_count: typeof obj.unread_count === 'number' ? obj.unread_count : alerts.filter((a) => !a.is_read).length,
  }
}

export function normalizeStudyCalendar(data: unknown): StudyCalendarResponse {
  if (!data || typeof data !== 'object') {
    return {
      roadmap_id: '',
      roadmap_title: 'Roadmap',
      roadmap_start_date: new Date().toISOString().slice(0, 10),
      month: new Date().toISOString().slice(0, 7),
      timezone: 'UTC',
      storage_mode: 'mongodb',
      days: [],
      missed_day_threshold: 1,
      active_missed_days: 0,
      missed_alert: null,
    }
  }
  const obj = data as Record<string, unknown>
  const rawDays = Array.isArray(obj.days) ? obj.days : []
  const days: StudyDayRecord[] = rawDays.map((d: any) => ({
    date: String(d?.date || ''),
    minutes: typeof d?.minutes === 'number' ? d.minutes : 0,
    note: String(d?.note || ''),
    updated_at: d?.updated_at ? String(d.updated_at) : new Date().toISOString(),
  }))
  return {
    roadmap_id: String(obj.roadmap_id || ''),
    roadmap_title: String(obj.roadmap_title || 'Roadmap'),
    roadmap_start_date: String(obj.roadmap_start_date || new Date().toISOString().slice(0, 10)),
    month: String(obj.month || new Date().toISOString().slice(0, 7)),
    timezone: String(obj.timezone || 'UTC'),
    storage_mode: (obj.storage_mode === 'memory' ? 'memory' : 'mongodb') as 'mongodb' | 'memory',
    days,
    missed_day_threshold: typeof obj.missed_day_threshold === 'number' ? obj.missed_day_threshold : 1,
    active_missed_days: typeof obj.active_missed_days === 'number' ? obj.active_missed_days : 0,
    missed_alert: obj.missed_alert ? String(obj.missed_alert) : null,
  }
}

export function normalizeSkillQuiz(data: unknown): SkillQuizResponse {
  if (!data || typeof data !== 'object') {
    return {
      id: '',
      roadmap_id: '',
      task_id: '',
      skill: '',
      questions: [],
    }
  }
  const obj = data as Record<string, unknown>
  const rawQuestions = Array.isArray(obj.questions) ? obj.questions : []
  return {
    id: String(obj.id || ''),
    roadmap_id: String(obj.roadmap_id || ''),
    task_id: String(obj.task_id || ''),
    skill: String(obj.skill || ''),
    questions: rawQuestions.map((q: any) => ({
      id: String(q?.id || ''),
      question: String(q?.question || ''),
      options: Array.isArray(q?.options) ? q.options.map(String) : [],
    })),
  }
}

export function normalizeSkillQuizResult(data: unknown): SkillQuizResult {
  if (!data || typeof data !== 'object') {
    return {
      id: '',
      task_id: '',
      skill: '',
      score: 0,
      passed: false,
      correct_answers: 0,
      total_questions: 10,
      completed_at: new Date().toISOString(),
    }
  }
  const obj = data as Record<string, unknown>
  return {
    id: String(obj.id || ''),
    task_id: String(obj.task_id || ''),
    skill: String(obj.skill || ''),
    score: typeof obj.score === 'number' ? obj.score : 0,
    passed: Boolean(obj.passed),
    correct_answers: typeof obj.correct_answers === 'number' ? obj.correct_answers : 0,
    total_questions: typeof obj.total_questions === 'number' ? obj.total_questions : 10,
    completed_at: obj.completed_at ? String(obj.completed_at) : new Date().toISOString(),
  }
}

export async function startSkillQuiz(
  roadmapId: string,
  taskId: string
): Promise<SkillQuizResponse> {
  const response = await apiClient.post<SkillQuizResponse>(
    `/api/learning/roadmaps/${roadmapId}/tasks/${encodeURIComponent(taskId)}/assessment`
  )
  return normalizeSkillQuiz(response.data)
}

export async function submitSkillQuiz(
  assessmentId: string,
  answers: SkillQuizAnswer[]
): Promise<SkillQuizResult> {
  const response = await apiClient.post<SkillQuizResult>(
    `/api/learning/assessments/${assessmentId}/submit`,
    { answers }
  )
  return normalizeSkillQuizResult(response.data)
}

export async function fetchLearningAlerts(): Promise<LearningAlertsResponse> {
  const response = await apiClient.get<LearningAlertsResponse>('/api/alerts')
  return normalizeLearningAlerts(response.data)
}

export async function markLearningAlertRead(alertId: string): Promise<LearningAlert> {
  const response = await apiClient.put<LearningAlert>(`/api/alerts/${alertId}/read`)
  return response.data
}

export async function fetchStudyCalendar(
  month: string,
  timezone: string,
): Promise<StudyCalendarResponse> {
  const response = await apiClient.get<StudyCalendarResponse>('/api/learning/calendar', {
    params: { month, timezone },
  })
  return normalizeStudyCalendar(response.data)
}

export async function updateStudyDay(
  day: string,
  update: StudyDayUpdate,
): Promise<void> {
  await apiClient.put(`/api/learning/calendar/${day}`, update)
}

export async function updateStudyPreferences(
  update: StudyPreferencesUpdate,
): Promise<StudyPreferencesResponse> {
  const response = await apiClient.put<StudyPreferencesResponse>(
    '/api/learning/calendar/preferences',
    update,
  )
  return response.data
}
