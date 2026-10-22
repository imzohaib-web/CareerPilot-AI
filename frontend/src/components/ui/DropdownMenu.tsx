import React, { useEffect, useRef, useState, useId } from 'react'

export interface DropdownMenuItem {
  id: string
  label: string
  icon?: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  danger?: boolean
  divider?: boolean
}

export interface DropdownMenuProps {
  trigger: React.ReactNode
  items: DropdownMenuItem[]
  align?: 'left' | 'right'
  className?: string
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  trigger,
  items,
  align = 'right',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  // Close on click outside or Escape
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
        const btn = triggerRef.current?.querySelector('button')
        btn?.focus()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  function handleItemClick(item: DropdownMenuItem) {
    if (item.disabled) return
    setIsOpen(false)
    item.onClick?.()
  }

  return (
    <div ref={menuRef} className={`relative inline-block text-left ${className}`}>
      <div
        ref={triggerRef}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {trigger}
      </div>

      {isOpen && (
        <div
          id={menuId}
          role="menu"
          aria-orientation="vertical"
          className={`absolute z-50 mt-1.5 w-52 rounded-xl bg-white border border-slate-200/90 py-1.5 shadow-elevation-2 animate-fade-in focus:outline-none ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((item, idx) => {
            if (item.divider) {
              return <div key={`div-${idx}`} className="my-1 border-t border-slate-100" />
            }

            return (
              <button
                key={item.id}
                role="menuitem"
                disabled={item.disabled}
                onClick={() => handleItemClick(item)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors text-left ${
                  item.danger
                    ? 'text-rose-700 hover:bg-rose-50 hover:text-rose-900'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                } disabled:opacity-40 disabled:pointer-events-none`}
              >
                {item.icon && <span className="h-4 w-4 shrink-0" aria-hidden="true">{item.icon}</span>}
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
