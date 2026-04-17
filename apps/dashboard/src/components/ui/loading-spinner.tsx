import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-8 h-8',
  }

  return (
    <Loader2
      className={cn('animate-spin text-[#ffba38]', sizes[size], className)}
    />
  )
}

export function LoadingCard() {
  return (
    <div className="rounded-lg border border-[#4f453f]/15 bg-[#353534]/40 p-6">
      <div className="space-y-3">
        <div className="h-4 w-1/4 animate-shimmer rounded" />
        <div className="h-8 w-1/2 animate-shimmer rounded" />
        <div className="h-3 w-3/4 animate-shimmer rounded" />
      </div>
    </div>
  )
}

export function LoadingTable() {
  return (
    <div className="rounded-lg border border-[#4f453f]/15 bg-[#353534]/40 overflow-hidden">
      <div className="p-4 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="h-4 w-1/4 animate-shimmer rounded" />
            <div className="h-4 w-1/3 animate-shimmer rounded" />
            <div className="h-4 w-1/6 animate-shimmer rounded" />
            <div className="h-4 w-1/5 animate-shimmer rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
