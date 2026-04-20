import { z } from 'zod'

/**
 * Usage log item
 */
export const UsageLogItemSchema = z.object({
  id: z.string(),
  requestId: z.string().nullable(),
  model: z.string(),
  provider: z.string(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  costUsd: z.number(),
  latencyMs: z.number().nullable(),
  cached: z.boolean(),
  statusCode: z.number(),
  createdAt: z.string(), // ISO 8601 date string
})

/**
 * Paginated usage logs response
 */
export const UsageLogsResponseSchema = z.object({
  logs: z.array(UsageLogItemSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
})

// Inferred TypeScript types
export type UsageLogItem = z.infer<typeof UsageLogItemSchema>
export type UsageLogsResponse = z.infer<typeof UsageLogsResponseSchema>
