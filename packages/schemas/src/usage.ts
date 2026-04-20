import { z } from 'zod'

/**
 * Daily usage data point
 */
export const DailyUsageSchema = z.object({
  date: z.string(), // ISO 8601 date string
  costUsd: z.number(),
  requests: z.number(),
  cacheHits: z.number(),
})

/**
 * Usage summary aggregated by period
 */
export const UsageSummarySchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']),
  totalCostUsd: z.number(),
  totalRequests: z.number(),
  totalInputTokens: z.number(),
  totalOutputTokens: z.number(),
  cacheHitRate: z.number().min(0).max(1), // 0.0 to 1.0
  avgLatencyMs: z.number(),
  days: z.array(DailyUsageSchema),
})

/**
 * Usage breakdown by model and provider
 */
export const UsageBreakdownItemSchema = z.object({
  model: z.string(),
  provider: z.string(),
  requests: z.number(),
  costUsd: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
})

export const UsageBreakdownSchema = z.array(UsageBreakdownItemSchema)

// Inferred TypeScript types
export type DailyUsage = z.infer<typeof DailyUsageSchema>
export type UsageSummary = z.infer<typeof UsageSummarySchema>
export type UsageBreakdownItem = z.infer<typeof UsageBreakdownItemSchema>
export type UsageBreakdown = z.infer<typeof UsageBreakdownSchema>

/**
 * Chart data bucket — one bar in the dashboard chart
 */
export const ChartBucketSchema = z.object({
  label: z.string(),       // x-axis label e.g. "14:00", "Mon", "Apr 13"
  requests: z.number(),
  cacheHits: z.number(),
  costUsd: z.number(),
  avgLatencyMs: z.number(), // avg latency for requests in this bucket (0 if no requests)
})

export const UsageChartResponseSchema = z.object({
  timeRange: z.enum(['24h', '7d', '30d']),
  provider: z.string().nullable(),
  buckets: z.array(ChartBucketSchema),
})

export type ChartBucket = z.infer<typeof ChartBucketSchema>
export type UsageChartResponse = z.infer<typeof UsageChartResponseSchema>
