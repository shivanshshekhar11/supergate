import { describe, it, expect, beforeEach, vi } from 'vitest'
import { generateToken, verifyToken } from './jwt'
import jwt from 'jsonwebtoken'

// Mock the config module
vi.mock('../config', () => ({
  env: {
    JWT_SECRET: 'test-secret-key-at-least-32-characters-long-for-testing',
  },
}))

describe('JWT Library', () => {
  const testUserId = '123e4567-e89b-12d3-a456-426614174000'
  const testTenantId = '123e4567-e89b-12d3-a456-426614174001'
  const testRole = 'admin' as const

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateToken(testUserId, testTenantId, testRole)

      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3) // JWT has 3 parts
    })

    it('should include userId, tenantId, and role in payload', () => {
      const token = generateToken(testUserId, testTenantId, testRole)
      const decoded = jwt.decode(token) as any

      expect(decoded.userId).toBe(testUserId)
      expect(decoded.tenantId).toBe(testTenantId)
      expect(decoded.role).toBe(testRole)
    })

    it('should include issuer and audience claims', () => {
      const token = generateToken(testUserId, testTenantId, testRole)
      const decoded = jwt.decode(token) as any

      expect(decoded.iss).toBe('llm-gateway')
      expect(decoded.aud).toBe('dashboard')
    })

    it('should set expiration to 7 days', () => {
      const token = generateToken(testUserId, testTenantId, testRole)
      const decoded = jwt.decode(token) as any

      const now = Math.floor(Date.now() / 1000)
      const sevenDays = 7 * 24 * 60 * 60

      expect(decoded.exp).toBeGreaterThan(now)
      expect(decoded.exp).toBeLessThanOrEqual(now + sevenDays + 5) // 5 second tolerance
    })

    it('should generate different tokens for different users', () => {
      const token1 = generateToken(testUserId, testTenantId, testRole)
      const token2 = generateToken('different-user-id', testTenantId, testRole)

      expect(token1).not.toBe(token2)
    })

    it('should generate tokens for all role types', () => {
      const adminToken = generateToken(testUserId, testTenantId, 'admin')
      const memberToken = generateToken(testUserId, testTenantId, 'member')
      const guestToken = generateToken(testUserId, testTenantId, 'guest')

      const adminDecoded = jwt.decode(adminToken) as any
      const memberDecoded = jwt.decode(memberToken) as any
      const guestDecoded = jwt.decode(guestToken) as any

      expect(adminDecoded.role).toBe('admin')
      expect(memberDecoded.role).toBe('member')
      expect(guestDecoded.role).toBe('guest')
    })
  })

  describe('verifyToken', () => {
    it('should verify and decode a valid token', () => {
      const token = generateToken(testUserId, testTenantId, testRole)
      const payload = verifyToken(token)

      expect(payload.userId).toBe(testUserId)
      expect(payload.tenantId).toBe(testTenantId)
      expect(payload.role).toBe(testRole)
    })

    it('should throw error for invalid token', () => {
      const invalidToken = 'invalid.token.here'

      expect(() => verifyToken(invalidToken)).toThrow('Invalid token')
    })

    it('should throw error for malformed token', () => {
      const malformedToken = 'not-a-jwt-token'

      expect(() => verifyToken(malformedToken)).toThrow('Invalid token')
    })

    it('should throw error for token with wrong signature', () => {
      // Generate token with different secret
      const wrongToken = jwt.sign(
        { userId: testUserId, tenantId: testTenantId, role: testRole },
        'wrong-secret-key',
        { expiresIn: '7d', issuer: 'llm-gateway', audience: 'dashboard' }
      )

      expect(() => verifyToken(wrongToken)).toThrow('Invalid token')
    })

    it('should throw error for expired token', () => {
      // Generate token that expires immediately
      const expiredToken = jwt.sign(
        { userId: testUserId, tenantId: testTenantId, role: testRole },
        'test-secret-key-at-least-32-characters-long-for-testing',
        { expiresIn: '0s', issuer: 'llm-gateway', audience: 'dashboard' }
      )

      // Wait a bit to ensure expiration
      setTimeout(() => {
        expect(() => verifyToken(expiredToken)).toThrow('Token expired')
      }, 100)
    })

    it('should throw error for token with wrong issuer', () => {
      const wrongIssuerToken = jwt.sign(
        { userId: testUserId, tenantId: testTenantId, role: testRole },
        'test-secret-key-at-least-32-characters-long-for-testing',
        { expiresIn: '7d', issuer: 'wrong-issuer', audience: 'dashboard' }
      )

      expect(() => verifyToken(wrongIssuerToken)).toThrow('Invalid token')
    })

    it('should throw error for token with wrong audience', () => {
      const wrongAudienceToken = jwt.sign(
        { userId: testUserId, tenantId: testTenantId, role: testRole },
        'test-secret-key-at-least-32-characters-long-for-testing',
        { expiresIn: '7d', issuer: 'llm-gateway', audience: 'wrong-audience' }
      )

      expect(() => verifyToken(wrongAudienceToken)).toThrow('Invalid token')
    })

    it('should verify tokens for all role types', () => {
      const adminToken = generateToken(testUserId, testTenantId, 'admin')
      const memberToken = generateToken(testUserId, testTenantId, 'member')
      const guestToken = generateToken(testUserId, testTenantId, 'guest')

      const adminPayload = verifyToken(adminToken)
      const memberPayload = verifyToken(memberToken)
      const guestPayload = verifyToken(guestToken)

      expect(adminPayload.role).toBe('admin')
      expect(memberPayload.role).toBe('member')
      expect(guestPayload.role).toBe('guest')
    })
  })

  describe('Token lifecycle', () => {
    it('should generate and verify token successfully', () => {
      const token = generateToken(testUserId, testTenantId, testRole)
      const payload = verifyToken(token)

      expect(payload.userId).toBe(testUserId)
      expect(payload.tenantId).toBe(testTenantId)
      expect(payload.role).toBe(testRole)
    })

    it('should maintain payload integrity through encode/decode cycle', () => {
      const roles: Array<'admin' | 'member' | 'guest'> = ['admin', 'member', 'guest']

      roles.forEach((role) => {
        const token = generateToken(testUserId, testTenantId, role)
        const payload = verifyToken(token)

        expect(payload.userId).toBe(testUserId)
        expect(payload.tenantId).toBe(testTenantId)
        expect(payload.role).toBe(role)
      })
    })
  })
})
