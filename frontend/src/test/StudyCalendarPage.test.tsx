import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import * as learningService from '../services/learning'
import { StudyCalendarPage } from '../pages/StudyCalendarPage'
import type { StudyCalendarResponse } from '../types'

vi.mock('../services/learning', () => ({
  fetchStudyCalendar: vi.fn(),
  updateStudyDay: vi.fn(),
  updateStudyPreferences: vi.fn(),
}))

function currentDayKey(): string {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

const calendar: StudyCalendarResponse = {
  roadmap_id: 'roadmap-1',
  roadmap_title: 'Backend Engineer Roadmap',
  roadmap_start_date: currentDayKey(),
  month: '',
  timezone: 'UTC',
  storage_mode: 'mongodb',
  days: [],
  missed_day_threshold: 2,
  active_missed_days: 0,
  missed_alert: null,
}

describe('StudyCalendarPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(learningService.fetchStudyCalendar).mockResolvedValue(calendar)
    vi.mocked(learningService.updateStudyDay).mockResolvedValue()
    vi.mocked(learningService.updateStudyPreferences).mockResolvedValue({
      missed_day_threshold: 3,
      timezone: 'UTC',
    })
  })

  it('logs a completed day with the selected minutes and note', async () => {
    render(
      <MemoryRouter>
        <StudyCalendarPage />
      </MemoryRouter>,
    )

    await screen.findByText('Backend Engineer Roadmap')
    fireEvent.change(screen.getByLabelText('Learning time (minutes)'), {
      target: { value: '45' },
    })
    fireEvent.change(screen.getByLabelText(/Note/), {
      target: { value: 'Read API documentation' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Mark day complete' }))

    await waitFor(() => {
      expect(learningService.updateStudyDay).toHaveBeenCalledWith(currentDayKey(), {
        completed: true,
        minutes: 45,
        note: 'Read API documentation',
      })
    })
  })

  it('saves a user-selected missed-day alert threshold', async () => {
    render(
      <MemoryRouter>
        <StudyCalendarPage />
      </MemoryRouter>,
    )

    await screen.findByText('Backend Engineer Roadmap')
    fireEvent.change(screen.getByLabelText('Missed days before alert'), {
      target: { value: '3' },
    })

    await waitFor(() => {
      expect(learningService.updateStudyPreferences).toHaveBeenCalledWith(
        expect.objectContaining({ missed_day_threshold: 3 }),
      )
    })
  })
})
