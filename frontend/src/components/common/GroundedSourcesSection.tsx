import { useState } from 'react'
import { ChevronDown, ChevronUp, Database } from 'lucide-react'
import type { CitationRef } from '../../types'

interface GroundedSourcesSectionProps {
  sources?: CitationRef[]
  title?: string
  defaultOpen?: boolean
}

export function GroundedSourcesSection({
  sources,
  title = 'Referenced Knowledge Base Sources',
  defaultOpen = false,
}: GroundedSourcesSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  if (!sources || sources.length === 0) {
    return null
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs transition-all animate-fade-in">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-between w-full font-medium text-slate-800 hover:text-slate-950 transition"
      >
        <span className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-slate-600 shrink-0" />
          <span className="font-semibold text-slate-900">{title}</span>
          <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold text-slate-700">
            {sources.length}
          </span>
        </span>
        <span className="flex items-center gap-1 text-[11px] text-slate-500">
          <span>{isOpen ? 'Hide' : 'View'}</span>
          {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
      </button>

      {isOpen && (
        <div className="mt-2.5 pt-2 border-t border-slate-200/60 space-y-2">
          {sources.map((src) => {
            const isGlobal = src.scope === 'global'
            const simPercent = Math.min(100, Math.max(0, Math.round(src.similarity * 100)))

            return (
              <div
                key={src.id}
                className="rounded-lg border border-slate-200/80 bg-white p-2.5 space-y-1.5 shadow-2xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-900 text-white font-mono text-[10px] font-bold">
                      [{src.id}]
                    </span>
                    <span className="font-semibold text-slate-900 truncate text-[11px]">
                      {src.document_title}
                    </span>
                    {src.section_title && (
                      <span className="text-slate-500 text-[10px] truncate max-w-[150px]">
                        · {src.section_title}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`rounded px-1.5 py-0.2 text-[10px] font-semibold border ${
                        isGlobal
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      }`}
                    >
                      {isGlobal ? 'Built-in' : 'Your Document'}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                      <span>{simPercent}%</span>
                      <div className="w-12 h-1.5 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                        <div
                          className="h-full bg-slate-700 rounded-full"
                          style={{ width: `${simPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {src.snippet && (
                  <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-3 bg-slate-50/50 p-2 rounded border border-slate-100 font-normal">
                    {src.snippet}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
