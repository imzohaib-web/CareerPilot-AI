import { AxiosError } from 'axios'

import { apiClient } from './apiClient'
import type { CareerProfile, ProfilePayload } from '../types'

export async function fetchProfile(): Promise<CareerProfile | null> {
  try {
    const response = await apiClient.get<CareerProfile>('/api/profile')
    return response.data
  } catch (error) {
    // 404 means the profile simply has not been created yet.
    if (error instanceof AxiosError && error.response?.status === 404) {
      return null
    }
    throw error
  }
}

export async function createProfile(payload: ProfilePayload): Promise<CareerProfile> {
  const response = await apiClient.post<CareerProfile>('/api/profile', payload)
  return response.data
}

export async function updateProfile(payload: ProfilePayload): Promise<CareerProfile> {
  const response = await apiClient.put<CareerProfile>('/api/profile', payload)
  return response.data
}
