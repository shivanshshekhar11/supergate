/**
 * Usage Chart Route
 *
 * GET /v1/usage/chart
 *
 * Returns pre-bucketed chart data for the dashboard:
 *   - 24h  â†’ 12 buckets of 2 hours each
 *   - 7d   â†’ 7 buckets of 1 day each
 *   - 30d  â†’ 30 buckets of 1 day each
 *
 * Accepts an optional `provider` query param to filter by provider.
 * All queries are scoped to the authenticated tenant.
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '../db/client'
import { requireRole } from '../middleware/auth'
import { usageLogs } from '../db/schema'
import { sql, and, gte, eq, SQL } from 'drizzle-orm'
import { UsageChartResponseSchema, type UsageChartResponse } from '@llm-gateway/schemas'

const ChartQuerySchema = z.object({
  timeRange: z.enum(['24h', '7d', '30d']).default('7d'),
  provider: z.string().optional(),
})

export async function usageChartRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: z.infer<typeof ChartQuerySchema>
    Reply: UsageChartResponse
  }>(
    '/v1/usage/chart',
    {
      preHandler: requireRole('admin', 'member', 'viewer', 'guest'),
      schema: {
        tags: ['Usage'],
        summary: 'Get chart data',
        description: 'Returns pre-bucketed request volume and cache hit data for the dashboard chart',
        security: [{ BearerAuth: [] }],
        querystring: ChartQuerySchema,
      },
    },
    async (request, reply) => {
      const tenantId = request.tenantContext!.tenantId
      const { timeRange, provider } = ChartQuerySchema.parse(request.query)

      const now = new Date()

      // Build base WHERE conditions
      const conditions: SQL[] = [eq(usageLogs.tenantId, tenantId)]
      if (provider && provider !== 'all') {
        conditions.push(eq(usageLogs.provider, provider))
      }

      if (timeRange === '24h') {
        // 12 buckets Ã— 2 hours â€” group by floor(hour/2)*2
        const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        conditions.push(gte(usageLogs.createdAt, startDate))

        const rows = await db
          .select({
            bucketHour: sql<number>`FLOOR(EXTRACT(HOUR FROM ${usageLogs.createdAt}) / 2) * 2`,
            bucketDate: sql<string>`DATE(${usageLogs.createdAt})`,
            requests:   sql<number>`COUNT(*)`,
            cacheHits:  sql<number>`COALESCE(SUM(CASE WHEN ${usageLogs.cached} THEN 1 ELSE 0 END), 0)`,
            costUsd:    sql<number>`COALESCE(SUM(CAST(${usageLogs.costUsd} AS NUMERIC)), 0)`,
            avgLatencyMs: sql<number>`COALESCE(AVG(${usageLogs.latencyMs}), 0)`,
          })
          .from(usageLogs)
          .where(and(...conditions))
          .groupBy(
            sql`DATE(${usageLogs.createdAt})`,
            sql`FLOOR(EXTRACT(HOUR FROM ${usageLogs.createdAt}) / 2) * 2`,
          )
          .orderBy(
            sql`DATE(${usageLogs.createdAt})`,
            sql`FLOOR(EXTRACT(HOUR FROM ${usageLogs.createdAt}) / 2) * 2`,
          )

        // Build a full 12-slot map keyed by "YYYY-MM-DD:HH" so we can fill gaps
        const slotMap = new Map<string, { requests: number; cacheHits: number; costUsd: number; avgLatencyMs: number }>()
        for (const row of rows) {
          const key = `${row.bucketDate}:${String(row.bucketHour).padStart(2, '0')}`
          slotMap.set(key, {
            requests:     Number(row.requests),
            cacheHits:    Number(row.cacheHits),
            costUsd:      Number(row.costUsd),
            avgLatencyMs: Math.round(Number(row.avgLatencyMs)),
          })
        }

        // Generate all 12 two-hour slots from 24h ago to now
        const buckets = []
        for (let i = 11; i >= 0; i--) {
          const slotStart = new Date(now.getTime() - (i + 1) * 2 * 60 * 60 * 1000)
          const slotHour  = Math.floor(slotStart.getHours() / 2) * 2
          const dateStr   = slotStart.toISOString().slice(0, 10)
          const key       = `${dateStr}:${String(slotHour).padStart(2, '0')}`
          const data      = slotMap.get(key) ?? { requests: 0, cacheHits: 0, costUsd: 0, avgLatencyMs: 0 }
          const label     = `${String(slotHour).padStart(2, '0')}:00`
          buckets.push({ label, ...data })
        }

        return reply.send({
          timeRange,
          provider: provider ?? null,
          buckets,
        })
      }

      // 7d or 30d â€” one bucket per calendar day
      const days = timeRange === '7d' ? 7 : 30
      const startDate = new Date(now)
      startDate.setDate(now.getDate() - days)
      startDate.setHours(0, 0, 0, 0)
      conditions.push(gte(usageLogs.createdAt, startDate))

      const rows = await db
        .select({
          date:         sql<string>`DATE(${usageLogs.createdAt})`,
          requests:     sql<number>`COUNT(*)`,
          cacheHits:    sql<number>`COALESCE(SUM(CASE WHEN ${usageLogs.cached} THEN 1 ELSE 0 END), 0)`,
          costUsd:      sql<number>`COALESCE(SUM(CAST(${usageLogs.costUsd} AS NUMERIC)), 0)`,
          avgLatencyMs: sql<number>`COALESCE(AVG(${usageLogs.latencyMs}), 0)`,
        })
        .from(usageLogs)
        .where(and(...conditions))
        .groupBy(sql`DATE(${usageLogs.createdAt})`)
        .orderBy(sql`DATE(${usageLogs.createdAt})`)

      // Index by date string
      const rowMap = new Map(rows.map(r => [r.date, r]))

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const dayNames   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

      const buckets = []
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(now.getDate() - i)
        d.setHours(0, 0, 0, 0)
        const dateStr = d.toISOString().slice(0, 10)
        const row     = rowMap.get(dateStr)

        const label = timeRange === '7d'
          ? dayNames[d.getDay()]
          : `${monthNames[d.getMonth()]} ${d.getDate()}`

        buckets.push({
          label,
          requests:     row ? Number(row.requests)     : 0,
          cacheHits:    row ? Number(row.cacheHits)    : 0,
          costUsd:      row ? Number(row.costUsd)      : 0,
          avgLatencyMs: row ? Math.round(Number(row.avgLatencyMs)) : 0,
        })
      }

      return reply.send({
        timeRange,
        provider: provider ?? null,
        buckets,
      })
    }
  )
}


