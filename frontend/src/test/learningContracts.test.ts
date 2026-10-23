import { describe, expect, it } from 'vitest'
import {
  normalizeLearningAlerts,
  normalizeSkillQuiz,
  normalizeSkillQuizResult,
  normalizeStudyCalendar,
} from '../services/learning'

describe('Learning & Alerts Contract & Normalizer Tests', () => {
  describe('normalizeLearningAlerts contract', () => {
    it('correctly maps realistic backend alerts payload', () => {
      const raw = {
        alerts: [
          {
            id: '6601a2b3c4d5e6f7a8b9c0d1',
            title: 'Skill verified: TypeScript',
            message: 'You scored 90% on the TypeScript assessment.',
            category: 'skill_verified',
            is_read: false,
            email_status: 'sent',
            created_at: '2026-10-23T10:00:00Z',
          },
        ],
        unread_count: 1,
      }

      const res = normalizeLearningAlerts(raw)
      expect(res.unread_count).toBe(1)
      expect(res.alerts).toHaveLength(1)
      expect(res.alerts[0].id).toBe('6601a2b3c4d5e6f7a8b9c0d1')
      expect(res.alerts[0].title).toBe('Skill verified: TypeScript')
      expect(res.alerts[0].is_read).toBe(false)
      expect(res.alerts[0].email_status).toBe('sent')
    })

    it('resiliently defaults null, missing, or malformed data', () => {
      const res = normalizeLearningAlerts(null)
      expect(res.alerts).toEqual([])
      expect(res.unread_count).toBe(0)

      const partial = normalizeLearningAlerts({ alerts: [{ title: 'Partial alert' }] })
      expect(partial.alerts).toHaveLength(1)
      expect(partial.alerts[0].id).toBe('')
      expect(partial.alerts[0].title).toBe('Partial alert')
      expect(partial.alerts[0].email_status).toBe('not_configured')
    })
  })

  describe('normalizeStudyCalendar contract', () => {
    it('correctly maps realistic backend study calendar payload', () => {
      const raw = {
        roadmap_id: '6601a2b3c4d5e6f7a8b9c0a1',
        roadmap_title: 'Full Stack Roadmap',
        roadmap_start_date: '2026-10-01',
        month: '2026-10',
        timezone: 'Asia/Karachi',
        storage_mode: 'mongodb',
        days: [
          {
            date: '2026-10-20',
            minutes: 45,
            note: 'Studied FastAPI Dependency Injection',
            updated_at: '2026-10-20T14:30:00Z',
          },
        ],
        missed_day_threshold: 2,
        active_missed_days: 0,
        missed_alert: null,
      }

      const res = normalizeStudyCalendar(raw)
      expect(res.roadmap_id).toBe('6601a2b3c4d5e6f7a8b9c0a1')
      expect(res.timezone).toBe('Asia/Karachi')
      expect(res.days).toHaveLength(1)
      expect(res.days[0].minutes).toBe(45)
      expect(res.days[0].note).toBe('Studied FastAPI Dependency Injection')
      expect(res.active_missed_days).toBe(0)
    })

    it('resiliently defaults empty or missing fields', () => {
      const res = normalizeStudyCalendar(null)
      expect(res.roadmap_id).toBe('')
      expect(res.days).toEqual([])
      expect(res.missed_day_threshold).toBe(1)
      expect(res.storage_mode).toBe('mongodb')
    })
  })

  describe('normalizeSkillQuiz contract', () => {
    it('safely normalizes questions and prevents unexpected missing option arrays', () => {
      const raw = {
        id: 'quiz-1',
        roadmap_id: 'road-1',
        task_id: 'task-1',
        skill: 'FastAPI',
        questions: [
          {
            id: 'q-1',
            question: 'What is Depends() used for?',
            options: ['Dependency Injection', 'Routing', 'Formatting', 'Templating'],
          },
        ],
      }

      const res = normalizeSkillQuiz(raw)
      expect(res.skill).toBe('FastAPI')
      expect(res.questions).toHaveLength(1)
      expect(res.questions[0].options).toHaveLength(4)
      expect(res.questions[0].id).toBe('q-1')
    })
  })

  describe('normalizeSkillQuizResult contract', () => {
    it('correctly maps quiz submission result', () => {
      const raw = {
        id: 'quiz-1',
        task_id: 'task-1',
        skill: 'FastAPI',
        score: 80,
        passed: true,
        correct_answers: 8,
        total_questions: 10,
        completed_at: '2026-10-23T15:00:00Z',
      }

      const res = normalizeSkillQuizResult(raw)
      expect(res.score).toBe(80)
      expect(res.passed).toBe(true)
      expect(res.correct_answers).toBe(8)
      expect(res.total_questions).toBe(10)
    })
  })
})
