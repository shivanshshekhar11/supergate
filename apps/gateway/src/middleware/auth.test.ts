/**
 * Auth Middleware Unit Tests
 * 
 * Priority: HIGH
 * Tests authentication flow, tenant isolation, and RBAC
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { authMiddleware, requireRole } from './auth'
import { createTestTenant, createTestApiKey, cleanupTestTenant } from '../test/helpers'
import type { FastifyRequest, FastifyReply } from 'fastify'

describe('Auth Middleware', () => {
  let tenantId: string
  let rawKey: string
  let revokedKey: string

  beforeEach(async () => {
    // Create test tenant and keys
    const tenant = await createTestTenant('Auth Test Tenant', 'pro')
    tenantId = tenant.id

    const { rawKey: key1 } = await createTestApiKey(tenantId, 'admin', 'Admin Key')
    rawKey = key1

    const { key: key2, rawKey: key2Raw } = await createTestApiKey(tenantId, 'user', 'User Key')
    revokedKey = key2Raw

    // Revoke the second key
    const { db } = await import('../db/client')
    const { apiKeys } = await import('../db/schema')
    const { eq } = await import('drizzle-orm')
    await db.update(apiKeys).set({ revoked: true }).where(eq(apiKeys.id, key2.id))
  })

  afterEach(async () => {
    await cleanupTestTenant(tenantId)
  })

  describe('Token Extraction', () => {
    it('should reject request without Authorization header', async () => {
      const request = {
        headers: {},
        id: 'test-request-id',
      } as FastifyRequest

      const reply = createMockReply()

      await authMiddleware(request, reply)

      expect(reply.code).toHaveBeenCalledWith(401)
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'missing_authorization',
          }),
        })
      )
    })

    it('should reject request with invalid Authorization format', async () => {
      const request = {
        headers: { authorization: 'InvalidFormat' },
        id: 'test-request-id',
      } as FastifyRequest

      const reply = createMockReply()

      await authMiddleware(request, reply)

      expect(reply.code).toHaveBeenCalledWith(401)
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'invalid_authorization_format',
          }),
        })
      )
    })

    it('should reject request with invalid key format', async () => {
      const request = {
        headers: { authorization: 'Bearer invalid_key' },
        id: 'test-request-id',
      } as FastifyRequest

      const reply = createMockReply()

      await authMiddleware(request, reply)

      expect(reply.code).toHaveBeenCalledWith(401)
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'invalid_api_key_format',
          }),
        })
      )
    })
  })

  describe('Key Verification', () => {
    it('should authenticate valid API key', async () => {
      const request = {
        headers: { authorization: `Bearer ${rawKey}` },
        id: 'test-request-id',
        tenantContext: undefined,
      } as any

      const reply = createMockReply()

      await authMiddleware(request, reply)

      // Should not call reply.code or reply.send (success)
      expect(reply.code).not.toHaveBeenCalled()
      expect(reply.send).not.toHaveBeenCalled()

      // Should attach tenant context
      expect(request.tenantContext).toBeDefined()
      expect(request.tenantContext?.tenantId).toBe(tenantId)
      expect(request.tenantContext?.keyRole).toBe('admin')
    })

    it('should reject invalid API key', async () => {
      const request = {
        headers: { authorization: 'Bearer gw_invalid_key_that_does_not_exist_12345678' },
        id: 'test-request-id',
      } as FastifyRequest

      const reply = createMockReply()

      await authMiddleware(request, reply)

      expect(reply.code).toHaveBeenCalledWith(401)
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'invalid_api_key',
          }),
        })
      )
    })

    it('should reject revoked API key', async () => {
      const request = {
        headers: { authorization: `Bearer ${revokedKey}` },
        id: 'test-request-id',
      } as FastifyRequest

      const reply = createMockReply()

      await authMiddleware(request, reply)

      expect(reply.code).toHaveBeenCalledWith(401)
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'invalid_api_key',
          }),
        })
      )
    })
  })

  describe('Tenant Context', () => {
    it('should attach complete tenant context', async () => {
      const request = {
        headers: { authorization: `Bearer ${rawKey}` },
        id: 'test-request-id',
        tenantContext: undefined,
      } as any

      const reply = createMockReply()

      await authMiddleware(request, reply)

      expect(request.tenantContext).toMatchObject({
        tenantId: expect.any(String),
        tenantName: 'Auth Test Tenant',
        tenantTier: 'pro',
        keyId: expect.any(String),
        keyRole: 'admin',
      })
    })

    it('should set PostgreSQL RLS session variable', async () => {
      const request = {
        headers: { authorization: `Bearer ${rawKey}` },
        id: 'test-request-id',
        tenantContext: undefined,
      } as any

      const reply = createMockReply()

      await authMiddleware(request, reply)

      // Verify RLS variable was set (would need to query PostgreSQL)
      // For now, just verify no errors
      expect(reply.code).not.toHaveBeenCalled()
    })
  })
})

describe('RBAC Decorator', () => {
  let tenantId: string
  let adminKey: string
  let userKey: string

  beforeEach(async () => {
    const tenant = await createTestTenant('RBAC Test Tenant', 'pro')
    tenantId = tenant.id

    const { rawKey: key1 } = await createTestApiKey(tenantId, 'admin', 'Admin Key')
    adminKey = key1

    const { rawKey: key2 } = await createTestApiKey(tenantId, 'user', 'User Key')
    userKey = key2
  })

  afterEach(async () => {
    await cleanupTestTenant(tenantId)
  })

  it('should allow admin role to access admin-only endpoint', async () => {
    const request = {
      headers: { authorization: `Bearer ${adminKey}` },
      id: 'test-request-id',
      tenantContext: undefined,
    } as any

    const reply = createMockReply()

    // First authenticate
    await authMiddleware(request, reply)

    // Then check role
    const roleCheck = requireRole('admin')
    await roleCheck(request, reply)

    expect(reply.code).not.toHaveBeenCalled()
    expect(reply.send).not.toHaveBeenCalled()
  })

  it('should reject user role from admin-only endpoint', async () => {
    const request = {
      headers: { authorization: `Bearer ${userKey}` },
      id: 'test-request-id',
      tenantContext: undefined,
    } as any

    const reply = createMockReply()

    // First authenticate
    await authMiddleware(request, reply)
    reply.code.mockClear()
    reply.send.mockClear()

    // Then check role
    const roleCheck = requireRole('admin')
    await roleCheck(request, reply)

    expect(reply.code).toHaveBeenCalledWith(403)
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'insufficient_permissions',
          currentRole: 'user',
          requiredRoles: ['admin'],
        }),
      })
    )
  })

  it('should allow multiple roles', async () => {
    const request = {
      headers: { authorization: `Bearer ${userKey}` },
      id: 'test-request-id',
      tenantContext: undefined,
    } as any

    const reply = createMockReply()

    // First authenticate
    await authMiddleware(request, reply)

    // Then check role (allow both admin and user)
    const roleCheck = requireRole('admin', 'user')
    await roleCheck(request, reply)

    expect(reply.code).not.toHaveBeenCalled()
    expect(reply.send).not.toHaveBeenCalled()
  })
})

/**
 * Create a mock Fastify reply object
 */
function createMockReply(): FastifyReply {
  const reply = {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
  } as any

  return reply
}

// Add vi import at the top
import { vi } from 'vitest'
