/**
 * Test helper utilities
 */

import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { db } from '../db/client'
import { tenants, apiKeys } from '../db/schema'
import { eq } from 'drizzle-orm'

/**
 * Create a test tenant
 */
export async function createTestTenant(
  name: string = 'Test Tenant',
  tier: 'free' | 'pro' | 'enterprise' | 'enterprise-independent' = 'pro'
) {
  const [tenant] = await db
    .insert(tenants)
    .values({ name, tier })
    .returning()
  
  return tenant
}

/**
 * Create a test API key
 */
export async function createTestApiKey(
  tenantId: string,
  role: string = 'admin',
  name: string = 'Test Key'
) {
  const rawKey = `gw_${randomBytes(24).toString('hex')}`
  const keyPrefix = rawKey.substring(0, 9) // "gw_" + 6 hex chars
  const keyHash = await bcrypt.hash(rawKey, 10)

  const [key] = await db
    .insert(apiKeys)
    .values({
      tenantId,
      keyHash,
      keyPrefix,
      role,
      name,
      revoked: false,
    })
    .returning()

  return { key, rawKey }
}

/**
 * Clean up test tenant and related data
 */
export async function cleanupTestTenant(tenantId: string) {
  // Delete API keys
  await db.delete(apiKeys).where(eq(apiKeys.tenantId, tenantId))
  
  // Delete tenant
  await db.delete(tenants).where(eq(tenants.id, tenantId))
}

/**
 * Generate a mock chat request
 */
export function mockChatRequest(model: string = 'gpt-4o-mini') {
  return {
    model,
    messages: [
      { role: 'user' as const, content: 'Hello, how are you?' }
    ],
    temperature: 0.7,
    max_tokens: 100,
  }
}

/**
 * Generate a mock chat response
 */
export function mockChatResponse(model: string = 'gpt-4o-mini') {
  return {
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion' as const,
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant' as const,
          content: 'I am doing well, thank you!',
        },
        finish_reason: 'stop' as const,
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 8,
      total_tokens: 18,
    },
  }
}

/**
 * Generate realistic test API keys for different providers
 */
export function generateTestApiKey(provider: 'openai' | 'anthropic' | 'google' | 'cohere' | 'mistral'): string {
  if (provider === 'openai') {
    // OpenAI keys: sk- + 48 chars
    return `sk-${randomBytes(24).toString('hex')}`
  }
  
  if (provider === 'anthropic') {
    // Anthropic keys: sk-ant- + ~100 chars
    return `sk-ant-${randomBytes(50).toString('hex')}`
  }
  
  if (provider === 'google') {
    // Google keys: AIza + 35 chars (39 total)
    return `AIza${randomBytes(18).toString('hex').substring(0, 35)}`
  }
  
  if (provider === 'cohere') {
    // Cohere keys: 40 chars
    return randomBytes(20).toString('hex')
  }
  
  if (provider === 'mistral') {
    // Mistral keys: 32 chars
    return randomBytes(16).toString('hex')
  }
  
  throw new Error(`Unknown provider: ${provider}`)
}

/**
 * Wait for a specified time (for async operations)
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
