import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Award,
  Briefcase,
  GraduationCap,
  FolderGit2,
  ShieldCheck,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react'

import { describeApiError } from '../services/apiClient'
import * as resumeService from '../services/resume'
import type { ResumeAnalysis, ResumeAnalysisResponse } from '../types'

const MAX_FILE_SIZE_MB = 5
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

// ── Score Helpers ────────────────────────────────────────────────────────

function scoreBg(score: number): string {
  if (score >= 75) return 'bg-emerald-50 border-emerald-200 text-emerald-800'
  if (score >= 50) return 'bg-amber-50 border-amber-200 text-amber-800'
  return 'bg-rose-50 border-rose-200 text-rose-800'
}

function scoreRing(score: number): string {
  if (score >= 75) return 'border-emerald-500'
  if (score >= 50) return 'border-amber-500'
  return 'border-rose-500'
}

// ── Main Page Component ──────────────────────────────────────────────────

export function ResumeAnalyzerPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

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

  // ── File validation & selection ────────────────────────────────────────

  function validateAndSetFile(file: File) {
    setFileError(null)
    setSelectedFile(null)

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setFileError('Only PDF files are accepted. Please select a valid .pdf file.')
      return
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError(
        `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is ${MAX_FILE_SIZE_MB} MB.`
      )
      return
    }

    if (file.size === 0) {
      setFileError('The selected PDF file is empty.')
      return
    }

    setSelectedFile(file)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) validateAndSetFile(file)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) validateAndSetFile(file)
  }

  // ── Submit for Analysis ────────────────────────────────────────────────

  async function handleAnalyze() {
    if (!selectedFile || isAnalyzing) return
    setAnalysisError(null)
    setIsAnalyzing(true)

    try {
      const data = await resumeService.analyzeResume(selectedFile)
      setResult(data)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setAnalysisError(describeApiError(err).message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 border border-brand-200/60 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-brand-600" />
            <span>Alibaba Cloud Qwen AI Parser</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Resume Analyzer & ATS Optimizer
          </h1>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">
            Upload your resume to extract validated skills, audit ATS readability, and discover high-priority enhancements.
          </p>
        </div>

        {result && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 self-start sm:self-auto rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
          >
            <UploadCloud className="h-4 w-4 text-slate-500" />
            <span>Analyze New Resume</span>
          </button>
        )}
      </div>

      {/* ── Upload Card / Dropzone ───────────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-card space-y-6">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-brand-500 bg-brand-50/50 scale-[0.99]'
              : selectedFile
              ? 'border-emerald-400 bg-emerald-50/20'
              : 'border-slate-200 hover:border-brand-400 hover:bg-slate-50/60'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            disabled={isAnalyzing}
            className="hidden"
          />

          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 mb-3 shadow-xs">
            {selectedFile ? (
              <FileText className="h-7 w-7 text-emerald-600" />
            ) : (
              <UploadCloud className="h-7 w-7 text-brand-600 animate-pulse-subtle" />
            )}
          </div>

          {selectedFile ? (
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-900">{selectedFile.name}</p>
              <p className="text-xs text-slate-500">
                {(selectedFile.size / 1024).toFixed(0)} KB · Ready to analyze
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-900">
                Click to browse or drag and drop your PDF resume
              </p>
              <p className="text-xs text-slate-500">
                Supports PDF with selectable text up to {MAX_FILE_SIZE_MB} MB
              </p>
            </div>
          )}
        </div>

        {fileError && (
          <div className="flex items-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs font-medium text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{fileError}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>Evaluated securely using Alibaba Cloud Qwen-Max</span>
          </div>

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!selectedFile || isAnalyzing}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-600/20 hover:brightness-110 active:scale-98 transition-all disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Qwen is analyzing your resume…</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Analyze Resume</span>
              </>
            )}
          </button>
        </div>

        {isAnalyzing && (
          <div className="rounded-2xl bg-brand-50/60 border border-brand-200 p-4 text-xs text-brand-800 flex items-center gap-3 animate-pulse">
            <Sparkles className="h-4 w-4 text-brand-600 shrink-0" />
            <span>
              Extracting structural sections, technical competencies, and ATS score metrics. This takes ~15 seconds...
            </span>
          </div>
        )}

        {analysisError && (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs font-medium text-rose-800">
            {analysisError}
          </div>
        )}
      </div>

      {/* ── Error loading previous analysis ──────────────────────────────── */}
      {loadError && !result && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800 flex items-center justify-between">
          <span>Could not restore your previous resume analysis: {loadError}</span>
          <button type="button" onClick={loadLatest} className="font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {/* ── Active Analysis Results ──────────────────────────────────────── */}
      {result && <AnalysisResultsView result={result} />}

      {/* ── Seamless Next Step Bridge ────────────────────────────────────── */}
      {result && (
        <div className="rounded-3xl bg-gradient-to-r from-brand-900 to-indigo-950 p-6 sm:p-7 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-300">
              Next Step in Journey
            </span>
            <h3 className="text-lg font-bold text-white">Compare Skills Against a Target Job</h3>
            <p className="text-xs text-slate-300">
              Use your detected skills to run an automated Skill Gap Analysis for any job description.
            </p>
          </div>
          <Link
            to="/skill-gap"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-slate-900 shadow-md hover:bg-brand-50 transition shrink-0"
          >
            <span>Analyze Skill Gaps</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  )
}

// ── Results Presentation Component ───────────────────────────────────────

function AnalysisResultsView({ result }: { result: ResumeAnalysisResponse }) {
  const { analysis } = result
  const analyzedDate = new Date(result.analyzed_at).toLocaleString()

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Overview Score Card */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">Resume Evaluation Results</h2>
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[10px] font-bold text-brand-700 border border-brand-200">
              {result.model}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Document: <span className="font-semibold text-slate-700">{result.filename}</span> · Analyzed on {analyzedDate}
          </p>
        </div>

        {/* ATS Score Radial */}
        <div className="flex items-center gap-4">
          <div
            className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl border-4 shadow-sm font-black text-2xl ${scoreRing(
              analysis.score
            )} ${scoreBg(analysis.score)}`}
          >
            {analysis.score}
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              ATS Readiness Tier
            </span>
            <p className="text-base font-bold text-slate-900">
              {analysis.score >= 75
                ? 'Strong & Highly Competitive'
                : analysis.score >= 50
                ? 'Good Foundation'
                : 'Action Required'}
            </p>
            <p className="text-xs text-slate-500">
              {analysis.score >= 75
                ? 'Ready for automated screening'
                : 'Follow suggestions below to improve match'}
            </p>
          </div>
        </div>
      </div>

      {/* Executive Summary */}
      {analysis.summary && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-brand-600" />
            <h3 className="text-sm font-bold text-slate-900">Executive Summary</h3>
          </div>
          <p className="text-sm leading-relaxed text-slate-700">{analysis.summary}</p>
        </div>
      )}

      {/* 2-Column: Strengths & Weaknesses */}
      <div className="grid gap-6 md:grid-cols-2">
        {analysis.strengths.length > 0 && (
          <div className="rounded-3xl border border-emerald-200/80 bg-emerald-50/20 p-6 sm:p-7 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-emerald-900">Key Strengths Detected</h3>
            </div>
            <ul className="space-y-2.5">
              {analysis.strengths.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {analysis.weaknesses.length > 0 && (
          <div className="rounded-3xl border border-rose-200/80 bg-rose-50/20 p-6 sm:p-7 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="h-5 w-5 text-rose-600" />
              <h3 className="text-sm font-bold text-rose-900">Critical Weaknesses & ATS Blockers</h3>
            </div>
            <ul className="space-y-2.5">
              {analysis.weaknesses.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Missing Info & Actionable Improvements */}
      <div className="grid gap-6 md:grid-cols-2">
        {analysis.missing_info.length > 0 && (
          <div className="rounded-3xl border border-amber-200/80 bg-amber-50/20 p-6 sm:p-7 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h3 className="text-sm font-bold text-amber-900">Missing Information</h3>
            </div>
            <ul className="space-y-2.5">
              {analysis.missing_info.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {analysis.improvements.length > 0 && (
          <div className="rounded-3xl border border-brand-200/80 bg-brand-50/20 p-6 sm:p-7 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-brand-600" />
              <h3 className="text-sm font-bold text-brand-900">Suggested Action Items</h3>
            </div>
            <ul className="space-y-2.5">
              {analysis.improvements.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Extracted Skills Cloud */}
      {analysis.skills_detected.length > 0 && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900">Extracted Skills ({analysis.skills_detected.length})</h3>
            <span className="text-[11px] font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
              Automated Extraction
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {analysis.skills_detected.map((skill) => (
              <span
                key={skill}
                className="rounded-xl bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-800"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Extracted Structural Resume Sections */}
      <ExtractedSectionsView sections={analysis.sections} />
    </div>
  )
}

function ExtractedSectionsView({ sections }: { sections: ResumeAnalysis['sections'] }) {
  const hasEducation = sections.education.length > 0
  const hasExperience = sections.experience.length > 0
  const hasProjects = sections.projects.length > 0
  const hasCertifications = sections.certifications.length > 0

  if (!hasEducation && !hasExperience && !hasProjects && !hasCertifications) return null

  return (
    <div className="space-y-6">
      <h3 className="text-base font-bold text-slate-900">Parsed Resume Structure</h3>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Education */}
        {hasEducation && (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="h-5 w-5 text-brand-600" />
              <h4 className="text-sm font-bold text-slate-900">Education</h4>
            </div>
            <div className="space-y-4">
              {sections.education.map((edu, idx) => (
                <div key={idx} className="border-l-2 border-brand-200 pl-3 space-y-0.5">
                  <p className="text-xs font-bold text-slate-900">
                    {edu.degree} {edu.field_of_study ? `in ${edu.field_of_study}` : ''}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {edu.institution} {edu.year ? `· ${edu.year}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Experience */}
        {hasExperience && (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="h-5 w-5 text-brand-600" />
              <h4 className="text-sm font-bold text-slate-900">Work Experience</h4>
            </div>
            <div className="space-y-4">
              {sections.experience.map((exp, idx) => (
                <div key={idx} className="border-l-2 border-brand-200 pl-3 space-y-0.5">
                  <p className="text-xs font-bold text-slate-900">{exp.role}</p>
                  <p className="text-[11px] font-medium text-slate-600">
                    {exp.company} {exp.duration ? `· ${exp.duration}` : ''}
                  </p>
                  {exp.description && (
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                      {exp.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Projects */}
        {hasProjects && (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <FolderGit2 className="h-5 w-5 text-brand-600" />
              <h4 className="text-sm font-bold text-slate-900">Projects</h4>
            </div>
            <div className="space-y-4">
              {sections.projects.map((proj, idx) => (
                <div key={idx} className="border-l-2 border-brand-200 pl-3 space-y-1">
                  <p className="text-xs font-bold text-slate-900">{proj.name}</p>
                  {proj.description && (
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      {proj.description}
                    </p>
                  )}
                  {proj.technologies.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {proj.technologies.map((t) => (
                        <span
                          key={t}
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Certifications */}
        {hasCertifications && (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <Award className="h-5 w-5 text-brand-600" />
              <h4 className="text-sm font-bold text-slate-900">Certifications</h4>
            </div>
            <div className="space-y-2">
              {sections.certifications.map((cert, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-slate-700">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>{cert}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
