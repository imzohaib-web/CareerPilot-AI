import { useCallback, useEffect, useMemo, useState } from 'react'

import { describeApiError } from '../services/apiClient'
import * as profileService from '../services/profile'
import * as roadmapService from '../services/roadmap'
import * as skillGapService from '../services/skillGap'
import type {
  RoadmapPhase,
  RoadmapRequest,
  RoadmapResponse,
  RoadmapTask,
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
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Personalized Roadmap</h1>
          <p className="mt-1 text-sm text-slate-500">
            A structured, time-boxed learning journey to bridge your skill gaps and land your target role.
          </p>
        </div>
        {result && (
          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            {showConfig ? 'Hide Settings' : 'Modify & Regenerate'}
          </button>
        )}
      </div>

      {/* Configuration / Input Panel */}
      {(!result || showConfig) && (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              {result ? 'Configure Roadmap Parameters' : 'Generate Your Personalized Roadmap'}
            </h2>
            <button
              type="button"
              onClick={handleImportFromGaps}
              disabled={isImporting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-60 transition"
            >
              ⚡ {isImporting ? 'Importing…' : 'Import from Skill Gap'}
            </button>
          </div>

          {importNotice && (
            <div className="mt-4 rounded-lg bg-emerald-50 px-3.5 py-2 text-xs font-medium text-emerald-700">
              ✓ {importNotice}
            </div>
          )}

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Target Role <span className="text-red-500">*</span>
                <input
                  type="text"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g. Frontend Developer, DevOps Engineer"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-violet-500 focus:outline-none"
                />
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Skill Gaps / Topics to Focus On
                <input
                  type="text"
                  value={skillGaps}
                  onChange={(e) => setSkillGaps(e.target.value)}
                  placeholder="e.g. TypeScript, Docker, CI/CD, Redis (comma-separated)"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-violet-500 focus:outline-none"
                />
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Timeframe ({timeFrameWeeks} weeks)
                <input
                  type="range"
                  min={2}
                  max={24}
                  step={2}
                  value={timeFrameWeeks}
                  onChange={(e) => setTimeFrameWeeks(Number(e.target.value))}
                  className="mt-2 w-full accent-violet-600 cursor-pointer"
                />
                <div className="mt-1 flex justify-between text-xs text-slate-400">
                  <span>2 weeks</span>
                  <span>8 weeks</span>
                  <span>16 weeks</span>
                  <span>24 weeks</span>
                </div>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Weekly Study Budget ({weeklyHours} hours/week)
                <input
                  type="range"
                  min={5}
                  max={40}
                  step={5}
                  value={weeklyHours}
                  onChange={(e) => setWeeklyHours(Number(e.target.value))}
                  className="mt-2 w-full accent-violet-600 cursor-pointer"
                />
                <div className="mt-1 flex justify-between text-xs text-slate-400">
                  <span>5 hrs</span>
                  <span>10 hrs</span>
                  <span>20 hrs</span>
                  <span>40 hrs</span>
                </div>
              </label>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700">
              Additional Goals or Notes (Optional)
              <input
                type="text"
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder="e.g. Prefer hands-on project building, preparing for interviews next month"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-violet-500 focus:outline-none"
              />
            </label>
          </div>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canSubmit}
              className="rounded-lg bg-violet-600 px-6 py-2.5 font-medium text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60 transition"
            >
              {isLoading ? 'Architecting Roadmap with AI…' : 'Generate Roadmap'}
            </button>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-violet-600 mb-3 animate-pulse">
            🗺️
          </div>
          <h3 className="text-base font-semibold text-slate-900">
            Designing your curriculum with Qwen AI…
          </h3>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            Prioritizing high-yield topics, structuring project milestones, and tailoring time allocations for {targetRole}.
          </p>
        </div>
      )}

      {/* Roadmap Content */}
      {result && !isLoading && (
        <div className="mt-8 space-y-8">
          {/* Overview Banner */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-violet-700">
                    {result.target_role}
                  </span>
                  <span className="text-xs text-slate-400">
                    {result.time_frame_weeks} Weeks • {result.weekly_hours} hrs/week
                  </span>
                </div>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                  {result.roadmap.title || `${result.target_role} Learning Roadmap`}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 max-w-3xl">
                  {result.roadmap.summary}
                </p>
              </div>

              {/* Progress Dial */}
              <div className="flex shrink-0 flex-col items-center justify-center rounded-2xl bg-slate-50 p-4 border border-slate-100 min-w-[150px]">
                <div className="text-2xl font-bold text-violet-600">{percentage}%</div>
                <div className="text-xs font-medium text-slate-500 mt-0.5">
                  {completedCount} of {totalTasks} tasks done
                </div>
                <div className="mt-2 h-2 w-28 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-violet-600 transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
              <div className="flex gap-2">
                {(['all', 'pending', 'completed'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setFilter(mode)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                      filter === mode
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <div className="text-xs text-slate-400">
                Created {new Date(result.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Phases List */}
          <div className="space-y-6">
            {result.roadmap.phases.map((phase) => (
              <PhaseCard
                key={phase.phase_number}
                phase={phase}
                completedTasks={result.completed_tasks}
                togglingTaskId={togglingTaskId}
                filter={filter}
                onToggleTask={handleToggleTask}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PhaseCard({
  phase,
  completedTasks,
  togglingTaskId,
  filter,
  onToggleTask,
}: {
  phase: RoadmapPhase
  completedTasks: string[]
  togglingTaskId: string | null
  filter: 'all' | 'pending' | 'completed'
  onToggleTask: (taskId: string) => void
}) {
  const visibleTasks = phase.tasks.filter((task) => {
    const isDone = completedTasks.includes(task.id)
    if (filter === 'completed') return isDone
    if (filter === 'pending') return !isDone
    return true
  })

  const phaseDoneCount = phase.tasks.filter((t) => completedTasks.includes(t.id)).length
  const phaseAllDone = phase.tasks.length > 0 && phaseDoneCount === phase.tasks.length

  return (
    <div
      className={`rounded-2xl border transition-shadow bg-white shadow-sm overflow-hidden ${
        phaseAllDone ? 'border-emerald-200' : 'border-slate-200'
      }`}
    >
      {/* Phase Header */}
      <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                phaseAllDone
                  ? 'bg-emerald-600 text-white'
                  : 'bg-violet-600 text-white'
              }`}
            >
              {phaseAllDone ? '✓' : phase.phase_number}
            </span>
            <h3 className="text-base font-semibold text-slate-900">{phase.name}</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-white border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600">
              ⏱ {phase.duration_weeks} {phase.duration_weeks === 1 ? 'week' : 'weeks'}
            </span>
            <span className="text-xs font-medium text-slate-500">
              {phaseDoneCount}/{phase.tasks.length} completed
            </span>
          </div>
        </div>
        {phase.focus && (
          <p className="mt-2 text-xs leading-relaxed text-slate-600">{phase.focus}</p>
        )}
      </div>

      {/* Task List */}
      <div className="divide-y divide-slate-100 p-2 sm:p-4">
        {visibleTasks.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            No tasks match the "{filter}" filter in this phase.
          </div>
        ) : (
          visibleTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              isCompleted={completedTasks.includes(task.id)}
              isToggling={togglingTaskId === task.id}
              onToggle={() => onToggleTask(task.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function TaskRow({
  task,
  isCompleted,
  isToggling,
  onToggle,
}: {
  task: RoadmapTask
  isCompleted: boolean
  isToggling: boolean
  onToggle: () => void
}) {
  return (
    <div
      className={`rounded-xl p-4 transition-colors ${
        isCompleted ? 'bg-emerald-50/40' : 'hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start gap-3.5">
        <button
          type="button"
          onClick={onToggle}
          disabled={isToggling}
          aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as completed'}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
            isCompleted
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : 'border-slate-300 bg-white hover:border-violet-500'
          } ${isToggling ? 'opacity-50' : ''}`}
        >
          {isCompleted && (
            <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4
              className={`text-sm font-semibold transition ${
                isCompleted ? 'text-slate-500 line-through' : 'text-slate-900'
              }`}
            >
              {task.title}
            </h4>
            {task.skill && (
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                {task.skill}
              </span>
            )}
            {task.estimated_hours > 0 && (
              <span className="text-[11px] text-slate-400">
                ~{task.estimated_hours} hrs
              </span>
            )}
          </div>

          {task.description && (
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              {task.description}
            </p>
          )}

          {/* Action item */}
          {task.action && (
            <div className="mt-2.5 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700 border border-slate-100">
              <span className="font-semibold text-slate-800">Action: </span>
              {task.action}
            </div>
          )}

          {/* Milestone and Resource footer */}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            {task.milestone && (
              <div className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md">
                <span>🏆</span>
                <span className="font-medium">{task.milestone}</span>
              </div>
            )}
            {task.resource && (
              <div className="inline-flex items-center gap-1 text-violet-700 bg-violet-50 px-2.5 py-1 rounded-md">
                <span>📚</span>
                <span className="font-medium">{task.resource}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
