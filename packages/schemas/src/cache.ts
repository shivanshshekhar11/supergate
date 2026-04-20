import { z } from 'zod'

/**
 * Top cached model data
 */
export const TopCachedModelSchema = z.object({
  model: z.string(),
  entries: z.number(),
  hits: z.number(),
})

/**
 * Cache statistics response
 */
export const CacheStatsSchema = z.object({
  totalEntries: z.number(),
  totalHits: z.number(),
  hitRate: z.number().min(0).max(1), // 0.0 to 1.0
  avgHitsPerEntry: z.number(),
  costSavingsUsd: z.number(),
  topCachedModels: z.array(TopCachedModelSchema),
})

/**
 * Cache timeseries data point
 */
export const CacheTimeseriesItemSchema = z.object({
  date: z.string(), // ISO 8601 date string
  cacheHits: z.number(),
  cacheMisses: z.number(),
  hitRate: z.number().min(0).max(1), // 0.0 to 1.0
})

export const CacheTimeseriesSchema = z.array(CacheTimeseriesItemSchema)

// Inferred TypeScript types
export type TopCachedModel = z.infer<typeof TopCachedModelSchema>
export type CacheStats = z.infer<typeof CacheStatsSchema>
export type CacheTimeseriesItem = z.infer<typeof CacheTimeseriesItemSchema>
export type CacheTimeseries = z.infer<typeof CacheTimeseriesSchema>
