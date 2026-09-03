import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Target,
  Sparkles,
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
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 border border-brand-200/60 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-brand-600" />
            <span>AI Competency Benchmarking</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Skill Gap Analyzer
          </h1>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">
            Benchmark your current experience and skills against specific target job requirements to find missing competencies.
          </p>
        </div>
      </div>

      {/* ── Prerequisite banner if no resume ─────────────────────────────── */}
      {!hasResume && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-amber-200 bg-amber-50/70 p-6 shadow-xs">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-900">No Resume Analyzed Yet</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Upload your CV to automatically populate skills and calculate an accurate gap matrix.
              </p>
            </div>
          </div>
          <Link
            to="/resume"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700 transition shrink-0"
          >
            <span>Analyze Resume</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* ── Pre-fill notice ──────────────────────────────────────────────── */}
      {prefillNotice && (
        <div className="flex items-center justify-between rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs text-emerald-800">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {prefillNotice}
          </span>
          <button
            type="button"
            onClick={() => setPrefillNotice(null)}
            className="font-bold underline hover:text-emerald-950"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Main 2-Column Workspace ──────────────────────────────────────── */}
      <div className="grid gap-8 lg:grid-cols-12 items-start">
        {/* Left Form Panel */}
        <div className="lg:col-span-5 rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-card space-y-5">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Target className="h-4 w-4 text-brand-600" />
            <span>Target Role Parameters</span>
          </h2>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Target Role Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="e.g. Senior Frontend Engineer, ML Systems Engineer"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Target Job Description / Requirements <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={5}
                value={targetJobDescription}
                onChange={(e) => setTargetJobDescription(e.target.value)}
                placeholder="Paste the target job description or requirements here..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition resize-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Your Current Skills / Background <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                value={resumeData}
                onChange={(e) => setResumeData(e.target.value)}
                placeholder="Your skills summary, extracted resume text, or background..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition resize-none"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-800">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 px-5 py-3 text-xs font-bold text-white shadow-md shadow-brand-600/20 hover:brightness-110 active:scale-98 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Benchmarking with Qwen AI…</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Run Gap Analysis</span>
              </>
            )}
          </button>
        </div>

        {/* Right Results Panel */}
        <div className="lg:col-span-7 space-y-6">
          {result ? (
            <GapAnalysisResultsView result={result} onProceedToRoadmap={() => navigate('/roadmap')} />
          ) : (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-10 shadow-card text-center space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-50 text-brand-600 mx-auto">
                <Target className="h-8 w-8" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h3 className="text-base font-bold text-slate-900">No Gap Analysis Run Yet</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Enter your target role and paste the job description on the left to generate an AI-powered gap breakdown.
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
    <div className="space-y-6 animate-fade-in">
      {/* Match Overview Card */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Target Match Evaluation
          </span>
          <h2 className="text-lg font-bold text-slate-900 mt-1">{result.target_role}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Analyzed {new Date(result.created_at).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center">
            <span className="text-3xl font-extrabold text-slate-900">
              {analysis.match_score}%
            </span>
            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold mt-1 ${matchInfo.bg} ${matchInfo.border} ${matchInfo.color}`}>
              {matchInfo.text}
            </span>
          </div>
        </div>
      </div>

      {/* Summary Callout */}
      {analysis.summary && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card space-y-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-brand-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              AI Analysis Summary
            </h3>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">{analysis.summary}</p>
        </div>
      )}

      {/* Missing Skills Grid (Technical vs Soft Skills) */}
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Missing Technical Skills */}
        <div className="rounded-3xl border border-rose-200/80 bg-rose-50/20 p-6 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-4 w-4 text-rose-600" />
            <h3 className="text-xs font-bold text-rose-900 uppercase tracking-wider">
              Missing Technical Skills ({analysis.missing_technical_skills.length})
            </h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {analysis.missing_technical_skills.map((skill) => (
              <span
                key={skill}
                className="rounded-xl bg-rose-100/80 border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-800"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Missing Soft Skills */}
        <div className="rounded-3xl border border-amber-200/80 bg-amber-50/20 p-6 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
              Missing Soft Skills ({analysis.missing_soft_skills.length})
            </h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {analysis.missing_soft_skills.map((skill) => (
              <span
                key={skill}
                className="rounded-xl bg-amber-100/80 border border-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-800"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Required Proficiencies Breakdown */}
      {analysis.required_proficiencies && analysis.required_proficiencies.length > 0 && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-brand-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Required Competency Framework ({analysis.required_proficiencies.length} Domains)
            </h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {analysis.required_proficiencies.map((domain, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-2 text-xs"
              >
                <p className="font-bold text-slate-900">{domain.area}</p>
                <div className="flex flex-wrap gap-1">
                  {domain.skills.map((s) => (
                    <span
                      key={s}
                      className="rounded-lg bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700"
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
      <div className="rounded-3xl bg-gradient-to-r from-brand-900 to-indigo-950 p-6 sm:p-7 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-300">
            Action Plan
          </span>
          <h3 className="text-base font-bold text-white">Transform These Gaps into a Learning Plan</h3>
          <p className="text-xs text-slate-300">
            Generate a personalized, time-boxed weekly learning roadmap to bridge every missing skill.
          </p>
        </div>
        <button
          type="button"
          onClick={onProceedToRoadmap}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-slate-900 shadow-md hover:bg-brand-50 transition shrink-0"
        >
          <Map className="h-4 w-4 text-brand-600" />
          <span>Generate Roadmap</span>
        </button>
      </div>
    </div>
  )
}
