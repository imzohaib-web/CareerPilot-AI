import React, { useCallback, useEffect, useState, useRef } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  LayoutDashboard,
  User,
  FileText,
  Target,
  Map,
  MessageSquare,
  Video,
  BookOpen,
  LogOut,
  Menu,
  X,
  Compass,
  Bell,
  CalendarDays,
  Search,
  ChevronLeft,
  ChevronRight,
  Sliders,
  Check,
  WifiOff,
  MoreHorizontal,
  ChevronDown,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { formatDisplayName } from '../utils/formatters'
import * as progressService from '../services/progress'
import type { DashboardResponse } from '../types'
import { CommandPalette } from '../components/ui/CommandPalette'
import { Avatar } from '../components/ui/Avatar'
import { Tooltip } from '../components/ui/Tooltip'

interface NavItemDef {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  moduleKey?: 'profile' | 'resume' | 'roadmap' | 'interview' | 'skillgap' | 'rag'
}

interface NavGroupDef {
  name: string
  items: NavItemDef[]
}

const NAV_GROUPS: NavGroupDef[] = [
  {
    name: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    name: 'Build',
    items: [
      { to: '/profile', label: 'Profile', icon: User, moduleKey: 'profile' },
      { to: '/resume', label: 'Resume', icon: FileText, moduleKey: 'resume' },
      { to: '/skill-gap', label: 'Skill Gap', icon: Target, moduleKey: 'skillgap' },
    ],
  },
  {
    name: 'Learn',
    items: [
      { to: '/roadmap', label: 'Roadmap', icon: Map, moduleKey: 'roadmap' },
      { to: '/calendar', label: 'Learning Calendar', icon: CalendarDays },
      { to: '/alerts', label: 'Learning Alerts', icon: Bell },
      { to: '/mentor', label: 'AI Mentor', icon: MessageSquare },
    ],
  },
  {
    name: 'Practice',
    items: [
      { to: '/interview', label: 'Mock Interview', icon: Video, moduleKey: 'interview' },
    ],
  },
  {
    name: 'Knowledge',
    items: [
      { to: '/rag', label: 'RAG Advisor', icon: BookOpen, moduleKey: 'rag' },
    ],
  },
]

// Mobile bottom bar items (5 primary items)
const MOBILE_BOTTOM_ITEMS: NavItemDef[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/roadmap', label: 'Roadmap', icon: Map },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/mentor', label: 'Mentor', icon: MessageSquare },
  { to: '/interview', label: 'Interview', icon: Video },
]

const SIDEBAR_STORAGE_KEY = 'careerpilot_sidebar_collapsed'

export function AppLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const shouldReduceMotion = useReducedMotion()

  // 1. Sidebar Collapsed State (remembered in localStorage with try/catch)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY)
      return stored ? JSON.parse(stored) : false
    } catch {
      return false
    }
  })

  const toggleSidebar = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Non-critical if storage fails
      }
      return next
    })
  }, [])

  // 2. Mobile & Tablet Drawers
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [moreSheetOpen, setMoreSheetOpen] = useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  // 3. Module Completion Status Cache
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadCompletionStats() {
      try {
        const data = await progressService.fetchDashboard()
        if (!cancelled) setDashboardData(data)
      } catch {
        // Silently leave as null if not loaded yet
      }
    }
    loadCompletionStats()
    return () => {
      cancelled = true
    }
  }, [location.pathname])

  // Helper: Is module considered completed?
  function isModuleCompleted(key?: string): boolean {
    if (!key || !dashboardData) return false
    switch (key) {
      case 'profile':
        return Boolean(dashboardData.profile.has_profile && dashboardData.profile.completeness >= 80)
      case 'resume':
        return Boolean(dashboardData.resume.has_analysis)
      case 'skillgap':
        return Boolean(dashboardData.resume.has_analysis)
      case 'roadmap':
        return Boolean(dashboardData.roadmap?.has_roadmap && (dashboardData.roadmap.completion_percentage ?? 0) > 0)
      case 'interview':
        return Boolean(dashboardData.interview?.has_interview)
      case 'rag':
        return true
      default:
        return false
    }
  }

  // 4. Global Offline Banner State
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [offlineDismissed, setOfflineDismissed] = useState(false)

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => {
      setIsOffline(true)
      setOfflineDismissed(false)
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // 5. Route Loading Progress Bar
  const [isLoadingRoute, setIsLoadingRoute] = useState(false)
  useEffect(() => {
    const startTimer = setTimeout(() => setIsLoadingRoute(true), 0)
    const endTimer = setTimeout(() => setIsLoadingRoute(false), 250)
    // Close overlays on route navigation
    setMobileMenuOpen(false)
    setMoreSheetOpen(false)
    setUserDropdownOpen(false)
    // Scroll to top on route change
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return () => {
      clearTimeout(startTimer)
      clearTimeout(endTimer)
    }
  }, [location.pathname])

  // 6. Global Command Palette Keyboard Shortcut (Ctrl/Cmd + K)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandPaletteOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Close user dropdown on click outside
  const userMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false)
      }
    }
    if (userDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [userDropdownOpen])

  // Display Name formatting
  const displayName = formatDisplayName(user?.name)

  // Dynamic Breadcrumb Label Calculation
  const currentBreadcrumbs = getBreadcrumbsForPath(location.pathname)

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased selection:bg-brand-500/20 selection:text-brand-900">
      {/* ── A. Skip to Main Content Link ─────────────────────────────────── */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-slate-900 focus:text-white focus:rounded-lg focus:font-semibold focus:shadow-elevation-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        Skip to main content
      </a>

      {/* ── B. Top Loading Bar on Route Navigation ───────────────────────── */}
      {isLoadingRoute && (
        <div
          role="progressbar"
          aria-label="Route loading"
          className="fixed top-0 left-0 right-0 z-50 h-[2.5px] bg-gradient-to-r from-brand-500 via-brand-600 to-indigo-500 animate-pulse"
        />
      )}

      {/* ── C. Global Offline / Demo Mode Banner ─────────────────────────── */}
      {isOffline && !offlineDismissed && (
        <div
          role="status"
          className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-semibold flex items-center justify-between sticky top-0 z-50 shadow-xs"
        >
          <div className="flex items-center gap-2 mx-auto">
            <WifiOff className="h-4 w-4 shrink-0 text-slate-950" aria-hidden="true" />
            <span>
              You are currently offline. CareerPilot AI will synchronize your progress once network connection is restored.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOfflineDismissed(true)}
            aria-label="Dismiss offline banner"
            className="p-1 rounded hover:bg-amber-600/30 transition shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex-1 flex w-full">
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* 1. DESKTOP LEFT SIDEBAR (>=1024px)                                  */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <aside
          aria-label="Main Navigation"
          className={`hidden lg:flex flex-col border-r border-slate-200/90 bg-white z-30 transition-all duration-250 ease-smooth sticky top-0 h-screen shrink-0 select-none ${
            isCollapsed ? 'w-[72px]' : 'w-[240px]'
          }`}
        >
          {/* Sidebar Brand Header */}
          <div className="h-15 flex items-center justify-between px-4 border-b border-slate-100">
            <Link
              to="/"
              className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded-lg p-1 transition"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white shadow-xs shrink-0">
                <Compass className="h-4.5 w-4.5 text-indigo-400" />
              </div>
              {!isCollapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold tracking-tight text-slate-900 truncate">
                    CareerPilot
                  </span>
                  <span className="text-[10px] text-slate-600 font-medium leading-none">
                    AI Career Coach
                  </span>
                </div>
              )}
            </Link>

            {!isCollapsed && (
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label="Collapse sidebar"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Grouped Navigation Links */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
            {NAV_GROUPS.map((group) => (
              <div key={group.name} className="space-y-1">
                {!isCollapsed && (
                  <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600 block mb-1.5">
                    {group.name}
                  </span>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const isCompleted = isModuleCompleted(item.moduleKey)

                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        aria-current={location.pathname === item.to ? 'page' : undefined}
                        className={({ isActive }) =>
                          `group relative flex items-center gap-3 rounded-lg text-xs transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                            isCollapsed
                              ? 'justify-center py-2.5 px-2'
                              : 'px-3 py-2'
                          } ${
                            isActive
                              ? 'bg-brand-50 text-brand-950 font-bold border-l-4 border-brand-600 shadow-2xs'
                              : 'text-slate-600 font-medium hover:text-slate-900 hover:bg-slate-100/70 border-l-4 border-transparent'
                          }`
                        }
                      >
                        {({ isActive }) => {
                          const iconContent = (
                            <Icon
                              className={`h-4 w-4 shrink-0 transition-colors ${
                                isActive ? 'text-brand-700' : 'text-slate-400 group-hover:text-slate-700'
                              }`}
                            />
                          )

                          return (
                            <>
                              {isCollapsed ? (
                                <Tooltip content={item.label} position="right">
                                  <div className="relative flex items-center justify-center">
                                    {iconContent}
                                    {isCompleted && (
                                      <span
                                        className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white"
                                        aria-label="Completed"
                                      />
                                    )}
                                  </div>
                                </Tooltip>
                              ) : (
                                <>
                                  {iconContent}
                                  <span className="truncate flex-1">{item.label}</span>
                                  {isCompleted && (
                                    <span
                                      title="Module completed"
                                      className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shrink-0"
                                    >
                                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                                    </span>
                                  )}
                                </>
                              )}
                            </>
                          )
                        }}
                      </NavLink>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Sidebar Footer: Toggle + Subtle Brand Line */}
          <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-2">
            {isCollapsed ? (
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label="Expand sidebar"
                className="w-full flex items-center justify-center p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <div className="flex items-center justify-between text-[11px] text-slate-600 px-2 py-1">
                <span className="flex items-center gap-1 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Powered by Qwen
                </span>
                <span className="text-[10px] text-slate-500">v1.2</span>
              </div>
            )}
          </div>
        </aside>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* 2. TABLET DRAWER OVERLAY (768px – 1023px)                           */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-fade-in"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />

            {/* Slide-out Drawer */}
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Mobile Navigation"
              className="relative z-10 w-72 max-w-[80vw] bg-white h-full flex flex-col justify-between shadow-elevation-3 animate-fade-in"
            >
              <div>
                <div className="h-15 flex items-center justify-between px-5 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
                      <Compass className="h-4.5 w-4.5 text-indigo-400" />
                    </div>
                    <span className="text-sm font-bold text-slate-900">CareerPilot</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-label="Close navigation drawer"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <nav className="p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-140px)]">
                  {NAV_GROUPS.map((group) => (
                    <div key={group.name} className="space-y-1">
                      <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600 block mb-1">
                        {group.name}
                      </span>
                      {group.items.map((item) => {
                        const Icon = item.icon
                        const isActive = location.pathname === item.to
                        const isCompleted = isModuleCompleted(item.moduleKey)

                        return (
                          <Link
                            key={item.to}
                            to={item.to}
                            onClick={() => setMobileMenuOpen(false)}
                            aria-current={isActive ? 'page' : undefined}
                            className={`flex items-center justify-between min-h-[44px] rounded-lg px-3 py-2 text-xs font-semibold transition ${
                              isActive
                                ? 'bg-brand-50 text-brand-900 border-l-4 border-brand-600'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-4 border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Icon className={`h-4 w-4 ${isActive ? 'text-brand-700' : 'text-slate-400'}`} />
                              <span>{item.label}</span>
                            </div>
                            {isCompleted && (
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                                <Check className="h-2.5 w-2.5 stroke-[3]" />
                              </span>
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  ))}
                </nav>
              </div>

              {/* Drawer bottom info */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium text-slate-700">{displayName}</span>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    logout()
                  }}
                  className="text-rose-600 font-semibold hover:underline"
                >
                  Log out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* 3. MAIN CONTENT SHELL & TOP BAR                                     */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar Header */}
          <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200/90 h-15 shrink-0">
            <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-8 gap-4">
              {/* Left Section: Mobile Menu Trigger + Breadcrumb */}
              <div className="flex items-center gap-3 min-w-0">
                {/* Tablet / Mobile Hamburger Button */}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  className="lg:hidden flex items-center justify-center p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-5 w-5" />
                </button>

                {/* Page Title & Breadcrumb */}
                <div className="min-w-0">
                  <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
                    {currentBreadcrumbs.map((crumb, idx) => {
                      const isLast = idx === currentBreadcrumbs.length - 1
                      return (
                        <span key={idx} className="flex items-center gap-1.5 truncate">
                          {idx > 0 && <span className="text-slate-300">/</span>}
                          <span
                            aria-current={isLast ? 'page' : undefined}
                            className={`truncate ${
                              isLast ? 'font-bold text-slate-900 text-sm' : 'font-medium hover:text-slate-700'
                            }`}
                          >
                            {crumb}
                          </span>
                        </span>
                      )
                    })}
                  </nav>
                </div>
              </div>

              {/* Right Section: Command Palette Trigger + User Dropdown */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                {/* Global Command Palette Trigger Button */}
                <button
                  type="button"
                  onClick={() => setCommandPaletteOpen(true)}
                  aria-label="Open command palette (Ctrl+K)"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 sm:px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                >
                  <Search className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  <span className="hidden sm:inline">Search modules…</span>
                  <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded bg-white border border-slate-200 px-1.5 py-0.2 text-[10px] font-semibold text-slate-600 shadow-2xs">
                    ⌘K
                  </kbd>
                </button>

                {/* User Dropdown Menu */}
                <div ref={userMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setUserDropdownOpen((prev) => !prev)}
                    aria-expanded={userDropdownOpen}
                    aria-haspopup="true"
                    aria-label="User account menu"
                    className="flex items-center gap-2 p-1 rounded-full sm:rounded-lg hover:bg-slate-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                  >
                    <Avatar name={user?.name} size="sm" status="online" />
                    <span className="hidden md:inline text-xs font-semibold text-slate-800 max-w-[120px] truncate text-left">
                      {displayName}
                    </span>
                    <ChevronDown className="hidden md:inline h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  </button>

                  {/* Dropdown Card */}
                  {userDropdownOpen && (
                    <div
                      role="menu"
                      aria-orientation="vertical"
                      className="absolute right-0 mt-2 w-64 rounded-xl bg-white border border-slate-200 shadow-elevation-2 py-2 z-50 animate-fade-in focus:outline-none text-xs"
                    >
                      {/* User Info Header */}
                      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2.5">
                        <Avatar name={user?.name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900 truncate">{displayName}</p>
                          <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                        </div>
                      </div>

                      {/* Dropdown Links */}
                      <div className="py-1">
                        <Link
                          to="/profile"
                          role="menuitem"
                          onClick={() => setUserDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition font-medium"
                        >
                          <User className="h-4 w-4 text-slate-400" />
                          <span>Career Profile</span>
                        </Link>

                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setUserDropdownOpen(false)
                            setCommandPaletteOpen(true)
                          }}
                          className="flex w-full items-center gap-2.5 px-4 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition font-medium text-left"
                        >
                          <Search className="h-4 w-4 text-slate-400" />
                          <span>Command Palette (⌘K)</span>
                        </button>

                        {import.meta.env.DEV && (
                          <Link
                            to="/design-system"
                            role="menuitem"
                            onClick={() => setUserDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-brand-900 bg-brand-50/60 hover:bg-brand-50 transition font-semibold"
                          >
                            <Sliders className="h-4 w-4 text-brand-600" />
                            <span>Design System (Dev)</span>
                          </Link>
                        )}
                      </div>

                      {/* Logout Action */}
                      <div className="pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setUserDropdownOpen(false)
                            logout()
                          }}
                          className="flex w-full items-center gap-2.5 px-4 py-2 text-rose-700 hover:bg-rose-50 hover:text-rose-900 transition font-semibold text-left"
                        >
                          <LogOut className="h-4 w-4 text-rose-500" />
                          <span>Log Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* ── Main Viewport with Route Transition ──────────────────────── */}
          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 pb-20 md:pb-12 focus:outline-none"
          >
            <motion.div
              key={location.pathname}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
              animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              <Outlet />
            </motion.div>
          </main>

          {/* Clean App Footer */}
          <footer className="hidden md:block border-t border-slate-200/90 bg-white py-3.5 text-xs text-slate-600">
            <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium">
                <span className="font-bold text-slate-800">CareerPilot AI</span>
                <span>·</span>
                <span>Alibaba Cloud AI Hackathon</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-600 font-medium">
                <span>FastAPI</span>
                <span>·</span>
                <span>Qwen-Max</span>
                <span>·</span>
                <span>MongoDB Vector RAG</span>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 4. MOBILE BOTTOM TAB BAR (<768px)                                   */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-elevation-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1"
      >
        <div className="grid grid-cols-5 items-center px-1">
          {MOBILE_BOTTOM_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center justify-center min-h-[48px] py-1 rounded-lg text-center transition ${
                  isActive ? 'text-brand-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <div className={`p-1 rounded-full ${isActive ? 'bg-brand-50' : ''}`}>
                  <Icon className={`h-5 w-5 ${isActive ? 'text-brand-700' : 'text-slate-400'}`} />
                </div>
                <span className="text-[10px] leading-tight mt-0.5 tracking-tight truncate max-w-[58px]">
                  {item.label}
                </span>
              </Link>
            )
          })}

          {/* 5th Button: 'More' Sheet Trigger */}
          <button
            type="button"
            onClick={() => setMoreSheetOpen(true)}
            aria-expanded={moreSheetOpen}
            aria-label="More navigation options"
            className="flex flex-col items-center justify-center min-h-[48px] py-1 rounded-lg text-slate-600 hover:text-slate-900 transition"
          >
            <div className="p-1 rounded-full">
              <MoreHorizontal className="h-5 w-5 text-slate-400" />
            </div>
            <span className="text-[10px] leading-tight mt-0.5 tracking-tight font-medium">
              More
            </span>
          </button>
        </div>
      </nav>

      {/* ── 5. Mobile 'More' Sheet Overlay ───────────────────────────────── */}
      {moreSheetOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setMoreSheetOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="More Menu"
            className="relative z-10 w-full bg-white rounded-t-2xl p-5 shadow-elevation-3 space-y-4 max-h-[85vh] overflow-y-auto animate-fade-in"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <Avatar name={user?.name} size="sm" />
                <div>
                  <p className="text-xs font-bold text-slate-900">{displayName}</p>
                  <p className="text-[10px] text-slate-500">{user?.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMoreSheetOpen(false)}
                aria-label="Close sheet"
                className="p-1 rounded-md text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Additional Modules
              </span>
              {[
                { to: '/profile', label: 'Career Profile', icon: User },
                { to: '/resume', label: 'Resume Analyzer', icon: FileText },
                { to: '/skill-gap', label: 'Skill Gap Analyzer', icon: Target },
                { to: '/rag', label: 'RAG Knowledge Advisor', icon: BookOpen },
                ...(import.meta.env.DEV
                  ? [{ to: '/design-system', label: 'Design System (Dev)', icon: Sliders }]
                  : []),
              ].map((m) => {
                const Icon = m.icon
                const isActive = location.pathname === m.to
                return (
                  <Link
                    key={m.to}
                    to={m.to}
                    onClick={() => setMoreSheetOpen(false)}
                    className={`flex items-center gap-3 min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold ${
                      isActive ? 'bg-brand-50 text-brand-900' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="h-4 w-4 text-slate-400" />
                    <span>{m.label}</span>
                  </Link>
                )
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setMoreSheetOpen(false)
                  setCommandPaletteOpen(true)
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 min-h-[44px] px-3"
              >
                <Search className="h-4 w-4 text-slate-400" />
                <span>Search (⌘K)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMoreSheetOpen(false)
                  logout()
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 min-h-[44px] px-3"
              >
                <LogOut className="h-4 w-4 text-rose-500" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. Global Command Palette Modal ──────────────────────────────── */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onLogout={logout}
        onToggleSidebar={toggleSidebar}
      />
    </div>
  )
}

function getBreadcrumbsForPath(pathname: string): string[] {
  switch (pathname) {
    case '/':
      return ['CareerPilot', 'Dashboard']
    case '/profile':
      return ['Build', 'Career Profile']
    case '/resume':
      return ['Build', 'Resume Analyzer']
    case '/skill-gap':
      return ['Build', 'Skill Gap Analyzer']
    case '/roadmap':
      return ['Learn', 'Learning Roadmap']
    case '/calendar':
      return ['Learn', 'Learning Calendar']
    case '/alerts':
      return ['Learn', 'Learning Alerts']
    case '/mentor':
      return ['Learn', 'AI Career Mentor']
    case '/interview':
      return ['Practice', 'Mock Interview']
    case '/rag':
      return ['Knowledge', 'RAG Advisor']
    case '/design-system':
      return ['Developer', 'Design System']
    default:
      return ['CareerPilot', 'Overview']
  }
}
