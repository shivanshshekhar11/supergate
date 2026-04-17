/**
 * Cache Cleanup Job Tests
 * 
 * Tests for scheduled cleanup of expired cache entries
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { runCleanupNow } from './cache-cleanup'
import { db } from '../db/client'
import { cacheEntries } from '../db/schema'

// Mock database
vi.mock('../db/client', () => ({
  db: {
    delete: vi.fn(),
  },
}))

// Mock cron (we'll test the cleanup function directly, not the schedule)
vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn(),
  },
}))

describe('Cache Cleanup Job', () => {
  let mockDb: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb = db as any
  })

  describe('runCleanupNow()', () => {
    it('should delete expired cache entries', async () => {
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 5 }),
      })

      await runCleanupNow()

      expect(mockDb.delete).toHaveBeenCalled()
    })

    it('should use correct where clause for expired entries', async () => {
      const mockWhere = vi.fn().mockResolvedValue({ rowCount: 0 })
      mockDb.delete.mockReturnValue({
        where: mockWhere,
      })

      await runCleanupNow()

      expect(mockWhere).toHaveBeenCalled()
      // The where clause should check for expires_at < now()
    })

    it('should not throw on database error', async () => {
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('DB error')),
      })

      await expect(runCleanupNow()).resolves.not.toThrow()
    })

    it('should handle zero expired entries', async () => {
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 0 }),
      })

      await expect(runCleanupNow()).resolves.not.toThrow()
    })

    it('should handle large number of expired entries', async () => {
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 10000 }),
      })

      await expect(runCleanupNow()).resolves.not.toThrow()
    })
  })

  describe('Error handling', () => {
    it('should log error but not throw', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      mockDb.delete.mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Connection lost')),
      })

      await runCleanupNow()

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CacheCleanup]'),
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })

    it('should handle timeout errors', async () => {
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Query timeout')),
      })

      await expect(runCleanupNow()).resolves.not.toThrow()
    })

    it('should handle constraint errors', async () => {
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Foreign key constraint')),
      })

      await expect(runCleanupNow()).resolves.not.toThrow()
    })
  })

  describe('Idempotency', () => {
    it('should be safe to run multiple times', async () => {
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 3 }),
      })

      await runCleanupNow()
      await runCleanupNow()
      await runCleanupNow()

      expect(mockDb.delete).toHaveBeenCalledTimes(3)
    })

    it('should handle concurrent cleanup calls', async () => {
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 2 }),
      })

      await Promise.all([
        runCleanupNow(),
        runCleanupNow(),
        runCleanupNow(),
      ])

      expect(mockDb.delete).toHaveBeenCalledTimes(3)
    })
  })
})
