import { FastifyInstance } from 'fastify'
import { ChatRequestSchema } from '@llm-gateway/schemas'
import { getProviderForRequest } from '../providers/router'
import { randomUUID } from 'crypto'

/**
 * Chat completion route
 * OpenAI-compatible endpoint supporting both streaming and non-streaming
 * 
 * For Week 1: No auth, rate limiting, or caching yet
 * These will be added in subsequent weeks
 */
export async function chatRoutes(app: FastifyInstance) {
  app.post('/v1/chat/completions', async (request, reply) => {
    const startTime = Date.now()
    const requestId = randomUUID()

    try {
      // Parse and validate request body
      const body = ChatRequestSchema.parse(request.body)

      // For Week 1: Use a test tenant ID
      // In Week 2, this will come from auth middleware
      const tenantId = 'test-tenant-id'

      // Get provider (with BYOK support)
      const provider = await getProviderForRequest(body.model, tenantId)

      // Handle streaming
      if (body.stream) {
        // Set SSE headers
        reply.raw.setHeader('Content-Type', 'text/event-stream')
        reply.raw.setHeader('Cache-Control', 'no-cache')
        reply.raw.setHeader('Connection', 'keep-alive')
        reply.raw.setHeader('X-Request-ID', requestId)

        // Stream chunks
        try {
          for await (const chunk of provider.stream(body)) {
            reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`)
          }

          // Send [DONE] message
          reply.raw.write('data: [DONE]\n\n')
          reply.raw.end()
        } catch (streamError) {
          console.error('[Chat] Streaming error:', streamError)
          reply.raw.write(
            `data: ${JSON.stringify({ error: 'Stream error occurred' })}\n\n`
          )
          reply.raw.end()
        }

        return reply
      }

      // Handle non-streaming
      const response = await provider.chat(body)

      // Add custom headers
      const latencyMs = Date.now() - startTime
      reply.header('X-Request-ID', requestId)
      reply.header('X-Latency-Ms', latencyMs.toString())

      return response
    } catch (error: any) {
      console.error('[Chat] Error:', error)

      // Handle validation errors
      if (error.name === 'ZodError') {
        return reply.code(400).send({
          error: {
            code: 'invalid_request',
            message: 'Invalid request body',
            details: error.errors,
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
