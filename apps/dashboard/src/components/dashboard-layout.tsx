'use client'

/**
 * Dashboard Layout
 * 
 * Layout wrapper for authenticated dashboard pages.
 * Includes navigation and protected route wrapper.
 */

import { ProtectedRoute } from '@/components/protected-route'
import { Navigation } from '@/components/navigation'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <ProtectedRoute>
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </ProtectedRoute>
  )
}
