'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard Error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#131313] flex flex-col items-center justify-center p-4 text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#93000a]/10 mb-6">
        <AlertCircle className="w-10 h-10 text-[#ffb4ab]" />
      </div>
      <h2 className="mb-3 text-3xl font-bold text-[#e5e2e1] tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
        Something went wrong!
      </h2>
      <p className="mb-8 text-[#e5e2e1]/60 text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
        An unexpected error occurred in the dashboard.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={() => reset()}
          className="bg-gradient-to-br from-[#ffba38] to-[#c78b00] text-[#281900] px-8 py-3 rounded-lg font-bold text-sm active:scale-95 transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,186,56,0.3)]"
        >
          Try again
        </button>
        <Link href="/">
          <button className="bg-[#1c1b1b] text-[#e5e2e1] px-8 py-3 rounded-lg font-bold text-sm active:scale-95 transition-all duration-300 border border-[#4f453f]/20 hover:bg-[#353534]">
            Go to Home
          </button>
        </Link>
      </div>
    </div>
  )
}
