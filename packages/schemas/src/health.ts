import { z } from 'zod'

/**
 * Circuit breaker state for a provider
 */
export const CircuitBreakerStateSchema = z.object({
  provider: z.string(),
  state: z.enum(['CLOSED', 'OPEN', 'HALF_OPEN']),
  failures: z.number(),
  lastFailure: z.string().nullable(), // ISO 8601 timestamp
})

/**
 * Health check response
 */
export const HealthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string(), // ISO 8601 timestamp
  uptime: z.number(), // seconds
  database: z.object({
    connected: z.boolean(),
    latencyMs: z.number().optional(),
  }),
  redis: z.object({
    connected: z.boolean(),
    latencyMs: z.number().optional(),
  }),
  providers: z.array(CircuitBreakerStateSchema),
})

// Inferred TypeScript types
export type CircuitBreakerState = z.infer<typeof CircuitBreakerStateSchema>
export type HealthResponse = z.infer<typeof HealthResponseSchema>
