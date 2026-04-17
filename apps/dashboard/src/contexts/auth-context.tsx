'use client'

/**
 * Authentication Context
 * 
 * Manages user authentication state across the dashboard.
 * Provides login, register, logout, and user info.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authAPI, GatewayAPIError, type AuthResponse, type MeResponse } from '@/lib/gateway-client'
import type { RegisterRequest, LoginRequest } from '@llm-gateway/schemas'

interface AuthContextValue {
  // State
  user: MeResponse | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  
  // Actions
  login: (credentials: LoginRequest) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const TOKEN_KEY = 'llm_gateway_token'

/**
 * Auth Provider Component
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<MeResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  /**
   * Load user info from token
   */
  const loadUser = useCallback(async (authToken: string) => {
    try {
      const userData = await authAPI.me(authToken)
      setUser(userData)
      setToken(authToken)
    } catch (error) {
      console.error('Failed to load user:', error)
      // Token is invalid, clear it
      localStorage.removeItem(TOKEN_KEY)
      setToken(null)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Initialize auth state from localStorage
   */
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY)
    if (storedToken) {
      loadUser(storedToken)
    } else {
      setIsLoading(false)
    }
  }, [loadUser])

  /**
   * Login with email and password
   */
  const login = useCallback(async (credentials: LoginRequest) => {
    setIsLoading(true)
    try {
      const response = await authAPI.login(credentials)
      localStorage.setItem(TOKEN_KEY, response.token)
      await loadUser(response.token)
    } catch (error) {
      setIsLoading(false)
      throw error
    }
  }, [loadUser])

  /**
   * Register new user and tenant
   */
  const register = useCallback(async (data: RegisterRequest) => {
    setIsLoading(true)
    try {
      const response = await authAPI.register(data)
      localStorage.setItem(TOKEN_KEY, response.token)
      await loadUser(response.token)
    } catch (error) {
      setIsLoading(false)
      throw error
    }
  }, [loadUser])

  /**
   * Logout and clear auth state
   */
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [])

  /**
   * Refresh user data
   */
  const refreshUser = useCallback(async () => {
    if (token) {
      await loadUser(token)
    }
  }, [token, loadUser])

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
