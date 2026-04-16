import { env } from '../config'

/**
 * Circuit breaker states
 */
export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

/**
 * Circuit Breaker pattern implementation
 * 
 * Prevents cascading failures by temporarily blocking requests to failing services.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests are blocked
 * - HALF_OPEN: Testing if service has recovered
 * 
 * Flow:
 * 1. CLOSED → OPEN: After threshold failures
 * 2. OPEN → HALF_OPEN: After reset timeout
 * 3. HALF_OPEN → CLOSED: On successful request
 * 4. HALF_OPEN → OPEN: On failed request
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED'
  private failures = 0
  private lastFailureTime?: number
  private readonly threshold: number
  private readonly resetTimeoutMs: number

  constructor(
    private readonly name: string,
    threshold?: number,
    resetTimeoutMs?: number
  ) {
    this.threshold = threshold ?? env.CIRCUIT_BREAKER_THRESHOLD
    this.resetTimeoutMs = resetTimeoutMs ?? env.CIRCUIT_BREAKER_RESET_MS
  }

  /**
   * Check if requests can be made
   */
  canRequest(): boolean {
    if (this.state === 'CLOSED') {
      return true
    }

    if (this.state === 'OPEN') {
      // Check if enough time has passed to try again
      if (this.shouldAttemptReset()) {
        console.log(`[CircuitBreaker:${this.name}] Transitioning OPEN → HALF_OPEN`)
        this.state = 'HALF_OPEN'
        return true
      }
      return false
    }

    // HALF_OPEN: allow request to test if service recovered
    return true
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      console.log(`[CircuitBreaker:${this.name}] Transitioning HALF_OPEN → CLOSED (success)`)
      this.state = 'CLOSED'
      this.failures = 0
      this.lastFailureTime = undefined
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success
      this.failures = 0
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.state === 'HALF_OPEN') {
      console.log(`[CircuitBreaker:${this.name}] Transitioning HALF_OPEN → OPEN (failure)`)
      this.state = 'OPEN'
    } else if (this.state === 'CLOSED' && this.failures >= this.threshold) {
      console.log(
        `[CircuitBreaker:${this.name}] Transitioning CLOSED → OPEN (${this.failures} failures)`
      )
      this.state = 'OPEN'
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state
  }

  /**
   * Get failure count
   */
  getFailures(): number {
    return this.failures
  }

  /**
   * Get last failure timestamp
   */
  getLastFailure(): number | undefined {
    return this.lastFailureTime
  }

  /**
   * Check if enough time has passed to attempt reset
   */
  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) {
      return true
    }
    return Date.now() - this.lastFailureTime >= this.resetTimeoutMs
  }

  /**
   * Manually reset the circuit breaker (for testing/admin)
   */
  reset(): void {
    console.log(`[CircuitBreaker:${this.name}] Manual reset`)
    this.state = 'CLOSED'
    this.failures = 0
    this.lastFailureTime = undefined
  }
}
