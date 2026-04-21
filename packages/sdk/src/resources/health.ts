/**
 * Supergate SDK — Health resource
 *
 * Check gateway and provider health, including circuit breaker states.
 *
 * @example
 * const health = await client.health.get()
 * console.log(health.status)  // 'healthy' | 'degraded'
 * health.providers.forEach(p => console.log(`${p.name}: ${p.circuitBreaker.state}`))
 */

import type { HttpClient } from '../http'
import type { HealthResponse } from '../types'

export class HealthResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Get gateway health status including database, Redis, and provider circuit breaker states.
   * This endpoint does not require authentication.
   */
  get(): Promise<HealthResponse> {
    return this.http.get('/health')
  }
}
