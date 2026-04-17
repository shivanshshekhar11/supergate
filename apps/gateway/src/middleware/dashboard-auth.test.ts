import { describe, it, expect, vi, beforeEach } from 'vitest'
import { dashboardAuthMiddleware, requireRole } from './dashboard-auth'
import { generateToken } from '../lib/jwt'
import type { FastifyRequest, FastifyReply } from 'fastify'

// Mock the config module
vi.mock('../config', () => ({
  env: {
    JWT_SECRET: 'test-secret-key-at-least-32-characters-long-for-testing',
  },
}))

describe('Dashboard Auth Middleware', () => {
  const testUserId = '123e4567-e89b-12d3-a456-426614174000'
  const testTenantId = '123e4567-e89b-12d3-a456-426614174001'

  // Helper to create mock request
  function createMockRequest(authHeader?: string): Partial<FastifyRequest> {
    return {
      headers: authHeader ? { authorization: authHeader } : {},
      url: '/v1/test',
      method: 'GET',
    }
  }

  // Helper to create mock reply
  function createMockReply(): Partial<FastifyReply> {
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    }
    return reply
  }

  describe('dashboardAuthMiddleware', () => {
    it('should return 401 if Authorization header is missing', async () => {
      const request = createMockRequest() as FastifyRequest
      const reply = createMockReply() as FastifyReply

      await dashboardAuthMiddleware(request, reply)

      expect(reply.status).toHaveBeenCalledWith(401)
      expect(reply.send).toHaveBeenCalledWith({
        error: {
          code: 'missing_authorization',
          message: 'Authorization header is required',
        },
      })
    })

    it('should return 401 if Authorization header format is invalid', async () => {
      const request = createMockRequest('InvalidFormat') as FastifyRequest
      const reply = createMockReply() as FastifyReply

      await dashboardAuthMiddleware(request, reply)

      expect(reply.status).toHaveBeenCalledWith(401)
      expect(reply.send).toHaveBeenCalledWith({
        error: {
          code: 'invalid_authorization_format',
          message: 'Authorization header must be in format: Bearer <token>',
        },
      })
    })

    it('should return 401 if token is invalid', async () => {
      const request = createMockRequest('Bearer invalid-token') as FastifyRequest
      const reply = createMockReply() as FastifyReply

      await dashboardAuthMiddleware(request, reply)

      expect(reply.status).toHaveBeenCalledWith(401)
      expect(reply.send).toHaveBeenCalledWith({
        error: {
          code: 'invalid_token',
          message: 'Invalid token',
        },
      })
    })

    it('should attach userContext to request for valid token', async () => {
      const token = generateToken(testUserId, testTenantId, 'admin')
      const request = createMockRequest(`Bearer ${token}`) as FastifyRequest
      const reply = createMockReply() as FastifyReply

      await dashboardAuthMiddleware(request, reply)

      expect(request.userContext).toBeDefined()
      expect(request.userContext?.userId).toBe(testUserId)
      expect(request.userContext?.tenantId).toBe(testTenantId)
      expect(request.userContext?.role).toBe('admin')
      expect(reply.status).not.toHaveBeenCalled()
      expect(reply.send).not.toHaveBeenCalled()
    })

    it('should handle admin role', async () => {
      const token = generateToken(testUserId, testTenantId, 'admin')
      const request = createMockRequest(`Bearer ${token}`) as FastifyRequest
      const reply = createMockReply() as FastifyReply

      await dashboardAuthMiddleware(request, reply)

      expect(request.userContext?.role).toBe('admin')
    })

    it('should handle member role', async () => {
      const token = generateToken(testUserId, testTenantId, 'member')
      const request = createMockRequest(`Bearer ${token}`) as FastifyRequest
      const reply = createMockReply() as FastifyReply

      await dashboardAuthMiddleware(request, reply)

      expect(request.userContext?.role).toBe('member')
    })

    it('should handle guest role', async () => {
      const token = generateToken(testUserId, testTenantId, 'guest')
      const request = createMockRequest(`Bearer ${token}`) as FastifyRequest
      const reply = createMockReply() as FastifyReply

      await dashboardAuthMiddleware(request, reply)

      expect(request.userContext?.role).toBe('guest')
    })

    it('should handle Bearer with extra spaces', async () => {
      const token = generateToken(testUserId, testTenantId, 'admin')
      const request = createMockRequest(`Bearer  ${token}`) as FastifyRequest
      const reply = createMockReply() as FastifyReply

      await dashboardAuthMiddleware(request, reply)

      // Should fail because of extra space
      expect(reply.status).toHaveBeenCalledWith(401)
    })

    it('should handle lowercase bearer', async () => {
      const token = generateToken(testUserId, testTenantId, 'admin')
      const request = createMockRequest(`bearer ${token}`) as FastifyRequest
      const reply = createMockReply() as FastifyReply

      await dashboardAuthMiddleware(request, reply)

      // Should fail because Bearer is case-sensitive
      expect(reply.status).toHaveBeenCalledWith(401)
    })
  })

  describe('requireRole', () => {
    it('should return 401 if userContext is missing', async () => {
      const request = {} as FastifyRequest
      const reply = createMockReply() as FastifyReply

      const middleware = requireRole('admin')
      await middleware(request, reply)

      expect(reply.status).toHaveBeenCalledWith(401)
      expect(reply.send).toHaveBeenCalledWith({
        error: {
          code: 'unauthorized',
          message: 'Authentication required',
        },
      })
    })

    it('should allow admin role when admin is required', async () => {
      const request = {
        userContext: { userId: testUserId, tenantId: testTenantId, role: 'admin' as const },
      } as FastifyRequest
      const reply = createMockReply() as FastifyReply

      const middleware = requireRole('admin')
      await middleware(request, reply)

      expect(reply.status).not.toHaveBeenCalled()
      expect(reply.send).not.toHaveBeenCalled()
    })

    it('should deny member role when admin is required', async () => {
      const request = {
        userContext: { userId: testUserId, tenantId: testTenantId, role: 'member' as const },
      } as FastifyRequest
      const reply = createMockReply() as FastifyReply

      const middleware = requireRole('admin')
      await middleware(request, reply)

      expect(reply.status).toHaveBeenCalledWith(403)
      expect(reply.send).toHaveBeenCalledWith({
        error: {
          code: 'forbidden',
          message: 'This action requires one of the following roles: admin',
        },
      })
    })

    it('should deny guest role when admin is required', async () => {
      const request = {
        userContext: { userId: testUserId, tenantId: testTenantId, role: 'guest' as const },
      } as FastifyRequest
      const reply = createMockReply() as FastifyReply

      const middleware = requireRole('admin')
      await middleware(request, reply)

      expect(reply.status).toHaveBeenCalledWith(403)
    })

    it('should allow admin when admin or member is required', async () => {
      const request = {
        userContext: { userId: testUserId, tenantId: testTenantId, role: 'admin' as const },
      } as FastifyRequest
      const reply = createMockReply() as FastifyReply

      const middleware = requireRole('admin', 'member')
      await middleware(request, reply)

      expect(reply.status).not.toHaveBeenCalled()
    })

    it('should allow member when admin or member is required', async () => {
      const request = {
        userContext: { userId: testUserId, tenantId: testTenantId, role: 'member' as const },
      } as FastifyRequest
      const reply = createMockReply() as FastifyReply

      const middleware = requireRole('admin', 'member')
      await middleware(request, reply)

      expect(reply.status).not.toHaveBeenCalled()
    })

    it('should deny guest when admin or member is required', async () => {
      const request = {
        userContext: { userId: testUserId, tenantId: testTenantId, role: 'guest' as const },
      } as FastifyRequest
      const reply = createMockReply() as FastifyReply

      const middleware = requireRole('admin', 'member')
      await middleware(request, reply)

      expect(reply.status).toHaveBeenCalledWith(403)
      expect(reply.send).toHaveBeenCalledWith({
        error: {
          code: 'forbidden',
          message: 'This action requires one of the following roles: admin, member',
        },
      })
    })

    it('should allow all roles when all are specified', async () => {
      const roles: Array<'admin' | 'member' | 'guest'> = ['admin', 'member', 'guest']

      for (const role of roles) {
        const request = {
          userContext: { userId: testUserId, tenantId: testTenantId, role },
        } as FastifyRequest
        const reply = createMockReply() as FastifyReply

        const middleware = requireRole('admin', 'member', 'guest')
        await middleware(request, reply)

        expect(reply.status).not.toHaveBeenCalled()
      }
    })

    it('should allow guest when only guest is required', async () => {
      const request = {
        userContext: { userId: testUserId, tenantId: testTenantId, role: 'guest' as const },
      } as FastifyRequest
      const reply = createMockReply() as FastifyReply

      const middleware = requireRole('guest')
      await middleware(request, reply)

      expect(reply.status).not.toHaveBeenCalled()
    })

    it('should deny admin when only guest is required', async () => {
      const request = {
        userContext: { userId: testUserId, tenantId: testTenantId, role: 'admin' as const },
      } as FastifyRequest
      const reply = createMockReply() as FastifyReply

      const middleware = requireRole('guest')
      await middleware(request, reply)

      expect(reply.status).toHaveBeenCalledWith(403)
    })
  })

  describe('Integration: dashboardAuthMiddleware + requireRole', () => {
    it('should authenticate and authorize admin successfully', async () => {
      const token = generateToken(testUserId, testTenantId, 'admin')
      const request = createMockRequest(`Bearer ${token}`) as FastifyRequest
      const reply = createMockReply() as FastifyReply

      // First authenticate
      await dashboardAuthMiddleware(request, reply)
      expect(request.userContext).toBeDefined()

      // Then authorize
      const roleMiddleware = requireRole('admin')
      await roleMiddleware(request, reply)

      expect(reply.status).not.toHaveBeenCalled()
    })

    it('should authenticate but deny authorization for insufficient role', async () => {
      const token = generateToken(testUserId, testTenantId, 'guest')
      const request = createMockRequest(`Bearer ${token}`) as FastifyRequest
      const reply = createMockReply() as FastifyReply

      // First authenticate
      await dashboardAuthMiddleware(request, reply)
      expect(request.userContext).toBeDefined()
      expect(request.userContext?.role).toBe('guest')

      // Then try to authorize for admin
      const roleMiddleware = requireRole('admin')
      await roleMiddleware(request, reply)

      expect(reply.status).toHaveBeenCalledWith(403)
    })
  })
})
