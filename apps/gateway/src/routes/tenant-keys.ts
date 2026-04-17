import { FastifyInstance } from 'fastify'
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
  app.post('/v1/tenant/keys', {
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

    // Validate request body
    if (!body.provider || !body.apiKey) {
      return reply.code(400).send({
        error: {
          code: 'invalid_request',
          message: 'provider and apiKey are required',
          requestId: request.id,
        },
      })
    }

    const { provider, apiKey } = body

    // Validate provider
    const validProviders = ['openai', 'anthropic', 'google', 'cohere', 'mistral']
    if (!validProviders.includes(provider)) {
      return reply.code(400).send({
        error: {
          code: 'invalid_provider',
          message: `Invalid provider. Must be one of: ${validProviders.join(', ')}`,
          requestId: request.id,
          validProviders,
        },
      })
    }

    try {
      // Store encrypted key
      const result = await storeTenantLLMKey(
        tenantId,
        provider as 'openai' | 'anthropic' | 'google' | 'cohere' | 'mistral',
        apiKey
      )

      console.log(
        `[TenantKeys] Stored BYOK key: tenant=${tenantId}, ` +
        `provider=${provider}, masked=${result.apiKeyMasked}`
      )

      return reply.code(201).send({
        id: result.id,
        provider,
        keyPrefix: result.apiKeyMasked.substring(0, 5), // First 5 chars as prefix
        createdAt: result.createdAt.toISOString(),
        message: `${provider} API key added successfully`,
      })
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
  app.get('/v1/tenant/keys', async (request, reply) => {
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
  app.delete('/v1/tenant/keys/:provider', {
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

    const { tenantId, tenantTier } = request.tenantContext
    const { provider } = request.params as { provider: string }

    // Validate provider
    const validProviders = ['openai', 'anthropic', 'google', 'cohere', 'mistral']
    if (!validProviders.includes(provider)) {
      return reply.code(400).send({
        error: {
          code: 'invalid_provider',
          message: `Invalid provider. Must be one of: ${validProviders.join(', ')}`,
          requestId: request.id,
          validProviders,
        },
      })
    }

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
  app.put('/v1/tenant/keys/:provider', {
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
    const { provider } = request.params as { provider: string }
    const body = request.body as any

    // Validate request body
    if (!body.apiKey) {
      return reply.code(400).send({
        error: {
          code: 'invalid_request',
          message: 'apiKey is required',
          requestId: request.id,
        },
      })
    }

    const { apiKey } = body

    // Validate provider
    const validProviders = ['openai', 'anthropic', 'google', 'cohere', 'mistral']
    if (!validProviders.includes(provider)) {
      return reply.code(400).send({
        error: {
          code: 'invalid_provider',
          message: `Invalid provider. Must be one of: ${validProviders.join(', ')}`,
          requestId: request.id,
          validProviders,
        },
      })
    }

    try {
      // Update key (this automatically deactivates old keys for this provider)
      const result = await updateTenantLLMKey(
        tenantId,
        provider as 'openai' | 'anthropic' | 'google' | 'cohere' | 'mistral',
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
