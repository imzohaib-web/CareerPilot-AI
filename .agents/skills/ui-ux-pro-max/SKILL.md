---
name: ui-ux-pro-max
description: >-
  Advanced UI/UX Pro Max design system guidelines and implementation standards for modern AI SaaS platforms, dashboards, and enterprise web applications. Use when designing, refactoring, or evaluating web user interfaces, design systems, responsiveness, typography, layouts, and micro-interactions.
---

# UI/UX Pro Max Design System & Implementation Guide

The **UI/UX Pro Max** skill defines design excellence standards for modern AI-driven platforms, executive dashboards, and productivity applications. It bridges aesthetics, functionality, accessibility, and visual harmony.

---

## 1. Core Philosophy: Modern AI SaaS + Calm Productivity

A world-class AI application should feel:
- **Intelligent & Trustworthy**: Clear visual grounding, explicit confidence tiers, and transparent AI reasoning.
- **Calm & Uncluttered**: Generous whitespace, refined contrast, restrained saturation, and clear content prioritization.
- **Natural & Human-Centered**: Predictable layout flow, immediate interactive feedback, and intuitive touch/keyboard affordances.

### What to Avoid
- ❌ Generic, template-like admin dashboards with dense raw tables.
- ❌ Overly saturated rainbow gradients or neon gaming aesthetics.
- ❌ Heavy, blurry glassmorphism that obscures text readability.
- ❌ Truncated navigation labels or cramped header widths (`max-w-4xl`).
- ❌ Placeholder mock values or jarring layout shifts.

---

## 2. Design Tokens & Color Palette

### Neutral / Surface Hierarchy
- **Base Background**: `bg-slate-50` (soft, calm, anti-glare).
- **Card Surface**: `bg-white` with `border border-slate-200/80` and `shadow-card`.
- **Card Hover State**: `hover:border-brand-300 hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200`.
- **Secondary Surfaces**: `bg-slate-50/70` or `bg-slate-100/80` for inner wells and inset blocks.

### Brand & Accent System
- **Brand Primary (Indigo/Violet)**:
  - 50: `#f5f3ff` | 100: `#ede9fe` | 500: `#8b5cf6` | 600: `#7c3aed` | 700: `#6d28d9` | 900: `#4c1d95`
  - Used for primary CTA buttons, active navigation pills, brand logos, and AI feature highlights.
- **Semantic Accents**:
  - **Success / Job-Ready**: `emerald-600` (`bg-emerald-50`, `border-emerald-200`, `text-emerald-800`).
  - **In-Progress / Caution**: `amber-600` (`bg-amber-50`, `border-amber-200`, `text-amber-800`).
  - **Gaps / Blockers**: `rose-600` (`bg-rose-50`, `border-rose-200`, `text-rose-800`).
  - **Intelligence / RAG Knowledge**: `sky-600` / `indigo-600` (`bg-sky-50`, `border-sky-200`).

---

## 3. Typography & Hierarchy

### Font Stack
- **Primary Headings & UI**: `Plus Jakarta Sans`, `Inter`, system-ui, sans-serif.
- **Data & Code**: `JetBrains Mono`, `ui-monospace`, monospace.

### Type Scale & Hierarchy
- **Hero Title**: `text-2xl sm:text-3xl font-bold tracking-tight text-slate-900`.
- **Section Heading**: `text-base sm:text-lg font-bold text-slate-900`.
- **Card Header**: `text-sm sm:text-base font-bold text-slate-900`.
- **Body Text**: `text-xs sm:text-sm text-slate-600 leading-relaxed`.
- **Overline / Category Tag**: `text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400`.
- **Interactive Labels**: `text-xs font-semibold`.

---

## 4. Layout Architecture & Responsive Design

### Navigation Shell (`AppLayout`)
- Full-width header (`max-w-7xl` container) with `glass-header` (`bg-white/80 backdrop-blur-md border-b border-slate-200/80`).
- Unified iconography via `lucide-react`.
- Desktop active pills with subtle drop-shadow (`bg-white text-brand-700 shadow-sm`).
- User profile badge with avatar initials and online indicator.
- Dedicated mobile drawer menu with touch-friendly touch targets (min 44px height).

### Dashboard Layouts
- **Hero Command Banner**: High-impact gradient background (`bg-gradient-to-r from-slate-900 via-indigo-950 to-brand-950`), clear greeting, current target role badge, and 1-click CTA.
- **Radial Score & Progress Hub**: Large visual score display (`text-3xl font-extrabold`) paired with ATS score breakdown and overall journey progress bars.
- **Visual Career Journey**: Step-by-step pipeline indicator showing completed, active, and upcoming steps with icon markers.
- **Modular Action Cards**: 2-column or 4-column cards with icon badges, live status tags, metrics, and hover transitions.

---

## 5. Micro-Interactions, Motion & States

### Motion Standards (Framer Motion / CSS Keyframes)
- **Entrance Animation**: `animate-fade-in` (`fade-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards`).
- **AI Processing Pulse**: `animate-pulse-subtle` on AI badges and scanning indicators.
- **Button Interactions**: `hover:brightness-110 active:scale-98 transition-all duration-150`.
- **Reduced Motion**: Respect `prefers-reduced-motion: reduce`.

### Loading, Empty, and Error States
1. **Loading**: Use sleek skeleton placeholders mimicking actual content cards rather than bare spinners.
2. **Empty States**: Clear illustrative icon, friendly title, explanatory subtitle, and prominent action CTA.
3. **Error States**: Soft semantic banner (`bg-rose-50 border-rose-200`) with clear explanation and a dedicated **Retry** button.
4. **Success States**: Subtle toast or pill confirmation with timestamp.

---

## 6. Accessibility (a11y) Best Practices
- High-contrast text compliance (minimum 4.5:1 ratio against background).
- Visible focus rings (`focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2`).
- Descriptive `aria-label` tags for icon-only buttons (audio playback, media toggles, delete buttons).
- Proper semantic HTML elements (`<header>`, `<main>`, `<nav>`, `<section>`, `<article>`, `<button>`).
