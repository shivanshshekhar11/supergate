import jwt from 'jsonwebtoken'
import { env } from '../config'

/**
 * JWT payload structure
 */
export interface JWTPayload {
  userId: string
  tenantId: string
  role: 'admin' | 'member' | 'guest'
}

/**
 * Generate a JWT token for a user
 * 
 * @param userId - User UUID
 * @param tenantId - Tenant UUID
 * @param role - User's role in the tenant
 * @returns JWT token string
 */
export function generateToken(userId: string, tenantId: string, role: 'admin' | 'member' | 'guest'): string {
  const payload: JWTPayload = {
    userId,
    tenantId,
    role,
  }

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: '7d', // Token expires in 7 days
    issuer: 'llm-gateway',
    audience: 'dashboard',
  })
}

/**
 * Verify and decode a JWT token
 * 
 * @param token - JWT token string
 * @returns Decoded JWT payload
 * @throws Error if token is invalid or expired
 */
export function verifyToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: 'llm-gateway',
      audience: 'dashboard',
    }) as JWTPayload

    return decoded
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired')
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token')
    }
    throw error
  }
}
