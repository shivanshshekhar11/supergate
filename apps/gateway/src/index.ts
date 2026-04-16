import Fastify from 'fastify'
import cors from '@fastify/cors'
import { env } from './config'
import { healthRoutes } from './routes/health'
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

  // Register routes
  await app.register(healthRoutes)

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
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

bootstrap()
