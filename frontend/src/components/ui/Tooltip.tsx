import React, { useState, useId } from 'react'

export interface TooltipProps {
  content: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>
  delay?: number
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  position = 'top',
  children,
  delay = 200,
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [timer, setTimer] = useState<number | null>(null)
  const tooltipId = useId()

  const handleMouseEnter = () => {
    const id = window.setTimeout(() => setIsVisible(true), delay)
    setTimer(id)
  }

  const handleMouseLeave = () => {
    if (timer) clearTimeout(timer)
    setIsVisible(false)
  }

  const handleFocus = () => setIsVisible(true)
  const handleBlur = () => setIsVisible(false)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsVisible(false)
    }
  }

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  const clonedChild = React.cloneElement(children, {
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onFocus: handleFocus,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
    'aria-describedby': isVisible ? tooltipId : undefined,
  } as React.HTMLAttributes<HTMLElement>)

  return (
    <div className="relative inline-flex items-center">
      {clonedChild}
      {isVisible && (
        <div
          id={tooltipId}
          role="tooltip"
          className={`absolute z-50 pointer-events-none whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white shadow-elevation-2 animate-fade-in ${positionClasses[position]}`}
        >
          {content}
        </div>
      )}
    </div>
  )
}
