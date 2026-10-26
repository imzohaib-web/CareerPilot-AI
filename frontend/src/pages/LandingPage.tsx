import { Link } from 'react-router-dom'
import {
  FileText,
  Target,
  Map,
  MessageSquare,
  Video,
  LayoutDashboard,
  ArrowRight,
  Sparkles,
  Compass,
  CheckCircle2,
  ExternalLink,
  Code2,
  Database,
  Cloud,
  Cpu,
} from 'lucide-react'

const FEATURES = [
  {
    icon: FileText,
    title: 'AI Resume Analysis',
    description:
      'Upload your PDF resume for instant ATS readiness scoring, extracted section breakdown, and prioritized improvement recommendations.',
    tag: 'ATS Optimization',
  },
  {
    icon: Target,
    title: 'Skill Gap Identification',
    description:
      'Compare your verified qualifications against target role requirements to isolate critical missing competencies and technical gaps.',
    tag: 'Role Alignment',
  },
  {
    icon: Map,
    title: 'Personalized Learning Roadmaps',
    description:
      'Follow tailored, phased study milestones grounded in industry standards with interactive verification assessments and resource references.',
    tag: 'Structured Growth',
  },
  {
    icon: MessageSquare,
    title: 'AI Career Mentorship',
    description:
      'Engage in grounded multi-turn career guidance informed by your profile, latest resume feedback, and curated career rubrics.',
    tag: 'Grounded Advice',
  },
  {
    icon: Video,
    title: 'AI Mock Interviews',
    description:
      'Simulate technical and behavioral interviews with real-time audio/video feedback and structured STAR-method evaluation rubrics.',
    tag: 'STAR Evaluation',
  },
  {
    icon: LayoutDashboard,
    title: 'Unified Progress Dashboard',
    description:
      'Track your consolidated readiness score, milestone completion, study streaks, and next recommended actions in one cockpit.',
    tag: 'Readiness Metrics',
  },
]

const TECH_STACK = [
  { name: 'React 19', category: 'Frontend Architecture', icon: Code2 },
  { name: 'FastAPI', category: 'High-Performance API', icon: Cpu },
  { name: 'MongoDB Atlas', category: 'Cloud Database & Offline Cache', icon: Database },
  { name: 'Alibaba Cloud Qwen', category: 'LLM & Embedding Intelligence', icon: Cloud },
]

export function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-brand-500/20 selection:text-brand-900">
      {/* ── Accessible Skip Link ────────────────────────────────────────── */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-slate-900 focus:text-white focus:rounded-lg focus:font-semibold focus:shadow-elevation-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        Skip to main content
      </a>

      {/* ── Header & Navigation ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
          {/* Brand */}
          <Link
            to="/"
            className="flex items-center gap-2.5 text-slate-900 group focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 rounded-lg py-1 px-1.5"
            aria-label="CareerPilot AI Home"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-700 via-brand-600 to-indigo-600 text-white shadow-xs group-hover:scale-105 transition-transform duration-150">
              <Compass className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-slate-900 text-base tracking-tight leading-tight">
                CareerPilot AI
              </span>
              <span className="text-[10px] font-medium text-slate-500 tracking-wide uppercase">
                AI Career Companion
              </span>
            </div>
          </Link>

          {/* Navigation CTAs */}
          <nav aria-label="Main Navigation" className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 px-3.5 py-2 rounded-lg hover:bg-slate-100/70 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 active:bg-brand-800 px-4 py-2 rounded-lg shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              <span>Create account</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Main Content Container ──────────────────────────────────────── */}
      <main id="main-content" className="flex-1">
        {/* ── Section: Hero ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24 border-b border-slate-200/70 bg-gradient-to-b from-white via-slate-50/50 to-slate-50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center relative z-10">
            {/* Pill Tag */}
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50/80 px-3.5 py-1 text-xs font-semibold text-brand-900 mb-6 shadow-2xs">
              <Sparkles className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
              <span>Built for Graduates & Early-Career Engineers</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 max-w-4xl mx-auto leading-tight sm:leading-none">
              CareerPilot AI
            </h1>

            {/* Subtitle */}
            <p className="mt-4 sm:mt-6 text-base sm:text-lg lg:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Your AI-powered career companion for discovering skill gaps, building personalized learning roadmaps, and preparing for interviews.
            </p>

            {/* Hero CTAs */}
            <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-md mx-auto">
              <Link
                to="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              >
                <span>Create account</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                Sign in
              </Link>
            </div>

            {/* Quick Guarantees / Highlights */}
            <div className="mt-10 sm:mt-12 flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-xs font-medium text-slate-500">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                <span>Zero Hallucination Grounding</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                <span>End-to-End Readiness Pipeline</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                <span>STAR Method Interview Feedback</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section: Interactive Demo Preview Placeholder ─────────────── */}
        <section className="py-12 sm:py-16 bg-white border-b border-slate-200/80">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-xs font-bold uppercase tracking-wider text-brand-700 mb-1">
                Interactive Showcase
              </h2>
              <p className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Experience the Readiness Cockpit
              </p>
            </div>

            {/* Placeholder Container */}
            <div
              className="relative rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/80 p-8 sm:p-14 text-center overflow-hidden"
              aria-label="Demo Video Preview Area"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600 border border-brand-200 mb-4 shadow-2xs">
                <Video className="h-7 w-7" aria-hidden="true" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-2">
                Product demo coming soon
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                A high-resolution walkthrough showcasing resume intake, skill gap comparison, interactive mock interviews, and personalized roadmaps will be available here.
              </p>
            </div>
          </div>
        </section>

        {/* ── Section: Features Grid ────────────────────────────────────── */}
        <section className="py-16 sm:py-20 bg-slate-50 border-b border-slate-200/80">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
              <h2 className="text-xs font-bold uppercase tracking-wider text-brand-700 mb-2">
                Integrated Modules
              </h2>
              <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Everything you need to land your target role
              </p>
              <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
                A connected, six-module intelligence system where each step directly powers the next.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map((feature) => {
                const Icon = feature.icon
                return (
                  <article
                    key={feature.title}
                    className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-6 shadow-card hover:border-brand-300 hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700 border border-brand-100">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {feature.tag}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mb-2">
                        {feature.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── Section: Technology Stack ─────────────────────────────────── */}
        <section className="py-14 sm:py-16 bg-white border-b border-slate-200/80">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Built with Modern Engineering
            </h2>
            <p className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mb-8">
              Powered by Industry-Standard Technology
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 max-w-3xl mx-auto">
              {TECH_STACK.map((tech) => {
                const TechIcon = tech.icon
                return (
                  <div
                    key={tech.name}
                    className="inline-flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 shadow-2xs hover:border-slate-300 transition-colors"
                  >
                    <TechIcon className="h-4 w-4 text-brand-600 shrink-0" aria-hidden="true" />
                    <div className="text-left">
                      <span className="block text-xs font-bold text-slate-900">
                        {tech.name}
                      </span>
                      <span className="block text-[10px] text-slate-500">
                        {tech.category}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-800 text-center sm:text-left">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white font-bold">
                <Compass className="h-4 w-4" />
              </div>
              <span className="font-bold text-white text-base tracking-tight">
                CareerPilot AI
              </span>
            </div>

            <div className="flex items-center gap-6 text-xs">
              <a
                href="https://github.com/imzohaib-web/CareerPilot-AI"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-slate-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 rounded px-1.5 py-1"
              >
                <span>GitHub Repository</span>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
              <Link
                to="/login"
                className="font-medium text-slate-300 hover:text-white transition-colors"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="font-medium text-slate-300 hover:text-white transition-colors"
              >
                Create account
              </Link>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left text-xs text-slate-500">
            <p>
              © {new Date().getFullYear()} CareerPilot AI · Alibaba Cloud AI Hackathon Pakistan
            </p>
            <p>
              Engineered with React 19, FastAPI, MongoDB Atlas & Alibaba Cloud Qwen
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
