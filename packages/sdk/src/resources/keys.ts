/**
 * Supergate SDK — Keys resource
 *
 * Manage gateway API keys for your tenant.
 * All methods require an admin-role API key.
 *
 * @example
 * const keys  = await client.keys.list()
 * const key   = await client.keys.create({ name: 'prod-service', role: 'user' })
 * console.log(key.key)  // gw_... — shown once, store it securely
 * await client.keys.revoke(key.id)
 */

import type { HttpClient } from '../http'
import type { CreateKeyOptions } from '../types'

export interface KeyMetadata {
  id:        string
  keyPrefix: string
  role:      'admin' | 'user' | 'viewer'
  name:      string | null
  revoked:   boolean
  lastUsed:  string | null
  createdAt: string
}

export interface CreatedKey extends KeyMetadata {
  /** Raw API key — shown exactly once. Store it securely. */
  key: string
}

export class KeysResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List all API keys for your tenant.
   * Raw key values are never returned — only prefixes and metadata.
   */
  list(): Promise<{ keys: KeyMetadata[] }> {
    return this.http.get('/v1/keys')
  }

  /**
   * Create a new API key.
   * The raw key is returned exactly once in the response — store it securely.
   */
  create(options: CreateKeyOptions = {}): Promise<CreatedKey> {
    return this.http.post('/v1/keys', {
      name: options.name ?? 'SDK key',
      role: options.role ?? 'user',
    })
  }

  /**
   * Revoke an API key by ID.
   * Revoked keys are rejected immediately on the next request.
   */
  revoke(keyId: string): Promise<{ id: string; revoked: true }> {
    return this.http.delete(`/v1/keys/${keyId}`)
  }
}
