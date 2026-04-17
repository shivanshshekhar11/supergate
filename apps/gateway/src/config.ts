import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'
import * as dotenv from 'dotenv'

// Load .env file
dotenv.config()

/**
 * Zod-validated environment configuration.
 * App crashes on startup if required vars are missing or invalid.
 */
export const env = createEnv({
  server: {
    // Database
    DATABASE_URL: z.string().url(),

    // Redis
    REDIS_URL: z.string().url(),

    // LLM Provider API Keys
    OPENAI_API_KEY: z.string().min(1),
    ANTHROPIC_API_KEY: z.string().min(1),
    GOOGLE_API_KEY: z.string().optional(), // Optional - can use BYOK only
    COHERE_API_KEY: z.string().optional(), // Optional - can use BYOK only
    MISTRAL_API_KEY: z.string().optional(), // Optional - can use BYOK only

    // Embedding Configuration
    EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
    EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),

    // Semantic Cache Configuration
    CACHE_SIMILARITY_THRESHOLD_DEFAULT: z.coerce.number().min(0).max(1).default(0.92),
    CACHE_SIMILARITY_THRESHOLD_SHORT: z.coerce.number().min(0).max(1).default(0.95),
    CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(86400),

    // Rate Limiting Defaults
    DEFAULT_RPM: z.coerce.number().int().positive().default(60),
    DEFAULT_TPM: z.coerce.number().int().positive().default(100000),

    // Circuit Breaker Configuration
    CIRCUIT_BREAKER_THRESHOLD: z.coerce.number().int().positive().default(5),
    CIRCUIT_BREAKER_RESET_MS: z.coerce.number().int().positive().default(30000),

    // Server Configuration
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

    // Encryption (for tenant BYOK keys)
    ENCRYPTION_MASTER_KEY: z.string().min(32),

    // JWT Secret (for dashboard authentication)
    JWT_SECRET: z.string().min(32),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})

// Re-export for convenience
export const config = env
