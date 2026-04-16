import { z } from 'zod'

/**
 * API key creation request
 */
export const CreateKeyRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['admin', 'user', 'viewer']).default('user'),
})

/**
 * API key creation response (raw key shown only once)
 */
export const CreateKeyResponseSchema = z.object({
  id: z.string().uuid(),
  key: z.string(), // Full raw key: "gw_..." - shown only once
  keyPrefix: z.string(),
  name: z.string().nullable(),
  role: z.string(),
  createdAt: z.string(), // ISO 8601 timestamp
})

/**
 * API key metadata (for listing)
 */
export const KeyMetadataSchema = z.object({
  id: z.string().uuid(),
  keyPrefix: z.string(),
  name: z.string().nullable(),
  role: z.string(),
  revoked: z.boolean(),
  lastUsed: z.string().nullable(), // ISO 8601 timestamp
  createdAt: z.string(), // ISO 8601 timestamp
})

export const ListKeysResponseSchema = z.array(KeyMetadataSchema)

// Inferred TypeScript types
export type CreateKeyRequest = z.infer<typeof CreateKeyRequestSchema>
export type CreateKeyResponse = z.infer<typeof CreateKeyResponseSchema>
export type KeyMetadata = z.infer<typeof KeyMetadataSchema>
export type ListKeysResponse = z.infer<typeof ListKeysResponseSchema>
