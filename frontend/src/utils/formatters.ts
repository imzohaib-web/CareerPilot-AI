/**
 * Formatting and capitalization utilities for user display names and score tiers.
 */

/**
 * Capitalizes names properly, handling spaces, hyphens, and mixed casing.
 * Example: "zohaib umer" -> "Zohaib Umer", "JOHN DOE" -> "John Doe", "ali-reza" -> "Ali-Reza"
 */
export function formatDisplayName(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return 'Candidate'
  const trimmed = name.trim()
  if (!trimmed) return 'Candidate'

  // If name is an email address, extract username and format it
  if (trimmed.includes('@')) {
    const username = trimmed.split('@')[0]
    return formatDisplayName(username.replace(/[._-]/g, ' '))
  }

  return trimmed
    .split(/\s+/)
    .map((word) => {
      return word
        .split('-')
        .map((part) => {
          if (!part) return ''
          return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
        })
        .join('-')
    })
    .join(' ')
}

/**
 * Extracts and capitalizes the first name only.
 * Example: "zohaib umer" -> "Zohaib"
 */
export function firstName(name: string | null | undefined): string {
  const full = formatDisplayName(name)
  return full.split(' ')[0] || 'Candidate'
}

/**
 * Progress & score semantic tier:
 * - Danger: < 40 (Critical gap / Needs attention)
 * - Warning: 40 - 69 (Moderate foundation / In progress)
 * - Success: >= 70 (Competitive / Job-ready / Complete)
 */
export type ScoreTier = 'danger' | 'warning' | 'success'

export function getProgressTier(score: number): ScoreTier {
  if (score < 40) return 'danger'
  if (score < 70) return 'warning'
  return 'success'
}

export interface TierStyle {
  bg: string
  border: string
  text: string
  bar: string
  ring: string
  badgeBg: string
  label: string
}

export function getTierStyle(score: number): TierStyle {
  const tier = getProgressTier(score)
  switch (tier) {
    case 'danger':
      return {
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        text: 'text-rose-800',
        bar: 'bg-rose-600',
        ring: '#e11d48',
        badgeBg: 'bg-rose-100 text-rose-800 border-rose-200',
        label: 'Needs Attention',
      }
    case 'warning':
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-900',
        bar: 'bg-amber-500',
        ring: '#d97706',
        badgeBg: 'bg-amber-100 text-amber-900 border-amber-200',
        label: 'In Progress',
      }
    case 'success':
      return {
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        text: 'text-emerald-900',
        bar: 'bg-emerald-600',
        ring: '#059669',
        badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-200',
        label: 'Job Ready',
      }
  }
}

/**
 * Returns a time-aware greeting: "Good morning", "Good afternoon", or "Good evening".
 */
export function getTimeAwareGreeting(date: Date = new Date()): string {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

