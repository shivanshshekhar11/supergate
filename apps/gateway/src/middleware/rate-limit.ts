import { FastifyRequest, FastifyReply } from 'fastify'
import { getRedisClient } from '../redis/client'
import { env } from '../config'

/**
 * Rate limit configuration per tenant
 * Can be customized per tenant tier in the future
 */
interface RateLimitConfig {
  rpm: number // Requests per minute
  tpm: number // Tokens per minute
}

/**
 * Get rate limit configuration for a tenant
 * Currently uses defaults, but can be customized per tenant/tier
 */
function getRateLimitConfig(tenantTier: string): RateLimitConfig {
  // Future: customize by tier
  // For now, use defaults from env
  return {
    rpm: env.DEFAULT_RPM,
    tpm: env.DEFAULT_TPM,
  }
}

/**
 * Estimate token count from text
 * Rough approximation: word count × 1.3
 * This is reconciled with actual count post-response
 */
function estimateTokens(text: string): number {
  const wordCount = text.split(/\s+/).length
  return Math.ceil(wordCount * 1.3)
}

/**
 * Estimate tokens from chat request
 */
function estimateRequestTokens(messages: Array<{ role: string; content: string }>): number {
  const totalText = messages.map((m) => m.content).join(' ')
  return estimateTokens(totalText)
}

/**
 * Lua script for atomic rate limiting
 * 
 * Uses sliding window algorithm with Redis:
 * - TPM (tokens per minute): tracks token consumption
 * - RPM (requests per minute): tracks request count
 * 
 * Returns:
 * - 0: Request allowed
 * - 1: Rate limit exceeded
 * - [remaining_tpm, remaining_rpm]: Remaining capacity
 */
const RATE_LIMIT_LUA = `
local tpm_key = KEYS[1]
local rpm_key = KEYS[2]
local tokens = tonumber(ARGV[1])
local tpm_limit = tonumber(ARGV[2])
local rpm_limit = tonumber(ARGV[3])
local window_ms = tonumber(ARGV[4])

-- Increment TPM counter
local tpm = redis.call('INCRBY', tpm_key, tokens)
if tpm == tokens then
  redis.call('PEXPIRE', tpm_key, window_ms)
end

-- Increment RPM counter
local rpm = redis.call('INCR', rpm_key)
if rpm == 1 then
  redis.call('PEXPIRE', rpm_key, window_ms)
end

-- Check limits
if tpm > tpm_limit then
  return {1, 'tpm_exceeded', 0, rpm_limit - rpm}
end

if rpm > rpm_limit then
  return {1, 'rpm_exceeded', tpm_limit - tpm, 0}
end

-- Return success with remaining capacity
return {0, 'ok', tpm_limit - tpm, rpm_limit - rpm}
`

/**
 * Rate limiting middleware
 * 
 * Flow:
 * 1. Get tenant context from auth middleware
 * 2. Estimate token count from request
 * 3. Check rate limits using Redis Lua script (atomic)
 * 4. If exceeded: return 429 with headers
 * 5. If allowed: add rate limit headers and continue
 * 
 * Headers added:
 * - X-RateLimit-Limit-RPM: Requests per minute limit
 * - X-RateLimit-Remaining-RPM: Remaining requests
 * - X-RateLimit-Limit-TPM: Tokens per minute limit
 * - X-RateLimit-Remaining-TPM: Remaining tokens
 * - Retry-After: Seconds until rate limit resets (on 429)
 */
export async function rateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Skip rate limiting if no tenant context (shouldn't happen after auth)
  if (!request.tenantContext) {
    request.log.warn('[RateLimit] No tenant context - skipping rate limit check')
    return
  }

  const { tenantId, tenantTier } = request.tenantContext

  // Get rate limit configuration
  const config = getRateLimitConfig(tenantTier)

  // Estimate token count from request body
  let estimatedTokens = 100 // Default estimate
  if (request.body && typeof request.body === 'object') {
    const body = request.body as any
    if (body.messages && Array.isArray(body.messages)) {
      estimatedTokens = estimateRequestTokens(body.messages)
    }
  }

  // Generate Redis keys for current minute bucket
  const now = Date.now()
  const minuteBucket = Math.floor(now / 60000) // Current minute
  const tpmKey = `rl:${tenantId}:tpm:${minuteBucket}`
  const rpmKey = `rl:${tenantId}:rpm:${minuteBucket}`

  try {
    const redis = getRedisClient()

    // Execute Lua script atomically
    const result = await redis.eval(
      RATE_LIMIT_LUA,
      2, // Number of keys
      tpmKey,
      rpmKey,
      estimatedTokens.toString(),
      config.tpm.toString(),
      config.rpm.toString(),
      '60000' // 60 seconds window
    ) as [number, string, number, number]

    const [status, reason, remainingTPM, remainingRPM] = result

    // Add rate limit headers
    reply.header('X-RateLimit-Limit-RPM', config.rpm)
    reply.header('X-RateLimit-Remaining-RPM', Math.max(0, remainingRPM))
    reply.header('X-RateLimit-Limit-TPM', config.tpm)
    reply.header('X-RateLimit-Remaining-TPM', Math.max(0, remainingTPM))

    // Check if rate limit exceeded
    if (status === 1) {
      const retryAfter = 60 // Seconds until next minute bucket

      reply.header('Retry-After', retryAfter)

      const errorMessage =
        reason === 'tpm_exceeded'
          ? `Token rate limit exceeded. Limit: ${config.tpm} tokens/minute`
          : `Request rate limit exceeded. Limit: ${config.rpm} requests/minute`

      request.log.warn(
        `[RateLimit] Rate limit exceeded: tenant=${tenantId}, reason=${reason}, ` +
        `tpm=${config.tpm}, rpm=${config.rpm}`
      )

      return reply.code(429).send({
        error: {
          code: 'rate_limit_exceeded',
          message: errorMessage,
          requestId: request.id,
          retryAfter,
          limits: {
            rpm: config.rpm,
            tpm: config.tpm,
          },
          remaining: {
            rpm: Math.max(0, remainingRPM),
            tpm: Math.max(0, remainingTPM),
          },
        },
      })
    }

    // Rate limit check passed
    request.log.info(
      `[RateLimit] Check passed: tenant=${tenantId}, ` +
      `remaining_rpm=${remainingRPM}, remaining_tpm=${remainingTPM}`
    )
  } catch (error) {
    request.log.error({ err: error }, '[RateLimit] Error checking rate limit')
    // On error, allow the request through (fail open)
    // This prevents Redis issues from blocking all traffic
    request.log.warn('[RateLimit] Allowing request due to rate limit check error')
  }
}
