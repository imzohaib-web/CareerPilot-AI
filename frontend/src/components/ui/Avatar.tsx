import React from 'react'
import { formatDisplayName } from '../../utils/formatters'

export type AvatarSize = 'sm' | 'md' | 'lg'
export type AvatarStatus = 'online' | 'offline' | 'busy'

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name?: string
  src?: string
  size?: AvatarSize
  status?: AvatarStatus
}

const sizeClasses: Record<AvatarSize, { container: string; text: string; dot: string }> = {
  sm: { container: 'h-7 w-7', text: 'text-[11px]', dot: 'h-2 w-2 ring-1' },
  md: { container: 'h-9 w-9', text: 'text-xs', dot: 'h-2.5 w-2.5 ring-2' },
  lg: { container: 'h-12 w-12', text: 'text-sm', dot: 'h-3 w-3 ring-2' },
}

const statusColors: Record<AvatarStatus, string> = {
  online: 'bg-emerald-500 ring-white',
  busy: 'bg-amber-500 ring-white',
  offline: 'bg-slate-400 ring-white',
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  src,
  size = 'md',
  status,
  className = '',
  ...props
}) => {
  const formattedName = formatDisplayName(name)
  const initials = formattedName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'CP'

  const sizes = sizeClasses[size]

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full bg-brand-50 border border-brand-200/90 text-brand-900 font-bold select-none shrink-0 ${sizes.container} ${sizes.text} ${className}`}
      {...props}
    >
      {src ? (
        <img
          src={src}
          alt={formattedName}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}

      {status && (
        <span
          className={`absolute bottom-0 right-0 rounded-full ${sizes.dot} ${statusColors[status]}`}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  )
}
