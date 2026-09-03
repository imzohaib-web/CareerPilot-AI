import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  User,
  Sparkles,
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
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 border border-brand-200/60 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-brand-600" />
            <span>AI Context Provider</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Career Profile & Goals
          </h1>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">
            This profile serves as the foundational context for your AI Mentor, Roadmap Generator, and Mock Interview simulations.
          </p>
        </div>

        {savedAt && (
          <div className="inline-flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-2 text-xs font-bold text-emerald-800 animate-fade-in self-start sm:self-auto">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Profile saved at {savedAt}</span>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-12 text-center animate-pulse">
          <RefreshCw className="h-8 w-8 animate-spin text-brand-600 mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-medium">Loading your profile data…</p>
        </div>
      )}

      {loadError && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-xs text-rose-800 flex items-center justify-between">
          <span>Failed to load profile: {loadError}</span>
          <button type="button" onClick={loadProfile} className="font-bold underline">
            Retry
          </button>
        </div>
      )}

      {!isLoading && !loadError && (
        <div className="grid gap-8 lg:grid-cols-12 items-start">
          {/* Left Form Panel */}
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-7 rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-card space-y-6"
          >
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <User className="h-4 w-4 text-brand-600" />
              <span>Personal & Career Details</span>
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Degree / Education Level
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={education}
                    onChange={(e) => setEducation(e.target.value)}
                    placeholder="e.g. BS in Computer Science"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  University / Institution
                </label>
                <input
                  type="text"
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  placeholder="e.g. Stanford University"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Experience Level</label>
                <select
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition"
                >
                  {EXPERIENCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Target Role Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g. AI Application Engineer"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="block font-bold text-slate-700 mb-1.5">
                Primary Career Goal / Aspiration
              </label>
              <textarea
                rows={3}
                value={careerGoal}
                onChange={(e) => setCareerGoal(e.target.value)}
                placeholder="e.g. Land a software engineering role at a high-growth AI startup within 6 months."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition resize-none leading-relaxed"
              />
            </div>

            <div className="text-xs">
              <label className="block font-bold text-slate-700 mb-1.5">
                Key Skills (Comma-separated)
              </label>
              <textarea
                rows={3}
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
                placeholder="e.g. Python, FastAPI, React, TypeScript, Docker, Machine Learning"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition resize-none leading-relaxed"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Type your skills separated by commas to convert them into AI recognition tags.
              </p>
            </div>

            {saveError && (
              <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-800">
                {saveError}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="submit"
                disabled={isSaving || !targetRole.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-brand-600/20 hover:brightness-110 active:scale-98 transition disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Saving Profile…</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Save Career Profile</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Right Live Preview Card */}
          <div className="lg:col-span-5 rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-card space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Profile Live Preview</h3>
              <span className="rounded-full bg-brand-50 border border-brand-200 px-2.5 py-0.5 text-[10px] font-bold text-brand-700">
                AI Context View
              </span>
            </div>

            <div className="space-y-4 text-xs">
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Target Trajectory
                </span>
                <p className="text-base font-bold text-slate-900">
                  {targetRole || 'Target Role Not Set'}
                </p>
                <p className="text-slate-500 capitalize">
                  Level: {experienceLevel.replace('-', ' ')}
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Academic Background
                </span>
                <p className="font-semibold text-slate-800">
                  {education || 'Education not specified'}{' '}
                  {university ? `· ${university}` : ''}
                </p>
              </div>

              {careerGoal && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Primary Goal
                  </span>
                  <p className="text-slate-700 leading-relaxed italic bg-brand-50/40 p-3 rounded-xl border border-brand-100/60">
                    "{careerGoal}"
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Skills Tag Cloud ({parsedSkills.length})
                  </span>
                </div>

                {parsedSkills.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {parsedSkills.map((s) => (
                      <span
                        key={s}
                        className="rounded-xl bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-800"
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
