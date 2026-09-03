import { AxiosError } from 'axios'

import { apiClient } from './apiClient'
import type { RoadmapRequest, RoadmapResponse } from '../types'

export async function generateRoadmap(payload: RoadmapRequest): Promise<RoadmapResponse> {
  const response = await apiClient.post<RoadmapResponse>('/api/roadmap/generate', payload)
  return response.data
}

export async function fetchLatestRoadmap(): Promise<RoadmapResponse | null> {
  try {
    const response = await apiClient.get<RoadmapResponse>('/api/roadmap/latest')
    return response.data
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 404) {
      return null
    }
    throw error
  }
}

export async function toggleRoadmapTask(
  roadmapId: string,
  taskId: string,
  completed: boolean
): Promise<RoadmapResponse> {
  const response = await apiClient.put<RoadmapResponse>(
    `/api/roadmap/${roadmapId}/tasks/${taskId}/toggle`,
    { completed }
  )
  return response.data
}
