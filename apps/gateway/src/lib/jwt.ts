import jwt from 'jsonwebtoken'
import { randomBytes, createHash } from 'crypto'
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
 * Generate a short-lived access JWT (15 minutes).
 */
export function generateToken(userId: string, tenantId: string, role: 'admin' | 'member' | 'guest'): string {
  const payload: JWTPayload = { userId, tenantId, role }

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: '15m',
    issuer: 'llm-gateway',
    audience: 'dashboard',
  })
}

/**
 * Verify and decode an access JWT.
 *
 * @throws Error if the token is invalid or expired
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

/**
 * Refresh token payload — opaque 48-byte random string.
 * The raw value goes in the httpOnly cookie; the hash goes in the DB.
 */
export interface RefreshTokenData {
  /** Raw token — set as httpOnly cookie, never stored in DB */
  raw: string
  /** SHA-256 hex hash — stored in refresh_tokens.token_hash */
  hash: string
  /** When the token expires */
  expiresAt: Date
}

/**
 * Generate a new opaque refresh token.
 * Uses REFRESH_TOKEN_SECRET only for the hash (HMAC-like separation of secrets).
 */
export function generateRefreshToken(): RefreshTokenData {
  const raw = randomBytes(48).toString('hex')

  // Hash with SHA-256; prepend the secret so it can't be rainbow-tabled
  const hash = createHash('sha256')
    .update(env.REFRESH_TOKEN_SECRET + raw)
    .digest('hex')

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_EXPIRES_DAYS)

  return { raw, hash, expiresAt }
}

/**
 * Hash a raw refresh token for DB lookup (same algorithm as generateRefreshToken).
 */
export function hashRefreshToken(raw: string): string {
  return createHash('sha256')
    .update(env.REFRESH_TOKEN_SECRET + raw)
    .digest('hex')
}
