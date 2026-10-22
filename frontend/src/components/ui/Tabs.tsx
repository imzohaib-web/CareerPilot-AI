import React, { useRef } from 'react'

export interface TabItem {
  id: string
  label: string
  badge?: string | number
  icon?: React.ReactNode
}

export interface TabsProps {
  tabs: TabItem[]
  activeTab: string
  onChange: (tabId: string) => void
  variant?: 'pills' | 'underline'
  className?: string
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  variant = 'pills',
  className = '',
}) => {
  const tabListRef = useRef<HTMLDivElement>(null)

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    let targetIndex = -1
    if (e.key === 'ArrowRight') {
      targetIndex = (currentIndex + 1) % tabs.length
    } else if (e.key === 'ArrowLeft') {
      targetIndex = (currentIndex - 1 + tabs.length) % tabs.length
    } else if (e.key === 'Home') {
      targetIndex = 0
    } else if (e.key === 'End') {
      targetIndex = tabs.length - 1
    }

    if (targetIndex >= 0) {
      e.preventDefault()
      onChange(tabs[targetIndex].id)
      const buttons = tabListRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      buttons?.[targetIndex]?.focus()
    }
  }

  return (
    <div
      ref={tabListRef}
      role="tablist"
      aria-orientation="horizontal"
      className={`flex items-center gap-1 ${
        variant === 'pills'
          ? 'bg-slate-100/90 p-1 rounded-xl border border-slate-200/80'
          : 'border-b border-slate-200 gap-4'
      } ${className}`}
    >
      {tabs.map((tab, idx) => {
        const isActive = tab.id === activeTab
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            id={`tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 focus-visible:ring-offset-white ${
              variant === 'pills'
                ? `px-3 py-1.5 rounded-lg select-none ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`
                : `pb-2.5 px-1 border-b-2 font-medium ${
                    isActive
                      ? 'border-brand-600 text-brand-900 font-bold'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  }`
            }`}
          >
            {tab.icon && <span className="shrink-0" aria-hidden="true">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`ml-1 rounded px-1.5 py-0.2 text-[10px] font-bold ${
                  isActive
                    ? 'bg-brand-100 text-brand-900'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  tabId: string
  activeTab: string
}

export const TabPanel: React.FC<TabPanelProps> = ({
  tabId,
  activeTab,
  className = '',
  children,
  ...props
}) => {
  if (tabId !== activeTab) return null

  return (
    <div
      role="tabpanel"
      id={`panel-${tabId}`}
      aria-labelledby={`tab-${tabId}`}
      tabIndex={0}
      className={`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded-lg animate-fade-in ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
