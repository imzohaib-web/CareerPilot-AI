import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { describeApiError } from '../services/apiClient'
import * as profileService from '../services/profile'
import type { CareerProfile, ExperienceLevel, ProfilePayload } from '../types'

const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string }[] = [
  { value: 'student', label: 'Student' },
  { value: 'fresh-graduate', label: 'Fresh graduate' },
  { value: 'early-career', label: 'Early career' },
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
      // POST creates; PUT updates. The profile exists once one is loaded.
      const saved = profile
        ? await profileService.updateProfile(payload)
        : await profileService.createProfile(payload)
      setProfile(saved)
      setSavedAt(new Date().toLocaleTimeString())
    } catch (err) {
      setSaveError(describeApiError(err).message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Career Profile</h1>
      <p className="mt-1 text-sm text-slate-500">
        This profile becomes the context for all CareerPilot AI guidance.
      </p>

      {isLoading && <p className="mt-8 text-slate-500">Loading profile…</p>}
      {loadError && (
        <div className="mt-8 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{loadError}</p>
          <button type="button" onClick={loadProfile} className="mt-2 font-medium underline">
            Retry
          </button>
        </div>
      )}
      {!isLoading && !loadError && !profile && (
        <p className="mt-8 rounded-lg bg-violet-50 px-4 py-3 text-sm text-violet-700">
          No profile yet — fill in the form below to create one.
        </p>
      )}

      {!isLoading && !loadError && (
        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Education
              <input
                type="text"
                value={education}
                onChange={(e) => setEducation(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-violet-500 focus:outline-none"
                placeholder="BS Computer Science"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              University
              <input
                type="text"
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-violet-500 focus:outline-none"
                placeholder="Your university"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Experience level
              <select
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-violet-500 focus:outline-none"
              >
                {EXPERIENCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Target role
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-violet-500 focus:outline-none"
                placeholder="Full Stack Developer"
              />
            </label>
          </div>

          <label className="mt-4 block text-sm font-medium text-slate-700">
            Career goal
            <textarea
              value={careerGoal}
              onChange={(e) => setCareerGoal(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-violet-500 focus:outline-none"
              placeholder="Become job-ready for junior full-stack developer roles."
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-slate-700">
            Skills (comma-separated)
            <input
              type="text"
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-violet-500 focus:outline-none"
              placeholder="React, JavaScript, Python, MongoDB"
            />
          </label>

          {saveError && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</p>
          )}
          {savedAt && (
            <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              Profile saved to MongoDB at {savedAt}.
            </p>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="mt-6 w-full rounded-lg bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : profile ? 'Update profile' : 'Create profile'}
          </button>
        </form>
      )}
    </div>
  )
}
