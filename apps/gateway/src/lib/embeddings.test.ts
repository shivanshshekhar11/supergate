/**
 * Embeddings Service Tests
 * 
 * Tests for OpenAI embedding wrapper with request-scoped memoization
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type OpenAI from 'openai'

// Create a shared mock that will be used by all tests
let mockEmbeddingsCreate: ReturnType<typeof vi.fn>

// Mock OpenAI before importing the module
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => {
      // Return a mock client with embeddings.create
      return {
        embeddings: {
          get create() {
            // Lazy getter that returns the mock function
            return mockEmbeddingsCreate
          }
        }
      }
    })
  }
})

// Now import the module after mocking
import * as embeddingsModule from './embeddings'

describe('Embeddings Service', () => {
  const mockEmbedding = Array(1536).fill(0).map((_, i) => i / 1536)

  beforeEach(() => {
    // Initialize the mock function
    mockEmbeddingsCreate = vi.fn()
    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: mockEmbedding }],
    })
    
    // Clear cache before each test
    embeddingsModule.clearEmbeddingCache()
  })

  afterEach(() => {
    embeddingsModule.clearEmbeddingCache()
  })

  describe('embed()', () => {
    it('should generate embedding for text', async () => {
      const text = 'Hello, world!'
      const result = await embeddingsModule.embed(text)

      expect(result).toEqual(mockEmbedding)
      expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(1)
      expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
        model: expect.any(String),
        input: text,
        dimensions: expect.any(Number),
      })
    })

    it('should return 1536-dimensional vector', async () => {
      const result = await embeddingsModule.embed('test')
      expect(result).toHaveLength(1536)
    })

    it('should memoize embeddings within request lifecycle', async () => {
      const text = 'Same text'

      // First call - should hit API
      const result1 = await embeddingsModule.embed(text)
      expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(1)

      // Second call with same text - should use cache
      const result2 = await embeddingsModule.embed(text)
      expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(1) // Still 1, not 2
      expect(result2).toBe(result1) // Same reference
    })

    it('should cache different texts separately', async () => {
      const text1 = 'First text'
      const text2 = 'Second text'

      const mockEmbedding1 = Array(1536).fill(0.1)
      const mockEmbedding2 = Array(1536).fill(0.2)

      mockEmbeddingsCreate
        .mockResolvedValueOnce({ data: [{ embedding: mockEmbedding1 }] })
        .mockResolvedValueOnce({ data: [{ embedding: mockEmbedding2 }] })

      const result1 = await embeddingsModule.embed(text1)
      const result2 = await embeddingsModule.embed(text2)

      expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(2)
      expect(result1).toEqual(mockEmbedding1)
      expect(result2).toEqual(mockEmbedding2)

      // Calling again should use cache
      const result1Again = await embeddingsModule.embed(text1)
      const result2Again = await embeddingsModule.embed(text2)

      expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(2) // Still 2
      expect(result1Again).toBe(result1)
      expect(result2Again).toBe(result2)
    })

    it('should handle empty string', async () => {
      const result = await embeddingsModule.embed('')
      expect(result).toEqual(mockEmbedding)
      expect(mockEmbeddingsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ input: '' })
      )
    })

    it('should handle long text', async () => {
      const longText = 'a'.repeat(10000)
      const result = await embeddingsModule.embed(longText)
      expect(result).toEqual(mockEmbedding)
    })

    it('should propagate API errors', async () => {
      mockEmbeddingsCreate.mockRejectedValueOnce(new Error('API error'))

      await expect(embeddingsModule.embed('test')).rejects.toThrow('API error')
    })
  })

  describe('clearEmbeddingCache()', () => {
    it('should clear the memoization cache', async () => {
      const text = 'Test text'

      // First call
      await embeddingsModule.embed(text)
      expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(1)
      expect(embeddingsModule.getEmbeddingCacheSize()).toBe(1)

      // Clear cache
      embeddingsModule.clearEmbeddingCache()
      expect(embeddingsModule.getEmbeddingCacheSize()).toBe(0)

      // Second call should hit API again
      await embeddingsModule.embed(text)
      expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(2)
    })

    it('should handle clearing empty cache', () => {
      expect(() => embeddingsModule.clearEmbeddingCache()).not.toThrow()
      expect(embeddingsModule.getEmbeddingCacheSize()).toBe(0)
    })

    it('should clear cache with multiple entries', async () => {
      await embeddingsModule.embed('text1')
      await embeddingsModule.embed('text2')
      await embeddingsModule.embed('text3')

      expect(embeddingsModule.getEmbeddingCacheSize()).toBe(3)

      embeddingsModule.clearEmbeddingCache()
      expect(embeddingsModule.getEmbeddingCacheSize()).toBe(0)
    })
  })

  describe('getEmbeddingCacheSize()', () => {
    it('should return 0 for empty cache', () => {
      expect(embeddingsModule.getEmbeddingCacheSize()).toBe(0)
    })

    it('should return correct size after embeddings', async () => {
      expect(embeddingsModule.getEmbeddingCacheSize()).toBe(0)

      await embeddingsModule.embed('text1')
      expect(embeddingsModule.getEmbeddingCacheSize()).toBe(1)

      await embeddingsModule.embed('text2')
      expect(embeddingsModule.getEmbeddingCacheSize()).toBe(2)

      await embeddingsModule.embed('text1') // Duplicate, shouldn't increase
      expect(embeddingsModule.getEmbeddingCacheSize()).toBe(2)
    })

    it('should return 0 after clearing cache', async () => {
      await embeddingsModule.embed('text1')
      await embeddingsModule.embed('text2')
      expect(embeddingsModule.getEmbeddingCacheSize()).toBe(2)

      embeddingsModule.clearEmbeddingCache()
      expect(embeddingsModule.getEmbeddingCacheSize()).toBe(0)
    })
  })

  describe('Request lifecycle simulation', () => {
    it('should simulate typical request flow', async () => {
      // Request starts
      const prompt = 'What is machine learning?'

      // Check cache (first embedding)
      const embedding1 = await embeddingsModule.embed(prompt)
      expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(1)

      // Store cache (second call, but memoized)
      const embedding2 = await embeddingsModule.embed(prompt)
      expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(1) // Still 1
      expect(embedding2).toBe(embedding1)

      // Request ends - clear cache
      embeddingsModule.clearEmbeddingCache()

      // Next request with same prompt - mock returns new array
      const newEmbedding = Array(1536).fill(0).map((_, i) => i / 1536)
      mockEmbeddingsCreate.mockResolvedValueOnce({ data: [{ embedding: newEmbedding }] })
      
      const embedding3 = await embeddingsModule.embed(prompt)
      expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(2) // New API call
      expect(embedding3).toEqual(embedding1) // Same value
      expect(embedding3).not.toBe(embedding1) // Different reference
    })

    it('should handle multiple concurrent embeddings', async () => {
      const texts = ['text1', 'text2', 'text3', 'text4', 'text5']

      // Simulate concurrent embedding calls
      const promises = texts.map(text => embeddingsModule.embed(text))
      const results = await Promise.all(promises)

      expect(results).toHaveLength(5)
      expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(5)

      // Call again - should all be cached
      const promises2 = texts.map(text => embeddingsModule.embed(text))
      const results2 = await Promise.all(promises2)

      expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(5) // Still 5
      results.forEach((result, i) => {
        expect(results2[i]).toBe(result)
      })
    })
  })

  describe('Memory leak prevention', () => {
    it('should not accumulate cache across requests', async () => {
      // Request 1
      await embeddingsModule.embed('request1-text1')
      await embeddingsModule.embed('request1-text2')
      expect(embeddingsModule.getEmbeddingCacheSize()).toBe(2)
      embeddingsModule.clearEmbeddingCache()

      // Request 2
      await embeddingsModule.embed('request2-text1')
      await embeddingsModule.embed('request2-text2')
      expect(embeddingsModule.getEmbeddingCacheSize()).toBe(2) // Not 4
      embeddingsModule.clearEmbeddingCache()

      // Request 3
      await embeddingsModule.embed('request3-text1')
      expect(embeddingsModule.getEmbeddingCacheSize()).toBe(1) // Not 5
    })

    it('should handle large number of unique texts', async () => {
      const texts = Array(100).fill(0).map((_, i) => `text-${i}`)

      for (const text of texts) {
        await embeddingsModule.embed(text)
      }

      expect(embeddingsModule.getEmbeddingCacheSize()).toBe(100)

      embeddingsModule.clearEmbeddingCache()
      expect(embeddingsModule.getEmbeddingCacheSize()).toBe(0)
    })
  })

  describe('Error handling', () => {
    it('should not cache failed embeddings', async () => {
      const text = 'test'

      // First call fails
      mockEmbeddingsCreate.mockRejectedValueOnce(new Error('API error'))
      await expect(embeddingsModule.embed(text)).rejects.toThrow('API error')
      expect(embeddingsModule.getEmbeddingCacheSize()).toBe(0)

      // Second call succeeds
      mockEmbeddingsCreate.mockResolvedValueOnce({ data: [{ embedding: mockEmbedding }] })
      const result = await embeddingsModule.embed(text)
      expect(result).toEqual(mockEmbedding)
      expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(2)
    })

    it('should handle malformed API response', async () => {
      mockEmbeddingsCreate.mockResolvedValueOnce({ data: [] })

      await expect(embeddingsModule.embed('test')).rejects.toThrow()
    })

    it('should handle null embedding', async () => {
      mockEmbeddingsCreate.mockResolvedValueOnce({ data: [{ embedding: null }] })

      await expect(embeddingsModule.embed('test')).rejects.toThrow()
    })
  })
})
