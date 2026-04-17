/**
 * Provider Router Unit Tests
 * 
 * Priority: HIGH
 * Tests hybrid BYOK logic, provider selection, and tier enforcement
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getProviderForRequest, getProviderName, clearProviderCache } from './router'
import { createTestTenant, cleanupTestTenant, generateTestApiKey } from '../test/helpers'
import { db } from '../db/client'
import { tenantLLMKeys } from '../db/schema'
import { encryptApiKey } from '../lib/encryption'
import { eq } from 'drizzle-orm'

describe('Provider Router', () => {
  beforeEach(() => {
    clearProviderCache()
  })

  describe('Model to Provider Mapping', () => {
    it('should map OpenAI models correctly', () => {
      expect(getProviderName('gpt-4o')).toBe('openai')
      expect(getProviderName('gpt-4o-mini')).toBe('openai')
      expect(getProviderName('gpt-4-turbo')).toBe('openai')
      expect(getProviderName('gpt-3.5-turbo')).toBe('openai')
    })

    it('should map Anthropic models correctly', () => {
      expect(getProviderName('claude-3-5-sonnet-20241022')).toBe('anthropic')
      expect(getProviderName('claude-3-5-haiku-20241022')).toBe('anthropic')
      expect(getProviderName('claude-3-opus-20240229')).toBe('anthropic')
    })

    it('should map Google models correctly', () => {
      expect(getProviderName('gemini-2.0-flash-exp')).toBe('google')
      expect(getProviderName('gemini-1.5-pro')).toBe('google')
      expect(getProviderName('gemini-1.5-flash')).toBe('google')
    })

    it('should map Cohere models correctly', () => {
      expect(getProviderName('command-r-plus')).toBe('cohere')
      expect(getProviderName('command-r')).toBe('cohere')
      expect(getProviderName('command')).toBe('cohere')
    })

    it('should map Mistral models correctly', () => {
      expect(getProviderName('mistral-large-latest')).toBe('mistral')
      expect(getProviderName('mistral-small-latest')).toBe('mistral')
      expect(getProviderName('codestral-latest')).toBe('mistral')
    })

    it('should throw error for unknown model', () => {
      expect(() => getProviderName('unknown-model')).toThrow('Unknown model')
    })
  })

  describe('Hybrid BYOK - Gateway Key Fallback', () => {
    let tenantId: string

    beforeEach(async () => {
      const tenant = await createTestTenant('Gateway Key Test', 'pro')
      tenantId = tenant.id
    })

    afterEach(async () => {
      await cleanupTestTenant(tenantId)
    })

    it('should use gateway key when tenant has no BYOK key (pro tier)', async () => {
      const provider = await getProviderForRequest('gpt-4o-mini', tenantId)

      expect(provider).toBeDefined()
      expect(provider.id).toBe('openai')
    })

    it('should use gateway key for free tier', async () => {
      const tenant = await createTestTenant('Free Tier Test', 'free')

      const provider = await getProviderForRequest('gpt-4o-mini', tenant.id)

      expect(provider).toBeDefined()
      expect(provider.id).toBe('openai')

      await cleanupTestTenant(tenant.id)
    })

    it('should use gateway key for enterprise tier', async () => {
      const tenant = await createTestTenant('Enterprise Test', 'enterprise')

      const provider = await getProviderForRequest('gpt-4o-mini', tenant.id)

      expect(provider).toBeDefined()
      expect(provider.id).toBe('openai')

      await cleanupTestTenant(tenant.id)
    })
  })

  describe('Hybrid BYOK - Tenant Key Priority', () => {
    let tenantId: string

    beforeEach(async () => {
      const tenant = await createTestTenant('BYOK Test', 'pro')
      tenantId = tenant.id
    })

    afterEach(async () => {
      // Clean up tenant keys
      await db.delete(tenantLLMKeys).where(eq(tenantLLMKeys.tenantId, tenantId))
      await cleanupTestTenant(tenantId)
    })

    it('should prefer tenant BYOK key over gateway key', async () => {
      // Add tenant's own OpenAI key
      const tenantKey = generateTestApiKey('openai')
      const { encrypted, iv } = encryptApiKey(tenantKey)

      await db.insert(tenantLLMKeys).values({
        tenantId,
        provider: 'openai',
        apiKeyEncrypted: encrypted,
        iv,
      })

      const provider = await getProviderForRequest('gpt-4o-mini', tenantId)

      expect(provider).toBeDefined()
      expect(provider.id).toBe('openai')
      // Note: We can't directly verify which key was used without exposing internals
      // In real usage, logs would show "Using tenant BYOK"
    })

    it('should support multiple provider keys per tenant', async () => {
      // Add OpenAI key
      const openaiKey = generateTestApiKey('openai')
      const openaiEncrypted = encryptApiKey(openaiKey)
      await db.insert(tenantLLMKeys).values({
        tenantId,
        provider: 'openai',
        apiKeyEncrypted: openaiEncrypted.encrypted,
        iv: openaiEncrypted.iv,
      })

      // Add Anthropic key
      const anthropicKey = generateTestApiKey('anthropic')
      const anthropicEncrypted = encryptApiKey(anthropicKey)
      await db.insert(tenantLLMKeys).values({
        tenantId,
        provider: 'anthropic',
        apiKeyEncrypted: anthropicEncrypted.encrypted,
        iv: anthropicEncrypted.iv,
      })

      // Should get OpenAI provider for OpenAI model
      const openaiProvider = await getProviderForRequest('gpt-4o-mini', tenantId)
      expect(openaiProvider.id).toBe('openai')

      // Should get Anthropic provider for Anthropic model
      const anthropicProvider = await getProviderForRequest('claude-3-5-sonnet-20241022', tenantId)
      expect(anthropicProvider.id).toBe('anthropic')
    })
  })

  describe('Enterprise-Independent Tier Enforcement', () => {
    let tenantId: string

    beforeEach(async () => {
      const tenant = await createTestTenant('Enterprise Independent Test', 'enterprise-independent')
      tenantId = tenant.id
    })

    afterEach(async () => {
      await db.delete(tenantLLMKeys).where(eq(tenantLLMKeys.tenantId, tenantId))
      await cleanupTestTenant(tenantId)
    })

    it('should reject request without BYOK key for enterprise-independent tier', async () => {
      await expect(
        getProviderForRequest('gpt-4o-mini', tenantId)
      ).rejects.toThrow('Enterprise-independent tier requires BYOK')
    })

    it('should allow request with BYOK key for enterprise-independent tier', async () => {
      // Add tenant's own OpenAI key
      const tenantKey = generateTestApiKey('openai')
      const { encrypted, iv } = encryptApiKey(tenantKey)

      await db.insert(tenantLLMKeys).values({
        tenantId,
        provider: 'openai',
        apiKeyEncrypted: encrypted,
        iv,
      })

      const provider = await getProviderForRequest('gpt-4o-mini', tenantId)

      expect(provider).toBeDefined()
      expect(provider.id).toBe('openai')
    })

    it('should reject even if gateway key exists', async () => {
      // Even though gateway has OpenAI key in env,
      // enterprise-independent tier should not fall back to it
      await expect(
        getProviderForRequest('gpt-4o-mini', tenantId)
      ).rejects.toThrow('Enterprise-independent tier requires BYOK')
    })
  })

  describe('Provider Caching', () => {
    let tenantId: string

    beforeEach(async () => {
      const tenant = await createTestTenant('Cache Test', 'pro')
      tenantId = tenant.id
    })

    afterEach(async () => {
      await cleanupTestTenant(tenantId)
    })

    it('should cache provider instances', async () => {
      const provider1 = await getProviderForRequest('gpt-4o-mini', tenantId)
      const provider2 = await getProviderForRequest('gpt-4o-mini', tenantId)

      // Should return same instance
      expect(provider1).toBe(provider2)
    })

    it('should create separate instances for different keys', async () => {
      const tenant2 = await createTestTenant('Cache Test 2', 'pro')

      // Add different BYOK keys for each tenant
      const key1 = generateTestApiKey('openai')
      const encrypted1 = encryptApiKey(key1)
      await db.insert(tenantLLMKeys).values({
        tenantId,
        provider: 'openai',
        apiKeyEncrypted: encrypted1.encrypted,
        iv: encrypted1.iv,
      })

      const key2 = generateTestApiKey('openai')
      const encrypted2 = encryptApiKey(key2)
      await db.insert(tenantLLMKeys).values({
        tenantId: tenant2.id,
        provider: 'openai',
        apiKeyEncrypted: encrypted2.encrypted,
        iv: encrypted2.iv,
      })

      // Clear cache to ensure fresh instances
      clearProviderCache()

      const provider1 = await getProviderForRequest('gpt-4o-mini', tenantId)
      const provider2 = await getProviderForRequest('gpt-4o-mini', tenant2.id)

      // Should be different instances (different keys)
      expect(provider1).not.toBe(provider2)

      await db.delete(tenantLLMKeys).where(eq(tenantLLMKeys.tenantId, tenant2.id))
      await cleanupTestTenant(tenant2.id)
    })

    it('should clear cache when requested', async () => {
      const provider1 = await getProviderForRequest('gpt-4o-mini', tenantId)

      clearProviderCache()

      const provider2 = await getProviderForRequest('gpt-4o-mini', tenantId)

      // Should be different instances after cache clear
      expect(provider1).not.toBe(provider2)
    })
  })

  describe('Error Handling', () => {
    it('should throw error for missing gateway key', async () => {
      const tenant = await createTestTenant('No Key Test', 'pro')

      // Mock environment to remove Google API key
      const originalKey = process.env.GOOGLE_API_KEY
      delete process.env.GOOGLE_API_KEY
      
      // Clear provider cache to ensure fresh provider creation
      clearProviderCache()

      try {
        await expect(
          getProviderForRequest('gemini-1.5-pro', tenant.id)
        ).rejects.toThrow()
      } finally {
        // Restore original key
        if (originalKey) {
          process.env.GOOGLE_API_KEY = originalKey
        }
        // Clear cache again to reset state
        clearProviderCache()
      }

      await cleanupTestTenant(tenant.id)
    })

    it('should throw error for unknown provider', async () => {
      const tenant = await createTestTenant('Unknown Provider Test', 'pro')

      await expect(
        getProviderForRequest('unknown-model', tenant.id)
      ).rejects.toThrow('Unknown model')

      await cleanupTestTenant(tenant.id)
    })
  })
})
