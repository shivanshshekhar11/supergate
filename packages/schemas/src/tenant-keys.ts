import { z } from 'zod'

/**
 * Supported LLM providers for BYOK
 */
export const LLMProviderSchema = z.enum(['openai', 'anthropic'])

/**
 * Request to store a tenant's LLM API key (BYOK)
 */
export const StoreTenantKeyRequestSchema = z.object({
  provider: LLMProviderSchema,
  apiKey: z.string().min(20), // Will be encrypted before storage
})

/**
 * Response after storing a tenant's LLM API key
 */
export const StoreTenantKeyResponseSchema = z.object({
  id: z.string().uuid(),
  provider: z.string(),
  apiKeyMasked: z.string(), // e.g., "sk-proj-...xyz"
  createdAt: z.string(), // ISO 8601 timestamp
})

/**
 * Tenant LLM key metadata (for listing)
 */
export const TenantKeyMetadataSchema = z.object({
  id: z.string().uuid(),
  provider: z.string(),
  apiKeyMasked: z.string(),
  isActive: z.boolean(),
  lastUsed: z.string().nullable(), // ISO 8601 timestamp
  createdAt: z.string(), // ISO 8601 timestamp
})

export const ListTenantKeysResponseSchema = z.array(TenantKeyMetadataSchema)

// Inferred TypeScript types
export type LLMProvider = z.infer<typeof LLMProviderSchema>
export type StoreTenantKeyRequest = z.infer<typeof StoreTenantKeyRequestSchema>
export type StoreTenantKeyResponse = z.infer<typeof StoreTenantKeyResponseSchema>
export type TenantKeyMetadata = z.infer<typeof TenantKeyMetadataSchema>
export type ListTenantKeysResponse = z.infer<typeof ListTenantKeysResponseSchema>
