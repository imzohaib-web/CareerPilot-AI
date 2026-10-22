import { useState } from 'react'
import {
  Sparkles,
  Search,
  Layers,
  ArrowRight,
  TrendingUp,
  Folder,
  Download,
  Settings,
  Trash2,
  Copy,
  Sliders,
  Compass,
} from 'lucide-react'

import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  ProgressBar,
  ProgressRing,
  Stat,
  Input,
  Select,
  Textarea,
  Tabs,
  TabPanel,
  Tooltip,
  Skeleton,
  EmptyState,
  Alert,
  Modal,
  Drawer,
  Avatar,
  DropdownMenu,
  PageHeader,
} from '../components/ui'
import { formatDisplayName, firstName, getProgressTier } from '../utils/formatters'
import { useToast } from '../context/ToastContext'

export function DesignSystemPage() {
  // Interactive test states
  const [sliderScore, setSliderScore] = useState(78)
  const [activeTab, setActiveTab] = useState('components')
  const [isLoadingButton, setIsLoadingButton] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [dismissedAlert, setDismissedAlert] = useState(false)
  const [sampleName, setSampleName] = useState('zohaib umer')
  const [sampleEmailName, setSampleEmailName] = useState('john.doe@company.com')
  const { showToast, showApiError } = useToast()

  const scoreTier = getProgressTier(sliderScore)

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* ── Page Header Component ──────────────────────────────────────── */}
      <PageHeader
        title="CareerPilot AI Design System"
        description="Unified design tokens, accessible text contrast (WCAG AA >= 4.5:1), threshold-driven semantic scoring (<40 danger, 40-69 warning, >=70 success), self-hosted Inter variable typography, and reusable primitives."
        breadcrumbs={[{ label: 'Developer' }, { label: 'Design System' }]}
        badge={
          <span className="rounded-md bg-brand-100 text-brand-900 border border-brand-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
            Dev Environment Only
          </span>
        }
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="brand"
              size="sm"
              leftIcon={<Sliders className="h-3.5 w-3.5" />}
              onClick={() => setIsModalOpen(true)}
            >
              Preview Modal
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Layers className="h-3.5 w-3.5" />}
              onClick={() => setIsDrawerOpen(true)}
            >
              Open Drawer
            </Button>
          </div>
        }
      />

      {/* ── Interactive Navigation Tabs ─────────────────────────────────── */}
      <Tabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'components', label: 'Component Library', badge: 17 },
          { id: 'thresholds', label: 'Score & Threshold Engine' },
          { id: 'typography', label: 'Typography & Contrast' },
          { id: 'colors', label: 'Color Scale & Elevation' },
        ]}
      />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: ALL COMPONENTS PREVIEW                                       */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <TabPanel tabId="components" activeTab={activeTab} className="space-y-10">
        {/* 1. BUTTONS */}
        <section className="space-y-4">
          <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Buttons</h2>
              <p className="text-xs text-slate-600">
                Primary, Brand, Secondary, Ghost, and Danger variants with 3 sizes, icons, visible 2px focus ring, and loading state.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsLoadingButton((prev) => !prev)}
            >
              Toggle Loading: {isLoadingButton ? 'ON' : 'OFF'}
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="p-4 space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Primary (Slate 900)
              </span>
              <div className="flex flex-col gap-2">
                <Button variant="primary" size="sm" isLoading={isLoadingButton}>
                  Small Primary
                </Button>
                <Button variant="primary" size="md" isLoading={isLoadingButton} rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
                  Medium Primary
                </Button>
                <Button variant="primary" size="lg" isLoading={isLoadingButton}>
                  Large Primary
                </Button>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Brand (Violet 600)
              </span>
              <div className="flex flex-col gap-2">
                <Button variant="brand" size="sm" isLoading={isLoadingButton}>
                  Small Brand
                </Button>
                <Button variant="brand" size="md" isLoading={isLoadingButton} leftIcon={<Sparkles className="h-3.5 w-3.5" />}>
                  Medium Brand
                </Button>
                <Button variant="brand" size="lg" isLoading={isLoadingButton}>
                  Large Brand
                </Button>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Secondary (Outlined)
              </span>
              <div className="flex flex-col gap-2">
                <Button variant="secondary" size="sm" isLoading={isLoadingButton}>
                  Small Secondary
                </Button>
                <Button variant="secondary" size="md" isLoading={isLoadingButton} leftIcon={<Folder className="h-3.5 w-3.5" />}>
                  Medium Secondary
                </Button>
                <Button variant="secondary" size="lg" isLoading={isLoadingButton}>
                  Large Secondary
                </Button>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Ghost (Subtle)
              </span>
              <div className="flex flex-col gap-2">
                <Button variant="ghost" size="sm" isLoading={isLoadingButton}>
                  Small Ghost
                </Button>
                <Button variant="ghost" size="md" isLoading={isLoadingButton}>
                  Medium Ghost
                </Button>
                <Button variant="ghost" size="lg" isLoading={isLoadingButton}>
                  Large Ghost
                </Button>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Danger (Rose 600)
              </span>
              <div className="flex flex-col gap-2">
                <Button variant="danger" size="sm" isLoading={isLoadingButton}>
                  Small Danger
                </Button>
                <Button variant="danger" size="md" isLoading={isLoadingButton} leftIcon={<Trash2 className="h-3.5 w-3.5" />}>
                  Medium Danger
                </Button>
                <Button variant="danger" size="lg" disabled>
                  Disabled Danger
                </Button>
              </div>
            </Card>
          </div>
        </section>

        {/* 2. FORM CONTROLS */}
        <section className="space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="text-base font-bold text-slate-900">Form Controls</h2>
            <p className="text-xs text-slate-600">
              Input (with icons, hints, error states, password toggle), Select, and Textarea with character counters.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <Card className="p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Text Inputs</h3>
              <Input
                label="Full Name"
                placeholder="e.g. Zohaib Umer"
                defaultValue="Zohaib Umer"
                hint="Your display name visible on reports."
              />
              <Input
                label="Search Keywords"
                placeholder="Search job roles, skills..."
                leadingIcon={<Search className="h-4 w-4" />}
              />
              <Input
                label="Email Address (Error State)"
                placeholder="user@example.com"
                defaultValue="invalid-email"
                error="Please enter a valid email address with an '@' domain."
              />
            </Card>

            <Card className="p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Password & Select</h3>
              <Input
                label="Account Password"
                isPassword
                defaultValue="SuperSecretPassword123"
                hint="Click eye icon to toggle visibility."
              />
              <Select
                label="Target Experience Tier"
                defaultValue="early-career"
                hint="Shapes roadmap pacing and interview difficulty."
                options={[
                  { value: 'student', label: 'Student / Intern' },
                  { value: 'fresh-graduate', label: 'Fresh Graduate (0-1 yrs)' },
                  { value: 'early-career', label: 'Early Career (1-3 yrs)' },
                  { value: 'mid-level', label: 'Mid-Level Professional (3-5 yrs)' },
                ]}
              />
            </Card>

            <Card className="p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Textarea & Validation</h3>
              <Textarea
                label="Career Goal / Target Statement"
                rows={3}
                defaultValue="Land a Senior Machine Learning Engineer position at a high-growth tech startup."
                showCount
                maxLength={200}
                hint="Parsed into roadmap generation prompts."
              />
              <Textarea
                label="Skills Inventory (Error State)"
                rows={2}
                defaultValue="Python"
                error="At least 3 core technical skills are required."
              />
            </Card>
          </div>
        </section>

        {/* 3. CARDS & ELEVATION */}
        <section className="space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="text-base font-bold text-slate-900">Card Architecture</h2>
            <p className="text-xs text-slate-600">
              Default surface, Elevated popover level, and Muted inset well, structured with Header, Title, Description, Content, and Footer slots.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <Card variant="default">
              <CardHeader>
                <div>
                  <CardTitle>Default Surface Card</CardTitle>
                  <CardDescription>Clean border with subtle Level 1 shadow</CardDescription>
                </div>
                <Badge variant="brand" size="sm">Active</Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-slate-600">
                <p>Standard foundational surface used for modules, widgets, and structured dashboard views.</p>
              </CardContent>
              <CardFooter>
                <span className="text-[11px] text-slate-500">Last updated: Just now</span>
                <Button variant="ghost" size="sm">Action</Button>
              </CardFooter>
            </Card>

            <Card variant="elevated" interactive>
              <CardHeader>
                <div>
                  <CardTitle>Elevated Interactive Card</CardTitle>
                  <CardDescription>Hover over me for subtle elevation shift</CardDescription>
                </div>
                <Badge variant="success" size="sm" dot>Job-Ready</Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-slate-600">
                <p>Provides gentle elevation lift (`-translate-y-0.5`) and brand border glow for clickable cards.</p>
              </CardContent>
              <CardFooter>
                <span className="text-[11px] text-emerald-800 font-semibold">94% Readiness</span>
                <Button variant="brand" size="sm">Explore</Button>
              </CardFooter>
            </Card>

            <Card variant="muted">
              <CardHeader>
                <div>
                  <CardTitle>Muted Surface Card</CardTitle>
                  <CardDescription>Soft inset background for nested blocks</CardDescription>
                </div>
                <Badge variant="neutral" size="sm">Archived</Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-slate-600">
                <p>Ideal for callouts, secondary forms, code snippets, and background container wells.</p>
              </CardContent>
              <CardFooter>
                <span className="text-[11px] text-slate-500">Read-only container</span>
                <Button variant="secondary" size="sm">Inspect</Button>
              </CardFooter>
            </Card>
          </div>
        </section>

        {/* 4. BADGES & STATUS PILLS */}
        <section className="space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="text-base font-bold text-slate-900">Badges &amp; Status Pills</h2>
            <p className="text-xs text-slate-600">
              Guaranteed contrast compliance (&gt;= 4.5:1), with optional status indicator dot and icon.
            </p>
          </div>

          <Card className="p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="brand" dot>Brand Badge</Badge>
              <Badge variant="success" dot>Success / Ready</Badge>
              <Badge variant="warning" dot>Warning / Review</Badge>
              <Badge variant="danger" dot>Danger / Blocker</Badge>
              <Badge variant="info" dot>Info / RAG Source</Badge>
              <Badge variant="neutral" dot>Neutral Gray</Badge>
              <Badge variant="default">Default Gray</Badge>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-500 font-medium">Small Tier:</span>
              <Badge variant="brand" size="sm" dot>Small Brand</Badge>
              <Badge variant="success" size="sm" dot>Small Success</Badge>
              <Badge variant="warning" size="sm" dot>Small Warning</Badge>
              <Badge variant="danger" size="sm" dot>Small Danger</Badge>
              <Badge variant="info" size="sm" dot>Small Info</Badge>
            </div>
          </Card>
        </section>

        {/* 5. FEEDBACK, ALERTS & OVERLAYS */}
        <section className="space-y-4">
          <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Alerts &amp; Dropdown Menus</h2>
              <p className="text-xs text-slate-600">
                Semantic feedback banners with strict contrast ratios, dismissible options, and keyboard menus.
              </p>
            </div>
            <DropdownMenu
              trigger={
                <Button variant="secondary" size="sm" rightIcon={<Settings className="h-3.5 w-3.5" />}>
                  Actions Menu
                </Button>
              }
              items={[
                { id: '1', label: 'Edit Profile Settings', icon: <Settings className="h-3.5 w-3.5" /> },
                { id: '2', label: 'Export Career Roadmap PDF', icon: <Download className="h-3.5 w-3.5" /> },
                { id: '3', label: 'Copy Public Portfolio Link', icon: <Copy className="h-3.5 w-3.5" /> },
                { id: 'div1', label: '', divider: true },
                { id: '4', label: 'Reset Practice History', danger: true, icon: <Trash2 className="h-3.5 w-3.5" /> },
              ]}
            />
          </div>

          <div className="space-y-3">
            <Alert
              variant="info"
              title="RAG Context Active"
              description="Your responses are grounded against the Pakistan Remote Tech and STAR Interviewing knowledge base."
            />
            <Alert
              variant="success"
              title="Career Roadmap Generated"
              description="Your personalized 8-week plan has been constructed based on your target role 'AI Engineer'."
            />
            <Alert
              variant="warning"
              title="Resume ATS Score Moderate"
              description="We detected missing cloud deployment skills (Docker, Kubernetes) for this target role."
            />
            {!dismissedAlert && (
              <Alert
                variant="danger"
                title="Critical Skill Gap Blocker"
                description="Target role requires FastAPI experience. Click dismiss to test dismissible callback."
                onDismiss={() => setDismissedAlert(true)}
              />
            )}
            {dismissedAlert && (
              <Button variant="ghost" size="sm" onClick={() => setDismissedAlert(false)}>
                Restore Dismissed Alert
              </Button>
            )}

            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <Button
                variant="brand"
                size="sm"
                onClick={() =>
                  showToast({
                    variant: 'success',
                    title: 'Live Toast Notification',
                    message: 'Action completed successfully with automatic timeout.',
                  })
                }
              >
                Trigger Success Toast
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() =>
                  showApiError(
                    new Error('Simulated API connection failure'),
                    'Could not connect to Qwen AI inference engine.'
                  )
                }
              >
                Trigger API Error Toast
              </Button>
            </div>
          </div>
        </section>

        {/* 6. UTILITIES: AVATARS, TOOLTIPS, SKELETONS, EMPTY STATE */}
        <section className="space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="text-base font-bold text-slate-900">Utilities: Avatars, Tooltips, Skeletons</h2>
            <p className="text-xs text-slate-600">
              User initials capitalization, accessible tooltips, loading skeleton states, and empty states.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {/* Avatars */}
            <Card className="p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Avatar Component</h3>
              <div className="flex items-center gap-4">
                <Avatar name="zohaib umer" size="sm" status="online" />
                <Avatar name="sarah connor" size="md" status="busy" />
                <Avatar name="alexander the great" size="lg" status="offline" />
              </div>
              <p className="text-[11px] text-slate-500">
                Initials calculated automatically from properly capitalized names with online status dots.
              </p>
            </Card>

            {/* Tooltips */}
            <Card className="p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Tooltip Component</h3>
              <div className="flex flex-wrap gap-2 pt-2">
                <Tooltip content="Upload your CV in PDF format" position="top">
                  <Button variant="secondary" size="sm">Hover Top</Button>
                </Tooltip>
                <Tooltip content="Alibaba Cloud Qwen-Max evaluation" position="bottom">
                  <Button variant="secondary" size="sm">Hover Bottom</Button>
                </Tooltip>
                <Tooltip content="Keyboard accessible via Tab + Escape" position="right">
                  <Button variant="secondary" size="sm">Hover Right</Button>
                </Tooltip>
              </div>
              <p className="text-[11px] text-slate-500">
                Accessible via hover or keyboard Tab focus; dismisses on Escape key.
              </p>
            </Card>

            {/* Skeletons */}
            <Card className="p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Skeleton Loading States</h3>
              <div className="flex items-center gap-3">
                <Skeleton variant="circular" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton variant="text" width="60%" />
                  <Skeleton variant="text" width="90%" />
                </div>
              </div>
              <Skeleton variant="rectangular" height={36} className="w-full mt-2" />
            </Card>
          </div>

          {/* Empty State */}
          <EmptyState
            icon={<Compass className="h-6 w-6 text-brand-600" />}
            title="No Interview Simulations Found"
            description="You haven't completed any mock interviews for your current target role. Practice with Qwen AI to benchmark your readiness score."
            action={
              <Button variant="brand" size="sm" leftIcon={<Sparkles className="h-3.5 w-3.5" />}>
                Start First Mock Interview
              </Button>
            }
          />
        </section>
      </TabPanel>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: SCORE & THRESHOLD ENGINE PLAYGROUND                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <TabPanel tabId="thresholds" activeTab={activeTab} className="space-y-6">
        <Card className="p-6 space-y-6">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Interactive Live Demonstration
            </span>
            <h2 className="text-lg font-bold text-slate-900 mt-0.5">
              Strict Semantic Threshold Rules
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Progress &amp; Score colors must map strictly to threshold semantics, never decorative green for low progress:
              <br />
              <strong>&lt; 40:</strong> <span className="text-rose-700 font-bold">Danger / Critical Gap</span> (Rose) ·{' '}
              <strong>40 – 69:</strong> <span className="text-amber-700 font-bold">Warning / Needs Polish</span> (Amber) ·{' '}
              <strong>&gt;= 70:</strong> <span className="text-emerald-700 font-bold">Success / Job-Ready</span> (Emerald)
            </p>
          </div>

          {/* Live Slider Controller */}
          <div className="rounded-xl bg-slate-50 p-5 border border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="score-slider" className="text-xs font-bold text-slate-800">
                Adjust Mock Score / Progress Value:
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold text-slate-900 tabular-nums">
                  {sliderScore}%
                </span>
                <Badge
                  variant={
                    scoreTier === 'danger'
                      ? 'danger'
                      : scoreTier === 'warning'
                      ? 'warning'
                      : 'success'
                  }
                  dot
                >
                  {scoreTier === 'danger'
                    ? 'Critical Gap (<40)'
                    : scoreTier === 'warning'
                    ? 'Needs Polish (40-69)'
                    : 'Job-Ready (>=70)'}
                </Badge>
              </div>
            </div>

            <input
              id="score-slider"
              type="range"
              min="0"
              max="100"
              value={sliderScore}
              onChange={(e) => setSliderScore(Number(e.target.value))}
              className="w-full accent-brand-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
            />

            <div className="flex justify-between text-[11px] font-semibold text-slate-500 pt-1">
              <span className="text-rose-700">0% Danger Threshold</span>
              <span className="text-amber-700">40% Warning Threshold</span>
              <span className="text-emerald-700">70% Success Threshold</span>
              <span className="text-emerald-800">100%</span>
            </div>
          </div>

          {/* Live Synchronized Reactive Elements */}
          <div className="grid gap-5 md:grid-cols-3">
            {/* 1. ProgressBar */}
            <Card className="p-5 space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                ProgressBar (Automatic Threshold)
              </span>
              <ProgressBar value={sliderScore} showLabel label="Overall Career Readiness" />
              <p className="text-[11px] text-slate-500">
                Bar transitions automatically between Rose (&lt;40), Amber (40-69), and Emerald (&gt;=70).
              </p>
            </Card>

            {/* 2. ProgressRing */}
            <Card className="p-5 flex items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  ProgressRing Radial
                </span>
                <h4 className="text-sm font-bold text-slate-900 mt-1">ATS Match Gauge</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Animated SVG stroke with threshold-mapped color.
                </p>
              </div>
              <ProgressRing value={sliderScore} size={76} strokeWidth={7} label="Score" />
            </Card>

            {/* 3. Stat Card */}
            <Stat
              label="ATS Screening Tier"
              value={`${sliderScore}/100`}
              subtext="Grounded in parsed resume tokens"
              trend={{
                value: `${sliderScore >= 70 ? '+14% vs benchmark' : '-8% vs target'}`,
                positive: sliderScore >= 70,
              }}
              icon={<TrendingUp className="h-5 w-5" />}
            />
          </div>
        </Card>
      </TabPanel>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: TYPOGRAPHY & NAME FORMATTING HELPERS                        */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <TabPanel tabId="typography" activeTab={activeTab} className="space-y-6">
        {/* Name formatting utility live test */}
        <Card className="p-6 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">Name Capitalization Helpers</h2>
            <p className="text-xs text-slate-600">
              Fixes lowercase user names across the app (`formatDisplayName` and `firstName`).
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Input
                label="Raw Username Input"
                value={sampleName}
                onChange={(e) => setSampleName(e.target.value)}
                placeholder="type lowercase name..."
              />
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 text-xs space-y-1">
                <p className="text-slate-600">
                  <span className="font-semibold text-slate-800">formatDisplayName:</span>{' '}
                  <span className="font-bold text-brand-900">{formatDisplayName(sampleName)}</span>
                </p>
                <p className="text-slate-600">
                  <span className="font-semibold text-slate-800">firstName:</span>{' '}
                  <span className="font-bold text-brand-900">{firstName(sampleName)}</span>
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Input
                label="Email-derived Name Input"
                value={sampleEmailName}
                onChange={(e) => setSampleEmailName(e.target.value)}
                placeholder="email format..."
              />
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 text-xs space-y-1">
                <p className="text-slate-600">
                  <span className="font-semibold text-slate-800">formatDisplayName:</span>{' '}
                  <span className="font-bold text-brand-900">{formatDisplayName(sampleEmailName)}</span>
                </p>
                <p className="text-slate-600">
                  <span className="font-semibold text-slate-800">firstName:</span>{' '}
                  <span className="font-bold text-brand-900">{firstName(sampleEmailName)}</span>
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Defined Type Scale */}
        <Card className="p-6 space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">Defined Typography Scale</h2>
            <p className="text-xs text-slate-600">
              Self-hosted Inter Variable font (`@fontsource-variable/inter`) with fallback stack.
            </p>
          </div>

          <div className="space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Display (36px / Extrabold)
              </span>
              <p className="type-display mt-1">Accelerate Your Engineering Career</p>
            </div>

            <div className="border-b border-slate-100 pb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Heading 1 (24px / Bold)
              </span>
              <p className="type-h1 mt-1">AI Career Readiness Dashboard</p>
            </div>

            <div className="border-b border-slate-100 pb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Heading 2 (20px / Bold)
              </span>
              <p className="type-h2 mt-1">Mock Interview &amp; Skill Gap Analysis</p>
            </div>

            <div className="border-b border-slate-100 pb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Heading 3 (16px / Semibold)
              </span>
              <p className="type-h3 mt-1">Weekly Milestone Progress &amp; Tasks</p>
            </div>

            <div className="border-b border-slate-100 pb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Body Text (14px / Regular) — Contrast 9.6:1
              </span>
              <p className="type-body mt-1">
                CareerPilot AI analyzes your resume against industry benchmarks, identifies missing competencies, and builds step-by-step roadmaps.
              </p>
            </div>

            <div className="border-b border-slate-100 pb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Small Text (12px / Medium) — Contrast 5.9:1
              </span>
              <p className="type-small mt-1">
                Verified via Alibaba Cloud Qwen-Max · Fast inference · Grounded in local market frameworks.
              </p>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Caption / Overline (11px / Semibold Uppercase)
              </span>
              <p className="type-caption mt-1">
                SYSTEM ARCHITECTURE · SECURE MULTI-TENANCY · TABULAR METRICS: 98.4%
              </p>
            </div>
          </div>
        </Card>
      </TabPanel>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB 4: COLOR SCALE & ELEVATION                                     */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <TabPanel tabId="colors" activeTab={activeTab} className="space-y-6">
        <Card className="p-6 space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">Brand Color Scale (Refined Indigo/Violet)</h2>
            <p className="text-xs text-slate-600">
              50 through 950 palette tailored for primary CTA, active navigation pill, and brand highlights.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { shade: '50', hex: '#f5f3ff', text: 'text-slate-900', bg: 'bg-brand-50' },
              { shade: '100', hex: '#ede9fe', text: 'text-slate-900', bg: 'bg-brand-100' },
              { shade: '200', hex: '#ddd6fe', text: 'text-slate-900', bg: 'bg-brand-200' },
              { shade: '300', hex: '#c4b5fd', text: 'text-slate-900', bg: 'bg-brand-300' },
              { shade: '400', hex: '#a78bfa', text: 'text-white', bg: 'bg-brand-400' },
              { shade: '500', hex: '#8b5cf6', text: 'text-white', bg: 'bg-brand-500' },
              { shade: '600 (Primary)', hex: '#7c3aed', text: 'text-white', bg: 'bg-brand-600' },
              { shade: '700', hex: '#6d28d9', text: 'text-white', bg: 'bg-brand-700' },
              { shade: '800', hex: '#5b21b6', text: 'text-white', bg: 'bg-brand-800' },
              { shade: '900', hex: '#4c1d95', text: 'text-white', bg: 'bg-brand-900' },
              { shade: '950', hex: '#2e1065', text: 'text-white', bg: 'bg-brand-950' },
            ].map((c) => (
              <div
                key={c.shade}
                className={`rounded-xl p-3 border border-slate-200/80 shadow-2xs ${c.bg} ${c.text}`}
              >
                <span className="block text-[11px] font-bold">Brand {c.shade}</span>
                <span className="block text-[10px] font-mono opacity-80">{c.hex}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 pt-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Elevation Levels (3 Subtle Tiers)</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-elevation-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Elevation Level 1
                </span>
                <p className="text-xs font-semibold text-slate-800 mt-1">Default Cards &amp; Insets</p>
                <p className="text-[11px] text-slate-500 mt-0.5">`shadow-elevation-1`</p>
              </div>

              <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-elevation-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Elevation Level 2
                </span>
                <p className="text-xs font-semibold text-slate-800 mt-1">Hover States &amp; Popovers</p>
                <p className="text-[11px] text-slate-500 mt-0.5">`shadow-elevation-2`</p>
              </div>

              <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-elevation-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Elevation Level 3
                </span>
                <p className="text-xs font-semibold text-slate-800 mt-1">Modals &amp; Floating Drawers</p>
                <p className="text-[11px] text-slate-500 mt-0.5">`shadow-elevation-3`</p>
              </div>
            </div>
          </div>
        </Card>
      </TabPanel>

      {/* ── Interactive Modal Instance ──────────────────────────────────── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Design System Modal Demonstration"
        description="Full keyboard focus trap with Escape key dismissal and body scroll locking."
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" size="sm" onClick={() => setIsModalOpen(false)}>
              Confirm Action
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-600 leading-relaxed">
            This modal illustrates the elevated Level 3 shadow, backdrop blur, accessible ARIA attributes (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`), and seamless responsive sizing.
          </p>
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 text-xs">
            <span className="font-semibold text-slate-800">Candidate:</span> {formatDisplayName(sampleName)}
          </div>
        </div>
      </Modal>

      {/* ── Interactive Drawer Instance ─────────────────────────────────── */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="System Drawer"
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-600 leading-relaxed">
            Slide-over drawer component designed for mobile menus, filters, and detailed audit inspect sidebars.
          </p>
          <Button variant="primary" size="sm" className="w-full" onClick={() => setIsDrawerOpen(false)}>
            Close Drawer
          </Button>
        </div>
      </Drawer>
    </div>
  )
}
