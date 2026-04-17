/**
 * Embeddings Service
 * 
 * Wrapper around OpenAI's text-embedding-3-small model for semantic cache.
 * Memoizes embeddings within a request lifecycle to avoid double-embedding.
 */

import OpenAI from 'openai'
import { config } from '../config'

// Singleton OpenAI client for embeddings
const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
})

// Request-scoped memoization cache
// Key: text content, Value: embedding vector
const requestCache = new Map<string, number[]>()

/**
 * Generate embedding for text using OpenAI's text-embedding-3-small
 * 
 * Memoized within request lifecycle to avoid redundant API calls.
 * Cache is cleared between requests.
 */
export async function embed(text: string): Promise<number[]> {
  // Check request-scoped cache first
  const cached = requestCache.get(text)
  if (cached) {
    return cached
  }

  // Generate embedding
  const response = await openai.embeddings.create({
    model: config.EMBEDDING_MODEL,
    input: text,
    dimensions: config.EMBEDDING_DIMENSIONS,
  })

  const embedding = response.data[0]?.embedding
  
  if (!embedding) {
    throw new Error('No embedding returned from OpenAI API')
  }

  // Store in request cache
  requestCache.set(text, embedding)

  return embedding
}

/**
 * Clear the request-scoped embedding cache
 * 
 * Should be called at the end of each request to prevent memory leaks.
 */
export function clearEmbeddingCache(): void {
  requestCache.clear()
}

/**
 * Get cache size (for monitoring/debugging)
 */
export function getEmbeddingCacheSize(): number {
  return requestCache.size
}
