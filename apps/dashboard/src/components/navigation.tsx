'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Activity, BarChart3, Key, Settings, LogOut, User } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'

const navigation = [
  { name: 'Overview', href: '/', icon: Activity },
  { name: 'Usage', href: '/usage', icon: BarChart3 },
  { name: 'API Keys', href: '/keys', icon: Key },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const currentTenant = user?.tenants?.[0]

  return (
    <nav className="bg-[#1c1b1b]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          <div className="flex items-center gap-10">
            <Link href="/" className="flex items-center gap-3">
              <div className="rounded-[6px] bg-gradient-to-br from-[#ffba38] to-[#c78b00] p-2.5">
                <Activity className="w-5 h-5 text-[#281900]" strokeWidth={2.5} />
              </div>
              <span className="text-xl font-bold text-[#e5e2e1] tracking-[-0.02em]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Supergate
              </span>
            </Link>
            
            <div className="hidden md:flex items-center gap-2">
              {navigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-[6px] text-sm font-medium transition-all ${
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

          <div className="flex items-center gap-4">
            {/* Tenant Info */}
            {currentTenant && (
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-[#353534] rounded-[6px]">
                <User className="w-4 h-4 text-[#e5e2e1]/60" />
                <div className="text-sm">
                  <span className="text-[#e5e2e1]/60 tracking-[0.01em]" style={{ fontFamily: 'Manrope, sans-serif' }}>Tenant: </span>
                  <span className="font-medium text-[#e5e2e1] tracking-[0.01em]" style={{ fontFamily: 'Manrope, sans-serif' }}>{currentTenant.name}</span>
                </div>
              </div>
            )}

            {/* User Info & Logout */}
            {user && (
              <div className="flex items-center gap-4">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium text-[#e5e2e1] tracking-[0.01em]" style={{ fontFamily: 'Manrope, sans-serif' }}>{user.user.name}</p>
                  <p className="text-xs text-[#e5e2e1]/50 tracking-[0.01em]" style={{ fontFamily: 'Manrope, sans-serif' }}>{user.user.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#353534] text-[#e5e2e1]/70 hover:text-[#e5e2e1] hover:bg-[#393939] rounded-[6px] text-sm font-medium transition-all"
                  style={{ fontFamily: 'Manrope, sans-serif' }}
                >
                  <LogOut className="w-4 h-4" strokeWidth={2} />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
