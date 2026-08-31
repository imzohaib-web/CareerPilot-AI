import { apiClient } from './apiClient'
import type { DashboardResponse } from '../types'

export async function fetchDashboard(): Promise<DashboardResponse> {
  const response = await apiClient.get<DashboardResponse>('/api/progress')
  return response.data
}
