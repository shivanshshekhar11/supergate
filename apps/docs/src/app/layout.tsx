import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { RootProvider } from 'fumadocs-ui/provider'
import { Space_Grotesk, Manrope } from 'next/font/google'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
})

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
})

export const metadata: Metadata = {
  title: {
    template: '%s | Supergate Docs',
    default:  'Supergate Docs',
  },
  description: 'Documentation for the Supergate LLM Gateway — unified API, semantic caching, multi-tenancy, and cost attribution.',
  metadataBase: new URL('https://github.com/shivanshshekhar11/supergate'),
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning
      className={`${spaceGrotesk.variable} ${manrope.variable}`}>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  )
}
