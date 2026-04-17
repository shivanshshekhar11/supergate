/**
 * Semantic Cache Middleware
 * 
 * Two-stage cache lookup:
 * 1. Exact match fast path: SHA-256 hash lookup (no vector math)
 * 2. Semantic path: pgvector cosine similarity search
 * 
 * Adaptive threshold based on prompt length:
 * - Short prompts (<40 chars): tighter threshold (0.95)
 * - Longer prompts: looser threshold (0.92)
 * 
 * On HIT: return cached response, skip provider call
 * On MISS: continue to provider, store response in cache after
 */

import type { FastifyRequest, FastifyReply } from 'fastify'
import { createHash } from 'crypto'
import { db } from '../db/client'
import { cacheEntries } from '../db/schema'
import { embed, clearEmbeddingCache } from '../lib/embeddings'
import { config } from '../config'
import { eq, and, sql, gt } from 'drizzle-orm'

declare module 'fastify' {
  interface FastifyRequest {
    cacheHit?: boolean
    cacheId?: string
    promptHash?: string
    promptEmbedding?: number[]
  }
}

/**
 * Generate SHA-256 hash of prompt for exact match lookup
 */
function hashPrompt(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex')
}

/**
 * Extract prompt text from chat messages
 */
function extractPrompt(messages: Array<{ role: string; content: string }>): string {
  // Concatenate all messages for cache key
  // Format: "role:content|role:content|..."
  return messages.map(m => `${m.role}:${m.content}`).join('|')
}

/**
 * Determine similarity threshold based on prompt length
 * 
 * Short prompts need tighter threshold because small edits
 * can significantly change intent.
 */
function getSimilarityThreshold(promptLength: number): number {
  return promptLength < 40
    ? config.CACHE_SIMILARITY_THRESHOLD_SHORT
    : config.CACHE_SIMILARITY_THRESHOLD_DEFAULT
}

/**
 * Semantic cache middleware
 * 
 * Checks cache before provider call. On HIT, returns cached response.
 * On MISS, allows request to continue to provider.
 */
export async function semanticCacheMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Only cache chat completion requests
  if (!request.url.includes('/chat/completions')) {
    return
  }

  // Skip if no tenant context
  if (!request.tenantContext) {
    return
  }

  // Skip if streaming (cache only works for non-streaming)
  const body = request.body as any
  if (body?.stream === true) {
    return
  }

  const { tenantId } = request.tenantContext
  const model = body?.model
  const messages = body?.messages

  if (!model || !messages || !Array.isArray(messages)) {
    return
  }

  try {
    const prompt = extractPrompt(messages)
    const promptHash = hashPrompt(prompt)
    const threshold = getSimilarityThreshold(prompt.length)

    // Store for later use (cache storage after provider call)
    request.promptHash = promptHash

    // Stage 1: Exact match fast path
    const exactMatch = await db
      .select()
      .from(cacheEntries)
      .where(
        and(
          eq(cacheEntries.tenantId, tenantId),
          eq(cacheEntries.model, model),
          eq(cacheEntries.promptHash, promptHash),
          sql`(${cacheEntries.expiresAt} IS NULL OR ${cacheEntries.expiresAt} > now())`
        )
      )
      .limit(1)

    if (exactMatch.length > 0) {
      const entry = exactMatch[0]

      // Increment hit count (fire-and-forget)
      db.update(cacheEntries)
        .set({ hitCount: sql`${cacheEntries.hitCount} + 1` })
        .where(eq(cacheEntries.id, entry.id))
        .catch(err => console.error('[SemanticCache] Error updating hit count:', err))

      // Mark as cache hit
      request.cacheHit = true
      request.cacheId = entry.id

      console.log(
        `[SemanticCache] EXACT HIT: tenant=${tenantId}, model=${model}, ` +
        `cacheId=${entry.id}, hitCount=${entry.hitCount + 1}`
      )

      // Return cached response
      reply.header('X-Cache', 'HIT')
      reply.header('X-Cache-Type', 'EXACT')
      reply.send(entry.response)
      return
    }

    // Stage 2: Semantic similarity search
    const embedding = await embed(prompt)
    request.promptEmbedding = embedding

    // pgvector cosine similarity query
    // <=> operator returns cosine distance (0 = identical, 2 = opposite)
    // similarity = 1 - distance
    const semanticMatches = await db.execute(sql`
      SELECT 
        id,
        response,
        hit_count,
        1 - (embedding <=> ${JSON.stringify(embedding)}::vector) AS similarity
      FROM cache_entries
      WHERE tenant_id = ${tenantId}
        AND model = ${model}
        AND (expires_at IS NULL OR expires_at > now())
        AND 1 - (embedding <=> ${JSON.stringify(embedding)}::vector) >= ${threshold}
      ORDER BY embedding <=> ${JSON.stringify(embedding)}::vector
      LIMIT 1
    `)

    if (semanticMatches.rows.length > 0) {
      const match = semanticMatches.rows[0] as any

      // Increment hit count (fire-and-forget)
      db.update(cacheEntries)
        .set({ hitCount: sql`${cacheEntries.hitCount} + 1` })
        .where(eq(cacheEntries.id, match.id))
        .catch(err => console.error('[SemanticCache] Error updating hit count:', err))

      // Mark as cache hit
      request.cacheHit = true
      request.cacheId = match.id

      console.log(
        `[SemanticCache] SEMANTIC HIT: tenant=${tenantId}, model=${model}, ` +
        `cacheId=${match.id}, similarity=${match.similarity.toFixed(4)}, ` +
        `threshold=${threshold}, hitCount=${match.hit_count + 1}`
      )

      // Return cached response
      reply.header('X-Cache', 'HIT')
      reply.header('X-Cache-Type', 'SEMANTIC')
      reply.header('X-Cache-Similarity', match.similarity.toFixed(4))
      reply.send(match.response)
      return
    }

    // Cache MISS - continue to provider
    console.log(
      `[SemanticCache] MISS: tenant=${tenantId}, model=${model}, ` +
      `promptLength=${prompt.length}, threshold=${threshold}`
    )

  } catch (error) {
    // Cache errors should never block the request
    console.error('[SemanticCache] Error during cache lookup:', error)
  }
}

/**
 * Store response in cache after successful provider call
 * 
 * Called from chat route after LLM response is received.
 */
export async function storeCacheEntry(
  tenantId: string,
  model: string,
  promptHash: string,
  embedding: number[],
  response: any
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + config.CACHE_TTL_SECONDS * 1000)

    // Convert embedding array to PostgreSQL vector format
    // Use sql template to properly cast to vector type
    await db.insert(cacheEntries).values({
      tenantId,
      model,
      promptHash,
      embedding: sql`${JSON.stringify(embedding)}::vector`,
      response,
      hitCount: 0,
      expiresAt,
    })

    console.log(
      `[SemanticCache] Stored cache entry: tenant=${tenantId}, model=${model}, ` +
      `expiresAt=${expiresAt.toISOString()}`
    )
  } catch (error) {
    // Storage errors should not affect the response
    console.error('[SemanticCache] Error storing cache entry:', error)
  }
}

/**
 * Cleanup hook to clear embedding cache after request
 * 
 * Prevents memory leaks from request-scoped memoization.
 */
export async function cleanupEmbeddingCache(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    clearEmbeddingCache()
  } catch (error) {
    // Silently catch errors - cleanup failures should not affect the response
    console.error('[SemanticCache] Error clearing embedding cache:', error)
  }
}
