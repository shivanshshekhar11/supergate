import { FastifyRequest, FastifyReply } from 'fastify'
import { db } from '../db/client'
import { apiKeys, tenants } from '../db/schema'
import { eq, and, sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { verifyToken } from '../lib/jwt'

/**
 * Tenant context attached to every authenticated request.
 *
 * Populated by authMiddleware regardless of whether the caller used a
 * gateway API key (gw_...) or a dashboard JWT.  All route handlers read
 * from this single shape — no more userContext / tenantContext split.
 */
export interface TenantContext {
  tenantId:   string
  tenantName: string
  tenantTier: string
  keyId:      string   // API key UUID  OR  JWT userId
  keyRole:    string   // 'admin' | 'user' | 'viewer'  OR  'admin' | 'member' | 'guest'
  authMethod: 'api_key' | 'jwt'
}

declare module 'fastify' {
  interface FastifyRequest {
    tenantContext?: TenantContext
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

function isJwt(token: string): boolean {
  if (token.startsWith('gw_')) return false
  // JWTs are three base64url segments separated by dots
  const parts = token.split('.')
  return parts.length === 3
}

function unauthorized(request: FastifyRequest, reply: FastifyReply, code: string, message: string) {
  return reply.code(401).send({
    error: { code, message, requestId: request.id },
  })
}

// ── main middleware ───────────────────────────────────────────────────────────

/**
 * Unified authentication middleware.
 *
 * Accepts both gateway API keys (gw_...) and dashboard JWTs in the same
 * Authorization: Bearer header.  After this middleware runs, every route
 * handler can read request.tenantContext regardless of auth method.
 *
 * Flow:
 *   Bearer gw_...  → bcrypt API key verification → tenantContext
 *   Bearer eyJ...  → JWT verification → tenant DB lookup → tenantContext
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization

  if (!authHeader) {
    return unauthorized(request, reply, 'missing_authorization', 'Authorization header is required')
  }

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return unauthorized(request, reply, 'invalid_authorization_format', 'Authorization header must be in format: Bearer <token>')
  }

  const token = parts[1]

  try {
    if (isJwt(token)) {
      await handleJwt(token, request, reply)
    } else {
      await handleApiKey(token, request, reply)
    }
  } catch (error) {
    request.log.error({ err: error }, '[Auth] Unexpected error')
    return reply.code(500).send({
      error: { code: 'authentication_error', message: 'An error occurred during authentication', requestId: request.id },
    })
  }
}

// ── JWT path ──────────────────────────────────────────────────────────────────

async function handleJwt(
  token: string,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  let payload: ReturnType<typeof verifyToken>
  try {
    payload = verifyToken(token)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid token'
    return unauthorized(request, reply, 'invalid_token', msg)
  }

  // Fetch tenant name + tier so tenantContext is fully populated
  const [tenant] = await db
    .select({ name: tenants.name, tier: tenants.tier })
    .from(tenants)
    .where(eq(tenants.id, payload.tenantId))
    .limit(1)

  if (!tenant) {
    return unauthorized(request, reply, 'tenant_not_found', 'Tenant associated with this token no longer exists')
  }

  // Set RLS session variable
  await db.execute(sql`SELECT set_config('app.tenant_id', ${payload.tenantId}, true)`)

  request.tenantContext = {
    tenantId:   payload.tenantId,
    tenantName: tenant.name,
    tenantTier: tenant.tier,
    keyId:      payload.userId,
    keyRole:    payload.role,   // 'admin' | 'member' | 'guest'
    authMethod: 'jwt',
  }
}

// ── API key path ──────────────────────────────────────────────────────────────

async function handleApiKey(
  rawKey: string,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!rawKey.startsWith('gw_') || rawKey.length < 20) {
    return unauthorized(request, reply, 'invalid_api_key_format', 'API key must start with "gw_" and be at least 20 characters')
  }

  const keyPrefix = rawKey.substring(0, 9)

  const candidates = await db
    .select({
      id:         apiKeys.id,
      tenantId:   apiKeys.tenantId,
      keyHash:    apiKeys.keyHash,
      role:       apiKeys.role,
      revoked:    apiKeys.revoked,
      tenantName: tenants.name,
      tenantTier: tenants.tier,
    })
    .from(apiKeys)
    .innerJoin(tenants, eq(apiKeys.tenantId, tenants.id))
    .where(and(eq(apiKeys.keyPrefix, keyPrefix), eq(apiKeys.revoked, false)))

  if (candidates.length === 0) {
    return unauthorized(request, reply, 'invalid_api_key', 'Invalid or revoked API key')
  }

  let matched: typeof candidates[0] | null = null
  for (const c of candidates) {
    if (await bcrypt.compare(rawKey, c.keyHash)) { matched = c; break }
  }

  if (!matched) {
    return unauthorized(request, reply, 'invalid_api_key', 'Invalid or revoked API key')
  }

  await db.execute(sql`SELECT set_config('app.tenant_id', ${matched.tenantId}, true)`)

  // Fire-and-forget last_used update
  db.update(apiKeys).set({ lastUsed: new Date() }).where(eq(apiKeys.id, matched.id))
    .execute().catch(err => request.log.error({ err }, '[Auth] Failed to update last_used'))

  request.tenantContext = {
    tenantId:   matched.tenantId,
    tenantName: matched.tenantName,
    tenantTier: matched.tenantTier,
    keyId:      matched.id,
    keyRole:    matched.role,   // 'admin' | 'user' | 'viewer'
    authMethod: 'api_key',
  }
}

// ── RBAC helper ───────────────────────────────────────────────────────────────

/**
 * Route preHandler that enforces role requirements.
 * Works for both API key roles (admin/user/viewer) and JWT roles (admin/member/guest).
 */
export function requireRole(...allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.tenantContext) {
      return reply.code(401).send({
        error: { code: 'not_authenticated', message: 'Authentication required', requestId: request.id },
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
