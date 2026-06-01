import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 text-center px-4 py-24">
      <h1 className="text-5xl font-bold tracking-tight font-[family-name:var(--font-space-grotesk)]">
        Supergate Docs
      </h1>
      <p className="text-fd-muted-foreground max-w-xl text-lg font-[family-name:var(--font-manrope)]">
        Multi-tenant LLM gateway with semantic caching, rate limiting, and cost attribution.
        One OpenAI-compatible endpoint for all providers.
      </p>
      <div className="flex gap-4 flex-wrap justify-center">
        <Link
          href="/docs"
          className="rounded-md bg-fd-primary px-6 py-3 text-sm font-semibold text-fd-primary-foreground hover:opacity-90 transition-opacity"
        >
          Get Started
        </Link>
        <Link
          href="/docs/sdk"
          className="rounded-md border border-fd-border px-6 py-3 text-sm font-semibold hover:bg-fd-accent transition-colors"
        >
          SDK Reference
        </Link>
        <a
          href={process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001'}
          className="rounded-md border border-fd-border px-6 py-3 text-sm font-semibold hover:bg-fd-accent transition-colors"
        >
          Open Dashboard
        </a>
        <a
          href="https://github.com/shivanshshekhar11/supergate"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-fd-border px-6 py-3 text-sm font-semibold hover:bg-fd-accent transition-colors"
        >
          GitHub ↗
        </a>
      </div>
    </main>
  )
}
