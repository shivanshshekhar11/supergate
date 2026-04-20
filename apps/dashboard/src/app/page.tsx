'use client'

import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/contexts/auth-context'
import { usageAPI } from '@/lib/gateway-client'
import { useState, useEffect, useMemo } from 'react'
import type { UsageSummary, UsageBreakdown, UsageLogsResponse, UsageChartResponse } from '@/lib/gateway-client'
import {
  TrendingUp, TrendingDown, Minus,
  DollarSign, Gauge, Database, Activity,
  ArrowRight, AlertCircle, Calendar, Filter, RefreshCw,
} from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

type TimeRange = '24h' | '7d' | '30d'

const ALL_PROVIDERS = [
  { id: 'all', name: 'All Providers' },
  { id: 'openai',    name: 'OpenAI'    },
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'google',    name: 'Google'    },
  { id: 'cohere',    name: 'Cohere'    },
  { id: 'mistral',   name: 'Mistral'   },
]

// Map dashboard TimeRange to the period param used by summary/breakdown endpoints
function toPeriod(tr: TimeRange): 'daily' | 'weekly' | 'monthly' {
  if (tr === '24h') return 'daily'
  if (tr === '7d')  return 'weekly'
  return 'monthly'
}

export default function DashboardPage() {
  const { token } = useAuth()
  const [isLoading, setIsLoading]   = useState(true)
  const [error, setError]           = useState<string | null>(null)

  // Filters
  const [timeRange, setTimeRange]         = useState<TimeRange>('7d')
  const [providerFilter, setProviderFilter] = useState<string>('all')
  const [showTimeMenu, setShowTimeMenu]   = useState(false)
  const [showProvMenu, setShowProvMenu]   = useState(false)

  const [usageSummary,   setUsageSummary]   = useState<UsageSummary | null>(null)
  const [usageBreakdown, setUsageBreakdown] = useState<UsageBreakdown | null>(null)
  const [chartData,      setChartData]      = useState<UsageChartResponse | null>(null)
  const [recentLogs,     setRecentLogs]     = useState<UsageLogsResponse | null>(null)

  // Re-fetch whenever either filter changes
  useEffect(() => {
    if (!token) { setError('Not authenticated.'); setIsLoading(false); return }

    let cancelled = false
    async function load() {
      try {
        setIsLoading(true)
        setError(null)

        const period = toPeriod(timeRange)
        const logsTimeRange = timeRange  // already '24h'|'7d'|'30d'

        const [summary, breakdown, chart, logs] = await Promise.all([
          usageAPI.getSummary(token!, period),
          usageAPI.getBreakdown(token!, period, providerFilter),
          usageAPI.getChart(token!, timeRange, providerFilter),
          usageAPI.getLogs(token!, { pageSize: 5, timeRange: logsTimeRange, provider: providerFilter }),
        ])

        if (cancelled) return
        setUsageSummary(summary)
        setUsageBreakdown(breakdown)
        setChartData(chart)
        setRecentLogs(logs)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [token, timeRange, providerFilter])

  // Close dropdowns on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('.menu-container')) {
        setShowTimeMenu(false)
        setShowProvMenu(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  // Derive buckets early so metrics can use them
  const buckets: UsageChartResponse['buckets'] = chartData?.buckets ?? []

  // Metrics — derived from chart buckets (already filtered by provider + time range server-side)
  // avgLatency and cacheHitRate come from buckets so they respect both filters.
  const metrics = useMemo(() => {
    const totalCost    = usageBreakdown?.reduce((s, i) => s + i.costUsd, 0) ?? 0
    const totalTokens  = usageBreakdown?.reduce((s, i) => s + i.inputTokens + i.outputTokens, 0) ?? 0

    const totalReqs    = buckets.reduce((s, b) => s + b.requests, 0)
    const totalCache   = buckets.reduce((s, b) => s + b.cacheHits, 0)
    const cacheHitRate = totalReqs > 0 ? Math.round((totalCache / totalReqs) * 100) : 0

    // Weighted average latency across buckets that have requests
    const weightedLatency = buckets.reduce((s, b) => s + b.avgLatencyMs * b.requests, 0)
    const avgLatency      = totalReqs > 0 ? Math.round(weightedLatency / totalReqs) : 0

    return { totalCost, avgLatency, cacheHitRate, tokensProcessed: totalTokens / 1_000_000 }
  }, [usageBreakdown, buckets])

  // Cost by provider — already server-filtered, just aggregate by provider name
  const providerCosts = useMemo(() => {
    if (!usageBreakdown || usageBreakdown.length === 0) return []
    const map = new Map<string, number>()
    usageBreakdown.forEach(item => map.set(item.provider, (map.get(item.provider) ?? 0) + item.costUsd))
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0)
    return Array.from(map.entries())
      .map(([provider, cost]) => ({ provider, cost, percentage: total > 0 ? Math.round((cost / total) * 100) : 0 }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5)
  }, [usageBreakdown])

  // Trend helpers
  const calculateTrend = (days: { costUsd: number; requests: number }[] | undefined, metric: 'cost' | 'requests') => {
    if (!days || days.length < 2) return { value: 0, direction: 'flat' as const }
    const last = days[days.length - 1]
    const prev = days.slice(0, -1)
    const avg = prev.reduce((s, d) => s + (metric === 'cost' ? d.costUsd : d.requests), 0) / prev.length
    if (avg === 0) return { value: 0, direction: 'flat' as const }
    const change = ((( metric === 'cost' ? last.costUsd : last.requests) - avg) / avg) * 100
    if (Math.abs(change) < 1) return { value: 0, direction: 'flat' as const }
    return { value: Math.abs(Math.round(change)), direction: change > 0 ? 'up' as const : 'down' as const }
  }

  const trends = {
    cost:    calculateTrend(usageSummary?.days, 'cost'),
    tokens:  calculateTrend(usageSummary?.days, 'requests'),
    latency: { value: 0, direction: 'flat' as const },
    cache:   { value: 0, direction: 'flat' as const },
  }

  const comparisonText = timeRange === '24h' ? 'vs yesterday' : timeRange === '7d' ? 'vs last week' : 'vs last month'
  const timeLabel      = timeRange === '24h' ? 'Last 24 Hours' : timeRange === '7d' ? 'Last 7 Days' : 'Last 30 Days'
  const periodLabel    = timeRange === '24h' ? 'Last 24 hours' : timeRange === '7d' ? 'Last 7 days' : 'Last 30 days'

  const TrendIcon = ({ direction }: { direction: 'up' | 'down' | 'flat' }) =>
    direction === 'up' ? <TrendingUp className="w-3 h-3" /> :
    direction === 'down' ? <TrendingDown className="w-3 h-3" /> :
    <Minus className="w-3 h-3" />

  const trendColor = (direction: 'up' | 'down' | 'flat', isGood: boolean) => {
    if (direction === 'flat') return 'text-[#e5e2e1]/60'
    return (direction === 'up') === isGood ? 'text-emerald-400' : 'text-[#ffb4ab]'
  }

  const recentRequests = useMemo(() => (recentLogs?.logs ?? []).map(log => ({
    status:     log.statusCode === 200 ? '200 OK' : log.statusCode === 429 ? '429 Rate Limited' : `${log.statusCode} Error`,
    statusType: log.statusCode === 200 ? 'success' as const : 'error' as const,
    provider:   log.provider,
    model:      log.model,
    latency:    log.cached ? 'CACHE HIT' : `${log.latencyMs}ms`,
    cost:       `$${log.costUsd.toFixed(4)}`,
    timestamp:  new Date(log.createdAt).toLocaleTimeString(),
    cached:     log.cached,
  })), [recentLogs])

  // ── Loading / Error / Empty ──────────────────────────────────────────────────

  if (isLoading) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-[#e5e2e1]/60" style={{ fontFamily: 'Manrope, sans-serif' }}>Loading dashboard data...</p>
        </div>
      </div>
    </DashboardLayout>
  )

  if (error) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#93000a]/20 mb-4">
            <AlertCircle className="w-8 h-8 text-[#ffb4ab]" />
          </div>
          <h2 className="text-2xl font-bold text-[#e5e2e1] mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Failed to Load Dashboard</h2>
          <p className="text-[#e5e2e1]/60 mb-6" style={{ fontFamily: 'Manrope, sans-serif' }}>{error}</p>
          <button onClick={() => window.location.reload()} className="bg-gradient-to-br from-[#ffba38] to-[#c78b00] text-[#281900] px-6 py-2 rounded-md font-medium hover:shadow-[0_0_20px_rgba(255,186,56,0.3)] transition-all">Retry</button>
        </div>
      </div>
    </DashboardLayout>
  )

  if (!usageSummary || usageSummary.totalRequests === 0) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#ffba38]/10 mb-4">
            <Activity className="w-8 h-8 text-[#ffba38]" />
          </div>
          <h2 className="text-2xl font-bold text-[#e5e2e1] mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>No Data Yet</h2>
          <p className="text-[#e5e2e1]/60 mb-6" style={{ fontFamily: 'Manrope, sans-serif' }}>Start making requests to your gateway to see analytics here.</p>
          <a href="http://localhost:3000/docs" target="_blank" rel="noopener noreferrer" className="inline-block bg-gradient-to-br from-[#ffba38] to-[#c78b00] text-[#281900] px-6 py-2 rounded-md font-medium hover:shadow-[0_0_20px_rgba(255,186,56,0.3)] transition-all">View API Docs</a>
        </div>
      </div>
    </DashboardLayout>
  )

  const maxVolume    = Math.max(...buckets.map((b: UsageChartResponse['buckets'][number]) => b.requests), 1)
  const providerName = ALL_PROVIDERS.find(p => p.id === providerFilter)?.name ?? 'All Providers'

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold text-[#e5e2e1] tracking-[-0.02em] leading-none mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Dashboard</h1>
          <p className="text-[#e5e2e1]/70 text-base sm:text-lg tracking-[0.01em]" style={{ fontFamily: 'Manrope, sans-serif' }}>Overview of LLM Gateway performance and consumption.</p>
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button onClick={() => window.location.reload()} className="flex items-center gap-2 bg-[#1c1b1b] hover:bg-[#353534] text-[#e5e2e1] px-3 sm:px-4 py-2 rounded-md transition-colors border border-[#4f453f]/15">
            <RefreshCw className="w-4 h-4" /><span className="text-sm font-medium hidden sm:inline">Refresh</span>
          </button>

          {/* Time Range */}
          <div className="relative menu-container">
            <button onClick={() => setShowTimeMenu(!showTimeMenu)} className="flex items-center gap-2 bg-[#1c1b1b] hover:bg-[#353534] text-[#e5e2e1] px-4 py-2 rounded-md transition-colors border border-[#4f453f]/15">
              <Calendar className="w-4 h-4" /><span className="text-sm font-medium">{timeLabel}</span>
            </button>
            {showTimeMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-[#131313] border border-[#4f453f]/20 rounded-md shadow-xl z-50">
                {(['24h', '7d', '30d'] as const).map(r => (
                  <button key={r} onClick={() => { setTimeRange(r); setShowTimeMenu(false) }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-[#1c1b1b] transition-colors ${timeRange === r ? 'text-[#ffba38]' : 'text-[#e5e2e1]'}`}>
                    {r === '24h' ? 'Last 24 Hours' : r === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Provider */}
          <div className="relative menu-container">
            <button onClick={() => setShowProvMenu(!showProvMenu)} className="flex items-center gap-2 bg-[#1c1b1b] hover:bg-[#353534] text-[#e5e2e1] px-4 py-2 rounded-md transition-colors border border-[#4f453f]/15">
              <Filter className="w-4 h-4" /><span className="text-sm font-medium">{providerName}</span>
            </button>
            {showProvMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-[#131313] border border-[#4f453f]/20 rounded-md shadow-xl z-50">
                {ALL_PROVIDERS.map(p => (
                  <button key={p.id} onClick={() => { setProviderFilter(p.id); setShowProvMenu(false) }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-[#1c1b1b] transition-colors ${providerFilter === p.id ? 'text-[#ffba38]' : 'text-[#e5e2e1]'}`}>
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Metric Cards */}
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Request Volume Chart */}
        <div className="lg:col-span-2 bg-[#0e0e0e] rounded-lg p-6 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-[#0e0e0e] via-[#ffba38]/20 to-[#0e0e0e]" />
          <div className="flex justify-between items-start mb-1">
            <h2 className="text-2xl font-bold text-[#e5e2e1] tracking-[-0.01em]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Request Volume vs. Cache Hits
            </h2>
            {providerFilter !== 'all' && (
              <span className="text-sm text-[#ffba38] font-medium mt-1">{providerName}</span>
            )}
          </div>
          <p className="text-xs text-[#e5e2e1]/40 mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>{periodLabel}</p>

          {/* Legend + period totals */}
          {buckets.length > 0 && (() => {
            const totalReqs  = buckets.reduce((s, b) => s + b.requests, 0)
            const totalCache = buckets.reduce((s, b) => s + b.cacheHits, 0)
            const hitRate    = totalReqs > 0 ? Math.round((totalCache / totalReqs) * 100) : 0
            return (
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-[#353534] inline-block" />
                    <span className="text-xs text-[#e5e2e1]/50" style={{ fontFamily: 'Manrope, sans-serif' }}>Total requests</span>
                    <span className="text-xs font-mono text-[#e5e2e1]/70 ml-1">{totalReqs.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-[#ffba38]/60 inline-block" />
                    <span className="text-xs text-[#e5e2e1]/50" style={{ fontFamily: 'Manrope, sans-serif' }}>Cache hits</span>
                    <span className="text-xs font-mono text-[#ffba38] ml-1">{totalCache.toLocaleString()}</span>
                  </div>
                </div>
                <span className="text-xs font-mono text-[#e5e2e1]/50">
                  hit rate <span className="text-[#ffba38] font-semibold">{hitRate}%</span>
                </span>
              </div>
            )
          })()}

          {buckets.length > 0 ? (
            <>
              {/* Bars */}
              <div className="flex-1 min-h-[280px] relative flex items-end gap-1 pb-6 border-b border-[#4f453f]/15">
                {/* Y-axis */}
                <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[10px] text-[#e5e2e1]/40 font-mono pb-6 pr-2 w-10">
                  <span>{maxVolume}</span>
                  <span>{Math.round(maxVolume * 0.5)}</span>
                  <span>0</span>
                </div>
                {/* Grid lines */}
                <div className="absolute left-10 right-0 top-0 h-full flex flex-col justify-between pb-6 pointer-events-none">
                  <div className="w-full border-t border-[#4f453f]/10" />
                  <div className="w-full border-t border-[#4f453f]/10" />
                  <div className="w-full" />
                </div>
                {/* Bar columns */}
                <div className="flex-1 flex items-end gap-1 h-full ml-10">
                {buckets.map((bucket: UsageChartResponse['buckets'][number], i: number) => {
                    const heightPct = maxVolume > 0 ? (bucket.requests / maxVolume) * 100 : 0
                    const cachePct  = bucket.requests > 0 ? (bucket.cacheHits / bucket.requests) * 100 : 0
                    return (
                      <div key={i} className="flex-1 relative group flex items-end" style={{ height: `${Math.max(heightPct, bucket.requests > 0 ? 2 : 0)}%` }}>
                        <div className="w-full h-full bg-[#353534] rounded-t-sm hover:bg-[#393939] transition-colors relative">
                          <div className="absolute bottom-0 w-full bg-[#ffba38]/60 rounded-t-sm" style={{ height: `${cachePct}%` }} />
                        </div>
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#131313] px-2 py-1.5 rounded text-[10px] whitespace-nowrap shadow-xl border border-[#4f453f]/20 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
                          <div className="text-[#e5e2e1] font-medium">{bucket.label}</div>
                          <div className="text-[#e5e2e1]/70">Req: {bucket.requests}</div>
                          <div className="text-[#ffba38]">Cache: {bucket.cacheHits}</div>
                          <div className="text-[#e5e2e1]/50">${bucket.costUsd.toFixed(3)}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              {/* X-axis labels — show every Nth label so they don't overlap */}
              <div className="flex justify-between ml-10 pt-2">
                {buckets.map((bucket: UsageChartResponse['buckets'][number], i: number) => {
                  const step = buckets.length <= 12 ? 1 : buckets.length <= 15 ? 2 : 5
                  const show = i === 0 || i === buckets.length - 1 || i % step === 0
                  return (
                    <span key={i} className="flex-1 text-center text-[10px] text-[#e5e2e1]/40 font-mono truncate">
                      {show ? bucket.label : ''}
                    </span>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="flex-1 min-h-[280px] flex items-center justify-center">
              <div className="text-center">
                <Activity className="w-12 h-12 text-[#e5e2e1]/20 mx-auto mb-3" />
                <p className="text-[#e5e2e1]/40 text-sm">
                  {providerFilter !== 'all'
                    ? `No data for ${providerName} in this period`
                    : 'No request data for this period'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Cost by Provider */}
        <div className="bg-[#1c1b1b] rounded-lg p-6 flex flex-col">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[#e5e2e1] tracking-[-0.01em]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Cost by Provider</h2>
            <p className="text-xs text-[#e5e2e1]/40 mt-1" style={{ fontFamily: 'Manrope, sans-serif' }}>{periodLabel}</p>
          </div>
          <div className="flex-1 flex flex-col justify-center gap-5">
            {providerCosts.length > 0 ? (
              providerCosts.map((item, i) => (
                <div key={item.provider} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-[#e5e2e1] capitalize">{item.provider}</span>
                    <span className="font-mono text-[#e5e2e1]/60">${item.cost.toFixed(2)}</span>
                  </div>
                  <div className="h-2 w-full bg-[#0e0e0e] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${i === 0 ? 'bg-[#ffba38]/80' : i === 1 ? 'bg-[#e2bfb0]/60' : i === 2 ? 'bg-[#cca72f]/70' : 'bg-[#5a4136]'}`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-[#e5e2e1]/30 font-mono">{item.percentage}%</span>
                </div>
              ))
            ) : (
              <div className="text-center">
                <DollarSign className="w-12 h-12 text-[#e5e2e1]/20 mx-auto mb-3" />
                <p className="text-[#e5e2e1]/40 text-sm">
                  {providerFilter !== 'all'
                    ? `No cost data for ${providerName}`
                    : 'No provider cost data for this period'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Requests */}
      <div className="bg-[#1c1b1b] rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#e5e2e1] tracking-[-0.01em]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Recent Requests</h2>
            <p className="text-xs text-[#e5e2e1]/40 mt-1" style={{ fontFamily: 'Manrope, sans-serif' }}>{periodLabel}{providerFilter !== 'all' ? ` · ${providerName}` : ''}</p>
          </div>
          <a href="/usage" className="text-sm font-medium text-[#ffba38] hover:text-[#c78b00] transition-colors flex items-center gap-1 self-start sm:self-auto">
            View All Logs <ArrowRight className="w-4 h-4" />
          </a>
        </div>
        <div className="w-full overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[#e5e2e1]/60 text-xs uppercase tracking-[0.2em] border-b border-[#4f453f]/15">
                <th className="pb-3 px-4 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Status</th>
                <th className="pb-3 px-4 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Provider & Model</th>
                <th className="pb-3 px-4 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Latency</th>
                <th className="pb-3 px-4 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Cost</th>
                <th className="pb-3 px-4 font-medium text-right" style={{ fontFamily: 'Inter, sans-serif' }}>Timestamp</th>
              </tr>
            </thead>
            <tbody className="text-sm font-mono text-[#e5e2e1]">
              {recentRequests.length > 0 ? recentRequests.map((req, i) => (
                <tr key={i} className="border-b border-[#4f453f]/10 hover:bg-[#353534]/50 transition-colors">
                  <td className="py-4 px-4">
                    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-xs font-sans font-medium ${req.statusType === 'success' ? 'bg-[#5a4136]/30 text-[#e2bfb0]' : 'bg-[#93000a]/30 text-[#ffb4ab]'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${req.statusType === 'success' ? 'bg-emerald-400' : 'bg-[#ffb4ab]'}`} />
                      {req.status}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-sans font-medium text-[#e5e2e1] capitalize">{req.provider}</span>
                      <span className="text-xs text-[#e5e2e1]/60">{req.model}</span>
                    </div>
                  </td>
                  <td className={`py-4 px-4 ${req.cached ? 'text-[#ffba38]' : 'text-[#e5e2e1]/60'}`}>{req.latency}</td>
                  <td className="py-4 px-4 text-[#e5e2e1]/60">${req.cost}</td>
                  <td className="py-4 px-4 text-right text-[#e5e2e1]/70">{req.timestamp}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="py-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-[#e5e2e1]/40 text-sm">
                      <Activity className="w-8 h-8 text-[#e5e2e1]/20" />
                      {providerFilter !== 'all' ? `No recent requests for ${providerName}` : 'No recent requests'}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  )
}
