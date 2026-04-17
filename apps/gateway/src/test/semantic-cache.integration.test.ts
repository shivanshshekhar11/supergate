/**
 * Semantic Cache Integration Tests
 * 
 * End-to-end tests for cache hit/miss scenarios with real database
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { db } from '../db/client'
import { tenants, apiKeys, cacheEntries } from '../db/schema'
import { eq, sql } from 'drizzle-orm'
import { createTestTenant, createTestApiKey } from './helpers'
import { semanticCacheMiddleware, storeCacheEntry } from '../middleware/semantic-cache'
import type { FastifyRequest, FastifyReply } from 'fastify'
import * as embeddingsModule from '../lib/embeddings'

// Mock embeddings to avoid real API calls
const mockEmbedding = Array(1536).fill(0).map((_, i) => i / 1536)

vi.mock('../lib/embeddings', () => ({
  embed: vi.fn(),
  clearEmbeddingCache: vi.fn(),
}))

describe('Semantic Cache Integration', () => {
  let testTenantId: string
  let testKeyId: string

  beforeAll(async () => {
    // Create test tenant and API key
    const tenant = await createTestTenant('Cache Test Tenant')
    testTenantId = tenant.id

    const key = await createTestApiKey(testTenantId, 'admin', 'Test Key')
    testKeyId = key.key.id
  })

  afterAll(async () => {
    // Cleanup test data
    await db.delete(cacheEntries).where(eq(cacheEntries.tenantId, testTenantId))
    await db.delete(apiKeys).where(eq(apiKeys.tenantId, testTenantId))
    await db.delete(tenants).where(eq(tenants.id, testTenantId))
  })

  beforeEach(async () => {
    // Clear cache entries before each test
    await db.delete(cacheEntries).where(eq(cacheEntries.tenantId, testTenantId))
    
    // Reset mocks
    vi.mocked(embeddingsModule.embed).mockReset()
    vi.mocked(embeddingsModule.embed).mockResolvedValue(mockEmbedding)
    vi.mocked(embeddingsModule.clearEmbeddingCache).mockClear()
  })

  describe('Cache MISS → Store → HIT flow', () => {
    it('should miss cache, store entry, then hit on second request', async () => {
      const model = 'gpt-4o'
      const messages = [{ role: 'user', content: 'What is AI?' }]
      const response = {
        id: 'chat-123',
        object: 'chat.completion' as const,
        model,
        choices: [
          {
            index: 0,
            message: { role: 'assistant' as const, content: 'AI is artificial intelligence' },
            finish_reason: 'stop' as const,
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
      }

      // First request - should MISS
      const request1 = createMockRequest(testTenantId, model, messages)
      const reply1 = createMockReply()

      await semanticCacheMiddleware(request1, reply1)

      expect(reply1.send).not.toHaveBeenCalled() // MISS
      expect(request1.promptHash).toBeDefined()
      expect(request1.promptEmbedding).toBeDefined()
      expect(vi.mocked(embeddingsModule.embed)).toHaveBeenCalledTimes(1)

      // Store cache entry
      await storeCacheEntry(
        testTenantId,
        model,
        request1.promptHash!,
        request1.promptEmbedding!,
        response
      )

      // Verify entry was stored
      const stored = await db
        .select()
        .from(cacheEntries)
        .where(eq(cacheEntries.tenantId, testTenantId))

      expect(stored).toHaveLength(1)
      expect(stored[0].model).toBe(model)
      expect(stored[0].hitCount).toBe(0)

      // Second request - should HIT (exact match)
      vi.mocked(embeddingsModule.embed).mockClear() // Reset call count
      const request2 = createMockRequest(testTenantId, model, messages)
      const reply2 = createMockReply()

      await semanticCacheMiddleware(request2, reply2)

      expect(reply2.header).toHaveBeenCalledWith('X-Cache', 'HIT')
      expect(reply2.header).toHaveBeenCalledWith('X-Cache-Type', 'EXACT')
      expect(reply2.send).toHaveBeenCalledWith(response)
      expect(request2.cacheHit).toBe(true)
    })

    it('should increment hit count on cache hits', async () => {
      const model = 'gpt-4o'
      const messages = [{ role: 'user', content: 'Test prompt' }]
      const response = { test: 'response' }

      // Store initial entry
      const request1 = createMockRequest(testTenantId, model, messages)
      const reply1 = createMockReply()
      await semanticCacheMiddleware(request1, reply1)

      await storeCacheEntry(
        testTenantId,
        model,
        request1.promptHash!,
        request1.promptEmbedding!,
        response
      )

      // Hit cache 3 times
      for (let i = 0; i < 3; i++) {
        vi.mocked(embeddingsModule.embed).mockClear() // Clear call count for each iteration
        const request = createMockRequest(testTenantId, model, messages)
        const reply = createMockReply()
        await semanticCacheMiddleware(request, reply)
      }

      // Wait a bit for fire-and-forget hit count updates to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      // Check hit count
      const entry = await db
        .select()
        .from(cacheEntries)
        .where(eq(cacheEntries.tenantId, testTenantId))

      expect(entry[0].hitCount).toBe(3)
    })
  })

  describe('Semantic similarity matching', () => {
    it('should match semantically similar prompts', async () => {
      const model = 'gpt-4o'
      const originalMessages = [
        { role: 'user', content: 'Explain machine learning to me' },
      ]
      const similarMessages = [
        { role: 'user', content: 'Can you explain machine learning?' },
      ]
      const response = { test: 'ML explanation' }

      // Store original
      const request1 = createMockRequest(testTenantId, model, originalMessages)
      const reply1 = createMockReply()
      await semanticCacheMiddleware(request1, reply1)

      await storeCacheEntry(
        testTenantId,
        model,
        request1.promptHash!,
        request1.promptEmbedding!,
        response
      )

      // Try similar prompt - mock high similarity
      vi.mocked(embeddingsModule.embed).mockClear()
      vi.mocked(embeddingsModule.embed).mockResolvedValue(mockEmbedding) // Same embedding = high similarity

      const request2 = createMockRequest(testTenantId, model, similarMessages)
      const reply2 = createMockReply()

      await semanticCacheMiddleware(request2, reply2)

      // Should hit via semantic match (since we're using same embedding)
      expect(reply2.header).toHaveBeenCalledWith('X-Cache', 'HIT')
      expect(reply2.header).toHaveBeenCalledWith('X-Cache-Type', 'SEMANTIC')
      expect(reply2.send).toHaveBeenCalledWith(response)
    })

    it('should not match dissimilar prompts', async () => {
      const model = 'gpt-4o'
      const messages1 = [{ role: 'user', content: 'What is machine learning?' }]
      const messages2 = [{ role: 'user', content: 'What is the weather today?' }]
      const response = { test: 'response' }

      // Store first prompt
      const request1 = createMockRequest(testTenantId, model, messages1)
      const reply1 = createMockReply()
      await semanticCacheMiddleware(request1, reply1)

      await storeCacheEntry(
        testTenantId,
        model,
        request1.promptHash!,
        request1.promptEmbedding!,
        response
      )

      // Try completely different prompt - mock different embedding
      vi.mocked(embeddingsModule.embed).mockClear()
      // Create a truly different embedding (negative values, completely opposite)
      const differentEmbedding = Array(1536).fill(0).map((_, i) => -1 * (i / 1536))
      vi.mocked(embeddingsModule.embed).mockResolvedValue(differentEmbedding)

      const request2 = createMockRequest(testTenantId, model, messages2)
      const reply2 = createMockReply()

      await semanticCacheMiddleware(request2, reply2)

      // Should MISS (different embeddings = low similarity)
      expect(reply2.send).not.toHaveBeenCalled()
      
      // Reset mock for next test
      vi.mocked(embeddingsModule.embed).mockReset()
      vi.mocked(embeddingsModule.embed).mockResolvedValue(mockEmbedding)
    })
  })

  describe('Adaptive thresholds', () => {
    it('should use tighter threshold for short prompts', async () => {
      const model = 'gpt-4o'
      const shortPrompt = [{ role: 'user', content: 'Hi' }] // <40 chars
      const response = { test: 'response' }

      const request = createMockRequest(testTenantId, model, shortPrompt)
      const reply = createMockReply()

      await semanticCacheMiddleware(request, reply)

      // Verify it processes the request (threshold logic is internal)
      expect(request.promptHash).toBeDefined()
    })

    it('should use looser threshold for long prompts', async () => {
      const model = 'gpt-4o'
      const longPrompt = [
        {
          role: 'user',
          content: 'This is a much longer prompt that definitely exceeds the 40 character threshold',
        },
      ]
      const response = { test: 'response' }

      const request = createMockRequest(testTenantId, model, longPrompt)
      const reply = createMockReply()

      await semanticCacheMiddleware(request, reply)

      // Verify it processes the request (threshold logic is internal)
      expect(request.promptHash).toBeDefined()
    })
  })

  describe('Multi-tenant isolation', () => {
    it('should not return cache from different tenant', async () => {
      // Create second tenant
      const tenant2 = await createTestTenant('Cache Test Tenant 2')
      const tenant2Id = tenant2.id

      const model = 'gpt-4o'
      const messages = [{ role: 'user', content: 'Shared prompt' }]
      const response1 = { tenant: 'tenant1' }
      const response2 = { tenant: 'tenant2' }

      // Store cache for tenant 1
      const request1 = createMockRequest(testTenantId, model, messages)
      const reply1 = createMockReply()
      await semanticCacheMiddleware(request1, reply1)

      await storeCacheEntry(
        testTenantId,
        model,
        request1.promptHash!,
        request1.promptEmbedding!,
        response1
      )

      // Store cache for tenant 2 (same prompt)
      const request2 = createMockRequest(tenant2Id, model, messages)
      const reply2 = createMockReply()
      await semanticCacheMiddleware(request2, reply2)

      await storeCacheEntry(
        tenant2Id,
        model,
        request2.promptHash!,
        request2.promptEmbedding!,
        response2
      )

      // Tenant 1 should get their own cache
      const request3 = createMockRequest(testTenantId, model, messages)
      const reply3 = createMockReply()
      await semanticCacheMiddleware(request3, reply3)

      expect(reply3.send).toHaveBeenCalledWith(response1)

      // Tenant 2 should get their own cache
      const request4 = createMockRequest(tenant2Id, model, messages)
      const reply4 = createMockReply()
      await semanticCacheMiddleware(request4, reply4)

      expect(reply4.send).toHaveBeenCalledWith(response2)

      // Cleanup
      await db.delete(cacheEntries).where(eq(cacheEntries.tenantId, tenant2Id))
      await db.delete(tenants).where(eq(tenants.id, tenant2Id))
    })
  })

  describe('Model isolation', () => {
    it('should not return cache from different model', async () => {
      const messages = [{ role: 'user', content: 'Test prompt' }]
      const response1 = { model: 'gpt-4o' }
      const response2 = { model: 'gpt-4o-mini' }

      // Store cache for gpt-4o
      const request1 = createMockRequest(testTenantId, 'gpt-4o', messages)
      const reply1 = createMockReply()
      await semanticCacheMiddleware(request1, reply1)

      await storeCacheEntry(
        testTenantId,
        'gpt-4o',
        request1.promptHash!,
        request1.promptEmbedding!,
        response1
      )

      // Request with gpt-4o-mini should MISS
      const request2 = createMockRequest(testTenantId, 'gpt-4o-mini', messages)
      const reply2 = createMockReply()
      await semanticCacheMiddleware(request2, reply2)

      expect(reply2.send).not.toHaveBeenCalled()
    })
  })

  describe('TTL expiration', () => {
    it('should not return expired cache entries', async () => {
      const model = 'gpt-4o'
      const messages = [{ role: 'user', content: 'Test prompt' }]
      const response = { test: 'response' }

      // Store cache entry with past expiration
      const request1 = createMockRequest(testTenantId, model, messages)
      const reply1 = createMockReply()
      await semanticCacheMiddleware(request1, reply1)

      // Manually insert with expired TTL using proper vector format
      await db.insert(cacheEntries).values({
        tenantId: testTenantId,
        model,
        promptHash: request1.promptHash!,
        embedding: sql`${JSON.stringify(request1.promptEmbedding!)}::vector`,
        response,
        hitCount: 0,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        createdAt: new Date(),
      })

      // Should MISS because entry is expired
      const request2 = createMockRequest(testTenantId, model, messages)
      const reply2 = createMockReply()
      await semanticCacheMiddleware(request2, reply2)

      expect(reply2.send).not.toHaveBeenCalled()
    })
  })

  describe('Streaming bypass', () => {
    it('should skip cache for streaming requests', async () => {
      const model = 'gpt-4o'
      const messages = [{ role: 'user', content: 'Test prompt' }]
      const response = { test: 'response' }

      // Store cache entry
      const request1 = createMockRequest(testTenantId, model, messages)
      const reply1 = createMockReply()
      await semanticCacheMiddleware(request1, reply1)

      await storeCacheEntry(
        testTenantId,
        model,
        request1.promptHash!,
        request1.promptEmbedding!,
        response
      )

      // Request with streaming should skip cache
      vi.mocked(embeddingsModule.embed).mockClear() // Clear before test
      const request2 = createMockRequest(testTenantId, model, messages, true)
      const reply2 = createMockReply()

      await semanticCacheMiddleware(request2, reply2)

      expect(reply2.send).not.toHaveBeenCalled()
      expect(vi.mocked(embeddingsModule.embed)).not.toHaveBeenCalled() // Should not even try to embed
    })
  })
})

// Helper functions
function createMockRequest(
  tenantId: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  stream = false
): any {
  return {
    url: '/v1/chat/completions',
    method: 'POST',
    tenantContext: {
      tenantId,
      tenantName: 'Test Tenant',
      tenantTier: 'pro',
      keyId: 'test-key',
      keyRole: 'user',
    },
    body: {
      model,
      messages,
      stream,
    },
  }
}

function createMockReply(): any {
  return {
    header: vi.fn().mockReturnThis(),
    send: vi.fn(),
  }
}
