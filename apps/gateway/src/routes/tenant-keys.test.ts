/**
 * Tenant BYOK Key Management Integration Tests
 * 
 * Priority: HIGH
 * Tests tenant LLM key management (BYOK) with encryption
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import { fastifyZodOpenApiPlugin, serializerCompiler, validatorCompiler } from 'fastify-zod-openapi'
import { authMiddleware } from '../middleware/auth'
import { tenantKeyRoutes } from './tenant-keys'
import { createTestTenant, createTestApiKey, cleanupTestTenant, generateTestApiKey } from '../test/helpers'
import { db } from '../db/client'
import { tenantLLMKeys } from '../db/schema'
import { eq } from 'drizzle-orm'

describe('Tenant BYOK Key Management Routes', () => {
  let app: FastifyInstance
  let tenantId: string
  let adminKey: string
  let userKey: string

  beforeEach(async () => {
    // Create Fastify app
    app = Fastify()

    // Register Zod OpenAPI plugin
    await app.register(fastifyZodOpenApiPlugin)
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)

    // Add custom error handler for validation errors
    app.setErrorHandler((error: any, request, reply) => {
      // Handle validation errors
      if (error.validation) {
        return reply.code(400).send({
          error: {
            code: 'validation_error',
            message: error.message || 'Request validation failed',
            requestId: request.id,
            details: error.validation,
          },
        })
      }

      // Handle other Fastify errors
      if (error.statusCode) {
        return reply.code(error.statusCode).send({
          error: {
            code: error.code || 'internal_error',
            message: error.message,
            requestId: request.id,
          },
        })
      }

      // Handle unknown errors
      return reply.code(500).send({
        error: {
          code: 'internal_error',
          message: 'An unexpected error occurred',
          requestId: request.id,
        },
      })
    })

    // Register auth middleware
    app.addHook('preHandler', authMiddleware)

    // Register tenant key routes
    await app.register(tenantKeyRoutes)

    // Create test tenant and keys
    const tenant = await createTestTenant('BYOK Test', 'pro')
    tenantId = tenant.id

    const { rawKey: key1 } = await createTestApiKey(tenantId, 'admin', 'Admin Key')
    adminKey = key1

    const { rawKey: key2 } = await createTestApiKey(tenantId, 'user', 'User Key')
    userKey = key2
  })

  afterEach(async () => {
    await app.close()
    // Clean up tenant keys
    await db.delete(tenantLLMKeys).where(eq(tenantLLMKeys.tenantId, tenantId))
    await cleanupTestTenant(tenantId)
  })

  describe('POST /v1/tenant/keys - Add Provider Key', () => {
    it('should add OpenAI key with admin role', async () => {
      const testKey = generateTestApiKey('openai')
      
      const response = await app.inject({
        method: 'POST',
        url: '/v1/tenant/keys',
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
        payload: {
          provider: 'openai',
          apiKey: testKey,
        },
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)

      expect(body).toMatchObject({
        provider: 'openai',
        apiKeyMasked: expect.stringContaining(testKey.substring(0, 5)),
        createdAt: expect.any(String),
      })

      // Verify key is encrypted in database
      const [storedKey] = await db
        .select()
        .from(tenantLLMKeys)
        .where(eq(tenantLLMKeys.tenantId, tenantId))

      expect(storedKey).toBeDefined()
      expect(storedKey.provider).toBe('openai')
      expect(storedKey.apiKeyEncrypted).toBeDefined()
      expect(storedKey.iv).toBeDefined()
      // Should NOT store plaintext
      expect(storedKey.apiKeyEncrypted).not.toContain(testKey)
    })

    it('should add Anthropic key', async () => {
      const testKey = generateTestApiKey('anthropic')
      
      const response = await app.inject({
        method: 'POST',
        url: '/v1/tenant/keys',
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
        payload: {
          provider: 'anthropic',
          apiKey: testKey,
        },
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body.provider).toBe('anthropic')
      expect(body.apiKeyMasked).toContain(testKey.substring(0, 5))
    })

    it('should reject request without admin role', async () => {
      const testKey = generateTestApiKey('openai')
      
      const response = await app.inject({
        method: 'POST',
        url: '/v1/tenant/keys',
        headers: {
          authorization: `Bearer ${userKey}`,
        },
        payload: {
          provider: 'openai',
          apiKey: testKey,
        },
      })

      expect(response.statusCode).toBe(403)
      const body = JSON.parse(response.body)
      expect(body.error.code).toBe('insufficient_permissions')
    })

    it('should reject duplicate provider key', async () => {
      const testKey1 = generateTestApiKey('openai')
      const testKey2 = generateTestApiKey('openai')
      
      // Add first key
      await app.inject({
        method: 'POST',
        url: '/v1/tenant/keys',
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
        payload: {
          provider: 'openai',
          apiKey: testKey1,
        },
      })

      // Try to add second key for same provider
      const response = await app.inject({
        method: 'POST',
        url: '/v1/tenant/keys',
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
        payload: {
          provider: 'openai',
          apiKey: testKey2,
        },
      })

      expect(response.statusCode).toBe(409)
      const body = JSON.parse(response.body)
      expect(body.error.code).toBe('key_already_exists')
    })

    it('should reject invalid provider', async () => {
      const testKey = generateTestApiKey('openai')
      
      const response = await app.inject({
        method: 'POST',
        url: '/v1/tenant/keys',
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
        payload: {
          provider: 'invalid-provider',
          apiKey: testKey,
        },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('GET /v1/tenant/keys - List Provider Keys', () => {
    beforeEach(async () => {
      // Add some keys
      await app.inject({
        method: 'POST',
        url: '/v1/tenant/keys',
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
        payload: {
          provider: 'openai',
          apiKey: generateTestApiKey('openai'),
        },
      })

      await app.inject({
        method: 'POST',
        url: '/v1/tenant/keys',
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
        payload: {
          provider: 'anthropic',
          apiKey: generateTestApiKey('anthropic'),
        },
      })
    })

    it('should list all provider keys for tenant', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/tenant/keys',
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      expect(body.keys).toBeInstanceOf(Array)
      expect(body.keys.length).toBe(2)

      // Verify structure
      expect(body.keys[0]).toMatchObject({
        provider: expect.any(String),
        apiKeyMasked: expect.any(String),
        isActive: expect.any(Boolean),
        createdAt: expect.any(String),
      })

      // Should NOT include encrypted key or IV
      expect(body.keys[0].apiKeyEncrypted).toBeUndefined()
      expect(body.keys[0].iv).toBeUndefined()
    })

    it('should work with user role', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/tenant/keys',
        headers: {
          authorization: `Bearer ${userKey}`,
        },
      })

      expect(response.statusCode).toBe(200)
    })

    it('should only show keys for authenticated tenant', async () => {
      // Create second tenant
      const tenant2 = await createTestTenant('Tenant 2', 'pro')
      const { rawKey: tenant2Key } = await createTestApiKey(tenant2.id, 'admin', 'Tenant 2 Key')

      // Add key for tenant 2
      await app.inject({
        method: 'POST',
        url: '/v1/tenant/keys',
        headers: {
          authorization: `Bearer ${tenant2Key}`,
        },
        payload: {
          provider: 'openai',
          apiKey: generateTestApiKey('openai'),
        },
      })

      // Request with tenant 2 key
      const response = await app.inject({
        method: 'GET',
        url: '/v1/tenant/keys',
        headers: {
          authorization: `Bearer ${tenant2Key}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      // Should only see tenant 2's keys
      expect(body.keys.length).toBe(1)

      await db.delete(tenantLLMKeys).where(eq(tenantLLMKeys.tenantId, tenant2.id))
      await cleanupTestTenant(tenant2.id)
    })
  })

  describe('PUT /v1/tenant/keys/:provider - Update Provider Key', () => {
    beforeEach(async () => {
      // Add initial key
      await app.inject({
        method: 'POST',
        url: '/v1/tenant/keys',
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
        payload: {
          provider: 'openai',
          apiKey: generateTestApiKey('openai'),
        },
      })
    })

    it('should update existing provider key with admin role', async () => {
      const newKey = generateTestApiKey('openai')
      
      const response = await app.inject({
        method: 'PUT',
        url: '/v1/tenant/keys/openai',
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
        payload: {
          apiKey: newKey,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      expect(body).toMatchObject({
        provider: 'openai',
        apiKeyMasked: expect.any(String),
        createdAt: expect.any(String),
        message: expect.stringContaining('updated successfully'),
      })

      // Verify key was updated in database
      const keys = await db
        .select()
        .from(tenantLLMKeys)
        .where(eq(tenantLLMKeys.tenantId, tenantId))

      // Should have deactivated old key and created new one
      expect(keys.length).toBe(2)
      const activeKeys = keys.filter(k => k.isActive)
      expect(activeKeys.length).toBe(1)
      expect(activeKeys[0].provider).toBe('openai')
    })

    it('should reject update without admin role', async () => {
      const newKey = generateTestApiKey('openai')
      
      const response = await app.inject({
        method: 'PUT',
        url: '/v1/tenant/keys/openai',
        headers: {
          authorization: `Bearer ${userKey}`,
        },
        payload: {
          apiKey: newKey,
        },
      })

      expect(response.statusCode).toBe(403)
    })

    it('should create new key if provider does not exist', async () => {
      const newKey = generateTestApiKey('google')
      
      const response = await app.inject({
        method: 'PUT',
        url: '/v1/tenant/keys/google',
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
        payload: {
          apiKey: newKey,
        },
      })

      // PUT should work like upsert - create if doesn't exist
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.provider).toBe('google')
    })
  })

  describe('DELETE /v1/tenant/keys/:provider - Delete Provider Key', () => {
    beforeEach(async () => {
      // Add keys
      await app.inject({
        method: 'POST',
        url: '/v1/tenant/keys',
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
        payload: {
          provider: 'openai',
          apiKey: generateTestApiKey('openai'),
        },
      })
    })

    it('should delete provider key with admin role', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/tenant/keys/openai',
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      expect(body).toMatchObject({
        provider: 'openai',
        message: expect.stringContaining('deleted successfully'),
      })

      // Verify key was deactivated (soft delete)
      const keys = await db
        .select()
        .from(tenantLLMKeys)
        .where(eq(tenantLLMKeys.tenantId, tenantId))

      // Key still exists but is inactive
      expect(keys.length).toBe(1)
      expect(keys[0].isActive).toBe(false)
    })

    it('should reject deletion without admin role', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/tenant/keys/openai',
        headers: {
          authorization: `Bearer ${userKey}`,
        },
      })

      expect(response.statusCode).toBe(403)
    })

    it('should return 404 for non-existent provider', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/tenant/keys/google',
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
      })

      expect(response.statusCode).toBe(404)
      const body = JSON.parse(response.body)
      expect(body.error.code).toBe('key_not_found')
    })

    it('should not allow deleting keys from other tenants', async () => {
      // Create second tenant
      const tenant2 = await createTestTenant('Tenant 2', 'pro')
      const { rawKey: tenant2Key } = await createTestApiKey(tenant2.id, 'admin', 'Tenant 2 Key')

      // Try to delete tenant 1's key with tenant 2's credentials
      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/tenant/keys/openai',
        headers: {
          authorization: `Bearer ${tenant2Key}`,
        },
      })

      expect(response.statusCode).toBe(404)

      // Verify tenant 1's key still exists and is active
      const keys = await db
        .select()
        .from(tenantLLMKeys)
        .where(eq(tenantLLMKeys.tenantId, tenantId))

      expect(keys.length).toBe(1)
      expect(keys[0].isActive).toBe(true)

      await cleanupTestTenant(tenant2.id)
    })
  })

  describe('Encryption Security', () => {
    it('should never store plaintext keys', async () => {
      const plaintextKey = generateTestApiKey('openai')

      await app.inject({
        method: 'POST',
        url: '/v1/tenant/keys',
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
        payload: {
          provider: 'openai',
          apiKey: plaintextKey,
        },
      })

      // Query database directly
      const [storedKey] = await db
        .select()
        .from(tenantLLMKeys)
        .where(eq(tenantLLMKeys.tenantId, tenantId))

      // Verify plaintext is not stored
      expect(storedKey.apiKeyEncrypted).not.toBe(plaintextKey)
      expect(storedKey.apiKeyEncrypted).not.toContain(plaintextKey)

      // Verify encryption fields are present
      expect(storedKey.apiKeyEncrypted).toBeDefined()
      expect(storedKey.iv).toBeDefined()
    })

    it('should use different IV for each key', async () => {
      // Add two keys
      await app.inject({
        method: 'POST',
        url: '/v1/tenant/keys',
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
        payload: {
          provider: 'openai',
          apiKey: generateTestApiKey('openai'),
        },
      })

      await app.inject({
        method: 'POST',
        url: '/v1/tenant/keys',
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
        payload: {
          provider: 'anthropic',
          apiKey: generateTestApiKey('anthropic'),
        },
      })

      // Query database
      const keys = await db
        .select()
        .from(tenantLLMKeys)
        .where(eq(tenantLLMKeys.tenantId, tenantId))

      expect(keys.length).toBe(2)

      // IVs should be different
      expect(keys[0].iv).not.toBe(keys[1].iv)

      // Encrypted values should be different
      expect(keys[0].apiKeyEncrypted).not.toBe(keys[1].apiKeyEncrypted)
    })
  })
})
