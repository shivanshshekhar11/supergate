import { FastifyInstance } from 'fastify'
import {
  CreateKeyRequestSchema,
  CreateKeyResponseSchema,
  ErrorResponseSchema,
  type CreateKeyRequest,
  type CreateKeyResponse,
  type KeyMetadata,
  type ErrorResponse,
} from '@llm-gateway/schemas'
import { db } from '../db/client'
import { apiKeys } from '../db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { requireRole } from '../middleware/auth'

/**
 * Gateway API Key Management Routes
 *
 * Auth is handled by the global authMiddleware (supports both gw_ keys and JWTs).
 * Role enforcement via requireRole preHandler.
 */
export async function keyRoutes(app: FastifyInstance) {
  /**
   * POST /v1/keys — Create a new API key (admin only)
   * Returns the raw key ONCE — it cannot be retrieved again.
   */
  app.post<{ Body: CreateKeyRequest; Reply: CreateKeyResponse | ErrorResponse }>(
    '/v1/keys',
    {
      preHandler: requireRole('admin'),
      schema: {
        body: CreateKeyRequestSchema,
        response: {
          201: CreateKeyResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
        tags: ['Keys'],
        summary: 'Create API key',
        description: 'Creates a new gateway API key for the authenticated tenant. Returns the raw key ONCE.',
        security: [{ BearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { tenantId } = request.tenantContext!
      const body = CreateKeyRequestSchema.parse(request.body)

      try {
        const rawKey    = `gw_${randomBytes(24).toString('hex')}`
        const keyPrefix = rawKey.substring(0, 9)
        const keyHash   = await bcrypt.hash(rawKey, 10)

        const [newKey] = await db
          .insert(apiKeys)
          .values({ tenantId, keyHash, keyPrefix, role: body.role ?? 'user', name: body.name ?? null, revoked: false })
          .returning({ id: apiKeys.id, keyPrefix: apiKeys.keyPrefix, role: apiKeys.role, name: apiKeys.name, createdAt: apiKeys.createdAt })

        return reply.code(201).send({
          id: newKey.id,
          key: rawKey,
          keyPrefix: newKey.keyPrefix,
          role: newKey.role,
          name: newKey.name,
          createdAt: newKey.createdAt.toISOString(),
        })
      } catch (error) {
        console.error('[Keys] Error creating API key:', error)
        return reply.code(500).send({ error: { code: 'key_creation_failed', message: 'Failed to create API key', requestId: request.id } })
      }
    }
  )

  /**
   * GET /v1/keys — List all API keys for the tenant (admin + member, not guest)
   */
  app.get<{ Reply: { keys: KeyMetadata[] } | ErrorResponse }>(
    '/v1/keys',
    {
      preHandler: requireRole('admin', 'member', 'user', 'viewer'),
      schema: {
        response: { 401: ErrorResponseSchema, 403: ErrorResponseSchema, 500: ErrorResponseSchema },
        tags: ['Keys'],
        summary: 'List API keys',
        description: 'Returns all API keys for the authenticated tenant. Keys are masked — only prefix and metadata shown.',
        security: [{ BearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { tenantId } = request.tenantContext!

      try {
        const keys = await db
          .select({ id: apiKeys.id, keyPrefix: apiKeys.keyPrefix, role: apiKeys.role, name: apiKeys.name, revoked: apiKeys.revoked, lastUsed: apiKeys.lastUsed, createdAt: apiKeys.createdAt })
          .from(apiKeys)
          .where(eq(apiKeys.tenantId, tenantId))
          .orderBy(apiKeys.createdAt)

        return {
          keys: keys.map(k => ({
            id: k.id,
            keyPrefix: k.keyPrefix,
            role: k.role,
            name: k.name,
            revoked: k.revoked,
            lastUsed: k.lastUsed?.toISOString() ?? null,
            createdAt: k.createdAt.toISOString(),
          })),
        }
      } catch (error) {
        console.error('[Keys] Error listing API keys:', error)
        return reply.code(500).send({ error: { code: 'key_list_failed', message: 'Failed to list API keys', requestId: request.id } })
      }
    }
  )

  /**
   * DELETE /v1/keys/:id — Revoke an API key (admin only)
   */
  app.delete<{ Params: { id: string }; Reply: any | ErrorResponse }>(
    '/v1/keys/:id',
    {
      preHandler: requireRole('admin'),
      schema: {
        response: { 401: ErrorResponseSchema, 403: ErrorResponseSchema, 404: ErrorResponseSchema, 500: ErrorResponseSchema },
        tags: ['Keys'],
        summary: 'Revoke API key',
        description: 'Revokes an API key. Revoked keys are rejected immediately.',
        security: [{ BearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { tenantId } = request.tenantContext!
      const { id } = request.params as { id: string }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(id)) {
        return reply.code(404).send({ error: { code: 'key_not_found', message: 'API key not found', requestId: request.id } })
      }

      try {
        const [revokedKey] = await db
          .update(apiKeys)
          .set({ revoked: true })
          .where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId)))
          .returning({ id: apiKeys.id, keyPrefix: apiKeys.keyPrefix })

        if (!revokedKey) {
          return reply.code(404).send({ error: { code: 'key_not_found', message: 'API key not found or does not belong to your tenant', requestId: request.id } })
        }

        return { id: revokedKey.id, keyPrefix: revokedKey.keyPrefix, revoked: true, message: 'API key revoked successfully' }
      } catch (error) {
        console.error('[Keys] Error revoking API key:', error)
        return reply.code(500).send({ error: { code: 'key_revocation_failed', message: 'Failed to revoke API key', requestId: request.id } })
      }
    }
  )
}
