import { Link, NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'

const NAV_LINKS = [
  { to: '/', label: 'Dashboard' },
  { to: '/profile', label: 'Profile' },
  { to: '/resume', label: 'Resume' },
  { to: '/mentor', label: 'Mentor' },
  { to: '/ai-test', label: 'AI Test' },
]

/** Simple authenticated shell for the Day 1 test UI. */
export function AppLayout() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-semibold text-slate-900">
            CareerPilot <span className="text-violet-600">AI</span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm font-medium ${
                    isActive
                      ? 'bg-violet-50 text-violet-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">{user?.name}</span>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
