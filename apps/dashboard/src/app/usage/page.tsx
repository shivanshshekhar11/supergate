'use client'

import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/contexts/auth-context'
import { usageAPI, type UsageLogsResponse } from '@/lib/gateway-client'
import { useState, useEffect } from 'react'
import { RefreshCw, Download, ChevronLeft, ChevronRight, Filter, AlertCircle } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default function UsagePage() {
  const { token } = useAuth()
  const [data, setData] = useState<UsageLogsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState({
    provider: 'all',
    model: 'all',
    status: 'any',
    timeRange: '24h' as '24h' | '7d' | '30d',
  })

  // Provider-specific models
  const modelsByProvider: Record<string, string[]> = {
    openai: ['gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4', 'gpt-4-32k'],
    anthropic: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-2.1'],
    cohere: ['command-r', 'command-r-plus', 'command', 'command-light'],
  }

  // Get available models based on selected provider
  const availableModels = filters.provider === 'all' 
    ? [] 
    : modelsByProvider[filters.provider] || []

  // Reset model filter when provider changes
  const handleProviderChange = (provider: string) => {
    setFilters({ ...filters, provider, model: 'all' })
    setCurrentPage(1)
  }

  // Fetch usage logs
  useEffect(() => {
    async function fetchLogs() {
      if (!token) {
        setError('Not authenticated')
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setError(null)

        const response = await usageAPI.getLogs(token, {
          page: currentPage,
          pageSize: 10,
          provider: filters.provider,
          model: filters.model,
          status: filters.status === 'any' ? undefined : parseInt(filters.status),
          timeRange: filters.timeRange,
        })

        setData(response)
      } catch (err) {
        console.error('Failed to fetch usage logs:', err)
        setError(err instanceof Error ? err.message : 'Failed to load usage logs')
      } finally {
        setIsLoading(false)
      }
    }

    fetchLogs()
  }, [token, currentPage, filters])

  const handleExportCSV = () => {
    if (!data || data.logs.length === 0) return
    
    // Create CSV content
    const headers = ['Status', 'Provider', 'Model', 'Request ID', 'Latency (ms)', 'Input Tokens', 'Output Tokens', 'Cost (USD)', 'Cached', 'Timestamp']
    const rows = data.logs.map(log => [
      log.statusCode,
      log.provider,
      log.model,
      log.requestId || 'N/A',
      log.cached ? 'CACHE HIT' : (log.latencyMs ? log.latencyMs : 'N/A'),
      log.inputTokens,
      log.outputTokens,
      log.costUsd.toFixed(4),
      log.cached ? 'Yes' : 'No',
      new Date(log.createdAt).toISOString(),
    ])
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `usage-logs-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleRefresh = () => {
    setCurrentPage(1)
    // Trigger re-fetch by updating a dependency
    setFilters({ ...filters })
  }

  // Loading state
  if (isLoading && !data) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-[#e5e2e1]/60" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Loading usage logs...
            </p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  // Error state
  if (error) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center max-w-md">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#93000a]/20 mb-4">
              <AlertCircle className="w-8 h-8 text-[#ffb4ab]" />
            </div>
            <h2 
              className="text-2xl font-bold text-[#e5e2e1] mb-2"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Failed to Load Logs
            </h2>
            <p className="text-[#e5e2e1]/60 mb-6" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {error}
            </p>
            <button
              onClick={handleRefresh}
              className="bg-gradient-to-br from-[#ffba38] to-[#c78b00] text-[#281900] px-6 py-2 rounded-md font-medium hover:shadow-[0_0_20px_rgba(255,186,56,0.3)] transition-all"
            >
              Retry
            </button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-2">
          <div>
            <h1
              className="text-4xl sm:text-5xl font-bold text-[#e5e2e1] tracking-[-0.02em] leading-none mb-2"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Usage Logs
            </h1>
            <p
              className="text-[#e5e2e1]/70 text-base sm:text-lg tracking-[0.01em]"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >
              Comprehensive telemetry and routing history
            </p>
          </div>
          <div className="flex gap-2 sm:gap-3 flex-wrap">
            <button
              onClick={handleRefresh}
              className="bg-[#1c1b1b] border border-[#4f453f]/15 text-[#e5e2e1] text-sm font-medium py-2 px-3 sm:px-4 rounded-md hover:bg-[#353534] transition-colors flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="bg-[#1c1b1b] border border-[#4f453f]/15 text-[#e5e2e1] text-sm font-medium py-2 px-3 sm:px-4 rounded-md hover:bg-[#353534] transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#1c1b1b] rounded-lg p-4 mb-6 border-l-2 border-[#ffba38]">
        <div className="flex items-center gap-2 text-[#e5e2e1]/60 text-sm font-medium uppercase tracking-wider mb-3">
          <Filter className="w-4 h-4" />
          FILTERS
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <select
            value={filters.provider}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="bg-[#353534] text-[#e5e2e1] text-sm px-3 py-2 rounded-md border border-[#4f453f]/15 focus:outline-none focus:border-[#ffba38] transition-colors"
          >
            <option value="all">All Providers</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="cohere">Cohere</option>
          </select>
          <select
            value={filters.model}
            onChange={(e) => setFilters({ ...filters, model: e.target.value })}
            disabled={filters.provider === 'all'}
            className="bg-[#353534] text-[#e5e2e1] text-sm px-3 py-2 rounded-md border border-[#4f453f]/15 focus:outline-none focus:border-[#ffba38] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="all">All Models</option>
            {availableModels.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="bg-[#353534] text-[#e5e2e1] text-sm px-3 py-2 rounded-md border border-[#4f453f]/15 focus:outline-none focus:border-[#ffba38] transition-colors"
          >
            <option value="any">Status: Any</option>
            <option value="200">200 OK</option>
            <option value="429">429 Rate Limit</option>
            <option value="500">500 Error</option>
          </select>
          <select
            value={filters.timeRange}
            onChange={(e) => setFilters({ ...filters, timeRange: e.target.value as '24h' | '7d' | '30d' })}
            className="bg-[#353534] text-[#e5e2e1] text-sm px-3 py-2 rounded-md border border-[#4f453f]/15 focus:outline-none focus:border-[#ffba38] transition-colors"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <button
            onClick={() => setFilters({ provider: 'all', model: 'all', status: 'any', timeRange: '24h' })}
            className="text-[#ffba38] text-sm font-medium hover:text-[#c78b00] transition-colors"
          >
            CLEAR
          </button>
        </div>
      </div>

      {/* Empty State */}
      {data && data.logs.length === 0 && (
        <div className="bg-[#1c1b1b] rounded-lg p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#ffba38]/10 mb-4">
            <Filter className="w-8 h-8 text-[#ffba38]" />
          </div>
          <h3
            className="text-xl font-bold text-[#e5e2e1] mb-2"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            No Logs Found
          </h3>
          <p className="text-[#e5e2e1]/60 mb-6" style={{ fontFamily: 'Manrope, sans-serif' }}>
            No usage logs match your current filters. Try adjusting your search criteria.
          </p>
          <button
            onClick={() => setFilters({ provider: 'all', model: 'all', status: 'any', timeRange: '24h' })}
            className="bg-gradient-to-br from-[#ffba38] to-[#c78b00] text-[#281900] px-6 py-2 rounded-md font-medium hover:shadow-[0_0_20px_rgba(255,186,56,0.3)] transition-all"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Table */}
      {data && data.logs.length > 0 && (
        <div className="bg-[#1c1b1b] rounded-lg overflow-hidden">
          {/* Scrollable table — contained, no page bleed */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-[#4f453f]/15">
                  <th className="text-left py-3 px-4 text-[#e5e2e1]/60 text-xs uppercase tracking-[0.2em] font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Status</th>
                  <th className="text-left py-3 px-4 text-[#e5e2e1]/60 text-xs uppercase tracking-[0.2em] font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Provider & Model</th>
                  <th className="text-left py-3 px-4 text-[#e5e2e1]/60 text-xs uppercase tracking-[0.2em] font-medium hidden lg:table-cell" style={{ fontFamily: 'Inter, sans-serif' }}>Request ID</th>
                  <th className="text-left py-3 px-4 text-[#e5e2e1]/60 text-xs uppercase tracking-[0.2em] font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Latency</th>
                  <th className="text-left py-3 px-4 text-[#e5e2e1]/60 text-xs uppercase tracking-[0.2em] font-medium hidden md:table-cell" style={{ fontFamily: 'Inter, sans-serif' }}>Tokens</th>
                  <th className="text-left py-3 px-4 text-[#e5e2e1]/60 text-xs uppercase tracking-[0.2em] font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Cost</th>
                  <th className="text-right py-3 px-4 text-[#e5e2e1]/60 text-xs uppercase tracking-[0.2em] font-medium hidden md:table-cell" style={{ fontFamily: 'Inter, sans-serif' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {data.logs.map((log) => (
                  <tr key={log.id} className="border-b border-[#4f453f]/10 hover:bg-[#353534]/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded-sm text-xs font-medium ${log.statusCode === 200 ? 'bg-[#5a4136]/30 text-[#e2bfb0]' : 'bg-[#93000a]/30 text-[#ffb4ab]'}`}>
                        {log.statusCode}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#ffba38] shrink-0" />
                        <div>
                          <div className="text-[#e5e2e1] font-medium text-sm leading-tight">{log.model}</div>
                          <div className="text-[#e5e2e1]/50 text-xs capitalize">{log.provider}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 hidden lg:table-cell">
                      <span className="text-[#e5e2e1]/50 text-xs font-mono truncate max-w-[120px] block">{log.requestId ? log.requestId.slice(0, 16) + '…' : 'N/A'}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`text-sm font-mono ${log.cached ? 'text-[#ffba38]' : 'text-[#e5e2e1]/70'}`}>
                        {log.cached ? 'CACHE' : log.latencyMs ? `${log.latencyMs}ms` : '—'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 hidden md:table-cell">
                      <span className="text-[#e5e2e1]/70 text-sm font-mono">
                        {log.inputTokens}<span className="text-[#ffba38]/60 mx-0.5">/</span>{log.outputTokens}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[#e5e2e1]/70 text-sm font-mono">${log.costUsd.toFixed(4)}</span>
                    </td>
                    <td className="py-3.5 px-4 text-right hidden md:table-cell">
                      <span className="text-[#e5e2e1]/50 text-xs">
                        {new Date(log.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination — stacks on mobile */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-[#4f453f]/15">
            <p className="text-[#e5e2e1]/50 text-xs" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} of {data.total} logs
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-md bg-[#353534] text-[#e5e2e1] hover:bg-[#393939] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: Math.min(5, data.totalPages) }, (_, i) => {
                let pageNum: number
                if (data.totalPages <= 5)              pageNum = i + 1
                else if (currentPage <= 3)             pageNum = i + 1
                else if (currentPage >= data.totalPages - 2) pageNum = data.totalPages - 4 + i
                else                                   pageNum = currentPage - 2 + i
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${
                      currentPage === pageNum
                        ? 'bg-[#ffba38] text-[#281900]'
                        : 'bg-[#353534] text-[#e5e2e1] hover:bg-[#393939]'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}

              {data.totalPages > 5 && currentPage < data.totalPages - 2 && (
                <>
                  <span className="text-[#e5e2e1]/40 text-sm px-1">…</span>
                  <button
                    onClick={() => setCurrentPage(data.totalPages)}
                    className="w-8 h-8 rounded-md text-sm font-medium bg-[#353534] text-[#e5e2e1] hover:bg-[#393939] transition-colors"
                  >
                    {data.totalPages}
                  </button>
                </>
              )}

              <button
                onClick={() => setCurrentPage(Math.min(data.totalPages, currentPage + 1))}
                disabled={currentPage === data.totalPages}
                className="p-1.5 rounded-md bg-[#353534] text-[#e5e2e1] hover:bg-[#393939] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
