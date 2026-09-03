import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { describeApiError } from '../services/apiClient'
import * as resumeService from '../services/resume'
import type { ResumeAnalysis, ResumeAnalysisResponse } from '../types'

const MAX_FILE_SIZE_MB = 5
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

// ── Score colour helper ────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-600'
  if (score >= 50) return 'text-amber-600'
  return 'text-red-600'
}

function scoreRingColor(score: number): string {
  if (score >= 75) return 'border-emerald-500'
  if (score >= 50) return 'border-amber-500'
  return 'border-red-500'
}

// ── Main page ─────────────────────────────────────────────────────────────

export function ResumeAnalyzerPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [result, setResult] = useState<ResumeAnalysisResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Load previous analysis on mount
  const loadLatest = useCallback(async () => {
    try {
      setLoadError(null)
      const prev = await resumeService.fetchLatestResume()
      if (prev) setResult(prev)
    } catch (err) {
      setLoadError(describeApiError(err).message)
    }
  }, [])

  useEffect(() => {
    loadLatest()
  }, [loadLatest])

  // ── File selection ─────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setFileError(null)
    setSelectedFile(null)

    if (!file) return

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setFileError('Only PDF files are accepted.')
      return
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum is ${MAX_FILE_SIZE_MB} MB.`)
      return
    }

    if (file.size === 0) {
      setFileError('The selected file is empty.')
      return
    }

    setSelectedFile(file)
  }

  // ── Submit ─────────────────────────────────────────────────────────────

  async function handleAnalyze() {
    if (!selectedFile || isAnalyzing) return
    setAnalysisError(null)
    setIsAnalyzing(true)

    try {
      const data = await resumeService.analyzeResume(selectedFile)
      setResult(data)
      setSelectedFile(null)
      // Clear the native file input so re-selecting the same file triggers change.
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setAnalysisError(describeApiError(err).message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Resume Analyzer</h1>
      <p className="mt-1 text-sm text-slate-500">
        Upload your resume as a PDF and let Qwen AI evaluate its strengths, weaknesses, and job-readiness.
      </p>

      {/* Upload card */}
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium text-slate-700">Select PDF resume</label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            disabled={isAnalyzing}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-violet-700 hover:file:bg-violet-100 disabled:opacity-50"
          />
        </div>

        <p className="mt-1 text-xs text-slate-400">
          Accepted: PDF only · Max {MAX_FILE_SIZE_MB} MB · Must contain selectable text
        </p>

        {selectedFile && (
          <p className="mt-2 text-sm text-slate-700">
            Selected: <span className="font-medium">{selectedFile.name}</span>{' '}
            <span className="text-slate-400">
              ({(selectedFile.size / 1024).toFixed(0)} KB)
            </span>
          </p>
        )}

        {fileError && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{fileError}</p>
        )}

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!selectedFile || isAnalyzing}
          className="mt-4 w-full rounded-lg bg-violet-600 px-4 py-2.5 font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isAnalyzing ? 'Analyzing with AI…' : 'Analyze Resume'}
        </button>

        {isAnalyzing && (
          <div className="mt-4 flex items-center gap-2 text-sm text-violet-600">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Qwen is analyzing your resume — this may take 15–30 seconds…
          </div>
        )}

        {analysisError && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {analysisError}
          </div>
        )}
      </div>

      {/* Warning when previous analysis could not be loaded */}
      {loadError && !result && (
        <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          Could not load your previous analysis: {loadError}
        </div>
      )}

      {/* Results */}
      {result && <AnalysisResults result={result} />}

      {/* Next step: analyze skill gaps */}
      {result && (
        <div className="mt-8 flex items-center justify-between rounded-xl border border-violet-200 bg-violet-50 px-5 py-4">
          <div>
            <p className="text-sm font-medium text-violet-800">Resume analyzed — what's next?</p>
            <p className="mt-0.5 text-xs text-violet-600">
              Compare your skills against a target role to identify skill gaps.
            </p>
          </div>
          <Link
            to="/skill-gap"
            className="shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            Analyze Skill Gaps
          </Link>
        </div>
      )}
    </div>
  )
}

// ── Results component ─────────────────────────────────────────────────────

function AnalysisResults({ result }: { result: ResumeAnalysisResponse }) {
  const { analysis } = result
  const analyzedDate = new Date(result.analyzed_at).toLocaleString()

  return (
    <div className="mt-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Analysis Results</h2>
          <p className="text-sm text-slate-500">
            {result.filename} · Analyzed {analyzedDate} · Model: {result.model}
          </p>
        </div>
        {/* Score badge */}
        <div
          className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 ${scoreRingColor(analysis.score)}`}
        >
          <span className={`text-2xl font-bold ${scoreColor(analysis.score)}`}>
            {analysis.score}
          </span>
        </div>
      </div>

      {/* Summary */}
      {analysis.summary && (
        <Section title="Summary">
          <p className="text-sm leading-relaxed text-slate-700">{analysis.summary}</p>
        </Section>
      )}

      {/* Two-column: strengths + weaknesses */}
      <div className="grid gap-6 sm:grid-cols-2">
        {analysis.strengths.length > 0 && (
          <Section title="Strengths" accent="emerald">
            <BulletList items={analysis.strengths} color="emerald" />
          </Section>
        )}
        {analysis.weaknesses.length > 0 && (
          <Section title="Weaknesses" accent="red">
            <BulletList items={analysis.weaknesses} color="red" />
          </Section>
        )}
      </div>

      {/* Missing info + improvements */}
      <div className="grid gap-6 sm:grid-cols-2">
        {analysis.missing_info.length > 0 && (
          <Section title="Missing Information" accent="amber">
            <BulletList items={analysis.missing_info} color="amber" />
          </Section>
        )}
        {analysis.improvements.length > 0 && (
          <Section title="Improvement Suggestions" accent="violet">
            <BulletList items={analysis.improvements} color="violet" />
          </Section>
        )}
      </div>

      {/* Skills detected */}
      {analysis.skills_detected.length > 0 && (
        <Section title="Skills Detected">
          <div className="flex flex-wrap gap-2">
            {analysis.skills_detected.map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700"
              >
                {skill}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Extracted sections */}
      <ResumeSectionsView sections={analysis.sections} />
    </div>
  )
}

// ── Reusable presentational pieces ────────────────────────────────────────

function Section({
  title,
  accent,
  children,
}: {
  title: string
  accent?: string
  children: React.ReactNode
}) {
  const borderClass =
    accent === 'emerald'
      ? 'border-l-emerald-400'
      : accent === 'red'
        ? 'border-l-red-400'
        : accent === 'amber'
          ? 'border-l-amber-400'
          : accent === 'violet'
            ? 'border-l-violet-400'
            : 'border-l-slate-300'

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm border-l-4 ${borderClass}`}>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </div>
  )
}

function BulletList({ items, color }: { items: string[]; color: string }) {
  const dotColor =
    color === 'emerald'
      ? 'bg-emerald-400'
      : color === 'red'
        ? 'bg-red-400'
        : color === 'amber'
          ? 'bg-amber-400'
          : 'bg-violet-400'

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
          <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
          {item}
        </li>
      ))}
    </ul>
  )
}

function ResumeSectionsView({ sections }: { sections: ResumeAnalysis['sections'] }) {
  const hasEducation = sections.education.length > 0
  const hasExperience = sections.experience.length > 0
  const hasProjects = sections.projects.length > 0
  const hasCertifications = sections.certifications.length > 0

  if (!hasEducation && !hasExperience && !hasProjects && !hasCertifications) return null

  return (
    <>
      {hasEducation && (
        <Section title="Education">
          <div className="space-y-3">
            {sections.education.map((edu, i) => (
              <div key={i} className="text-sm text-slate-700">
                <p className="font-medium text-slate-900">
                  {edu.degree}
                  {edu.field_of_study ? ` in ${edu.field_of_study}` : ''}
                </p>
                <p className="text-slate-500">
                  {edu.institution}
                  {edu.year ? ` · ${edu.year}` : ''}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {hasExperience && (
        <Section title="Experience">
          <div className="space-y-3">
            {sections.experience.map((exp, i) => (
              <div key={i} className="text-sm text-slate-700">
                <p className="font-medium text-slate-900">
                  {exp.role}
                  {exp.company ? ` at ${exp.company}` : ''}
                </p>
                {exp.duration && <p className="text-xs text-slate-400">{exp.duration}</p>}
                {exp.description && <p className="mt-1 text-slate-600">{exp.description}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {hasProjects && (
        <Section title="Projects">
          <div className="space-y-3">
            {sections.projects.map((proj, i) => (
              <div key={i} className="text-sm text-slate-700">
                <p className="font-medium text-slate-900">{proj.name}</p>
                {proj.description && <p className="mt-0.5 text-slate-600">{proj.description}</p>}
                {proj.technologies.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {proj.technologies.map((tech) => (
                      <span
                        key={tech}
                        className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {hasCertifications && (
        <Section title="Certifications">
          <ul className="space-y-1">
            {sections.certifications.map((cert) => (
              <li key={cert} className="flex items-center gap-2 text-sm text-slate-700">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                {cert}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  )
}
