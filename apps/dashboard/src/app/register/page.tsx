'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Activity, Mail, Lock, User, Building2, AlertCircle } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { GatewayAPIError } from '@/lib/gateway-client'

export default function RegisterPage() {
  const router = useRouter()
  const { register, isAuthenticated } = useAuth()
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    tenantName: '',
  })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Redirect if already authenticated (use useEffect to avoid render-time navigation)
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, router])

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    setIsLoading(true)

    try {
      await register({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        tenantName: formData.tenantName,
      })
      router.push('/dashboard')
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
    <div className="min-h-screen bg-[#131313] flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="rounded-[6px] bg-gradient-to-br from-[#ffba38] to-[#c78b00] p-2.5">
              <Activity className="w-6 h-6 text-[#281900]" strokeWidth={2.5} />
            </div>
            <span className="text-xl font-bold text-[#e5e2e1] tracking-[-0.02em]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Supergate
            </span>
          </Link>
        </div>

        {/* Register Card */}
        <div className="bg-[#1c1b1b] p-6 rounded-[6px]">
          <div className="mb-5">
            <h1 className="text-2xl font-bold text-[#e5e2e1] mb-1 tracking-[-0.01em]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Create your account
            </h1>
            <p className="text-sm text-[#e5e2e1]/70 tracking-[0.01em]" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Get started with your Supergate in seconds
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-[#7f1d1d]/20 rounded-[6px] flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-[#ef4444] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[#ef4444]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  Registration failed
                </p>
                <p className="text-xs text-[#ef4444]/80 mt-0.5" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {error}
                </p>
              </div>
            </div>
          )}

          {/* Register Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Name Field */}
            <div>
              <label htmlFor="name" className="block text-xs font-medium text-[#e5e2e1]/80 mb-1.5 tracking-[0.05em] uppercase" style={{ fontFamily: 'Inter, sans-serif' }}>
                Full name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#e5e2e1]/40" />
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  required
                  placeholder="John Doe"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0e0e0e] text-[#e5e2e1] placeholder-[#e5e2e1]/30 focus:outline-none focus:border-b-2 focus:border-[#ffba38] transition-all tracking-[0.01em] border-b-2 border-transparent rounded-[6px] text-sm"
                  style={{ fontFamily: 'Manrope, sans-serif' }}
                />
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-[#e5e2e1]/80 mb-1.5 tracking-[0.05em] uppercase" style={{ fontFamily: 'Inter, sans-serif' }}>
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#e5e2e1]/40" />
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0e0e0e] text-[#e5e2e1] placeholder-[#e5e2e1]/30 focus:outline-none focus:border-b-2 focus:border-[#ffba38] transition-all tracking-[0.01em] border-b-2 border-transparent rounded-[6px] text-sm"
                  style={{ fontFamily: 'Manrope, sans-serif' }}
                />
              </div>
            </div>

            {/* Tenant Name Field */}
            <div>
              <label htmlFor="tenantName" className="block text-xs font-medium text-[#e5e2e1]/80 mb-1.5 tracking-[0.05em] uppercase" style={{ fontFamily: 'Inter, sans-serif' }}>
                Organization name
              </label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#e5e2e1]/40" />
                <input
                  id="tenantName"
                  type="text"
                  value={formData.tenantName}
                  onChange={(e) => handleChange('tenantName', e.target.value)}
                  required
                  placeholder="Acme Inc"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0e0e0e] text-[#e5e2e1] placeholder-[#e5e2e1]/30 focus:outline-none focus:border-b-2 focus:border-[#ffba38] transition-all tracking-[0.01em] border-b-2 border-transparent rounded-[6px] text-sm"
                  style={{ fontFamily: 'Manrope, sans-serif' }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-[#e5e2e1]/80 mb-1.5 tracking-[0.05em] uppercase" style={{ fontFamily: 'Inter, sans-serif' }}>
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#e5e2e1]/40" />
                <input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  required
                  placeholder="••••••••"
                  minLength={8}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0e0e0e] text-[#e5e2e1] placeholder-[#e5e2e1]/30 focus:outline-none focus:border-b-2 focus:border-[#ffba38] transition-all tracking-[0.01em] border-b-2 border-transparent rounded-[6px] text-sm"
                  style={{ fontFamily: 'Manrope, sans-serif' }}
                />
              </div>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-medium text-[#e5e2e1]/80 mb-1.5 tracking-[0.05em] uppercase" style={{ fontFamily: 'Inter, sans-serif' }}>
                Confirm password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#e5e2e1]/40" />
                <input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleChange('confirmPassword', e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0e0e0e] text-[#e5e2e1] placeholder-[#e5e2e1]/30 focus:outline-none focus:border-b-2 focus:border-[#ffba38] transition-all tracking-[0.01em] border-b-2 border-transparent rounded-[6px] text-sm"
                  style={{ fontFamily: 'Manrope, sans-serif' }}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-br from-[#ffba38] to-[#c78b00] text-[#281900] rounded-[6px] font-bold hover:shadow-[0_0_20px_rgba(255,186,56,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed tracking-[-0.01em]"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              {isLoading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-4 text-center">
            <p className="text-[#e5e2e1]/70 text-sm tracking-[0.01em]" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Already have an account?{' '}
              <Link
                href="/login"
                className="text-[#ffba38] hover:text-[#c78b00] font-medium transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Back to Landing */}
        <div className="mt-4 text-center">
          <Link
            href="/"
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
