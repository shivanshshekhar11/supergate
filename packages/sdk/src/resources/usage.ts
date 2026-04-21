/**
 * Supergate SDK — Usage resource
 *
 * Query cost, token, and request data for your tenant.
 *
 * @example
 * const summary   = await client.usage.getSummary({ period: 'weekly' })
 * console.log(`$${summary.totalCostUsd.toFixed(4)} spent this week`)
 *
 * const breakdown = await client.usage.getBreakdown({ period: 'weekly' })
 * breakdown.forEach(b => console.log(`${b.model}: $${b.costUsd.toFixed(4)}`))
 *
 * const logs = await client.usage.getLogs({ timeRange: '7d', provider: 'openai' })
 */

import type { HttpClient } from '../http'
import type {
  UsageSummary,
  UsageBreakdown,
  UsageChartResponse,
  GetSummaryOptions,
  GetBreakdownOptions,
  GetChartOptions,
  GetLogsOptions,
  UsageLogEntry,
  PaginatedResponse,
} from '../types'

export class UsageResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Get aggregated usage totals for a time period.
   * Includes total cost, requests, tokens, cache hit rate, and daily breakdown.
   */
  getSummary(options: GetSummaryOptions = {}): Promise<UsageSummary> {
    const params = new URLSearchParams()
    if (options.period) params.set('period', options.period)
    const qs = params.toString()
    return this.http.get(`/v1/usage${qs ? `?${qs}` : ''}`)
  }

  /**
   * Get usage broken down by model and provider.
   * Useful for understanding which models are driving cost.
   */
  getBreakdown(options: GetBreakdownOptions = {}): Promise<UsageBreakdown> {
    const params = new URLSearchParams()
    if (options.period)   params.set('period',   options.period)
    if (options.provider && options.provider !== 'all') params.set('provider', options.provider)
    const qs = params.toString()
    return this.http.get(`/v1/usage/breakdown${qs ? `?${qs}` : ''}`)
  }

  /**
   * Get pre-bucketed chart data for visualizing request volume and cache hits.
   * - 24h → 12 buckets of 2 hours each
   * - 7d  → 7 daily buckets
   * - 30d → 30 daily buckets
   */
  getChart(options: GetChartOptions = {}): Promise<UsageChartResponse> {
    const params = new URLSearchParams()
    if (options.timeRange) params.set('timeRange', options.timeRange)
    if (options.provider && options.provider !== 'all') params.set('provider', options.provider)
    const qs = params.toString()
    return this.http.get(`/v1/usage/chart${qs ? `?${qs}` : ''}`)
  }

  /**
   * Get paginated usage logs with optional filters.
   */
  getLogs(options: GetLogsOptions = {}): Promise<PaginatedResponse<UsageLogEntry>> {
    const params = new URLSearchParams()
    if (options.page)                                    params.set('page',      String(options.page))
    if (options.pageSize)                                params.set('pageSize',  String(options.pageSize))
    if (options.provider && options.provider !== 'all')  params.set('provider',  options.provider)
    if (options.model    && options.model    !== 'all')  params.set('model',     options.model)
    if (options.status)                                  params.set('status',    String(options.status))
    if (options.timeRange)                               params.set('timeRange', options.timeRange)
    const qs = params.toString()
    return this.http.get(`/v1/usage/logs${qs ? `?${qs}` : ''}`)
  }
}
