import { FastifyRequest, FastifyReply } from 'fastify'
import { db } from '../db/client'
import { apiKeys, tenants } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { sql } from 'drizzle-orm'

/**
 * Tenant context attached to request after authentication
 */
export interface TenantContext {
  tenantId: string
  tenantName: string
  tenantTier: string
  keyId: string
  keyRole: string
}

/**
 * Extend Fastify request type to include tenant context
 */
declare module 'fastify' {
  interface FastifyRequest {
    tenantContext?: TenantContext
  }
}

/**
 * Authentication middleware
 * 
 * Flow:
 * 1. Extract Bearer token from Authorization header
 * 2. Validate token format (must start with 'gw_')
 * 3. Find API key by prefix (fast path)
 * 4. Verify key with bcrypt (secure comparison)
 * 5. Check if key is revoked
 * 6. Attach tenant context to request
 * 7. Set PostgreSQL session variable for Row Level Security
 * 8. Update last_used timestamp (fire-and-forget)
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization

  // Check for Authorization header
  if (!authHeader) {
    return reply.code(401).send({
      error: {
        code: 'missing_authorization',
        message: 'Authorization header is required',
        requestId: request.id,
      },
    })
  }

  // Extract Bearer token
  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return reply.code(401).send({
      error: {
        code: 'invalid_authorization_format',
        message: 'Authorization header must be in format: Bearer <token>',
        requestId: request.id,
      },
    })
  }

  const rawKey = parts[1]

  // Validate key format
  if (!rawKey.startsWith('gw_') || rawKey.length < 20) {
    return reply.code(401).send({
      error: {
        code: 'invalid_api_key_format',
        message: 'API key must start with "gw_" and be at least 20 characters',
        requestId: request.id,
      },
    })
  }

  // Extract key prefix for fast lookup
  const keyPrefix = rawKey.substring(0, 9) // "gw_abc123"

  try {
    // Find API keys with matching prefix (fast path)
    const candidates = await db
      .select({
        id: apiKeys.id,
        tenantId: apiKeys.tenantId,
        keyHash: apiKeys.keyHash,
        role: apiKeys.role,
        revoked: apiKeys.revoked,
        tenantName: tenants.name,
        tenantTier: tenants.tier,
      })
      .from(apiKeys)
      .innerJoin(tenants, eq(apiKeys.tenantId, tenants.id))
      .where(
        and(
          eq(apiKeys.keyPrefix, keyPrefix),
          eq(apiKeys.revoked, false)
        )
      )

    if (candidates.length === 0) {
      return reply.code(401).send({
        error: {
          code: 'invalid_api_key',
          message: 'Invalid or revoked API key',
          requestId: request.id,
        },
      })
    }

    // Verify key with bcrypt (secure comparison)
    let matchedKey: typeof candidates[0] | null = null

    for (const candidate of candidates) {
      const isValid = await bcrypt.compare(rawKey, candidate.keyHash)
      if (isValid) {
        matchedKey = candidate
        break
      }
    }

    if (!matchedKey) {
      return reply.code(401).send({
        error: {
          code: 'invalid_api_key',
          message: 'Invalid or revoked API key',
          requestId: request.id,
        },
      })
    }

    // Attach tenant context to request
    request.tenantContext = {
      tenantId: matchedKey.tenantId,
      tenantName: matchedKey.tenantName,
      tenantTier: matchedKey.tenantTier,
      keyId: matchedKey.id,
      keyRole: matchedKey.role,
    }

    // Set PostgreSQL session variable for Row Level Security (RLS)
    // This ensures queries automatically filter by tenant_id
    // Note: SET LOCAL doesn't support parameterized queries, so we use raw SQL
    // The tenantId is a UUID from our database, so it's safe from injection
    await db.execute(sql.raw(`SET LOCAL app.tenant_id = '${matchedKey.tenantId}'`))

    // Update last_used timestamp (fire-and-forget)
    // Don't await - logging failure should never block the request
    db.update(apiKeys)
      .set({ lastUsed: new Date() })
      .where(eq(apiKeys.id, matchedKey.id))
      .execute()
      .catch((err) => {
        console.error('[Auth] Failed to update last_used:', err)
      })

    // Log successful authentication
    console.log(
      `[Auth] Authenticated: tenant=${matchedKey.tenantName} (${matchedKey.tenantId}), ` +
      `tier=${matchedKey.tenantTier}, role=${matchedKey.role}`
    )
  } catch (error) {
    console.error('[Auth] Authentication error:', error)
    return reply.code(500).send({
      error: {
        code: 'authentication_error',
        message: 'An error occurred during authentication',
        requestId: request.id,
      },
    })
  }
}

/**
 * Role-based access control decorator
 * Use this to restrict routes to specific roles
 */
export function requireRole(...allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.tenantContext) {
      return reply.code(401).send({
        error: {
          code: 'not_authenticated',
          message: 'Authentication required',
          requestId: request.id,
        },
      })
    }

    if (!allowedRoles.includes(request.tenantContext.keyRole)) {
      return reply.code(403).send({
        error: {
          code: 'insufficient_permissions',
          message: `This endpoint requires one of the following roles: ${allowedRoles.join(', ')}`,
          requestId: request.id,
          requiredRoles: allowedRoles,
          currentRole: request.tenantContext.keyRole,
        },
      })
    }
  }
}
