'use client'

import Link from 'next/link'
import Image from 'next/image'
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
  Users,
  Clock,
  Database,
  Key,
  CloudCog,
  Verified,
  Network,
  CreditCard,
} from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#131313]">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-[#131313]/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="text-2xl font-bold tracking-tighter text-[#e5e2e1]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Supergate
            </div>
            <div className="hidden md:flex items-center space-x-8 tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              <a href="#" className="text-[#ffba38] border-b-2 border-[#ffba38] pb-1">Models</a>
              <a href="#" className="text-[#e5e2e1]/70 hover:text-[#e5e2e1] transition-colors">Features</a>
              <a href="#" className="text-[#e5e2e1]/70 hover:text-[#e5e2e1] transition-colors">Pricing</a>
              <a href="#" className="text-[#e5e2e1]/70 hover:text-[#e5e2e1] transition-colors">Documentation</a>
            </div>
            <div className="flex items-center space-x-6">
              <Link href="/login">
                <button className="text-[#e5e2e1]/70 hover:text-[#e5e2e1] text-sm transition-colors" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  Sign In
                </button>
              </Link>
              <Link href="/register">
                <button className="bg-gradient-to-br from-[#ffba38] to-[#c78b00] text-[#281900] px-6 py-2 rounded-lg font-bold text-sm active:scale-95 transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,186,56,0.3)]">
                  Get Started
                </button>
              </Link>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-r from-transparent via-[#4f453f]/20 to-transparent h-[1px]"></div>
      </nav>

      <main className="pt-24">
        {/* Hero Section */}
        <section className="relative min-h-[921px] flex items-center justify-center overflow-hidden px-8 py-20 lg:py-32">
          <div className="absolute inset-0 z-0">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#ffba38]/30 via-transparent to-transparent blur-3xl"></div>
          </div>
          <div className="relative z-10 max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[2px] bg-[#5a4136] text-[#e2bfb0] text-[10px] font-bold tracking-widest uppercase">
                <Verified className="w-3 h-3" />
                Architectural-Grade Infrastructure
              </div>
              <h1 className="text-5xl lg:text-7xl font-bold leading-[1.1] tracking-tight text-[#e5e2e1]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                The Intelligence Layer for the{' '}
                <span className="bg-gradient-to-r from-[#ffba38] to-[#c78b00] bg-clip-text text-transparent">
                  Modern Enterprise.
                </span>
              </h1>
              <p className="text-xl text-[#e5e2e1]/70 max-w-xl leading-relaxed tracking-[0.01em]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Orchestrate multi-LLM workflows with unified APIs, type-safe schemas, and production-grade reliability. One gateway to rule them all.
              </p>
              <div className="flex flex-wrap gap-4 pt-4">
                <Link href="/register">
                  <button className="bg-gradient-to-br from-[#ffba38] to-[#c78b00] text-[#281900] px-8 py-4 rounded-lg font-bold text-lg active:scale-95 transition-all duration-300 shadow-[0_0_40px_rgba(255,186,56,0.15)]">
                    Get Started
                  </button>
                </Link>
                <button className="bg-[#353534] text-[#e5e2e1] px-8 py-4 rounded-lg font-bold text-lg active:scale-95 transition-all duration-300 border border-[#4f453f]/20 hover:bg-[#393939]">
                  View Documentation
                </button>
              </div>
            </div>
            <div className="relative lg:h-[600px] flex items-center justify-center">
              <div className="w-full aspect-square bg-[#353534]/40 backdrop-blur-[24px] border border-[#4f453f]/15 rounded-2xl shadow-[0_48px_48px_-12px_rgba(0,0,0,0.6)] flex items-center justify-center p-8 overflow-hidden relative group">
                <Image
                  alt="3D Abstract Visual"
                  className="w-full h-full object-cover rounded-xl opacity-80 group-hover:scale-105 transition-transform duration-700"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBqBdPiNZFfXW-rGv0PyNmobd_3CupPNkkDuRN-A4i8UGV3rwUza3Fji0WULtvBA1rAUXm2RGqfaVxjmWWJTQ0gxeo9pgWbzknonMKKhq62Dok6OS4fgu9RIQqHsVldap00R_Sugdy180Y0Ac1SQwweDB4IrnmldjJhtiX8wp7v7uMPv7wEUGVab2FQI_88qfg83KoSomBpu8CZ248N1wbg40g_ApH-DuTErpWRxW7SXVCjUrnXeZ3hbUePyZTbpxMqyc4WaaaT_rw"
                  width={600}
                  height={600}
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] to-transparent opacity-60"></div>
                <div className="absolute bottom-8 left-8 right-8">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-[#e5e2e1]/60 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
                        System Status
                      </p>
                      <p className="text-lg font-bold text-[#e5e2e1]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                        Latency: 42ms
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-[#ffba38] rounded-full flex items-center justify-center">
                      <Zap className="w-6 h-6 text-[#281900]" fill="currentColor" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem/Solution Section */}
        <section className="bg-[#1c1b1b] py-24 px-8">
          <div className="max-w-7xl mx-auto text-center space-y-12">
            <h2 className="text-3xl md:text-4xl font-semibold text-[#e5e2e1]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              One Endpoint. <span className="text-[#ffba38]">Infinite Possibilities.</span>
            </h2>
            <div className="grid md:grid-cols-2 gap-px bg-[#4f453f]/20">
              <div className="bg-[#1c1b1b] p-12 space-y-4">
                <div className="text-[#ffba38] text-4xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  Unified API
                </div>
                <p className="text-[#e5e2e1]/70 text-lg max-w-md mx-auto tracking-[0.01em]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Eliminate provider lock-in. Swap models from OpenAI, Anthropic, or Llama with a single line change. Our proxy handles the translation.
                </p>
              </div>
              <div className="bg-[#1c1b1b] p-12 space-y-4">
                <div className="text-[#ffba38] text-4xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  Zero Duplication
                </div>
                <p className="text-[#e5e2e1]/70 text-lg max-w-md mx-auto tracking-[0.01em]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Advanced semantic hashing ensures you never pay for the same query twice. Intelligent caching built for the era of intelligence.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="py-32 px-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16">
              <h2 className="text-4xl font-bold mb-4 text-[#e5e2e1]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Engineered for Precision
              </h2>
              <p className="text-[#e5e2e1]/70 max-w-xl tracking-[0.01em]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                A suite of specialized tools designed to handle the complexities of enterprise LLM deployment.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Unified API */}
              <div className="bg-[#353534]/40 backdrop-blur-[24px] border border-[#4f453f]/15 p-8 rounded-xl space-y-6 hover:translate-y-[-4px] transition-transform duration-300">
                <div className="w-12 h-12 bg-[#5a4136] rounded flex items-center justify-center">
                  <Network className="w-6 h-6 text-[#e2bfb0]" />
                </div>
                <h3 className="text-xl font-bold text-[#e5e2e1]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  Unified API
                </h3>
                <p className="text-[#e5e2e1]/70 text-sm leading-relaxed tracking-[0.01em]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  OpenAI-compatible regardless of provider. Seamlessly transition between model architectures.
                </p>
              </div>

              {/* Semantic Caching */}
              <div className="bg-[#353534]/40 backdrop-blur-[24px] border border-[#4f453f]/15 p-8 rounded-xl space-y-6 hover:translate-y-[-4px] transition-transform duration-300">
                <div className="w-12 h-12 bg-[#5a4136] rounded flex items-center justify-center">
                  <Database className="w-6 h-6 text-[#e2bfb0]" />
                </div>
                <h3 className="text-xl font-bold text-[#e5e2e1]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  Semantic Caching
                </h3>
                <p className="text-[#e5e2e1]/70 text-sm leading-relaxed tracking-[0.01em]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Ultra-fast responses with pgvector indexing. Reduce costs by over 40% with intelligent hit-rates.
                </p>
              </div>

              {/* Multi-tenancy */}
              <div className="bg-[#353534]/40 backdrop-blur-[24px] border border-[#4f453f]/15 p-8 rounded-xl space-y-6 hover:translate-y-[-4px] transition-transform duration-300">
                <div className="w-12 h-12 bg-[#5a4136] rounded flex items-center justify-center">
                  <Shield className="w-6 h-6 text-[#e2bfb0]" />
                </div>
                <h3 className="text-xl font-bold text-[#e5e2e1]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  Multi-tenancy
                </h3>
                <p className="text-[#e5e2e1]/70 text-sm leading-relaxed tracking-[0.01em]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Rigid data isolation and granular RBAC. Built for organizations with complex compliance needs.
                </p>
              </div>

              {/* Cost Attribution */}
              <div className="bg-[#353534]/40 backdrop-blur-[24px] border border-[#4f453f]/15 p-8 rounded-xl space-y-6 hover:translate-y-[-4px] transition-transform duration-300">
                <div className="w-12 h-12 bg-[#5a4136] rounded flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-[#e2bfb0]" />
                </div>
                <h3 className="text-xl font-bold text-[#e5e2e1]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  Cost Attribution
                </h3>
                <p className="text-[#e5e2e1]/70 text-sm leading-relaxed tracking-[0.01em]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Token tracking with dollar-cost precision. Real-time billing dashboards for every department.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Supported Providers Section */}
        <section className="py-32 overflow-hidden bg-[#0e0e0e]">
          <div className="max-w-7xl mx-auto px-8 mb-20 text-center">
            <p className="text-sm uppercase tracking-[0.2em] text-[#e5e2e1]/60 mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
              Seamlessly Integrating Top Intelligence Providers
            </p>
          </div>
          <div className="max-w-7xl mx-auto px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8">
              {/* OpenAI */}
              <div className="flex flex-col items-center gap-6 p-12 bg-[#353534]/40 backdrop-blur-[24px] border border-[#4f453f]/30 rounded-2xl hover:border-[#ffba38] hover:bg-[#353534]/80 hover:translate-y-[-8px] hover:shadow-[0_20px_40px_-10px_rgba(255,186,56,0.3)] transition-all duration-300 group">
                <div className="w-20 h-20 bg-[#ffba38]/10 rounded-full flex items-center justify-center group-hover:bg-[#ffba38]/20 transition-colors">
                  <Sparkles className="w-10 h-10 text-[#ffba38]" />
                </div>
                <span className="text-[#e5e2e1] font-semibold text-2xl tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  OpenAI
                </span>
              </div>

              {/* Anthropic */}
              <div className="flex flex-col items-center gap-6 p-12 bg-[#353534]/40 backdrop-blur-[24px] border border-[#4f453f]/30 rounded-2xl hover:border-[#e2bfb0] hover:bg-[#353534]/80 hover:translate-y-[-8px] hover:shadow-[0_20px_40px_-10px_rgba(226,191,176,0.3)] transition-all duration-300 group">
                <div className="w-20 h-20 bg-[#e2bfb0]/10 rounded-full flex items-center justify-center group-hover:bg-[#e2bfb0]/20 transition-colors">
                  <Activity className="w-10 h-10 text-[#e2bfb0]" />
                </div>
                <span className="text-[#e5e2e1] font-semibold text-2xl tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  Anthropic
                </span>
              </div>

              {/* Google */}
              <div className="flex flex-col items-center gap-6 p-12 bg-[#353534]/40 backdrop-blur-[24px] border border-[#4f453f]/30 rounded-2xl hover:border-[#ffba38] hover:bg-[#353534]/80 hover:translate-y-[-8px] hover:shadow-[0_20px_40px_-10px_rgba(255,186,56,0.3)] transition-all duration-300 group">
                <div className="w-20 h-20 bg-[#ffba38]/10 rounded-full flex items-center justify-center group-hover:bg-[#ffba38]/20 transition-colors">
                  <CloudCog className="w-10 h-10 text-[#ffba38]" />
                </div>
                <span className="text-[#e5e2e1] font-semibold text-2xl tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  Google
                </span>
              </div>

              {/* Cohere */}
              <div className="flex flex-col items-center gap-6 p-12 bg-[#353534]/40 backdrop-blur-[24px] border border-[#4f453f]/30 rounded-2xl hover:border-[#e2bfb0] hover:bg-[#353534]/80 hover:translate-y-[-8px] hover:shadow-[0_20px_40px_-10px_rgba(226,191,176,0.3)] transition-all duration-300 group">
                <div className="w-20 h-20 bg-[#e2bfb0]/10 rounded-full flex items-center justify-center group-hover:bg-[#e2bfb0]/20 transition-colors">
                  <Network className="w-10 h-10 text-[#e2bfb0]" />
                </div>
                <span className="text-[#e5e2e1] font-semibold text-2xl tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  Cohere
                </span>
              </div>

              {/* Mistral */}
              <div className="flex flex-col items-center gap-6 p-12 bg-[#353534]/40 backdrop-blur-[24px] border border-[#4f453f]/30 rounded-2xl hover:border-[#ffba38] hover:bg-[#353534]/80 hover:translate-y-[-8px] hover:shadow-[0_20px_40px_-10px_rgba(255,186,56,0.3)] transition-all duration-300 group">
                <div className="w-20 h-20 bg-[#ffba38]/10 rounded-full flex items-center justify-center group-hover:bg-[#ffba38]/20 transition-colors">
                  <Zap className="w-10 h-10 text-[#ffba38]" />
                </div>
                <span className="text-[#e5e2e1] font-semibold text-2xl tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  Mistral
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Hybrid Key Management */}
        <section className="py-32 px-8 bg-[#131313]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-4xl font-bold text-[#e5e2e1]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Hybrid Key Management
              </h2>
              <p className="text-[#e5e2e1]/70 max-w-2xl mx-auto text-lg leading-relaxed tracking-[0.01em]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Flexible authentication architecture supporting both managed onboarding and strict enterprise compliance.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              {/* Gateway Keys */}
              <div className="bg-[#353534]/40 backdrop-blur-[24px] border border-[#ffba38]/20 p-10 rounded-2xl relative overflow-hidden group hover:border-[#ffba38]/50 transition-colors">
                <div className="absolute top-0 right-0 w-48 h-48 bg-[#ffba38]/10 blur-[60px] rounded-full group-hover:bg-[#ffba38]/20 transition-all"></div>
                <div className="w-16 h-16 bg-[#ffba38]/10 rounded-xl flex items-center justify-center mb-8 border border-[#ffba38]/20">
                  <Key className="w-8 h-8 text-[#ffba38]" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-[#e5e2e1]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  Gateway Keys
                </h3>
                <p className="text-[#e5e2e1]/70 mb-8 leading-relaxed tracking-[0.01em]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Perfect for startups and rapid prototyping. Use our managed keys for frictionless onboarding without requiring separate provider accounts.
                </p>
                <ul className="space-y-4">
                  {['Zero configuration required', 'Unified billing across providers', 'Instant sandbox access'].map((item, i) => (
                    <li key={i} className="flex items-center gap-4">
                      <CheckCircle className="w-5 h-5 text-[#ffba38]" />
                      <span className="text-[#e5e2e1] font-medium tracking-[0.01em]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* BYOK */}
              <div className="bg-[#353534]/40 backdrop-blur-[24px] border border-[#e2bfb0]/20 p-10 rounded-2xl relative overflow-hidden group hover:border-[#e2bfb0]/50 transition-colors">
                <div className="absolute top-0 right-0 w-48 h-48 bg-[#e2bfb0]/10 blur-[60px] rounded-full group-hover:bg-[#e2bfb0]/20 transition-all"></div>
                <div className="w-16 h-16 bg-[#5a4136] rounded-xl flex items-center justify-center mb-8 border border-[#e2bfb0]/20">
                  <Lock className="w-8 h-8 text-[#e2bfb0]" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-[#e5e2e1]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  Bring Your Own Key (BYOK)
                </h3>
                <p className="text-[#e5e2e1]/70 mb-8 leading-relaxed tracking-[0.01em]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Enterprise-grade compliance. Bring your own provider keys secured with AES-256-GCM encryption for strict data governance and direct relationships.
                </p>
                <ul className="space-y-4">
                  {['Direct provider relationship', 'AES-256-GCM Encryption', 'Strict data isolation'].map((item, i) => (
                    <li key={i} className="flex items-center gap-4">
                      <CheckCircle className="w-5 h-5 text-[#e2bfb0]" />
                      <span className="text-[#e5e2e1] font-medium tracking-[0.01em]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Infrastructure Stack */}
        <section className="py-24 px-8 border-t border-[#4f453f]/10">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-12 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
              {['Turborepo', 'Fastify', 'Redis', 'PostgreSQL'].map((tech, i) => (
                <div key={i} className="flex items-center gap-4">
                  <CloudCog className="w-10 h-10" />
                  <span className="text-2xl font-bold tracking-tight text-[#e5e2e1]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    {tech}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-8 pb-32">
          <div className="max-w-7xl mx-auto">
            <div className="bg-gradient-to-br from-[#5a4136]/40 to-[#131313] p-12 lg:p-24 rounded-3xl shadow-[0_48px_48px_-12px_rgba(0,0,0,0.6)] border border-[#4f453f]/20 relative overflow-hidden text-center space-y-8">
              <div className="absolute top-0 right-0 w-96 h-96 bg-[#ffba38]/10 blur-[120px] rounded-full"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#e2bfb0]/10 blur-[120px] rounded-full"></div>
              <h2 className="text-4xl lg:text-6xl font-bold leading-tight text-[#e5e2e1]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Power your LLM <br />infrastructure today.
              </h2>
              <p className="text-[#e5e2e1]/70 text-lg max-w-2xl mx-auto tracking-[0.01em]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Join the next generation of AI-native companies building on architectural-grade foundations. Scale with confidence.
              </p>
              <div className="flex justify-center gap-4">
                <Link href="/register">
                  <button className="bg-[#ffba38] text-[#281900] px-10 py-5 rounded-lg font-bold text-lg hover:shadow-[0_0_30px_rgba(255,186,56,0.4)] transition-all active:scale-95">
                    Get Started for Free
                  </button>
                </Link>
              </div>
              <p className="text-sm text-[#4f453f] uppercase tracking-widest" style={{ fontFamily: 'Inter, sans-serif' }}>
                No Credit Card Required • Enterprise Ready
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#131313] w-full border-t border-[#4f453f]/10 mt-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 px-8 py-16 max-w-7xl mx-auto text-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>
          <div className="col-span-2 md:col-span-1">
            <div className="text-xl font-bold text-[#e5e2e1] mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Supergate
            </div>
            <p className="text-[#e5e2e1]/50 leading-relaxed mb-6">
              Architectural intelligence for the enterprise.
            </p>
            <div className="flex gap-4">
              <a href="#" className="text-[#e5e2e1]/50 hover:text-[#ffba38]">
                <Globe className="w-5 h-5" />
              </a>
              <a href="#" className="text-[#e5e2e1]/50 hover:text-[#ffba38]">
                <Activity className="w-5 h-5" />
              </a>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <h4 className="text-[#e5e2e1] font-bold mb-2 uppercase tracking-widest text-xs">Product</h4>
            <a href="#" className="text-[#e5e2e1]/50 hover:text-[#ffba38] hover:translate-x-1 transition-transform">API Reference</a>
            <a href="#" className="text-[#e5e2e1]/50 hover:text-[#ffba38] hover:translate-x-1 transition-transform">Status</a>
            <a href="#" className="text-[#e5e2e1]/50 hover:text-[#ffba38] hover:translate-x-1 transition-transform">Pricing</a>
          </div>
          <div className="flex flex-col gap-3">
            <h4 className="text-[#e5e2e1] font-bold mb-2 uppercase tracking-widest text-xs">Resources</h4>
            <a href="#" className="text-[#e5e2e1]/50 hover:text-[#ffba38] hover:translate-x-1 transition-transform">Github</a>
            <a href="#" className="text-[#e5e2e1]/50 hover:text-[#ffba38] hover:translate-x-1 transition-transform">Documentation</a>
            <a href="#" className="text-[#e5e2e1]/50 hover:text-[#ffba38] hover:translate-x-1 transition-transform">Security</a>
          </div>
          <div className="flex flex-col gap-3">
            <h4 className="text-[#e5e2e1] font-bold mb-2 uppercase tracking-widest text-xs">Legal</h4>
            <a href="#" className="text-[#e5e2e1]/50 hover:text-[#ffba38] hover:translate-x-1 transition-transform">Privacy Policy</a>
            <a href="#" className="text-[#e5e2e1]/50 hover:text-[#ffba38] hover:translate-x-1 transition-transform">Terms of Service</a>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-8 py-8 border-t border-[#4f453f]/5 text-center text-[#e5e2e1]/30">
          © 2024 Supergate Intelligence. All rights reserved.
        </div>
      </footer>

      <style jsx>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-scroll {
          animation: scroll 30s linear infinite;
        }
      `}</style>
    </div>
  )
}
