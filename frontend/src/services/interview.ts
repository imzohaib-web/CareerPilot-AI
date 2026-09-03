import { apiClient } from './apiClient'
import type {
  InterviewResponse,
  InterviewStartRequest,
  InterviewSubmitRequest,
} from '../types'

/**
 * Start a new mock interview session — generates role-tailored questions.
 */
export async function startInterview(
  payload: InterviewStartRequest
): Promise<InterviewResponse> {
  const { data } = await apiClient.post<InterviewResponse>(
    '/api/interview/start',
    payload
  )
  return data
}

/**
 * Submit candidate answers and receive AI-scored evaluation.
 */
export async function submitInterview(
  interviewId: string,
  payload: InterviewSubmitRequest
): Promise<InterviewResponse> {
  const { data } = await apiClient.post<InterviewResponse>(
    `/api/interview/${interviewId}/submit`,
    payload
  )
  return data
}

/**
 * Fetch the user's most recent mock interview.
 */
export async function fetchLatestInterview(): Promise<InterviewResponse> {
  const { data } = await apiClient.get<InterviewResponse>('/api/interview/latest')
  return data
}

/**
 * Fetch a specific mock interview session by ID.
 */
export async function fetchInterviewById(
  interviewId: string
): Promise<InterviewResponse> {
  const { data } = await apiClient.get<InterviewResponse>(
    `/api/interview/${interviewId}`
  )
  return data
}
