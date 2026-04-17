'use client'

import { DashboardLayout } from '@/components/dashboard-layout'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Gauge,
  Database,
  Activity,
  ArrowRight,
  MoreVertical,
} from 'lucide-react'

export default function DashboardPage() {
  // Mock data - will be replaced with real API calls
  const metrics = {
    totalCost: 1240.50,
    avgLatency: 245,
    cacheHitRate: 42,
    tokensProcessed: 14.2,
  }

  const trends = {
    cost: { value: 12, direction: 'down' as const },
    latency: { value: 4, direction: 'up' as const },
    cacheHitRate: { value: 8, direction: 'up' as const },
    tokens: { value: 0, direction: 'flat' as const },
  }

  const providerCosts = [
    { provider: 'OpenAI', cost: 850.20, percentage: 68 },
    { provider: 'Anthropic', cost: 310.00, percentage: 25 },
    { provider: 'Cohere', cost: 80.30, percentage: 7 },
  ]

  const recentRequests = [
    {
      status: '200 OK',
      statusType: 'success' as const,
      provider: 'OpenAI',
      model: 'gpt-4-turbo',
      latency: '452ms',
      cost: '$0.034',
      timestamp: '10:42:01 AM',
    },
    {
      status: '200 OK',
      statusType: 'success' as const,
      provider: 'Anthropic',
      model: 'claude-3-opus',
      latency: '890ms',
      cost: '$0.075',
      timestamp: '10:41:45 AM',
    },
    {
      status: '200 OK',
      statusType: 'success' as const,
      provider: 'OpenAI',
      model: 'gpt-3.5-turbo',
      latency: 'CACHE HIT',
      cost: '$0.000',
      timestamp: '10:40:12 AM',
      cached: true,
    },
    {
      status: '429 Rate Limit',
      statusType: 'error' as const,
      provider: 'OpenAI',
      model: 'gpt-4',
      latency: '120ms',
      cost: '$0.000',
      timestamp: '10:38:55 AM',
    },
  ]

  // Mock chart data (7 days)
  const chartData = [
    { day: 'Mon', volume: 40, cache: 30 },
    { day: 'Tue', volume: 60, cache: 45 },
    { day: 'Wed', volume: 45, cache: 25 },
    { day: 'Thu', volume: 80, cache: 50 },
    { day: 'Fri', volume: 55, cache: 40 },
    { day: 'Sat', volume: 70, cache: 40 },
    { day: 'Sun', volume: 90, cache: 60 },
  ]

  const TrendIcon = ({ direction }: { direction: 'up' | 'down' | 'flat' }) => {
    if (direction === 'up') return <TrendingUp className="w-3 h-3" />
    if (direction === 'down') return <TrendingDown className="w-3 h-3" />
    return <Minus className="w-3 h-3" />
  }

  const getTrendColor = (direction: 'up' | 'down' | 'flat', isGood: boolean) => {
    if (direction === 'flat') return 'text-[#e5e2e1]/60'
    if ((direction === 'up' && isGood) || (direction === 'down' && !isGood)) {
      return 'text-emerald-400'
    }
    return 'text-[#ffb4ab]'
  }

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1
            className="text-5xl font-bold text-[#e5e2e1] tracking-[-0.02em] leading-none mb-2"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Dashboard
          </h1>
          <p
            className="text-[#e5e2e1]/70 text-lg tracking-[0.01em]"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            Overview of LLM Gateway performance and consumption.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="bg-[#1c1b1b] border border-[#4f453f]/15 text-[#e5e2e1] text-sm font-medium py-2 px-4 rounded-md hover:bg-[#353534] transition-colors flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Last 7 Days
          </button>
          <button className="bg-[#1c1b1b] border border-[#4f453f]/15 text-[#e5e2e1] text-sm font-medium py-2 px-4 rounded-md hover:bg-[#353534] transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filter
          </button>
        </div>
      </div>

      {/* Bento Grid: Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Metric 1: Total Cost */}
        <div className="bg-[#353534] p-6 rounded-lg relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-[#ffba38]/5 rounded-full blur-2xl group-hover:bg-[#ffba38]/10 transition-all duration-500"></div>
          <div className="flex justify-between items-start mb-4">
            <span
              className="text-[#e5e2e1]/60 text-xs uppercase tracking-[0.2em] font-medium"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Total Cost
            </span>
            <DollarSign className="w-5 h-5 text-[#ffba38]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className="text-5xl font-bold text-[#e5e2e1] tracking-tighter"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              ${metrics.totalCost.toFixed(2)}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-sm">
            <span className={`flex items-center ${getTrendColor(trends.cost.direction, false)}`}>
              <TrendIcon direction={trends.cost.direction} /> {trends.cost.value}%
            </span>
            <span className="text-[#e5e2e1]/60 ml-1">vs last week</span>
          </div>
        </div>

        {/* Metric 2: Avg Latency */}
        <div className="bg-[#1c1b1b] p-6 rounded-lg relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-[#e2bfb0]/5 rounded-full blur-2xl group-hover:bg-[#e2bfb0]/10 transition-all duration-500"></div>
          <div className="flex justify-between items-start mb-4">
            <span
              className="text-[#e5e2e1]/60 text-xs uppercase tracking-[0.2em] font-medium"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Avg. Latency
            </span>
            <Gauge className="w-5 h-5 text-[#e2bfb0]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className="text-5xl font-bold text-[#e5e2e1] tracking-tighter"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              {metrics.avgLatency}
            </span>
            <span className="text-[#e5e2e1]/60 font-medium">ms</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-sm">
            <span className={`flex items-center ${getTrendColor(trends.latency.direction, false)}`}>
              <TrendIcon direction={trends.latency.direction} /> {trends.latency.value}%
            </span>
            <span className="text-[#e5e2e1]/60 ml-1">vs last week</span>
          </div>
        </div>

        {/* Metric 3: Cache Hit Rate */}
        <div className="bg-[#1c1b1b] p-6 rounded-lg relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-[#e9c349]/5 rounded-full blur-2xl group-hover:bg-[#e9c349]/10 transition-all duration-500"></div>
          <div className="flex justify-between items-start mb-4">
            <span
              className="text-[#e5e2e1]/60 text-xs uppercase tracking-[0.2em] font-medium"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Cache Hit Rate
            </span>
            <Database className="w-5 h-5 text-[#e9c349]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className="text-5xl font-bold text-[#e5e2e1] tracking-tighter"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              {metrics.cacheHitRate}
            </span>
            <span className="text-[#e5e2e1]/60 font-medium">%</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-sm">
            <span className={`flex items-center ${getTrendColor(trends.cacheHitRate.direction, true)}`}>
              <TrendIcon direction={trends.cacheHitRate.direction} /> {trends.cacheHitRate.value}%
            </span>
            <span className="text-[#e5e2e1]/60 ml-1">vs last week</span>
          </div>
        </div>

        {/* Metric 4: Tokens Processed */}
        <div className="bg-[#1c1b1b] p-6 rounded-lg relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-[#e5e2e1]/5 rounded-full blur-2xl group-hover:bg-[#e5e2e1]/10 transition-all duration-500"></div>
          <div className="flex justify-between items-start mb-4">
            <span
              className="text-[#e5e2e1]/60 text-xs uppercase tracking-[0.2em] font-medium"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Tokens Processed
            </span>
            <Activity className="w-5 h-5 text-[#e5e2e1]/60" />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className="text-5xl font-bold text-[#e5e2e1] tracking-tighter"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              {metrics.tokensProcessed}
            </span>
            <span className="text-[#e5e2e1]/60 font-medium">M</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-sm">
            <span className={`flex items-center ${getTrendColor(trends.tokens.direction, true)}`}>
              <TrendIcon direction={trends.tokens.direction} /> {trends.tokens.value}%
            </span>
            <span className="text-[#e5e2e1]/60 ml-1">vs last week</span>
          </div>
        </div>
      </div>

      {/* Charts Section (Asymmetrical Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Main Area Chart */}
        <div className="lg:col-span-2 bg-[#0e0e0e] rounded-lg p-6 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-[#0e0e0e] via-[#ffba38]/20 to-[#0e0e0e]"></div>
          <div className="flex justify-between items-center mb-6">
            <h2
              className="text-2xl font-bold text-[#e5e2e1] tracking-[-0.01em]"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Request Volume vs. Cache Hits
            </h2>
            <button className="text-[#e5e2e1]/60 hover:text-[#e5e2e1] transition-colors">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>

          {/* Chart Area */}
          <div className="flex-1 min-h-[300px] relative w-full flex items-end justify-between gap-2 pb-6 border-b border-[#4f453f]/15">
            {/* Y-Axis Labels */}
            <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-[#e5e2e1]/50 font-mono pb-6">
              <span>100k</span>
              <span>75k</span>
              <span>50k</span>
              <span>25k</span>
              <span>0</span>
            </div>

            {/* Grid Lines */}
            <div className="absolute left-10 right-0 top-0 h-full flex flex-col justify-between pb-6 z-0">
              <div className="w-full border-t border-[#4f453f]/10"></div>
              <div className="w-full border-t border-[#4f453f]/10"></div>
              <div className="w-full border-t border-[#4f453f]/10"></div>
              <div className="w-full border-t border-[#4f453f]/10"></div>
              <div className="w-full"></div>
            </div>

            {/* Data Columns */}
            <div className="flex-1 flex items-end justify-between gap-2 h-full ml-10">
              {chartData.map((data, i) => (
                <div
                  key={i}
                  className="flex-1 relative z-10 rounded-t-sm group transition-all flex items-end"
                  style={{ height: `${data.volume}%` }}
                >
                  <div className="w-full bg-[#353534] rounded-t-sm relative h-full hover:bg-[#393939] transition-colors">
                    <div
                      className="absolute bottom-0 w-full bg-[#ffba38]/60 rounded-t-sm"
                      style={{ height: `${(data.cache / data.volume) * 100}%` }}
                    ></div>
                  </div>
                  {/* Tooltip */}
                  <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-[#131313] px-3 py-2 rounded text-xs whitespace-nowrap shadow-xl border border-[#4f453f]/20 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
                    <div className="text-[#e5e2e1] font-medium mb-1">
                      {chartData[i].day}
                    </div>
                    <div className="text-[#e5e2e1]/70">
                      Vol: {data.volume}k
                    </div>
                    <div className="text-[#ffba38]">
                      Cache: {data.cache}k
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* X-Axis Labels */}
          <div className="flex justify-between px-2 pt-3 text-xs text-[#e5e2e1]/50 font-mono ml-10">
            {chartData.map((data, i) => (
              <span key={i}>{data.day}</span>
            ))}
          </div>
        </div>

        {/* Secondary Bar Chart */}
        <div className="bg-[#1c1b1b] rounded-lg p-6 flex flex-col">
          <h2
            className="text-2xl font-bold text-[#e5e2e1] mb-6 tracking-[-0.01em]"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Cost by Provider
          </h2>
          <div className="flex-1 flex flex-col justify-center gap-6">
            {providerCosts.map((item, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-[#e5e2e1]">{item.provider}</span>
                  <span className="font-mono text-[#e5e2e1]/60">${item.cost.toFixed(2)}</span>
                </div>
                <div className="h-2 w-full bg-[#0e0e0e] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      i === 0 ? 'bg-[#ffba38]/80' : i === 1 ? 'bg-[#5a4136]' : 'bg-[#cca72f]'
                    }`}
                    style={{ width: `${item.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Logs Table */}
      <div className="bg-[#1c1b1b] rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2
            className="text-2xl font-bold text-[#e5e2e1] tracking-[-0.01em]"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Recent Requests
          </h2>
          <a
            className="text-sm font-medium text-[#ffba38] hover:text-[#c78b00] transition-colors flex items-center gap-1"
            href="#"
          >
            View All Logs
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[#e5e2e1]/60 text-xs uppercase tracking-[0.2em] border-b border-[#4f453f]/15">
                <th className="pb-3 px-4 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Status
                </th>
                <th className="pb-3 px-4 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Provider & Model
                </th>
                <th className="pb-3 px-4 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Latency
                </th>
                <th className="pb-3 px-4 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Cost
                </th>
                <th className="pb-3 px-4 font-medium text-right" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Timestamp
                </th>
              </tr>
            </thead>
            <tbody className="text-sm font-mono text-[#e5e2e1]">
              {recentRequests.map((req, i) => (
                <tr
                  key={i}
                  className="border-b border-[#4f453f]/10 hover:bg-[#353534]/50 transition-colors"
                >
                  <td className="py-4 px-4">
                    <div
                      className={`inline-flex items-center gap-1.5 ${
                        req.statusType === 'success'
                          ? 'bg-[#5a4136]/30 text-[#e2bfb0]'
                          : 'bg-[#93000a]/30 text-[#ffb4ab]'
                      } px-2 py-0.5 rounded-sm text-xs font-sans font-medium`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          req.statusType === 'success' ? 'bg-emerald-400' : 'bg-[#ffb4ab]'
                        }`}
                      ></span>
                      {req.status}
                    </div>
                  </td>
                  <td className="py-4 px-4 flex flex-col gap-0.5">
                    <span className="font-sans font-medium text-[#e5e2e1]">{req.provider}</span>
                    <span className="text-xs text-[#e5e2e1]/60">{req.model}</span>
                  </td>
                  <td className={`py-4 px-4 ${req.cached ? 'text-[#ffba38]' : 'text-[#e5e2e1]/60'}`}>
                    {req.latency}
                  </td>
                  <td className="py-4 px-4 text-[#e5e2e1]/60">{req.cost}</td>
                  <td className="py-4 px-4 text-right text-[#e5e2e1]/70">{req.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  )
}
