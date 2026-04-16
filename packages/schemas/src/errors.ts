import { z } from 'zod'

/**
 * Standard error response schema
 */
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
    details: z.record(z.any()).optional(),
  }),
})

/**
 * Common error codes
 */
export const ErrorCodes = {
  // Auth errors (401)
  MISSING_API_KEY: 'missing_api_key',
  INVALID_API_KEY: 'invalid_api_key',
  REVOKED_API_KEY: 'revoked_api_key',

  // Permission errors (403)
  INSUFFICIENT_PERMISSIONS: 'insufficient_permissions',

  // Rate limit errors (429)
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',

  // Validation errors (400)
  INVALID_REQUEST: 'invalid_request',
  INVALID_MODEL: 'invalid_model',

  // Provider errors (502/503)
  PROVIDER_ERROR: 'provider_error',
  PROVIDER_UNAVAILABLE: 'provider_unavailable',
  CIRCUIT_BREAKER_OPEN: 'circuit_breaker_open',

  // Internal errors (500)
  INTERNAL_ERROR: 'internal_error',
  DATABASE_ERROR: 'database_error',
  CACHE_ERROR: 'cache_error',
} as const

// Inferred TypeScript types
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]
