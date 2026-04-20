import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  AuthResponseSchema,
  MeResponseSchema,
  UpdateProfileRequestSchema,
  UpdateTenantRequestSchema,
  type RegisterRequest,
  type LoginRequest,
  type AuthResponse,
  type MeResponse,
  type UpdateProfileRequest,
  type UpdateTenantRequest,
} from '@llm-gateway/schemas'
import { db } from '../db/client'
import { users, tenants, userTenants } from '../db/schema'
import { generateToken } from '../lib/jwt'
import { dashboardAuthMiddleware } from '../middleware/dashboard-auth'

/**
 * Register auth routes
 * 
 * Routes:
 * - POST /v1/auth/register - Create user + tenant
 * - POST /v1/auth/login - Verify credentials
 * - GET /v1/auth/me - Get current user info
 */
export async function registerAuthRoutes(app: FastifyInstance) {
  /**
   * POST /v1/auth/register
   * Create a new user and tenant, return JWT token
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
        description: 'Creates a new user and tenant. The user becomes the admin of the new tenant.',
      },
    },
    async (request, reply) => {
      const { email, password, name, tenantName } = request.body

      // Check if user already exists
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

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10)

      // Create user, tenant, and user-tenant relationship in a transaction
      const result = await db.transaction(async (tx) => {
        // Create user
        const [newUser] = await tx
          .insert(users)
          .values({
            email,
            passwordHash,
            name,
          })
          .returning()

        // Create tenant
        const [newTenant] = await tx
          .insert(tenants)
          .values({
            name: tenantName,
            tier: 'free',
          })
          .returning()

        // Create user-tenant relationship (admin role)
        await tx.insert(userTenants).values({
          userId: newUser.id,
          tenantId: newTenant.id,
          role: 'admin',
        })

        return { user: newUser, tenant: newTenant }
      })

      // Generate JWT token
      const token = generateToken(result.user.id, result.tenant.id, 'admin')

      // Return auth response
      const response: AuthResponse = {
        token,
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
   * Verify credentials and return JWT token
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
        description: 'Verifies credentials and returns a JWT token. If the user belongs to multiple tenants, returns the first one.',
      },
    },
    async (request, reply) => {
      const { email, password } = request.body

      // Find user by email
      const user = await db.query.users.findFirst({
        where: eq(users.email, email),
      })

      if (!user) {
        return reply.status(401).send({
          error: {
            code: 'invalid_credentials',
            message: 'Invalid email or password',
          },
        } as any)
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash)

      if (!isValidPassword) {
        return reply.status(401).send({
          error: {
            code: 'invalid_credentials',
            message: 'Invalid email or password',
          },
        } as any)
      }

      // Get user's tenants
      const userTenantsData = await db.query.userTenants.findMany({
        where: eq(userTenants.userId, user.id),
        with: {
          tenant: true,
        },
      })

      if (userTenantsData.length === 0) {
        return reply.status(500).send({
          error: {
            code: 'no_tenant_found',
            message: 'User has no associated tenant',
          },
        } as any)
      }

      // Use the first tenant (in a real app, user might select which tenant to log into)
      const firstUserTenant = userTenantsData[0]
      const tenant = firstUserTenant.tenant

      // Generate JWT token
      const token = generateToken(user.id, tenant.id, firstUserTenant.role as any)

      // Return auth response
      const response: AuthResponse = {
        token,
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
   * GET /v1/auth/me
   * Get current user info with all tenants
   * Requires JWT authentication
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

      // Get user
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      })

      if (!user) {
        return reply.status(404).send({
          error: {
            code: 'user_not_found',
            message: 'User not found',
          },
        } as any)
      }

      // Get user's tenants
      const userTenantsData = await db.query.userTenants.findMany({
        where: eq(userTenants.userId, userId),
        with: {
          tenant: true,
        },
      })

      // Return me response
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

      // Password change — verify current password first
      if (newPassword) {
        if (!currentPassword) {
          return reply.status(400).send({ error: { code: 'current_password_required', message: 'Current password is required to set a new password' } } as any)
        }
        const valid = await bcrypt.compare(currentPassword, user.passwordHash)
        if (!valid) {
          return reply.status(400).send({ error: { code: 'invalid_current_password', message: 'Current password is incorrect' } } as any)
        }
      }

      // Check email uniqueness if changing
      if (email && email !== user.email) {
        const existing = await db.query.users.findFirst({ where: eq(users.email, email) })
        if (existing) {
          return reply.status(409).send({ error: { code: 'email_already_exists', message: 'This email is already in use' } } as any)
        }
      }

      const updates: Partial<typeof users.$inferInsert> = {}
      if (name)        updates.name          = name
      if (email)       updates.email         = email
      if (newPassword) updates.passwordHash  = await bcrypt.hash(newPassword, 10)

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
        description: 'Update the name of the authenticated user\'s primary tenant. Admin role required.',
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
