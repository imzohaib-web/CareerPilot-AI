/**
 * Career Readiness Formula & Weighting Engine
 *
 * Weights (Documented):
 * - Career Profile completeness: 15% (0.15)
 * - Resume ATS match score:      30% (0.30)
 * - Learning Roadmap progress:   30% (0.30)
 * - Mock Interview score:        25% (0.25)
 * Total:                        100% (1.00)
 *
 * Mark as Provisional when any module is missing or untested.
 */

export const READINESS_WEIGHTS = {
  profile: 0.15,
  resume: 0.30,
  roadmap: 0.30,
  interview: 0.25,
} as const

export interface ModuleProgressInput {
  has_profile: boolean
  completeness: number
}

export interface ResumeProgressInput {
  has_analysis: boolean
  score: number
}

export interface RoadmapProgressInput {
  has_roadmap: boolean
  completion_percentage: number
}

export interface InterviewProgressInput {
  has_interview: boolean
  latest_score: number
}

export interface ReadinessInputs {
  profile: ModuleProgressInput
  resume: ResumeProgressInput
  roadmap?: RoadmapProgressInput | null
  interview?: InterviewProgressInput | null
}

export interface ModuleContribution {
  score: number
  weight: number
  contribution: number
  isCompleted: boolean
  label: string
}

export interface ReadinessResult {
  score: number
  isProvisional: boolean
  missingModules: string[]
  provisionalReason: string
  breakdown: {
    profile: ModuleContribution
    resume: ModuleContribution
    roadmap: ModuleContribution
    interview: ModuleContribution
  }
}

/**
 * Calculates the weighted Career Readiness score and determines whether it is provisional.
 */
export function calculateReadiness(inputs: ReadinessInputs): ReadinessResult {
  const profileScore = inputs.profile.has_profile
    ? Math.min(100, Math.max(0, inputs.profile.completeness))
    : 0

  const resumeScore = inputs.resume.has_analysis
    ? Math.min(100, Math.max(0, inputs.resume.score))
    : 0

  const roadmapScore = inputs.roadmap?.has_roadmap
    ? Math.min(100, Math.max(0, inputs.roadmap.completion_percentage))
    : 0

  const interviewScore = inputs.interview?.has_interview
    ? Math.min(100, Math.max(0, inputs.interview.latest_score))
    : 0

  const profileContrib = profileScore * READINESS_WEIGHTS.profile
  const resumeContrib = resumeScore * READINESS_WEIGHTS.resume
  const roadmapContrib = roadmapScore * READINESS_WEIGHTS.roadmap
  const interviewContrib = interviewScore * READINESS_WEIGHTS.interview

  const totalScore = Math.min(
    100,
    Math.max(0, Math.round(profileContrib + resumeContrib + roadmapContrib + interviewContrib))
  )

  const missingModules: string[] = []
  if (!inputs.profile.has_profile || inputs.profile.completeness < 80) {
    missingModules.push('Profile')
  }
  if (!inputs.resume.has_analysis) {
    missingModules.push('Resume ATS')
  }
  if (!inputs.roadmap?.has_roadmap || (inputs.roadmap.completion_percentage ?? 0) === 0) {
    missingModules.push('Roadmap')
  }
  if (!inputs.interview?.has_interview) {
    missingModules.push('Mock Interview')
  }

  const isProvisional = missingModules.length > 0
  const provisionalReason = isProvisional
    ? `Provisional score: Missing or incomplete data from ${missingModules.join(
        ', '
      )}. Complete all modules for fully verified career readiness.`
    : 'Fully verified career readiness based on all 4 modules.'

  return {
    score: totalScore,
    isProvisional,
    missingModules,
    provisionalReason,
    breakdown: {
      profile: {
        score: profileScore,
        weight: READINESS_WEIGHTS.profile,
        contribution: Math.round(profileContrib),
        isCompleted: inputs.profile.has_profile && inputs.profile.completeness >= 80,
        label: 'Career Profile',
      },
      resume: {
        score: resumeScore,
        weight: READINESS_WEIGHTS.resume,
        contribution: Math.round(resumeContrib),
        isCompleted: inputs.resume.has_analysis,
        label: 'Resume ATS Match',
      },
      roadmap: {
        score: roadmapScore,
        weight: READINESS_WEIGHTS.roadmap,
        contribution: Math.round(roadmapContrib),
        isCompleted: Boolean(inputs.roadmap?.has_roadmap && inputs.roadmap.completion_percentage > 0),
        label: 'Roadmap Tasks',
      },
      interview: {
        score: interviewScore,
        weight: READINESS_WEIGHTS.interview,
        contribution: Math.round(interviewContrib),
        isCompleted: Boolean(inputs.interview?.has_interview),
        label: 'Mock Interview',
      },
    },
  }
}
