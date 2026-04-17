/**
 * Cache Cleanup Job
 * 
 * Scheduled job to remove expired cache entries from the database.
 * Runs every hour to keep the cache table size manageable.
 */

import cron from 'node-cron'
import { db } from '../db/client'
import { cacheEntries } from '../db/schema'
import { sql, lt } from 'drizzle-orm'

/**
 * Delete expired cache entries
 * 
 * Removes entries where expires_at < now()
 */
async function cleanupExpiredEntries(): Promise<void> {
  try {
    const result = await db
      .delete(cacheEntries)
      .where(lt(cacheEntries.expiresAt, new Date()))

    console.log(`[CacheCleanup] Removed expired cache entries`)
  } catch (error) {
    console.error('[CacheCleanup] Error during cleanup:', error)
  }
}

/**
 * Start the cache cleanup cron job
 * 
 * Runs every hour at minute 0 (e.g., 1:00, 2:00, 3:00)
 */
export function startCacheCleanupJob(): void {
  // Run every hour
  cron.schedule('0 * * * *', async () => {
    console.log('[CacheCleanup] Starting scheduled cleanup...')
    await cleanupExpiredEntries()
  })

  console.log('[CacheCleanup] Scheduled job started (runs every hour)')
}

/**
 * Run cleanup immediately (useful for testing or manual triggers)
 */
export async function runCleanupNow(): Promise<void> {
  console.log('[CacheCleanup] Running manual cleanup...')
  await cleanupExpiredEntries()
}
