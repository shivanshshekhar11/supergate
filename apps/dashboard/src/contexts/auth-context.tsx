'use client'

/**
 * Authentication Context
 *
 * Manages user authentication state across the dashboard using a two-token flow:
 *
 * - Access JWT  (15 min)  — kept in React state (memory only). Never written to
 *                           localStorage or any persistent browser storage.
 * - Refresh token (30 d)  — httpOnly cookie set by the gateway, never readable
 *                           by JavaScript. Only sent to POST /v1/auth/refresh.
 *
 * Session restore:
 *   On mount we call POST /v1/auth/refresh. If the cookie is still valid the
 *   server returns a fresh access JWT and the user stays logged in silently.
 *   If the cookie is missing or expired the user is shown the login page.
 *
 * Proactive refresh:
 *   A timer fires 60 seconds before the access JWT expires (i.e. after 14 min)
 *   to swap it before any API call has a chance to see a 401.
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import {
  authAPI,
  setTokenRefreshCallback,
  type AuthResponse,
  type MeResponse,
} from '@/lib/gateway-client'
import type { RegisterRequest, LoginRequest } from '@llm-gateway/schemas'

// Access JWT lifetime in seconds — must match gateway config (15 min)
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
// Refresh 60 seconds before expiry
const REFRESH_BEFORE_SECONDS   = 60

interface AuthContextValue {
  // State
  user:            MeResponse | null
  token:           string | null
  isLoading:       boolean
  isAuthenticated: boolean

  // Actions
  login:       (credentials: LoginRequest) => Promise<void>
  register:    (data: RegisterRequest)     => Promise<void>
  logout:      ()                          => Promise<void>
  refreshUser: ()                          => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/**
 * Auth Provider Component
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken]       = useState<string | null>(null)
  const [user,  setUser]        = useState<MeResponse | null>(null)
  const [isLoading, setLoading] = useState(true)

  /** Handle for the proactive-refresh timer so we can cancel it on logout */
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Helpers ──────────────────────────────────────────────────────────────

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
  }, [])

  /**
   * Schedule a proactive token refresh REFRESH_BEFORE_SECONDS before expiry.
   */
  const scheduleProactiveRefresh = useCallback((accessToken: string) => {
    clearRefreshTimer()
    const delayMs = (ACCESS_TOKEN_TTL_SECONDS - REFRESH_BEFORE_SECONDS) * 1000
    refreshTimerRef.current = setTimeout(async () => {
      const result = await authAPI.refresh()
      if (result?.accessToken) {
        setToken(result.accessToken)
        scheduleProactiveRefresh(result.accessToken) // reschedule for next cycle
      } else {
        // Refresh cookie expired — log the user out silently
        setToken(null)
        setUser(null)
      }
    }, delayMs)
  }, [clearRefreshTimer])

  /**
   * Load the user profile using a known-good access token and schedule
   * the proactive refresh timer.
   */
  const hydrateUser = useCallback(async (accessToken: string) => {
    try {
      const userData = await authAPI.me(accessToken)
      setUser(userData)
      setToken(accessToken)
      scheduleProactiveRefresh(accessToken)
    } catch {
      // Access token rejected — clear state; user must log in again
      setToken(null)
      setUser(null)
    }
  }, [scheduleProactiveRefresh])

  // ── Mount: attempt silent session restore ─────────────────────────────────

  useEffect(() => {
    let cancelled = false

    async function restore() {
      const result = await authAPI.refresh()
      if (cancelled) return

      if (result?.accessToken) {
        await hydrateUser(result.accessToken)
      }
      setLoading(false)
    }

    restore()
    return () => { cancelled = true }
  }, [hydrateUser])

  // ── Wire up the 401-interceptor callback ─────────────────────────────────
  // The gateway-client calls this when it silently refreshes a token mid-flight.

  useEffect(() => {
    setTokenRefreshCallback((newToken: string | null) => {
      if (newToken) {
        setToken(newToken)
        scheduleProactiveRefresh(newToken)
      } else {
        setToken(null)
        setUser(null)
        clearRefreshTimer()
      }
    })
  }, [scheduleProactiveRefresh, clearRefreshTimer])

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => () => { clearRefreshTimer() }, [clearRefreshTimer])

  // ── Auth actions ──────────────────────────────────────────────────────────

  const login = useCallback(async (credentials: LoginRequest) => {
    setLoading(true)
    try {
      const response: AuthResponse = await authAPI.login(credentials)
      await hydrateUser(response.accessToken)
    } finally {
      setLoading(false)
    }
  }, [hydrateUser])

  const register = useCallback(async (data: RegisterRequest) => {
    setLoading(true)
    try {
      const response: AuthResponse = await authAPI.register(data)
      await hydrateUser(response.accessToken)
    } finally {
      setLoading(false)
    }
  }, [hydrateUser])

  const logout = useCallback(async () => {
    clearRefreshTimer()
    await authAPI.logout() // revoke refresh token server-side + clear cookie
    setToken(null)
    setUser(null)
  }, [clearRefreshTimer])

  const refreshUser = useCallback(async () => {
    if (token) await hydrateUser(token)
  }, [token, hydrateUser])

  // ── Context value ─────────────────────────────────────────────────────────

  const value: AuthContextValue = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user && !!token,
    login,
    register,
    logout,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Hook to access auth context
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
