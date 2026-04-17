import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react'
import { Card } from './card'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: string | number
  icon?: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  description?: string
  className?: string
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  description,
  className,
}: MetricCardProps) {
  const getTrendIcon = () => {
    if (!trend) return null
    if (trend.value === 0) return <Minus className="w-4 h-4" />
    return trend.isPositive ? (
      <TrendingUp className="w-4 h-4" />
    ) : (
      <TrendingDown className="w-4 h-4" />
    )
  }

  const getTrendColor = () => {
    if (!trend || trend.value === 0) return 'text-slate-400'
    return trend.isPositive ? 'text-emerald-500' : 'text-red-500'
  }

  return (
    <Card className={cn('relative overflow-hidden', className)} hover>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-400 uppercase tracking-wide">
            {title}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-3xl font-bold text-slate-100">{value}</p>
            {trend && (
              <span className={cn('flex items-center gap-1 text-sm font-medium', getTrendColor())}>
                {getTrendIcon()}
                {Math.abs(trend.value)}%
              </span>
            )}
          </div>
          {description && (
            <p className="mt-1 text-sm text-slate-400">{description}</p>
          )}
        </div>
        {Icon && (
          <div className="rounded-lg bg-blue-500/10 p-3">
            <Icon className="w-6 h-6 text-blue-400" />
          </div>
        )}
      </div>
    </Card>
  )
}
