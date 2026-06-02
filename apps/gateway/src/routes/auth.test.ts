import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import { fastifyZodOpenApiPlugin, serializerCompiler, validatorCompiler } from 'fastify-zod-openapi'
import { registerAuthRoutes } from './auth'
import { db } from '../db/client'
import { users, tenants, userTenants, refreshTokens } from '../db/schema'
import { eq } from 'drizzle-orm'
import { verifyToken } from '../lib/jwt'

describe('Auth Routes', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = Fastify()

    // Register cookie plugin (required for refresh token flow)
    await app.register(cookie)

    // Register Zod OpenAPI plugin
    await app.register(fastifyZodOpenApiPlugin)
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)

    // Register auth routes
    await app.register(registerAuthRoutes)
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  describe('POST /v1/auth/register', () => {
    const testEmail = `test-${Date.now()}@example.com`
    const testPassword = 'password123'
    const testName = 'Test User'
    const testTenantName = 'Test Company'

    afterEach(async () => {
      // Cleanup: delete test user and tenant
      const user = await db.query.users.findFirst({
        where: eq(users.email, testEmail),
      })
      if (user) {
        await db.delete(refreshTokens).where(eq(refreshTokens.userId, user.id))
        await db.delete(userTenants).where(eq(userTenants.userId, user.id))
        const userTenant = await db.query.userTenants.findFirst({
          where: eq(userTenants.userId, user.id),
        })
        if (userTenant) {
          await db.delete(tenants).where(eq(tenants.id, userTenant.tenantId))
        }
        await db.delete(users).where(eq(users.id, user.id))
      }
    })

    it('should register a new user successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: {
          email: testEmail,
          password: testPassword,
          name: testName,
          tenantName: testTenantName,
        },
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)

      // Response uses accessToken (not token)
      expect(body.accessToken).toBeTruthy()
      expect(body.user).toBeDefined()
      expect(body.user.email).toBe(testEmail)
      expect(body.user.name).toBe(testName)
      expect(body.tenant).toBeDefined()
      expect(body.tenant.name).toBe(testTenantName)
      expect(body.tenant.tier).toBe('free')
      expect(body.tenant.role).toBe('admin')
    })

    it('should set an httpOnly refresh cookie', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: {
          email: testEmail,
          password: testPassword,
          name: testName,
          tenantName: testTenantName,
        },
      })

      expect(response.statusCode).toBe(201)
      const setCookie = response.headers['set-cookie']
      expect(setCookie).toBeTruthy()
      const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie
      expect(cookieStr).toMatch(/refresh_token=/)
      expect(cookieStr).toMatch(/HttpOnly/i)
      expect(cookieStr).toMatch(/Path=\/v1\/auth\/refresh/i)
    })

    it('should store hashed refresh token in database', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: {
          email: testEmail,
          password: testPassword,
          name: testName,
          tenantName: testTenantName,
        },
      })

      const body = JSON.parse(response.body)
      const stored = await db.query.refreshTokens.findFirst({
        where: eq(refreshTokens.userId, body.user.id),
      })

      expect(stored).toBeDefined()
      expect(stored?.tokenHash).toBeTruthy()
      expect(stored?.revokedAt).toBeNull()
    })

    it('should create user in database', async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: {
          email: testEmail,
          password: testPassword,
          name: testName,
          tenantName: testTenantName,
        },
      })

      const user = await db.query.users.findFirst({
        where: eq(users.email, testEmail),
      })

      expect(user).toBeDefined()
      expect(user?.email).toBe(testEmail)
      expect(user?.name).toBe(testName)
      expect(user?.passwordHash).toBeTruthy()
      expect(user?.passwordHash).not.toBe(testPassword) // Should be hashed
    })

    it('should create tenant in database', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: {
          email: testEmail,
          password: testPassword,
          name: testName,
          tenantName: testTenantName,
        },
      })

      const body = JSON.parse(response.body)
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, body.tenant.id),
      })

      expect(tenant).toBeDefined()
      expect(tenant?.name).toBe(testTenantName)
      expect(tenant?.tier).toBe('free')
    })

    it('should create user-tenant relationship with admin role', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: {
          email: testEmail,
          password: testPassword,
          name: testName,
          tenantName: testTenantName,
        },
      })

      const body = JSON.parse(response.body)
      const userTenant = await db.query.userTenants.findFirst({
        where: eq(userTenants.userId, body.user.id),
      })

      expect(userTenant).toBeDefined()
      expect(userTenant?.tenantId).toBe(body.tenant.id)
      expect(userTenant?.role).toBe('admin')
    })

    it('should return valid JWT access token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: {
          email: testEmail,
          password: testPassword,
          name: testName,
          tenantName: testTenantName,
        },
      })

      const body = JSON.parse(response.body)
      const payload = verifyToken(body.accessToken)

      expect(payload.userId).toBe(body.user.id)
      expect(payload.tenantId).toBe(body.tenant.id)
      expect(payload.role).toBe('admin')
    })

    it('should return 400 if email already exists', async () => {
      // Register first time
      await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: {
          email: testEmail,
          password: testPassword,
          name: testName,
          tenantName: testTenantName,
        },
      })

      // Try to register again with same email
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: {
          email: testEmail,
          password: 'different-password',
          name: 'Different Name',
          tenantName: 'Different Company',
        },
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error.code).toBe('email_already_exists')
    })

    it('should return 400 for invalid email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: {
          email: 'invalid-email',
          password: testPassword,
          name: testName,
          tenantName: testTenantName,
        },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should return 400 for short password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: {
          email: testEmail,
          password: 'short',
          name: testName,
          tenantName: testTenantName,
        },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should return 400 for missing name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: {
          email: testEmail,
          password: testPassword,
          name: '',
          tenantName: testTenantName,
        },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should return 400 for missing tenant name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: {
          email: testEmail,
          password: testPassword,
          name: testName,
          tenantName: '',
        },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('POST /v1/auth/login', () => {
    const testEmail = `login-test-${Date.now()}@example.com`
    const testPassword = 'password123'
    let userId: string
    let tenantId: string

    beforeEach(async () => {
      // Register a user first
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: {
          email: testEmail,
          password: testPassword,
          name: 'Login Test User',
          tenantName: 'Login Test Company',
        },
      })

      const body = JSON.parse(response.body)
      userId = body.user.id
      tenantId = body.tenant.id
    })

    afterEach(async () => {
      // Cleanup
      await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId))
      await db.delete(userTenants).where(eq(userTenants.userId, userId))
      await db.delete(tenants).where(eq(tenants.id, tenantId))
      await db.delete(users).where(eq(users.id, userId))
    })

    it('should login successfully with correct credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: {
          email: testEmail,
          password: testPassword,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      expect(body.accessToken).toBeTruthy()
      expect(body.user.email).toBe(testEmail)
      expect(body.tenant).toBeDefined()
    })

    it('should set an httpOnly refresh cookie on login', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: testEmail, password: testPassword },
      })

      expect(response.statusCode).toBe(200)
      const setCookie = response.headers['set-cookie']
      expect(setCookie).toBeTruthy()
      const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie
      expect(cookieStr).toMatch(/refresh_token=/)
      expect(cookieStr).toMatch(/HttpOnly/i)
    })

    it('should return valid JWT access token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: {
          email: testEmail,
          password: testPassword,
        },
      })

      const body = JSON.parse(response.body)
      const payload = verifyToken(body.accessToken)

      expect(payload.userId).toBe(userId)
      expect(payload.tenantId).toBe(tenantId)
      expect(payload.role).toBe('admin')
    })

    it('should return 401 for non-existent email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: {
          email: 'nonexistent@example.com',
          password: testPassword,
        },
      })

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.error.code).toBe('invalid_credentials')
    })

    it('should return 401 for incorrect password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: {
          email: testEmail,
          password: 'wrong-password',
        },
      })

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.error.code).toBe('invalid_credentials')
    })

    it('should return 400 for invalid email format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: {
          email: 'invalid-email',
          password: testPassword,
        },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should return 400 for missing password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: {
          email: testEmail,
          password: '',
        },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('POST /v1/auth/refresh', () => {
    const testEmail = `refresh-test-${Date.now()}@example.com`
    const testPassword = 'password123'
    let userId: string
    let tenantId: string
    let refreshCookie: string

    beforeEach(async () => {
      // Register and capture the refresh cookie
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: {
          email: testEmail,
          password: testPassword,
          name: 'Refresh Test User',
          tenantName: 'Refresh Test Company',
        },
      })

      const body = JSON.parse(response.body)
      userId = body.user.id
      tenantId = body.tenant.id

      // Extract the raw cookie value to send in subsequent requests
      const setCookie = response.headers['set-cookie']
      const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie ?? ''
      const match = cookieStr.match(/refresh_token=([^;]+)/)
      refreshCookie = match?.[1] ?? ''
    })

    afterEach(async () => {
      await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId))
      await db.delete(userTenants).where(eq(userTenants.userId, userId))
      await db.delete(tenants).where(eq(tenants.id, tenantId))
      await db.delete(users).where(eq(users.id, userId))
    })

    it('should return a new access token with a valid refresh cookie', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        cookies: { refresh_token: refreshCookie },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.accessToken).toBeTruthy()

      // New token should be a valid JWT
      const payload = verifyToken(body.accessToken)
      expect(payload.userId).toBe(userId)
      expect(payload.tenantId).toBe(tenantId)
    })

    it('should rotate the refresh token (old one is revoked)', async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        cookies: { refresh_token: refreshCookie },
      })

      // Try to use the original refresh cookie again — should fail
      const secondResponse = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        cookies: { refresh_token: refreshCookie },
      })

      expect(secondResponse.statusCode).toBe(401)
      const body = JSON.parse(secondResponse.body)
      expect(body.error.code).toBe('invalid_refresh_token')
    })

    it('should set a new refresh cookie after rotation', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        cookies: { refresh_token: refreshCookie },
      })

      expect(response.statusCode).toBe(200)
      const setCookie = response.headers['set-cookie']
      expect(setCookie).toBeTruthy()
      const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie
      expect(cookieStr).toMatch(/refresh_token=/)
      expect(cookieStr).toMatch(/HttpOnly/i)
    })

    it('should return 401 with no refresh cookie', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
      })

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.error.code).toBe('missing_refresh_token')
    })

    it('should return 401 with an invalid refresh cookie', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        cookies: { refresh_token: 'fake-token-value' },
      })

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.error.code).toBe('invalid_refresh_token')
    })
  })

  describe('POST /v1/auth/logout', () => {
    const testEmail = `logout-test-${Date.now()}@example.com`
    const testPassword = 'password123'
    let userId: string
    let tenantId: string
    let refreshCookie: string

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: {
          email: testEmail,
          password: testPassword,
          name: 'Logout Test User',
          tenantName: 'Logout Test Company',
        },
      })

      const body = JSON.parse(response.body)
      userId = body.user.id
      tenantId = body.tenant.id

      const setCookie = response.headers['set-cookie']
      const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie ?? ''
      const match = cookieStr.match(/refresh_token=([^;]+)/)
      refreshCookie = match?.[1] ?? ''
    })

    afterEach(async () => {
      await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId))
      await db.delete(userTenants).where(eq(userTenants.userId, userId))
      await db.delete(tenants).where(eq(tenants.id, tenantId))
      await db.delete(users).where(eq(users.id, userId))
    })

    it('should return 204 and revoke the refresh token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/logout',
        cookies: { refresh_token: refreshCookie },
      })

      expect(response.statusCode).toBe(204)

      // Refresh token should now be revoked in the DB
      const stored = await db.query.refreshTokens.findFirst({
        where: eq(refreshTokens.userId, userId),
      })
      expect(stored?.revokedAt).not.toBeNull()
    })

    it('should prevent using the refresh token after logout', async () => {
      // Logout first
      await app.inject({
        method: 'POST',
        url: '/v1/auth/logout',
        cookies: { refresh_token: refreshCookie },
      })

      // Try to refresh — should fail
      const refreshResponse = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        cookies: { refresh_token: refreshCookie },
      })

      expect(refreshResponse.statusCode).toBe(401)
    })

    it('should be idempotent — safe to call twice', async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/auth/logout',
        cookies: { refresh_token: refreshCookie },
      })

      const secondResponse = await app.inject({
        method: 'POST',
        url: '/v1/auth/logout',
        cookies: { refresh_token: refreshCookie },
      })

      expect(secondResponse.statusCode).toBe(204)
    })
  })

  describe('GET /v1/auth/me', () => {
    const testEmail = `me-test-${Date.now()}@example.com`
    const testPassword = 'password123'
    let token: string
    let userId: string
    let tenantId: string

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: {
          email: testEmail,
          password: testPassword,
          name: 'Me Test User',
          tenantName: 'Me Test Company',
        },
      })

      const body = JSON.parse(response.body)
      token = body.accessToken   // renamed field
      userId = body.user.id
      tenantId = body.tenant.id
    })

    afterEach(async () => {
      await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId))
      await db.delete(userTenants).where(eq(userTenants.userId, userId))
      await db.delete(tenants).where(eq(tenants.id, tenantId))
      await db.delete(users).where(eq(users.id, userId))
    })

    it('should return current user info with valid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/auth/me',
        headers: {
          authorization: `Bearer ${token}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      expect(body.user).toBeDefined()
      expect(body.user.email).toBe(testEmail)
      expect(body.tenants).toBeDefined()
      expect(body.tenants).toHaveLength(1)
      expect(body.tenants[0].role).toBe('admin')
    })

    it('should return all tenants for user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/auth/me',
        headers: {
          authorization: `Bearer ${token}`,
        },
      })

      const body = JSON.parse(response.body)

      expect(body.tenants).toHaveLength(1)
      expect(body.tenants[0].id).toBe(tenantId)
    })

    it('should return 401 without authorization header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/auth/me',
      })

      expect(response.statusCode).toBe(401)
    })

    it('should return 401 with invalid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/auth/me',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      })

      expect(response.statusCode).toBe(401)
    })

    it('should return 401 with malformed authorization header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/auth/me',
        headers: {
          authorization: 'InvalidFormat',
        },
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('Multi-tenant user scenarios', () => {
    const testEmail = `multi-tenant-${Date.now()}@example.com`
    const testPassword = 'password123'
    let userId: string
    let tenant1Id: string
    let tenant2Id: string

    beforeEach(async () => {
      // Register user with first tenant
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: {
          email: testEmail,
          password: testPassword,
          name: 'Multi Tenant User',
          tenantName: 'First Company',
        },
      })

      const body = JSON.parse(response.body)
      userId = body.user.id
      tenant1Id = body.tenant.id

      // Create second tenant and link user
      const [tenant2] = await db
        .insert(tenants)
        .values({
          name: 'Second Company',
          tier: 'pro',
        })
        .returning()

      tenant2Id = tenant2.id

      await db.insert(userTenants).values({
        userId,
        tenantId: tenant2Id,
        role: 'member',
      })
    })

    afterEach(async () => {
      await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId))
      await db.delete(userTenants).where(eq(userTenants.userId, userId))
      await db.delete(tenants).where(eq(tenants.id, tenant1Id))
      await db.delete(tenants).where(eq(tenants.id, tenant2Id))
      await db.delete(users).where(eq(users.id, userId))
    })

    it('should return all tenants for user in /me endpoint', async () => {
      // Login to get token
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: {
          email: testEmail,
          password: testPassword,
        },
      })

      const loginBody = JSON.parse(loginResponse.body)

      // Get user info
      const meResponse = await app.inject({
        method: 'GET',
        url: '/v1/auth/me',
        headers: {
          authorization: `Bearer ${loginBody.accessToken}`,
        },
      })

      const meBody = JSON.parse(meResponse.body)

      expect(meBody.tenants).toHaveLength(2)

      const tenant1 = meBody.tenants.find((t: any) => t.id === tenant1Id)
      const tenant2 = meBody.tenants.find((t: any) => t.id === tenant2Id)

      expect(tenant1).toBeDefined()
      expect(tenant1.role).toBe('admin')
      expect(tenant2).toBeDefined()
      expect(tenant2.role).toBe('member')
    })

    it('should login with first tenant by default', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: {
          email: testEmail,
          password: testPassword,
        },
      })

      const body = JSON.parse(response.body)
      const payload = verifyToken(body.accessToken)

      // Should use first tenant (admin role)
      expect(payload.tenantId).toBe(tenant1Id)
      expect(payload.role).toBe('admin')
    })
  })
})
