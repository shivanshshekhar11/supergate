import Fastify from 'fastify'
import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { env } from './config'
import { healthRoutes } from './routes/health'
import { chatRoutes } from './routes/chat'
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

  // Register routes
  await app.register(healthRoutes)
  await app.register(chatRoutes)

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
