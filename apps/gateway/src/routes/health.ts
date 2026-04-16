import { FastifyInstance } from 'fastify'
import { HealthResponseSchema } from '@llm-gateway/schemas'
import { testConnection } from '../db/client'
import { testRedisConnection } from '../redis/client'
import { getAllProviders } from '../providers/router'

const startTime = Date.now()

/**
 * Health check route
 * Returns service status and dependency health
 */
export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (request, reply) => {
    const startCheck = Date.now()

    // Test database connection
    const dbConnected = await testConnection()
    const dbLatency = Date.now() - startCheck

    // Test Redis connection
    const redisStart = Date.now()
    const redisConnected = await testRedisConnection()
    const redisLatency = Date.now() - redisStart

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy'
    if (dbConnected && redisConnected) {
      status = 'healthy'
    } else if (dbConnected || redisConnected) {
      status = 'degraded'
    } else {
      status = 'unhealthy'
    }

    // Get circuit breaker states from all active providers
    const providers = getAllProviders()
    const providerStates = providers.map((provider) => {
      const state = provider.getCircuitBreakerState()
      return {
        name: provider.constructor.name.replace('Provider', '').toLowerCase(),
        circuitBreaker: {
          state: state.state,
          failures: state.failures,
          lastFailure: state.lastFailure,
          nextRetry: state.nextRetry,
        },
      }
    })

    const response = {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      database: {
        connected: dbConnected,
        latencyMs: dbConnected ? dbLatency : undefined,
      },
      redis: {
        connected: redisConnected,
        latencyMs: redisConnected ? redisLatency : undefined,
      },
      providers: providerStates,
    }

    // Set appropriate status code
    if (status === 'unhealthy') {
      reply.statusCode = 503
    }

    return response
  })
}
