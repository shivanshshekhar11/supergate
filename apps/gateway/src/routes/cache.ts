/**
 * Cache Analytics Routes
 *
 * GET /v1/cache/stats — tenant-scoped cache performance metrics.
 * Used by the Swagger docs and available for external API consumers.
 * Dashboard derives cache hit rate from /v1/usage/chart buckets instead
 * (which are provider + time-range filtered), but this endpoint remains
 * for direct API access and future dashboard widgets.
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '../db/client'
import { cacheEntries, usageLogs } from '../db/schema'
import { sql, and, gte, eq, desc } from 'drizzle-orm'
import { dashboardAuthMiddleware } from '../middleware/dashboard-auth'

const CacheStatsResponseSchema = z.object({
  totalEntries:    z.number(),
  totalHits:       z.number(),
  hitRate:         z.number(),
  avgHitsPerEntry: z.number(),
  costSavingsUsd:  z.number(),
  topCachedModels: z.array(z.object({
    model:   z.string(),
    entries: z.number(),
    hits:    z.number(),
  })),
})

export async function cacheRoutes(app: FastifyInstance) {
  /**
   * GET /v1/cache/stats
   *
   * Returns comprehensive cache statistics for the authenticated tenant.
   * Includes hit rates, cost savings, and top-model breakdown.
   */
  app.get<{ Reply: z.infer<typeof CacheStatsResponseSchema> }>(
    '/v1/cache/stats',
    {
      preHandler: dashboardAuthMiddleware,
      schema: {
        tags: ['Cache'],
        summary: 'Get cache statistics',
        description: 'Returns semantic cache performance metrics including hit rates and cost savings',
        security: [{ BearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const tenantId = request.userContext!.tenantId

      const cacheStatsResult = await db
        .select({
          totalEntries: sql<number>`COUNT(*)`,
          totalHits:    sql<number>`COALESCE(SUM(${cacheEntries.hitCount}), 0)`,
        })
        .from(cacheEntries)
        .where(eq(cacheEntries.tenantId, tenantId))

      const cs = cacheStatsResult[0] ?? { totalEntries: 0, totalHits: 0 }

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const requestStatsResult = await db
        .select({
          totalRequests:   sql<number>`COUNT(*)`,
          cachedRequests:  sql<number>`COALESCE(SUM(CASE WHEN ${usageLogs.cached} THEN 1 ELSE 0 END), 0)`,
          totalCost:       sql<number>`COALESCE(SUM(CAST(${usageLogs.costUsd} AS NUMERIC)), 0)`,
          cachedCost:      sql<number>`COALESCE(SUM(CASE WHEN ${usageLogs.cached} THEN CAST(${usageLogs.costUsd} AS NUMERIC) ELSE 0 END), 0)`,
        })
        .from(usageLogs)
        .where(and(eq(usageLogs.tenantId, tenantId), gte(usageLogs.createdAt, thirtyDaysAgo)))

      const rs = requestStatsResult[0] ?? { totalRequests: 0, cachedRequests: 0, totalCost: 0, cachedCost: 0 }

      const hitRate         = Number(rs.totalRequests) > 0 ? Number(rs.cachedRequests) / Number(rs.totalRequests) : 0
      const avgHitsPerEntry = Number(cs.totalEntries)  > 0 ? Number(cs.totalHits)      / Number(cs.totalEntries)  : 0
      const nonCachedReqs   = Number(rs.totalRequests) - Number(rs.cachedRequests)
      const avgCostPerReq   = nonCachedReqs > 0 ? (Number(rs.totalCost) - Number(rs.cachedCost)) / nonCachedReqs : 0
      const costSavingsUsd  = avgCostPerReq * Number(rs.cachedRequests)

      const topModelsResult = await db
        .select({
          model:   cacheEntries.model,
          entries: sql<number>`COUNT(*)`,
          hits:    sql<number>`COALESCE(SUM(${cacheEntries.hitCount}), 0)`,
        })
        .from(cacheEntries)
        .where(eq(cacheEntries.tenantId, tenantId))
        .groupBy(cacheEntries.model)
        .orderBy(desc(sql`COALESCE(SUM(${cacheEntries.hitCount}), 0)`))
        .limit(5)

      return reply.send({
        totalEntries:    Number(cs.totalEntries),
        totalHits:       Number(cs.totalHits),
        hitRate:         Math.round(hitRate * 1000) / 1000,
        avgHitsPerEntry: Math.round(avgHitsPerEntry * 10) / 10,
        costSavingsUsd:  Math.round(costSavingsUsd * 100) / 100,
        topCachedModels: topModelsResult.map(r => ({
          model:   r.model,
          entries: Number(r.entries),
          hits:    Number(r.hits),
        })),
      })
    }
  )
}
