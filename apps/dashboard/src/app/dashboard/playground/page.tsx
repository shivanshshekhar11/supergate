'use client'

import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/contexts/auth-context'
import { playgroundAPI, type PlaygroundModel, type PlaygroundMeta } from '@/lib/gateway-client'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Play, ChevronDown, Copy, Check, AlertCircle,
  Zap, DollarSign, Cpu, Info, RotateCcw,
} from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

// ── Presets ──────────────────────────────────────────────────────────────────

const PRESETS = [
  { label: 'None',            systemPrompt: '' },
  { label: 'Code Reviewer',   systemPrompt: 'You are a highly skilled principal software engineer. Review the following code for security vulnerabilities, performance bottlenecks, and architectural flaws. Be concise and direct.' },
  { label: 'Explain Simply',  systemPrompt: 'You are an expert at explaining complex topics simply. Use analogies and plain language. Avoid jargon.' },
  { label: 'Socratic Tutor',  systemPrompt: 'You are a Socratic tutor. Never give direct answers. Guide the user to discover the answer through questions.' },
  { label: 'JSON Extractor',  systemPrompt: 'Extract structured data from the user\'s input and return only valid JSON. No prose, no markdown fences.' },
]

// ── Simple markdown renderer ─────────────────────────────────────────────────

function renderMarkdown(text: string): string {
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-[#0e0e0e] rounded-md p-3 my-2 overflow-x-auto text-xs font-mono text-[#e5e2e1]/80 whitespace-pre">$2</pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-[#0e0e0e] px-1.5 py-0.5 rounded text-xs font-mono text-[#ffba38]">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-[#e5e2e1] font-semibold">$1</strong>')
    .replace(/^#{1,3} (.+)$/gm, '<p class="font-semibold text-[#e5e2e1] mt-3 mb-1">$1</p>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-[#e5e2e1]/80">$1</li>')
    .replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc text-[#e5e2e1]/80">$1</li>')
    .replace(/\n\n/g, '</p><p class="mb-2">')
    .replace(/\n/g, '<br/>')
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PlaygroundPage() {
  const { user, token } = useAuth()
  const tier = user?.tenants?.[0]?.tier ?? 'free'

  // Models
  const [models,        setModels]        = useState<PlaygroundModel[]>([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [modelsError,   setModelsError]   = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [showModelMenu, setShowModelMenu] = useState(false)
  const modelMenuRef = useRef<HTMLDivElement>(null)

  // Preset
  const [selectedPreset,  setSelectedPreset]  = useState(0)
  const [showPresetMenu,  setShowPresetMenu]   = useState(false)
  const presetMenuRef = useRef<HTMLDivElement>(null)

  // Prompts
  const [systemPrompt, setSystemPrompt] = useState('')
  const [userInput,    setUserInput]    = useState('')

  // Auto-resize refs
  const userInputRef   = useRef<HTMLTextAreaElement>(null)
  const systemPromptRef = useRef<HTMLTextAreaElement>(null)

  // Parameters
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens,   setMaxTokens]   = useState(2048)

  // Response
  const [running,      setRunning]      = useState(false)
  const [result,       setResult]       = useState<string | null>(null)
  const [rawJson,      setRawJson]      = useState<string | null>(null)
  const [meta,         setMeta]         = useState<PlaygroundMeta | null>(null)
  const [runError,     setRunError]     = useState<string | null>(null)
  const [responseTab,  setResponseTab]  = useState<'formatted' | 'raw'>('formatted')
  const [copied,       setCopied]       = useState(false)

  // Auto-resize textarea helper
  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 320) + 'px'
  }

  // Load models on mount
  useEffect(() => {
    if (!token) return
    setModelsLoading(true)
    playgroundAPI.getModels(token)
      .then(data => {
        setModels(data.models)
        if (data.models.length > 0) setSelectedModel(data.models[0].id)
      })
      .catch(err => setModelsError(err.message ?? 'Failed to load models'))
      .finally(() => setModelsLoading(false))
  }, [token])

  // Close dropdowns on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) setShowModelMenu(false)
      if (presetMenuRef.current && !presetMenuRef.current.contains(e.target as Node)) setShowPresetMenu(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  // Apply preset
  const applyPreset = (idx: number) => {
    setSelectedPreset(idx)
    setSystemPrompt(PRESETS[idx].systemPrompt)
    setShowPresetMenu(false)
    setTimeout(() => autoResize(systemPromptRef.current), 0)
  }

  const handleRun = useCallback(async () => {
    if (!token || !selectedModel || !userInput.trim()) return
    setRunning(true)
    setResult(null)
    setRawJson(null)
    setMeta(null)
    setRunError(null)

    try {
      const data = await playgroundAPI.chat(token, {
        model:        selectedModel,
        messages:     [{ role: 'user', content: userInput.trim() }],
        systemPrompt: systemPrompt.trim() || undefined,
        temperature,
        max_tokens:   maxTokens,
      })

      const content = data.response.choices[0]?.message?.content ?? ''
      setResult(content)
      setRawJson(JSON.stringify(data.response, null, 2))
      setMeta(data.meta)
    } catch (err: any) {
      setRunError(err.message ?? 'Request failed')
    } finally {
      setRunning(false)
    }
  }, [token, selectedModel, userInput, systemPrompt, temperature, maxTokens])

  const handleCopy = () => {
    const text = responseTab === 'formatted' ? (result ?? '') : (rawJson ?? '')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReset = () => {
    setUserInput('')
    setSystemPrompt(PRESETS[0].systemPrompt)
    setSelectedPreset(0)
    setResult(null)
    setRawJson(null)
    setMeta(null)
    setRunError(null)
    setTemperature(0.7)
    setMaxTokens(2048)
    setTimeout(() => {
      autoResize(userInputRef.current)
      autoResize(systemPromptRef.current)
    }, 0)
  }

  const selectedModelObj = models.find(m => m.id === selectedModel)
  const systemTokenEst   = Math.round(systemPrompt.length / 4)
  const userTokenEst     = Math.round(userInput.length / 4)

  // ── Tier banner ─────────────────────────────────────────────────────────────
  const tierBanner = tier === 'enterprise-independent'
    ? { text: 'Enterprise Independent — only BYOK-configured providers are available', color: 'text-[#ffba38]' }
    : tier === 'enterprise'
    ? { text: 'Enterprise — gateway keys active, BYOK takes precedence per provider', color: 'text-[#e2bfb0]' }
    : null

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold text-[#e5e2e1] tracking-[-0.02em] leading-none mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Playground
          </h1>
          <p className="text-[#e5e2e1]/60 text-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Test models interactively through the gateway.
          </p>
        </div>
        <button onClick={handleReset} className="flex items-center gap-1.5 text-xs text-[#e5e2e1]/50 hover:text-[#e5e2e1] transition-colors self-start sm:self-auto" style={{ fontFamily: 'Manrope, sans-serif' }}>
          <RotateCcw className="w-3.5 h-3.5" />Reset
        </button>
      </div>

      {/* Tier banner */}
      {tierBanner && (
        <div className="mb-4 flex items-center gap-2 bg-[#1c1b1b] border border-[#4f453f]/20 px-4 py-2.5 rounded-md">
          <Info className="w-3.5 h-3.5 text-[#e5e2e1]/40 shrink-0" />
          <span className={`text-xs ${tierBanner.color}`} style={{ fontFamily: 'Manrope, sans-serif' }}>{tierBanner.text}</span>
        </div>
      )}

      {modelsLoading ? (
        <div className="flex items-center justify-center h-48"><LoadingSpinner size="lg" /></div>
      ) : modelsError ? (
        <div className="flex items-center gap-3 bg-[#93000a]/20 border border-[#ffb4ab]/20 text-[#ffb4ab] px-4 py-3 rounded-md text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />{modelsError}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* ── Left panel ─────────────────────────────────────────────────── */}
          <div className="lg:col-span-3 flex flex-col gap-4">

            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Model selector */}
              <div className="relative" ref={modelMenuRef}>
                <button
                  onClick={() => setShowModelMenu(v => !v)}
                  className="flex items-center gap-2 bg-[#1c1b1b] hover:bg-[#353534] border border-[#4f453f]/20 text-[#e5e2e1] px-3 py-2 rounded-md text-sm transition-colors min-w-[180px]"
                  style={{ fontFamily: 'Manrope, sans-serif' }}
                >
                  <span className="flex-1 text-left truncate">
                    {selectedModelObj
                      ? `${selectedModelObj.provider.charAt(0).toUpperCase() + selectedModelObj.provider.slice(1)} / ${selectedModelObj.label}`
                      : 'Select model'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-[#e5e2e1]/50 shrink-0 transition-transform ${showModelMenu ? 'rotate-180' : ''}`} />
                </button>
                {showModelMenu && (
                  <div className="absolute top-full mt-1 left-0 w-64 bg-[#131313] border border-[#4f453f]/20 rounded-md shadow-2xl z-50 overflow-hidden">
                    {['openai', 'anthropic', 'google', 'cohere', 'mistral'].map(prov => {
                      const provModels = models.filter(m => m.provider === prov)
                      if (provModels.length === 0) return null
                      return (
                        <div key={prov}>
                          <div className="px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] text-[#e5e2e1]/30 border-b border-[#4f453f]/10" style={{ fontFamily: 'Inter, sans-serif' }}>
                            {prov}
                            {provModels[0].keySource === 'byok' && <span className="ml-2 text-[#ffba38]">BYOK</span>}
                          </div>
                          {provModels.map(m => (
                            <button key={m.id} onClick={() => { setSelectedModel(m.id); setShowModelMenu(false) }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-[#1c1b1b] transition-colors flex items-center justify-between ${selectedModel === m.id ? 'text-[#ffba38]' : 'text-[#e5e2e1]/80'}`}
                              style={{ fontFamily: 'Manrope, sans-serif' }}>
                              {m.label}
                              {m.keySource === 'byok' && <span className="text-[10px] text-[#ffba38]/60 uppercase tracking-wider">BYOK</span>}
                            </button>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Preset selector */}
              <div className="relative" ref={presetMenuRef}>
                <button
                  onClick={() => setShowPresetMenu(v => !v)}
                  className="flex items-center gap-2 bg-[#1c1b1b] hover:bg-[#353534] border border-[#4f453f]/20 text-[#e5e2e1] px-3 py-2 rounded-md text-sm transition-colors"
                  style={{ fontFamily: 'Manrope, sans-serif' }}
                >
                  <span>Preset: {PRESETS[selectedPreset].label}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-[#e5e2e1]/50 transition-transform ${showPresetMenu ? 'rotate-180' : ''}`} />
                </button>
                {showPresetMenu && (
                  <div className="absolute top-full mt-1 left-0 w-48 bg-[#131313] border border-[#4f453f]/20 rounded-md shadow-2xl z-50">
                    {PRESETS.map((p, i) => (
                      <button key={i} onClick={() => applyPreset(i)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-[#1c1b1b] transition-colors ${selectedPreset === i ? 'text-[#ffba38]' : 'text-[#e5e2e1]/80'}`}
                        style={{ fontFamily: 'Manrope, sans-serif' }}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* System prompt */}
            <div className="bg-[#1c1b1b] rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-[#4f453f]/15">
                <span className="text-[10px] uppercase tracking-[0.15em] text-[#e5e2e1]/50 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>System Prompt</span>
                <span className="text-[10px] text-[#e5e2e1]/30 font-mono">~{systemTokenEst} tokens</span>
              </div>
              <textarea
                ref={systemPromptRef}
                value={systemPrompt}
                onChange={e => { setSystemPrompt(e.target.value); autoResize(e.target) }}
                placeholder="You are a helpful assistant..."
                rows={3}
                className="w-full bg-transparent text-[#e5e2e1]/80 text-sm px-4 py-3 resize-none focus:outline-none placeholder-[#e5e2e1]/20 transition-all"
                style={{ fontFamily: 'Manrope, sans-serif', minHeight: '72px', maxHeight: '320px', overflow: 'hidden' }}
              />
            </div>

            {/* User message — auto-expanding textarea */}
            <div className="bg-[#1c1b1b] rounded-lg overflow-hidden border border-[#4f453f]/15 focus-within:border-[#ffba38]/30 transition-colors">
              <div className="flex items-center justify-between px-4 py-2 border-b border-[#4f453f]/15">
                <span className="text-[10px] uppercase tracking-[0.15em] text-[#e5e2e1]/50 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>User Message</span>
                <span className="text-[10px] text-[#e5e2e1]/30 font-mono">~{userTokenEst} tokens</span>
              </div>
              <textarea
                ref={userInputRef}
                id="user-message"
                value={userInput}
                onChange={e => { setUserInput(e.target.value); autoResize(e.target) }}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleRun() }}
                placeholder="Type your message here... (Ctrl+Enter to run)"
                rows={4}
                className="w-full bg-transparent text-[#e5e2e1] text-sm px-4 py-3 resize-none focus:outline-none placeholder-[#e5e2e1]/20 transition-all"
                style={{ fontFamily: 'Manrope, sans-serif', minHeight: '96px', maxHeight: '320px', overflow: 'hidden' }}
              />
              {/* Run bar */}
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#4f453f]/15 bg-[#131313]/40">
                <p className="text-[10px] text-[#e5e2e1]/30" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {userInput.trim() ? 'Ctrl+Enter to run' : 'Enter a message to run'}
                </p>
                <button
                  onClick={handleRun}
                  disabled={running || !selectedModel || !userInput.trim()}
                  className="flex items-center gap-2 bg-gradient-to-br from-[#ffba38] to-[#c78b00] text-[#281900] px-4 py-1.5 rounded-md text-sm font-semibold hover:shadow-[0_0_20px_rgba(255,186,56,0.3)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ fontFamily: 'Manrope, sans-serif' }}
                >
                  {running
                    ? <><LoadingSpinner size="sm" /> Running</>
                    : <><Play className="w-3.5 h-3.5" /> Run</>}
                </button>
              </div>
            </div>
          </div>

          {/* ── Right panel ─────────────────────────────────────────────────── */}
          <div className="lg:col-span-2 flex flex-col gap-4">

            {/* Latency + Cost */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#1c1b1b] rounded-lg p-4">
                <div className="text-[10px] uppercase tracking-[0.15em] text-[#e5e2e1]/40 mb-2 flex items-center gap-1.5" style={{ fontFamily: 'Inter, sans-serif' }}>
                  <Zap className="w-3 h-3" />Latency
                </div>
                <div className="text-3xl font-bold text-[#e5e2e1] tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  {meta ? `${(meta.latencyMs / 1000).toFixed(2)}` : '—'}
                </div>
                {meta && <div className="text-xs text-[#e5e2e1]/40 mt-0.5">seconds</div>}
              </div>
              <div className="bg-[#353534] rounded-lg p-4">
                <div className="text-[10px] uppercase tracking-[0.15em] text-[#e5e2e1]/40 mb-2 flex items-center gap-1.5" style={{ fontFamily: 'Inter, sans-serif' }}>
                  <DollarSign className="w-3 h-3" />Cost Est.
                </div>
                <div className="text-3xl font-bold text-[#ffba38] tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  {meta ? `$${meta.costUsd.toFixed(4)}` : '—'}
                </div>
                {meta && <div className="text-xs text-[#e5e2e1]/40 mt-0.5">USD</div>}
              </div>
            </div>

            {/* Model Parameters */}
            <div className="bg-[#1c1b1b] rounded-lg p-4">
              <h3 className="text-sm font-semibold text-[#e5e2e1] mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Model Parameters
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-xs text-[#e5e2e1]/60" style={{ fontFamily: 'Manrope, sans-serif' }}>Temperature</span>
                    <span className="text-xs font-mono text-[#e5e2e1]/80">{temperature.toFixed(1)}</span>
                  </div>
                  <input type="range" min="0" max="2" step="0.1" value={temperature}
                    onChange={e => setTemperature(parseFloat(e.target.value))}
                    className="w-full h-1 bg-[#353534] rounded-full appearance-none cursor-pointer accent-[#ffba38]" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-xs text-[#e5e2e1]/60" style={{ fontFamily: 'Manrope, sans-serif' }}>Max Tokens</span>
                    <span className="text-xs font-mono text-[#e5e2e1]/80">{maxTokens}</span>
                  </div>
                  <input type="range" min="256" max="8192" step="256" value={maxTokens}
                    onChange={e => setMaxTokens(parseInt(e.target.value))}
                    className="w-full h-1 bg-[#353534] rounded-full appearance-none cursor-pointer accent-[#ffba38]" />
                </div>
              </div>
            </div>

            {/* Response panel */}
            <div className="bg-[#1c1b1b] rounded-lg flex flex-col flex-1 min-h-[280px] overflow-hidden">
              {/* Tabs + copy */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-[#4f453f]/15">
                <div className="flex gap-1">
                  {(['formatted', 'raw'] as const).map(tab => (
                    <button key={tab} onClick={() => setResponseTab(tab)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${responseTab === tab ? 'bg-[#353534] text-[#ffba38]' : 'text-[#e5e2e1]/50 hover:text-[#e5e2e1]'}`}
                      style={{ fontFamily: 'Manrope, sans-serif' }}>
                      {tab === 'formatted' ? 'Formatted' : 'Raw JSON'}
                    </button>
                  ))}
                </div>
                {(result || rawJson) && (
                  <button onClick={handleCopy} className="text-[#e5e2e1]/40 hover:text-[#e5e2e1] transition-colors">
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 text-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {running && (
                  <div className="flex items-center gap-3 text-[#e5e2e1]/50">
                    <LoadingSpinner size="sm" />
                    <span className="text-xs">Waiting for response...</span>
                  </div>
                )}

                {runError && !running && (
                  <div className="flex items-start gap-2 text-[#ffb4ab] text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{runError}</span>
                  </div>
                )}

                {!running && !runError && responseTab === 'formatted' && result && (
                  <div
                    className="text-[#e5e2e1]/80 leading-relaxed text-sm"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(result) }}
                  />
                )}

                {!running && !runError && responseTab === 'raw' && rawJson && (
                  <pre className="text-[#e5e2e1]/70 text-xs font-mono whitespace-pre-wrap break-all">{rawJson}</pre>
                )}

                {!running && !runError && !result && (
                  <p className="text-[#e5e2e1]/20 text-xs">Response will appear here.</p>
                )}
              </div>

              {/* Footer metadata */}
              {meta && (
                <div className="border-t border-[#4f453f]/15 px-4 py-2 flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-1.5 text-[10px] text-[#e5e2e1]/40" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    <Zap className="w-3 h-3 text-[#ffba38]" />
                    {meta.cached ? 'Cache Hit' : 'Cache Miss'}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-[#e5e2e1]/40 font-mono">
                    <Cpu className="w-3 h-3" />
                    Prompt: {meta.inputTokens}t
                  </div>
                  <div className="text-[10px] text-[#e5e2e1]/40 font-mono">
                    Completion: {meta.outputTokens}t
                  </div>
                  <div className="text-[10px] text-[#e5e2e1]/40 font-mono ml-auto">
                    {meta.model}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
