/**
 * Circuit Breaker Unit Tests
 * 
 * Priority: HIGH
 * Tests circuit breaker state transitions and failure handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CircuitBreaker } from './circuit-breaker'
import { wait } from '../test/helpers'

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker

  beforeEach(() => {
    breaker = new CircuitBreaker('test-service', 3, 1000) // 3 failures, 1s reset
  })

  describe('Initial State', () => {
    it('should start in CLOSED state', () => {
      expect(breaker.getState()).toBe('CLOSED')
      expect(breaker.getFailures()).toBe(0)
      expect(breaker.canRequest()).toBe(true)
    })
  })

  describe('CLOSED → OPEN Transition', () => {
    it('should transition to OPEN after threshold failures', () => {
      expect(breaker.getState()).toBe('CLOSED')

      // Record failures up to threshold
      breaker.recordFailure() // 1
      expect(breaker.getState()).toBe('CLOSED')

      breaker.recordFailure() // 2
      expect(breaker.getState()).toBe('CLOSED')

      breaker.recordFailure() // 3 - should trigger OPEN
      expect(breaker.getState()).toBe('OPEN')
      expect(breaker.canRequest()).toBe(false)
    })

    it('should reset failure count on success in CLOSED state', () => {
      breaker.recordFailure() // 1
      breaker.recordFailure() // 2
      expect(breaker.getFailures()).toBe(2)

      breaker.recordSuccess()
      expect(breaker.getFailures()).toBe(0)
      expect(breaker.getState()).toBe('CLOSED')
    })

    it('should track last failure time', () => {
      const before = Date.now()
      breaker.recordFailure()
      const after = Date.now()

      const lastFailure = breaker.getLastFailure()
      expect(lastFailure).toBeDefined()
      expect(lastFailure!).toBeGreaterThanOrEqual(before)
      expect(lastFailure!).toBeLessThanOrEqual(after)
    })
  })

  describe('OPEN State', () => {
    beforeEach(() => {
      // Trigger OPEN state
      breaker.recordFailure()
      breaker.recordFailure()
      breaker.recordFailure()
      expect(breaker.getState()).toBe('OPEN')
    })

    it('should block requests in OPEN state', () => {
      expect(breaker.canRequest()).toBe(false)
    })

    it('should remain OPEN before reset timeout', async () => {
      await wait(500) // Wait 500ms (less than 1s reset timeout)
      expect(breaker.getState()).toBe('OPEN')
      expect(breaker.canRequest()).toBe(false)
    })
  })

  describe('OPEN → HALF_OPEN Transition', () => {
    beforeEach(() => {
      // Trigger OPEN state
      breaker.recordFailure()
      breaker.recordFailure()
      breaker.recordFailure()
      expect(breaker.getState()).toBe('OPEN')
    })

    it('should transition to HALF_OPEN after reset timeout', async () => {
      await wait(1100) // Wait longer than 1s reset timeout

      // First canRequest() call should transition to HALF_OPEN
      const canRequest = breaker.canRequest()
      expect(canRequest).toBe(true)
      expect(breaker.getState()).toBe('HALF_OPEN')
    })
  })

  describe('HALF_OPEN State', () => {
    beforeEach(async () => {
      // Trigger OPEN state
      breaker.recordFailure()
      breaker.recordFailure()
      breaker.recordFailure()

      // Wait for reset timeout
      await wait(1100)

      // Transition to HALF_OPEN
      breaker.canRequest()
      expect(breaker.getState()).toBe('HALF_OPEN')
    })

    it('should allow requests in HALF_OPEN state', () => {
      expect(breaker.canRequest()).toBe(true)
    })

    it('should transition to CLOSED on success', () => {
      breaker.recordSuccess()
      expect(breaker.getState()).toBe('CLOSED')
      expect(breaker.getFailures()).toBe(0)
    })

    it('should transition back to OPEN on failure', () => {
      breaker.recordFailure()
      expect(breaker.getState()).toBe('OPEN')
      expect(breaker.canRequest()).toBe(false)
    })
  })

  describe('Manual Reset', () => {
    it('should reset to CLOSED state', () => {
      // Trigger OPEN state
      breaker.recordFailure()
      breaker.recordFailure()
      breaker.recordFailure()
      expect(breaker.getState()).toBe('OPEN')

      // Manual reset
      breaker.reset()
      expect(breaker.getState()).toBe('CLOSED')
      expect(breaker.getFailures()).toBe(0)
      expect(breaker.getLastFailure()).toBeUndefined()
      expect(breaker.canRequest()).toBe(true)
    })
  })

  describe('Custom Configuration', () => {
    it('should respect custom threshold', () => {
      const customBreaker = new CircuitBreaker('custom', 5, 1000)

      // Should not open until 5 failures
      customBreaker.recordFailure() // 1
      customBreaker.recordFailure() // 2
      customBreaker.recordFailure() // 3
      customBreaker.recordFailure() // 4
      expect(customBreaker.getState()).toBe('CLOSED')

      customBreaker.recordFailure() // 5 - should trigger OPEN
      expect(customBreaker.getState()).toBe('OPEN')
    })

    it('should respect custom reset timeout', async () => {
      const customBreaker = new CircuitBreaker('custom', 3, 500) // 500ms reset

      // Trigger OPEN
      customBreaker.recordFailure()
      customBreaker.recordFailure()
      customBreaker.recordFailure()
      expect(customBreaker.getState()).toBe('OPEN')

      // Should transition to HALF_OPEN after 500ms
      await wait(600)
      customBreaker.canRequest()
      expect(customBreaker.getState()).toBe('HALF_OPEN')
    })
  })

  describe('Edge Cases', () => {
    it('should handle rapid success/failure cycles', () => {
      breaker.recordFailure()
      breaker.recordSuccess()
      breaker.recordFailure()
      breaker.recordSuccess()

      expect(breaker.getState()).toBe('CLOSED')
      expect(breaker.getFailures()).toBe(0)
    })

    it('should handle multiple failures beyond threshold', () => {
      breaker.recordFailure()
      breaker.recordFailure()
      breaker.recordFailure()
      expect(breaker.getState()).toBe('OPEN')

      // Additional failures should not change state
      breaker.recordFailure()
      breaker.recordFailure()
      expect(breaker.getState()).toBe('OPEN')
    })

    it('should handle success in CLOSED state without errors', () => {
      expect(breaker.getState()).toBe('CLOSED')
      breaker.recordSuccess()
      expect(breaker.getState()).toBe('CLOSED')
      expect(breaker.getFailures()).toBe(0)
    })
  })

  describe('Real-World Scenarios', () => {
    it('should handle provider outage and recovery', async () => {
      // Provider starts failing
      breaker.recordFailure()
      breaker.recordFailure()
      breaker.recordFailure()
      expect(breaker.getState()).toBe('OPEN')
      expect(breaker.canRequest()).toBe(false)

      // Wait for reset timeout (provider might have recovered)
      await wait(1100)

      // Try one request (HALF_OPEN)
      expect(breaker.canRequest()).toBe(true)
      expect(breaker.getState()).toBe('HALF_OPEN')

      // Provider has recovered
      breaker.recordSuccess()
      expect(breaker.getState()).toBe('CLOSED')
      expect(breaker.canRequest()).toBe(true)
    })

    it('should handle intermittent failures', async () => {
      // Some failures, but not enough to open
      breaker.recordFailure()
      breaker.recordSuccess()
      breaker.recordFailure()
      breaker.recordSuccess()

      expect(breaker.getState()).toBe('CLOSED')
      expect(breaker.canRequest()).toBe(true)
    })

    it('should handle provider still down after HALF_OPEN', async () => {
      // Provider fails
      breaker.recordFailure()
      breaker.recordFailure()
      breaker.recordFailure()
      expect(breaker.getState()).toBe('OPEN')

      // Wait for reset
      await wait(1100)
      breaker.canRequest()
      expect(breaker.getState()).toBe('HALF_OPEN')

      // Provider still down
      breaker.recordFailure()
      expect(breaker.getState()).toBe('OPEN')
      expect(breaker.canRequest()).toBe(false)
    })
  })
})
