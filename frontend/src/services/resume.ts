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

/** Fetch the most recent resume analysis for the authenticated user. */
export async function fetchLatestResume(): Promise<ResumeAnalysisResponse | null> {
  try {
    const response = await apiClient.get<ResumeAnalysisResponse>('/api/resume/latest')
    return response.data
  } catch {
    return null
  }
}
