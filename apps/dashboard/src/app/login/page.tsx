'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Activity, Mail, Lock, AlertCircle } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { GatewayAPIError } from '@/lib/gateway-client'

export default function LoginPage() {
  const router = useRouter()
  const { login, isAuthenticated } = useAuth()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Redirect if already authenticated (use useEffect to avoid render-time navigation)
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await login({ email, password })
      router.push('/')
    } catch (err) {
      if (err instanceof GatewayAPIError) {
        setError(err.message)
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#131313] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-12">
          <Link href="/landing" className="flex items-center gap-3">
            <div className="rounded-[6px] bg-gradient-to-br from-[#ffba38] to-[#c78b00] p-3">
              <Activity className="w-8 h-8 text-[#281900]" strokeWidth={2.5} />
            </div>
            <span className="text-2xl font-bold text-[#e5e2e1] tracking-[-0.02em]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Supergate
            </span>
          </Link>
        </div>

        {/* Login Card - No border, surface shift */}
        <div className="bg-[#1c1b1b] p-10 rounded-[6px]">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#e5e2e1] mb-3 tracking-[-0.01em]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Welcome back
            </h1>
            <p className="text-[#e5e2e1]/70 tracking-[0.01em]" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Sign in to your account to continue
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-[#7f1d1d]/20 rounded-[6px] flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#ef4444] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[#ef4444]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  Authentication failed
                </p>
                <p className="text-sm text-[#ef4444]/80 mt-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {error}
                </p>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field - No border, bottom accent */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#e5e2e1]/80 mb-2 tracking-[0.05em] uppercase" style={{ fontFamily: 'Inter, sans-serif' }}>
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#e5e2e1]/40" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full pl-12 pr-4 py-3.5 bg-[#0e0e0e] text-[#e5e2e1] placeholder-[#e5e2e1]/30 focus:outline-none focus:border-b-2 focus:border-[#ffba38] transition-all tracking-[0.01em] border-b-2 border-transparent rounded-[6px]"
                  style={{ fontFamily: 'Manrope, sans-serif' }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#e5e2e1]/80 mb-2 tracking-[0.05em] uppercase" style={{ fontFamily: 'Inter, sans-serif' }}>
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#e5e2e1]/40" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3.5 bg-[#0e0e0e] text-[#e5e2e1] placeholder-[#e5e2e1]/30 focus:outline-none focus:border-b-2 focus:border-[#ffba38] transition-all tracking-[0.01em] border-b-2 border-transparent rounded-[6px]"
                  style={{ fontFamily: 'Manrope, sans-serif' }}
                />
              </div>
            </div>

            {/* Submit Button - Gradient with glow */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-br from-[#ffba38] to-[#c78b00] text-[#281900] rounded-[6px] font-bold hover:shadow-[0_0_20px_rgba(255,186,56,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed tracking-[-0.01em]"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Demo Credentials - Secondary container */}
          <div className="mt-8 p-4 bg-[#5a4136] rounded-[6px]">
            <p className="text-xs font-medium text-[#e2bfb0] mb-2 tracking-[0.05em] uppercase" style={{ fontFamily: 'Inter, sans-serif' }}>
              Demo Credentials
            </p>
            <p className="text-sm text-[#e2bfb0]/90 tracking-[0.01em]" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Email: <span className="font-mono">admin@example.com</span>
            </p>
            <p className="text-sm text-[#e2bfb0]/90 tracking-[0.01em]" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Password: <span className="font-mono">password123</span>
            </p>
          </div>

          {/* Register Link */}
          <div className="mt-8 text-center">
            <p className="text-[#e5e2e1]/70 tracking-[0.01em]" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Don't have an account?{' '}
              <Link
                href="/register"
                className="text-[#ffba38] hover:text-[#c78b00] font-medium transition-colors"
              >
                Create one
              </Link>
            </p>
          </div>
        </div>

        {/* Back to Landing */}
        <div className="mt-8 text-center">
          <Link
            href="/landing"
            className="text-[#e5e2e1]/60 hover:text-[#ffba38] transition-colors text-sm tracking-[0.01em]"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            ← Back to landing page
          </Link>
        </div>
      </div>
    </div>
  )
}
