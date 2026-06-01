import { DollarSign, Gauge, Database, Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react'

export interface TrendData {
  value: number
  direction: 'up' | 'down' | 'flat'
}

interface MetricCardsProps {
  metrics: {
    totalCost: number
    avgLatency: number
    cacheHitRate: number
    tokensProcessed: number
  }
  trends: {
    cost: TrendData
    latency: TrendData
    cache: TrendData
    tokens: TrendData
  }
  comparisonText: string
}

const TrendIcon = ({ direction }: { direction: 'up' | 'down' | 'flat' }) =>
  direction === 'up' ? <TrendingUp className="w-3 h-3" /> :
  direction === 'down' ? <TrendingDown className="w-3 h-3" /> :
  <Minus className="w-3 h-3" />

const trendColor = (direction: 'up' | 'down' | 'flat', isGood: boolean) => {
  if (direction === 'flat') return 'text-[#e5e2e1]/60'
  return (direction === 'up') === isGood ? 'text-emerald-400' : 'text-[#ffb4ab]'
}

export function MetricCards({ metrics, trends, comparisonText }: MetricCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div className="bg-[#353534] p-6 rounded-lg relative overflow-hidden group">
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-[#ffba38]/5 rounded-full blur-2xl group-hover:bg-[#ffba38]/10 transition-all duration-500" />
        <div className="flex justify-between items-start mb-4">
          <span className="text-[#e5e2e1]/60 text-xs uppercase tracking-[0.2em] font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Total Cost</span>
          <DollarSign className="w-5 h-5 text-[#ffba38]" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-bold text-[#e5e2e1] tracking-tighter" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>${metrics.totalCost.toFixed(2)}</span>
        </div>
        <div className="mt-2 flex items-center gap-1 text-sm">
          <span className={`flex items-center gap-0.5 ${trendColor(trends.cost.direction, false)}`}><TrendIcon direction={trends.cost.direction} />{trends.cost.value}%</span>
          <span className="text-[#e5e2e1]/60 ml-1">{comparisonText}</span>
        </div>
      </div>

      <div className="bg-[#1c1b1b] p-6 rounded-lg relative overflow-hidden group">
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-[#e2bfb0]/5 rounded-full blur-2xl group-hover:bg-[#e2bfb0]/10 transition-all duration-500" />
        <div className="flex justify-between items-start mb-4">
          <span className="text-[#e5e2e1]/60 text-xs uppercase tracking-[0.2em] font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Avg. Latency</span>
          <Gauge className="w-5 h-5 text-[#e2bfb0]" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-bold text-[#e5e2e1] tracking-tighter" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{Math.round(metrics.avgLatency)}</span>
          <span className="text-[#e5e2e1]/60 font-medium">ms</span>
        </div>
        <div className="mt-2 flex items-center gap-1 text-sm">
          <span className={`flex items-center gap-0.5 ${trendColor(trends.latency.direction, false)}`}><TrendIcon direction={trends.latency.direction} />{trends.latency.value}%</span>
          <span className="text-[#e5e2e1]/60 ml-1">{comparisonText}</span>
        </div>
      </div>

      <div className="bg-[#1c1b1b] p-6 rounded-lg relative overflow-hidden group">
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-[#e9c349]/5 rounded-full blur-2xl group-hover:bg-[#e9c349]/10 transition-all duration-500" />
        <div className="flex justify-between items-start mb-4">
          <span className="text-[#e5e2e1]/60 text-xs uppercase tracking-[0.2em] font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Cache Hit Rate</span>
          <Database className="w-5 h-5 text-[#e9c349]" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-bold text-[#e5e2e1] tracking-tighter" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{metrics.cacheHitRate}</span>
          <span className="text-[#e5e2e1]/60 font-medium">%</span>
        </div>
        <div className="mt-2 flex items-center gap-1 text-sm">
          <span className={`flex items-center gap-0.5 ${trendColor(trends.cache.direction, true)}`}><TrendIcon direction={trends.cache.direction} />{trends.cache.value}%</span>
          <span className="text-[#e5e2e1]/60 ml-1">{comparisonText}</span>
        </div>
      </div>

      <div className="bg-[#1c1b1b] p-6 rounded-lg relative overflow-hidden group">
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-[#e5e2e1]/5 rounded-full blur-2xl group-hover:bg-[#e5e2e1]/10 transition-all duration-500" />
        <div className="flex justify-between items-start mb-4">
          <span className="text-[#e5e2e1]/60 text-xs uppercase tracking-[0.2em] font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Tokens Processed</span>
          <Activity className="w-5 h-5 text-[#e5e2e1]/60" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-bold text-[#e5e2e1] tracking-tighter" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{metrics.tokensProcessed.toFixed(2)}</span>
          <span className="text-[#e5e2e1]/60 font-medium">M</span>
        </div>
        <div className="mt-2 flex items-center gap-1 text-sm">
          <span className={`flex items-center gap-0.5 ${trendColor(trends.tokens.direction, true)}`}><TrendIcon direction={trends.tokens.direction} />{trends.tokens.value}%</span>
          <span className="text-[#e5e2e1]/60 ml-1">{comparisonText}</span>
        </div>
      </div>
    </div>
  )
}
