import { apiClient } from './apiClient'
import type { TokenResponse, User } from '../types'

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<User> {
  const response = await apiClient.post<User>('/api/auth/register', {
    name,
    email,
    password,
  })
  return response.data
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const response = await apiClient.post<TokenResponse>('/api/auth/login', {
    email,
    password,
  })
  return response.data
}

export async function fetchMe(): Promise<User> {
  const response = await apiClient.get<User>('/api/auth/me')
  return response.data
}
