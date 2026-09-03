import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles,
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
  Zap,
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
  if (score >= 75) return 'text-emerald-600'
  if (score >= 50) return 'text-amber-600'
  return 'text-rose-600'
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
    if (!data) return { to: '/profile', label: 'Complete your profile' }
    if (!data.profile.has_profile) return { to: '/profile', label: 'Create your Career Profile' }
    if (!data.resume.has_analysis) return { to: '/resume', label: 'Upload and analyze your Resume' }
    if (!data.roadmap?.has_roadmap) return { to: '/roadmap', label: 'Generate your Learning Roadmap' }
    if (!data.interview?.has_interview) return { to: '/interview', label: 'Start an AI Mock Interview' }
    return { to: '/mentor', label: 'Consult with Career Mentor' }
  }, [data])

  // ── Loading Skeleton ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 animate-pulse space-y-8">
        <div className="h-32 rounded-3xl bg-slate-200/70" />
        <div className="h-44 rounded-3xl bg-slate-200/70" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="h-48 rounded-2xl bg-slate-200/70" />
          <div className="h-48 rounded-2xl bg-slate-200/70" />
          <div className="h-48 rounded-2xl bg-slate-200/70" />
          <div className="h-48 rounded-2xl bg-slate-200/70" />
        </div>
      </div>
    )
  }

  // ── Error State ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="rounded-3xl border border-rose-200 bg-rose-50/70 p-8 text-center max-w-xl mx-auto shadow-sm">
          <CircleAlert className="mx-auto h-12 w-12 text-rose-500 mb-3" />
          <h2 className="text-lg font-bold text-slate-900">Failed to load Dashboard</h2>
          <p className="mt-1 text-sm text-rose-700">{error}</p>
          <button
            type="button"
            onClick={loadDashboard}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 shadow-xs hover:bg-rose-100 transition"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { profile, resume, roadmap, interview, overall_progress, readiness_score, next_steps } = data

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ── 1. Hero Command Center Banner ───────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-brand-950 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 -mb-16 h-48 w-48 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-brand-200 backdrop-blur-xs border border-white/10">
              <Sparkles className="h-3.5 w-3.5 text-brand-300" />
              <span>AI Career Command Center</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Welcome back, {user?.name ?? 'Candidate'}
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              {profile.target_role ? (
                <>
                  Targeting <span className="font-semibold text-white underline decoration-brand-400 underline-offset-4">{profile.target_role}</span>. Keep sharpening your skills and tracking your interview readiness.
                </>
              ) : (
                'Set your target role and complete your profile to unlock customized roadmap and AI interview prep.'
              )}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <Link
              to={topAction.to}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/30 hover:shadow-brand-600/50 hover:brightness-110 active:scale-98 transition-all duration-150"
            >
              <span>{topAction.label}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 2. Overall Career Readiness & Key Stats ──────────────────────── */}
      <section className="grid gap-6 lg:grid-cols-3">
        {/* Readiness Card */}
        <div className="lg:col-span-2 rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900">Career Readiness Score</h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Calculated from profile completeness, resume ATS match, and interview feedback.
              </p>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tracking-tight text-slate-900">
                {overall_progress}%
              </span>
              <span className="text-xs font-semibold text-slate-400 uppercase">Readiness</span>
            </div>
          </div>

          {/* Progress Bar & Sub-metrics */}
          <div className="mt-6 space-y-5">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-slate-600">
                <span>Overall Journey Progress</span>
                <span>{overall_progress}% Complete</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${progressBarColor(
                    overall_progress
                  )}`}
                  style={{ width: `${Math.max(overall_progress, 4)}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="rounded-2xl bg-slate-50/80 p-3.5 border border-slate-100">
                <p className="text-[11px] font-medium text-slate-500">Profile</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{profile.completeness}%</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {profile.has_profile ? 'Configured' : 'Incomplete'}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50/80 p-3.5 border border-slate-100">
                <p className="text-[11px] font-medium text-slate-500">Resume ATS</p>
                <p className={`mt-1 text-lg font-bold ${resume.has_analysis ? scoreTextColor(resume.score) : 'text-slate-400'}`}>
                  {resume.has_analysis ? `${resume.score}/100` : '—'}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {resume.has_analysis ? 'AI Evaluated' : 'Not analyzed'}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50/80 p-3.5 border border-slate-100">
                <p className="text-[11px] font-medium text-slate-500">Interview</p>
                <p className={`mt-1 text-lg font-bold ${interview?.has_interview ? scoreTextColor(interview.latest_score) : 'text-slate-400'}`}>
                  {interview?.has_interview ? `${interview.latest_score}/100` : '—'}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {interview?.has_interview ? `${interview.total_interviews} sessions` : 'Pending'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ATS Score & Quick Diagnostic */}
        <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/50 p-6 sm:p-7 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Resume Health
              </span>
              {resume.has_analysis && (
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${scoreBadgeClass(resume.score)}`}>
                  {resume.score >= 75 ? 'Job-Ready' : resume.score >= 50 ? 'Moderate' : 'Needs Work'}
                </span>
              )}
            </div>

            {resume.has_analysis ? (
              <div className="mt-4 flex items-center gap-4">
                <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 font-bold text-2xl shadow-xs ${scoreBadgeClass(resume.score)}`}>
                  {readiness_score}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {resume.score >= 75 ? 'Strong Match' : 'Potential Detected'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {resume.skills_count} skills extracted · {resume.improvements_count} improvements suggested
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl bg-brand-50/50 border border-brand-100 p-4">
                <p className="text-xs text-brand-800 font-medium leading-relaxed">
                  No resume evaluated yet. Upload your CV to calculate your ATS readiness score.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <Link
              to="/resume"
              className="flex items-center justify-between text-xs font-bold text-brand-600 hover:text-brand-700 transition group"
            >
              <span>{resume.has_analysis ? 'View Resume Breakdown' : 'Upload Resume for Analysis'}</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 3. Career Journey Tracker Pipeline ───────────────────────────── */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Your AI Career Journey</h2>
            <p className="text-xs text-slate-500">
              Follow this verified acceleration sequence to become fully job-ready.
            </p>
          </div>
          <span className="text-xs font-semibold text-brand-600 bg-brand-50 px-3 py-1 rounded-full border border-brand-100 self-start sm:self-auto">
            End-to-End Pipeline
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
            icon={Sparkles}
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

      {/* ── 4. Four Core Module Status Cards ─────────────────────────────── */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Profile Card */}
        <ModuleCard
          icon={User}
          title="Career Profile"
          badge={profile.has_profile ? `${profile.completeness}% Ready` : 'Not Set'}
          badgeColor={profile.has_profile ? 'emerald' : 'amber'}
        >
          {profile.has_profile ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span className="text-slate-400">Target Role:</span>
                <span className="font-semibold text-slate-800 truncate max-w-[130px]">{profile.target_role || 'Not specified'}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="text-slate-400">Level:</span>
                <span className="font-medium text-slate-700">{experienceLabel(profile.experience_level || 'student')}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="text-slate-400">Skills Listed:</span>
                <span className="font-medium text-slate-700">{profile.skills_count}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Create your profile to ground the AI in your educational background and career goals.
            </p>
          )}
          <Link
            to="/profile"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-700 group"
          >
            <span>{profile.has_profile ? 'Edit Profile' : 'Set Up Profile'}</span>
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </ModuleCard>

        {/* Resume Card */}
        <ModuleCard
          icon={FileText}
          title="Resume Status"
          badge={resume.has_analysis ? `Score ${resume.score}` : 'Pending'}
          badgeColor={resume.has_analysis ? (resume.score >= 75 ? 'emerald' : 'amber') : 'slate'}
        >
          {resume.has_analysis ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span className="text-slate-400">Skills Detected:</span>
                <span className="font-semibold text-slate-800">{resume.skills_count}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="text-slate-400">Improvements:</span>
                <span className="font-medium text-slate-700">{resume.improvements_count} suggestions</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="text-slate-400">Total Runs:</span>
                <span className="font-medium text-slate-700">{resume.total_analyses}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Upload your PDF resume to extract skills and receive ATS optimization feedback.
            </p>
          )}
          <Link
            to="/resume"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-700 group"
          >
            <span>{resume.has_analysis ? 'View Analysis' : 'Upload Resume'}</span>
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </ModuleCard>

        {/* Roadmap Card */}
        <ModuleCard
          icon={Map}
          title="Learning Roadmap"
          badge={roadmap?.has_roadmap ? `${roadmap.completion_percentage}% Done` : 'Not Started'}
          badgeColor={roadmap?.has_roadmap ? 'emerald' : 'slate'}
        >
          {roadmap?.has_roadmap ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span className="text-slate-400">Tasks Completed:</span>
                <span className="font-semibold text-slate-800">
                  {roadmap.completed_tasks_count} of {roadmap.total_tasks}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-brand-500 transition-all duration-300"
                  style={{ width: `${roadmap.completion_percentage}%` }}
                />
              </div>
              <div className="flex justify-between text-slate-600 pt-1">
                <span className="text-slate-400">Target Role:</span>
                <span className="font-medium text-slate-700 truncate max-w-[120px]">{roadmap.target_role}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Generate a weekly step-by-step action plan tailored to bridge your target role skill gaps.
            </p>
          )}
          <Link
            to="/roadmap"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-700 group"
          >
            <span>{roadmap?.has_roadmap ? 'Continue Roadmap' : 'Generate Roadmap'}</span>
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </ModuleCard>

        {/* Mock Interview Card */}
        <ModuleCard
          icon={Video}
          title="Mock Interview"
          badge={interview?.has_interview ? `Score ${interview.latest_score}` : 'Ready to Start'}
          badgeColor={interview?.has_interview ? (interview.latest_score >= 75 ? 'emerald' : 'amber') : 'slate'}
        >
          {interview?.has_interview ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span className="text-slate-400">Latest Score:</span>
                <span className={`font-semibold ${scoreTextColor(interview.latest_score)}`}>
                  {interview.latest_score}/100
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="text-slate-400">Total Practice:</span>
                <span className="font-medium text-slate-700">{interview.total_interviews} sessions</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="text-slate-400">Role:</span>
                <span className="font-medium text-slate-700 truncate max-w-[120px]">{interview.target_role || 'General'}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Practice real technical and behavioral questions evaluated by Qwen AI with instant feedback.
            </p>
          )}
          <Link
            to="/interview"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-700 group"
          >
            <span>{interview?.has_interview ? 'Practice Again' : 'Start Simulation'}</span>
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </ModuleCard>
      </section>

      {/* ── 5. Skills Cloud & Actionable Next Steps ───────────────────────── */}
      <section className="grid gap-6 lg:grid-cols-3">
        {/* Skills Matrix */}
        <div className="lg:col-span-2 rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Your Skills Inventory</h3>
              <p className="text-xs text-slate-500">
                Deduplicated from your career profile and extracted resume data.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
              {allSkills.length} Total
            </span>
          </div>

          {allSkills.length > 0 ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {allSkills.map((skill) => (
                  <span
                    key={skill.name}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                      skill.source === 'resume'
                        ? 'bg-brand-50 text-brand-700 border border-brand-200/70'
                        : 'bg-slate-100 text-slate-700 border border-slate-200/70'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        skill.source === 'resume' ? 'bg-brand-500' : 'bg-slate-400'
                      }`}
                    />
                    {skill.name}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-brand-500" />
                  Verified via Resume AI
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  Self-Reported in Profile
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-slate-400 mb-2" />
              <p className="text-xs text-slate-500 font-medium">
                No skills detected yet. Upload your resume or edit your profile to see your inventory.
              </p>
            </div>
          )}
        </div>

        {/* Priority Next Steps */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Recommended Steps</h3>
              <span className="text-xs font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
                Action Plan
              </span>
            </div>

            <div className="space-y-3">
              {next_steps.length > 0 ? (
                next_steps.map((step, idx) => (
                  <Link
                    key={idx}
                    to={step.action}
                    className="group block rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3.5 hover:bg-white hover:border-brand-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <Zap className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" />
                        <span className="text-xs font-semibold text-slate-800 group-hover:text-brand-700 transition-colors leading-snug">
                          {step.label}
                        </span>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          step.priority === 'high'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : step.priority === 'medium'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {step.priority}
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">
                  You are all caught up! Keep practicing or consult your AI mentor.
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <Link
              to="/mentor"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-700 transition"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Ask AI Mentor what to do next</span>
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
      className={`group flex flex-col items-center justify-between rounded-2xl p-4 text-center transition-all ${
        status === 'completed'
          ? 'bg-emerald-50/60 border border-emerald-200/80 hover:bg-emerald-50'
          : status === 'active'
          ? 'bg-brand-50/80 border-2 border-brand-500 shadow-sm shadow-brand-500/10'
          : 'bg-slate-50/60 border border-slate-200/60 hover:bg-slate-100/80'
      }`}
    >
      <div className="flex items-center justify-between w-full mb-3">
        <span
          className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
            status === 'completed'
              ? 'bg-emerald-600 text-white'
              : status === 'active'
              ? 'bg-brand-600 text-white animate-pulse'
              : 'bg-slate-200 text-slate-600'
          }`}
        >
          {step}
        </span>
        {status === 'completed' ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : (
          <span className="h-2 w-2 rounded-full bg-slate-300 group-hover:bg-brand-400" />
        )}
      </div>

      <Icon
        className={`h-6 w-6 mb-2 ${
          status === 'completed'
            ? 'text-emerald-700'
            : status === 'active'
            ? 'text-brand-700'
            : 'text-slate-400'
        }`}
      />

      <span
        className={`text-xs font-bold leading-tight ${
          status === 'completed'
            ? 'text-emerald-900'
            : status === 'active'
            ? 'text-brand-900'
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
    <div className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-card hover:shadow-card-hover transition-all duration-200">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 text-slate-700">
            <Icon className="h-4 w-4 text-slate-700" />
          </div>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${badgeClasses[badgeColor]}`}>
            {badge}
          </span>
        </div>
        <h3 className="text-sm font-bold text-slate-900 mb-3">{title}</h3>
        {children}
      </div>
    </div>
  )
}
