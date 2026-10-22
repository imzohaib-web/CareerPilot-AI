import { useCallback, useEffect, useState } from 'react'
import { Bell, Check, Mail, MailX } from 'lucide-react'
import { Link } from 'react-router-dom'

import { describeApiError } from '../services/apiClient'
import * as learningService from '../services/learning'
import type { LearningAlertsResponse, LearningAlert } from '../types'

function emailText(status: string): string {
  if (status === 'sent') return 'Email sent'
  if (status === 'failed') return 'Email could not be delivered'
  return 'In-app alert'
}

export function LearningAlertsPage() {
  const [data, setData] = useState<LearningAlertsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

  const loadAlerts = useCallback(async () => {
    setError(null)
    try {
      setData(await learningService.fetchLearningAlerts())
    } catch (err) {
      setError(describeApiError(err).message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAlerts()
  }, [loadAlerts])

  async function markRead(alert: LearningAlert) {
    if (!data || alert.is_read) return
    setSavingId(alert.id)
    setError(null)
    try {
      const updated = await learningService.markLearningAlertRead(alert.id)
      setData({
        alerts: data.alerts.map((item) => item.id === alert.id ? updated : item),
        unread_count: Math.max(0, data.unread_count - 1),
      })
    } catch (err) {
      setError(describeApiError(err).message)
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-start gap-3 border-b border-slate-200 pb-5">
        <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-700">
          <Bell className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Learning alerts</h1>
          <p className="mt-1 text-sm text-slate-600">
            Skill-check results and in-app reminders based on your learning calendar.
          </p>
        </div>
        {data && data.unread_count > 0 && (
          <span className="ml-auto rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-800">
            {data.unread_count} new
          </span>
        )}
      </div>

      {error && (
        <div role="alert" className="mt-5 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm text-rose-800">{error}</p>
          <button
            type="button"
            onClick={() => void loadAlerts()}
            className="ml-4 shrink-0 text-sm font-semibold text-rose-800 underline"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="mt-6 space-y-3" aria-label="Loading alerts">
          <div className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />
          <div className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />
        </div>
      ) : data?.alerts.length ? (
        <div className="mt-6 space-y-3">
          {data.alerts.map((alert) => (
            <article
              key={alert.id}
              className={`rounded-2xl border p-5 ${
                alert.is_read ? 'border-slate-200 bg-white' : 'border-indigo-200 bg-indigo-50/40'
              }`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">{alert.title}</h2>
                    {!alert.is_read && (
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-800">
                        New
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{alert.message}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                    <time dateTime={alert.created_at}>
                      {new Date(alert.created_at).toLocaleString()}
                    </time>
                    <span className="inline-flex items-center gap-1">
                      {alert.email_status === 'sent'
                        ? <Mail className="h-3.5 w-3.5" />
                        : <MailX className="h-3.5 w-3.5" />}
                      {emailText(alert.email_status)}
                    </span>
                  </div>
                </div>
                {!alert.is_read && (
                  <button
                    type="button"
                    onClick={() => void markRead(alert)}
                    disabled={savingId === alert.id}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {savingId === alert.id ? 'Saving…' : 'Mark as read'}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <Bell className="mx-auto h-7 w-7 text-slate-400" />
          <h2 className="mt-3 text-sm font-semibold text-slate-900">No learning alerts yet</h2>
          <p className="mt-1 text-sm text-slate-600">
            Skill-check updates and missed-day reminders will appear here.
          </p>
          <Link
            to="/calendar"
            className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-brand-600 px-4 text-xs font-semibold text-white transition hover:bg-brand-700"
          >
            Open learning calendar
          </Link>
        </div>
      )}
    </div>
  )
}
