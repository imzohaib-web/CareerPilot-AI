import React, { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  LayoutDashboard,
  User,
  FileText,
  Target,
  Map,
  MessageSquare,
  Video,
  BookOpen,
  Sliders,
  LogOut,
  Upload,
  ArrowRight,
  ExternalLink,
} from 'lucide-react'

export interface CommandItem {
  id: string
  title: string
  subtitle?: string
  category: 'Navigation' | 'Actions' | 'Tools'
  icon: React.ComponentType<{ className?: string }>
  perform: () => void
  keywords?: string[]
}

export interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onLogout?: () => void
  onToggleSidebar?: () => void
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onLogout,
  onToggleSidebar,
}) => {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // All searchable commands
  const allCommands = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [
      // Navigation
      {
        id: 'nav-dashboard',
        title: 'Dashboard Overview',
        subtitle: 'Readiness scores, core modules, next steps',
        category: 'Navigation',
        icon: LayoutDashboard,
        keywords: ['home', 'overview', 'stats', 'readiness'],
        perform: () => navigate('/dashboard'),
      },
      {
        id: 'nav-profile',
        title: 'Career Profile',
        subtitle: 'Education, university, goals, target role',
        category: 'Navigation',
        icon: User,
        keywords: ['education', 'skills', 'degree', 'goals'],
        perform: () => navigate('/profile'),
      },
      {
        id: 'nav-resume',
        title: 'Resume Analyzer',
        subtitle: 'Upload PDF and calculate ATS readiness match',
        category: 'Navigation',
        icon: FileText,
        keywords: ['cv', 'pdf', 'ats', 'upload', 'resume'],
        perform: () => navigate('/resume'),
      },
      {
        id: 'nav-skillgap',
        title: 'Skill Gap Analyzer',
        subtitle: 'Compare skills against job description',
        category: 'Navigation',
        icon: Target,
        keywords: ['missing', 'match', 'gap', 'skills'],
        perform: () => navigate('/skill-gap'),
      },
      {
        id: 'nav-roadmap',
        title: 'Learning Roadmap',
        subtitle: 'Custom weekly learning milestones & tasks',
        category: 'Navigation',
        icon: Map,
        keywords: ['plan', 'tasks', 'timeline', 'weeks', 'study'],
        perform: () => navigate('/roadmap'),
      },
      {
        id: 'nav-mentor',
        title: 'AI Career Mentor',
        subtitle: 'Consult Qwen AI for career strategy & questions',
        category: 'Navigation',
        icon: MessageSquare,
        keywords: ['chat', 'qwen', 'advisor', 'questions'],
        perform: () => navigate('/mentor'),
      },
      {
        id: 'nav-interview',
        title: 'Mock Interview Simulator',
        subtitle: 'Practice with voice, camera & AI feedback',
        category: 'Navigation',
        icon: Video,
        keywords: ['mock', 'practice', 'questions', 'camera', 'voice'],
        perform: () => navigate('/interview'),
      },
      {
        id: 'nav-rag',
        title: 'RAG Knowledge Advisor',
        subtitle: 'Browse grounded guidelines & documents',
        category: 'Navigation',
        icon: BookOpen,
        keywords: ['rag', 'knowledge', 'sources', 'pakistan', 'star'],
        perform: () => navigate('/rag'),
      },

      // Quick Actions
      {
        id: 'action-resume',
        title: 'Upload PDF Resume',
        subtitle: 'Directly initiate ATS resume parsing',
        category: 'Actions',
        icon: Upload,
        keywords: ['upload', 'cv', 'file'],
        perform: () => navigate('/resume'),
      },
      {
        id: 'action-interview',
        title: 'Start New Mock Interview',
        subtitle: 'Launch 3-question simulation lobby',
        category: 'Actions',
        icon: Video,
        keywords: ['start', 'interview', 'practice'],
        perform: () => navigate('/interview'),
      },
      {
        id: 'action-mentor',
        title: 'Ask AI Mentor a Question',
        subtitle: 'Open conversation with career coach',
        category: 'Actions',
        icon: MessageSquare,
        keywords: ['ask', 'question', 'help'],
        perform: () => navigate('/mentor'),
      },

      // Tools / Sidebar
      ...(onToggleSidebar
        ? [
            {
              id: 'tool-sidebar',
              title: 'Toggle Left Sidebar',
              subtitle: 'Collapse or expand the desktop navigation',
              category: 'Tools' as const,
              icon: Sliders,
              keywords: ['sidebar', 'collapse', 'expand'],
              perform: onToggleSidebar,
            },
          ]
        : []),
      ...(import.meta.env.DEV
        ? [
            {
              id: 'tool-designsystem',
              title: 'Design System Showcase (Dev)',
              subtitle: 'Inspect component states, tokens & thresholds',
              category: 'Tools' as const,
              icon: ExternalLink,
              keywords: ['tokens', 'ui', 'components', 'colors', 'dev'],
              perform: () => navigate('/design-system'),
            },
          ]
        : []),
      ...(onLogout
        ? [
            {
              id: 'action-logout',
              title: 'Log Out of Account',
              subtitle: 'End current candidate session',
              category: 'Actions' as const,
              icon: LogOut,
              keywords: ['logout', 'signout', 'exit'],
              perform: onLogout,
            },
          ]
        : []),
    ]
    return list
  }, [navigate, onLogout, onToggleSidebar])

  // Filter commands by query
  const filteredCommands = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return allCommands

    return allCommands.filter((cmd) => {
      if (cmd.title.toLowerCase().includes(q)) return true
      if (cmd.subtitle?.toLowerCase().includes(q)) return true
      if (cmd.category.toLowerCase().includes(q)) return true
      if (cmd.keywords?.some((k) => k.toLowerCase().includes(q))) return true
      return false
    })
  }, [allCommands, query])

  // Keyboard navigation inside palette
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (filteredCommands.length > 0 ? (prev + 1) % filteredCommands.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (filteredCommands.length > 0 ? (prev - 1 + filteredCommands.length) % filteredCommands.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = filteredCommands[selectedIndex]
      if (target) {
        onClose()
        target.perform()
      }
    }
  }

  // Auto-scroll selected item into view
  useEffect(() => {
    const activeEl = listRef.current?.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`)
    activeEl?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Palette Modal Box */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        className="relative z-10 w-full max-w-xl rounded-2xl bg-white border border-slate-200/90 shadow-elevation-3 overflow-hidden animate-fade-in"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <Search className="h-4.5 w-4.5 text-slate-400 shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search modules..."
            className="w-full text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
          />
          <kbd className="hidden sm:inline-block rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="max-h-80 overflow-y-auto p-2 space-y-1"
          role="listbox"
        >
          {filteredCommands.length > 0 ? (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon
              const isSelected = idx === selectedIndex
              return (
                <div
                  key={cmd.id}
                  data-index={idx}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onClose()
                    cmd.perform()
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between rounded-xl px-3 py-2.5 cursor-pointer text-xs transition-colors ${
                    isSelected
                      ? 'bg-brand-50 text-brand-900 border border-brand-200/80'
                      : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                        isSelected
                          ? 'bg-brand-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className={`font-semibold truncate ${isSelected ? 'text-brand-950 font-bold' : 'text-slate-900'}`}>
                        {cmd.title}
                      </p>
                      {cmd.subtitle && (
                        <p className={`text-[11px] truncate ${isSelected ? 'text-brand-800' : 'text-slate-500'}`}>
                          {cmd.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-[10px] uppercase font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                      {cmd.category}
                    </span>
                    <ArrowRight className={`h-3.5 w-3.5 ${isSelected ? 'text-brand-600' : 'text-slate-300'}`} />
                  </div>
                </div>
              )
            })
          ) : (
            <div className="py-8 text-center text-xs text-slate-500">
              No matching commands or navigation routes for &ldquo;{query}&rdquo;
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-semibold text-slate-700">↑↓</kbd> Navigate
            </span>
            <span>
              <kbd className="font-semibold text-slate-700">↵</kbd> Select
            </span>
            <span>
              <kbd className="font-semibold text-slate-700">esc</kbd> Close
            </span>
          </div>
          <span className="text-[10px] text-slate-400">CareerPilot AI Command Hub</span>
        </div>
      </div>
    </div>
  )
}
