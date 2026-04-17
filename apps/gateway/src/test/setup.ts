/**
 * Test setup file
 * Runs before all tests
 */

import { beforeAll, afterAll } from 'vitest'

// Set test environment variables - use dev database for now
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/llm_gateway'
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test-key'
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'sk-ant-test-key'
process.env.ENCRYPTION_MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY || 'test-encryption-key-32-chars-long-minimum'
process.env.PORT = '3001'
process.env.LOG_LEVEL = 'error' // Reduce noise in tests

beforeAll(async () => {
  // Global test setup
  console.log('🧪 Test environment initialized')
})

afterAll(async () => {
  // Global test cleanup
  console.log('✅ Tests complete')
})
