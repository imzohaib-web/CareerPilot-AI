import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
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
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Resume Analyzer & ATS Optimizer
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 max-w-2xl">
            Upload your resume to extract skills, evaluate ATS readability, and identify key enhancements.
          </p>
        </div>

        {result && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary self-start sm:self-auto text-xs py-1.5 px-3"
          >
            <UploadCloud className="h-3.5 w-3.5 text-slate-500" />
            <span>Upload New Resume</span>
          </button>
        )}
      </div>

      {/* ── Upload Card / Dropzone ───────────────────────────────────────── */}
      <div className="clean-card p-5 sm:p-6 space-y-4">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 sm:p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/40'
              : selectedFile
              ? 'border-emerald-400 bg-emerald-50/20'
              : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
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

          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 mb-2 shadow-xs">
            {selectedFile ? (
              <FileText className="h-5 w-5 text-emerald-600" />
            ) : (
              <UploadCloud className="h-5 w-5 text-slate-500" />
            )}
          </div>

          {selectedFile ? (
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-slate-900">{selectedFile.name}</p>
              <p className="text-[11px] text-slate-500">
                {(selectedFile.size / 1024).toFixed(0)} KB · Ready to analyze
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-slate-900">
                Click to browse or drag and drop your PDF resume
              </p>
              <p className="text-[11px] text-slate-500">
                PDF format up to {MAX_FILE_SIZE_MB} MB
              </p>
            </div>
          )}
        </div>

        {fileError && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-medium text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{fileError}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
            <span>Analyzed securely via Alibaba Cloud Qwen-Max</span>
          </div>

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!selectedFile || isAnalyzing}
            className="w-full sm:w-auto btn-primary text-xs py-2 px-4"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Analyzing resume…</span>
              </>
            ) : (
              <>
                <FileText className="h-3.5 w-3.5" />
                <span>Analyze Resume</span>
              </>
            )}
          </button>
        </div>

        {isAnalyzing && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 flex items-center gap-2.5">
            <RefreshCw className="h-4 w-4 text-slate-500 animate-spin shrink-0" />
            <span>
              Extracting structural sections, skills, and ATS score metrics (~10-15s)...
            </span>
          </div>
        )}

        {analysisError && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-medium text-rose-800">
            {analysisError}
          </div>
        )}
      </div>

      {/* ── Error loading previous analysis ──────────────────────────────── */}
      {loadError && !result && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex items-center justify-between">
          <span>Could not restore previous analysis: {loadError}</span>
          <button type="button" onClick={loadLatest} className="font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {/* ── Active Analysis Results ──────────────────────────────────────── */}
      {result && <AnalysisResultsView result={result} />}

      {/* ── Seamless Next Step Bridge ────────────────────────────────────── */}
      {result && (
        <div className="clean-card p-5 sm:p-6 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Next Step
            </span>
            <h3 className="text-sm font-semibold text-white">Compare Skills Against a Target Job</h3>
            <p className="text-xs text-slate-400">
              Run automated Skill Gap Analysis using your parsed resume skills.
            </p>
          </div>
          <Link
            to="/skill-gap"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100 transition shrink-0"
          >
            <span>Analyze Skill Gaps</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  )
}

// ── Results Presentation Component ───────────────────────────────────────

function AnalysisResultsView({ result }: { result: ResumeAnalysisResponse }) {
  const { analysis } = result
  const analyzedDate = new Date(result.analyzed_at).toLocaleDateString()

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Overview Score Card */}
      <div className="clean-card p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Evaluation Summary</h2>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200">
              {result.model}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Document: <span className="font-medium text-slate-700">{result.filename}</span> · Analyzed {analyzedDate}
          </p>
        </div>

        {/* ATS Score Radial */}
        <div className="flex items-center gap-3.5">
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 font-bold text-xl ${scoreRing(
              analysis.score
            )} ${scoreBg(analysis.score)}`}
          >
            {analysis.score}
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              ATS Readiness Tier
            </span>
            <p className="text-sm font-bold text-slate-900">
              {analysis.score >= 75
                ? 'Competitive'
                : analysis.score >= 50
                ? 'Good Foundation'
                : 'Action Required'}
            </p>
            <p className="text-[11px] text-slate-500">
              {analysis.score >= 75
                ? 'Ready for automated screening'
                : 'Follow suggestions below to improve match'}
            </p>
          </div>
        </div>
      </div>

      {/* Executive Summary */}
      {analysis.summary && (
        <div className="clean-card p-5 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Lightbulb className="h-4 w-4 text-slate-600" />
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              Executive Summary
            </h3>
          </div>
          <p className="text-xs leading-relaxed text-slate-700">{analysis.summary}</p>
        </div>
      )}

      {/* 2-Column: Strengths & Weaknesses */}
      <div className="grid gap-4 md:grid-cols-2">
        {analysis.strengths.length > 0 && (
          <div className="clean-card p-5 border-emerald-200/80 bg-emerald-50/20">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <h3 className="text-xs font-semibold text-emerald-900 uppercase tracking-wider">
                Key Strengths Detected
              </h3>
            </div>
            <ul className="space-y-2">
              {analysis.strengths.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {analysis.weaknesses.length > 0 && (
          <div className="clean-card p-5 border-rose-200/80 bg-rose-50/20">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-4 w-4 text-rose-600" />
              <h3 className="text-xs font-semibold text-rose-900 uppercase tracking-wider">
                Critical ATS Gaps
              </h3>
            </div>
            <ul className="space-y-2">
              {analysis.weaknesses.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Missing Info & Actionable Improvements */}
      <div className="grid gap-4 md:grid-cols-2">
        {analysis.missing_info.length > 0 && (
          <div className="clean-card p-5 border-amber-200/80 bg-amber-50/20">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <h3 className="text-xs font-semibold text-amber-900 uppercase tracking-wider">
                Missing Information
              </h3>
            </div>
            <ul className="space-y-2">
              {analysis.missing_info.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {analysis.improvements.length > 0 && (
          <div className="clean-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-slate-700" />
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                Recommended Action Items
              </h3>
            </div>
            <ul className="space-y-2">
              {analysis.improvements.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Extracted Skills Cloud */}
      {analysis.skills_detected.length > 0 && (
        <div className="clean-card p-5">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              Extracted Skills ({analysis.skills_detected.length})
            </h3>
            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              Extracted from Resume
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {analysis.skills_detected.map((skill) => (
              <span
                key={skill}
                className="rounded-md bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-800"
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
    <div className="space-y-4 pt-2">
      <h3 className="text-sm font-semibold text-slate-900">Parsed Resume Content</h3>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Education */}
        {hasEducation && (
          <div className="clean-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <GraduationCap className="h-4 w-4 text-slate-700" />
              <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Education</h4>
            </div>
            <div className="space-y-3">
              {sections.education.map((edu, idx) => (
                <div key={idx} className="border-l-2 border-slate-200 pl-3 space-y-0.5">
                  <p className="text-xs font-semibold text-slate-900">
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
          <div className="clean-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Briefcase className="h-4 w-4 text-slate-700" />
              <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Work Experience</h4>
            </div>
            <div className="space-y-3">
              {sections.experience.map((exp, idx) => (
                <div key={idx} className="border-l-2 border-slate-200 pl-3 space-y-0.5">
                  <p className="text-xs font-semibold text-slate-900">{exp.role}</p>
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
          <div className="clean-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <FolderGit2 className="h-4 w-4 text-slate-700" />
              <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Projects</h4>
            </div>
            <div className="space-y-3">
              {sections.projects.map((proj, idx) => (
                <div key={idx} className="border-l-2 border-slate-200 pl-3 space-y-0.5">
                  <p className="text-xs font-semibold text-slate-900">{proj.name}</p>
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
          <div className="clean-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Award className="h-4 w-4 text-slate-700" />
              <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Certifications</h4>
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
