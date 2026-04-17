/**
 * Usage Routes Tests
 * 
 * Integration tests for usage query endpoints
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import { usageRoutes } from './usage'
import { authMiddleware } from '../middleware/auth'
import { createTestTenant, createTestApiKey, cleanupTestTenant } from '../test/helpers'
import { db } from '../db/client'
import { usageLogs, tenantLLMKeys } from '../db/schema'
import { eq } from 'drizzle-orm'

describe('Usage Routes', () => {
  let app: FastifyInstance
  let testTenantId: string
  let testApiKey: string
  let testApiKeyId: string

  beforeAll(async () => {
    app = Fastify()

    // Register auth middleware
    app.addHook('onRequest', authMiddleware)

    // Register usage routes
    await app.register(usageRoutes)

    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(async () => {
    const tenant = await createTestTenant('Usage Test')
    testTenantId = tenant.id

    const { rawKey, key } = await createTestApiKey(testTenantId, 'admin')
    testApiKey = rawKey
    testApiKeyId = key.id
  })

  afterEach(async () => {
    // Clean up usage logs
    await db.delete(usageLogs).where(eq(usageLogs.tenantId, testTenantId))
    // Clean up tenant LLM keys
    await db.delete(tenantLLMKeys).where(eq(tenantLLMKeys.tenantId, testTenantId))
    await cleanupTestTenant(testTenantId)
  })

  describe('GET /v1/usage', () => {
    it('should return empty usage summary when no data', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/usage?period=daily',
        headers: {
          authorization: `Bearer ${testApiKey}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.body)

      expect(data).toMatchObject({
        period: 'daily',
        totalCostUsd: 0,
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        cacheHitRate: 0,
        avgLatencyMs: 0,
        days: [],
      })
    })

    it('should return usage summary with data', async () => {
      // Insert test usage logs
      await db.insert(usageLogs).values([
        {
          tenantId: testTenantId,
          apiKeyId: testApiKeyId,
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 100,
          outputTokens: 50,
          costUsd: '0.00015',
          latencyMs: 500,
          cached: false,
          requestId: 'req-1',
        },
        {
          tenantId: testTenantId,
          apiKeyId: testApiKeyId,
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 200,
          outputTokens: 100,
          costUsd: '0.0003',
          latencyMs: 600,
          cached: true,
          requestId: 'req-2',
        },
      ])

      const response = await app.inject({
        method: 'GET',
        url: '/v1/usage?period=daily',
        headers: {
          authorization: `Bearer ${testApiKey}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.body)

      expect(data.period).toBe('daily')
      expect(data.totalCostUsd).toBeCloseTo(0.00045, 5)
      expect(data.totalRequests).toBe(2)
      expect(data.totalInputTokens).toBe(300)
      expect(data.totalOutputTokens).toBe(150)
      expect(data.cacheHitRate).toBe(0.5) // 1 out of 2
      expect(data.avgLatencyMs).toBe(550) // (500 + 600) / 2
      expect(data.days).toHaveLength(1)
    })

    it('should calculate cache hit rate correctly', async () => {
      // Insert test usage logs: 3 hits, 2 misses
      await db.insert(usageLogs).values([
        {
          tenantId: testTenantId,
          apiKeyId: testApiKeyId,
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 100,
          outputTokens: 50,
          costUsd: '0.00015',
          latencyMs: 500,
          cached: true,
          requestId: 'req-1',
        },
        {
          tenantId: testTenantId,
          apiKeyId: testApiKeyId,
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 100,
          outputTokens: 50,
          costUsd: '0.00015',
          latencyMs: 500,
          cached: true,
          requestId: 'req-2',
        },
        {
          tenantId: testTenantId,
          apiKeyId: testApiKeyId,
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 100,
          outputTokens: 50,
          costUsd: '0.00015',
          latencyMs: 500,
          cached: true,
          requestId: 'req-3',
        },
        {
          tenantId: testTenantId,
          apiKeyId: testApiKeyId,
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 100,
          outputTokens: 50,
          costUsd: '0.00015',
          latencyMs: 500,
          cached: false,
          requestId: 'req-4',
        },
        {
          tenantId: testTenantId,
          apiKeyId: testApiKeyId,
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 100,
          outputTokens: 50,
          costUsd: '0.00015',
          latencyMs: 500,
          cached: false,
          requestId: 'req-5',
        },
      ])

      const response = await app.inject({
        method: 'GET',
        url: '/v1/usage?period=daily',
        headers: {
          authorization: `Bearer ${testApiKey}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.body)

      expect(data.cacheHitRate).toBe(0.6) // 3 out of 5
    })

    it('should support different periods', async () => {
      const periods = ['daily', 'weekly', 'monthly']

      for (const period of periods) {
        const response = await app.inject({
          method: 'GET',
          url: `/v1/usage?period=${period}`,
          headers: {
            authorization: `Bearer ${testApiKey}`,
          },
        })

        expect(response.statusCode).toBe(200)
        const data = JSON.parse(response.body)
        expect(data.period).toBe(period)
      }
    })

    it('should default to daily period', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/usage',
        headers: {
          authorization: `Bearer ${testApiKey}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.body)
      expect(data.period).toBe('daily')
    })

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/usage?period=daily',
      })

      expect(response.statusCode).toBe(401)
    })

    it('should only show data for authenticated tenant', async () => {
      // Create another tenant with data
      const otherTenant = await createTestTenant('Other Tenant')
      const { key: otherKey } = await createTestApiKey(otherTenant.id, 'admin')
      await db.insert(usageLogs).values({
        tenantId: otherTenant.id,
        apiKeyId: otherKey.id,
        provider: 'openai',
        model: 'gpt-4o-mini',
        inputTokens: 1000,
        outputTokens: 500,
        costUsd: '0.0015',
        latencyMs: 500,
        cached: false,
        requestId: 'other-req',
      })

      // Query with test tenant's key
      const response = await app.inject({
        method: 'GET',
        url: '/v1/usage?period=daily',
        headers: {
          authorization: `Bearer ${testApiKey}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.body)

      // Should not see other tenant's data
      expect(data.totalRequests).toBe(0)

      // Cleanup
      await db.delete(usageLogs).where(eq(usageLogs.tenantId, otherTenant.id))
      await cleanupTestTenant(otherTenant.id)
    })

    it('should group data by day', async () => {
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      // Insert logs for today and yesterday
      await db.insert(usageLogs).values([
        {
          tenantId: testTenantId,
          apiKeyId: testApiKeyId,
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 100,
          outputTokens: 50,
          costUsd: '0.00015',
          latencyMs: 500,
          cached: false,
          requestId: 'req-today',
          createdAt: today,
        },
        {
          tenantId: testTenantId,
          apiKeyId: testApiKeyId,
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 200,
          outputTokens: 100,
          costUsd: '0.0003',
          latencyMs: 600,
          cached: true,
          requestId: 'req-yesterday',
          createdAt: yesterday,
        },
      ])

      const response = await app.inject({
        method: 'GET',
        url: '/v1/usage?period=daily',
        headers: {
          authorization: `Bearer ${testApiKey}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.body)

      expect(data.days).toHaveLength(2)
      expect(data.days[0].requests).toBeGreaterThan(0)
      expect(data.days[1].requests).toBeGreaterThan(0)
    })
  })

  describe('GET /v1/usage/breakdown', () => {
    it('should return empty breakdown when no data', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/usage/breakdown',
        headers: {
          authorization: `Bearer ${testApiKey}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.body)

      expect(Array.isArray(data)).toBe(true)
      expect(data).toHaveLength(0)
    })

    it('should return breakdown by model and provider', async () => {
      // Insert test usage logs for different models
      await db.insert(usageLogs).values([
        {
          tenantId: testTenantId,
          apiKeyId: testApiKeyId,
          provider: 'openai',
          model: 'gpt-4o',
          inputTokens: 1000,
          outputTokens: 500,
          costUsd: '0.0075',
          latencyMs: 500,
          cached: false,
          requestId: 'req-1',
        },
        {
          tenantId: testTenantId,
          apiKeyId: testApiKeyId,
          provider: 'openai',
          model: 'gpt-4o',
          inputTokens: 500,
          outputTokens: 250,
          costUsd: '0.00375',
          latencyMs: 400,
          cached: false,
          requestId: 'req-2',
        },
        {
          tenantId: testTenantId,
          apiKeyId: testApiKeyId,
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 10000,
          outputTokens: 5000,
          costUsd: '0.0045',
          latencyMs: 300,
          cached: false,
          requestId: 'req-3',
        },
        {
          tenantId: testTenantId,
          apiKeyId: testApiKeyId,
          provider: 'anthropic',
          model: 'claude-3-haiku-20240307',
          inputTokens: 5000,
          outputTokens: 2500,
          costUsd: '0.00438',
          latencyMs: 350,
          cached: false,
          requestId: 'req-4',
        },
      ])

      const response = await app.inject({
        method: 'GET',
        url: '/v1/usage/breakdown',
        headers: {
          authorization: `Bearer ${testApiKey}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.body)

      expect(Array.isArray(data)).toBe(true)
      expect(data).toHaveLength(3) // 3 unique model+provider combinations

      // Should be sorted by cost descending
      expect(data[0].model).toBe('gpt-4o')
      expect(data[0].provider).toBe('openai')
      expect(data[0].requests).toBe(2)
      expect(data[0].costUsd).toBeCloseTo(0.01125, 5)
      expect(data[0].inputTokens).toBe(1500)
      expect(data[0].outputTokens).toBe(750)
    })

    it('should aggregate by model and provider', async () => {
      // Insert multiple requests for same model
      await db.insert(usageLogs).values([
        {
          tenantId: testTenantId,
          apiKeyId: testApiKeyId,
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 100,
          outputTokens: 50,
          costUsd: '0.00015',
          latencyMs: 500,
          cached: false,
          requestId: 'req-1',
        },
        {
          tenantId: testTenantId,
          apiKeyId: testApiKeyId,
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 200,
          outputTokens: 100,
          costUsd: '0.0003',
          latencyMs: 600,
          cached: false,
          requestId: 'req-2',
        },
        {
          tenantId: testTenantId,
          apiKeyId: testApiKeyId,
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 300,
          outputTokens: 150,
          costUsd: '0.00045',
          latencyMs: 700,
          cached: false,
          requestId: 'req-3',
        },
      ])

      const response = await app.inject({
        method: 'GET',
        url: '/v1/usage/breakdown',
        headers: {
          authorization: `Bearer ${testApiKey}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.body)

      expect(data).toHaveLength(1)
      expect(data[0]).toMatchObject({
        model: 'gpt-4o-mini',
        provider: 'openai',
        requests: 3,
        inputTokens: 600,
        outputTokens: 300,
      })
      expect(data[0].costUsd).toBeCloseTo(0.0009, 5)
    })

    it('should sort by cost descending', async () => {
      // Insert logs with different costs
      await db.insert(usageLogs).values([
        {
          tenantId: testTenantId,
          apiKeyId: testApiKeyId,
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 100,
          outputTokens: 50,
          costUsd: '0.0001',
          latencyMs: 500,
          cached: false,
          requestId: 'req-1',
        },
        {
          tenantId: testTenantId,
          apiKeyId: testApiKeyId,
          provider: 'openai',
          model: 'gpt-4o',
          inputTokens: 1000,
          outputTokens: 500,
          costUsd: '0.01',
          latencyMs: 600,
          cached: false,
          requestId: 'req-2',
        },
        {
          tenantId: testTenantId,
          apiKeyId: testApiKeyId,
          provider: 'anthropic',
          model: 'claude-3-haiku-20240307',
          inputTokens: 500,
          outputTokens: 250,
          costUsd: '0.0005',
          latencyMs: 400,
          cached: false,
          requestId: 'req-3',
        },
      ])

      const response = await app.inject({
        method: 'GET',
        url: '/v1/usage/breakdown',
        headers: {
          authorization: `Bearer ${testApiKey}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.body)

      expect(data).toHaveLength(3)
      // Should be sorted by cost descending
      expect(data[0].model).toBe('gpt-4o')
      expect(data[1].model).toBe('claude-3-haiku-20240307')
      expect(data[2].model).toBe('gpt-4o-mini')
    })

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/usage/breakdown',
      })

      expect(response.statusCode).toBe(401)
    })

    it('should only show data for authenticated tenant', async () => {
      // Create another tenant with data
      const otherTenant = await createTestTenant('Other Tenant')
      const { key: otherKey } = await createTestApiKey(otherTenant.id, 'admin')
      await db.insert(usageLogs).values({
        tenantId: otherTenant.id,
        apiKeyId: otherKey.id,
        provider: 'openai',
        model: 'gpt-4o',
        inputTokens: 1000,
        outputTokens: 500,
        costUsd: '0.0075',
        latencyMs: 500,
        cached: false,
        requestId: 'other-req',
      })

      // Query with test tenant's key
      const response = await app.inject({
        method: 'GET',
        url: '/v1/usage/breakdown',
        headers: {
          authorization: `Bearer ${testApiKey}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.body)

      // Should not see other tenant's data
      expect(data).toHaveLength(0)

      // Cleanup
      await db.delete(usageLogs).where(eq(usageLogs.tenantId, otherTenant.id))
      await cleanupTestTenant(otherTenant.id)
    })
  })
})


