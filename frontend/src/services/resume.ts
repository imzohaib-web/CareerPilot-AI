import { AxiosError } from 'axios'

import { apiClient } from './apiClient'
import type { ResumeAnalysisResponse } from '../types'

/**
 * Upload a PDF resume and receive an AI-powered analysis.
 *
 * Uses multipart/form-data so the shared JSON Content-Type header
 * is overridden per-request.
 */
export async function analyzeResume(file: File): Promise<ResumeAnalysisResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiClient.post<ResumeAnalysisResponse>(
    '/api/resume/analyze',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return response.data
}

/**
 * Fetch the most recent resume analysis for the authenticated user.
 *
 * Returns ``null`` when no prior analysis exists (404).
 * Throws on unexpected errors so the caller can show a warning.
 */
export async function fetchLatestResume(): Promise<ResumeAnalysisResponse | null> {
  try {
    const response = await apiClient.get<ResumeAnalysisResponse>('/api/resume/latest')
    return response.data
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 404) {
      return null
    }
    throw error
  }
}
