import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  User,
  FileText,
  Target,
  Map,
  Sparkles,
  Video,
  BookOpen,
  Terminal,
  LogOut,
  Menu,
  X,
  Compass,
  ShieldCheck,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  description?: string
}

const PRIMARY_NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/resume', label: 'Resume', icon: FileText },
  { to: '/skill-gap', label: 'Skill Gap', icon: Target },
  { to: '/roadmap', label: 'Roadmap', icon: Map },
  { to: '/mentor', label: 'Mentor', icon: Sparkles },
  { to: '/interview', label: 'Mock Interview', icon: Video },
  { to: '/rag', label: 'RAG Advisor', icon: BookOpen },
]

export function AppLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Get user initials
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'CP'

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* Top App Header */}
      <header className="sticky top-0 z-40 glass-header">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="group flex items-center gap-2.5 text-slate-900 transition focus:outline-none"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-700 via-brand-600 to-indigo-500 text-white shadow-sm shadow-brand-500/30 group-hover:scale-105 transition-transform duration-200">
                <Compass className="h-5 w-5 animate-pulse-subtle" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-bold tracking-tight text-slate-900">CareerPilot</span>
                  <span className="rounded-md bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-700">
                    AI
                  </span>
                </div>
                <span className="text-[10px] font-medium text-slate-500 hidden sm:inline -mt-0.5">
                  Powered by Alibaba Cloud Qwen
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden xl:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
            {PRIMARY_NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 whitespace-nowrap ${
                      isActive
                        ? 'bg-white text-brand-700 shadow-sm shadow-slate-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>

          {/* Medium Screens Navigation (lg to xl) */}
          <nav className="hidden lg:flex xl:hidden items-center gap-0.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
            {PRIMARY_NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  title={item.label}
                  className={({ isActive }) =>
                    `flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all duration-150 whitespace-nowrap ${
                      isActive
                        ? 'bg-white text-brand-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>

          {/* Right Header Actions: AI Test, User info, Logout, Mobile toggle */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Subtle Diagnostic / AI Test link */}
            <NavLink
              to="/ai-test"
              title="Qwen Connectivity Diagnostic"
              className={({ isActive }) =>
                `hidden md:flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg transition ${
                  isActive
                    ? 'bg-slate-200 text-slate-900 font-semibold'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              <Terminal className="h-3 w-3 text-slate-400" />
              <span>AI Test</span>
            </NavLink>

            <div className="h-4 w-px bg-slate-200 hidden md:block" />

            {/* User Profile Info */}
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-indigo-100 border border-brand-200 text-xs font-bold text-brand-700 shadow-xs">
                {initials}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-800 leading-tight max-w-[120px] truncate">
                  {user?.name ?? 'Candidate'}
                </span>
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                  Active
                </span>
              </div>
            </div>

            {/* Logout Button */}
            <button
              type="button"
              onClick={logout}
              title="Log out"
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-xs hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition"
            >
              <LogOut className="h-3.5 w-3.5 text-slate-500" />
              <span className="hidden sm:inline">Logout</span>
            </button>

            {/* Mobile Hamburger Menu Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex lg:hidden items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Slide-down Navigation Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 pt-2 pb-5 shadow-lg animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                  {initials}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-800">{user?.name}</p>
                  <p className="text-[10px] text-slate-500">{user?.email}</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <ShieldCheck className="h-3 w-3 text-emerald-600" /> Qwen Ready
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {PRIMARY_NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const isActive =
                  item.to === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.to)
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-brand-50 text-brand-700 border border-brand-200'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
              <Link
                to="/ai-test"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                <Terminal className="h-3.5 w-3.5" />
                <span>AI Connection Diagnostic</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false)
                  logout()
                }}
                className="text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-1"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 pb-16">
        <Outlet />
      </main>

      {/* Hackathon Footer */}
      <footer className="border-t border-slate-200 bg-white/60 py-4 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">CareerPilot AI</span>
            <span>·</span>
            <span>Alibaba Cloud AI Hackathon Project</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Qwen-Max Active
            </span>
            <span>·</span>
            <span>FastAPI Backend</span>
            <span>·</span>
            <span>MongoDB Vector Store</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
