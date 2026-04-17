/**
 * Usage Logger Middleware Tests
 * 
 * Tests for usage logging middleware functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { usageLoggerMiddleware } from './usage-logger'
import { createTestTenant, createTestApiKey, cleanupTestTenant } from '../test/helpers'
import { db } from '../db/client'
import { usageLogs } from '../db/schema'
import { eq } from 'drizzle-orm'
import type { FastifyRequest, FastifyReply } from 'fastify'

function createMockRequest(
  url: string,
  tenantContext?: any,
  llmResult?: any,
  startTime?: number,
  requestId?: string | null
): FastifyRequest {
  const req: any = {
    url,
    tenantContext,
    llmResult,
    startTime,
    id: 'test-id',
  }
  
  // Only set requestId if explicitly provided (not undefined)
  if (requestId !== null && requestId !== undefined) {
    req.requestId = requestId
  }
  
  return req as FastifyRequest
}

function createMockReply(): FastifyReply {
  return {} as FastifyReply
}

describe('Usage Logger Middleware', () => {
  let testTenantId: string
  let testApiKeyId: string

  beforeEach(async () => {
    const tenant = await createTestTenant('Usage Logger Test')
    testTenantId = tenant.id
    const { key } = await createTestApiKey(testTenantId, 'admin')
    testApiKeyId = key.id
  })

  afterEach(async () => {
    // Clean up usage logs
    await db.delete(usageLogs).where(eq(usageLogs.tenantId, testTenantId))
    await cleanupTestTenant(testTenantId)
  })

  // Helper to wait for async logger
  async function waitForLogger() {
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  describe('Route Filtering', () => {
    it('should only log chat completion requests', async () => {
      const request = createMockRequest('/v1/usage')
      const reply = createMockReply()

      await usageLoggerMiddleware(request, reply)

      const logs = await db
        .select()
        .from(usageLogs)
        .where(eq(usageLogs.tenantId, testTenantId))

      expect(logs).toHaveLength(0)
    })

    it('should log chat completion requests', async () => {
      const request = createMockRequest(
        '/v1/chat/completions',
        { tenantId: testTenantId, keyId: testApiKeyId },
        {
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 100,
          outputTokens: 50,
          cached: false,
        },
        Date.now()
      )
      const reply = createMockReply()

      await usageLoggerMiddleware(request, reply)
      await waitForLogger()

      const logs = await db
        .select()
        .from(usageLogs)
        .where(eq(usageLogs.tenantId, testTenantId))

      expect(logs).toHaveLength(1)
    })

    it('should skip if no tenant context', async () => {
      const request = createMockRequest(
        '/v1/chat/completions',
        undefined,
        {
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 100,
          outputTokens: 50,
        }
      )
      const reply = createMockReply()

      await usageLoggerMiddleware(request, reply)

      const logs = await db
        .select()
        .from(usageLogs)
        .where(eq(usageLogs.tenantId, testTenantId))

      expect(logs).toHaveLength(0)
    })

    it('should skip if no LLM result', async () => {
      const request = createMockRequest(
        '/v1/chat/completions',
        { tenantId: testTenantId, keyId: testApiKeyId },
        undefined
      )
      const reply = createMockReply()

      await usageLoggerMiddleware(request, reply)

      const logs = await db
        .select()
        .from(usageLogs)
        .where(eq(usageLogs.tenantId, testTenantId))

      expect(logs).toHaveLength(0)
    })
  })

  describe('Usage Log Creation', () => {
    it('should create usage log with all fields', async () => {
      const startTime = Date.now()
      const request = createMockRequest(
        '/v1/chat/completions',
        { tenantId: testTenantId, keyId: testApiKeyId },
        {
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 100,
          outputTokens: 50,
          cached: false,
        },
        startTime,
        'custom-request-id'
      )
      const reply = createMockReply()

      await usageLoggerMiddleware(request, reply)
      await waitForLogger()

      const logs = await db
        .select()
        .from(usageLogs)
        .where(eq(usageLogs.tenantId, testTenantId))

      expect(logs).toHaveLength(1)
      expect(logs[0]).toMatchObject({
        tenantId: testTenantId,
        apiKeyId: testApiKeyId,
        provider: 'openai',
        model: 'gpt-4o-mini',
        inputTokens: 100,
        outputTokens: 50,
        cached: false,
        requestId: 'custom-request-id',
      })
      expect(logs[0].costUsd).toBeTruthy()
      expect(logs[0].latencyMs).toBeGreaterThanOrEqual(0)
    })

    it('should calculate cost correctly', async () => {
      const request = createMockRequest(
        '/v1/chat/completions',
        { tenantId: testTenantId, keyId: testApiKeyId },
        {
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 10000,
          outputTokens: 5000,
          cached: false,
        },
        Date.now()
      )
      const reply = createMockReply()

      await usageLoggerMiddleware(request, reply)
      await waitForLogger()

      const logs = await db
        .select()
        .from(usageLogs)
        .where(eq(usageLogs.tenantId, testTenantId))

      expect(logs).toHaveLength(1)
      // gpt-4o-mini: 10000 * 0.00000015 + 5000 * 0.0000006 = 0.0015 + 0.003 = 0.0045
      expect(parseFloat(logs[0].costUsd)).toBeCloseTo(0.0045, 4)
    })

    it('should calculate latency correctly', async () => {
      const startTime = Date.now() - 500 // 500ms ago
      const request = createMockRequest(
        '/v1/chat/completions',
        { tenantId: testTenantId, keyId: testApiKeyId },
        {
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 100,
          outputTokens: 50,
          cached: false,
        },
        startTime
      )
      const reply = createMockReply()

      await usageLoggerMiddleware(request, reply)
      await waitForLogger()

      const logs = await db
        .select()
        .from(usageLogs)
        .where(eq(usageLogs.tenantId, testTenantId))

      expect(logs).toHaveLength(1)
      expect(logs[0].latencyMs).toBeGreaterThanOrEqual(400)
      expect(logs[0].latencyMs).toBeLessThanOrEqual(600)
    })

    it('should handle missing startTime', async () => {
      const request = createMockRequest(
        '/v1/chat/completions',
        { tenantId: testTenantId, keyId: testApiKeyId },
        {
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 100,
          outputTokens: 50,
          cached: false,
        },
        undefined // No startTime
      )
      const reply = createMockReply()

      await usageLoggerMiddleware(request, reply)
      await waitForLogger()

      const logs = await db
        .select()
        .from(usageLogs)
        .where(eq(usageLogs.tenantId, testTenantId))

      expect(logs).toHaveLength(1)
      expect(logs[0].latencyMs).toBeNull()
    })

    it('should use request.id as fallback for requestId', async () => {
      const request = createMockRequest(
        '/v1/chat/completions',
        { tenantId: testTenantId, keyId: testApiKeyId },
        {
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 100,
          outputTokens: 50,
          cached: false,
        },
        Date.now(),
        null // Explicitly pass null to not set requestId
      )
      request.id = 'fallback-id'
      const reply = createMockReply()

      await usageLoggerMiddleware(request, reply)
      await waitForLogger()

      const logs = await db
        .select()
        .from(usageLogs)
        .where(eq(usageLogs.tenantId, testTenantId))

      expect(logs).toHaveLength(1)
      expect(logs[0].requestId).toBe('fallback-id')
    })
  })

  describe('Cache Status', () => {
    it('should log cache hit', async () => {
      const request = createMockRequest(
        '/v1/chat/completions',
        { tenantId: testTenantId, keyId: testApiKeyId },
        {
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 100,
          outputTokens: 50,
          cached: true,
        },
        Date.now()
      )
      const reply = createMockReply()

      await usageLoggerMiddleware(request, reply)
      await waitForLogger()

      const logs = await db
        .select()
        .from(usageLogs)
        .where(eq(usageLogs.tenantId, testTenantId))

      expect(logs).toHaveLength(1)
      expect(logs[0].cached).toBe(true)
    })

    it('should log cache miss', async () => {
      const request = createMockRequest(
        '/v1/chat/completions',
        { tenantId: testTenantId, keyId: testApiKeyId },
        {
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 100,
          outputTokens: 50,
          cached: false,
        },
        Date.now()
      )
      const reply = createMockReply()

      await usageLoggerMiddleware(request, reply)
      await waitForLogger()

      const logs = await db
        .select()
        .from(usageLogs)
        .where(eq(usageLogs.tenantId, testTenantId))

      expect(logs).toHaveLength(1)
      expect(logs[0].cached).toBe(false)
    })

    it('should default to false if cached not specified', async () => {
      const request = createMockRequest(
        '/v1/chat/completions',
        { tenantId: testTenantId, keyId: testApiKeyId },
        {
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 100,
          outputTokens: 50,
          // cached not specified
        },
        Date.now()
      )
      const reply = createMockReply()

      await usageLoggerMiddleware(request, reply)
      await waitForLogger()

      const logs = await db
        .select()
        .from(usageLogs)
        .where(eq(usageLogs.tenantId, testTenantId))

      expect(logs).toHaveLength(1)
      expect(logs[0].cached).toBe(false)
    })
  })

  describe('Different Providers and Models', () => {
    it('should log OpenAI requests', async () => {
      const request = createMockRequest(
        '/v1/chat/completions',
        { tenantId: testTenantId, keyId: testApiKeyId },
        {
          provider: 'openai',
          model: 'gpt-4o',
          inputTokens: 1000,
          outputTokens: 500,
          cached: false,
        },
        Date.now()
      )
      const reply = createMockReply()

      await usageLoggerMiddleware(request, reply)
      await waitForLogger()

      const logs = await db
        .select()
        .from(usageLogs)
        .where(eq(usageLogs.tenantId, testTenantId))

      expect(logs).toHaveLength(1)
      expect(logs[0].provider).toBe('openai')
      expect(logs[0].model).toBe('gpt-4o')
    })

    it('should log Anthropic requests', async () => {
      const request = createMockRequest(
        '/v1/chat/completions',
        { tenantId: testTenantId, keyId: testApiKeyId },
        {
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          inputTokens: 1000,
          outputTokens: 500,
          cached: false,
        },
        Date.now()
      )
      const reply = createMockReply()

      await usageLoggerMiddleware(request, reply)
      await waitForLogger()

      const logs = await db
        .select()
        .from(usageLogs)
        .where(eq(usageLogs.tenantId, testTenantId))

      expect(logs).toHaveLength(1)
      expect(logs[0].provider).toBe('anthropic')
      expect(logs[0].model).toBe('claude-3-5-sonnet-20241022')
    })

    it('should log Google requests', async () => {
      const request = createMockRequest(
        '/v1/chat/completions',
        { tenantId: testTenantId, keyId: testApiKeyId },
        {
          provider: 'google',
          model: 'gemini-1.5-pro',
          inputTokens: 1000,
          outputTokens: 500,
          cached: false,
        },
        Date.now()
      )
      const reply = createMockReply()

      await usageLoggerMiddleware(request, reply)
      await waitForLogger()

      const logs = await db
        .select()
        .from(usageLogs)
        .where(eq(usageLogs.tenantId, testTenantId))

      expect(logs).toHaveLength(1)
      expect(logs[0].provider).toBe('google')
      expect(logs[0].model).toBe('gemini-1.5-pro')
    })
  })

  describe('Error Handling', () => {
    it('should not throw on database error', async () => {
      const request = createMockRequest(
        '/v1/chat/completions',
        { tenantId: 'invalid-uuid', keyId: testApiKeyId },
        {
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 100,
          outputTokens: 50,
          cached: false,
        },
        Date.now()
      )
      const reply = createMockReply()

      // Should not throw even with invalid tenant ID
      await expect(usageLoggerMiddleware(request, reply)).resolves.not.toThrow()
    })
  })

  describe('Multiple Requests', () => {
    it('should log multiple requests separately', async () => {
      const requests = [
        {
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 100,
          outputTokens: 50,
        },
        {
          provider: 'anthropic',
          model: 'claude-3-haiku-20240307',
          inputTokens: 200,
          outputTokens: 100,
        },
        {
          provider: 'openai',
          model: 'gpt-4o',
          inputTokens: 500,
          outputTokens: 300,
        },
      ]

      for (const llmResult of requests) {
        const request = createMockRequest(
          '/v1/chat/completions',
          { tenantId: testTenantId, keyId: testApiKeyId },
          { ...llmResult, cached: false },
          Date.now()
        )
        const reply = createMockReply()
        await usageLoggerMiddleware(request, reply)
      }

      await waitForLogger()

      const logs = await db
        .select()
        .from(usageLogs)
        .where(eq(usageLogs.tenantId, testTenantId))

      expect(logs).toHaveLength(3)
      expect(logs.map(l => l.model)).toEqual([
        'gpt-4o-mini',
        'claude-3-haiku-20240307',
        'gpt-4o',
      ])
    })
  })
})

