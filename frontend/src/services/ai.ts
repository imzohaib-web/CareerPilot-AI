import { apiClient } from './apiClient'
import type { AITestResponse, HealthResponse } from '../types'

export async function testAi(message: string): Promise<AITestResponse> {
  const response = await apiClient.post<AITestResponse>('/api/ai/test', { message })
  return response.data
}

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await apiClient.get<HealthResponse>('/api/health')
  return response.data
}
