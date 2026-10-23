import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  CircleAlert,
  Clock,
  ExternalLink,
  FileText,
  HelpCircle,
  Map,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Video,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { describeApiError } from '../services/apiClient'
import * as progressService from '../services/progress'
import * as roadmapService from '../services/roadmap'
import * as skillGapService from '../services/skillGap'
import * as interviewService from '../services/interview'
import type {
  DashboardResponse,
  RoadmapResponse,
  SkillGapResponse,
  InterviewResponse,
  RoadmapTask,
} from '../types'
import {
  firstName,
  getTimeAwareGreeting,
  getProgressTier,
} from '../utils/formatters'
import { calculateReadiness } from '../utils/readinessFormula'
import {
  MOCK_FULL_DATA,
  MOCK_PARTIAL_DATA,
  MOCK_NEW_USER_DATA,
} from '../utils/dashboardMockData'
import { Badge, type BadgeVariant } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ProgressRing } from '../components/ui/ProgressRing'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Tooltip } from '../components/ui/Tooltip'
import { Drawer } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'

// ── Custom Count-Up Hook ──────────────────────────────────────────────────

function useCountUp(target: number, durationMs: number = 800): number {
  const [count, setCount] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return target
    }
    return 0
  })

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    let startTimestamp: number | null = null
    let rafId: number

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp
      const elapsed = timestamp - startTimestamp
      const progress = Math.min(elapsed / durationMs, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * target))

      if (progress < 1) {
        rafId = requestAnimationFrame(step)
      }
    }

    rafId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId)
  }, [target, durationMs])

  return count
}

// ── Pace Calculation Helper ───────────────────────────────────────────────

interface WeekPace {
  status: 'on_track' | 'ahead' | 'behind'
  label: string
  badgeVariant: BadgeVariant
}

function computePace(completedCount: number, totalCount: number): WeekPace {
  if (totalCount === 0) {
    return { status: 'on_track', label: 'On Track', badgeVariant: 'brand' }
  }
  const ratio = completedCount / totalCount
  if (ratio >= 0.6) {
    return { status: 'ahead', label: 'Ahead of Pace', badgeVariant: 'success' }
  }
  if (ratio >= 0.25) {
    return { status: 'on_track', label: 'On Track', badgeVariant: 'brand' }
  }
  return { status: 'behind', label: 'Behind Schedule', badgeVariant: 'warning' }
}

// ── Main Dashboard Component ──────────────────────────────────────────────

export function ProgressDashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()

  // State
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null)
  const [roadmap, setRoadmap] = useState<RoadmapResponse | null>(null)
  const [skillGap, setSkillGap] = useState<SkillGapResponse | null>(null)
  const [interview, setInterview] = useState<InterviewResponse | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const [searchParams, setSearchParams] = useSearchParams()
  const demoMode = searchParams.get('demo') // 'full' | 'partial' | 'new-user' | 'error' | null

  // Fetch all dashboard data concurrently with graceful partial failure
  const loadDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    setError(null)

    try {
      const [dashRes, roadRes, gapRes, intRes] = await Promise.allSettled([
        progressService.fetchDashboard(),
        roadmapService.fetchLatestRoadmap(),
        skillGapService.fetchLatestSkillGap(),
        interviewService.fetchLatestInterview(),
      ])

      if (dashRes.status === 'fulfilled') {
        setDashboard(dashRes.value)
      } else {
        throw dashRes.reason
      }

      if (roadRes.status === 'fulfilled') {
        setRoadmap(roadRes.value)
      } else {
        setRoadmap(null)
      }

      if (gapRes.status === 'fulfilled') {
        setSkillGap(gapRes.value)
      } else {
        setSkillGap(null)
      }

      if (intRes.status === 'fulfilled') {
        setInterview(intRes.value)
      } else {
        setInterview(null)
      }
    } catch (err) {
      setError(describeApiError(err).message)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  const applyMockState = useCallback((type: 'full' | 'partial' | 'new-user' | 'error' | 'live') => {
    if (type === 'error') {
      setError('Unable to load dashboard: Simulated API connection failure (500).')
      setDashboard(null)
      return
    }
    if (type === 'full') {
      setError(null)
      setDashboard(MOCK_FULL_DATA.dashboard)
      setRoadmap(MOCK_FULL_DATA.roadmap)
      setSkillGap(MOCK_FULL_DATA.skillGap)
      setInterview(MOCK_FULL_DATA.interview)
      return
    }
    if (type === 'partial') {
      setError(null)
      setDashboard(MOCK_PARTIAL_DATA.dashboard)
      setRoadmap(MOCK_PARTIAL_DATA.roadmap)
      setSkillGap(MOCK_PARTIAL_DATA.skillGap)
      setInterview(MOCK_PARTIAL_DATA.interview)
      return
    }
    if (type === 'new-user') {
      setError(null)
      setDashboard(MOCK_NEW_USER_DATA.dashboard)
      setRoadmap(MOCK_NEW_USER_DATA.roadmap)
      setSkillGap(MOCK_NEW_USER_DATA.skillGap)
      setInterview(MOCK_NEW_USER_DATA.interview)
      return
    }
    loadDashboardData()
  }, [loadDashboardData])

  useEffect(() => {
    if (demoMode === 'full') {
      applyMockState('full')
      setIsLoading(false)
    } else if (demoMode === 'partial') {
      applyMockState('partial')
      setIsLoading(false)
    } else if (demoMode === 'new-user') {
      applyMockState('new-user')
      setIsLoading(false)
    } else if (demoMode === 'error') {
      applyMockState('error')
      setIsLoading(false)
    } else {
      loadDashboardData()
    }
  }, [demoMode, applyMockState, loadDashboardData])

  // ── 1. Greeting & Profile Details ────────────────────────────────────────
  const greeting = useMemo(() => getTimeAwareGreeting(), [])
  const userFirstName = useMemo(() => firstName(user?.name), [user?.name])
  const targetRole = useMemo(() => {
    return dashboard?.profile.target_role || roadmap?.target_role || ''
  }, [dashboard?.profile.target_role, roadmap?.target_role])

  // ── 2. Weighted Readiness Calculation ────────────────────────────────────
  const readiness = useMemo(() => {
    if (!dashboard) {
      return {
        score: 0,
        isProvisional: true,
        missingModules: ['Profile', 'Resume ATS', 'Roadmap', 'Mock Interview'],
        provisionalReason: 'Loading progress metrics...',
        breakdown: {
          profile: { score: 0, weight: 0.15, contribution: 0, isCompleted: false, label: 'Career Profile' },
          resume: { score: 0, weight: 0.3, contribution: 0, isCompleted: false, label: 'Resume ATS' },
          roadmap: { score: 0, weight: 0.3, contribution: 0, isCompleted: false, label: 'Roadmap Tasks' },
          interview: { score: 0, weight: 0.25, contribution: 0, isCompleted: false, label: 'Mock Interview' },
        },
      }
    }

    return calculateReadiness({
      profile: {
        has_profile: dashboard.profile.has_profile,
        completeness: dashboard.profile.completeness,
      },
      resume: {
        has_analysis: dashboard.resume.has_analysis,
        score: dashboard.resume.score,
      },
      roadmap: dashboard.roadmap
        ? {
            has_roadmap: dashboard.roadmap.has_roadmap,
            completion_percentage: dashboard.roadmap.completion_percentage,
          }
        : null,
      interview: dashboard.interview
        ? {
            has_interview: dashboard.interview.has_interview,
            latest_score: dashboard.interview.latest_score,
          }
        : null,
    })
  }, [dashboard])

  const allSkills = useMemo(() => {
    if (!dashboard) return []
    const seen = new Set<string>()
    const skills: { name: string; source: 'profile' | 'resume' | 'verified'; score?: number }[] = []
    const addSkill = (
      name: string,
      source: 'profile' | 'resume' | 'verified',
      score?: number,
    ) => {
      const normalized = name.trim()
      const key = normalized.toLowerCase()
      if (!key || seen.has(key)) return
      seen.add(key)
      skills.push({ name: normalized, source, score })
    }
    for (const skill of dashboard.verified_skills ?? []) {
      addSkill(skill.name, 'verified', skill.score)
    }
    for (const skill of dashboard.resume.skills_detected ?? []) {
      addSkill(skill, 'resume')
    }
    for (const skill of dashboard.profile.skills ?? []) {
      addSkill(skill, 'profile')
    }
    return skills
  }, [dashboard])

  const animatedScore = useCountUp(readiness.score, 800)

  // ── 3. Next Best Action (Single Primary Hero CTA) ────────────────────────
  const heroAction = useMemo(() => {
    if (dashboard?.next_steps && dashboard.next_steps.length > 0) {
      const top = dashboard.next_steps[0]
      // Derive why it matters and estimated time
      let why = 'Complete this key step to advance your career readiness score.'
      let time = '10 min'

      if (top.action.includes('profile')) {
        why = 'Establish your target role and core skills so our AI can tailor recommendations.'
        time = '5 min'
      } else if (top.action.includes('resume')) {
        why = 'Uncover keyword gaps and ATS benchmark issues before applying to target roles.'
        time = '3 min'
      } else if (top.action.includes('gap') || top.action.includes('skill')) {
        why = 'Identify essential technical competencies employers expect for this role.'
        time = '5 min'
      } else if (top.action.includes('roadmap')) {
        why = 'Follow structured weekly milestones designed to bridge missing qualifications.'
        time = '15 min'
      } else if (top.action.includes('interview')) {
        why = 'Validate your interview pacing and technical depth with live AI evaluation.'
        time = '15 min'
      } else if (top.action.includes('mentor')) {
        why = 'Get strategic coaching on interview strategies and career transitions.'
        time = '10 min'
      }

      return {
        label: top.label,
        action: top.action,
        priority: top.priority,
        why,
        time,
      }
    }

    // Fallback if no next_steps returned
    if (!dashboard?.profile.has_profile) {
      return {
        label: 'Create Career Profile',
        action: '/profile',
        priority: 'high' as const,
        why: 'Define your target role and background so AI modules provide tailored guidance.',
        time: '5 min',
      }
    }
    if (!dashboard?.resume.has_analysis) {
      return {
        label: 'Analyze Your Resume',
        action: '/resume',
        priority: 'high' as const,
        why: 'Get an instant ATS score and detect critical missing skills for your dream role.',
        time: '3 min',
      }
    }
    if (!roadmap?.roadmap) {
      return {
        label: 'Generate Learning Roadmap',
        action: '/roadmap',
        priority: 'high' as const,
        why: 'Follow structured weekly milestones designed to bridge missing qualifications.',
        time: '5 min',
      }
    }
    if (!dashboard?.interview?.has_interview) {
      return {
        label: 'Practice Mock Interview',
        action: '/interview',
        priority: 'medium' as const,
        why: 'Validate your interview pacing and technical depth with live AI evaluation.',
        time: '15 min',
      }
    }

    return {
      label: 'Consult AI Career Mentor',
      action: '/mentor',
      priority: 'low' as const,
      why: 'Engage with our career advisor to refine your negotiation and portfolio strategy.',
      time: '10 min',
    }
  }, [dashboard, roadmap])

  // ── 4. Journey Stepper (Slim 6 Nodes) ────────────────────────────────────
  const journeySteps = useMemo(() => {
    if (!dashboard) return []

    const hasProfile = dashboard.profile.has_profile && dashboard.profile.completeness >= 80
    const hasResume = dashboard.resume.has_analysis
    const hasSkillGap = Boolean(skillGap?.analysis || (dashboard.resume.has_analysis && dashboard.resume.skills_count > 0))
    const hasRoadmap = Boolean(roadmap?.roadmap && (dashboard.roadmap?.completion_percentage ?? 0) > 0)
    const hasMentor = Boolean(dashboard.profile.has_profile)
    const hasInterview = Boolean(dashboard.interview?.has_interview)

    const rawSteps = [
      { id: 1, label: 'Profile', to: '/profile', completed: hasProfile },
      { id: 2, label: 'Resume', to: '/resume', completed: hasResume },
      { id: 3, label: 'Skill Gap', to: '/skill-gap', completed: hasSkillGap },
      { id: 4, label: 'Roadmap', to: '/roadmap', completed: hasRoadmap },
      { id: 5, label: 'AI Mentor', to: '/mentor', completed: hasMentor },
      { id: 6, label: 'Interview', to: '/interview', completed: hasInterview },
    ]

    let foundCurrent = false
    return rawSteps.map((s) => {
      if (s.completed) {
        return { ...s, status: 'completed' as const }
      }
      if (!foundCurrent) {
        foundCurrent = true
        return { ...s, status: 'current' as const }
      }
      return { ...s, status: 'upcoming' as const }
    })
  }, [dashboard, roadmap, skillGap])

  const completedStepsCount = useMemo(() => {
    return journeySteps.filter((s) => s.status === 'completed').length
  }, [journeySteps])

  // ── 5. This Week Panel (Roadmap) ─────────────────────────────────────────
  const activePhase = useMemo(() => {
    if (!roadmap?.roadmap?.phases?.length) return null
    return (
      roadmap.roadmap.phases.find((phase) =>
        phase.tasks.some((t) => !roadmap.completed_tasks.includes(t.id))
      ) || roadmap.roadmap.phases[0]
    )
  }, [roadmap])

  const thisWeekTasks = useMemo(() => {
    if (!activePhase) return []
    return activePhase.tasks.slice(0, 4)
  }, [activePhase])

  const weekCompletedCount = useMemo(() => {
    if (!roadmap || !thisWeekTasks.length) return 0
    return thisWeekTasks.filter((t) => roadmap.completed_tasks.includes(t.id)).length
  }, [roadmap, thisWeekTasks])

  const weekProgressPercent = useMemo(() => {
    if (!thisWeekTasks.length) return 0
    return Math.round((weekCompletedCount / thisWeekTasks.length) * 100)
  }, [weekCompletedCount, thisWeekTasks.length])

  const weekPace = useMemo(() => {
    return computePace(weekCompletedCount, thisWeekTasks.length)
  }, [weekCompletedCount, thisWeekTasks.length])

  // Skill verification navigation & task handler
  const handleToggleTask = async (task: RoadmapTask) => {
    if (!roadmap) return
    const isCompleted = roadmap.completed_tasks.includes(task.id)
    if (isCompleted) {
      showToast({
        variant: 'info',
        title: 'Skill Verified',
        message: 'This task has been verified through a passed skill assessment.',
      })
      return
    }
    showToast({
      variant: 'info',
      title: 'Skill Assessment Required',
      message: 'Pass the roadmap skill assessment to complete this task.',
    })
    navigate('/roadmap')
  }

  // ── 6. Skills Snapshot (Top 5 Missing Skills) ─────────────────────────────
  const topMissingSkills = useMemo(() => {
    if (!skillGap?.analysis) return []
    const tech = (skillGap.analysis.missing_technical_skills || []).map((name) => ({
      name,
      importance: 'High Priority' as const,
      variant: 'brand' as const,
    }))
    const soft = (skillGap.analysis.missing_soft_skills || []).map((name) => ({
      name,
      importance: 'Soft Skill' as const,
      variant: 'neutral' as const,
    }))
    return [...tech, ...soft].slice(0, 5)
  }, [skillGap])

  // ── 7. Resume Summary Improvements ───────────────────────────────────────
  const resumeImprovements = useMemo(() => {
    if (!dashboard?.resume?.improvements) return []
    return dashboard.resume.improvements.slice(0, 2)
  }, [dashboard])

  // ── 8. Recent Activity (Omitted if no real activity exists) ──────────────
  const recentActivities = useMemo(() => {
    const list: Array<{
      id: string
      title: string
      detail: string
      date: string
      icon: typeof FileText
      to: string
    }> = []

    if (dashboard?.resume?.has_analysis && dashboard.resume.analyzed_at) {
      list.push({
        id: 'resume-act',
        title: 'Resume Analyzed',
        detail: `ATS score ${dashboard.resume.score}/100 with ${dashboard.resume.skills_count} detected skills.`,
        date: new Date(dashboard.resume.analyzed_at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        }),
        icon: FileText,
        to: '/resume',
      })
    }

    if (interview && (interview.completed_at || interview.created_at)) {
      const dt = interview.completed_at || interview.created_at
      list.push({
        id: 'interview-act',
        title: 'Mock Interview Finished',
        detail: `Scored ${dashboard?.interview?.latest_score ?? 0}/100 on ${interview.target_role || 'role'} simulation.`,
        date: new Date(dt).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        }),
        icon: Video,
        to: '/interview',
      })
    }

    if (roadmap?.created_at) {
      list.push({
        id: 'roadmap-act',
        title: 'Roadmap Generated',
        detail: `${roadmap.target_role || 'Career'} curriculum with ${roadmap.completed_tasks.length} tasks completed.`,
        date: new Date(roadmap.created_at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        }),
        icon: Map,
        to: '/roadmap',
      })
    }

    return list.slice(0, 3)
  }, [dashboard, interview, roadmap])

  // ── Loading Skeleton (Matches Final Layout) ──────────────────────────────
  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-5 space-y-4">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton variant="text" width={220} height={28} />
            <Skeleton variant="text" width={140} height={18} />
          </div>
          <Skeleton variant="rectangular" width={88} height={32} />
        </div>

        {/* Hero & Readiness Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7">
            <Skeleton variant="card" className="h-[188px]" />
          </div>
          <div className="lg:col-span-5">
            <Skeleton variant="card" className="h-[188px]" />
          </div>
        </div>

        {/* Stepper Skeleton */}
        <Skeleton variant="rectangular" className="h-12 w-full rounded-xl" />

        {/* 3-Column Bottom Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5">
            <Skeleton variant="card" className="h-[250px]" />
          </div>
          <div className="lg:col-span-4">
            <Skeleton variant="card" className="h-[250px]" />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <Skeleton variant="card" className="h-[250px]" />
          </div>
        </div>
      </div>
    )
  }

  // ── Error State (Graceful Retry) ─────────────────────────────────────────
  if (error || !dashboard) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-8 text-center max-w-md mx-auto shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-rose-700 mb-3">
            <CircleAlert className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Unable to load dashboard</h2>
          <p className="mt-1 text-xs text-rose-800 leading-relaxed">
            {error || 'An unexpected error occurred while communicating with CareerPilot services.'}
          </p>
          <div className="flex items-center justify-center gap-2 mt-5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => loadDashboardData(false)}
              className="bg-white border-rose-200 text-rose-900 hover:bg-rose-50"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Try again
            </Button>
          </div>

          {import.meta.env.DEV && (
            <div className="mt-5 pt-4 border-t border-rose-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-950 block mb-2">
                Dev Mode: Preview Mock Scenarios
              </span>
              <div className="flex items-center justify-center flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSearchParams({ demo: 'full' })
                    applyMockState('full')
                  }}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                >
                  Full Data
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchParams({ demo: 'partial' })
                    applyMockState('partial')
                  }}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                >
                  Partial Data
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchParams({ demo: 'new-user' })
                    applyMockState('new-user')
                  }}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                >
                  New User
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Semantic tier for score coloring
  const scoreTier = getProgressTier(readiness.score)
  const tierColorClass =
    scoreTier === 'success'
      ? 'text-emerald-700'
      : scoreTier === 'warning'
      ? 'text-amber-700'
      : 'text-rose-700'

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-4 space-y-4">
      {/* ── 1. Greeting Header (No explanatory paragraph, Target role pill) ── */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-1">
        <div className="flex items-center flex-wrap gap-2.5">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            {greeting}, {userFirstName}
          </h1>
          {targetRole ? (
            <Badge variant="brand" size="sm" dot>
              {targetRole}
            </Badge>
          ) : (
            <Badge variant="neutral" size="sm">
              Role not set
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {import.meta.env.DEV && (
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100/70 p-0.5 text-[11px] font-semibold text-slate-600">
              <span className="px-1.5 text-slate-400">Mock:</span>
              <button
                type="button"
                onClick={() => {
                  setSearchParams({ demo: 'full' })
                  applyMockState('full')
                }}
                className={`rounded px-1.5 py-0.5 transition ${
                  demoMode === 'full' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
                }`}
              >
                Full
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchParams({ demo: 'partial' })
                  applyMockState('partial')
                }}
                className={`rounded px-1.5 py-0.5 transition ${
                  demoMode === 'partial' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
                }`}
              >
                Partial
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchParams({ demo: 'new-user' })
                  applyMockState('new-user')
                }}
                className={`rounded px-1.5 py-0.5 transition ${
                  demoMode === 'new-user' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
                }`}
              >
                New
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchParams({ demo: 'error' })
                  applyMockState('error')
                }}
                className={`rounded px-1.5 py-0.5 transition ${
                  demoMode === 'error' ? 'bg-rose-100 text-rose-900 shadow-2xs' : 'hover:text-rose-900'
                }`}
              >
                Error
              </button>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadDashboardData(true)}
            disabled={isRefreshing}
            aria-label="Refresh dashboard data"
            className="text-xs text-slate-600 hover:text-slate-900 h-8 px-2.5"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 mr-1.5 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </header>

      {/* ── 2 & 3. Hero CTA & Readiness Hub Grid (Above fold 1440x900) ─────── */}
      <section
        aria-label="Overview and Next Action"
        className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch"
      >
        {/* ── 2. HERO: Next Best Action Card (Single primary CTA) ────────── */}
        <Card
          variant="default"
          className="lg:col-span-7 flex flex-col justify-between p-5 border-brand-200/80 bg-gradient-to-br from-white via-brand-50/20 to-white shadow-card"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-700">
                <Sparkles className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
                Next Best Action
              </span>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                  <Clock className="h-3 w-3 text-slate-400" aria-hidden="true" />
                  ~{heroAction.time}
                </span>
                <Badge
                  variant={
                    heroAction.priority === 'high'
                      ? 'danger'
                      : heroAction.priority === 'medium'
                      ? 'warning'
                      : 'info'
                  }
                  size="sm"
                >
                  {heroAction.priority} priority
                </Badge>
              </div>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              {heroAction.label}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xl">
              {heroAction.why}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <Link
              to={heroAction.action}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-brand-700 active:scale-[0.99] transition"
            >
              <span>Start Now</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>

            {dashboard.next_steps.length > 1 && (
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="text-xs font-semibold text-brand-700 hover:text-brand-900 underline-offset-4 hover:underline transition py-1 px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
              >
                See all steps ({dashboard.next_steps.length})
              </button>
            )}
          </div>
        </Card>

        {/* ── 3. READINESS HUB: ProgressRing + Breakdown Legend ──────────── */}
        <Card
          variant="default"
          className="lg:col-span-5 flex flex-col justify-between p-5 shadow-card"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-slate-700" aria-hidden="true" />
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                  Career Readiness
                </h2>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Multi-factor score based on 4 pillars.
              </p>
            </div>

            {readiness.isProvisional ? (
              <Tooltip content={readiness.provisionalReason} position="left">
                <span
                  tabIndex={0}
                  className="inline-flex items-center gap-1 cursor-help rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200"
                  aria-label={`Provisional score: ${readiness.provisionalReason}`}
                >
                  <HelpCircle className="h-3 w-3 text-amber-600" aria-hidden="true" />
                  Provisional
                </span>
              </Tooltip>
            ) : (
              <Badge variant="success" size="sm" dot>
                Verified
              </Badge>
            )}
          </div>

          {/* Ring + Breakdown */}
          <div className="mt-3 flex items-center gap-5">
            <div className="shrink-0 flex flex-col items-center">
              <ProgressRing
                value={animatedScore}
                size={88}
                strokeWidth={8}
                variant="automatic"
                showValue={false}
                aria-label={`Career readiness score: ${readiness.score} percent, ${scoreTier} tier`}
              />
              <div className="mt-[-60px] mb-[22px] flex flex-col items-center pointer-events-none">
                <span className={`text-xl font-extrabold tabular-nums tracking-tight ${tierColorClass}`}>
                  {animatedScore}%
                </span>
                <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400">
                  Readiness
                </span>
              </div>
            </div>

            {/* Breakdown Legend (Replaces old duplicate cards) */}
            <div className="flex-1 space-y-1.5 text-xs">
              {/* Profile */}
              <Link
                to="/profile"
                className="group flex items-center justify-between rounded-md p-1 hover:bg-slate-50 transition"
                aria-label={`Profile: ${readiness.breakdown.profile.score}%, contributes 15% weight`}
              >
                <div className="flex items-center gap-1.5 w-24">
                  <span className="text-[11px] font-medium text-slate-700 group-hover:text-brand-700 transition">
                    Profile
                  </span>
                  <span className="text-[10px] text-slate-400">15%</span>
                </div>
                <div className="flex-1 mx-2">
                  <ProgressBar
                    value={readiness.breakdown.profile.score}
                    size="sm"
                    variant={readiness.breakdown.profile.isCompleted ? 'success' : 'warning'}
                    aria-hidden="true"
                  />
                </div>
                <span className="text-[11px] font-semibold tabular-nums text-slate-700 group-hover:text-slate-900 w-8 text-right">
                  {readiness.breakdown.profile.score}%
                </span>
              </Link>

              {/* Resume ATS */}
              <Link
                to="/resume"
                className="group flex items-center justify-between rounded-md p-1 hover:bg-slate-50 transition"
                aria-label={`Resume ATS: ${dashboard.resume.has_analysis ? `${dashboard.resume.score}%` : 'Pending'}, contributes 30% weight`}
              >
                <div className="flex items-center gap-1.5 w-24">
                  <span className="text-[11px] font-medium text-slate-700 group-hover:text-brand-700 transition">
                    Resume ATS
                  </span>
                  <span className="text-[10px] text-slate-400">30%</span>
                </div>
                <div className="flex-1 mx-2">
                  <ProgressBar
                    value={readiness.breakdown.resume.score}
                    size="sm"
                    variant={dashboard.resume.has_analysis ? 'automatic' : 'danger'}
                    aria-hidden="true"
                  />
                </div>
                <span className="text-[11px] font-semibold tabular-nums text-slate-700 group-hover:text-slate-900 w-8 text-right">
                  {dashboard.resume.has_analysis ? `${dashboard.resume.score}%` : '—'}
                </span>
              </Link>

              {/* Roadmap */}
              <Link
                to="/roadmap"
                className="group flex items-center justify-between rounded-md p-1 hover:bg-slate-50 transition"
                aria-label={`Roadmap: ${dashboard.roadmap?.has_roadmap ? `${dashboard.roadmap.completion_percentage}%` : '0%'}, contributes 30% weight`}
              >
                <div className="flex items-center gap-1.5 w-24">
                  <span className="text-[11px] font-medium text-slate-700 group-hover:text-brand-700 transition">
                    Roadmap
                  </span>
                  <span className="text-[10px] text-slate-400">30%</span>
                </div>
                <div className="flex-1 mx-2">
                  <ProgressBar
                    value={readiness.breakdown.roadmap.score}
                    size="sm"
                    variant={dashboard.roadmap?.has_roadmap ? 'automatic' : 'danger'}
                    aria-hidden="true"
                  />
                </div>
                <span className="text-[11px] font-semibold tabular-nums text-slate-700 group-hover:text-slate-900 w-8 text-right">
                  {dashboard.roadmap?.has_roadmap ? `${dashboard.roadmap.completion_percentage}%` : '—'}
                </span>
              </Link>

              {/* Mock Interview */}
              <Link
                to="/interview"
                className="group flex items-center justify-between rounded-md p-1 hover:bg-slate-50 transition"
                aria-label={`Mock Interview: ${dashboard.interview?.has_interview ? `${dashboard.interview.latest_score}%` : 'Untested'}, contributes 25% weight`}
              >
                <div className="flex items-center gap-1.5 w-24">
                  <span className="text-[11px] font-medium text-slate-700 group-hover:text-brand-700 transition">
                    Interview
                  </span>
                  <span className="text-[10px] text-slate-400">25%</span>
                </div>
                <div className="flex-1 mx-2">
                  <ProgressBar
                    value={readiness.breakdown.interview.score}
                    size="sm"
                    variant={dashboard.interview?.has_interview ? 'automatic' : 'danger'}
                    aria-hidden="true"
                  />
                </div>
                <span className="text-[11px] font-semibold tabular-nums text-slate-700 group-hover:text-slate-900 w-8 text-right">
                  {dashboard.interview?.has_interview ? `${dashboard.interview.latest_score}%` : '—'}
                </span>
              </Link>
            </div>
          </div>
        </Card>
      </section>

      {/* ── 4. JOURNEY STEPPER (Slim Horizontal 6-Node Stepper) ───────────── */}
      <section
        aria-label="Career Journey Progression"
        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-card"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-900">Career Preparation Flow</span>
          <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
            {completedStepsCount} of 6 completed
          </span>
        </div>

        <nav aria-label="Progress Stepper" className="overflow-x-auto no-scrollbar">
          <ol className="flex items-center justify-between min-w-[560px] gap-2">
            {journeySteps.map((step, idx) => {
              const isCompleted = step.status === 'completed'
              const isCurrent = step.status === 'current'

              return (
                <li key={step.id} className="flex-1 flex items-center">
                  <Link
                    to={step.to}
                    className="flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded p-1"
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    {/* Node Icon/Number */}
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition ${
                        isCompleted
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : isCurrent
                          ? 'bg-brand-600 text-white ring-2 ring-brand-200 ring-offset-1'
                          : 'bg-slate-100 text-slate-500 border border-slate-200 group-hover:bg-slate-200'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="h-3.5 w-3.5 stroke-[2.5]" aria-hidden="true" />
                      ) : (
                        step.id
                      )}
                    </span>

                    {/* Step Title */}
                    <span
                      className={`text-xs font-medium whitespace-nowrap transition ${
                        isCompleted
                          ? 'text-slate-800'
                          : isCurrent
                          ? 'font-bold text-brand-700'
                          : 'text-slate-500 group-hover:text-slate-700'
                      }`}
                    >
                      {step.label}
                    </span>
                  </Link>

                  {/* Connecting Line between nodes */}
                  {idx < journeySteps.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 mx-2 transition-colors ${
                        isCompleted ? 'bg-emerald-400' : 'bg-slate-200'
                      }`}
                      aria-hidden="true"
                    />
                  )}
                </li>
              )
            })}
          </ol>
        </nav>
      </section>

      {/* ── 5, 6 & 7. 3-Column Content Row (Equal Height, No Empty Gap) ────── */}
      <section
        aria-label="Actionable Modules"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-stretch"
      >
        {/* ── 5. "This Week" Panel (Roadmap Tasks with Optimistic Toggle) ── */}
        <Card
          variant="default"
          className="lg:col-span-5 flex flex-col justify-between p-4 shadow-card"
        >
          <div>
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Map className="h-4 w-4 text-brand-600" aria-hidden="true" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                  This Week's Focus
                </h3>
              </div>
              <Badge variant={weekPace.badgeVariant} size="sm">
                {weekPace.label}
              </Badge>
            </div>

            {roadmap?.roadmap ? (
              <div className="mt-3 space-y-3">
                {/* Week Title & Progress */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-800 truncate max-w-[200px]">
                      {activePhase?.name || 'Week Milestones'}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500">
                      {weekCompletedCount} of {thisWeekTasks.length} tasks
                    </span>
                  </div>
                  <ProgressBar
                    value={weekProgressPercent}
                    size="sm"
                    variant={weekProgressPercent >= 70 ? 'success' : 'brand'}
                    aria-label={`Weekly progress: ${weekProgressPercent} percent`}
                  />
                </div>

                {/* Task List with Skill-Verification Action */}
                <div className="space-y-2 pt-1">
                  {thisWeekTasks.map((task) => {
                    const isDone = roadmap.completed_tasks.includes(task.id)

                    return (
                      <div
                        key={task.id}
                        onClick={() => handleToggleTask(task)}
                        className={`flex items-center justify-between gap-2.5 rounded-lg border p-2.5 cursor-pointer transition ${
                          isDone
                            ? 'bg-slate-50 border-slate-200 opacity-80'
                            : 'bg-white border-slate-200/90 hover:border-brand-300 hover:bg-brand-50/20'
                        }`}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            e.preventDefault()
                            handleToggleTask(task)
                          }
                        }}
                      >
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <div
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                              isDone
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isDone && <Check className="h-3 w-3 stroke-[2.5]" aria-hidden="true" />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-xs font-medium leading-snug line-clamp-1 ${
                                isDone ? 'text-slate-400 line-through' : 'text-slate-800'
                              }`}
                            >
                              {task.title}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                              <span>{task.skill || 'Skill Target'}</span>
                              <span>•</span>
                              <span>{task.estimated_hours}h</span>
                            </div>
                          </div>
                        </div>

                        {isDone ? (
                          <span className="shrink-0 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Verified
                          </span>
                        ) : (
                          <span className="shrink-0 inline-flex items-center gap-1 rounded bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white hover:bg-slate-700 transition">
                            Test Skill <ArrowRight className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="py-4">
                <EmptyState
                  icon={<Map className="h-5 w-5 text-brand-600" aria-hidden="true" />}
                  title="No Active Roadmap"
                  description="Generate a week-by-week learning plan tailored to your skill gaps."
                  action={
                    <Link
                      to="/roadmap"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-brand-700 transition"
                    >
                      Generate Roadmap
                    </Link>
                  }
                  className="p-4 sm:p-6"
                />
              </div>
            )}
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100">
            <Link
              to="/roadmap"
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900 transition"
            >
              <span>{roadmap?.roadmap ? 'View Full Roadmap' : 'Explore Roadmaps'}</span>
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
        </Card>

        {/* ── 6. Skills Snapshot Panel (Top 5 Missing Skills from Skill Gap) ─ */}
        <Card
          variant="default"
          className="lg:col-span-4 flex flex-col justify-between p-4 shadow-card"
        >
          <div>
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-brand-600" aria-hidden="true" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                  Skill Gaps
                </h3>
              </div>
              <Link
                to="/skill-gap"
                className="text-xs font-medium text-brand-700 hover:text-brand-900 transition"
              >
                View all
              </Link>
            </div>

            {topMissingSkills.length > 0 ? (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] text-slate-500">
                  Top competencies to develop for {targetRole || 'your target role'}:
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {topMissingSkills.map((s) => (
                    <span
                      key={s.name}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1 text-xs font-medium text-slate-800 hover:border-brand-300 transition"
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          s.variant === 'brand' ? 'bg-rose-500' : 'bg-amber-500'
                        }`}
                        aria-hidden="true"
                      />
                      <span>{s.name}</span>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400">
                        {s.importance}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-4">
                <EmptyState
                  icon={<Target className="h-5 w-5 text-brand-600" aria-hidden="true" />}
                  title="No Skill Gap Analysis"
                  description="Analyze your resume against your target role to spot missing skills."
                  action={
                    <Link
                      to="/skill-gap"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                    >
                      Run Analysis
                    </Link>
                  }
                  className="p-4 sm:p-6"
                />
              </div>
            )}
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100">
            <Link
              to="/skill-gap"
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900 transition"
            >
              <span>Bridge Your Skills</span>
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
        </Card>

        {/* ── 7. Resume Summary Card (Compact, Equal Height, No Gap) ─────── */}
        <Card
          variant="default"
          className="sm:col-span-2 lg:col-span-3 flex flex-col justify-between p-4 shadow-card"
        >
          <div>
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-brand-600" aria-hidden="true" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                  ATS Resume
                </h3>
              </div>
              {dashboard.resume.has_analysis && (
                <Badge
                  variant={
                    dashboard.resume.score >= 70
                      ? 'success'
                      : dashboard.resume.score >= 40
                      ? 'warning'
                      : 'danger'
                  }
                  size="sm"
                >
                  {dashboard.resume.score >= 70
                    ? 'Job Ready'
                    : dashboard.resume.score >= 40
                    ? 'In Progress'
                    : 'Needs Polish'}
                </Badge>
              )}
            </div>

            {dashboard.resume.has_analysis ? (
              <div className="mt-3 space-y-3">
                {/* ATS Score Row */}
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border font-extrabold text-base ${
                      dashboard.resume.score >= 70
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : dashboard.resume.score >= 40
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    {dashboard.resume.score}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      {dashboard.resume.score >= 70 ? 'Strong Alignment' : 'Optimization Needed'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {dashboard.resume.skills_count} skills detected
                    </p>
                  </div>
                </div>

                {/* Top 2 Improvements */}
                {resumeImprovements.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      Top Recommendations:
                    </span>
                    <ul className="space-y-1 text-xs text-slate-600">
                      {resumeImprovements.map((imp, i) => (
                        <li key={i} className="flex items-start gap-1.5 line-clamp-2">
                          <span className="text-brand-600 font-bold">•</span>
                          <span className="leading-snug text-[11px]">{imp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-4">
                <EmptyState
                  icon={<FileText className="h-5 w-5 text-brand-600" aria-hidden="true" />}
                  title="No Resume Uploaded"
                  description="Upload your resume to check ATS keyword density and formatting."
                  action={
                    <Link
                      to="/resume"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                    >
                      Upload Resume
                    </Link>
                  }
                  className="p-4 sm:p-6"
                />
              </div>
            )}
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100">
            <Link
              to="/resume"
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900 transition"
            >
              <span>{dashboard.resume.has_analysis ? 'Open Analysis' : 'Upload Resume'}</span>
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
        </Card>
      </section>

      <section aria-label="Learning tracker and skills" className="grid gap-5 lg:grid-cols-3">
        <Card variant="default" className="lg:col-span-2 p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Skills inventory</h3>
              <p className="text-xs text-slate-500">
                Skills from your profile, resume, and completed assessments.
              </p>
            </div>
            <Badge variant="neutral" size="sm">{allSkills.length} total</Badge>
          </div>
          {allSkills.length ? (
            <div className="flex flex-wrap gap-1.5">
              {allSkills.map((skill) => (
                <span
                  key={skill.name}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                    skill.source === 'verified'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : skill.source === 'resume'
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-800'
                        : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  {skill.source === 'verified' ? `✓ ${skill.name} · ${skill.score}%` : skill.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-xs text-slate-500">
              Add skills in your profile or upload a resume to build your inventory.
            </p>
          )}
        </Card>

        <Card variant="default" className="flex flex-col justify-between p-5 shadow-card">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-brand-600" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-slate-900">Learning consistency</h3>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Mark each day you study, track time spent, and get an in-app reminder after missed days.
            </p>
          </div>
          <Link
            to="/calendar"
            className="mt-4 inline-flex min-h-10 items-center justify-between gap-2 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white transition hover:bg-brand-700"
          >
            Open learning calendar
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </Card>
      </section>

      {/* ── 8. Recent Activity (Only shown if genuine activity exists) ──────── */}
      {recentActivities.length > 0 && (
        <section
          aria-label="Recent Account Activity"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-card"
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-900">Recent Milestones</span>
            <span className="text-[11px] text-slate-500">Live event log</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {recentActivities.map((act) => {
              const Icon = act.icon
              return (
                <Link
                  key={act.id}
                  to={act.to}
                  className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 hover:border-brand-200 hover:bg-brand-50/20 transition group"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white border border-slate-200 text-slate-700 group-hover:text-brand-600 transition shadow-2xs">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-brand-700 transition truncate">
                        {act.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 shrink-0">{act.date}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                      {act.detail}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Progressive Disclosure Drawer: All Steps ───────────────────────── */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="All Recommended Steps"
        position="right"
      >
        <div className="space-y-3 pt-2">
          <p className="text-xs text-slate-600 leading-relaxed">
            Prioritized actions generated by CareerPilot AI to optimize your preparation roadmap:
          </p>

          <div className="space-y-2.5 mt-3">
            {dashboard.next_steps.map((step, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs flex flex-col justify-between gap-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                        {i + 1}
                      </span>
                      <h4 className="text-xs font-bold text-slate-900">{step.label}</h4>
                    </div>
                  </div>
                  <Badge
                    variant={
                      step.priority === 'high'
                        ? 'danger'
                        : step.priority === 'medium'
                        ? 'warning'
                        : 'neutral'
                    }
                    size="sm"
                  >
                    {step.priority}
                  </Badge>
                </div>

                <div className="flex items-center justify-end pt-1">
                  <Link
                    to={step.action}
                    onClick={() => setIsDrawerOpen(false)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                  >
                    <span>Take Action</span>
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Drawer>
    </div>
  )
}
