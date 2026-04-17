/**
 * PII Masking Middleware Tests
 * 
 * Tests for PII masking middleware functionality
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { piiMaskMiddleware } from './pii-mask'
import type { FastifyRequest, FastifyReply } from 'fastify'

function createMockRequest(url: string, body?: any): FastifyRequest {
  return {
    url,
    body,
  } as FastifyRequest
}

function createMockReply(): FastifyReply {
  return {} as FastifyReply
}

describe('PII Masking Middleware', () => {
  describe('Route Filtering', () => {
    it('should only process chat completion requests', async () => {
      const request = createMockRequest('/v1/usage')
      const reply = createMockReply()

      await piiMaskMiddleware(request, reply)

      expect(request.maskedMessages).toBeUndefined()
      expect(request.piiDetected).toBeUndefined()
    })

    it('should process chat completion requests', async () => {
      const request = createMockRequest('/v1/chat/completions', {
        messages: [
          { role: 'user', content: 'Hello world' },
        ],
      })
      const reply = createMockReply()

      await piiMaskMiddleware(request, reply)

      expect(request.maskedMessages).toBeDefined()
    })

    it('should skip if no body', async () => {
      const request = createMockRequest('/v1/chat/completions')
      const reply = createMockReply()

      await piiMaskMiddleware(request, reply)

      expect(request.maskedMessages).toBeUndefined()
    })

    it('should skip if no messages in body', async () => {
      const request = createMockRequest('/v1/chat/completions', {
        model: 'gpt-4o',
      })
      const reply = createMockReply()

      await piiMaskMiddleware(request, reply)

      expect(request.maskedMessages).toBeUndefined()
    })

    it('should skip if messages is not an array', async () => {
      const request = createMockRequest('/v1/chat/completions', {
        messages: 'not an array',
      })
      const reply = createMockReply()

      await piiMaskMiddleware(request, reply)

      expect(request.maskedMessages).toBeUndefined()
    })
  })

  describe('PII Detection', () => {
    it('should detect email in messages', async () => {
      const request = createMockRequest('/v1/chat/completions', {
        messages: [
          { role: 'user', content: 'My email is john@example.com' },
        ],
      })
      const reply = createMockReply()

      await piiMaskMiddleware(request, reply)

      expect(request.piiDetected).toBe(true)
      expect(request.maskedMessages).toEqual([
        { role: 'user', content: 'My email is [EMAIL]' },
      ])
    })

    it('should detect phone number in messages', async () => {
      const request = createMockRequest('/v1/chat/completions', {
        messages: [
          { role: 'user', content: 'Call me at 555-123-4567' },
        ],
      })
      const reply = createMockReply()

      await piiMaskMiddleware(request, reply)

      expect(request.piiDetected).toBe(true)
      expect(request.maskedMessages).toEqual([
        { role: 'user', content: 'Call me at [PHONE]' },
      ])
    })

    it('should detect SSN in messages', async () => {
      const request = createMockRequest('/v1/chat/completions', {
        messages: [
          { role: 'user', content: 'My SSN is 123-45-6789' },
        ],
      })
      const reply = createMockReply()

      await piiMaskMiddleware(request, reply)

      expect(request.piiDetected).toBe(true)
      expect(request.maskedMessages).toEqual([
        { role: 'user', content: 'My SSN is [SSN]' },
      ])
    })

    it('should detect multiple PII types', async () => {
      const request = createMockRequest('/v1/chat/completions', {
        messages: [
          { role: 'user', content: 'Email john@example.com, Phone 555-123-4567' },
        ],
      })
      const reply = createMockReply()

      await piiMaskMiddleware(request, reply)

      expect(request.piiDetected).toBe(true)
      expect(request.maskedMessages).toEqual([
        { role: 'user', content: 'Email [EMAIL], Phone [PHONE]' },
      ])
    })

    it('should not detect PII in clean messages', async () => {
      const request = createMockRequest('/v1/chat/completions', {
        messages: [
          { role: 'user', content: 'What is the weather today?' },
        ],
      })
      const reply = createMockReply()

      await piiMaskMiddleware(request, reply)

      expect(request.piiDetected).toBe(false)
      expect(request.maskedMessages).toEqual([
        { role: 'user', content: 'What is the weather today?' },
      ])
    })
  })

  describe('Multiple Messages', () => {
    it('should mask PII in multiple messages', async () => {
      const request = createMockRequest('/v1/chat/completions', {
        messages: [
          { role: 'user', content: 'My email is john@example.com' },
          { role: 'assistant', content: 'I received your email' },
          { role: 'user', content: 'Call me at 555-123-4567' },
        ],
      })
      const reply = createMockReply()

      await piiMaskMiddleware(request, reply)

      expect(request.piiDetected).toBe(true)
      expect(request.maskedMessages).toEqual([
        { role: 'user', content: 'My email is [EMAIL]' },
        { role: 'assistant', content: 'I received your email' },
        { role: 'user', content: 'Call me at [PHONE]' },
      ])
    })

    it('should preserve messages without PII', async () => {
      const request = createMockRequest('/v1/chat/completions', {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
          { role: 'user', content: 'How are you?' },
        ],
      })
      const reply = createMockReply()

      await piiMaskMiddleware(request, reply)

      expect(request.piiDetected).toBe(false)
      expect(request.maskedMessages).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
      ])
    })

    it('should detect PII if any message contains it', async () => {
      const request = createMockRequest('/v1/chat/completions', {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
          { role: 'user', content: 'My email is john@example.com' },
        ],
      })
      const reply = createMockReply()

      await piiMaskMiddleware(request, reply)

      expect(request.piiDetected).toBe(true)
    })
  })

  describe('Original Message Preservation', () => {
    it('should not modify original request body', async () => {
      const originalMessages = [
        { role: 'user', content: 'My email is john@example.com' },
      ]

      const request = createMockRequest('/v1/chat/completions', {
        messages: originalMessages,
      })
      const reply = createMockReply()

      await piiMaskMiddleware(request, reply)

      // Original should be unchanged
      expect((request.body as any).messages).toEqual(originalMessages)
      expect((request.body as any).messages[0].content).toBe('My email is john@example.com')

      // Masked version should be different
      expect(request.maskedMessages![0].content).toBe('My email is [EMAIL]')
    })
  })

  describe('Error Handling', () => {
    it('should not throw on malformed messages', async () => {
      const request = createMockRequest('/v1/chat/completions', {
        messages: [
          { role: 'user' }, // Missing content
        ],
      })
      const reply = createMockReply()

      await expect(piiMaskMiddleware(request, reply)).resolves.not.toThrow()
    })

    it('should handle empty messages array', async () => {
      const request = createMockRequest('/v1/chat/completions', {
        messages: [],
      })
      const reply = createMockReply()

      await piiMaskMiddleware(request, reply)

      expect(request.maskedMessages).toEqual([])
      expect(request.piiDetected).toBe(false)
    })

    it('should handle messages with null content', async () => {
      const request = createMockRequest('/v1/chat/completions', {
        messages: [
          { role: 'user', content: null },
        ],
      })
      const reply = createMockReply()

      // Should not throw, but may not mask properly
      await expect(piiMaskMiddleware(request, reply)).resolves.not.toThrow()
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long messages', async () => {
      const longContent = 'Hello '.repeat(10000) + 'john@example.com'

      const request = createMockRequest('/v1/chat/completions', {
        messages: [
          { role: 'user', content: longContent },
        ],
      })
      const reply = createMockReply()

      await piiMaskMiddleware(request, reply)

      expect(request.piiDetected).toBe(true)
      expect(request.maskedMessages![0].content).toContain('[EMAIL]')
    })

    it('should handle messages with special characters', async () => {
      const request = createMockRequest('/v1/chat/completions', {
        messages: [
          { role: 'user', content: 'Email: john@example.com\nPhone: 555-123-4567\tSSN: 123-45-6789' },
        ],
      })
      const reply = createMockReply()

      await piiMaskMiddleware(request, reply)

      expect(request.piiDetected).toBe(true)
      expect(request.maskedMessages![0].content).toBe('Email: [EMAIL]\nPhone: [PHONE]\tSSN: [SSN]')
    })

    it('should handle messages with unicode characters', async () => {
      const request = createMockRequest('/v1/chat/completions', {
        messages: [
          { role: 'user', content: '你好 john@example.com 世界' },
        ],
      })
      const reply = createMockReply()

      await piiMaskMiddleware(request, reply)

      expect(request.piiDetected).toBe(true)
      expect(request.maskedMessages![0].content).toBe('你好 [EMAIL] 世界')
    })

    it('should handle messages with emojis', async () => {
      const request = createMockRequest('/v1/chat/completions', {
        messages: [
          { role: 'user', content: '📧 Email: john@example.com 📞 Phone: 555-123-4567' },
        ],
      })
      const reply = createMockReply()

      await piiMaskMiddleware(request, reply)

      expect(request.piiDetected).toBe(true)
      expect(request.maskedMessages![0].content).toBe('📧 Email: [EMAIL] 📞 Phone: [PHONE]')
    })
  })
})
