import { FastifyInstance } from 'fastify'
import { db } from '../db/client'
import { apiKeys } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { requireRole } from '../middleware/auth'

/**
 * Gateway API Key Management Routes
 * 
 * These routes manage the gateway authentication keys (gw_...)
 * Used for authenticating requests to the gateway
 * 
 * All routes require 'admin' role
 */
export async function keyRoutes(app: FastifyInstance) {
  /**
   * Create new API key
   * POST /v1/keys
   * 
   * Generates a new gateway API key for the authenticated tenant
   * Returns the raw key ONCE - it cannot be retrieved again
   */
  app.post('/v1/keys', {
    preHandler: requireRole('admin'),
  }, async (request, reply) => {
    if (!request.tenantContext) {
      return reply.code(401).send({
        error: {
          code: 'not_authenticated',
          message: 'Authentication required',
          requestId: request.id,
        },
      })
    }

    const { tenantId } = request.tenantContext
    const body = request.body as any

    try {
      // Generate raw API key: gw_ + 48 hex characters
      const rawKey = `gw_${randomBytes(24).toString('hex')}`
      const keyPrefix = rawKey.substring(0, 9) // "gw_abc123"
      
      // Hash the key with bcrypt
      const keyHash = await bcrypt.hash(rawKey, 10)

      // Insert into database
      const [newKey] = await db
        .insert(apiKeys)
        .values({
          tenantId,
          keyHash,
          keyPrefix,
          role: body.role || 'user', // Default to 'user' role
          name: body.name || null,
          revoked: false,
        })
        .returning({
          id: apiKeys.id,
          keyPrefix: apiKeys.keyPrefix,
          role: apiKeys.role,
          name: apiKeys.name,
          createdAt: apiKeys.createdAt,
        })

      console.log(
        `[Keys] Created new API key: tenant=${tenantId}, ` +
        `prefix=${keyPrefix}, role=${newKey.role}`
      )

      // Return raw key ONCE
      return reply.code(201).send({
        id: newKey.id,
        key: rawKey, // ⚠️ Only shown once!
        keyPrefix: newKey.keyPrefix,
        role: newKey.role,
        name: newKey.name,
        createdAt: newKey.createdAt,
        warning: 'Save this key securely. It cannot be retrieved again.',
      })
    } catch (error) {
      console.error('[Keys] Error creating API key:', error)
      return reply.code(500).send({
        error: {
          code: 'key_creation_failed',
          message: 'Failed to create API key',
          requestId: request.id,
        },
      })
    }
  })

  /**
   * List API keys
   * GET /v1/keys
   * 
   * Returns all API keys for the authenticated tenant
   * Keys are masked - only prefix and metadata shown
   */
  app.get('/v1/keys', async (request, reply) => {
    if (!request.tenantContext) {
      return reply.code(401).send({
        error: {
          code: 'not_authenticated',
          message: 'Authentication required',
          requestId: request.id,
        },
      })
    }

    const { tenantId } = request.tenantContext

    try {
      const keys = await db
        .select({
          id: apiKeys.id,
          keyPrefix: apiKeys.keyPrefix,
          role: apiKeys.role,
          name: apiKeys.name,
          revoked: apiKeys.revoked,
          lastUsed: apiKeys.lastUsed,
          createdAt: apiKeys.createdAt,
        })
        .from(apiKeys)
        .where(eq(apiKeys.tenantId, tenantId))
        .orderBy(apiKeys.createdAt)

      return {
        keys: keys.map((key) => ({
          id: key.id,
          keyPrefix: key.keyPrefix,
          role: key.role,
          name: key.name,
          revoked: key.revoked,
          lastUsed: key.lastUsed?.toISOString() || null,
          createdAt: key.createdAt.toISOString(),
        })),
      }
    } catch (error) {
      console.error('[Keys] Error listing API keys:', error)
      return reply.code(500).send({
        error: {
          code: 'key_list_failed',
          message: 'Failed to list API keys',
          requestId: request.id,
        },
      })
    }
  })

  /**
   * Revoke API key
   * DELETE /v1/keys/:id
   * 
   * Revokes (soft deletes) an API key
   * Revoked keys cannot be used for authentication
   * 
   * Requires 'admin' role
   */
  app.delete('/v1/keys/:id', {
    preHandler: requireRole('admin'),
  }, async (request, reply) => {
    if (!request.tenantContext) {
      return reply.code(401).send({
        error: {
          code: 'not_authenticated',
          message: 'Authentication required',
          requestId: request.id,
        },
      })
    }

    const { tenantId } = request.tenantContext
    const { id } = request.params as { id: string }

    // Validate UUID format to avoid SQL errors
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return reply.code(404).send({
        error: {
          code: 'key_not_found',
          message: 'API key not found or does not belong to your tenant',
          requestId: request.id,
        },
      })
    }

    try {
      // Revoke key (soft delete)
      const [revokedKey] = await db
        .update(apiKeys)
        .set({ revoked: true })
        .where(
          and(
            eq(apiKeys.id, id),
            eq(apiKeys.tenantId, tenantId) // Ensure tenant owns this key
          )
        )
        .returning({
          id: apiKeys.id,
          keyPrefix: apiKeys.keyPrefix,
        })

      if (!revokedKey) {
        return reply.code(404).send({
          error: {
            code: 'key_not_found',
            message: 'API key not found or does not belong to your tenant',
            requestId: request.id,
          },
        })
      }

      console.log(
        `[Keys] Revoked API key: tenant=${tenantId}, ` +
        `keyId=${id}, prefix=${revokedKey.keyPrefix}`
      )

      return {
        id: revokedKey.id,
        keyPrefix: revokedKey.keyPrefix,
        revoked: true,
        message: 'API key revoked successfully',
      }
    } catch (error) {
      console.error('[Keys] Error revoking API key:', error)
      return reply.code(500).send({
        error: {
          code: 'key_revocation_failed',
          message: 'Failed to revoke API key',
          requestId: request.id,
        },
      })
    }
  })
}
