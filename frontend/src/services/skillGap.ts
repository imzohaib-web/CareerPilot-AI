import { AxiosError } from 'axios'

import { apiClient } from './apiClient'
import type { SkillGapRequest, SkillGapResponse } from '../types'

export async function analyzeSkillGap(payload: SkillGapRequest): Promise<SkillGapResponse> {
  const response = await apiClient.post<SkillGapResponse>('/api/analyze-gap', payload)
  return response.data
}

export async function fetchLatestSkillGap(): Promise<SkillGapResponse | null> {
  try {
    const response = await apiClient.get<SkillGapResponse>('/api/analyze-gap/latest')
    return response.data
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 404) {
      return null
    }
    throw error
  }
}
