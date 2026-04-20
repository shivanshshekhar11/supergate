/**
 * Usage Logs Routes
 * 
 * Endpoints for querying paginated usage logs with filters
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '../db/client'
import { usageLogs } from '../db/schema'
import { sql, and, eq, desc, gte, SQL } from 'drizzle-orm'
import { dashboardAuthMiddleware } from '../middleware/dashboard-auth'
import { authMiddleware } from '../middleware/auth'
import {
  UsageLogsResponseSchema,
  type UsageLogsResponse,
} from '@llm-gateway/schemas'

// Hybrid auth middleware that accepts both JWT (dashboard) and API key (tests/programmatic)
async function hybridAuthMiddleware(request: any, reply: any) {
  const authHeader = request.headers.authorization
  
  if (!authHeader) {
    return reply.code(401).send({
      error: {
        code: 'unauthorized',
        message: 'Missing authorization header',
      },
    })
  }

  // Try JWT auth first (for dashboard) - JWT tokens start with "eyJ"
  if (authHeader.startsWith('Bearer eyJ')) {
    try {
      await dashboardAuthMiddleware(request, reply)
      return
    } catch (error) {
      // If JWT fails, fall through to API key auth
    }
  }

  // Try API key auth (for tests and programmatic access)
  await authMiddleware(request, reply)
  
  // Map tenantContext to userContext for consistency
  if (request.tenantContext) {
    request.userContext = {
      userId: request.tenantContext.keyId,
      tenantId: request.tenantContext.tenantId,
      role: request.tenantContext.keyRole as 'admin' | 'member' | 'guest',
    }
  }
}

const UsageLogsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(10),
  provider: z.string().optional(),
  model: z.string().optional(),
  status: z.coerce.number().optional(),
  timeRange: z.enum(['24h', '7d', '30d']).default('24h'),
})

export async function usageLogsRoutes(app: FastifyInstance) {
  /**
   * GET /v1/usage/logs
   * 
   * Returns paginated usage logs with filters
   */
  app.get<{
    Querystring: z.infer<typeof UsageLogsQuerySchema>
    Reply: UsageLogsResponse
  }>(
    '/v1/usage/logs',
    {
      preHandler: hybridAuthMiddleware,
      schema: {
        tags: ['Usage'],
        summary: 'Get usage logs',
        description: 'Returns paginated usage logs with optional filters',
        security: [{ BearerAuth: [] }],
        querystring: UsageLogsQuerySchema,
      },
    },
    async (request, reply) => {
      const tenantId = request.userContext!.tenantId
      
      // Parse and validate query params with coercion
      const queryParams = UsageLogsQuerySchema.parse(request.query)
      const { page, pageSize, provider, model, status, timeRange } = queryParams

      // Calculate date range
      const now = new Date()
      const startDate = new Date()
      switch (timeRange) {
        case '24h':
          startDate.setHours(now.getHours() - 24)
          break
        case '7d':
          startDate.setDate(now.getDate() - 7)
          break
        case '30d':
          startDate.setDate(now.getDate() - 30)
          break
      }

      // Build where conditions
      const conditions: SQL[] = [
        eq(usageLogs.tenantId, tenantId),
        gte(usageLogs.createdAt, startDate),
      ]

      if (provider && provider !== 'all') {
        conditions.push(eq(usageLogs.provider, provider))
      }

      if (model && model !== 'all') {
        conditions.push(eq(usageLogs.model, model))
      }

      if (status) {
        conditions.push(eq(usageLogs.statusCode, status))
      }

      const whereClause = and(...conditions)

      // Get total count
      const countResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(usageLogs)
        .where(whereClause)

      const total = Number(countResult[0]?.count || 0)
      const totalPages = Math.ceil(total / pageSize)

      // Get paginated logs
      const logs = await db
        .select({
          id: usageLogs.id,
          requestId: usageLogs.requestId,
          model: usageLogs.model,
          provider: usageLogs.provider,
          inputTokens: usageLogs.inputTokens,
          outputTokens: usageLogs.outputTokens,
          costUsd: usageLogs.costUsd,
          latencyMs: usageLogs.latencyMs,
          cached: usageLogs.cached,
          statusCode: usageLogs.statusCode,
          createdAt: usageLogs.createdAt,
        })
        .from(usageLogs)
        .where(whereClause)
        .orderBy(desc(usageLogs.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize)

      const response: UsageLogsResponse = {
        logs: logs.map((log) => ({
          id: log.id,
          requestId: log.requestId,
          model: log.model,
          provider: log.provider,
          inputTokens: log.inputTokens,
          outputTokens: log.outputTokens,
          costUsd: Number(log.costUsd),
          latencyMs: log.latencyMs,
          cached: log.cached,
          statusCode: log.statusCode,
          createdAt: log.createdAt.toISOString(),
        })),
        total,
        page,
        pageSize,
        totalPages,
      }

      return reply.send(response)
    }
  )
}
