/**
 * PII Masking Middleware
 * 
 * Masks personally identifiable information in request messages before storage.
 * The original unmasked messages are still sent to the LLM provider.
 * Only the masked version is stored in logs and cache.
 * 
 * This middleware runs BEFORE the semantic cache and usage logger,
 * ensuring PII never reaches persistent storage.
 */

import type { FastifyRequest, FastifyReply } from 'fastify'
import { maskMessages } from '../lib/pii-patterns'

declare module 'fastify' {
  interface FastifyRequest {
    maskedMessages?: Array<{ role: string; content: string }>
    piiDetected?: boolean
  }
}

export async function piiMaskMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Only process chat completion requests
  if (!request.url.includes('/chat/completions')) {
    return
  }

  const body = request.body as any

  // Skip if no messages in body
  if (!body || !Array.isArray(body.messages)) {
    return
  }

  try {
    // Create masked version for storage
    const maskedMessages = maskMessages(body.messages)

    // Check if any masking occurred
    const piiDetected = maskedMessages.some((masked, idx) => 
      masked.content !== body.messages[idx].content
    )

    // Store masked messages on request for usage logger
    request.maskedMessages = maskedMessages
    request.piiDetected = piiDetected

    if (piiDetected) {
      console.log('[PIIMask] PII detected and masked in request')
    }
  } catch (error) {
    // PII masking failure should not block the request
    console.error('[PIIMask] Error masking PII:', error)
  }
}
