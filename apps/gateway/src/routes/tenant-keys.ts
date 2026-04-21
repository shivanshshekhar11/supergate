import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  StoreTenantKeyRequestSchema,
  StoreTenantKeyResponseSchema,
  TenantKeyMetadataSchema,
  ErrorResponseSchema,
  type StoreTenantKeyRequest,
  type StoreTenantKeyResponse,
  type TenantKeyMetadata,
  type ErrorResponse,
} from '@llm-gateway/schemas'
import { requireRole } from '../middleware/auth'
import {
  storeTenantLLMKey,
  updateTenantLLMKey,
  listTenantLLMKeys,
  deleteTenantLLMKey,
} from '../lib/tenant-keys'


/**
 * Tenant BYOK (Bring Your Own Key) Management Routes
 * 
 * These routes manage tenant's LLM provider API keys
 * Used for BYOK (tenant provides their own OpenAI/Anthropic/etc keys)
 * 
 * All routes require 'admin' role
 */
export async function tenantKeyRoutes(app: FastifyInstance) {
  /**
   * Add tenant LLM provider key (BYOK)
   * POST /v1/tenant/keys
   * 
   * Stores an encrypted LLM provider API key for the tenant
   * Enables BYOK (Bring Your Own Key) functionality
   */
  app.post<{ Body: StoreTenantKeyRequest; Reply: StoreTenantKeyResponse | ErrorResponse }>(
    '/v1/tenant/keys',
    {
      preHandler: requireRole('admin'),
      schema: {
        body: StoreTenantKeyRequestSchema,
        response: {
          201: StoreTenantKeyResponseSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          409: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
        tags: ['Tenant Keys'],
        summary: 'Add tenant LLM provider key',
        description: 'Stores an encrypted LLM provider API key for the tenant. Enables BYOK (Bring Your Own Key) functionality.',
        security: [{ BearerAuth: [] }],
      },
    },
    async (request, reply) => {
    if (!request.tenantContext) {
      return reply.code(401).send({
        error: {
          code: 'not_authenticated',
          message: 'Authentication required',
          requestId: request.id,
        },
      } as any)
    }

    const { tenantId } = request.tenantContext
    const { provider, apiKey } = request.body

    try {
      // Store encrypted key
      const result = await storeTenantLLMKey(
        tenantId,
        provider,
        apiKey
      )

      console.log(
        `[TenantKeys] Stored BYOK key: tenant=${tenantId}, ` +
        `provider=${provider}, masked=${result.apiKeyMasked}`
      )

      const response: StoreTenantKeyResponse = {
        id: result.id,
        provider,
        apiKeyMasked: result.apiKeyMasked,
        createdAt: result.createdAt.toISOString(),
      }

      return reply.code(201).send(response)
    } catch (error: any) {
      console.error('[TenantKeys] Error storing key:', error)

      // Handle duplicate key error
      if (error.message?.includes('already exists')) {
        return reply.code(409).send({
          error: {
            code: 'key_already_exists',
            message: error.message,
            requestId: request.id,
          },
        })
      }

      // Handle validation errors
      if (error.message?.includes('Invalid')) {
        return reply.code(400).send({
          error: {
            code: 'invalid_api_key',
            message: error.message,
            requestId: request.id,
          },
        })
      }

      return reply.code(500).send({
        error: {
          code: 'key_storage_failed',
          message: 'Failed to store provider API key',
          requestId: request.id,
        },
      })
    }
  })

  /**
   * List tenant LLM provider keys
   * GET /v1/tenant/keys
   * 
   * Returns all BYOK keys for the tenant
   * Keys are masked for security
   */
  app.get<{ Reply: { keys: TenantKeyMetadata[] } | ErrorResponse }>(
    '/v1/tenant/keys',
    {
      preHandler: requireRole('admin', 'member', 'user', 'viewer'),
      schema: {
        response: {
          401: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
        tags: ['Tenant Keys'],
        summary: 'List tenant LLM provider keys',
        description: 'Returns all BYOK keys for the tenant. Keys are masked for security.',
        security: [{ BearerAuth: [] }],
      },
    },
    async (request, reply) => {
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
        const keys = await listTenantLLMKeys(tenantId)

        return {
          keys: keys.map((key) => ({
            id: key.id,
            provider: key.provider,
            apiKeyMasked: key.apiKeyMasked,
            isActive: key.isActive,
            lastUsed: key.lastUsed,
            createdAt: key.createdAt,
        })),
      }
    } catch (error) {
      console.error('[TenantKeys] Error listing keys:', error)
      return reply.code(500).send({
        error: {
          code: 'key_list_failed',
          message: 'Failed to list provider API keys',
          requestId: request.id,
        },
      })
    }
  })

  /**
   * Delete tenant LLM provider key
   * DELETE /v1/tenant/keys/:provider
   * 
   * Deactivates (soft deletes) a tenant's BYOK key for a specific provider
   * After deletion, requests will fall back to gateway keys (if tier allows)
   */
  app.delete<{ Params: { provider: string }; Reply: any | ErrorResponse }>(
    '/v1/tenant/keys/:provider',
    {
      preHandler: requireRole('admin'),
      schema: {
        params: z.object({
          provider: z.string(),
        }),
        response: {
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
        tags: ['Tenant Keys'],
        summary: 'Delete tenant LLM provider key',
        description: 'Deactivates (soft deletes) a tenant\'s BYOK key for a specific provider. After deletion, requests will fall back to gateway keys (if tier allows).',
        security: [{ BearerAuth: [] }],
      },
    },
    async (request, reply) => {
    if (!request.tenantContext) {
      return reply.code(401).send({
        error: {
          code: 'not_authenticated',
          message: 'Authentication required',
          requestId: request.id,
        },
      })
    }

    const { tenantId, tenantTier } = request.tenantContext
    const { provider } = request.params

    // Warn enterprise-independent tenants
    if (tenantTier === 'enterprise-independent') {
      console.warn(
        `[TenantKeys] Enterprise-independent tenant deleting BYOK key: ` +
        `tenant=${tenantId}, provider=${provider}. ` +
        `This will cause requests to fail (no gateway key fallback).`
      )
    }

    try {
      // Find the key ID for this provider
      const keys = await listTenantLLMKeys(tenantId)
      const keyToDelete = keys.find(
        (k) => k.provider === provider && k.isActive
      )

      if (!keyToDelete) {
        return reply.code(404).send({
          error: {
            code: 'key_not_found',
            message: `No active ${provider} key found for your tenant`,
            requestId: request.id,
          },
        })
      }

      // Delete (deactivate) the key
      const deleted = await deleteTenantLLMKey(tenantId, keyToDelete.id)

      if (!deleted) {
        return reply.code(404).send({
          error: {
            code: 'key_not_found',
            message: 'Key not found or already deleted',
            requestId: request.id,
          },
        })
      }

      console.log(
        `[TenantKeys] Deleted BYOK key: tenant=${tenantId}, ` +
        `provider=${provider}, keyId=${keyToDelete.id}`
      )

      const warningMessage =
        tenantTier === 'enterprise-independent'
          ? `Warning: As an enterprise-independent tenant, you must configure a new ${provider} key to use ${provider} models. Requests will fail until a new key is added.`
          : `Provider key deleted. Requests will now use gateway's ${provider} key as fallback.`

      return {
        provider,
        deleted: true,
        message: 'Provider API key deleted successfully',
        warning: warningMessage,
      }
    } catch (error) {
      console.error('[TenantKeys] Error deleting key:', error)
      return reply.code(500).send({
        error: {
          code: 'key_deletion_failed',
          message: 'Failed to delete provider API key',
          requestId: request.id,
        },
      })
    }
  })

  /**
   * Update tenant LLM provider key
   * PUT /v1/tenant/keys/:provider
   * 
   * Updates (replaces) a tenant's BYOK key for a specific provider
   * Useful for key rotation
   */
  app.put<{ Params: { provider: string }; Body: { apiKey: string }; Reply: any | ErrorResponse }>(
    '/v1/tenant/keys/:provider',
    {
      preHandler: requireRole('admin'),
      schema: {
        params: z.object({
          provider: z.string(),
        }),
        body: z.object({
          apiKey: z.string().min(20),
        }),
        response: {
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
        tags: ['Tenant Keys'],
        summary: 'Update tenant LLM provider key',
        description: 'Updates (replaces) a tenant\'s BYOK key for a specific provider. Useful for key rotation.',
        security: [{ BearerAuth: [] }],
      },
    },
    async (request, reply) => {
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
    const { provider } = request.params
    const { apiKey } = request.body

    try {
      // Update key (this automatically deactivates old keys for this provider)
      const result = await updateTenantLLMKey(
        tenantId,
        provider as any,
        apiKey
      )

      console.log(
        `[TenantKeys] Updated BYOK key: tenant=${tenantId}, ` +
        `provider=${provider}, masked=${result.apiKeyMasked}`
      )

      return {
        id: result.id,
        provider,
        apiKeyMasked: result.apiKeyMasked,
        createdAt: result.createdAt.toISOString(),
        message: 'Provider API key updated successfully',
      }
    } catch (error: any) {
      console.error('[TenantKeys] Error updating key:', error)

      // Handle validation errors
      if (error.message?.includes('Invalid')) {
        return reply.code(400).send({
          error: {
            code: 'invalid_api_key',
            message: error.message,
            requestId: request.id,
          },
        })
      }

      return reply.code(500).send({
        error: {
          code: 'key_update_failed',
          message: 'Failed to update provider API key',
          requestId: request.id,
        },
      })
    }
  })
}



