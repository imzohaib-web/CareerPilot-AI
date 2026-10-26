import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './index.css'
import App from './App.tsx'

// Fire-and-forget server wake-up ping as early as possible on app load
try {
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
  void fetch(`${apiBase}/api/health/ping`).catch(() => {})
} catch {
  // Fire-and-forget ping must never interrupt initialization
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
