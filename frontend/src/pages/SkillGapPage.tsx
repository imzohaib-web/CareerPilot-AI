import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { describeApiError } from '../services/apiClient'
import * as profileService from '../services/profile'
import * as resumeService from '../services/resume'
import * as skillGapService from '../services/skillGap'
import type { SkillGapRequest, SkillGapResponse } from '../types'

function scoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-600'
  if (score >= 50) return 'text-amber-600'
  return 'text-red-600'
}

function scoreRingColor(score: number): string {
  if (score >= 75) return 'border-emerald-500 bg-emerald-50'
  if (score >= 50) return 'border-amber-500 bg-amber-50'
  return 'border-red-500 bg-red-50'
}

export function SkillGapPage() {
  const [resumeData, setResumeData] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [targetJobDescription, setTargetJobDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<SkillGapResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hasResume, setHasResume] = useState(true)
  const [prefillNotice, setPrefillNotice] = useState<string | null>(null)

  const loadLatest = useCallback(async () => {
    try {
      const prev = await skillGapService.fetchLatestSkillGap()
      if (prev) setResult(prev)
    } catch (err) {
      setError(describeApiError(err).message)
    }
  }, [])

  // Auto-fill from latest resume analysis and career profile.
  const loadPrefill = useCallback(async () => {
    try {
      const [resumeDoc, profile] = await Promise.all([
        resumeService.fetchLatestResume(),
        profileService.fetchProfile(),
      ])

      if (!resumeDoc) {
        setHasResume(false)
      } else {
        setHasResume(true)
        const parts: string[] = []
        if (resumeDoc.analysis.skills_detected.length > 0) {
          parts.push(`Skills: ${resumeDoc.analysis.skills_detected.join(', ')}`)
        }
        if (resumeDoc.analysis.summary) {
          parts.push(resumeDoc.analysis.summary)
        }
        if (parts.length > 0) {
          setResumeData(parts.join('\n\n'))
          setPrefillNotice('Auto-filled from your latest resume analysis')
        }
      }

      if (profile?.target_role) {
        setTargetRole((prev) => prev || profile.target_role)
      }
    } catch {
      // Non-critical — user can still enter data manually.
    }
  }, [])

  useEffect(() => {
    loadLatest()
    loadPrefill()
  }, [loadLatest, loadPrefill])

  const canSubmit = resumeData.trim() && targetRole.trim() && targetJobDescription.trim() && !isLoading

  async function handleSubmit() {
    if (!canSubmit) return
    setError(null)
    setIsLoading(true)

    const payload: SkillGapRequest = {
      resume_data: resumeData,
      target_role: targetRole,
      target_job_description: targetJobDescription,
    }

    try {
      const next = await skillGapService.analyzeSkillGap(payload)
      setResult(next)
    } catch (err) {
      setError(describeApiError(err).message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Skill Gap Analyzer</h1>
      <p className="mt-1 text-sm text-slate-500">
        Compare your current profile against a target role and see the highest-priority gaps.
      </p>

      {/* Prerequisite banner: no resume analyzed yet */}
      {!hasResume && (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div>
            <p className="text-sm font-medium text-amber-800">No resume analyzed yet</p>
            <p className="mt-0.5 text-xs text-amber-600">
              Analyze your resume first to auto-populate your skills and get more accurate gap analysis.
            </p>
          </div>
          <Link
            to="/resume"
            className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            Analyze Resume
          </Link>
        </div>
      )}

      {/* Pre-fill notice */}
      {prefillNotice && (
        <div className="mt-4 flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-2.5">
          <p className="text-xs font-medium text-emerald-700">✓ {prefillNotice}</p>
          <button
            type="button"
            onClick={() => setPrefillNotice(null)}
            className="text-xs text-emerald-500 hover:text-emerald-700"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_1.35fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="block text-sm font-medium text-slate-700">
            Target role
            <input
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-violet-500 focus:outline-none"
              placeholder="Backend Engineer"
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-slate-700">
            Resume summary or key skills
            <textarea
              value={resumeData}
              onChange={(e) => setResumeData(e.target.value)}
              rows={10}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-violet-500 focus:outline-none"
              placeholder="Python, FastAPI, PostgreSQL, Git, basic Docker, project experience..."
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-slate-700">
            Target job description
            <textarea
              value={targetJobDescription}
              onChange={(e) => setTargetJobDescription(e.target.value)}
              rows={10}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-violet-500 focus:outline-none"
              placeholder="Build APIs, deploy to AWS, work with Kubernetes, communicate with product teams..."
            />
          </label>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="mt-6 w-full rounded-lg bg-violet-600 px-4 py-2.5 font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Analyzing with AI…' : 'Analyze skill gap'}
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {!result ? (
            <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
              Your gap analysis will appear here after you run the comparison.
            </div>
          ) : (
            <AnalysisSummary result={result} />
          )}
        </div>
      </div>

      {/* Next step: generate roadmap from gaps */}
      {result && (
        <div className="mt-8 flex items-center justify-between rounded-xl border border-violet-200 bg-violet-50 px-5 py-4">
          <div>
            <p className="text-sm font-medium text-violet-800">Gaps identified — what's next?</p>
            <p className="mt-0.5 text-xs text-violet-600">
              Turn these skill gaps into a personalized, time-boxed learning roadmap.
            </p>
          </div>
          <Link
            to="/roadmap"
            className="shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            Generate Roadmap
          </Link>
        </div>
      )}
    </div>
  )
}

function AnalysisSummary({ result }: { result: SkillGapResponse }) {
  const { analysis } = result
  const createdAt = new Date(result.created_at).toLocaleString()

  const technicalList = useMemo(() => analysis.missing_technical_skills, [analysis.missing_technical_skills])
  const softList = useMemo(() => analysis.missing_soft_skills, [analysis.missing_soft_skills])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">Target role</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">{result.target_role}</h2>
          <p className="text-xs text-slate-500">Analyzed {createdAt}</p>
        </div>
        <div className={`flex h-20 w-20 items-center justify-center rounded-full border-4 ${scoreRingColor(analysis.match_score)}`}>
          <span className={`text-2xl font-bold ${scoreColor(analysis.match_score)}`}>{analysis.match_score}</span>
        </div>
      </div>

      <section className="rounded-xl bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-slate-800">Overall assessment</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{analysis.summary}</p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <SkillColumn title="Missing technical skills" items={technicalList} accent="violet" />
        <SkillColumn title="Missing soft skills" items={softList} accent="amber" />
      </div>

      {analysis.required_proficiencies.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-slate-800">Required proficiencies</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {analysis.required_proficiencies.map((group) => (
              <div key={group.area} className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{group.area}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {group.skills.map((skill) => (
                    <span key={`${group.area}-${skill}`} className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function SkillColumn({
  title,
  items,
  accent,
}: {
  title: string
  items: string[]
  accent: 'violet' | 'amber'
}) {
  const accentClasses = accent === 'violet'
    ? 'border-violet-200 bg-violet-50 text-violet-700'
    : 'border-amber-200 bg-amber-50 text-amber-700'

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No major gaps detected.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item} className={`rounded-lg border px-3 py-2 text-sm font-medium ${accentClasses}`}>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
