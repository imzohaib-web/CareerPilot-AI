import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flame,
  Map as MapIcon,
} from 'lucide-react'

import { Button } from '../components/ui/Button'
import { describeApiError } from '../services/apiClient'
import * as learningService from '../services/learning'
import type { StudyCalendarResponse } from '../types'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dateFromKey(value: string): Date {
  return new Date(`${value}T12:00:00`)
}

export function StudyCalendarPage() {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDay, setSelectedDay] = useState(() => dayKey(new Date()))
  const [data, setData] = useState<StudyCalendarResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [minutes, setMinutes] = useState(30)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const loadCalendar = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setData(await learningService.fetchStudyCalendar(monthKey(visibleMonth), TIMEZONE))
    } catch (err) {
      setError(describeApiError(err).message)
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [visibleMonth])

  useEffect(() => {
    void loadCalendar()
  }, [loadCalendar])

  const recordsByDay = useMemo(
    () => new Map(data?.days.map((entry) => [entry.date, entry]) ?? []),
    [data?.days],
  )
  const selectedRecord = recordsByDay.get(selectedDay)

  useEffect(() => {
    setMinutes(selectedRecord?.minutes || 30)
    setNote(selectedRecord?.note ?? '')
  }, [selectedDay, selectedRecord])

  const calendarCells = useMemo(() => {
    const year = visibleMonth.getFullYear()
    const month = visibleMonth.getMonth()
    const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    return [
      ...Array.from({ length: leadingBlanks }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => new Date(year, month, index + 1)),
    ]
  }, [visibleMonth])

  const monthLabel = visibleMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
  const today = dayKey(new Date())
  const startDate = data?.roadmap_start_date ?? ''
  const isSelectedDayAllowed = selectedDay >= startDate && selectedDay <= today
  function shiftMonth(offset: number) {
    const nextMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + offset,
      1,
    )
    setVisibleMonth(nextMonth)
    setSelectedDay(dayKey(nextMonth))
  }

  async function saveSelectedDay(completed: boolean) {
    if (!isSelectedDayAllowed) return
    setIsSaving(true)
    setError(null)
    try {
      await learningService.updateStudyDay(selectedDay, {
        completed,
        minutes: completed ? minutes : 0,
        note: completed ? note.trim() : '',
      })
      await loadCalendar()
    } catch (err) {
      setError(describeApiError(err).message)
    } finally {
      setIsSaving(false)
    }
  }

  async function changeAlertThreshold(value: number) {
    if (!data) return
    setIsSaving(true)
    setError(null)
    try {
      await learningService.updateStudyPreferences({
        missed_day_threshold: value,
        timezone: TIMEZONE,
      })
      await loadCalendar()
    } catch (err) {
      setError(describeApiError(err).message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-brand-50 p-2.5 text-brand-700">
            <CalendarDays className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-700">
              Roadmap habit tracker
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              Learning calendar
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Log each learning day and see your progress stay tied to your account.
            </p>
          </div>
        </div>
        <Link
          to="/roadmap"
          className="inline-flex min-h-10 items-center gap-2 self-start rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 sm:self-auto"
        >
          <MapIcon className="h-4 w-4" aria-hidden="true" />
          View roadmap
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </header>

      {error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-rose-800">{error}</p>
          <div className="flex shrink-0 gap-3">
            <button
              type="button"
              onClick={() => void loadCalendar()}
              className="text-sm font-semibold text-rose-800 underline"
            >
              Retry
            </button>
            <Link to="/roadmap" className="text-sm font-semibold text-rose-800 underline">
              Open roadmap
            </Link>
          </div>
        </div>
      )}

      {data?.missed_alert && (
        <section
          role="status"
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
        >
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-amber-900">Learning reminder</h2>
            <p className="mt-1 text-sm text-amber-800">{data.missed_alert}</p>
          </div>
        </section>
      )}

      {data && (
        <>
          {data.storage_mode === 'memory' && (
            <section
              role="status"
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900"
            >
              Database is offline. Learning logs are temporarily held in memory and may not survive a
              backend restart; reconnect MongoDB for durable account history.
            </section>
          )}
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
              <p className="text-xs font-medium text-slate-500">Roadmap</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                {data.roadmap_title}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Tracking since {dateFromKey(data.roadmap_start_date).toLocaleDateString()}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
              <p className="text-xs font-medium text-slate-500">Days logged this month</p>
              <p className="mt-1 flex items-center gap-2 text-xl font-bold text-slate-900">
                <Check className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                {data.days.length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
              <p className="text-xs font-medium text-slate-500">Consecutive missed days</p>
              <p className="mt-1 flex items-center gap-2 text-xl font-bold text-slate-900">
                <Flame
                  className={`h-5 w-5 ${data.active_missed_days ? 'text-amber-600' : 'text-slate-400'}`}
                  aria-hidden="true"
                />
                {data.active_missed_days}
              </p>
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.8fr)]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">{monthLabel}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Select a day on or after your roadmap started.
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label="Previous month"
                    onClick={() => shiftMonth(-1)}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next month"
                    onClick={() => shiftMonth(1)}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {isLoading ? (
                <div className="grid grid-cols-7 gap-2" aria-label="Loading calendar">
                  {Array.from({ length: 35 }, (_, index) => (
                    <div key={index} className="aspect-square animate-pulse rounded-xl bg-slate-100" />
                  ))}
                </div>
              ) : data ? (
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {WEEKDAYS.map((weekday) => (
                    <div key={weekday} className="py-1 text-center text-[10px] font-semibold text-slate-500 sm:text-xs">
                      {weekday}
                    </div>
                  ))}
                  {calendarCells.map((day, index) => {
                    if (!day) return <div key={`blank-${index}`} aria-hidden="true" />
                    const key = dayKey(day)
                    const record = recordsByDay.get(key)
                    const isFuture = key > today
                    const beforeRoadmap = key < startDate
                    const isSelected = key === selectedDay
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={isFuture || beforeRoadmap}
                        onClick={() => setSelectedDay(key)}
                        aria-label={`${day.toLocaleDateString(undefined, { dateStyle: 'full' })}${record ? `, studied ${record.minutes} minutes` : ''}`}
                        aria-pressed={isSelected}
                        className={`relative flex aspect-square min-h-10 flex-col items-center justify-center rounded-xl border text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:min-h-12 ${
                          record
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                            : isSelected
                              ? 'border-brand-500 bg-brand-50 text-brand-800'
                              : isFuture || beforeRoadmap
                                ? 'cursor-not-allowed border-transparent bg-slate-50 text-slate-300'
                                : 'border-slate-100 bg-white text-slate-700 hover:border-brand-200 hover:bg-brand-50'
                        }`}
                      >
                        {day.getDate()}
                        {record && (
                          <span className="mt-0.5 flex items-center gap-0.5 text-[9px] font-medium">
                            <Check className="h-2.5 w-2.5" aria-hidden="true" />
                            <span className="hidden sm:inline">Done</span>
                          </span>
                        )}
                        {key === today && (
                          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-brand-600" />
                        )}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <CalendarDays className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
                  <h2 className="mt-3 text-sm font-semibold text-slate-900">Generate a roadmap to begin</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Your daily calendar starts when your roadmap is created.
                  </p>
                  <Link
                    to="/roadmap"
                    className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-xs font-semibold text-white hover:bg-brand-700"
                  >
                    Create roadmap
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm border border-emerald-200 bg-emerald-100" />
                  Learning logged
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm border border-slate-200 bg-white" />
                  Not logged
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />
                  Today
                </span>
              </div>
            </div>

            <aside className="space-y-4">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-brand-600" aria-hidden="true" />
                  <h2 className="text-sm font-bold text-slate-900">Log a learning day</h2>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {dateFromKey(selectedDay).toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
                {selectedRecord && (
                  <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    Already logged: {selectedRecord.minutes} minutes
                    {selectedRecord.note ? ` · ${selectedRecord.note}` : ''}
                  </p>
                )}
                <label className="mt-4 block text-xs font-semibold text-slate-700" htmlFor="study-minutes">
                  Learning time (minutes)
                </label>
                <input
                  id="study-minutes"
                  type="number"
                  min={1}
                  max={1440}
                  value={minutes}
                  onChange={(event) => setMinutes(Math.max(1, Math.min(1440, Number(event.target.value) || 1)))}
                  disabled={!isSelectedDayAllowed || isSaving}
                  className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50"
                />
                <label className="mt-3 block text-xs font-semibold text-slate-700" htmlFor="study-note">
                  Note <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  id="study-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value.slice(0, 500))}
                  maxLength={500}
                  rows={3}
                  disabled={!isSelectedDayAllowed || isSaving}
                  placeholder="What did you work on?"
                  className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50"
                />
                <Button
                  type="button"
                  variant={selectedRecord ? 'secondary' : 'brand'}
                  className="mt-4 w-full"
                  disabled={!data || !isSelectedDayAllowed || isSaving}
                  isLoading={isSaving}
                  leftIcon={<Check className="h-4 w-4" />}
                  onClick={() => void saveSelectedDay(true)}
                >
                  {selectedRecord ? 'Update learning log' : 'Mark day complete'}
                </Button>
                {selectedRecord && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void saveSelectedDay(false)}
                    className="mt-3 w-full text-xs font-semibold text-rose-700 underline disabled:opacity-50"
                  >
                    Remove this day
                  </button>
                )}
                {!isSelectedDayAllowed && data && (
                  <p className="mt-3 text-xs text-slate-500">
                    Choose a date between your roadmap start and today.
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-amber-700" aria-hidden="true" />
                  <h2 className="text-sm font-bold text-slate-900">Missed-day alert</h2>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Show an in-app reminder after this many consecutive days without a learning log.
                </p>
                <label className="sr-only" htmlFor="missed-day-threshold">Missed days before alert</label>
                <select
                  id="missed-day-threshold"
                  value={data?.missed_day_threshold ?? 1}
                  disabled={!data || isSaving}
                  onChange={(event) => void changeAlertThreshold(Number(event.target.value))}
                  className="mt-3 min-h-10 w-full rounded-lg border border-amber-300 bg-white px-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30 disabled:bg-slate-50"
                >
                  {Array.from({ length: 30 }, (_, index) => index + 1).map((days) => (
                    <option key={days} value={days}>
                      {days} {days === 1 ? 'missed day' : 'consecutive missed days'}
                    </option>
                  ))}
                </select>
                <Link
                  to="/alerts"
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900 underline"
                >
                  View all learning alerts
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </section>
            </aside>
          </section>

          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-500">
            <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Your learning log is saved to your signed-in account and kept separate for each roadmap.
            Missed-day reminders appear in-app when you open your calendar or alerts.
          </p>
        </>
      )}
    </main>
  )
}
