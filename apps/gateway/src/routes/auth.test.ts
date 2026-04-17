import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import { fastifyZodOpenApiPlugin, serializerCompiler, validatorCompiler } from 'fastify-zod-openapi'
import { registerAuthRoutes } from './auth'
import { db } from '../db/client'
import { users, tenants, userTenants } from '../db/schema'
import { eq } from 'drizzle-orm'
import { verifyToken } from '../lib/jwt'

describe('Auth Routes', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = Fastify()
    
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

      expect(body.token).toBeTruthy()
      expect(body.user).toBeDefined()
      expect(body.user.email).toBe(testEmail)
      expect(body.user.name).toBe(testName)
      expect(body.tenant).toBeDefined()
      expect(body.tenant.name).toBe(testTenantName)
      expect(body.tenant.tier).toBe('free')
      expect(body.tenant.role).toBe('admin')
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

    it('should return valid JWT token', async () => {
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
      const payload = verifyToken(body.token)

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

      expect(body.token).toBeTruthy()
      expect(body.user.email).toBe(testEmail)
      expect(body.tenant).toBeDefined()
    })

    it('should return valid JWT token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: {
          email: testEmail,
          password: testPassword,
        },
      })

      const body = JSON.parse(response.body)
      const payload = verifyToken(body.token)

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

  describe('GET /v1/auth/me', () => {
    const testEmail = `me-test-${Date.now()}@example.com`
    const testPassword = 'password123'
    let token: string
    let userId: string
    let tenantId: string

    beforeEach(async () => {
      // Register and get token
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
      token = body.token
      userId = body.user.id
      tenantId = body.tenant.id
    })

    afterEach(async () => {
      // Cleanup
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
      // Cleanup
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
          authorization: `Bearer ${loginBody.token}`,
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
      const payload = verifyToken(body.token)

      // Should use first tenant (admin role)
      expect(payload.tenantId).toBe(tenant1Id)
      expect(payload.role).toBe('admin')
    })
  })
})
