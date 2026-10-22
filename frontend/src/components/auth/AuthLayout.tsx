import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Compass, Check } from 'lucide-react'

interface AuthLayoutProps {
  title: string
  heading: string
  subtitle: string
  children: ReactNode
}

export function AuthLayout({
  title,
  heading,
  subtitle,
  children,
}: AuthLayoutProps) {
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    document.title = `${title} | CareerPilot AI`
  }, [title])

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-50 font-sans antialiased text-slate-900 selection:bg-brand-500/20 selection:text-brand-900">
      {/* ── Global Autofill Style Override (Quiet, non-intrusive) ── */}
      <style>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px #ffffff inset !important;
          box-shadow: 0 0 0 1000px #ffffff inset !important;
          -webkit-text-fill-color: #0f172a !important;
          caret-color: #0f172a !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>

      {/* ── Left Quiet Brand Panel (Desktop >=1024px, ~40% width) ── */}
      <aside
        aria-label="Platform introduction"
        className="relative hidden lg:flex lg:w-[40%] xl:w-[38%] flex-col justify-between bg-slate-900 p-10 xl:p-14 text-white overflow-hidden shrink-0"
      >
        {/* Subtle static geometric grid pattern (static, no animation, non-distracting) */}
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full stroke-white/[0.04] pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="auth-grid-pattern"
              width="36"
              height="36"
              patternUnits="userSpaceOnUse"
            >
              <path d="M 36 0 L 0 0 0 36" fill="none" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#auth-grid-pattern)" />
        </svg>

        {/* Brand Header */}
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white">
            <Compass className="h-5 w-5 text-brand-400" aria-hidden="true" />
          </div>
          <span className="text-base font-semibold tracking-tight text-white">
            CareerPilot AI
          </span>
        </div>

        {/* Single headline + one short sentence + 3 simple bullet lines */}
        <div className="relative z-10 space-y-6 my-auto py-8">
          <div className="space-y-3 max-w-sm">
            <h2 className="text-2xl xl:text-3xl font-semibold tracking-tight text-white leading-snug">
              Your career plan, in one place.
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Resume analysis, skill gaps, roadmaps and mock interviews, all tied to your target role.
            </p>
          </div>

          {/* Five tiny single-line bullets with check icons (no descriptions) */}
          <ul className="space-y-2.5 pt-2 text-xs text-slate-300 font-medium">
            <li className="flex items-center gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-brand-400">
                <Check className="h-2.5 w-2.5 stroke-[2.5]" aria-hidden="true" />
              </span>
              <span>Resume analysis</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-brand-400">
                <Check className="h-2.5 w-2.5 stroke-[2.5]" aria-hidden="true" />
              </span>
              <span>Skill gap analysis</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-brand-400">
                <Check className="h-2.5 w-2.5 stroke-[2.5]" aria-hidden="true" />
              </span>
              <span>Personalized learning roadmap</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-brand-400">
                <Check className="h-2.5 w-2.5 stroke-[2.5]" aria-hidden="true" />
              </span>
              <span>AI mock interviews</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-brand-400">
                <Check className="h-2.5 w-2.5 stroke-[2.5]" aria-hidden="true" />
              </span>
              <span>Knowledge-based career advisor</span>
            </li>
          </ul>
        </div>

        {/* Single small footer credit line */}
        <div className="relative z-10 text-[11px] text-slate-500 font-medium">
          Built with Alibaba Cloud Qwen
        </div>
      </aside>

      {/* ── Right Panel: Form (Vertically Centered, max-w-[400px]) ── */}
      <main
        id="main-content"
        className="flex-1 flex flex-col justify-center items-center px-4 py-10 sm:px-6 lg:px-12 xl:px-16"
      >
        <div className="w-full max-w-[400px] space-y-7">
          {/* Mobile/Tablet Brand Header (<1024px) */}
          <div className="lg:hidden flex items-center justify-center gap-2 pb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white shadow-xs">
              <Compass className="h-4 w-4 text-brand-400" aria-hidden="true" />
            </div>
            <span className="text-base font-semibold tracking-tight text-slate-900">
              CareerPilot AI
            </span>
          </div>

          {/* Form Title & Subtitle */}
          <div className="space-y-1.5 text-left">
            <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight text-slate-900">
              {heading}
            </h1>
            <p className="text-sm text-slate-500 leading-normal">
              {subtitle}
            </p>
          </div>

          {/* Form Content with subtle mount transition (150-250ms) */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  )
}
