import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default'
  size?: 'sm' | 'md'
  children: React.ReactNode
}

export function Badge({
  variant = 'default',
  size = 'sm',
  children,
  className,
  ...props
}: BadgeProps) {
  const baseStyles = 'inline-flex items-center rounded font-medium'
  
  const variants = {
    success: 'bg-emerald-900 text-emerald-500',
    warning: 'bg-amber-900 text-amber-500',
    error: 'bg-red-900 text-red-500',
    info: 'bg-blue-900 text-blue-400',
    default: 'bg-slate-800 text-slate-400',
  }
  
  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  }

  return (
    <span
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
