import { apiClient } from './apiClient'
import type {
  LearningAlert,
  LearningAlertsResponse,
  SkillQuizAnswer,
  SkillQuizResponse,
  SkillQuizResult,
} from '../types'

export async function startSkillQuiz(
  roadmapId: string,
  taskId: string
): Promise<SkillQuizResponse> {
  const response = await apiClient.post<SkillQuizResponse>(
    `/api/learning/roadmaps/${roadmapId}/tasks/${encodeURIComponent(taskId)}/assessment`
  )
  return response.data
}

export async function submitSkillQuiz(
  assessmentId: string,
  answers: SkillQuizAnswer[]
): Promise<SkillQuizResult> {
  const response = await apiClient.post<SkillQuizResult>(
    `/api/learning/assessments/${assessmentId}/submit`,
    { answers }
  )
  return response.data
}

export async function fetchLearningAlerts(): Promise<LearningAlertsResponse> {
  const response = await apiClient.get<LearningAlertsResponse>('/api/alerts')
  return response.data
}

export async function markLearningAlertRead(alertId: string): Promise<LearningAlert> {
  const response = await apiClient.put<LearningAlert>(`/api/alerts/${alertId}/read`)
  return response.data
}
