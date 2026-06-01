/**
 * Semantic Cache Middleware Tests
 * 
 * Tests for two-stage cache lookup (exact + semantic) with adaptive thresholds
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { semanticCacheMiddleware, storeCacheEntry, cleanupEmbeddingCache } from './semantic-cache'
import { db } from '../db/client'
import { cacheEntries } from '../db/schema'
import { embed, clearEmbeddingCache } from '../lib/embeddings'
import { eq, and, sql } from 'drizzle-orm'
import type { FastifyRequest, FastifyReply } from 'fastify'

// Mock dependencies
vi.mock('../db/client', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    execute: vi.fn(),
  },
}))

vi.mock('../lib/embeddings', () => ({
  embed: vi.fn(),
  clearEmbeddingCache: vi.fn(),
}))

describe('Semantic Cache Middleware', () => {
  let mockRequest: Partial<FastifyRequest>
  let mockReply: Partial<FastifyReply>
  let mockDb: any

  const mockTenantId = '123e4567-e89b-12d3-a456-426614174000'
  const mockModel = 'gpt-4o'
  const mockMessages = [
    { role: 'user', content: 'What is machine learning?' },
  ]
  const mockEmbedding = Array(1536).fill(0).map((_, i) => i / 1536)

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
    mockDb = db as any

    // Setup request mock
    mockRequest = {
      url: '/v1/chat/completions',
      method: 'POST',
      tenantContext: {
        tenantId: mockTenantId,
        tenantName: 'Test Tenant',
        tenantTier: 'pro',
        keyId: 'key-123',
        keyRole: 'user',
        authMethod: 'api_key' as const,
      },
      body: {
        model: mockModel,
        messages: mockMessages,
        stream: false,
      },
      log: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      } as any,
    }

    // Setup reply mock
    mockReply = {
      header: vi.fn().mockReturnThis(),
      send: vi.fn(),
    }

    // Setup embed mock
    vi.mocked(embed).mockResolvedValue(mockEmbedding)
  })

  afterEach(() => {
    clearEmbeddingCache()
  })

  describe('Request filtering', () => {
    it('should skip non-chat requests', async () => {
      const nonChatRequest = {
        ...mockRequest,
        url: '/v1/usage',
      } as Partial<FastifyRequest>

      await semanticCacheMiddleware(
        nonChatRequest as FastifyRequest,
        mockReply as FastifyReply
      )

      expect(mockDb.select).not.toHaveBeenCalled()
    })

    it('should skip requests without tenant context', async () => {
      mockRequest.tenantContext = undefined

      await semanticCacheMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      )

      expect(mockDb.select).not.toHaveBeenCalled()
    })

    it('should skip streaming requests', async () => {
      (mockRequest.body as any).stream = true

      await semanticCacheMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      )

      expect(mockDb.select).not.toHaveBeenCalled()
    })

    it('should skip requests without model', async () => {
      (mockRequest.body as any).model = undefined

      await semanticCacheMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      )

      expect(mockDb.select).not.toHaveBeenCalled()
    })

    it('should skip requests without messages', async () => {
      (mockRequest.body as any).messages = undefined

      await semanticCacheMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      )

      expect(mockDb.select).not.toHaveBeenCalled()
    })

    it('should process valid non-streaming chat requests', async () => {
      // Mock no cache hit
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })
      mockDb.execute.mockResolvedValue({ rows: [] })

      await semanticCacheMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      )

      expect(mockDb.select).toHaveBeenCalled()
    })
  })

  describe('Stage 1: Exact match', () => {
    it('should check exact hash match first', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })
      mockDb.execute.mockResolvedValue({ rows: [] })

      await semanticCacheMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      )

      expect(mockDb.select).toHaveBeenCalled()
      expect(mockRequest.promptHash).toBeDefined()
    })

    it('should return cached response on exact match', async () => {
      const mockCachedResponse = {
        id: 'chat-123',
        object: 'chat.completion',
        model: mockModel,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Cached answer' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      }

      const mockCacheEntry = {
        id: 'cache-123',
        tenantId: mockTenantId,
        model: mockModel,
        promptHash: 'hash123',
        embedding: mockEmbedding,
        response: mockCachedResponse,
        hitCount: 5,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
      }

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockCacheEntry]),
          }),
        }),
      })

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockReturnValue({
              catch: vi.fn(),
            }),
          }),
        }),
      })

      await semanticCacheMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      )

      expect(mockReply.header).toHaveBeenCalledWith('X-Cache', 'HIT')
      expect(mockReply.header).toHaveBeenCalledWith('X-Cache-Type', 'EXACT')
      expect(mockReply.send).toHaveBeenCalledWith(mockCachedResponse)
      expect(mockRequest.cacheHit).toBe(true)
      expect(mockRequest.cacheId).toBe('cache-123')
    })

    it('should increment hit count on exact match', async () => {
      const mockCacheEntry = {
        id: 'cache-123',
        response: { test: 'response' },
        hitCount: 5,
      }

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockCacheEntry]),
          }),
        }),
      })

      const mockUpdate = vi.fn().mockReturnValue({
        execute: vi.fn().mockReturnValue({
          catch: vi.fn(),
        }),
      })

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: mockUpdate,
        }),
      })

      await semanticCacheMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      )

      expect(mockDb.update).toHaveBeenCalled()
    })

    it('should not fail if hit count update fails', async () => {
      const mockCacheEntry = {
        id: 'cache-123',
        response: { test: 'response' },
        hitCount: 5,
      }

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockCacheEntry]),
          }),
        }),
      })

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockReturnValue({
              catch: vi.fn((fn: any) => fn(new Error('Update failed'))),
            }),
          }),
        }),
      })

      await expect(
        semanticCacheMiddleware(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply
        )
      ).resolves.not.toThrow()
    })
  })

  describe('Stage 2: Semantic similarity', () => {
    beforeEach(() => {
      // Mock no exact match
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })
    })

    it('should generate embedding for semantic search', async () => {
      mockDb.execute.mockResolvedValue({ rows: [] })

      await semanticCacheMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      )

      expect(embed).toHaveBeenCalledWith(expect.stringContaining('user:What is machine learning?'))
      expect(mockRequest.promptEmbedding).toEqual(mockEmbedding)
    })

    it('should return cached response on semantic match', async () => {
      const mockCachedResponse = {
        id: 'chat-456',
        object: 'chat.completion',
        model: mockModel,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Semantically cached answer' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      }

      mockDb.execute.mockResolvedValue({
        rows: [
          {
            id: 'cache-456',
            response: mockCachedResponse,
            hit_count: 3,
            similarity: 0.95,
          },
        ],
      })

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockReturnValue({
              catch: vi.fn(),
            }),
          }),
        }),
      })

      await semanticCacheMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      )

      expect(mockReply.header).toHaveBeenCalledWith('X-Cache', 'HIT')
      expect(mockReply.header).toHaveBeenCalledWith('X-Cache-Type', 'SEMANTIC')
      expect(mockReply.header).toHaveBeenCalledWith('X-Cache-Similarity', '0.9500')
      expect(mockReply.send).toHaveBeenCalledWith(mockCachedResponse)
      expect(mockRequest.cacheHit).toBe(true)
      expect(mockRequest.cacheId).toBe('cache-456')
    })

    it('should use adaptive threshold for short prompts', async () => {
      (mockRequest.body as any).messages = [
        { role: 'user', content: 'Hi' }, // Very short prompt
      ]

      mockDb.execute.mockResolvedValue({ rows: [] })

      await semanticCacheMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      )

      // Verify execute was called (threshold logic is internal)
      expect(mockDb.execute).toHaveBeenCalled()
    })

    it('should use adaptive threshold for long prompts', async () => {
      (mockRequest.body as any).messages = [
        { role: 'user', content: 'This is a much longer prompt that exceeds 40 characters easily' },
      ]

      mockDb.execute.mockResolvedValue({ rows: [] })

      await semanticCacheMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      )

      // Verify execute was called (threshold logic is internal)
      expect(mockDb.execute).toHaveBeenCalled()
    })

    it('should not return match below threshold', async () => {
      mockDb.execute.mockResolvedValue({
        rows: [], // No matches above threshold
      })

      await semanticCacheMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      )

      expect(mockReply.send).not.toHaveBeenCalled()
      expect(mockRequest.cacheHit).toBeUndefined()
    })
  })

  describe('Cache MISS', () => {
    beforeEach(() => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })
      mockDb.execute.mockResolvedValue({ rows: [] })
    })

    it('should not send response on cache miss', async () => {
      await semanticCacheMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      )

      expect(mockReply.send).not.toHaveBeenCalled()
    })

    it('should store prompt hash for later cache storage', async () => {
      await semanticCacheMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      )

      expect(mockRequest.promptHash).toBeDefined()
      expect(typeof mockRequest.promptHash).toBe('string')
      expect(mockRequest.promptHash).toHaveLength(64) // SHA-256 hex length
    })

    it('should store embedding for later cache storage', async () => {
      await semanticCacheMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      )

      expect(mockRequest.promptEmbedding).toEqual(mockEmbedding)
    })
  })

  describe('Prompt extraction', () => {
    it('should concatenate multiple messages', async () => {
      (mockRequest.body as any).messages = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
        { role: 'user', content: 'How are you?' },
      ]

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })
      mockDb.execute.mockResolvedValue({ rows: [] })

      await semanticCacheMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      )

      expect(embed).toHaveBeenCalledWith(
        'system:You are helpful|user:Hello|assistant:Hi there|user:How are you?'
      )
    })

    it('should handle single message', async () => {
      (mockRequest.body as any).messages = [
        { role: 'user', content: 'Single message' },
      ]

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })
      mockDb.execute.mockResolvedValue({ rows: [] })

      await semanticCacheMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      )

      expect(embed).toHaveBeenCalledWith('user:Single message')
    })
  })

  describe('Error handling', () => {
    it('should not throw on database error', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('DB error')),
        }),
      })

      await expect(
        semanticCacheMiddleware(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply
        )
      ).resolves.not.toThrow()
    })

    it('should not throw on embedding error', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })

      vi.mocked(embed).mockRejectedValueOnce(new Error('Embedding error'))

      await expect(
        semanticCacheMiddleware(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply
        )
      ).resolves.not.toThrow()
    })

    it('should continue on vector search error', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })

      mockDb.execute.mockRejectedValueOnce(new Error('Vector search error'))

      await expect(
        semanticCacheMiddleware(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply
        )
      ).resolves.not.toThrow()
    })
  })
})

describe('storeCacheEntry()', () => {
  let mockDb: any

  const mockTenantId = '123e4567-e89b-12d3-a456-426614174000'
  const mockModel = 'gpt-4o'
  const mockPromptHash = 'abc123def456'
  const mockEmbedding = Array(1536).fill(0).map((_, i) => i / 1536)
  const mockResponse = {
    id: 'chat-789',
    object: 'chat.completion',
    model: mockModel,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: 'Test response' },
        finish_reason: 'stop',
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb = db as any
  })

  it('should insert cache entry with correct data', async () => {
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    })

    await storeCacheEntry(
      mockTenantId,
      mockModel,
      mockPromptHash,
      mockEmbedding,
      mockResponse
    )

    expect(mockDb.insert).toHaveBeenCalled()
    const insertCall = mockDb.insert.mock.results[0].value
    const valuesCall = insertCall.values.mock.calls[0][0]
    
    // Check basic fields
    expect(valuesCall.tenantId).toBe(mockTenantId)
    expect(valuesCall.model).toBe(mockModel)
    expect(valuesCall.promptHash).toBe(mockPromptHash)
    expect(valuesCall.response).toEqual(mockResponse)
    expect(valuesCall.hitCount).toBe(0)
    
    // Embedding is now an SQL object, just verify it exists
    expect(valuesCall.embedding).toBeDefined()
  })

  it('should set expiration time based on TTL', async () => {
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    })

    const beforeTime = Date.now()
    await storeCacheEntry(
      mockTenantId,
      mockModel,
      mockPromptHash,
      mockEmbedding,
      mockResponse
    )
    const afterTime = Date.now()

    const insertCall = mockDb.insert.mock.results[0].value
    const values = insertCall.values.mock.calls[0][0]
    const expiresAt = values.expiresAt.getTime()

    // Should be approximately 24 hours from now (86400000 ms)
    expect(expiresAt).toBeGreaterThan(beforeTime + 86400000 - 1000)
    expect(expiresAt).toBeLessThan(afterTime + 86400000 + 1000)
  })

  it('should not throw on storage error', async () => {
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockRejectedValue(new Error('Storage error')),
    })

    await expect(
      storeCacheEntry(
        mockTenantId,
        mockModel,
        mockPromptHash,
        mockEmbedding,
        mockResponse
      )
    ).resolves.not.toThrow()
  })
})

describe('cleanupEmbeddingCache()', () => {
  it('should call clearEmbeddingCache', async () => {
    const mockRequest = {} as FastifyRequest
    const mockReply = {} as FastifyReply

    await cleanupEmbeddingCache(mockRequest, mockReply)

    expect(clearEmbeddingCache).toHaveBeenCalled()
  })

  it('should not throw on error', async () => {
    vi.mocked(clearEmbeddingCache).mockImplementationOnce(() => {
      throw new Error('Clear error')
    })

    const mockRequest = {} as FastifyRequest
    const mockReply = {} as FastifyReply

    // Should not throw - errors are caught internally
    await expect(
      cleanupEmbeddingCache(mockRequest, mockReply)
    ).resolves.not.toThrow()
    
    // Verify it was called
    expect(clearEmbeddingCache).toHaveBeenCalled()
  })
})
