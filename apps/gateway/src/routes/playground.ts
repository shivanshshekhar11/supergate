/**
 * Playground Route
 *
 * POST /v1/playground/chat
 *
 * A non-streaming chat endpoint for the dashboard playground.
 * Uses JWT auth (dashboard users) and the same provider routing as the main chat endpoint.
 * Returns the full response plus gateway metadata (latency, cost estimate, cache status).
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { dashboardAuthMiddleware } from '../middleware/dashboard-auth'
import { getProviderForRequest, getProviderName } from '../providers/router'
import { getTenantTier, listTenantLLMKeys } from '../lib/tenant-keys'
import { randomUUID } from 'crypto'

const PlaygroundRequestSchema = z.object({
  model:             z.string().min(1),
  messages:          z.array(z.object({ role: z.enum(['system', 'user', 'assistant']), content: z.string() })).min(1),
  temperature:       z.number().min(0).max(2).optional().default(0.7),
  max_tokens:        z.number().int().positive().optional().default(2048),
  systemPrompt:      z.string().optional(),
})

export async function playgroundRoutes(app: FastifyInstance) {
  app.post(
    '/v1/playground/chat',
    {
      onRequest: dashboardAuthMiddleware,
      schema: {
        tags: ['Playground'],
        summary: 'Playground chat',
        description: 'Non-streaming chat for the dashboard playground. Returns full response with latency and cost metadata.',
        security: [{ BearerAuth: [] }],
        body: PlaygroundRequestSchema,
      },
    },
    async (request: any, reply) => {
      const { tenantId } = request.userContext!
      const startTime = Date.now()
      const requestId = randomUUID()

      const body = PlaygroundRequestSchema.parse(request.body)

      // Build messages — prepend system prompt if provided
      const messages = body.systemPrompt
        ? [{ role: 'system' as const, content: body.systemPrompt }, ...body.messages]
        : body.messages

      try {
        const provider = await getProviderForRequest(body.model, tenantId)

        const response = await provider.chat({
          model:       body.model,
          messages,
          temperature: body.temperature,
          max_tokens:  body.max_tokens,
          stream:      false,
        })

        const latencyMs = Date.now() - startTime

        // Rough cost estimate from provider cost table
        const providerName = getProviderName(body.model)
        const costPerToken = provider.costPerToken(body.model)
        const costUsd = costPerToken
          ? (response.usage.prompt_tokens * costPerToken.inputUsd) +
            (response.usage.completion_tokens * costPerToken.outputUsd)
          : 0

        return reply.send({
          requestId,
          response,
          meta: {
            latencyMs,
            costUsd,
            cached:       false,
            provider:     providerName,
            model:        body.model,
            inputTokens:  response.usage.prompt_tokens,
            outputTokens: response.usage.completion_tokens,
          },
        })
      } catch (err: any) {
        const status = err.message?.includes('BYOK') || err.message?.includes('enterprise-independent')
          ? 403
          : err.message?.includes('Unknown model')
          ? 400
          : err.message?.includes('circuit breaker')
          ? 503
          : 500

        return reply.code(status).send({
          error: {
            code:      status === 403 ? 'byok_required'
                     : status === 400 ? 'invalid_model'
                     : status === 503 ? 'provider_unavailable'
                     : 'internal_error',
            message:   err.message ?? 'An error occurred',
            requestId,
          },
        })
      }
    }
  )

  /**
   * GET /v1/playground/models
   * Returns available models grouped by provider, with BYOK status for the tenant.
   */
  app.get(
    '/v1/playground/models',
    {
      onRequest: dashboardAuthMiddleware,
      schema: {
        tags: ['Playground'],
        summary: 'List available models',
        description: 'Returns models grouped by provider with BYOK availability for the tenant.',
        security: [{ BearerAuth: [] }],
      },
    },
    async (request: any, reply) => {
      const { tenantId } = request.userContext!

      const [tier, byokKeys] = await Promise.all([
        getTenantTier(tenantId),
        listTenantLLMKeys(tenantId),
      ])

      const byokProviders = new Set(byokKeys.map(k => k.provider))

      // Curated model list — most useful models per provider
      const models = [
        // OpenAI
        { id: 'gpt-4o',          provider: 'openai',    label: 'GPT-4o'              },
        { id: 'gpt-4o-mini',     provider: 'openai',    label: 'GPT-4o Mini'         },
        { id: 'gpt-4-turbo',     provider: 'openai',    label: 'GPT-4 Turbo'         },
        { id: 'gpt-3.5-turbo',   provider: 'openai',    label: 'GPT-3.5 Turbo'       },
        // Anthropic
        { id: 'claude-3-5-sonnet-20241022', provider: 'anthropic', label: 'Claude 3.5 Sonnet' },
        { id: 'claude-3-5-haiku-20241022',  provider: 'anthropic', label: 'Claude 3.5 Haiku'  },
        { id: 'claude-3-opus-20240229',     provider: 'anthropic', label: 'Claude 3 Opus'      },
        // Google
        { id: 'gemini-1.5-pro',   provider: 'google',  label: 'Gemini 1.5 Pro'      },
        { id: 'gemini-1.5-flash', provider: 'google',  label: 'Gemini 1.5 Flash'    },
        // Cohere
        { id: 'command-r-plus',   provider: 'cohere',  label: 'Command R+'          },
        { id: 'command-r',        provider: 'cohere',  label: 'Command R'           },
        // Mistral
        { id: 'mistral-large-latest', provider: 'mistral', label: 'Mistral Large'   },
        { id: 'mistral-small-latest', provider: 'mistral', label: 'Mistral Small'   },
      ]

      // For enterprise-independent: only show models where BYOK is configured
      const available = tier === 'enterprise-independent'
        ? models.filter(m => byokProviders.has(m.provider))
        : models

      return reply.send({
        tier,
        models: available.map(m => ({
          ...m,
          keySource: byokProviders.has(m.provider) ? 'byok' : 'gateway',
        })),
      })
    }
  )
}
