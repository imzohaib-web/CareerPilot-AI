import { useCallback, useEffect, useMemo } from 'react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { describeApiError } from '../services/apiClient'
import * as progressService from '../services/progress'
import type { DashboardResponse, NextStep } from '../types'

// ── Helpers ──────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-600'
  if (score >= 50) return 'text-amber-600'
  return 'text-red-600'
}

function progressBarColor(score: number): string {
  if (score >= 75) return 'bg-emerald-500'
  if (score >= 50) return 'bg-amber-500'
  return 'bg-red-500'
}

function experienceLabel(level: string): string {
  const map: Record<string, string> = {
    student: 'Student',
    'fresh-graduate': 'Fresh Graduate',
    'early-career': 'Early Career',
  }
  return map[level] ?? level
}

// ── Main page ────────────────────────────────────────────────────────────

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
    const result: { name: string; source: string }[] = []
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

  // ── Loading ────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <div className="animate-pulse space-y-6">
          <div className="space-y-3">
            <div className="h-8 w-64 rounded-lg bg-slate-200" />
            <div className="h-4 w-48 rounded bg-slate-200" />
          </div>
          <div className="h-28 rounded-2xl bg-slate-200" />
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="h-56 rounded-2xl bg-slate-200" />
            <div className="h-56 rounded-2xl bg-slate-200" />
          </div>
        </div>
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-medium text-red-800">{error}</p>
          <button
            type="button"
            onClick={loadDashboard}
            className="mt-3 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { profile, resume, roadmap, interview, overall_progress, readiness_score, next_steps } = data

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Welcome back, {user?.name ?? 'Student'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Track your career readiness and keep building your profile.
        </p>
      </div>

      {/* Overall progress */}
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Overall Progress
            </h2>
            <p className="mt-1 text-3xl font-bold text-slate-900">{overall_progress}%</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Based on profile completeness and resume readiness
            </p>
          </div>
          {resume.has_analysis && (
            <div className="flex shrink-0 flex-col items-center">
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-full border-4 ${
                  resume.score >= 75
                    ? 'border-emerald-400'
                    : resume.score >= 50
                      ? 'border-amber-400'
                      : 'border-red-400'
                }`}
              >
                <span className={`text-xl font-bold ${scoreColor(resume.score)}`}>
                  {readiness_score}
                </span>
              </div>
              <span className="mt-1 text-xs text-slate-400">ATS Score</span>
            </div>
          )}
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressBarColor(overall_progress)}`}
            style={{ width: `${overall_progress}%` }}
          />
        </div>
      </div>

      {/* Status cards */}
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <ProfileCard profile={profile} />
        <ResumeCard resume={resume} />
        <RoadmapCard roadmap={roadmap} />
        <InterviewCard interview={interview} />
      </div>

      {/* Skills */}
      {allSkills.length > 0 && <SkillsCloud skills={allSkills} />}

      {/* Next steps */}
      {next_steps.length > 0 && <NextStepsCard steps={next_steps} />}
    </div>
  )
}

// ── Profile Card ─────────────────────────────────────────────────────────

function ProfileCard({ profile }: { profile: DashboardResponse['profile'] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Career Profile
      </h3>

      {profile.has_profile ? (
        <>
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Completeness</span>
              <span className="font-medium text-slate-900">{profile.completeness}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ${progressBarColor(profile.completeness)}`}
                style={{ width: `${profile.completeness}%` }}
              />
            </div>
          </div>

          {profile.target_role && (
            <p className="mt-4 text-sm">
              <span className="text-slate-500">Target: </span>
              <span className="font-medium text-slate-800">{profile.target_role}</span>
            </p>
          )}
          {profile.experience_level && (
            <p className="mt-1 text-sm">
              <span className="text-slate-500">Level: </span>
              <span className="font-medium text-slate-800">
                {experienceLabel(profile.experience_level)}
              </span>
            </p>
          )}
          {profile.skills_count > 0 && (
            <p className="mt-1 text-sm">
              <span className="text-slate-500">Skills: </span>
              <span className="font-medium text-slate-800">{profile.skills_count} listed</span>
            </p>
          )}

          <Link
            to="/profile"
            className="mt-4 inline-block text-sm font-medium text-violet-600 hover:text-violet-700"
          >
            {profile.completeness < 100 ? 'Complete profile →' : 'Edit profile →'}
          </Link>
        </>
      ) : (
        <div className="mt-4 rounded-xl bg-violet-50 p-4">
          <p className="text-sm text-violet-700">
            No career profile yet. Create one to get personalized guidance.
          </p>
          <Link
            to="/profile"
            className="mt-3 inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            Create Profile
          </Link>
        </div>
      )}
    </div>
  )
}

// ── Resume Card ──────────────────────────────────────────────────────────

function ResumeCard({ resume }: { resume: DashboardResponse['resume'] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Resume Status
      </h3>

      {resume.has_analysis ? (
        <>
          <div className="mt-3 flex items-center gap-3">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 ${
                resume.score >= 75
                  ? 'border-emerald-400'
                  : resume.score >= 50
                    ? 'border-amber-400'
                    : 'border-red-400'
              }`}
            >
              <span className={`text-lg font-bold ${scoreColor(resume.score)}`}>
                {resume.score}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">
                {resume.score >= 75
                  ? 'Strong resume'
                  : resume.score >= 50
                    ? 'Good foundation'
                    : 'Needs improvement'}
              </p>
              {resume.analyzed_at && (
                <p className="text-xs text-slate-400">
                  Analyzed {new Date(resume.analyzed_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Skills found</p>
              <p className="font-semibold text-slate-900">{resume.skills_count}</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Improvements</p>
              <p className="font-semibold text-slate-900">{resume.improvements_count}</p>
            </div>
          </div>

          {resume.total_analyses > 1 && (
            <p className="mt-3 text-xs text-slate-400">
              {resume.total_analyses} total analyses performed
            </p>
          )}

          <Link
            to="/resume"
            className="mt-4 inline-block text-sm font-medium text-violet-600 hover:text-violet-700"
          >
            {resume.improvements_count > 0 ? 'Improve resume →' : 'View analysis →'}
          </Link>
        </>
      ) : (
        <div className="mt-4 rounded-xl bg-violet-50 p-4">
          <p className="text-sm text-violet-700">
            No resume analyzed yet. Upload your resume to get an AI-powered readiness score.
          </p>
          <Link
            to="/resume"
            className="mt-3 inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            Analyze Your Resume
          </Link>
        </div>
      )}
    </div>
  )
}

// ── Roadmap Card ─────────────────────────────────────────────────────────

function RoadmapCard({ roadmap }: { roadmap?: DashboardResponse['roadmap'] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Learning Roadmap
      </h3>

      {roadmap?.has_roadmap ? (
        <>
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Completion</span>
              <span className="font-medium text-slate-900">{roadmap.completion_percentage}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ${progressBarColor(roadmap.completion_percentage)}`}
                style={{ width: `${roadmap.completion_percentage}%` }}
              />
            </div>
          </div>

          <p className="mt-4 text-sm">
            <span className="text-slate-500">Target: </span>
            <span className="font-medium text-slate-800">{roadmap.target_role}</span>
          </p>
          <p className="mt-1 text-sm">
            <span className="text-slate-500">Tasks: </span>
            <span className="font-medium text-slate-800">
              {roadmap.completed_tasks_count} of {roadmap.total_tasks} completed
            </span>
          </p>

          <Link
            to="/roadmap"
            className="mt-4 inline-block text-sm font-medium text-violet-600 hover:text-violet-700"
          >
            {roadmap.completed_tasks_count < roadmap.total_tasks ? 'Continue roadmap →' : 'View roadmap →'}
          </Link>
        </>
      ) : (
        <div className="mt-4 rounded-xl bg-violet-50 p-4">
          <p className="text-sm text-violet-700">
            No roadmap generated yet. Turn your skill gaps into a step-by-step learning plan.
          </p>
          <Link
            to="/roadmap"
            className="mt-3 inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            Generate Roadmap
          </Link>
        </div>
      )}
    </div>
  )
}

// ── Interview Card ──────────────────────────────────────────────────────

function InterviewCard({ interview }: { interview?: DashboardResponse['interview'] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Mock Interview
      </h3>

      {interview?.has_interview ? (
        <>
          <div className="mt-3 flex items-center gap-3">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 ${
                interview.latest_score >= 75
                  ? 'border-emerald-400'
                  : interview.latest_score >= 50
                    ? 'border-amber-400'
                    : 'border-red-400'
              }`}
            >
              <span className={`text-lg font-bold ${scoreColor(interview.latest_score)}`}>
                {interview.latest_score}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">
                {interview.latest_score >= 75
                  ? 'Interview ready'
                  : interview.latest_score >= 50
                    ? 'Getting there'
                    : 'Needs practice'}
              </p>
              <p className="text-xs text-slate-400">Latest score</p>
            </div>
          </div>

          {interview.target_role && (
            <p className="mt-4 text-sm">
              <span className="text-slate-500">Role: </span>
              <span className="font-medium text-slate-800">{interview.target_role}</span>
            </p>
          )}
          <p className="mt-1 text-sm">
            <span className="text-slate-500">Sessions: </span>
            <span className="font-medium text-slate-800">{interview.total_interviews}</span>
          </p>

          <Link
            to="/interview"
            className="mt-4 inline-block text-sm font-medium text-violet-600 hover:text-violet-700"
          >
            {interview.latest_score < 70 ? 'Practice again →' : 'View results →'}
          </Link>
        </>
      ) : (
        <div className="mt-4 rounded-xl bg-violet-50 p-4">
          <p className="text-sm text-violet-700">
            No mock interview yet. Practice with AI-powered interview simulation.
          </p>
          <Link
            to="/interview"
            className="mt-3 inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            Start Interview
          </Link>
        </div>
      )}
    </div>
  )
}

// ── Skills Cloud ─────────────────────────────────────────────────────────

function SkillsCloud({
  skills,
}: {
  skills: { name: string; source: string }[]
}) {
  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Your Skills
      </h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {skills.map((skill) => (
          <span
            key={skill.name}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              skill.source === 'resume'
                ? 'bg-violet-50 text-violet-700'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {skill.name}
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-violet-400" />
          From resume
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-slate-300" />
          Self-reported
        </span>
      </div>
    </div>
  )
}

// ── Next Steps ───────────────────────────────────────────────────────────

function priorityStyles(priority: string): string {
  switch (priority) {
    case 'high':
      return 'border-l-red-400 bg-red-50'
    case 'medium':
      return 'border-l-amber-400 bg-amber-50'
    default:
      return 'border-l-emerald-400 bg-emerald-50'
  }
}

function priorityBadge(priority: string): string {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-700'
    case 'medium':
      return 'bg-amber-100 text-amber-700'
    default:
      return 'bg-emerald-100 text-emerald-700'
  }
}

function NextStepsCard({ steps }: { steps: NextStep[] }) {
  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Next Steps
      </h3>
      <div className="mt-3 space-y-3">
        {steps.map((step, i) => (
          <Link
            key={i}
            to={step.action}
            className={`block rounded-xl border-l-4 p-4 transition-colors hover:opacity-90 ${priorityStyles(step.priority)}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-800">{step.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityBadge(step.priority)}`}
              >
                {step.priority}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
