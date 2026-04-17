/**
 * Usage Logger Middleware
 * 
 * Logs request usage data to the database after each LLM API call.
 * Runs as an onResponse hook (fire-and-forget) so logging failures
 * never affect the response to the client.
 * 
 * Logged data includes:
 * - Tenant ID and API key ID
 * - Provider and model
 * - Token counts (input/output)
 * - Cost in USD
 * - Latency
 * - Cache hit/miss status
 * - Request ID for tracing
 */

import type { FastifyRequest, FastifyReply } from 'fastify'
import { db } from '../db/client'
import { usageLogs } from '../db/schema'
import { calculateCost } from '../lib/cost-calculator'

declare module 'fastify' {
  interface FastifyRequest {
    llmResult?: {
      provider: string
      model: string
      inputTokens: number
      outputTokens: number
      cached?: boolean
    }
    startTime?: number
    requestId?: string
  }
}

export async function usageLoggerMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Only log chat completion requests
  if (!request.url.includes('/chat/completions')) {
    return
  }

  // Skip if no tenant context (unauthenticated request)
  if (!request.tenantContext) {
    return
  }

  // Skip if no LLM result (request failed before reaching provider)
  if (!request.llmResult) {
    return
  }

  try {
    const { provider, model, inputTokens, outputTokens, cached } = request.llmResult
    const { tenantId, keyId } = request.tenantContext

    // Calculate cost
    const costUsd = calculateCost(model, inputTokens, outputTokens)

    // Calculate latency
    const latencyMs = request.startTime
      ? Math.round(Date.now() - request.startTime)
      : null

    // Insert usage log (fire-and-forget)
    await db.insert(usageLogs).values({
      tenantId,
      apiKeyId: keyId,
      provider,
      model,
      inputTokens,
      outputTokens,
      costUsd: costUsd.toString(),
      latencyMs,
      cached: cached || false,
      requestId: request.requestId || request.id,
    })

    console.log(
      `[UsageLogger] Logged: tenant=${tenantId}, model=${model}, ` +
      `tokens=${inputTokens}+${outputTokens}, cost=$${costUsd.toFixed(6)}, ` +
      `latency=${latencyMs}ms, cached=${cached || false}`
    )
  } catch (error) {
    // Logging failure should never affect the response
    console.error('[UsageLogger] Error logging usage:', error)
  }
}
