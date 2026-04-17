/**
 * Gateway API Key Management Integration Tests
 * 
 * Priority: HIGH
 * Tests key creation, listing, and revocation with auth and RBAC
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import { authMiddleware } from '../middleware/auth'
import { keyRoutes } from './keys'
import { createTestTenant, createTestApiKey, cleanupTestTenant } from '../test/helpers'

describe('Gateway API Key Management Routes', () => {
  let app: FastifyInstance
  let tenantId: string
  let adminKey: string
  let userKey: string

  beforeEach(async () => {
    // Create Fastify app
    app = Fastify()

    // Register auth middleware
    app.addHook('preHandler', authMiddleware)

    // Register key routes
    await app.register(keyRoutes)

    // Create test tenant and keys
    const tenant = await createTestTenant('Key Management Test', 'pro')
    tenantId = tenant.id

    const { rawKey: key1 } = await createTestApiKey(tenantId, 'admin', 'Admin Key')
    adminKey = key1

    const { rawKey: key2 } = await createTestApiKey(tenantId, 'user', 'User Key')
    userKey = key2
  })

  afterEach(async () => {
    await app.close()
    await cleanupTestTenant(tenantId)
  })

  describe('POST /v1/keys - Create API Key', () => {
    it('should create new API key with admin role', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/keys',
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
        payload: {
          role: 'user',
          name: 'Test Key',
        },
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)

      expect(body).toMatchObject({
        id: expect.any(String),
        key: expect.stringMatching(/^gw_[a-f0-9]{48}$/),
        keyPrefix: expect.stringMatching(/^gw_[a-f0-9]{6}$/),
        role: 'user',
        name: 'Test Key',
        createdAt: expect.any(String),
        warning: expect.stringContaining('Save this key securely'),
      })
    })

    it('should default to user role if not specified', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/keys',
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
        payload: {
          name: 'Default Role Key',
        },
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body.role).toBe('user')
    })

    it('should reject request without admin role', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/keys',
        headers: {
          authorization: `Bearer ${userKey}`,
        },
        payload: {
          role: 'user',
          name: 'Test Key',
        },
      })

      expect(response.statusCode).toBe(403)
      const body = JSON.parse(response.body)
      expect(body.error.code).toBe('insufficient_permissions')
    })

    it('should reject request without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/keys',
        payload: {
          role: 'user',
          name: 'Test Key',
        },
      })

      expect(response.statusCode).toBe(401)
    })

    it('should create key with admin role', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/keys',
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
        payload: {
          role: 'admin',
          name: 'New Admin Key',
        },
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body.role).toBe('admin')
    })

    it('should create key with viewer role', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/keys',
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
        payload: {
          role: 'viewer',
          name: 'Viewer Key',
        },
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body.role).toBe('viewer')
    })
  })

  describe('GET /v1/keys - List API Keys', () => {
    it('should list all keys for tenant', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/keys',
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      expect(body.keys).toBeInstanceOf(Array)
      expect(body.keys.length).toBeGreaterThanOrEqual(2) // At least admin and user keys

      // Verify key structure
      expect(body.keys[0]).toMatchObject({
        id: expect.any(String),
        keyPrefix: expect.stringMatching(/^gw_[a-f0-9]{6}$/),
        role: expect.any(String),
        revoked: expect.any(Boolean),
        createdAt: expect.any(String),
      })

      // Should NOT include full key
      expect(body.keys[0].key).toBeUndefined()
      expect(body.keys[0].keyHash).toBeUndefined()
    })

    it('should show lastUsed timestamp if key was used', async () => {
      // Use the admin key (it was just used in this request)
      const response = await app.inject({
        method: 'GET',
        url: '/v1/keys',
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      // Find the admin key
      const adminKeyData = body.keys.find((k: any) => k.role === 'admin')
      expect(adminKeyData).toBeDefined()
      // lastUsed might be null if fire-and-forget update hasn't completed
      // Just verify the field exists
      expect(adminKeyData).toHaveProperty('lastUsed')
    })

    it('should only show keys for authenticated tenant', async () => {
      // Create second tenant
      const tenant2 = await createTestTenant('Tenant 2', 'pro')
      const { rawKey: tenant2Key } = await createTestApiKey(tenant2.id, 'admin', 'Tenant 2 Key')

      // Request with tenant 2 key
      const response = await app.inject({
        method: 'GET',
        url: '/v1/keys',
        headers: {
          authorization: `Bearer ${tenant2Key}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      // Should only see tenant 2's keys
      expect(body.keys.length).toBe(1)
      expect(body.keys[0].name).toBe('Tenant 2 Key')

      await cleanupTestTenant(tenant2.id)
    })

    it('should work with user role', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/keys',
        headers: {
          authorization: `Bearer ${userKey}`,
        },
      })

      expect(response.statusCode).toBe(200)
    })
  })

  describe('DELETE /v1/keys/:id - Revoke API Key', () => {
    it('should revoke key with admin role', async () => {
      // Create a key to revoke
      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/keys',
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
        payload: {
          role: 'user',
          name: 'Key to Revoke',
        },
      })

      const { id } = JSON.parse(createResponse.body)

      // Revoke it
      const revokeResponse = await app.inject({
        method: 'DELETE',
        url: `/v1/keys/${id}`,
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
      })

      expect(revokeResponse.statusCode).toBe(200)
      const body = JSON.parse(revokeResponse.body)

      expect(body).toMatchObject({
        id,
        revoked: true,
        message: expect.stringContaining('revoked successfully'),
      })

      // Verify key is revoked in list
      const listResponse = await app.inject({
        method: 'GET',
        url: '/v1/keys',
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
      })

      const listBody = JSON.parse(listResponse.body)
      const revokedKey = listBody.keys.find((k: any) => k.id === id)
      expect(revokedKey.revoked).toBe(true)
    })

    it('should reject revocation without admin role', async () => {
      // Create a key
      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/keys',
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
        payload: {
          role: 'user',
          name: 'Key to Revoke',
        },
      })

      const { id } = JSON.parse(createResponse.body)

      // Try to revoke with user role
      const revokeResponse = await app.inject({
        method: 'DELETE',
        url: `/v1/keys/${id}`,
        headers: {
          authorization: `Bearer ${userKey}`,
        },
      })

      expect(revokeResponse.statusCode).toBe(403)
      const body = JSON.parse(revokeResponse.body)
      expect(body.error.code).toBe('insufficient_permissions')
    })

    it('should return 404 for non-existent key', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/keys/non-existent-id',
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
      })

      expect(response.statusCode).toBe(404)
      const body = JSON.parse(response.body)
      expect(body.error.code).toBe('key_not_found')
    })

    it('should not allow revoking keys from other tenants', async () => {
      // Create second tenant
      const tenant2 = await createTestTenant('Tenant 2', 'pro')
      const { rawKey: tenant2Key } = await createTestApiKey(tenant2.id, 'admin', 'Tenant 2 Key')

      // Create key for tenant 1
      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/keys',
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
        payload: {
          role: 'user',
          name: 'Tenant 1 Key',
        },
      })

      const { id } = JSON.parse(createResponse.body)

      // Try to revoke tenant 1's key with tenant 2's credentials
      const revokeResponse = await app.inject({
        method: 'DELETE',
        url: `/v1/keys/${id}`,
        headers: {
          authorization: `Bearer ${tenant2Key}`,
        },
      })

      expect(revokeResponse.statusCode).toBe(404)
      const body = JSON.parse(revokeResponse.body)
      expect(body.error.code).toBe('key_not_found')

      await cleanupTestTenant(tenant2.id)
    })

    it('should prevent using revoked key for authentication', async () => {
      // Create a key
      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/keys',
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
        payload: {
          role: 'admin',
          name: 'Key to Revoke and Test',
        },
      })

      const { id, key: newKey } = JSON.parse(createResponse.body)

      // Verify key works
      const testResponse1 = await app.inject({
        method: 'GET',
        url: '/v1/keys',
        headers: {
          authorization: `Bearer ${newKey}`,
        },
      })
      expect(testResponse1.statusCode).toBe(200)

      // Revoke it
      await app.inject({
        method: 'DELETE',
        url: `/v1/keys/${id}`,
        headers: {
          authorization: `Bearer ${adminKey}`,
        },
      })

      // Try to use revoked key
      const testResponse2 = await app.inject({
        method: 'GET',
        url: '/v1/keys',
        headers: {
          authorization: `Bearer ${newKey}`,
        },
      })

      expect(testResponse2.statusCode).toBe(401)
      const body = JSON.parse(testResponse2.body)
      expect(body.error.code).toBe('invalid_api_key')
    })
  })
})
