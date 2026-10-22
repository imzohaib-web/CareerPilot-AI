import React, { forwardRef } from 'react'

export type CardVariant = 'default' | 'elevated' | 'muted'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  interactive?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', interactive = false, className = '', children, ...props }, ref) => {
    const variantStyles: Record<CardVariant, string> = {
      default: 'bg-white border-slate-200/90 shadow-card',
      elevated: 'bg-white border-slate-200 shadow-elevation-2',
      muted: 'bg-slate-50/80 border-slate-200/80 shadow-none',
    }

    const interactiveStyles = interactive
      ? 'hover:border-brand-300 hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer transition-all duration-200'
      : 'transition-colors duration-150'

    return (
      <div
        ref={ref}
        className={`rounded-xl border ${variantStyles[variant]} ${interactiveStyles} ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  }
)
Card.displayName = 'Card'

export const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...props }, ref) => (
    <div
      ref={ref}
      className={`px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
)
CardHeader.displayName = 'CardHeader'

export const CardTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className = '', children, ...props }, ref) => (
    <h3
      ref={ref}
      className={`text-sm sm:text-base font-bold text-slate-900 tracking-tight ${className}`}
      {...props}
    >
      {children}
    </h3>
  )
)
CardTitle.displayName = 'CardTitle'

export const CardDescription = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className = '', children, ...props }, ref) => (
    <p
      ref={ref}
      className={`text-xs text-slate-600 mt-0.5 leading-relaxed ${className}`}
      {...props}
    >
      {children}
    </p>
  )
)
CardDescription.displayName = 'CardDescription'

export const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...props }, ref) => (
    <div ref={ref} className={`p-5 ${className}`} {...props}>
      {children}
    </div>
  )
)
CardContent.displayName = 'CardContent'

export const CardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...props }, ref) => (
    <div
      ref={ref}
      className={`px-5 py-3.5 bg-slate-50/60 border-t border-slate-100 rounded-b-xl flex items-center justify-between gap-3 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
)
CardFooter.displayName = 'CardFooter'
