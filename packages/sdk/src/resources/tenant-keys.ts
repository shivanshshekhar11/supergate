/**
 * Supergate SDK — Tenant Keys resource (BYOK)
 *
 * Manage your own LLM provider API keys (Bring Your Own Key).
 * When a BYOK key is configured, it takes precedence over the gateway's
 * shared key for that provider. Enterprise-independent tenants must
 * configure BYOK keys — no gateway fallback is available.
 *
 * @example
 * // Add your OpenAI key
 * await client.tenantKeys.create({ provider: 'openai', apiKey: 'sk-proj-...' })
 *
 * // List configured keys (masked)
 * const keys = await client.tenantKeys.list()
 * // [{ provider: 'openai', apiKeyMasked: 'sk-proj-...xyz', isActive: true }]
 *
 * // Rotate a key
 * await client.tenantKeys.update('openai', 'sk-proj-new...')
 *
 * // Remove a key (falls back to gateway key if tier allows)
 * await client.tenantKeys.remove('openai')
 */

import type { HttpClient } from '../http'

export type SupportedProvider = 'openai' | 'anthropic' | 'google' | 'cohere' | 'mistral'

export interface TenantKeyMetadata {
  id:           string
  provider:     SupportedProvider
  apiKeyMasked: string
  isActive:     boolean
  lastUsed:     string | null
  createdAt:    string
}

export interface CreatedTenantKey {
  id:           string
  provider:     SupportedProvider
  apiKeyMasked: string
  createdAt:    string
}

export class TenantKeysResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List all active BYOK keys for your tenant (masked).
   */
  list(): Promise<TenantKeyMetadata[]> {
    return this.http.get<{ keys: TenantKeyMetadata[] }>('/v1/tenant/keys')
      .then(res => res.keys)
  }

  /**
   * Add a new BYOK key for a provider.
   * Throws if a key already exists for that provider — use update() to rotate.
   */
  create(options: { provider: SupportedProvider; apiKey: string }): Promise<CreatedTenantKey> {
    return this.http.post('/v1/tenant/keys', options)
  }

  /**
   * Rotate (replace) an existing BYOK key for a provider.
   * The old key is deactivated immediately.
   */
  update(provider: SupportedProvider, apiKey: string): Promise<CreatedTenantKey> {
    return this.http.put(`/v1/tenant/keys/${provider}`, { apiKey })
  }

  /**
   * Remove a BYOK key for a provider.
   * After removal, requests fall back to the gateway's shared key (if your tier allows it).
   * Enterprise-independent tenants will have requests fail until a new key is added.
   */
  remove(provider: SupportedProvider): Promise<{ provider: string; deleted: true; message: string }> {
    return this.http.delete(`/v1/tenant/keys/${provider}`)
  }
}
