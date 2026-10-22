import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CareerMentorPage } from '../pages/CareerMentorPage'
import * as chatService from '../services/chat'
import * as progressService from '../services/progress'
import type { StreamHandlers } from '../services/streamClient'
import type { MentorChatResponse } from '../types'

vi.mock('../services/chat', () => ({
  fetchMentorHistory: vi.fn(),
  sendMentorMessage: vi.fn(),
  streamMentorMessage: vi.fn(),
  resetHistory: vi.fn(),
}))

vi.mock('../services/progress', () => ({
  fetchDashboard: vi.fn(),
}))

describe('Streaming Chat Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(chatService.fetchMentorHistory).mockResolvedValue({
      conversation_id: 'conv-test-1',
      messages: [],
      created_at: null,
      updated_at: null,
    })
    vi.mocked(progressService.fetchDashboard).mockResolvedValue({
      profile: { has_profile: true },
      resume: { has_analysis: true },
    } as any)
  })

  it('renders streaming deltas into the assistant bubble and finishes cleanly', async () => {
    let capturedHandlers: StreamHandlers<MentorChatResponse> | null = null

    vi.mocked(chatService.streamMentorMessage).mockImplementation(
      async (_payload, _convId, handlers) => {
        capturedHandlers = handlers
        handlers.onStart?.({ conversation_id: 'conv-test-1' })
      }
    )

    render(
      <MemoryRouter>
        <CareerMentorPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Ask your mentor anything/i)).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText(/Ask your mentor anything/i)
    fireEvent.change(input, { target: { value: 'How do I become an AI Engineer?' } })

    const sendBtn = screen.getByRole('button', { name: /Send/i })
    fireEvent.click(sendBtn)

    // User message should appear immediately
    expect(screen.getByText('How do I become an AI Engineer?')).toBeInTheDocument()

    // Stream handler should be invoked
    expect(chatService.streamMentorMessage).toHaveBeenCalled()
    expect(capturedHandlers).not.toBeNull()

    // Stop button should now be visible while streaming
    expect(screen.getByRole('button', { name: /Stop/i })).toBeInTheDocument()

    // Deliver deltas
    act(() => {
      capturedHandlers?.onDelta?.('Focus on ')
      capturedHandlers?.onDelta?.('LLM fine-tuning.')
    })

    // Advance animation frame
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r))
    })

    // Text should now appear in the assistant bubble
    await waitFor(() => {
      expect(screen.getByText(/Focus on LLM fine-tuning\./i)).toBeInTheDocument()
    })

    // Deliver done
    act(() => {
      capturedHandlers?.onDone?.({
        conversation_id: 'conv-test-1',
        model: 'qwen-plus',
        message: {
          role: 'assistant',
          content: 'Focus on LLM fine-tuning.',
          created_at: new Date().toISOString(),
        },
      })
    })

    await waitFor(() => {
      // Stop button should disappear after stream completes
      expect(screen.queryByRole('button', { name: /Stop/i })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Send/i })).toBeInTheDocument()
    })
  })

  it('allows user to click Stop to abort streaming and preserves partial text', async () => {
    let capturedHandlers: StreamHandlers<MentorChatResponse> | null = null

    vi.mocked(chatService.streamMentorMessage).mockImplementation(
      async (_payload, _convId, handlers) => {
        capturedHandlers = handlers
        handlers.onStart?.({ conversation_id: 'conv-test-1' })
      }
    )

    render(
      <MemoryRouter>
        <CareerMentorPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Ask your mentor anything/i)).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText(/Ask your mentor anything/i)
    fireEvent.change(input, { target: { value: 'Tell me about Docker' } })
    fireEvent.click(screen.getByRole('button', { name: /Send/i }))

    // Deliver first delta
    act(() => {
      capturedHandlers?.onDelta?.('Docker is a containerization')
    })
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r))
    })

    await waitFor(() => {
      expect(screen.getByText(/Docker is a containerization/i)).toBeInTheDocument()
    })

    // Click Stop button
    const stopBtn = screen.getByRole('button', { name: /Stop/i })
    fireEvent.click(stopBtn)

    // Verify partial text is preserved and generation stopped note appears
    await waitFor(() => {
      expect(screen.getByText(/Generation stopped by user/i)).toBeInTheDocument()
      expect(screen.getByText(/Docker is a containerization/i)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Stop/i })).not.toBeInTheDocument()
    })
  })

  it('automatically falls back to non-streaming endpoint when streaming fails before first token', async () => {
    // Fail immediately on streaming call
    vi.mocked(chatService.streamMentorMessage).mockImplementation(
      async (_payload, _convId, handlers) => {
        handlers.onError?.({
          message: 'Endpoint not implemented (501)',
          category: 'server',
          status: 501,
        })
      }
    )

    // Non-streaming fallback succeeds
    vi.mocked(chatService.sendMentorMessage).mockResolvedValue({
      conversation_id: 'conv-fallback-1',
      model: 'qwen-plus',
      message: {
        role: 'assistant',
        content: 'Non-streaming fallback response successfully received.',
        created_at: new Date().toISOString(),
      },
    })

    render(
      <MemoryRouter>
        <CareerMentorPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Ask your mentor anything/i)).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText(/Ask your mentor anything/i)
    fireEvent.change(input, { target: { value: 'Test fallback' } })
    fireEvent.click(screen.getByRole('button', { name: /Send/i }))

    // Streaming was attempted first
    expect(chatService.streamMentorMessage).toHaveBeenCalled()

    // Non-streaming fallback was called
    await waitFor(() => {
      expect(chatService.sendMentorMessage).toHaveBeenCalledWith(
        'Test fallback',
        'conv-test-1'
      )
    })

    // Final answer from non-streaming path is rendered
    await waitFor(() => {
      expect(
        screen.getByText('Non-streaming fallback response successfully received.')
      ).toBeInTheDocument()
    })
  })
})
