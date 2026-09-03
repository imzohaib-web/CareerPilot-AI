import { apiClient } from './apiClient'
import type { HealthResponse } from '../types'

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await apiClient.get<HealthResponse>('/api/health')
  return response.data
}
