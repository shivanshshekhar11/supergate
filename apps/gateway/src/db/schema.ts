import { pgTable, uuid, text, timestamp, boolean, integer, numeric, index, pgPolicy, customType } from 'drizzle-orm/pg-core'
import { sql, relations } from 'drizzle-orm'

// Custom pgvector type
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1536)'
  },
})

// Custom jsonb type
const jsonb = customType<{ data: Record<string, any>; driverData: string }>({
  dataType() {
    return 'jsonb'
  },
})

/**
 * Tenants table
 * Each tenant represents an isolated organization using the gateway
 */
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  tier: text('tier').notNull().default('free'), // free | pro | enterprise | enterprise-independent
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

/**
 * API Keys table
 * Stores hashed API keys for authentication
 * NEVER store raw keys - only bcrypt hashes
 */
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  keyHash: text('key_hash').notNull().unique(),
  keyPrefix: text('key_prefix').notNull(), // First 8 chars: "gw_abc12"
  role: text('role').notNull().default('user'), // admin | user | viewer
  name: text('name'),
  revoked: boolean('revoked').default(false).notNull(),
  lastUsed: timestamp('last_used'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

/**
 * Usage Logs table
 * Tracks every LLM request with cost attribution
 * Protected by Row Level Security (RLS)
 */
export const usageLogs = pgTable(
  'usage_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    apiKeyId: uuid('api_key_id').references(() => apiKeys.id),
    provider: text('provider').notNull(), // openai | anthropic
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull(),
    outputTokens: integer('output_tokens').notNull(),
    costUsd: numeric('cost_usd', { precision: 12, scale: 8 }).notNull(),
    latencyMs: integer('latency_ms'),
    cached: boolean('cached').default(false).notNull(),
    statusCode: integer('status_code').notNull().default(200),
    requestId: text('request_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantCreatedIdx: index('usage_logs_tenant_created_idx').on(table.tenantId, table.createdAt),
    tenantModelIdx: index('usage_logs_tenant_model_idx').on(table.tenantId, table.model, table.createdAt),
  })
)

/**
 * Cache Entries table
 * Stores semantic cache with pgvector embeddings
 */
export const cacheEntries = pgTable(
  'cache_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    model: text('model').notNull(),
    promptHash: text('prompt_hash').notNull(), // SHA-256 for exact match fast path
    embedding: vector('embedding').notNull(), // pgvector type
    response: jsonb('response').notNull(),
    hitCount: integer('hit_count').default(0).notNull(),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    exactMatchIdx: index('cache_exact_match_idx').on(table.tenantId, table.model, table.promptHash),
    // HNSW index for vector similarity search - created in migration SQL
  })
)

/**
 * Tenant LLM Keys table (BYOK - Bring Your Own Key)
 * Stores encrypted LLM provider API keys for tenants who want to use their own keys
 * Falls back to gateway-owned keys if tenant hasn't provided their own
 */
export const tenantLLMKeys = pgTable(
  'tenant_llm_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(), // 'openai' | 'anthropic'
    apiKeyEncrypted: text('api_key_encrypted').notNull(), // AES-256-GCM encrypted
    iv: text('iv').notNull(), // Initialization vector for decryption
    isActive: boolean('is_active').default(true).notNull(),
    lastUsed: timestamp('last_used'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantProviderIdx: index('tenant_llm_keys_tenant_provider_idx').on(table.tenantId, table.provider, table.isActive),
  })
)

/**
 * Users table
 * Stores user accounts for dashboard authentication
 * Uses bcrypt for password hashing
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

/**
 * User-Tenant relationship table (many-to-many)
 * A user can belong to multiple tenants with different roles
 * A tenant can have multiple users
 */
export const userTenants = pgTable(
  'user_tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'), // admin | member | guest
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userTenantIdx: index('user_tenants_user_tenant_idx').on(table.userId, table.tenantId),
  })
)

/**
 * Relations for Drizzle ORM queries
 */
export const usersRelations = relations(users, ({ many }) => ({
  userTenants: many(userTenants),
}))

export const tenantsRelations = relations(tenants, ({ many }) => ({
  userTenants: many(userTenants),
  apiKeys: many(apiKeys),
  usageLogs: many(usageLogs),
  cacheEntries: many(cacheEntries),
  tenantLLMKeys: many(tenantLLMKeys),
}))

export const userTenantsRelations = relations(userTenants, ({ one }) => ({
  user: one(users, {
    fields: [userTenants.userId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [userTenants.tenantId],
    references: [tenants.id],
  }),
}))
