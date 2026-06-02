'use client'

import Link from 'next/link'
import {
  Activity,
  Zap,
  Shield,
  Code,
  DollarSign,
  Lock,
  BarChart3,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Globe,
  Database,
  Key,
  CloudCog,
  Network,
  CreditCard,
  GitBranch,
  Terminal,
  Layers,
  Box,
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'

// ── Tier data ──────────────────────────────────────────────────────────────
const TIERS = [
  {
    name: 'Free',
    badge: null,
    price: '$0',
    period: '/mo',
    description: 'Get started instantly with managed gateway keys. No credit card required.',
    color: '#e5e2e1',
    accentClass: 'border-[#4f453f]/30',
    features: [
      'All 5 providers via gateway keys',
      '50K tokens / month',
      'Semantic caching included',
      'Usage dashboard',
      '1 API key',
      'Community support',
    ],
    cta: 'Start for Free',
    ctaClass: 'bg-[#353534] hover:bg-[#393939] text-[#e5e2e1] border border-[#4f453f]/20',
    href: '/register',
  },
  {
    name: 'Pro',
    badge: 'Most Popular',
    price: '$29',
    period: '/mo',
    description: 'For teams building real products. Generous limits, full analytics.',
    color: '#ffba38',
    accentClass: 'border-[#ffba38]/40',
    features: [
      'Everything in Free',
      '5M tokens / month',
      'Priority routing',
      'BYOK per provider',
      'Up to 10 API keys',
      'Full usage telemetry',
      'Cost attribution per key',
      'Email support',
    ],
    cta: 'Get Pro',
    ctaClass: 'bg-gradient-to-br from-[#ffba38] to-[#c78b00] text-[#281900] hover:shadow-[0_0_24px_rgba(255,186,56,0.35)]',
    href: '/register',
  },
  {
    name: 'Enterprise',
    badge: null,
    price: 'Custom',
    period: '',
    description: 'Full isolation, compliance controls, and dedicated infrastructure.',
    color: '#e2bfb0',
    accentClass: 'border-[#e2bfb0]/20',
    features: [
      'Everything in Pro',
      'Unlimited tokens',
      'Enterprise-Independent mode (BYOK-only)',
      'Private VPC deployment',
      'SSO / SAML',
      'SLA guarantee',
      'Dedicated Slack channel',
      'Custom data retention policies',
    ],
    cta: 'Contact Sales',
    ctaClass: 'bg-[#5a4136] hover:bg-[#6a5146] text-[#e2bfb0] border border-[#e2bfb0]/20',
    href: '/register',
  },
]

// ── Provider data ──────────────────────────────────────────────────────────
const PROVIDERS = [
  {
    name: 'OpenAI',
    models: ['GPT-4o', 'GPT-4.1', 'GPT-4o Mini', 'GPT-4.1 Nano'],
    icon: Sparkles,
    accent: '#ffba38',
    description: 'The most capable frontier models for complex reasoning and generation.',
  },
  {
    name: 'Anthropic',
    models: ['Claude Opus 4.8', 'Claude Sonnet 4.6', 'Claude Haiku 4.5'],
    icon: Activity,
    accent: '#e2bfb0',
    description: 'Safety-first models with exceptional instruction following and analysis.',
  },
  {
    name: 'Google',
    models: ['Gemini 2.5 Pro', 'Gemini 2.5 Flash', 'Gemini 2.5 Flash Lite'],
    icon: CloudCog,
    accent: '#ffba38',
    description: 'Multimodal-first models with massive context windows at low cost.',
  },
  {
    name: 'Cohere',
    models: ['Command A (03-2025)', 'Command R7B'],
    icon: Network,
    accent: '#e2bfb0',
    description: 'RAG-optimised models built for enterprise search and retrieval.',
  },
  {
    name: 'Mistral',
    models: ['Mistral Large 3', 'Mistral Medium 3.5', 'Mistral Small 4'],
    icon: Zap,
    accent: '#ffba38',
    description: 'European open-weight models with strong multilingual performance.',
  },
]

// ── Feature data ──────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Network,
    title: 'OpenAI-Compatible Endpoint',
    description: 'A single `/v1/chat/completions` endpoint handles all 5 providers. Change one string and your app routes to any model — no SDK changes, no adapter layers.',
    tag: 'Unified API',
  },
  {
    icon: Database,
    title: 'Semantic Caching via pgvector',
    description: 'Vector-similarity caching means near-duplicate prompts serve cached responses instantly. Cut your token spend by 30–50% with zero application changes.',
    tag: 'Cost Reduction',
  },
  {
    icon: Shield,
    title: 'Row-Level Tenant Isolation',
    description: 'Every query is scoped to a tenant ID enforced at the database level. Tenants cannot see each other\'s data, keys, or usage — ever.',
    tag: 'Multi-Tenancy',
  },
  {
    icon: BarChart3,
    title: 'Per-Key Cost Attribution',
    description: 'Every request logs model, provider, input/output tokens, latency, and dollar cost — attributed to the specific API key that made it.',
    tag: 'Observability',
  },
  {
    icon: Key,
    title: 'Hybrid Key Management',
    description: 'Use our managed gateway keys for instant access, or store your own provider credentials with AES-256-GCM encryption. BYOK keys take precedence automatically.',
    tag: 'Security',
  },
  {
    icon: GitBranch,
    title: 'Self-Hosted & Open Source',
    description: 'Deploy on your own infrastructure with a single `docker compose up`. MIT licensed. No vendor lock-in, no egress fees, no surprise bills.',
    tag: 'Open Source',
  },
]

export default function LandingPage() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="min-h-screen bg-[#131313]">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-[#131313]/80 backdrop-blur-xl border-b border-[#4f453f]/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="rounded-[6px] bg-gradient-to-br from-[#ffba38] to-[#c78b00] p-2">
              <Activity className="w-4 h-4 text-[#281900]" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-bold text-[#e5e2e1] tracking-[-0.02em]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Supergate
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>
            <a href="#features" className="text-[#e5e2e1]/60 hover:text-[#e5e2e1] transition-colors">Features</a>
            <a href="#providers" className="text-[#e5e2e1]/60 hover:text-[#e5e2e1] transition-colors">Models</a>
            <a href="#pricing" className="text-[#e5e2e1]/60 hover:text-[#e5e2e1] transition-colors">Pricing</a>
            <a href={process.env.NEXT_PUBLIC_DOCS_URL || "http://localhost:3002"} target="_blank" rel="noopener noreferrer" className="text-[#e5e2e1]/60 hover:text-[#e5e2e1] transition-colors">Docs</a>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <button className="bg-gradient-to-br from-[#ffba38] to-[#c78b00] text-[#281900] px-4 py-2 rounded-md font-semibold text-sm hover:shadow-[0_0_20px_rgba(255,186,56,0.3)] transition-all" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  Go to Dashboard
                </button>
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm text-[#e5e2e1]/60 hover:text-[#e5e2e1] transition-colors" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Sign in
                </Link>
                <Link href="/register">
                  <button className="bg-gradient-to-br from-[#ffba38] to-[#c78b00] text-[#281900] px-4 py-2 rounded-md font-semibold text-sm hover:shadow-[0_0_20px_rgba(255,186,56,0.3)] transition-all" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    Get started
                  </button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="pt-20">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="relative flex flex-col items-center justify-center text-center px-6 pt-24 pb-20 overflow-hidden">
          {/* Ambient glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#ffba38]/8 blur-[120px] rounded-full pointer-events-none" />

          <div className="relative z-10 max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#5a4136]/60 border border-[#ffba38]/20 text-[#e2bfb0] text-[11px] font-semibold tracking-[0.1em] uppercase mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ffba38] animate-pulse" />
              5 Providers · 1 Endpoint · Open Source
            </div>

            <h1 className="text-5xl md:text-7xl font-bold tracking-[-0.03em] leading-[1.05] text-[#e5e2e1] mb-6" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              One gateway for<br />
              <span className="bg-gradient-to-r from-[#ffba38] to-[#c78b00] bg-clip-text text-transparent">
                every frontier model.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-[#e5e2e1]/60 max-w-2xl mx-auto mb-10 leading-relaxed" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Supergate is a self-hosted LLM proxy that routes to OpenAI, Anthropic, Google, Cohere, and Mistral through a single OpenAI-compatible API — with semantic caching, multi-tenancy, BYOK, and per-key cost tracking built in.
            </p>

            <div className="flex flex-wrap justify-center gap-4 mb-16">
              <Link href="/register">
                <button className="flex items-center gap-2 bg-gradient-to-br from-[#ffba38] to-[#c78b00] text-[#281900] px-6 py-3.5 rounded-md font-bold text-base hover:shadow-[0_0_30px_rgba(255,186,56,0.3)] transition-all" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  Deploy in 5 minutes <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
              <a href="https://github.com/shivanshshekhar11/supergate" target="_blank" rel="noopener noreferrer">
                <button className="flex items-center gap-2 bg-[#1c1b1b] border border-[#4f453f]/20 text-[#e5e2e1] px-6 py-3.5 rounded-md font-semibold text-base hover:bg-[#353534] transition-all" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  <Code className="w-4 h-4" /> View on GitHub
                </button>
              </a>
            </div>

            {/* Code snippet */}
            <div className="bg-[#0e0e0e] border border-[#4f453f]/20 rounded-xl overflow-hidden text-left max-w-2xl mx-auto shadow-2xl">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[#4f453f]/20 bg-[#1c1b1b]">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
                </div>
                <span className="text-[#e5e2e1]/30 text-xs font-mono ml-2">example.ts</span>
              </div>
              <pre className="p-5 text-sm font-mono overflow-x-auto leading-relaxed text-[#e5e2e1]/80">
                <span className="text-[#e5e2e1]/30">{'// One client. Any model. Zero provider SDKs.'}</span>{'\n'}
                <span className="text-[#c792ea]">const</span>{' '}
                <span className="text-[#e5e2e1]">client</span>{' '}
                <span className="text-[#89ddff]">=</span>{' '}
                <span className="text-[#82aaff]">new</span>{' '}
                <span className="text-[#ffba38]">OpenAI</span>
                {'({\n'}
                {'  '}
                <span className="text-[#e5e2e1]/60">baseURL</span>
                {': '}
                <span className="text-[#c3e88d]">&apos;https://your-gateway/v1&apos;</span>
                {',\n'}
                {'  '}
                <span className="text-[#e5e2e1]/60">apiKey</span>
                {': '}
                <span className="text-[#c3e88d]">&apos;gw_your_api_key&apos;</span>
                {',\n})\n\n'}
                <span className="text-[#e5e2e1]/30">{'// Route to GPT-4o'}</span>{'\n'}
                <span className="text-[#89ddff]">await</span>{' '}
                <span className="text-[#e5e2e1]">client</span>
                {'.chat.completions.create({ '}
                <span className="text-[#e5e2e1]/60">model</span>
                {': '}
                <span className="text-[#c3e88d]">&apos;gpt-4o&apos;</span>
                {' })\n'}
                <span className="text-[#e5e2e1]/30">{'// Route to Claude Opus 4.8 — same client'}</span>{'\n'}
                <span className="text-[#89ddff]">await</span>{' '}
                <span className="text-[#e5e2e1]">client</span>
                {'.chat.completions.create({ '}
                <span className="text-[#e5e2e1]/60">model</span>
                {': '}
                <span className="text-[#c3e88d]">&apos;claude-opus-4-8&apos;</span>
                {' })'}
              </pre>
            </div>
          </div>
        </section>

        {/* ── Stats bar ─────────────────────────────────────────────────────── */}
        <section className="border-y border-[#4f453f]/15 bg-[#1c1b1b]">
          <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-px divide-x divide-[#4f453f]/15">
            {[
              { value: '5', label: 'LLM Providers' },
              { value: '15', label: 'Current Models' },
              { value: '~40%', label: 'Avg. Cost Saved via Cache' },
              { value: 'MIT', label: 'License · Self-Hostable' },
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center justify-center py-4 px-6 text-center">
                <div className="text-3xl font-bold text-[#ffba38] tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{stat.value}</div>
                <div className="text-xs text-[#e5e2e1]/50 mt-1" style={{ fontFamily: 'Manrope, sans-serif' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ──────────────────────────────────────────────────────── */}
        <section id="features" className="py-28 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16 max-w-2xl">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#ffba38] font-semibold mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>Built different</p>
              <h2 className="text-4xl md:text-5xl font-bold text-[#e5e2e1] tracking-[-0.02em] leading-tight mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Everything you need.<br />Nothing you don&apos;t.
              </h2>
              <p className="text-[#e5e2e1]/60 text-lg leading-relaxed" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Supergate covers the hard parts of production LLM infrastructure — so you can focus on building your product.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((f, i) => (
                <div key={i} className="bg-[#1c1b1b] border border-[#4f453f]/15 rounded-xl p-7 hover:border-[#ffba38]/20 hover:-translate-y-1 transition-all duration-300 group">
                  <div className="flex items-start justify-between mb-5">
                    <div className="w-10 h-10 bg-[#5a4136]/50 rounded-lg flex items-center justify-center">
                      <f.icon className="w-5 h-5 text-[#ffba38]" />
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.12em] text-[#e5e2e1]/30 font-semibold" style={{ fontFamily: 'Inter, sans-serif' }}>{f.tag}</span>
                  </div>
                  <h3 className="text-lg font-bold text-[#e5e2e1] mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{f.title}</h3>
                  <p className="text-sm text-[#e5e2e1]/55 leading-relaxed" style={{ fontFamily: 'Manrope, sans-serif' }}>{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Providers ─────────────────────────────────────────────────────── */}
        <section id="providers" className="py-28 px-6 bg-[#0e0e0e]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#ffba38] font-semibold mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>Current model lineup</p>
              <h2 className="text-4xl md:text-5xl font-bold text-[#e5e2e1] tracking-[-0.02em] mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                All frontier models.<br />One endpoint.
              </h2>
              <p className="text-[#e5e2e1]/55 max-w-xl mx-auto" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Models are kept up to date with provider deprecation schedules. Currently reflecting the June 2026 lineup.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {PROVIDERS.map((p, i) => (
                <div key={i} className="bg-[#1c1b1b] border border-[#4f453f]/15 rounded-xl p-6 hover:border-[#4f453f]/40 transition-colors">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${p.accent}18` }}>
                      <p.icon className="w-5 h-5" style={{ color: p.accent }} />
                    </div>
                    <span className="font-bold text-[#e5e2e1]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{p.name}</span>
                  </div>
                  <p className="text-xs text-[#e5e2e1]/50 mb-4 leading-relaxed" style={{ fontFamily: 'Manrope, sans-serif' }}>{p.description}</p>
                  <div className="space-y-1.5">
                    {p.models.map((m, mi) => (
                      <div key={mi} className="flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full" style={{ backgroundColor: p.accent }} />
                        <span className="text-xs font-mono text-[#e5e2e1]/60">{m}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* How it works card */}
              <div className="bg-gradient-to-br from-[#5a4136]/40 to-[#1c1b1b] border border-[#ffba38]/15 rounded-xl p-6 flex flex-col justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[#ffba38] font-semibold mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>How routing works</p>
                  <p className="text-sm text-[#e5e2e1]/70 leading-relaxed mb-5" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    Supergate reads the <code className="text-[#ffba38] font-mono bg-[#ffba38]/10 px-1 rounded">model</code> field in your request and routes to the correct provider automatically. BYOK keys take precedence over gateway keys per provider.
                  </p>
                </div>
                <div className="space-y-2">
                  {['gpt-4o → OpenAI', 'claude-opus-4-8 → Anthropic', 'gemini-2.5-flash → Google', 'command-a-03-2025 → Cohere', 'mistral-large-latest → Mistral'].map((r, ri) => (
                    <div key={ri} className="flex items-center gap-2 font-mono text-xs text-[#e5e2e1]/50">
                      <ArrowRight className="w-3 h-3 text-[#ffba38]/50" />
                      {r}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Key Management ─────────────────────────────────────────────────── */}
        <section className="py-28 px-6 bg-[#131313]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#ffba38] font-semibold mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>Flexible authentication</p>
              <h2 className="text-4xl font-bold text-[#e5e2e1] tracking-[-0.02em] mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Managed keys or your own. Your choice.
              </h2>
              <p className="text-[#e5e2e1]/55 max-w-xl mx-auto" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Supergate supports a hybrid model — start with managed gateway keys, move to BYOK when you need compliance. Mix and match per provider.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Gateway Keys */}
              <div className="bg-[#1c1b1b] border border-[#ffba38]/20 rounded-xl p-8 relative overflow-hidden group hover:border-[#ffba38]/40 transition-colors">
                <div className="absolute -top-8 -right-8 w-48 h-48 bg-[#ffba38]/6 blur-[60px] rounded-full group-hover:bg-[#ffba38]/12 transition-all" />
                <div className="relative">
                  <div className="w-11 h-11 bg-[#ffba38]/10 rounded-lg flex items-center justify-center mb-6 border border-[#ffba38]/20">
                    <Key className="w-5 h-5 text-[#ffba38]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#e5e2e1] mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Gateway Keys</h3>
                  <p className="text-[#e5e2e1]/55 text-sm mb-6 leading-relaxed" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    Use Supergate&apos;s managed provider keys. Zero configuration — just generate a gateway key and start calling any model immediately. Ideal for prototypes and early-stage teams.
                  </p>
                  <ul className="space-y-3">
                    {[
                      'No provider accounts needed',
                      'Instant access to all 5 providers',
                      'Unified billing through one gateway',
                      'Great for rapid prototyping',
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-sm text-[#e5e2e1]/70" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        <CheckCircle className="w-4 h-4 text-[#ffba38] shrink-0" />{item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* BYOK */}
              <div className="bg-[#1c1b1b] border border-[#e2bfb0]/15 rounded-xl p-8 relative overflow-hidden group hover:border-[#e2bfb0]/30 transition-colors">
                <div className="absolute -top-8 -right-8 w-48 h-48 bg-[#e2bfb0]/6 blur-[60px] rounded-full group-hover:bg-[#e2bfb0]/10 transition-all" />
                <div className="relative">
                  <div className="w-11 h-11 bg-[#5a4136] rounded-lg flex items-center justify-center mb-6 border border-[#e2bfb0]/15">
                    <Lock className="w-5 h-5 text-[#e2bfb0]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#e5e2e1] mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Bring Your Own Key (BYOK)</h3>
                  <p className="text-[#e5e2e1]/55 text-sm mb-6 leading-relaxed" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    Store your own provider credentials inside Supergate, encrypted with AES-256-GCM. Your keys are used directly — Supergate never proxies billing. Available per provider, per tenant.
                  </p>
                  <ul className="space-y-3">
                    {[
                      'AES-256-GCM encrypted at rest',
                      'Direct provider billing relationship',
                      'Per-provider granularity',
                      'Enterprise-Independent mode (BYOK-only tenants)',
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-sm text-[#e5e2e1]/70" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        <CheckCircle className="w-4 h-4 text-[#e2bfb0] shrink-0" />{item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Pricing ───────────────────────────────────────────────────────── */}
        <section id="pricing" className="py-28 px-6 bg-[#0e0e0e]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#ffba38] font-semibold mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>Transparent pricing</p>
              <h2 className="text-4xl md:text-5xl font-bold text-[#e5e2e1] tracking-[-0.02em] mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Start free. Scale when ready.
              </h2>
              <p className="text-[#e5e2e1]/55 max-w-lg mx-auto" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Or self-host entirely for free — all tiers are available on your own infrastructure.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              {TIERS.map((tier, i) => (
                <div key={i} className={`relative bg-[#1c1b1b] border rounded-xl p-7 flex flex-col ${tier.accentClass} ${tier.name === 'Pro' ? 'ring-1 ring-[#ffba38]/30' : ''}`}>
                  {tier.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-gradient-to-br from-[#ffba38] to-[#c78b00] text-[#281900] text-[10px] font-bold uppercase tracking-[0.1em] px-3 py-1 rounded-full">
                        {tier.badge}
                      </span>
                    </div>
                  )}
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-[#e5e2e1] mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{tier.name}</h3>
                    <div className="flex items-end gap-1 mb-3">
                      <span className="text-4xl font-bold text-[#e5e2e1]" style={{ fontFamily: 'Space Grotesk, sans-serif', color: tier.color }}>{tier.price}</span>
                      {tier.period && <span className="text-[#e5e2e1]/40 text-sm mb-1">{tier.period}</span>}
                    </div>
                    <p className="text-xs text-[#e5e2e1]/50 leading-relaxed" style={{ fontFamily: 'Manrope, sans-serif' }}>{tier.description}</p>
                  </div>

                  <ul className="space-y-2.5 flex-1 mb-7">
                    {tier.features.map((f, fi) => (
                      <li key={fi} className="flex items-start gap-2.5 text-sm text-[#e5e2e1]/70" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: tier.color }} />{f}
                      </li>
                    ))}
                  </ul>

                  <Link href={tier.href}>
                    <button className={`w-full py-2.5 rounded-md font-semibold text-sm transition-all ${tier.ctaClass}`} style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                      {tier.cta}
                    </button>
                  </Link>
                </div>
              ))}
            </div>

            <p className="text-center text-xs text-[#e5e2e1]/30 mt-8" style={{ fontFamily: 'Manrope, sans-serif' }}>
              All plans include semantic caching, usage telemetry, and multi-tenancy. Self-hosting is always free.
            </p>
          </div>
        </section>

        {/* ── How to deploy ─────────────────────────────────────────────────── */}
        <section className="py-28 px-6 bg-[#131313]">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#ffba38] font-semibold mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>Self-hosted in minutes</p>
              <h2 className="text-4xl font-bold text-[#e5e2e1] tracking-[-0.02em] mb-5 leading-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                One command.<br />Fully running.
              </h2>
              <p className="text-[#e5e2e1]/55 mb-8 leading-relaxed" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Supergate ships as a Turborepo monorepo with Docker Compose. Bring your own PostgreSQL and Redis, or let the compose file spin them up. Copy your <code className="text-[#ffba38] font-mono text-sm bg-[#ffba38]/10 px-1 rounded">.env</code>, run the stack, seed the database, and you&apos;re live.
              </p>
              <div className="space-y-3">
                {[
                  { icon: Box, text: 'Docker Compose stack (gateway + dashboard + docs + postgres + redis)' },
                  { icon: Layers, text: 'Turborepo monorepo — build only what changed' },
                  { icon: Terminal, text: 'Database migrations with Drizzle ORM — no manual SQL' },
                  { icon: GitBranch, text: 'GitHub Actions CI/CD template included' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-md bg-[#1c1b1b] border border-[#4f453f]/20 flex items-center justify-center shrink-0 mt-0.5">
                      <item.icon className="w-3.5 h-3.5 text-[#ffba38]" />
                    </div>
                    <span className="text-sm text-[#e5e2e1]/60 leading-relaxed" style={{ fontFamily: 'Manrope, sans-serif' }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Terminal block */}
            <div className="bg-[#0e0e0e] border border-[#4f453f]/20 rounded-xl overflow-hidden shadow-2xl">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[#4f453f]/20 bg-[#1c1b1b]">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
                </div>
                <span className="text-[#e5e2e1]/30 text-xs font-mono ml-2">bash</span>
              </div>
              <div className="p-5 font-mono text-sm space-y-2 leading-relaxed">
                <div><span className="text-[#ffba38]">$</span> <span className="text-[#e5e2e1]/70">git clone github.com/shivanshshekhar11/supergate</span></div>
                <div><span className="text-[#ffba38]">$</span> <span className="text-[#e5e2e1]/70">cp .env.example .env <span className="text-[#e5e2e1]/30"># add your keys</span></span></div>
                <div><span className="text-[#ffba38]">$</span> <span className="text-[#e5e2e1]/70">docker compose -f docker-compose.prod.yml up -d</span></div>
                <div className="text-[#e5e2e1]/30">Pulling gateway ... done</div>
                <div className="text-[#e5e2e1]/30">Pulling dashboard ... done</div>
                <div className="text-[#e5e2e1]/30">Starting postgres ... done</div>
                <div className="text-[#e5e2e1]/30">Starting redis ... done</div>
                <div><span className="text-[#ffba38]">$</span> <span className="text-[#e5e2e1]/70">pnpm db:migrate && pnpm db:seed</span></div>
                <div className="text-[#27c93f]">✅ Supergate is live on :3000</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────────────── */}
        <section className="px-6 pb-28">
          <div className="max-w-7xl mx-auto">
            <div className="relative bg-gradient-to-br from-[#5a4136]/50 to-[#1c1b1b] border border-[#4f453f]/20 rounded-2xl p-12 lg:p-20 text-center overflow-hidden">
              <div className="absolute top-0 right-0 w-[500px] h-[300px] bg-[#ffba38]/8 blur-[100px] rounded-full pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-[300px] h-[200px] bg-[#e2bfb0]/6 blur-[100px] rounded-full pointer-events-none" />
              <div className="relative z-10">
                <h2 className="text-4xl lg:text-6xl font-bold text-[#e5e2e1] tracking-[-0.02em] leading-tight mb-5" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  Ship faster with a<br />
                  <span className="bg-gradient-to-r from-[#ffba38] to-[#c78b00] bg-clip-text text-transparent">
                    gateway that just works.
                  </span>
                </h2>
                <p className="text-[#e5e2e1]/55 text-lg max-w-xl mx-auto mb-10" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Open source, MIT licensed, and ready to run in your own infrastructure in under five minutes.
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <Link href={isAuthenticated ? "/dashboard" : "/register"}>
                    <button className="flex items-center gap-2 bg-gradient-to-br from-[#ffba38] to-[#c78b00] text-[#281900] px-8 py-4 rounded-md font-bold text-base hover:shadow-[0_0_30px_rgba(255,186,56,0.3)] transition-all" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                      {isAuthenticated ? "Go to Dashboard" : "Get started free"} <ArrowRight className="w-4 h-4" />
                    </button>
                  </Link>
                  <a href="https://github.com/shivanshshekhar11/supergate" target="_blank" rel="noopener noreferrer">
                    <button className="flex items-center gap-2 bg-[#0e0e0e] border border-[#4f453f]/20 text-[#e5e2e1] px-8 py-4 rounded-md font-semibold text-base hover:bg-[#1c1b1b] transition-all" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                      <Code className="w-4 h-4" /> Star on GitHub
                    </button>
                  </a>
                </div>
                <p className="text-xs text-[#e5e2e1]/25 mt-8 uppercase tracking-[0.15em]" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Open Source · MIT License · Docker Ready · No Vendor Lock-in
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#0e0e0e] border-t border-[#4f453f]/10">
        <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-2 md:grid-cols-4 gap-10" style={{ fontFamily: 'Manrope, sans-serif' }}>
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="rounded-[4px] bg-gradient-to-br from-[#ffba38] to-[#c78b00] p-1.5">
                <Activity className="w-3.5 h-3.5 text-[#281900]" strokeWidth={2.5} />
              </div>
              <span className="font-bold text-[#e5e2e1]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Supergate</span>
            </div>
            <p className="text-xs text-[#e5e2e1]/40 leading-relaxed">
              Unified LLM gateway for production apps.<br />Open source under the MIT license.
            </p>
          </div>
          <div className="flex flex-col gap-2.5">
            <h4 className="text-xs font-bold text-[#e5e2e1]/50 uppercase tracking-[0.12em] mb-1">Product</h4>
            <Link href={isAuthenticated ? "/dashboard" : "/register"} className="text-sm text-[#e5e2e1]/40 hover:text-[#ffba38] transition-colors">{isAuthenticated ? "Go to Dashboard" : "Get Started"}</Link>
            <a href="#features" className="text-sm text-[#e5e2e1]/40 hover:text-[#ffba38] transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-[#e5e2e1]/40 hover:text-[#ffba38] transition-colors">Pricing</a>
          </div>
          <div className="flex flex-col gap-2.5">
            <h4 className="text-xs font-bold text-[#e5e2e1]/50 uppercase tracking-[0.12em] mb-1">Resources</h4>
            <a href={process.env.NEXT_PUBLIC_DOCS_URL || "http://localhost:3002"} target="_blank" rel="noopener noreferrer" className="text-sm text-[#e5e2e1]/40 hover:text-[#ffba38] transition-colors">Documentation</a>
            <a href="https://github.com/shivanshshekhar11/supergate" target="_blank" rel="noopener noreferrer" className="text-sm text-[#e5e2e1]/40 hover:text-[#ffba38] transition-colors">GitHub</a>
            <a href="#providers" className="text-sm text-[#e5e2e1]/40 hover:text-[#ffba38] transition-colors">Supported Models</a>
          </div>
          <div className="flex flex-col gap-2.5">
            <h4 className="text-xs font-bold text-[#e5e2e1]/50 uppercase tracking-[0.12em] mb-1">Legal</h4>
            <a href="#" className="text-sm text-[#e5e2e1]/40 hover:text-[#ffba38] transition-colors">Privacy Policy</a>
            <a href="#" className="text-sm text-[#e5e2e1]/40 hover:text-[#ffba38] transition-colors">Terms of Service</a>
            <a href="#" className="text-sm text-[#e5e2e1]/40 hover:text-[#ffba38] transition-colors">MIT License</a>
          </div>
        </div>
        <div className="border-t border-[#4f453f]/8 px-6 py-5 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-[#e5e2e1]/20" style={{ fontFamily: 'Manrope, sans-serif' }}>© 2026 Supergate. Open source under the MIT License.</p>
          <div className="flex items-center gap-2 text-xs text-[#e5e2e1]/20" style={{ fontFamily: 'Manrope, sans-serif' }}>
            <Globe className="w-3 h-3" />
            <span>Self-hostable anywhere</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
