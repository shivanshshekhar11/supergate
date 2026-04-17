import Fastify from 'fastify'
import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { env } from './config'
import { healthRoutes } from './routes/health'
import { chatRoutes } from './routes/chat'
import { keyRoutes } from './routes/keys'
import { tenantKeyRoutes } from './routes/tenant-keys'
import { usageRoutes } from './routes/usage'
import { authMiddleware } from './middleware/auth'
import { rateLimitMiddleware } from './middleware/rate-limit'
import { piiMaskMiddleware } from './middleware/pii-mask'
import { usageLoggerMiddleware } from './middleware/usage-logger'
import { closeConnection } from './db/client'
import { closeRedisConnection } from './redis/client'

/**
 * Bootstrap Fastify application
 */
async function bootstrap() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
  })

  // Register CORS
  await app.register(cors, {
    origin: true, // Allow all origins in development
    credentials: true,
  })

  // Register Swagger
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'LLM Gateway API',
        description: 'Multi-tenant LLM proxy with semantic caching, rate limiting, and cost attribution',
        version: '1.0.0',
      },
      servers: [
        {
          url: `http://localhost:${env.PORT}`,
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'API Key',
            description: 'Gateway API key (format: gw_...)',
          },
        },
      },
      tags: [
        { name: 'Chat', description: 'LLM chat completions' },
        { name: 'Usage', description: 'Usage tracking and cost attribution' },
        { name: 'Keys', description: 'API key management' },
        { name: 'Tenant Keys', description: 'Tenant BYOK key management' },
        { name: 'Health', description: 'Service health checks' },
      ],
    },
  })

  // Register Swagger UI
  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
  })

  // Register global middleware
  // Order matters: auth → rate-limit → pii-mask → routes → usage-logger
  
  // Health endpoint doesn't need auth
  await app.register(healthRoutes)
  
  // Protected routes need auth + rate limiting
  app.addHook('onRequest', async (request, reply) => {
    // Skip auth for health and docs endpoints
    if (request.url.startsWith('/health') || request.url.startsWith('/docs')) {
      return
    }
    
    // Apply auth middleware
    await authMiddleware(request, reply)
  })
  
  app.addHook('preHandler', async (request, reply) => {
    // Skip rate limiting for health and docs endpoints
    if (request.url.startsWith('/health') || request.url.startsWith('/docs')) {
      return
    }
    
    // Apply rate limiting middleware
    await rateLimitMiddleware(request, reply)
    
    // Apply PII masking middleware (for chat requests)
    await piiMaskMiddleware(request, reply)
  })
  
  // Usage logger runs after response (fire-and-forget)
  app.addHook('onResponse', async (request, reply) => {
    // Skip for health and docs endpoints
    if (request.url.startsWith('/health') || request.url.startsWith('/docs')) {
      return
    }
    
    // Log usage data
    await usageLoggerMiddleware(request, reply)
  })
  
  // Register protected routes
  await app.register(chatRoutes)
  await app.register(keyRoutes)
  await app.register(tenantKeyRoutes)
  await app.register(usageRoutes)

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM']
  signals.forEach((signal) => {
    process.on(signal, async () => {
      console.log(`\nReceived ${signal}, closing gracefully...`)
      await app.close()
      await closeConnection()
      await closeRedisConnection()
      process.exit(0)
    })
  })

  // Start server
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' })
    console.log(`\n🚀 Gateway running on http://localhost:${env.PORT}`)
    console.log(`📊 Health check: http://localhost:${env.PORT}/health`)
    console.log(`📚 API docs: http://localhost:${env.PORT}/docs`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

bootstrap()
