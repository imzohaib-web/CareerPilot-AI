import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Sparkles,
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  Layers,
  Sliders,
  Zap,
  RefreshCw,
} from 'lucide-react'

import { describeApiError } from '../services/apiClient'
import * as profileService from '../services/profile'
import * as roadmapService from '../services/roadmap'
import * as skillGapService from '../services/skillGap'
import type {
  RoadmapRequest,
  RoadmapResponse,
} from '../types'

export function RoadmapPage() {
  const [targetRole, setTargetRole] = useState('')
  const [skillGaps, setSkillGaps] = useState('')
  const [timeFrameWeeks, setTimeFrameWeeks] = useState(8)
  const [weeklyHours, setWeeklyHours] = useState(10)
  const [additionalContext, setAdditionalContext] = useState('')

  const [isLoading, setIsLoading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null)
  const [result, setResult] = useState<RoadmapResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importNotice, setImportNotice] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [showConfig, setShowConfig] = useState(true)

  // Load existing roadmap on initial mount
  const loadLatest = useCallback(async () => {
    try {
      const prev = await roadmapService.fetchLatestRoadmap()
      if (prev) {
        setResult(prev)
        setTargetRole(prev.target_role)
        setTimeFrameWeeks(prev.time_frame_weeks)
        setWeeklyHours(prev.weekly_hours)
        setShowConfig(false)
      }
    } catch (err) {
      setError(describeApiError(err).message)
    }
  }, [])

  useEffect(() => {
    loadLatest()
  }, [loadLatest])

  // One-click import from latest Skill Gap Analysis or Profile
  async function handleImportFromGaps() {
    setIsImporting(true)
    setError(null)
    setImportNotice(null)
    try {
      const gapDoc = await skillGapService.fetchLatestSkillGap()
      if (gapDoc) {
        setTargetRole(gapDoc.target_role)
        const combined = [
          ...gapDoc.analysis.missing_technical_skills,
          ...gapDoc.analysis.missing_soft_skills,
        ]
        setSkillGaps(combined.join(', '))
        setImportNotice(
          `Imported ${combined.length} skills from your latest Skill Gap analysis (${gapDoc.target_role})`
        )
        return
      }

      // Fallback: Check profile
      const profile = await profileService.fetchProfile()
      if (profile && profile.target_role) {
        setTargetRole(profile.target_role)
        setImportNotice(`Imported target role "${profile.target_role}" from your profile`)
        return
      }

      setError('No previous skill gap analysis or target role found. You can enter them manually.')
    } catch (err) {
      setError(describeApiError(err).message)
    } finally {
      setIsImporting(false)
    }
  }

  const canSubmit = targetRole.trim().length > 0 && !isLoading

  async function handleGenerate() {
    if (!canSubmit) return
    setError(null)
    setImportNotice(null)
    setIsLoading(true)

    const gapsList = skillGaps
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const payload: RoadmapRequest = {
      target_role: targetRole.trim(),
      skill_gaps: gapsList,
      time_frame_weeks: timeFrameWeeks,
      weekly_hours: weeklyHours,
      additional_context: additionalContext.trim() || undefined,
    }

    try {
      const next = await roadmapService.generateRoadmap(payload)
      setResult(next)
      setShowConfig(false)
    } catch (err) {
      setError(describeApiError(err).message)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleToggleTask(taskId: string) {
    if (!result) return
    const isCompleted = result.completed_tasks.includes(taskId)
    setTogglingTaskId(taskId)
    setError(null)

    // Optimistic UI update
    const prevCompleted = result.completed_tasks
    const nextCompleted = isCompleted
      ? prevCompleted.filter((id) => id !== taskId)
      : [...prevCompleted, taskId]

    setResult({ ...result, completed_tasks: nextCompleted })

    try {
      const updated = await roadmapService.toggleRoadmapTask(
        result.id,
        taskId,
        !isCompleted
      )
      setResult(updated)
    } catch (err) {
      // Revert on error
      setResult({ ...result, completed_tasks: prevCompleted })
      setError(describeApiError(err).message)
    } finally {
      setTogglingTaskId(null)
    }
  }

  // Calculate task completion metrics
  const { totalTasks, completedCount, percentage } = useMemo(() => {
    if (!result) return { totalTasks: 0, completedCount: 0, percentage: 0 }
    let count = 0
    for (const phase of result.roadmap.phases) {
      count += phase.tasks.length
    }
    const done = result.completed_tasks.length
    const pct = count > 0 ? Math.round((done / count) * 100) : 0
    return { totalTasks: count, completedCount: done, percentage: pct }
  }, [result])

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 border border-brand-200/60 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-brand-600" />
            <span>AI Curriculum Architect</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Personalized Learning Roadmap
          </h1>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">
            A structured, time-boxed learning journey designed by Qwen AI to systematically bridge your specific skill gaps.
          </p>
        </div>

        {result && (
          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition self-start sm:self-auto"
          >
            <Sliders className="h-4 w-4 text-slate-500" />
            <span>{showConfig ? 'Hide Settings' : 'Modify Parameters'}</span>
          </button>
        )}
      </div>

      {/* ── Configuration / Generator Drawer ────────────────────────────── */}
      {(!result || showConfig) && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-card space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {result ? 'Update Roadmap Parameters' : 'Generate Your Personalized Roadmap'}
              </h2>
              <p className="text-xs text-slate-500">
                Tailor the learning velocity, weekly study budget, and target focus skills.
              </p>
            </div>

            <button
              type="button"
              onClick={handleImportFromGaps}
              disabled={isImporting}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-50 border border-brand-200 px-3.5 py-2 text-xs font-bold text-brand-700 hover:bg-brand-100 disabled:opacity-50 transition shrink-0"
            >
              <Zap className="h-3.5 w-3.5 text-brand-600" />
              <span>{isImporting ? 'Importing…' : 'Import from Skill Gap'}</span>
            </button>
          </div>

          {importNotice && (
            <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{importNotice}</span>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Target Role <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="e.g. Fullstack Engineer, ML Architect"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Specific Skill Gaps / Focus Areas
              </label>
              <input
                type="text"
                value={skillGaps}
                onChange={(e) => setSkillGaps(e.target.value)}
                placeholder="e.g. Docker, Kubernetes, LangChain, System Design (comma-separated)"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between font-bold text-slate-700">
                <span>Timeframe Duration</span>
                <span className="text-brand-600">{timeFrameWeeks} Weeks</span>
              </div>
              <input
                type="range"
                min={2}
                max={24}
                step={2}
                value={timeFrameWeeks}
                onChange={(e) => setTimeFrameWeeks(Number(e.target.value))}
                className="w-full accent-brand-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>2 wks (Sprint)</span>
                <span>8 wks (Standard)</span>
                <span>16 wks</span>
                <span>24 wks (Deep)</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between font-bold text-slate-700">
                <span>Weekly Study Budget</span>
                <span className="text-brand-600">{weeklyHours} Hours / Week</span>
              </div>
              <input
                type="range"
                min={5}
                max={40}
                step={5}
                value={weeklyHours}
                onChange={(e) => setWeeklyHours(Number(e.target.value))}
                className="w-full accent-brand-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>5 hrs (Casual)</span>
                <span>10 hrs (Recommended)</span>
                <span>20 hrs</span>
                <span>40 hrs (Full-time)</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1.5 text-xs">
              Additional Goals / Notes (Optional)
            </label>
            <input
              type="text"
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              placeholder="e.g. Focus on portfolio projects, preparing for interviews next month"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition"
            />
          </div>

          {error && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-800">
              {error}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-brand-600/20 hover:brightness-110 active:scale-98 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Generating Custom Curriculum…</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>{result ? 'Regenerate Roadmap' : 'Generate Roadmap'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Active Roadmap Execution View ───────────────────────────────── */}
      {result && (
        <div className="space-y-8 animate-fade-in">
          {/* Progress Overview Card */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-card space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Active Learning Track
                </span>
                <h2 className="text-xl font-bold text-slate-900">{result.target_role}</h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    {result.time_frame_weeks} Weeks Total
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    {result.weekly_hours} hrs / week
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5 text-slate-400" />
                    {result.roadmap.phases.length} Structured Phases
                  </span>
                </div>
              </div>

              {/* Progress Stat */}
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <span className="text-2xl font-extrabold text-slate-900">{percentage}%</span>
                  <p className="text-[11px] font-medium text-slate-500">
                    {completedCount} of {totalTasks} tasks done
                  </p>
                </div>
              </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-600 to-indigo-600 transition-all duration-500"
                style={{ width: `${Math.max(percentage, 2)}%` }}
              />
            </div>

            {/* Filter Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-500 font-medium">Filter Tasks:</span>
              <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                {(['all', 'pending', 'completed'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setFilter(mode)}
                    className={`rounded-lg px-3 py-1 font-semibold capitalize transition ${
                      filter === mode
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Phase-by-Phase Roadmap Timeline */}
          <div className="space-y-6">
            {result.roadmap.phases.map((phase) => {
              const phaseTasks = phase.tasks.filter((task) => {
                const isDone = result.completed_tasks.includes(task.id)
                if (filter === 'pending') return !isDone
                if (filter === 'completed') return isDone
                return true
              })

              const completedInPhase = phase.tasks.filter((t) =>
                result.completed_tasks.includes(t.id)
              ).length

              return (
                <div
                  key={phase.phase_number}
                  className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-card space-y-5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 font-bold text-sm border border-brand-200">
                        {phase.phase_number}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">{phase.name}</h3>
                        <p className="text-xs text-slate-500">
                          Estimated Duration: {phase.duration_weeks} Weeks · Focus: {phase.focus}
                        </p>
                      </div>
                    </div>

                    <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full self-start sm:self-auto">
                      {completedInPhase} / {phase.tasks.length} Completed
                    </span>
                  </div>

                  {/* Tasks in Phase */}
                  <div className="space-y-2.5">
                    {phaseTasks.map((task) => {
                      const isCompleted = result.completed_tasks.includes(task.id)
                      const isToggling = togglingTaskId === task.id

                      return (
                        <div
                          key={task.id}
                          onClick={() => !isToggling && handleToggleTask(task.id)}
                          className={`group flex items-start gap-3 rounded-2xl border p-4 transition-all cursor-pointer select-none ${
                            isCompleted
                              ? 'border-emerald-200 bg-emerald-50/30'
                              : 'border-slate-200/80 bg-slate-50/40 hover:bg-white hover:border-brand-300 hover:shadow-xs'
                          }`}
                        >
                          <button
                            type="button"
                            disabled={isToggling}
                            className="mt-0.5 shrink-0 text-slate-400 group-hover:text-brand-600 transition"
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            ) : (
                              <Circle className="h-5 w-5 text-slate-300 group-hover:text-brand-400" />
                            )}
                          </button>

                          <div className="flex-1 space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <p
                                className={`text-xs font-bold leading-snug ${
                                  isCompleted ? 'text-slate-500 line-through' : 'text-slate-900'
                                }`}
                              >
                                {task.title}
                              </p>
                              {task.estimated_hours && (
                                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                  {task.estimated_hours}h
                                </span>
                              )}
                            </div>

                            {task.description && (
                              <p
                                className={`text-xs leading-relaxed ${
                                  isCompleted ? 'text-slate-400' : 'text-slate-600'
                                }`}
                              >
                                {task.description}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px]">
                              {task.skill && (
                                <span className="rounded bg-brand-50 px-2 py-0.5 font-semibold text-brand-700">
                                  {task.skill}
                                </span>
                              )}
                              {task.milestone && (
                                <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                                  Milestone: {task.milestone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {phaseTasks.length === 0 && (
                      <p className="py-4 text-center text-xs text-slate-400 font-medium">
                        No tasks match the current filter ({filter}).
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
