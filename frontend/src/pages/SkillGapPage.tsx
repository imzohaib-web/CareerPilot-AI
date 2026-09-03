import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Target,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileText,
  Map,
  RefreshCw,
  Lightbulb,
} from 'lucide-react'

import { describeApiError } from '../services/apiClient'
import * as profileService from '../services/profile'
import * as resumeService from '../services/resume'
import * as skillGapService from '../services/skillGap'
import type { SkillGapRequest, SkillGapResponse } from '../types'

function matchBadge(score: number): { text: string; bg: string; border: string; color: string } {
  if (score >= 75) {
    return { text: 'High Match', bg: 'bg-emerald-50', border: 'border-emerald-200', color: 'text-emerald-700' }
  }
  if (score >= 50) {
    return { text: 'Moderate Match', bg: 'bg-amber-50', border: 'border-amber-200', color: 'text-amber-700' }
  }
  return { text: 'Significant Gaps', bg: 'bg-rose-50', border: 'border-rose-200', color: 'text-rose-700' }
}

export function SkillGapPage() {
  const navigate = useNavigate()
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

  // Auto-fill from latest resume analysis and career profile
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
          setPrefillNotice('Auto-populated using your latest resume analysis')
        }
      }

      if (profile?.target_role) {
        setTargetRole((prev) => prev || profile.target_role)
      }
    } catch {
      // Non-critical
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
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Skill Gap Analyzer
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 max-w-2xl">
            Benchmark current skills against target job requirements to identify missing competencies and training priorities.
          </p>
        </div>
      </div>

      {/* ── Prerequisite banner if no resume ─────────────────────────────── */}
      {!hasResume && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/70 p-4">
          <div className="flex items-start gap-2.5">
            <FileText className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-900">No Resume Analyzed Yet</p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Upload your resume first to automatically pre-fill your skills inventory.
              </p>
            </div>
          </div>
          <Link
            to="/resume"
            className="btn-secondary self-start sm:self-auto text-xs py-1.5 px-3 shrink-0"
          >
            <span>Analyze Resume</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* ── Pre-fill notice ──────────────────────────────────────────────── */}
      {prefillNotice && (
        <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-3.5 py-2 text-xs text-emerald-800">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            {prefillNotice}
          </span>
          <button
            type="button"
            onClick={() => setPrefillNotice(null)}
            className="font-medium text-[11px] underline hover:text-emerald-950"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Main 2-Column Workspace ──────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Form Panel */}
        <div className="lg:col-span-5 clean-card p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Target className="h-4 w-4 text-slate-700" />
            <h2 className="text-sm font-semibold text-slate-900">
              Target Role Parameters
            </h2>
          </div>

          <div className="space-y-3.5 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Target Role Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="e.g. Senior Frontend Engineer, ML Engineer"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Target Job Description / Requirements <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={5}
                value={targetJobDescription}
                onChange={(e) => setTargetJobDescription(e.target.value)}
                placeholder="Paste the target job description or requirements here..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition resize-none leading-relaxed"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Your Current Skills / Background <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                value={resumeData}
                onChange={(e) => setResumeData(e.target.value)}
                placeholder="Your skills summary, extracted resume text, or background..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition resize-none leading-relaxed"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full btn-primary text-xs py-2.5 px-4"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Benchmarking skills…</span>
              </>
            ) : (
              <>
                <Target className="h-3.5 w-3.5" />
                <span>Run Gap Analysis</span>
              </>
            )}
          </button>
        </div>

        {/* Right Results Panel */}
        <div className="lg:col-span-7 space-y-5">
          {result ? (
            <GapAnalysisResultsView result={result} onProceedToRoadmap={() => navigate('/roadmap')} />
          ) : (
            <div className="clean-card p-8 sm:p-10 text-center space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-600 mx-auto">
                <Target className="h-6 w-6" />
              </div>
              <div className="space-y-1 max-w-xs mx-auto">
                <h3 className="text-sm font-semibold text-slate-900">No Gap Analysis Run Yet</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Enter your target role and job description on the left to benchmark your profile against real job expectations.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function GapAnalysisResultsView({
  result,
  onProceedToRoadmap,
}: {
  result: SkillGapResponse
  onProceedToRoadmap: () => void
}) {
  const { analysis } = result
  const matchInfo = matchBadge(analysis.match_score)

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Match Overview Card */}
      <div className="clean-card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Target Match Evaluation
          </span>
          <h2 className="text-base font-bold text-slate-900 mt-0.5">{result.target_role}</h2>
          <p className="text-xs text-slate-500">
            Analyzed {new Date(result.created_at).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-3xl font-bold text-slate-900">
              {analysis.match_score}%
            </span>
            <span className={`block rounded px-2 py-0.5 text-[10px] font-semibold border mt-0.5 ${matchInfo.bg} ${matchInfo.border} ${matchInfo.color}`}>
              {matchInfo.text}
            </span>
          </div>
        </div>
      </div>

      {/* Summary Callout */}
      {analysis.summary && (
        <div className="clean-card p-5 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Lightbulb className="h-4 w-4 text-slate-600" />
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              AI Analysis Summary
            </h3>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">{analysis.summary}</p>
        </div>
      )}

      {/* Missing Skills Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Missing Technical Skills */}
        <div className="clean-card p-5 border-rose-200/80 bg-rose-50/20">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-4 w-4 text-rose-600" />
            <h3 className="text-xs font-semibold text-rose-900 uppercase tracking-wider">
              Missing Technical Skills ({analysis.missing_technical_skills.length})
            </h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {analysis.missing_technical_skills.map((skill) => (
              <span
                key={skill}
                className="rounded bg-rose-100/80 border border-rose-200 px-2 py-0.5 text-xs font-medium text-rose-800"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Missing Soft Skills */}
        <div className="clean-card p-5 border-amber-200/80 bg-amber-50/20">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h3 className="text-xs font-semibold text-amber-900 uppercase tracking-wider">
              Missing Soft Skills ({analysis.missing_soft_skills.length})
            </h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {analysis.missing_soft_skills.map((skill) => (
              <span
                key={skill}
                className="rounded bg-amber-100/80 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Required Proficiencies Breakdown */}
      {analysis.required_proficiencies && analysis.required_proficiencies.length > 0 && (
        <div className="clean-card p-5 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <CheckCircle2 className="h-4 w-4 text-slate-700" />
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              Required Competency Framework ({analysis.required_proficiencies.length} Domains)
            </h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {analysis.required_proficiencies.map((domain, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-1.5 text-xs"
              >
                <p className="font-semibold text-slate-900">{domain.area}</p>
                <div className="flex flex-wrap gap-1">
                  {domain.skills.map((s) => (
                    <span
                      key={s}
                      className="rounded bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bridge to Roadmap */}
      <div className="clean-card p-5 sm:p-6 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Next Action
          </span>
          <h3 className="text-sm font-semibold text-white">Generate Learning Roadmap from Gaps</h3>
          <p className="text-xs text-slate-400">
            Create a structured week-by-week plan to systematically bridge these missing competencies.
          </p>
        </div>
        <button
          type="button"
          onClick={onProceedToRoadmap}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100 transition shrink-0"
        >
          <Map className="h-3.5 w-3.5 text-slate-700" />
          <span>Generate Roadmap</span>
        </button>
      </div>
    </div>
  )
}
