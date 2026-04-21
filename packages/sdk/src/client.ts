/**
 * Supergate SDK — SupergateClient
 *
 * The main entry point for the SDK. Instantiate once and reuse.
 *
 * @example
 * import { SupergateClient } from '@supergate/sdk'
 *
 * const client = new SupergateClient({
 *   apiKey:  'gw_...',
 *   baseUrl: 'https://your-gateway.com',
 * })
 *
 * // Chat (OpenAI-compatible)
 * const response = await client.chat.completions.create({
 *   model:    'gpt-4o',
 *   messages: [{ role: 'user', content: 'Hello' }],
 * })
 *
 * // Usage analytics
 * const summary = await client.usage.getSummary({ period: 'weekly' })
 *
 * // Key management
 * const key = await client.keys.create({ name: 'prod' })
 */

import { HttpClient }       from './http'
import { ChatResource }     from './resources/chat'
import { KeysResource }     from './resources/keys'
import { TenantKeysResource } from './resources/tenant-keys'
import { UsageResource }    from './resources/usage'
import { HealthResource }   from './resources/health'
import type { SupergateClientOptions } from './types'

export class SupergateClient {
  /** OpenAI-compatible chat completions */
  readonly chat:       ChatResource
  /** Gateway API key management */
  readonly keys:       KeysResource
  /** BYOK provider key management */
  readonly tenantKeys: TenantKeysResource
  /** Usage analytics and cost data */
  readonly usage:      UsageResource
  /** Gateway and provider health */
  readonly health:     HealthResource

  private readonly http: HttpClient

  constructor(options: SupergateClientOptions) {
    const {
      apiKey,
      baseUrl        = 'http://localhost:3000',
      timeout        = 30_000,
      defaultHeaders = {},
    } = options

    if (!apiKey) throw new Error('SupergateClient: apiKey is required')

    this.http = new HttpClient(baseUrl, apiKey, timeout, defaultHeaders)

    this.chat       = new ChatResource(this.http, baseUrl, apiKey)
    this.keys       = new KeysResource(this.http)
    this.tenantKeys = new TenantKeysResource(this.http)
    this.usage      = new UsageResource(this.http)
    this.health     = new HealthResource(this.http)
  }
}
