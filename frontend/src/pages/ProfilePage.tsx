import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  User,
  CheckCircle2,
  Save,
  RefreshCw,
} from 'lucide-react'

import { describeApiError } from '../services/apiClient'
import * as profileService from '../services/profile'
import type { CareerProfile, ExperienceLevel, ProfilePayload } from '../types'

const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string }[] = [
  { value: 'student', label: 'Student / Intern' },
  { value: 'fresh-graduate', label: 'Fresh Graduate (0-1 yrs)' },
  { value: 'early-career', label: 'Early Career (1-3 yrs)' },
]

export function ProfilePage() {
  const [profile, setProfile] = useState<CareerProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [education, setEducation] = useState('')
  const [university, setUniversity] = useState('')
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('student')
  const [targetRole, setTargetRole] = useState('')
  const [careerGoal, setCareerGoal] = useState('')
  const [skillsText, setSkillsText] = useState('')

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const loadProfile = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const existing = await profileService.fetchProfile()
      setProfile(existing)
      if (existing) {
        setEducation(existing.education)
        setUniversity(existing.university)
        setExperienceLevel(existing.experience_level)
        setTargetRole(existing.target_role)
        setCareerGoal(existing.career_goal)
        setSkillsText(existing.skills.join(', '))
      }
    } catch (err) {
      setLoadError(describeApiError(err).message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaveError(null)
    setSavedAt(null)
    setIsSaving(true)

    const payload: ProfilePayload = {
      education,
      university,
      experience_level: experienceLevel,
      target_role: targetRole,
      career_goal: careerGoal,
      skills: skillsText.split(',').map((skill) => skill.trim()).filter(Boolean),
    }

    try {
      const saved = profile
        ? await profileService.updateProfile(payload)
        : await profileService.createProfile(payload)
      setProfile(saved)
      setSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    } catch (err) {
      setSaveError(describeApiError(err).message)
    } finally {
      setIsSaving(false)
    }
  }

  const parsedSkills = skillsText.split(',').map((s) => s.trim()).filter(Boolean)

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Career Profile & Preferences
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 max-w-2xl">
            This profile provides foundational context for AI Mentorship, Roadmap generation, and Mock Interviews.
          </p>
        </div>

        {savedAt && (
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-800 self-start sm:self-auto">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>Profile saved at {savedAt}</span>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="clean-card p-10 text-center animate-pulse">
          <RefreshCw className="h-6 w-6 animate-spin text-slate-500 mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-medium">Loading profile data…</p>
        </div>
      )}

      {loadError && (
        <div className="clean-card p-4 border-rose-200 bg-rose-50 text-xs text-rose-800 flex items-center justify-between">
          <span>Failed to load profile: {loadError}</span>
          <button type="button" onClick={loadProfile} className="font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {!isLoading && !loadError && (
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          {/* Left Form Panel */}
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-7 clean-card p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <User className="h-4 w-4 text-slate-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                Personal & Career Details
              </h2>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Degree / Education Level
                </label>
                <input
                  type="text"
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                  placeholder="e.g. BS in Computer Science"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  University / Institution
                </label>
                <input
                  type="text"
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  placeholder="e.g. Stanford University"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Experience Level</label>
                <select
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition"
                >
                  {EXPERIENCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Target Role Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g. AI Application Engineer"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="block font-medium text-slate-700 mb-1">
                Primary Career Goal / Aspiration
              </label>
              <textarea
                rows={3}
                value={careerGoal}
                onChange={(e) => setCareerGoal(e.target.value)}
                placeholder="e.g. Land a software engineering role at a high-growth AI startup within 6 months."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition resize-none leading-relaxed"
              />
            </div>

            <div className="text-xs">
              <label className="block font-medium text-slate-700 mb-1">
                Key Skills (Comma-separated)
              </label>
              <textarea
                rows={3}
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
                placeholder="e.g. Python, FastAPI, React, TypeScript, Docker, Machine Learning"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition resize-none leading-relaxed"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Skills entered here are indexed across your AI Mentor and Readiness metrics.
              </p>
            </div>

            {saveError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
                {saveError}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="submit"
                disabled={isSaving || !targetRole.trim()}
                className="btn-primary text-xs py-2 px-4"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving Profile…</span>
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    <span>Save Career Profile</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Right Live Preview Card */}
          <div className="lg:col-span-5 clean-card p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">Profile Live Preview</h3>
              <span className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                Active Context
              </span>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200/80 space-y-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Target Trajectory
                </span>
                <p className="text-sm font-bold text-slate-900">
                  {targetRole || 'Target Role Not Set'}
                </p>
                <p className="text-slate-500 capitalize text-[11px]">
                  Level: {experienceLevel.replace('-', ' ')}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Academic Background
                </span>
                <p className="font-medium text-slate-800 text-xs">
                  {education || 'Education not specified'}{' '}
                  {university ? `· ${university}` : ''}
                </p>
              </div>

              {careerGoal && (
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Primary Goal
                  </span>
                  <p className="text-slate-700 leading-relaxed italic bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                    "{careerGoal}"
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Skills Inventory ({parsedSkills.length})
                </span>

                {parsedSkills.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {parsedSkills.map((s) => (
                      <span
                        key={s}
                        className="rounded-md bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-800"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400">No skills added yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
