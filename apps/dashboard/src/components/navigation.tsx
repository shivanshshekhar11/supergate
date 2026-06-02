'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Activity, BarChart3, Key, KeyRound, FlaskConical, Settings, LogOut, User, ChevronDown, Menu, X } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useState, useEffect, useRef } from 'react'

const navigation = [
  { name: 'Overview',   href: '/dashboard',            icon: Activity     },
  { name: 'Usage',      href: '/dashboard/usage',      icon: BarChart3    },
  { name: 'API Keys',   href: '/dashboard/api-keys',   icon: KeyRound     },
  { name: 'LLM Keys',   href: '/dashboard/keys',       icon: Key          },
  { name: 'Playground', href: '/dashboard/playground', icon: FlaskConical },
]

export function Navigation() {
  const pathname  = usePathname()
  const router    = useRouter()
  const { user, logout } = useAuth()

  const [userMenuOpen,   setUserMenuOpen]   = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const handleLogout = async () => {
    setUserMenuOpen(false)
    await logout()
    router.push('/login')
  }

  // Close user menu on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  // Close mobile menu on route change
  useEffect(() => { setMobileMenuOpen(false) }, [pathname])

  const currentTenant = user?.tenants?.[0]
  const initials = user?.user.name
    ? user.user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <nav className="bg-[#1c1b1b] relative z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 sm:h-20 items-center justify-between">

          {/* Left — logo + desktop nav */}
          <div className="flex items-center gap-6 lg:gap-10">
            <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
              <div className="rounded-[6px] bg-gradient-to-br from-[#ffba38] to-[#c78b00] p-2 sm:p-2.5">
                <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-[#281900]" strokeWidth={2.5} />
              </div>
              <span className="text-lg sm:text-xl font-bold text-[#e5e2e1] tracking-[-0.02em]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Supergate
              </span>
            </Link>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 lg:px-4 py-2.5 rounded-[6px] text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-[#353534] text-[#e5e2e1]'
                        : 'text-[#e5e2e1]/70 hover:text-[#e5e2e1] hover:bg-[#353534]'
                    }`}
                    style={{ fontFamily: 'Manrope, sans-serif' }}
                  >
                    <item.icon className="w-4 h-4" strokeWidth={2} />
                    {item.name}
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Right — avatar popup + mobile hamburger */}
          <div className="flex items-center gap-3">

            {/* Avatar / user menu */}
            {user && (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(v => !v)}
                  className="flex items-center gap-2.5 bg-[#353534] hover:bg-[#393939] rounded-[6px] px-2 py-1.5 transition-colors group"
                  aria-label="User menu"
                >
                  {/* Text avatar */}
                  <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#ffba38] to-[#c78b00] flex items-center justify-center text-[#281900] text-xs font-bold shrink-0">
                    {initials}
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-[#e5e2e1] max-w-[120px] truncate" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {user.user.name}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-[#e5e2e1]/50 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-[#131313] border border-[#4f453f]/20 rounded-lg shadow-2xl overflow-hidden">
                    {/* User info header */}
                    <div className="px-4 py-3 border-b border-[#4f453f]/15">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md bg-gradient-to-br from-[#ffba38] to-[#c78b00] flex items-center justify-center text-[#281900] text-sm font-bold shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#e5e2e1] truncate" style={{ fontFamily: 'Manrope, sans-serif' }}>
                            {user.user.name}
                          </p>
                          <p className="text-xs text-[#e5e2e1]/50 truncate" style={{ fontFamily: 'Manrope, sans-serif' }}>
                            {user.user.email}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Tenant info */}
                    {currentTenant && (
                      <div className="px-4 py-2.5 border-b border-[#4f453f]/15">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-[#e5e2e1]/40" />
                            <span className="text-xs text-[#e5e2e1]/50" style={{ fontFamily: 'Manrope, sans-serif' }}>Tenant</span>
                          </div>
                          <span className="text-xs font-medium text-[#e5e2e1] truncate max-w-[130px]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                            {currentTenant.name}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-xs text-[#e5e2e1]/50" style={{ fontFamily: 'Manrope, sans-serif' }}>Role</span>
                          <span className="text-[10px] uppercase tracking-[0.12em] bg-[#5a4136]/40 text-[#e2bfb0] px-2 py-0.5 rounded-sm font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
                            {currentTenant.role}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-xs text-[#e5e2e1]/50" style={{ fontFamily: 'Manrope, sans-serif' }}>Tier</span>
                          <span className="text-xs text-[#ffba38] font-medium uppercase" style={{ fontFamily: 'Manrope, sans-serif' }}>
                            {currentTenant.tier}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="p-1.5">
                      <Link
                        href="/dashboard/settings"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm text-[#e5e2e1]/70 hover:text-[#e5e2e1] hover:bg-[#1c1b1b] transition-colors"
                        style={{ fontFamily: 'Manrope, sans-serif' }}
                      >
                        <Settings className="w-4 h-4" />
                        Settings
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm text-[#ffb4ab]/80 hover:text-[#ffb4ab] hover:bg-[#93000a]/20 transition-colors"
                        style={{ fontFamily: 'Manrope, sans-serif' }}
                      >
                        <LogOut className="w-4 h-4" />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(v => !v)}
              className="md:hidden flex items-center justify-center w-9 h-9 bg-[#353534] hover:bg-[#393939] rounded-[6px] transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4 text-[#e5e2e1]" /> : <Menu className="w-4 h-4 text-[#e5e2e1]" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#4f453f]/15 bg-[#1c1b1b]">
          <div className="px-4 py-3 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-[6px] text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#353534] text-[#e5e2e1]'
                      : 'text-[#e5e2e1]/70 hover:text-[#e5e2e1] hover:bg-[#353534]'
                  }`}
                  style={{ fontFamily: 'Manrope, sans-serif' }}
                >
                  <item.icon className="w-4 h-4" strokeWidth={2} />
                  {item.name}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </nav>
  )
}
