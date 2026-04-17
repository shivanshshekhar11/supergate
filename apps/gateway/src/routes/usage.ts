/**
 * Usage Routes
 * 
 * Endpoints for querying tenant usage data:
 * - GET /v1/usage - Aggregated usage summary by period
 * - GET /v1/usage/breakdown - Usage breakdown by model and provider
 * 
 * All queries are automatically scoped to the authenticated tenant
 * via PostgreSQL Row Level Security.
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '../db/client'
import { usageLogs } from '../db/schema'
import { sql, and, gte, lte, eq, desc } from 'drizzle-orm'
import {
  UsageSummarySchema,
  UsageBreakdownSchema,
  type UsageSummary,
  type UsageBreakdown,
} from '@llm-gateway/schemas'

const UsageQuerySchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
})

export async function usageRoutes(app: FastifyInstance) {
  /**
   * GET /v1/usage
   * 
   * Returns aggregated usage summary for the authenticated tenant.
   * Includes total cost, requests, tokens, cache hit rate, and daily breakdown.
   */
  app.get<{
    Querystring: z.infer<typeof UsageQuerySchema>
  }>(
    '/v1/usage',
    {
      schema: {
        tags: ['Usage'],
        summary: 'Get usage summary',
        description: 'Returns aggregated usage data for the authenticated tenant by period (daily/weekly/monthly)',
        security: [{ BearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const period = (request.query as any).period || 'daily'
      const { tenantId } = request.tenantContext!

      // Calculate date range based on period
      const now = new Date()
      const startDate = new Date()

      switch (period) {
        case 'daily':
          startDate.setDate(now.getDate() - 7) // Last 7 days
          break
        case 'weekly':
          startDate.setDate(now.getDate() - 28) // Last 4 weeks
          break
        case 'monthly':
          startDate.setMonth(now.getMonth() - 6) // Last 6 months
          break
      }

      startDate.setHours(0, 0, 0, 0)

      // Query aggregated totals
      const totalsResult = await db
        .select({
          totalCostUsd: sql<number>`COALESCE(SUM(CAST(${usageLogs.costUsd} AS NUMERIC)), 0)`,
          totalRequests: sql<number>`COUNT(*)`,
          totalInputTokens: sql<number>`COALESCE(SUM(${usageLogs.inputTokens}), 0)`,
          totalOutputTokens: sql<number>`COALESCE(SUM(${usageLogs.outputTokens}), 0)`,
          cacheHits: sql<number>`COALESCE(SUM(CASE WHEN ${usageLogs.cached} THEN 1 ELSE 0 END), 0)`,
          avgLatencyMs: sql<number>`COALESCE(AVG(${usageLogs.latencyMs}), 0)`,
        })
        .from(usageLogs)
        .where(
          and(
            eq(usageLogs.tenantId, tenantId),
            gte(usageLogs.createdAt, startDate)
          )
        )

      const totals = totalsResult[0] || {
        totalCostUsd: 0,
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        cacheHits: 0,
        avgLatencyMs: 0,
      }

      // Calculate cache hit rate
      const cacheHitRate = totals.totalRequests > 0
        ? totals.cacheHits / totals.totalRequests
        : 0

      // Query daily breakdown
      const dailyResult = await db
        .select({
          date: sql<string>`DATE(${usageLogs.createdAt})`,
          costUsd: sql<number>`COALESCE(SUM(CAST(${usageLogs.costUsd} AS NUMERIC)), 0)`,
          requests: sql<number>`COUNT(*)`,
          cacheHits: sql<number>`COALESCE(SUM(CASE WHEN ${usageLogs.cached} THEN 1 ELSE 0 END), 0)`,
        })
        .from(usageLogs)
        .where(
          and(
            eq(usageLogs.tenantId, tenantId),
            gte(usageLogs.createdAt, startDate)
          )
        )
        .groupBy(sql`DATE(${usageLogs.createdAt})`)
        .orderBy(sql`DATE(${usageLogs.createdAt})`)

      const summary: UsageSummary = {
        period,
        totalCostUsd: Number(totals.totalCostUsd),
        totalRequests: Number(totals.totalRequests),
        totalInputTokens: Number(totals.totalInputTokens),
        totalOutputTokens: Number(totals.totalOutputTokens),
        cacheHitRate: Math.round(cacheHitRate * 1000) / 1000, // Round to 3 decimal places
        avgLatencyMs: Math.round(Number(totals.avgLatencyMs)),
        days: dailyResult.map((day) => ({
          date: day.date,
          costUsd: Number(day.costUsd),
          requests: Number(day.requests),
          cacheHits: Number(day.cacheHits),
        })),
      }

      return reply.send(summary)
    }
  )

  /**
   * GET /v1/usage/breakdown
   * 
   * Returns usage breakdown by model and provider for the authenticated tenant.
   */
  app.get(
    '/v1/usage/breakdown',
    {
      schema: {
        tags: ['Usage'],
        summary: 'Get usage breakdown',
        description: 'Returns usage data grouped by model and provider for the authenticated tenant',
        security: [{ BearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { tenantId } = request.tenantContext!

      // Query breakdown by model and provider
      const breakdownResult = await db
        .select({
          model: usageLogs.model,
          provider: usageLogs.provider,
          requests: sql<number>`COUNT(*)`,
          costUsd: sql<number>`COALESCE(SUM(CAST(${usageLogs.costUsd} AS NUMERIC)), 0)`,
          inputTokens: sql<number>`COALESCE(SUM(${usageLogs.inputTokens}), 0)`,
          outputTokens: sql<number>`COALESCE(SUM(${usageLogs.outputTokens}), 0)`,
        })
        .from(usageLogs)
        .where(eq(usageLogs.tenantId, tenantId))
        .groupBy(usageLogs.model, usageLogs.provider)
        .orderBy(desc(sql`SUM(CAST(${usageLogs.costUsd} AS NUMERIC))`))

      const breakdown: UsageBreakdown = breakdownResult.map((item) => ({
        model: item.model,
        provider: item.provider,
        requests: Number(item.requests),
        costUsd: Number(item.costUsd),
        inputTokens: Number(item.inputTokens),
        outputTokens: Number(item.outputTokens),
      }))

      return reply.send(breakdown)
    }
  )
}
