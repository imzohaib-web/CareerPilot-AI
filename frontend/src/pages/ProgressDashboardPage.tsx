import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  User,
  FileText,
  Map,
  Video,
  Target,
  CheckCircle2,
  CircleAlert,
  TrendingUp,
  RefreshCw,
  MessageSquare,
  ChevronRight,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { describeApiError } from '../services/apiClient'
import * as progressService from '../services/progress'
import type { DashboardResponse } from '../types'

// ── Helpers ──────────────────────────────────────────────────────────────

function scoreBadgeClass(score: number): string {
  if (score >= 75) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (score >= 50) return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-rose-50 text-rose-700 border-rose-200'
}

function scoreTextColor(score: number): string {
  if (score >= 75) return 'text-emerald-700'
  if (score >= 50) return 'text-amber-700'
  return 'text-rose-700'
}

function progressBarColor(score: number): string {
  if (score >= 75) return 'bg-emerald-500'
  if (score >= 50) return 'bg-amber-500'
  return 'bg-rose-500'
}

function experienceLabel(level: string): string {
  const map: Record<string, string> = {
    student: 'Student',
    'fresh-graduate': 'Fresh Graduate',
    'early-career': 'Early Career',
  }
  return map[level] ?? level
}

// ── Main Dashboard Page ──────────────────────────────────────────────────

export function ProgressDashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await progressService.fetchDashboard()
      setData(result)
    } catch (err) {
      setError(describeApiError(err).message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  // Deduplicated skills from profile + resume
  const allSkills = useMemo(() => {
    if (!data) return []
    const profileSkills = data.profile.skills ?? []
    const resumeSkills = data.resume.skills_detected ?? []
    const seen = new Set<string>()
    const result: { name: string; source: 'profile' | 'resume' }[] = []

    for (const s of profileSkills) {
      const key = s.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        result.push({ name: s, source: 'profile' })
      }
    }
    for (const s of resumeSkills) {
      const key = s.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        result.push({ name: s, source: 'resume' })
      }
    }
    return result
  }, [data])

  // Determine top next action
  const topAction = useMemo(() => {
    if (!data) return { to: '/profile', label: 'Complete profile' }
    if (!data.profile.has_profile) return { to: '/profile', label: 'Create Career Profile' }
    if (!data.resume.has_analysis) return { to: '/resume', label: 'Analyze Resume' }
    if (!data.roadmap?.has_roadmap) return { to: '/roadmap', label: 'Generate Roadmap' }
    if (!data.interview?.has_interview) return { to: '/interview', label: 'Start Mock Interview' }
    return { to: '/mentor', label: 'Consult Career Mentor' }
  }, [data])

  // ── Loading Skeleton ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="h-20 rounded-xl bg-slate-200/60 animate-pulse" />
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 h-44 rounded-xl bg-slate-200/60 animate-pulse" />
          <div className="h-44 rounded-xl bg-slate-200/60 animate-pulse" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="h-40 rounded-xl bg-slate-200/60 animate-pulse" />
          <div className="h-40 rounded-xl bg-slate-200/60 animate-pulse" />
          <div className="h-40 rounded-xl bg-slate-200/60 animate-pulse" />
          <div className="h-40 rounded-xl bg-slate-200/60 animate-pulse" />
        </div>
      </div>
    )
  }

  // ── Error State ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-6 text-center max-w-md mx-auto">
          <CircleAlert className="mx-auto h-8 w-8 text-rose-500 mb-2" />
          <h2 className="text-sm font-semibold text-slate-900">Failed to load Dashboard</h2>
          <p className="mt-1 text-xs text-rose-700">{error}</p>
          <button
            type="button"
            onClick={loadDashboard}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-xs hover:bg-rose-50 transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { profile, resume, roadmap, interview, overall_progress, readiness_score, next_steps } = data

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ── 1. Header Overview ────────────────────────────────────────── */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Welcome back, {user?.name ?? 'Candidate'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {profile.target_role ? (
              <>Target role: <span className="font-semibold text-slate-800">{profile.target_role}</span>. Here is your current readiness overview and recommended next steps.</>
            ) : (
              'Complete your profile and upload your resume to generate your custom career roadmap.'
            )}
          </p>
        </div>

        <Link
          to={topAction.to}
          className="btn-primary self-start sm:self-auto text-xs py-2 px-3.5"
        >
          <span>{topAction.label}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>

      {/* ── 2. Career Readiness Summary ─────────────────────────────────── */}
      <section className="grid gap-5 lg:grid-cols-3">
        {/* Main Readiness Gauge */}
        <div className="lg:col-span-2 clean-card p-5 sm:p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-slate-700" />
                <h2 className="text-sm font-semibold text-slate-900">Career Readiness Score</h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Weighted calculation across profile depth, ATS resume match, and interview performance.
              </p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold text-slate-900">{overall_progress}%</span>
              <span className="block text-[10px] uppercase font-medium text-slate-400">Overall</span>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium text-slate-600">
                <span>Progress toward job readiness</span>
                <span>{overall_progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${progressBarColor(
                    overall_progress
                  )}`}
                  style={{ width: `${Math.max(overall_progress, 4)}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <span className="text-[11px] font-medium text-slate-500">Profile</span>
                <p className="text-base font-bold text-slate-900 mt-0.5">{profile.completeness}%</p>
                <span className="text-[10px] text-slate-400">
                  {profile.has_profile ? 'Configured' : 'Incomplete'}
                </span>
              </div>

              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <span className="text-[11px] font-medium text-slate-500">Resume ATS</span>
                <p className={`text-base font-bold mt-0.5 ${resume.has_analysis ? scoreTextColor(resume.score) : 'text-slate-400'}`}>
                  {resume.has_analysis ? `${resume.score}/100` : '—'}
                </p>
                <span className="text-[10px] text-slate-400">
                  {resume.has_analysis ? 'Analyzed' : 'Pending'}
                </span>
              </div>

              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <span className="text-[11px] font-medium text-slate-500">Interview</span>
                <p className={`text-base font-bold mt-0.5 ${interview?.has_interview ? scoreTextColor(interview.latest_score) : 'text-slate-400'}`}>
                  {interview?.has_interview ? `${interview.latest_score}/100` : '—'}
                </p>
                <span className="text-[10px] text-slate-400">
                  {interview?.has_interview ? `${interview.total_interviews} runs` : 'Not tested'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ATS Resume Snapshot */}
        <div className="clean-card p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Resume ATS Status
              </span>
              {resume.has_analysis && (
                <span className={`rounded px-2 py-0.5 text-[10px] font-semibold border ${scoreBadgeClass(resume.score)}`}>
                  {resume.score >= 75 ? 'Job-Ready' : resume.score >= 50 ? 'Moderate' : 'Needs Polish'}
                </span>
              )}
            </div>

            {resume.has_analysis ? (
              <div className="mt-3 flex items-center gap-3">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border font-bold text-lg ${scoreBadgeClass(resume.score)}`}>
                  {readiness_score}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900">
                    {resume.score >= 75 ? 'Strong Match' : 'Optimization Recommended'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {resume.skills_count} skills · {resume.improvements_count} improvements
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-lg bg-slate-50 border border-slate-100 p-3">
                <p className="text-xs text-slate-600">
                  Upload your CV to calculate your ATS match and benchmark against roles.
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <Link
              to="/resume"
              className="flex items-center justify-between text-xs font-medium text-slate-700 hover:text-slate-900 transition"
            >
              <span>{resume.has_analysis ? 'View resume breakdown' : 'Upload resume'}</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 3. Career Progression Pipeline ─────────────────────────────── */}
      <section className="clean-card p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Career Acceleration Sequence</h2>
            <p className="text-xs text-slate-500">
              Structured step-by-step path from profile setup to final mock interview.
            </p>
          </div>
          <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 hidden sm:inline">
            Step {profile.has_profile ? (resume.has_analysis ? (roadmap?.has_roadmap ? '4 of 6' : '3 of 6') : '2 of 6') : '1 of 6'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <JourneyStep
            step={1}
            title="Profile"
            status={profile.has_profile ? 'completed' : 'active'}
            to="/profile"
            icon={User}
          />
          <JourneyStep
            step={2}
            title="Resume"
            status={resume.has_analysis ? 'completed' : profile.has_profile ? 'active' : 'upcoming'}
            to="/resume"
            icon={FileText}
          />
          <JourneyStep
            step={3}
            title="Skill Gap"
            status={resume.has_analysis ? 'completed' : 'upcoming'}
            to="/skill-gap"
            icon={Target}
          />
          <JourneyStep
            step={4}
            title="Roadmap"
            status={roadmap?.has_roadmap ? 'completed' : 'upcoming'}
            to="/roadmap"
            icon={Map}
          />
          <JourneyStep
            step={5}
            title="AI Mentor"
            status={profile.has_profile ? 'active' : 'upcoming'}
            to="/mentor"
            icon={MessageSquare}
          />
          <JourneyStep
            step={6}
            title="Interview"
            status={interview?.has_interview ? 'completed' : 'upcoming'}
            to="/interview"
            icon={Video}
          />
        </div>
      </section>

      {/* ── 4. Core Module Status Cards ─────────────────────────────────── */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Profile Card */}
        <ModuleCard
          icon={User}
          title="Profile"
          badge={profile.has_profile ? `${profile.completeness}%` : 'Incomplete'}
          badgeColor={profile.has_profile ? 'emerald' : 'amber'}
        >
          {profile.has_profile ? (
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span className="text-slate-400">Target Role:</span>
                <span className="font-medium text-slate-800 truncate max-w-[120px]">{profile.target_role || 'Not specified'}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="text-slate-400">Level:</span>
                <span className="text-slate-700">{experienceLabel(profile.experience_level || 'student')}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="text-slate-400">Skills:</span>
                <span className="text-slate-700">{profile.skills_count}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Set up your education and career goals for personalized recommendations.
            </p>
          )}
          <Link
            to="/profile"
            className="mt-3.5 inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 transition"
          >
            <span>{profile.has_profile ? 'Edit profile' : 'Set up profile'}</span>
            <ChevronRight className="h-3 w-3 text-slate-400" />
          </Link>
        </ModuleCard>

        {/* Resume Card */}
        <ModuleCard
          icon={FileText}
          title="Resume Analyzer"
          badge={resume.has_analysis ? `Score ${resume.score}` : 'Pending'}
          badgeColor={resume.has_analysis ? (resume.score >= 75 ? 'emerald' : 'amber') : 'slate'}
        >
          {resume.has_analysis ? (
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span className="text-slate-400">Detected:</span>
                <span className="font-medium text-slate-800">{resume.skills_count} skills</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="text-slate-400">Improvements:</span>
                <span className="text-slate-700">{resume.improvements_count} suggestions</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="text-slate-400">Analyses:</span>
                <span className="text-slate-700">{resume.total_analyses}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Upload PDF to extract skills and receive ATS optimization suggestions.
            </p>
          )}
          <Link
            to="/resume"
            className="mt-3.5 inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 transition"
          >
            <span>{resume.has_analysis ? 'View analysis' : 'Upload resume'}</span>
            <ChevronRight className="h-3 w-3 text-slate-400" />
          </Link>
        </ModuleCard>

        {/* Roadmap Card */}
        <ModuleCard
          icon={Map}
          title="Learning Roadmap"
          badge={roadmap?.has_roadmap ? `${roadmap.completion_percentage}%` : 'Not Started'}
          badgeColor={roadmap?.has_roadmap ? 'emerald' : 'slate'}
        >
          {roadmap?.has_roadmap ? (
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span className="text-slate-400">Progress:</span>
                <span className="font-medium text-slate-800">
                  {roadmap.completed_tasks_count} / {roadmap.total_tasks} tasks
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-slate-900 transition-all duration-300"
                  style={{ width: `${roadmap.completion_percentage}%` }}
                />
              </div>
              <div className="flex justify-between text-slate-600 pt-0.5">
                <span className="text-slate-400">Target:</span>
                <span className="text-slate-700 truncate max-w-[110px]">{roadmap.target_role}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Generate weekly milestone tasks tailored to fill your identified skill gaps.
            </p>
          )}
          <Link
            to="/roadmap"
            className="mt-3.5 inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 transition"
          >
            <span>{roadmap?.has_roadmap ? 'Continue roadmap' : 'Generate roadmap'}</span>
            <ChevronRight className="h-3 w-3 text-slate-400" />
          </Link>
        </ModuleCard>

        {/* Mock Interview Card */}
        <ModuleCard
          icon={Video}
          title="Mock Interview"
          badge={interview?.has_interview ? `Score ${interview.latest_score}` : 'Available'}
          badgeColor={interview?.has_interview ? (interview.latest_score >= 75 ? 'emerald' : 'amber') : 'slate'}
        >
          {interview?.has_interview ? (
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span className="text-slate-400">Latest Score:</span>
                <span className={`font-medium ${scoreTextColor(interview.latest_score)}`}>
                  {interview.latest_score}/100
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="text-slate-400">Practice:</span>
                <span className="text-slate-700">{interview.total_interviews} runs</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="text-slate-400">Role:</span>
                <span className="text-slate-700 truncate max-w-[110px]">{interview.target_role || 'General'}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Practice interview questions with camera, voice dictation, and Qwen AI evaluation.
            </p>
          )}
          <Link
            to="/interview"
            className="mt-3.5 inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 transition"
          >
            <span>{interview?.has_interview ? 'Practice again' : 'Start simulation'}</span>
            <ChevronRight className="h-3 w-3 text-slate-400" />
          </Link>
        </ModuleCard>
      </section>

      {/* ── 5. Skills & Next Actions ───────────────────────────────────── */}
      <section className="grid gap-5 lg:grid-cols-3">
        {/* Skills Inventory */}
        <div className="lg:col-span-2 clean-card p-5 sm:p-6">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Skills Inventory</h3>
              <p className="text-xs text-slate-500">
                Aggregated from profile and extracted resume data.
              </p>
            </div>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {allSkills.length} Total
            </span>
          </div>

          {allSkills.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {allSkills.map((skill) => (
                  <span
                    key={skill.name}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ${
                      skill.source === 'resume'
                        ? 'bg-slate-100 text-slate-800 border border-slate-200'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        skill.source === 'resume' ? 'bg-indigo-600' : 'bg-slate-400'
                      }`}
                    />
                    {skill.name}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-4 pt-2 text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                  Verified via Resume
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  Listed in Profile
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center">
              <p className="text-xs text-slate-500">
                No skills recorded yet. Add skills in your profile or upload a resume.
              </p>
            </div>
          )}
        </div>

        {/* Priority Actions */}
        <div className="clean-card p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">Recommended Steps</h3>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Action Plan
              </span>
            </div>

            <div className="space-y-2">
              {next_steps.length > 0 ? (
                next_steps.map((step, idx) => (
                  <Link
                    key={idx}
                    to={step.action}
                    className="block rounded-lg border border-slate-200 p-2.5 hover:bg-slate-50 hover:border-slate-300 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-800 leading-snug">
                        {step.label}
                      </span>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.2 text-[10px] font-semibold uppercase tracking-wider ${
                          step.priority === 'high'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : step.priority === 'medium'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {step.priority}
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-500">
                  All caught up! Ready for your next mock interview or mentor session.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <Link
              to="/mentor"
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 transition"
            >
              <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
              <span>Ask AI Mentor for advice</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

// ── Subcomponents ────────────────────────────────────────────────────────

function JourneyStep({
  step,
  title,
  status,
  to,
  icon: Icon,
}: {
  step: number
  title: string
  status: 'completed' | 'active' | 'upcoming'
  to: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Link
      to={to}
      className={`group flex flex-col items-center justify-between rounded-lg p-3 text-center transition border ${
        status === 'completed'
          ? 'bg-emerald-50/40 border-emerald-200 hover:bg-emerald-50'
          : status === 'active'
          ? 'bg-white border-slate-900 shadow-xs'
          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
      }`}
    >
      <div className="flex items-center justify-between w-full mb-2">
        <span
          className={`h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
            status === 'completed'
              ? 'bg-emerald-600 text-white'
              : status === 'active'
              ? 'bg-slate-900 text-white'
              : 'bg-slate-200 text-slate-600'
          }`}
        >
          {step}
        </span>
        {status === 'completed' ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
        )}
      </div>

      <Icon
        className={`h-5 w-5 mb-1.5 ${
          status === 'completed'
            ? 'text-emerald-700'
            : status === 'active'
            ? 'text-slate-900'
            : 'text-slate-400'
        }`}
      />

      <span
        className={`text-xs font-medium ${
          status === 'completed'
            ? 'text-emerald-900 font-semibold'
            : status === 'active'
            ? 'text-slate-900 font-semibold'
            : 'text-slate-600'
        }`}
      >
        {title}
      </span>
    </Link>
  )
}

function ModuleCard({
  icon: Icon,
  title,
  badge,
  badgeColor,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  badge: string
  badgeColor: 'emerald' | 'amber' | 'slate'
  children: React.ReactNode
}) {
  const badgeClasses = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    slate: 'bg-slate-100 text-slate-600 border-slate-200',
  }

  return (
    <div className="clean-card p-4 sm:p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-slate-100 text-slate-700">
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border ${badgeClasses[badgeColor]}`}>
            {badge}
          </span>
        </div>
        <h3 className="text-xs font-semibold text-slate-900 mb-2">{title}</h3>
        {children}
      </div>
    </div>
  )
}
