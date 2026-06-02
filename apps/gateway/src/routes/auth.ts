import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { eq, and, gt, isNull } from 'drizzle-orm'
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  AuthResponseSchema,
  RefreshResponseSchema,
  MeResponseSchema,
  UpdateProfileRequestSchema,
  UpdateTenantRequestSchema,
  type RegisterRequest,
  type LoginRequest,
  type AuthResponse,
  type RefreshResponse,
  type MeResponse,
  type UpdateProfileRequest,
  type UpdateTenantRequest,
} from '@llm-gateway/schemas'
import { db } from '../db/client'
import { users, tenants, userTenants, refreshTokens } from '../db/schema'
import { generateToken, generateRefreshToken, hashRefreshToken } from '../lib/jwt'
import { dashboardAuthMiddleware } from '../middleware/dashboard-auth'
import { env } from '../config'

/** Cookie name for the httpOnly refresh token */
const REFRESH_COOKIE = 'refresh_token'

/** Cookie options shared by set / clear operations */
const cookieOpts = (maxAge?: number) => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/v1/auth/refresh',
  ...(maxAge !== undefined ? { maxAge } : {}),
})

/**
 * Issue a refresh token: insert hashed record in DB, set httpOnly cookie.
 */
async function issueRefreshCookie(
  reply: any,
  userId: string,
  request: any,
): Promise<void> {
  const rt = generateRefreshToken()

  await db.insert(refreshTokens).values({
    userId,
    tokenHash: rt.hash,
    expiresAt: rt.expiresAt,
    userAgent: request.headers?.['user-agent'] ?? null,
    ipAddress: request.ip ?? null,
  })

  reply.setCookie(REFRESH_COOKIE, rt.raw, cookieOpts(env.REFRESH_TOKEN_EXPIRES_DAYS * 86400))
}

/**
 * Register auth routes
 *
 * Routes:
 * - POST /v1/auth/register    — Create user + tenant, return access JWT + set refresh cookie
 * - POST /v1/auth/login       — Verify credentials, return access JWT + set refresh cookie
 * - POST /v1/auth/refresh     — Rotate refresh token, return new access JWT
 * - POST /v1/auth/logout      — Revoke refresh token, clear cookie
 * - GET  /v1/auth/me          — Get current user info
 * - PATCH /v1/auth/profile    — Update user profile
 * - PATCH /v1/auth/tenant     — Update tenant name (admin only)
 */
export async function registerAuthRoutes(app: FastifyInstance) {
  /**
   * POST /v1/auth/register
   * Create a new user and tenant, return access JWT + set refresh cookie.
   */
  app.post<{ Body: RegisterRequest; Reply: AuthResponse }>(
    '/v1/auth/register',
    {
      schema: {
        body: RegisterRequestSchema,
        response: {
          201: AuthResponseSchema,
        },
        tags: ['Auth'],
        summary: 'Register a new user',
        description: 'Creates a new user and tenant. The user becomes the admin of the new tenant. Returns a short-lived access JWT; a long-lived refresh token is set as an httpOnly cookie.',
      },
    },
    async (request, reply) => {
      const { email, password, name, tenantName } = request.body

      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, email),
      })

      if (existingUser) {
        return reply.status(400).send({
          error: {
            code: 'email_already_exists',
            message: 'A user with this email already exists',
          },
        } as any)
      }

      const passwordHash = await bcrypt.hash(password, 10)

      const result = await db.transaction(async (tx) => {
        const [newUser] = await tx
          .insert(users)
          .values({ email, passwordHash, name })
          .returning()

        const [newTenant] = await tx
          .insert(tenants)
          .values({ name: tenantName, tier: 'free' })
          .returning()

        await tx.insert(userTenants).values({
          userId: newUser.id,
          tenantId: newTenant.id,
          role: 'admin',
        })

        return { user: newUser, tenant: newTenant }
      })

      const accessToken = generateToken(result.user.id, result.tenant.id, 'admin')
      await issueRefreshCookie(reply, result.user.id, request)

      const response: AuthResponse = {
        accessToken,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          createdAt: result.user.createdAt.toISOString(),
        },
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
          tier: result.tenant.tier as any,
          role: 'admin',
          createdAt: result.tenant.createdAt.toISOString(),
        },
      }

      return reply.status(201).send(response)
    }
  )

  /**
   * POST /v1/auth/login
   * Verify credentials, return access JWT + set refresh cookie.
   */
  app.post<{ Body: LoginRequest; Reply: AuthResponse }>(
    '/v1/auth/login',
    {
      schema: {
        body: LoginRequestSchema,
        response: {
          200: AuthResponseSchema,
        },
        tags: ['Auth'],
        summary: 'Login with email and password',
        description: 'Verifies credentials and returns a short-lived access JWT. A long-lived refresh token is set as an httpOnly cookie on the /v1/auth/refresh path.',
      },
    },
    async (request, reply) => {
      const { email, password } = request.body

      const user = await db.query.users.findFirst({
        where: eq(users.email, email),
      })

      if (!user) {
        return reply.status(401).send({
          error: { code: 'invalid_credentials', message: 'Invalid email or password' },
        } as any)
      }

      const isValidPassword = await bcrypt.compare(password, user.passwordHash)

      if (!isValidPassword) {
        return reply.status(401).send({
          error: { code: 'invalid_credentials', message: 'Invalid email or password' },
        } as any)
      }

      const userTenantsData = await db.query.userTenants.findMany({
        where: eq(userTenants.userId, user.id),
        with: { tenant: true },
      })

      if (userTenantsData.length === 0) {
        return reply.status(500).send({
          error: { code: 'no_tenant_found', message: 'User has no associated tenant' },
        } as any)
      }

      const firstUserTenant = userTenantsData[0]
      const tenant = firstUserTenant.tenant

      const accessToken = generateToken(user.id, tenant.id, firstUserTenant.role as any)
      await issueRefreshCookie(reply, user.id, request)

      const response: AuthResponse = {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt.toISOString(),
        },
        tenant: {
          id: tenant.id,
          name: tenant.name,
          tier: tenant.tier as any,
          role: firstUserTenant.role as any,
          createdAt: tenant.createdAt.toISOString(),
        },
      }

      return reply.status(200).send(response)
    }
  )

  /**
   * POST /v1/auth/refresh
   *
   * Validates the httpOnly refresh cookie, rotates it (old token revoked, new one
   * issued), and returns a fresh short-lived access JWT.
   *
   * Cookie is scoped to Path=/v1/auth/refresh so browsers only send it here.
   */
  app.post<{ Reply: RefreshResponse }>(
    '/v1/auth/refresh',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Refresh access token',
        description: 'Validates the httpOnly refresh cookie and returns a new short-lived access JWT. The refresh token is rotated on every call.',
        response: {
          200: RefreshResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const rawToken: string | undefined = (request.cookies as any)?.[REFRESH_COOKIE]

      if (!rawToken) {
        return reply.status(401).send({
          error: { code: 'missing_refresh_token', message: 'Refresh token cookie is missing' },
        } as any)
      }

      const tokenHash = hashRefreshToken(rawToken)
      const now = new Date()

      // Look up the token — must be valid (not revoked, not expired)
      const stored = await db.query.refreshTokens.findFirst({
        where: and(
          eq(refreshTokens.tokenHash, tokenHash),
          isNull(refreshTokens.revokedAt),
          gt(refreshTokens.expiresAt, now),
        ),
      })

      if (!stored) {
        // Clear stale cookie regardless
        reply.clearCookie(REFRESH_COOKIE, cookieOpts())
        return reply.status(401).send({
          error: { code: 'invalid_refresh_token', message: 'Refresh token is invalid, expired, or already used' },
        } as any)
      }

      // Get user + tenant for fresh payload (picks up any role changes since last login)
      const user = await db.query.users.findFirst({
        where: eq(users.id, stored.userId),
      })

      if (!user) {
        return reply.status(401).send({
          error: { code: 'user_not_found', message: 'User account no longer exists' },
        } as any)
      }

      const userTenantsData = await db.query.userTenants.findMany({
        where: eq(userTenants.userId, user.id),
        with: { tenant: true },
      })

      if (userTenantsData.length === 0) {
        return reply.status(401).send({
          error: { code: 'no_tenant_found', message: 'User has no associated tenant' },
        } as any)
      }

      const firstUserTenant = userTenantsData[0]

      // Rotate: revoke old token, issue new one (atomic-ish — both in the same request)
      await db
        .update(refreshTokens)
        .set({ revokedAt: now })
        .where(eq(refreshTokens.id, stored.id))

      const accessToken = generateToken(user.id, firstUserTenant.tenantId, firstUserTenant.role as any)
      await issueRefreshCookie(reply, user.id, request)

      return reply.status(200).send({ accessToken })
    }
  )

  /**
   * POST /v1/auth/logout
   *
   * Revokes the current refresh token in the DB and clears the cookie.
   * Idempotent — safe to call even if already logged out.
   */
  app.post(
    '/v1/auth/logout',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Logout',
        description: 'Revokes the refresh token and clears the httpOnly cookie. The short-lived access JWT will expire naturally within 15 minutes.',
      },
    },
    async (request, reply) => {
      const rawToken: string | undefined = (request.cookies as any)?.[REFRESH_COOKIE]

      if (rawToken) {
        const tokenHash = hashRefreshToken(rawToken)
        // Soft-revoke — ignore errors (token may already be expired/revoked)
        await db
          .update(refreshTokens)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(refreshTokens.tokenHash, tokenHash),
              isNull(refreshTokens.revokedAt),
            )
          )
          .catch(() => {})
      }

      reply.clearCookie(REFRESH_COOKIE, cookieOpts())
      return reply.status(204).send()
    }
  )

  /**
   * GET /v1/auth/me
   * Get current user info with all tenants.
   * Requires JWT authentication.
   */
  app.get<{ Reply: MeResponse }>(
    '/v1/auth/me',
    {
      onRequest: dashboardAuthMiddleware,
      schema: {
        response: {
          200: MeResponseSchema,
        },
        tags: ['Auth'],
        summary: 'Get current user info',
        description: 'Returns the current user info with all tenants they belong to. Requires JWT authentication.',
        security: [{ BearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { userId } = request.userContext!

      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      })

      if (!user) {
        return reply.status(404).send({
          error: { code: 'user_not_found', message: 'User not found' },
        } as any)
      }

      const userTenantsData = await db.query.userTenants.findMany({
        where: eq(userTenants.userId, userId),
        with: { tenant: true },
      })

      const response: MeResponse = {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt.toISOString(),
        },
        tenants: userTenantsData.map((ut) => ({
          id: ut.tenant.id,
          name: ut.tenant.name,
          tier: ut.tenant.tier as any,
          role: ut.role as any,
          createdAt: ut.tenant.createdAt.toISOString(),
        })),
      }

      return reply.status(200).send(response)
    }
  )

  /**
   * PATCH /v1/auth/profile
   * Update current user's name, email, and/or password.
   * Requires JWT authentication.
   */
  app.patch<{ Body: UpdateProfileRequest }>(
    '/v1/auth/profile',
    {
      onRequest: dashboardAuthMiddleware,
      schema: {
        body: UpdateProfileRequestSchema,
        tags: ['Auth'],
        summary: 'Update user profile',
        description: 'Update name, email, and/or password for the authenticated user.',
        security: [{ BearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { userId } = request.userContext!
      const { name, email, currentPassword, newPassword } = request.body

      const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
      if (!user) return reply.status(404).send({ error: { code: 'user_not_found', message: 'User not found' } } as any)

      if (newPassword) {
        if (!currentPassword) {
          return reply.status(400).send({ error: { code: 'current_password_required', message: 'Current password is required to set a new password' } } as any)
        }
        const valid = await bcrypt.compare(currentPassword, user.passwordHash)
        if (!valid) {
          return reply.status(400).send({ error: { code: 'invalid_current_password', message: 'Current password is incorrect' } } as any)
        }
      }

      if (email && email !== user.email) {
        const existing = await db.query.users.findFirst({ where: eq(users.email, email) })
        if (existing) {
          return reply.status(409).send({ error: { code: 'email_already_exists', message: 'This email is already in use' } } as any)
        }
      }

      const updates: Partial<typeof users.$inferInsert> = {}
      if (name)        updates.name         = name
      if (email)       updates.email        = email
      if (newPassword) updates.passwordHash = await bcrypt.hash(newPassword, 10)

      if (Object.keys(updates).length === 0) {
        return reply.status(400).send({ error: { code: 'no_changes', message: 'No fields to update' } } as any)
      }

      const [updated] = await db.update(users).set(updates).where(eq(users.id, userId)).returning()

      return reply.status(200).send({
        id:        updated.id,
        email:     updated.email,
        name:      updated.name,
        createdAt: updated.createdAt.toISOString(),
      })
    }
  )

  /**
   * PATCH /v1/auth/tenant
   * Update the current user's primary tenant name (admin only).
   * Requires JWT authentication.
   */
  app.patch<{ Body: UpdateTenantRequest }>(
    '/v1/auth/tenant',
    {
      onRequest: dashboardAuthMiddleware,
      schema: {
        body: UpdateTenantRequestSchema,
        tags: ['Auth'],
        summary: 'Update tenant name',
        description: "Update the name of the authenticated user's primary tenant. Admin role required.",
        security: [{ BearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { userId, tenantId, role } = request.userContext!

      if (role !== 'admin') {
        return reply.status(403).send({ error: { code: 'insufficient_permissions', message: 'Admin role required' } } as any)
      }

      const { name } = request.body

      const [updated] = await db
        .update(tenants)
        .set({ name })
        .where(eq(tenants.id, tenantId))
        .returning()

      if (!updated) {
        return reply.status(404).send({ error: { code: 'tenant_not_found', message: 'Tenant not found' } } as any)
      }

      return reply.status(200).send({
        id:        updated.id,
        name:      updated.name,
        tier:      updated.tier,
        createdAt: updated.createdAt.toISOString(),
      })
    }
  )
}
