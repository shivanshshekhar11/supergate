import { db } from '../db/client'
import { tenantLLMKeys, tenants } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { encryptApiKey, decryptApiKey, maskApiKey, validateApiKeyFormat } from './encryption'

/**
 * Tenant tier type
 */
export type TenantTier = 'free' | 'pro' | 'enterprise' | 'enterprise-independent'

/**
 * In-memory cache for decrypted tenant keys
 * Reduces database queries and decryption overhead
 * Keys expire after 5 minutes for security
 */
const keyCache = new Map<string, { key: string; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * In-memory cache for tenant tiers
 * Reduces database queries for tier checks
 * Tiers expire after 10 minutes
 */
const tierCache = new Map<string, { tier: TenantTier; expiresAt: number }>()
const TIER_CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

/**
 * Get tenant's tier
 * Used to determine if gateway key fallback is allowed
 */
export async function getTenantTier(tenantId: string): Promise<TenantTier> {
  // Check cache first
  const cached = tierCache.get(tenantId)
  
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tier
  }
  
  // Query database
  const result = await db
    .select({ tier: tenants.tier })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)
  
  if (result.length === 0) {
    throw new Error(`Tenant not found: ${tenantId}`)
  }
  
  const tier = result[0].tier as TenantTier
  
  // Cache for 10 minutes
  tierCache.set(tenantId, {
    tier,
    expiresAt: Date.now() + TIER_CACHE_TTL_MS,
  })
  
  return tier
}

/**
 * Get tenant's LLM API key for a specific provider
 * Returns null if tenant hasn't provided their own key (will fall back to gateway key)
 */
export async function getTenantLLMKey(
  tenantId: string,
  provider: 'openai' | 'anthropic' | 'google' | 'cohere' | 'mistral'
): Promise<string | null> {
  // Check cache first
  const cacheKey = `${tenantId}:${provider}`
  const cached = keyCache.get(cacheKey)
  
  if (cached && cached.expiresAt > Date.now()) {
    return cached.key
  }
  
  // Query database
  const result = await db
    .select()
    .from(tenantLLMKeys)
    .where(
      and(
        eq(tenantLLMKeys.tenantId, tenantId),
        eq(tenantLLMKeys.provider, provider),
        eq(tenantLLMKeys.isActive, true)
      )
    )
    .limit(1)
  
  if (result.length === 0) {
    return null // No tenant key, will use gateway key
  }
  
  // Decrypt key
  const decrypted = decryptApiKey(result[0].apiKeyEncrypted, result[0].iv)
  
  // Cache for 5 minutes
  keyCache.set(cacheKey, {
    key: decrypted,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })
  
  // Update last_used timestamp (fire and forget)
  db.update(tenantLLMKeys)
    .set({ lastUsed: new Date() })
    .where(eq(tenantLLMKeys.id, result[0].id))
    .execute()
    .catch((err) => console.error('Failed to update last_used:', err))
  
  return decrypted
}

/**
 * Store a tenant's LLM API key (BYOK)
 * Throws error if key already exists for this provider
 */
export async function storeTenantLLMKey(
  tenantId: string,
  provider: 'openai' | 'anthropic' | 'google' | 'cohere' | 'mistral',
  apiKey: string
): Promise<{ id: string; apiKeyMasked: string; createdAt: Date }> {
  // Validate key format
  if (!validateApiKeyFormat(apiKey, provider)) {
    throw new Error(`Invalid ${provider} API key format`)
  }
  
  // Check if key already exists for this provider
  const existing = await db
    .select()
    .from(tenantLLMKeys)
    .where(
      and(
        eq(tenantLLMKeys.tenantId, tenantId),
        eq(tenantLLMKeys.provider, provider),
        eq(tenantLLMKeys.isActive, true)
      )
    )
    .limit(1)
  
  if (existing.length > 0) {
    throw new Error(`Key already exists for provider ${provider}. Use PUT to update.`)
  }
  
  // Encrypt the key
  const { encrypted, iv } = encryptApiKey(apiKey)
  
  // Insert new key
  const [result] = await db
    .insert(tenantLLMKeys)
    .values({
      tenantId,
      provider,
      apiKeyEncrypted: encrypted,
      iv,
      isActive: true,
    })
    .returning()
  
  // Invalidate cache
  keyCache.delete(`${tenantId}:${provider}`)
  
  return {
    id: result.id,
    apiKeyMasked: maskApiKey(apiKey),
    createdAt: result.createdAt,
  }
}

/**
 * Update a tenant's LLM API key (BYOK)
 * Deactivates old key and creates new one
 */
export async function updateTenantLLMKey(
  tenantId: string,
  provider: 'openai' | 'anthropic' | 'google' | 'cohere' | 'mistral',
  apiKey: string
): Promise<{ id: string; apiKeyMasked: string; createdAt: Date }> {
  // Validate key format
  if (!validateApiKeyFormat(apiKey, provider)) {
    throw new Error(`Invalid ${provider} API key format`)
  }
  
  // Encrypt the key
  const { encrypted, iv } = encryptApiKey(apiKey)
  
  // Deactivate any existing keys for this provider
  await db
    .update(tenantLLMKeys)
    .set({ isActive: false })
    .where(
      and(
        eq(tenantLLMKeys.tenantId, tenantId),
        eq(tenantLLMKeys.provider, provider)
      )
    )
  
  // Insert new key
  const [result] = await db
    .insert(tenantLLMKeys)
    .values({
      tenantId,
      provider,
      apiKeyEncrypted: encrypted,
      iv,
      isActive: true,
    })
    .returning()
  
  // Invalidate cache
  keyCache.delete(`${tenantId}:${provider}`)
  
  return {
    id: result.id,
    apiKeyMasked: maskApiKey(apiKey),
    createdAt: result.createdAt,
  }
}

/**
 * List tenant's LLM keys (masked)
 */
export async function listTenantLLMKeys(tenantId: string) {
  const results = await db
    .select({
      id: tenantLLMKeys.id,
      provider: tenantLLMKeys.provider,
      apiKeyEncrypted: tenantLLMKeys.apiKeyEncrypted,
      iv: tenantLLMKeys.iv,
      isActive: tenantLLMKeys.isActive,
      lastUsed: tenantLLMKeys.lastUsed,
      createdAt: tenantLLMKeys.createdAt,
    })
    .from(tenantLLMKeys)
    .where(eq(tenantLLMKeys.tenantId, tenantId))
  
  // Decrypt just to mask (we need the plaintext to mask properly)
  return results.map((row) => {
    const decrypted = decryptApiKey(row.apiKeyEncrypted, row.iv)
    return {
      id: row.id,
      provider: row.provider,
      apiKeyMasked: maskApiKey(decrypted),
      isActive: row.isActive,
      lastUsed: row.lastUsed?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }
  })
}

/**
 * Delete (deactivate) a tenant's LLM key
 */
export async function deleteTenantLLMKey(tenantId: string, keyId: string): Promise<boolean> {
  const result = await db
    .update(tenantLLMKeys)
    .set({ isActive: false })
    .where(
      and(
        eq(tenantLLMKeys.id, keyId),
        eq(tenantLLMKeys.tenantId, tenantId)
      )
    )
    .returning()
  
  if (result.length > 0) {
    // Invalidate cache
    keyCache.delete(`${tenantId}:${result[0].provider}`)
    return true
  }
  
  return false
}

/**
 * Clear the in-memory key cache (useful for testing)
 */
export function clearKeyCache(): void {
  keyCache.clear()
}

/**
 * Clear the in-memory tier cache (useful for testing)
 */
export function clearTierCache(): void {
  tierCache.clear()
}
