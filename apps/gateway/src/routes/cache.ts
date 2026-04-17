/**
 * Cache Analytics Routes
 * 
 * Endpoints for querying semantic cache performance and statistics.
 * This is a key differentiator showcasing the technical moat of semantic caching.
 * 
 * All queries are automatically scoped to the authenticated tenant.
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '../db/client'
import { cacheEntries, usageLogs } from '../db/schema'
import { sql, and, gte, eq, desc } from 'drizzle-orm'

const CacheStatsResponseSchema = z.object({
  totalEntries: z.number(),
  totalHits: z.number(),
  hitRate: z.number(),
  avgHitsPerEntry: z.number(),
  costSavingsUsd: z.number(),
  topCachedModels: z.array(
    z.object({
      model: z.string(),
      entries: z.number(),
      hits: z.number(),
    })
  ),
})

const CacheTimeseriesResponseSchema = z.array(
  z.object({
    date: z.string(),
    cacheHits: z.number(),
    cacheMisses: z.number(),
    hitRate: z.number(),
  })
)

export async function cacheRoutes(app: FastifyInstance) {
  /**
   * GET /v1/cache/stats
   * 
   * Returns comprehensive cache statistics for the authenticated tenant.
   * Includes hit rates, cost savings, and model-level breakdown.
   */
  app.get<{
    Reply: z.infer<typeof CacheStatsResponseSchema>
  }>(
    '/v1/cache/stats',
    {
      schema: {
        tags: ['Cache'],
        summary: 'Get cache statistics',
        description: 'Returns semantic cache performance metrics including hit rates and cost savings',
        security: [{ BearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { tenantId } = request.tenantContext!

      // Get total cache entries and aggregate hits
      const cacheStatsResult = await db
        .select({
          totalEntries: sql<number>`COUNT(*)`,
          totalHits: sql<number>`COALESCE(SUM(${cacheEntries.hitCount}), 0)`,
        })
        .from(cacheEntries)
        .where(eq(cacheEntries.tenantId, tenantId))

      const cacheStats = cacheStatsResult[0] || {
        totalEntries: 0,
        totalHits: 0,
      }

      // Get total requests from usage logs (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const requestStatsResult = await db
        .select({
          totalRequests: sql<number>`COUNT(*)`,
          cachedRequests: sql<number>`COALESCE(SUM(CASE WHEN ${usageLogs.cached} THEN 1 ELSE 0 END), 0)`,
          totalCost: sql<number>`COALESCE(SUM(CAST(${usageLogs.costUsd} AS NUMERIC)), 0)`,
          cachedCost: sql<number>`COALESCE(SUM(CASE WHEN ${usageLogs.cached} THEN CAST(${usageLogs.costUsd} AS NUMERIC) ELSE 0 END), 0)`,
        })
        .from(usageLogs)
        .where(
          and(
            eq(usageLogs.tenantId, tenantId),
            gte(usageLogs.createdAt, thirtyDaysAgo)
          )
        )

      const requestStats = requestStatsResult[0] || {
        totalRequests: 0,
        cachedRequests: 0,
        totalCost: 0,
        cachedCost: 0,
      }

      // Calculate hit rate
      const hitRate = Number(requestStats.totalRequests) > 0
        ? Number(requestStats.cachedRequests) / Number(requestStats.totalRequests)
        : 0

      // Calculate average hits per entry
      const avgHitsPerEntry = Number(cacheStats.totalEntries) > 0
        ? Number(cacheStats.totalHits) / Number(cacheStats.totalEntries)
        : 0

      // Estimate cost savings (cached requests would have cost the same as average non-cached)
      const avgCostPerRequest = (Number(requestStats.totalRequests) - Number(requestStats.cachedRequests)) > 0
        ? (Number(requestStats.totalCost) - Number(requestStats.cachedCost)) / (Number(requestStats.totalRequests) - Number(requestStats.cachedRequests))
        : 0
      const costSavingsUsd = avgCostPerRequest * Number(requestStats.cachedRequests)

      // Get top cached models
      const topModelsResult = await db
        .select({
          model: cacheEntries.model,
          entries: sql<number>`COUNT(*)`,
          hits: sql<number>`COALESCE(SUM(${cacheEntries.hitCount}), 0)`,
        })
        .from(cacheEntries)
        .where(eq(cacheEntries.tenantId, tenantId))
        .groupBy(cacheEntries.model)
        .orderBy(desc(sql`COALESCE(SUM(${cacheEntries.hitCount}), 0)`))
        .limit(5)

      const response = {
        totalEntries: Number(cacheStats.totalEntries),
        totalHits: Number(cacheStats.totalHits),
        hitRate: Math.round(hitRate * 1000) / 1000,
        avgHitsPerEntry: Math.round(avgHitsPerEntry * 10) / 10,
        costSavingsUsd: Math.round(costSavingsUsd * 100) / 100,
        topCachedModels: topModelsResult.map((row) => ({
          model: row.model,
          entries: Number(row.entries),
          hits: Number(row.hits),
        })),
      }

      return reply.send(response)
    }
  )

  /**
   * GET /v1/cache/timeseries
   * 
   * Returns daily cache hit/miss timeseries data for charting.
   */
  app.get<{
    Reply: z.infer<typeof CacheTimeseriesResponseSchema>
  }>(
    '/v1/cache/timeseries',
    {
      schema: {
        tags: ['Cache'],
        summary: 'Get cache timeseries data',
        description: 'Returns daily cache hit and miss counts for the last 7 days',
        security: [{ BearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { tenantId } = request.tenantContext!

      // Get last 7 days
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      sevenDaysAgo.setHours(0, 0, 0, 0)

      const timeseriesResult = await db
        .select({
          date: sql<string>`DATE(${usageLogs.createdAt})`,
          cacheHits: sql<number>`COALESCE(SUM(CASE WHEN ${usageLogs.cached} THEN 1 ELSE 0 END), 0)`,
          cacheMisses: sql<number>`COALESCE(SUM(CASE WHEN NOT ${usageLogs.cached} THEN 1 ELSE 0 END), 0)`,
          totalRequests: sql<number>`COUNT(*)`,
        })
        .from(usageLogs)
        .where(
          and(
            eq(usageLogs.tenantId, tenantId),
            gte(usageLogs.createdAt, sevenDaysAgo)
          )
        )
        .groupBy(sql`DATE(${usageLogs.createdAt})`)
        .orderBy(sql`DATE(${usageLogs.createdAt})`)

      const response = timeseriesResult.map((row) => {
        const total = Number(row.totalRequests)
        const hits = Number(row.cacheHits)
        const hitRate = total > 0 ? hits / total : 0

        return {
          date: row.date,
          cacheHits: hits,
          cacheMisses: Number(row.cacheMisses),
          hitRate: Math.round(hitRate * 1000) / 1000,
        }
      })

      return reply.send(response)
    }
  )
}
