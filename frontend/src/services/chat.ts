import { apiClient } from './apiClient'
import type { MentorChatResponse, MentorHistoryResponse } from '../types'

/**
 * Send one message to the AI Career Mentor.
 *
 * The backend continues the user's most recent conversation when no
 * conversation id is provided and returns the id it actually used.
 */
export async function sendMentorMessage(
  message: string,
  conversationId?: string,
): Promise<MentorChatResponse> {
  const response = await apiClient.post<MentorChatResponse>('/api/chat/message', {
    message,
    conversation_id: conversationId ?? null,
  })
  return response.data
}

/** Fetch the user's stored mentor conversation (empty when none exists). */
export async function fetchMentorHistory(): Promise<MentorHistoryResponse> {
  const response = await apiClient.get<MentorHistoryResponse>('/api/chat/history')
  return response.data
}
