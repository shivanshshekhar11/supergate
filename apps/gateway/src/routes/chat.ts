import { FastifyInstance } from 'fastify'
import { ChatRequestSchema, ChatResponseSchema, ErrorResponseSchema, type ChatRequest, type ChatResponse, type ErrorResponse } from '@llm-gateway/schemas'
import { getProviderForRequest } from '../providers/router'
import { randomUUID } from 'crypto'
import { requireRole } from '../middleware/auth'

/**
 * Chat completion route
 * OpenAI-compatible endpoint supporting both streaming and non-streaming
 * 
 * Middleware order:
 * 1. Auth middleware (extracts tenant from API key)
 * 2. Rate limiting middleware (checks TPM/RPM limits)
 * 3. This handler
 */
export async function chatRoutes(app: FastifyInstance) {
  app.post<{ Body: ChatRequest; Reply: ChatResponse | ErrorResponse }>(
    '/v1/chat/completions',
    {
      preHandler: requireRole('admin', 'user', 'member'),
      schema: {
        body: ChatRequestSchema,
        response: {
          200: ChatResponseSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          500: ErrorResponseSchema,
          503: ErrorResponseSchema,
        },
        tags: ['Chat'],
        summary: 'Create chat completion',
        description: 'OpenAI-compatible chat completion endpoint. Supports streaming and non-streaming responses. Includes semantic caching, PII masking, and rate limiting.',
        security: [{ BearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const startTime = Date.now()
      const requestId = randomUUID()

      // Store for usage logger
      request.startTime = startTime
      request.requestId = requestId

      // Ensure tenant context exists (should be set by auth middleware)
      if (!request.tenantContext) {
        return reply.code(401).send({
          error: {
            code: 'not_authenticated',
            message: 'Authentication required',
            requestId,
          },
        })
      }

      const { tenantId } = request.tenantContext

      try {
        // Body is already validated by Fastify schema validation
        const body = request.body

        // Get provider (with BYOK support)
      const provider = await getProviderForRequest(body.model, tenantId)

      // Handle streaming
      if (body.stream) {
        // Set SSE headers
        reply.raw.setHeader('Content-Type', 'text/event-stream')
        reply.raw.setHeader('Cache-Control', 'no-cache')
        reply.raw.setHeader('Connection', 'keep-alive')
        reply.raw.setHeader('X-Request-ID', requestId)
        reply.raw.setHeader('X-Cache', 'MISS') // Streaming never cached

        // Track tokens for streaming (approximate)
        let totalInputTokens = 0
        let totalOutputTokens = 0

        // Stream chunks
        try {
          for await (const chunk of provider.stream(body)) {
            reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`)

            // Accumulate token counts from chunks (if available)
            // Note: Not all streaming responses include usage data
            if ('usage' in chunk && chunk.usage) {
              totalInputTokens = (chunk.usage as any).prompt_tokens || 0
              totalOutputTokens = (chunk.usage as any).completion_tokens || 0
            }
          }

          // Send [DONE] message
          reply.raw.write('data: [DONE]\n\n')
          reply.raw.end()

          // Store LLM result for usage logger
          request.llmResult = {
            provider: provider.id,
            model: body.model,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            cached: false,
          }
        } catch (streamError) {
          request.log.error({ err: streamError }, '[Chat] Streaming error')
          reply.raw.write(
            `data: ${JSON.stringify({ error: 'Stream error occurred' })}\n\n`
          )
          reply.raw.end()
        }

        return reply
      }

      // Handle non-streaming with 60s timeout
      const response = await Promise.race([
        provider.chat(body),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Request timeout')), 60000))
      ])

      // Store LLM result for usage logger
      request.llmResult = {
        provider: provider.id,
        model: body.model,
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        cached: false, // Will be set to true by semantic cache middleware
      }

      // Add custom headers
      const latencyMs = Date.now() - startTime
      reply.header('X-Request-ID', requestId)
      reply.header('X-Latency-Ms', latencyMs.toString())
      reply.header('X-Cache', 'MISS') // Will be overridden by cache middleware if HIT

      // Store cache entry if we have prompt hash and embedding from semantic cache middleware
      if (request.promptHash && request.promptEmbedding) {
        const { storeCacheEntry } = await import('../middleware/semantic-cache')
        await storeCacheEntry(tenantId, body.model, request.promptHash, request.promptEmbedding, response)
      }

      return response
    } catch (error: any) {
      request.log.error({ err: error }, '[Chat] Error processing request')

      if (error.message === 'Request timeout') {
        return reply.code(504).send({
          error: {
            code: 'gateway_timeout',
            message: 'Upstream provider did not respond in time',
            requestId,
          },
        })
      }

      // Handle provider errors
      if (error.message?.includes('circuit breaker')) {
        return reply.code(503).send({
          error: {
            code: 'provider_unavailable',
            message: error.message,
            requestId,
          },
        })
      }

      // Handle unknown model
      if (error.message?.includes('Unknown model')) {
        return reply.code(400).send({
          error: {
            code: 'invalid_model',
            message: error.message,
            requestId,
          },
        })
      }

      // Generic error
      return reply.code(500).send({
        error: {
          code: 'internal_error',
          message: 'An error occurred processing your request',
          requestId,
        },
      })
    }
  })
}
