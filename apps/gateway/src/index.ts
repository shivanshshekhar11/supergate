import Fastify from 'fastify'
import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { fastifyZodOpenApiPlugin, fastifyZodOpenApiTransform, fastifyZodOpenApiTransformObject, serializerCompiler, validatorCompiler } from 'fastify-zod-openapi'
import { env } from './config'
import { healthRoutes } from './routes/health'
import { chatRoutes } from './routes/chat'
import { keyRoutes } from './routes/keys'
import { tenantKeyRoutes } from './routes/tenant-keys'
import { usageRoutes } from './routes/usage'
import { cacheRoutes } from './routes/cache'
import { registerAuthRoutes } from './routes/auth'
import { authMiddleware } from './middleware/auth'
import { rateLimitMiddleware } from './middleware/rate-limit'
import { piiMaskMiddleware } from './middleware/pii-mask'
import { usageLoggerMiddleware } from './middleware/usage-logger'
import { closeConnection } from './db/client'
import { closeRedisConnection } from './redis/client'
import { startCacheCleanupJob } from './lib/cache-cleanup'

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

  // Register Zod OpenAPI plugin
  await app.register(fastifyZodOpenApiPlugin)
  
  // Set validator and serializer
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  // Add custom error handler for validation errors
  app.setErrorHandler((error: any, request, reply) => {
    // Handle validation errors
    if (error.validation) {
      return reply.code(400).send({
        error: {
          code: 'validation_error',
          message: error.message || 'Request validation failed',
          requestId: request.id,
          details: error.validation,
        },
      })
    }

    // Handle other Fastify errors
    if (error.statusCode) {
      return reply.code(error.statusCode).send({
        error: {
          code: error.code || 'internal_error',
          message: error.message,
          requestId: request.id,
        },
      })
    }

    // Handle unknown errors
    console.error('Unhandled error:', error)
    return reply.code(500).send({
      error: {
        code: 'internal_error',
        message: 'An unexpected error occurred',
        requestId: request.id,
      },
    })
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
        { name: 'Auth', description: 'User authentication and registration' },
        { name: 'Chat', description: 'LLM chat completions' },
        { name: 'Usage', description: 'Usage tracking and cost attribution' },
        { name: 'Cache', description: 'Semantic cache analytics and performance' },
        { name: 'Keys', description: 'API key management' },
        { name: 'Tenant Keys', description: 'Tenant BYOK key management' },
        { name: 'Health', description: 'Service health checks' },
      ],
    },
    transform: fastifyZodOpenApiTransform,
    transformObject: fastifyZodOpenApiTransformObject,
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
  
  // Auth endpoints don't need API key auth (they use their own JWT auth)
  await app.register(registerAuthRoutes)
  
  // Protected routes need auth + rate limiting
  app.addHook('onRequest', async (request, reply) => {
    // Skip auth for health, docs, and auth endpoints
    if (
      request.url.startsWith('/health') ||
      request.url.startsWith('/docs') ||
      request.url.startsWith('/v1/auth')
    ) {
      return
    }
    
    // Apply auth middleware
    await authMiddleware(request, reply)
  })
  
  app.addHook('preHandler', async (request, reply) => {
    // Skip rate limiting for health, docs, and auth endpoints
    if (
      request.url.startsWith('/health') ||
      request.url.startsWith('/docs') ||
      request.url.startsWith('/v1/auth')
    ) {
      return
    }
    
    // Apply rate limiting middleware
    await rateLimitMiddleware(request, reply)
    
    // Apply PII masking middleware (for chat requests)
    await piiMaskMiddleware(request, reply)
    
    // Apply semantic cache middleware (for non-streaming chat requests)
    if (request.url === '/v1/chat/completions' && request.method === 'POST') {
      const { semanticCacheMiddleware } = await import('./middleware/semantic-cache')
      await semanticCacheMiddleware(request, reply)
    }
  })
  
  // Usage logger runs after response (fire-and-forget)
  app.addHook('onResponse', async (request, reply) => {
    // Skip for health, docs, and auth endpoints
    if (
      request.url.startsWith('/health') ||
      request.url.startsWith('/docs') ||
      request.url.startsWith('/v1/auth')
    ) {
      return
    }
    
    // Log usage data
    await usageLoggerMiddleware(request, reply)
    
    // Clear embedding cache to prevent memory leaks
    if (request.url === '/v1/chat/completions') {
      const { cleanupEmbeddingCache } = await import('./middleware/semantic-cache')
      await cleanupEmbeddingCache(request, reply)
    }
  })
  
  // Register protected routes
  await app.register(chatRoutes)
  await app.register(keyRoutes)
  await app.register(tenantKeyRoutes)
  await app.register(usageRoutes)
  await app.register(cacheRoutes)

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
    
    // Start cache cleanup job
    startCacheCleanupJob()
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

bootstrap()
