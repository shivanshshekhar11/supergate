import Link from 'next/link'
import { FileQuestion } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#131313] flex flex-col items-center justify-center p-4 text-center">
      <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-[#1c1b1b] border border-[#4f453f]/20 mb-8 shadow-[0_0_40px_rgba(255,186,56,0.05)]">
        <FileQuestion className="w-12 h-12 text-[#ffba38]/60" />
      </div>
      
      <h2 className="mb-4 text-5xl md:text-7xl font-bold text-[#e5e2e1] tracking-tighter" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
        404
      </h2>
      
      <h3 className="mb-4 text-xl font-medium text-[#e5e2e1]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
        Page not found
      </h3>
      
      <p className="mb-10 text-[#e5e2e1]/60 text-lg max-w-md" style={{ fontFamily: 'Manrope, sans-serif' }}>
        The page you are looking for doesn&apos;t exist or has been moved.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4">
        <Link href="/">
          <button className="bg-gradient-to-br from-[#ffba38] to-[#c78b00] text-[#281900] px-8 py-3 rounded-lg font-bold text-sm active:scale-95 transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,186,56,0.3)]">
            Back to Dashboard
          </button>
        </Link>
        <Link href="https://github.com/shivanshshekhar11/supergate" target="_blank" rel="noopener noreferrer">
          <button className="bg-[#1c1b1b] text-[#e5e2e1] px-8 py-3 rounded-lg font-bold text-sm active:scale-95 transition-all duration-300 border border-[#4f453f]/20 hover:bg-[#353534]">
            Documentation
          </button>
        </Link>
      </div>
    </div>
  )
}
