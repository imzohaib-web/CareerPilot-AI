import { describe, it, expect } from 'vitest'
import { calculateReadiness, READINESS_WEIGHTS } from '../utils/readinessFormula'

describe('readinessFormula', () => {
  it('has documented weights summing to 1.0', () => {
    const sum =
      READINESS_WEIGHTS.profile +
      READINESS_WEIGHTS.resume +
      READINESS_WEIGHTS.roadmap +
      READINESS_WEIGHTS.interview
    expect(sum).toBeCloseTo(1.0, 5)
    expect(READINESS_WEIGHTS.profile).toBe(0.15)
    expect(READINESS_WEIGHTS.resume).toBe(0.30)
    expect(READINESS_WEIGHTS.roadmap).toBe(0.30)
    expect(READINESS_WEIGHTS.interview).toBe(0.25)
  })

  it('calculates 0 score and provisional flag for a brand new user', () => {
    const result = calculateReadiness({
      profile: { has_profile: false, completeness: 0 },
      resume: { has_analysis: false, score: 0 },
      roadmap: null,
      interview: null,
    })

    expect(result.score).toBe(0)
    expect(result.isProvisional).toBe(true)
    expect(result.missingModules).toEqual([
      'Profile',
      'Resume ATS',
      'Roadmap',
      'Mock Interview',
    ])
    expect(result.provisionalReason).toContain('Provisional score')
  })

  it('calculates weighted score accurately for partial data (profile + resume)', () => {
    // profile 100% (15%) + resume 70% (21%) = 36%
    const result = calculateReadiness({
      profile: { has_profile: true, completeness: 100 },
      resume: { has_analysis: true, score: 70 },
      roadmap: { has_roadmap: false, completion_percentage: 0 },
      interview: { has_interview: false, latest_score: 0 },
    })

    expect(result.score).toBe(36)
    expect(result.isProvisional).toBe(true)
    expect(result.missingModules).toContain('Roadmap')
    expect(result.missingModules).toContain('Mock Interview')
    expect(result.breakdown.profile.contribution).toBe(15)
    expect(result.breakdown.resume.contribution).toBe(21)
    expect(result.breakdown.roadmap.contribution).toBe(0)
    expect(result.breakdown.interview.contribution).toBe(0)
  })

  it('calculates score accurately for complete data without provisional status', () => {
    // profile: 100% (15) + resume: 80% (24) + roadmap: 60% (18) + interview: 80% (20) = 77%
    const result = calculateReadiness({
      profile: { has_profile: true, completeness: 100 },
      resume: { has_analysis: true, score: 80 },
      roadmap: { has_roadmap: true, completion_percentage: 60 },
      interview: { has_interview: true, latest_score: 80 },
    })

    expect(result.score).toBe(77)
    expect(result.isProvisional).toBe(false)
    expect(result.missingModules).toHaveLength(0)
    expect(result.provisionalReason).toContain('Fully verified')
    expect(result.breakdown.profile.isCompleted).toBe(true)
    expect(result.breakdown.resume.isCompleted).toBe(true)
    expect(result.breakdown.roadmap.isCompleted).toBe(true)
    expect(result.breakdown.interview.isCompleted).toBe(true)
  })

  it('clamps scores between 0 and 100 even with unexpected inputs', () => {
    const result = calculateReadiness({
      profile: { has_profile: true, completeness: 150 },
      resume: { has_analysis: true, score: 200 },
      roadmap: { has_roadmap: true, completion_percentage: 120 },
      interview: { has_interview: true, latest_score: 500 },
    })

    expect(result.score).toBe(100)
    expect(result.breakdown.profile.score).toBe(100)
    expect(result.breakdown.resume.score).toBe(100)
  })
})
