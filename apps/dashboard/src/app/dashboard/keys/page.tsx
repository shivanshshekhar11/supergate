'use client'

import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/contexts/auth-context'
import { tenantKeysAPI, GatewayAPIError, type TenantKeyMetadata } from '@/lib/gateway-client'
import { useState, useEffect, useCallback } from 'react'
import {
  Key, Plus, RotateCcw, Trash2, Eye, EyeOff,
  AlertCircle, CheckCircle, ShieldOff, Loader2, Lock,
} from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

// All 5 supported providers
const PROVIDERS = [
  { id: 'openai',    name: 'OpenAI',    hint: 'sk-proj-...' },
  { id: 'anthropic', name: 'Anthropic', hint: 'sk-ant-...' },
  { id: 'google',    name: 'Google',    hint: 'AIza...' },
  { id: 'cohere',    name: 'Cohere',    hint: 'co-...' },
  { id: 'mistral',   name: 'Mistral',   hint: 'mist-...' },
]

type ModalMode = 'add' | 'rotate'

interface Modal {
  mode: ModalMode
  provider: string
  providerName: string
}

export default function KeysPage() {
  const { user, token } = useAuth()
  const role = user?.tenants?.[0]?.role ?? 'guest'
  const isAdmin  = role === 'admin'
  const isMember = role === 'member'

  const [keys,      setKeys]      = useState<TenantKeyMetadata[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  // Modal state
  const [modal,       setModal]       = useState<Modal | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showInput,   setShowInput]   = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [modalError,  setModalError]  = useState<string | null>(null)

  // Delete confirmation
  const [deleteTarget,    setDeleteTarget]    = useState<string | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const loadKeys = useCallback(async () => {
    if (!token) return
    try {
      setIsLoading(true)
      setError(null)
      const data = await tenantKeysAPI.list(token)
      setKeys(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load keys')
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => { loadKeys() }, [loadKeys])

  // Guest — hard block
  if (role === 'guest') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center max-w-sm">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#93000a]/20 mb-4">
              <ShieldOff className="w-8 h-8 text-[#ffb4ab]" />
            </div>
            <h2 className="text-2xl font-bold text-[#e5e2e1] mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Access Denied
            </h2>
            <p className="text-[#e5e2e1]/60" style={{ fontFamily: 'Manrope, sans-serif' }}>
              You need at least member access to view this page.
            </p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const openAdd = (providerId: string, providerName: string) => {
    setModal({ mode: 'add', provider: providerId, providerName })
    setApiKeyInput('')
    setShowInput(false)
    setModalError(null)
  }

  const openRotate = (providerId: string, providerName: string) => {
    setModal({ mode: 'rotate', provider: providerId, providerName })
    setApiKeyInput('')
    setShowInput(false)
    setModalError(null)
  }

  const closeModal = () => {
    setModal(null)
    setApiKeyInput('')
    setModalError(null)
  }

  const handleSubmit = async () => {
    if (!token || !modal) return
    if (apiKeyInput.trim().length < 20) {
      setModalError('API key must be at least 20 characters.')
      return
    }
    try {
      setSubmitting(true)
      setModalError(null)
      if (modal.mode === 'add') {
        await tenantKeysAPI.create(token, modal.provider, apiKeyInput.trim())
        showToast(`${modal.providerName} key added successfully.`, 'success')
      } else {
        await tenantKeysAPI.update(token, modal.provider, apiKeyInput.trim())
        showToast(`${modal.providerName} key rotated successfully.`, 'success')
      }
      closeModal()
      await loadKeys()
    } catch (err) {
      const msg = err instanceof GatewayAPIError ? err.message : 'Operation failed. Please try again.'
      setModalError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!token || !deleteTarget) return
    try {
      setDeleteSubmitting(true)
      await tenantKeysAPI.remove(token, deleteTarget)
      showToast(`${deleteTarget} key removed.`, 'success')
      setDeleteTarget(null)
      await loadKeys()
    } catch (err) {
      const msg = err instanceof GatewayAPIError ? err.message : 'Failed to delete key.'
      showToast(msg, 'error')
      setDeleteTarget(null)
    } finally {
      setDeleteSubmitting(false)
    }
  }

  // Build a map of provider → key for quick lookup
  const keyMap = new Map(keys.map(k => [k.provider, k]))

  return (
    <DashboardLayout>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-md shadow-xl border text-sm font-medium transition-all ${
          toast.type === 'success'
            ? 'bg-[#1c1b1b] border-[#ffba38]/30 text-[#e5e2e1]'
            : 'bg-[#93000a]/20 border-[#ffb4ab]/30 text-[#ffb4ab]'
        }`} style={{ fontFamily: 'Manrope, sans-serif' }}>
          {toast.type === 'success'
            ? <CheckCircle className="w-4 h-4 text-[#ffba38]" />
            : <AlertCircle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold text-[#e5e2e1] tracking-[-0.02em] leading-none mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          LLM Provider Keys
        </h1>
        <p className="text-[#e5e2e1]/70 text-base sm:text-lg tracking-[0.01em]" style={{ fontFamily: 'Manrope, sans-serif' }}>
          {isAdmin
            ? 'Manage BYOK keys for each LLM provider. Keys are encrypted at rest with AES-256-GCM.'
            : 'View configured LLM provider keys for your tenant.'}
        </p>
      </div>

      {/* Role badge */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex items-center gap-2 bg-[#1c1b1b] border border-[#4f453f]/20 px-3 py-1.5 rounded-md">
          <Lock className="w-3.5 h-3.5 text-[#e5e2e1]/40" />
          <span className="text-xs text-[#e5e2e1]/60 uppercase tracking-[0.15em]" style={{ fontFamily: 'Inter, sans-serif' }}>
            {isAdmin ? 'Admin — full access' : 'Member — read only'}
          </span>
        </div>
        {!isAdmin && (
          <span className="text-xs text-[#e5e2e1]/40" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Contact an admin to add or rotate keys.
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-center gap-3 bg-[#93000a]/20 border border-[#ffb4ab]/20 text-[#ffb4ab] px-4 py-3 rounded-md text-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {PROVIDERS.map(provider => {
            const existing = keyMap.get(provider.id)
            const hasKey   = !!existing

            return (
              <div
                key={provider.id}
                className="bg-[#1c1b1b] rounded-lg p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 group"
              >
                {/* Left — provider info */}
                <div className="flex items-center gap-4 sm:gap-5 min-w-0">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${hasKey ? 'bg-emerald-400' : 'bg-[#4f453f]'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span className="text-base sm:text-lg font-semibold text-[#e5e2e1]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                        {provider.name}
                      </span>
                      {hasKey ? (
                        <span className="text-[10px] uppercase tracking-[0.15em] bg-[#5a4136]/40 text-[#e2bfb0] px-2 py-0.5 rounded-sm font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Configured</span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-[0.15em] bg-[#353534] text-[#e5e2e1]/40 px-2 py-0.5 rounded-sm font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Not set</span>
                      )}
                    </div>
                    {hasKey ? (
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        <span className="font-mono text-[#e5e2e1]/60 text-xs">{existing.apiKeyMasked}</span>
                        {existing.lastUsed && (
                          <span className="text-[#e5e2e1]/40 text-xs">Last used {new Date(existing.lastUsed).toLocaleDateString()}</span>
                        )}
                        <span className="text-[#e5e2e1]/30 text-xs">Added {new Date(existing.createdAt).toLocaleDateString()}</span>
                      </div>
                    ) : (
                      <p className="text-sm text-[#e5e2e1]/40" style={{ fontFamily: 'Manrope, sans-serif' }}>Gateway key will be used as fallback.</p>
                    )}
                  </div>
                </div>

                {/* Right — actions (admin only) */}
                {isAdmin && (
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    {hasKey ? (
                      <>
                        <button onClick={() => openRotate(provider.id, provider.name)}
                          className="flex items-center gap-1.5 bg-[#353534] hover:bg-[#393939] text-[#e5e2e1]/70 hover:text-[#e5e2e1] px-3 py-2 rounded-md text-sm font-medium transition-colors"
                          style={{ fontFamily: 'Manrope, sans-serif' }}>
                          <RotateCcw className="w-3.5 h-3.5" />Rotate
                        </button>
                        <button onClick={() => setDeleteTarget(provider.id)}
                          className="flex items-center gap-1.5 bg-[#93000a]/20 hover:bg-[#93000a]/40 text-[#ffb4ab] px-3 py-2 rounded-md text-sm font-medium transition-colors"
                          style={{ fontFamily: 'Manrope, sans-serif' }}>
                          <Trash2 className="w-3.5 h-3.5" />Remove
                        </button>
                      </>
                    ) : (
                      <button onClick={() => openAdd(provider.id, provider.name)}
                        className="flex items-center gap-1.5 bg-gradient-to-br from-[#ffba38] to-[#c78b00] text-[#281900] px-4 py-2 rounded-md text-sm font-semibold hover:shadow-[0_0_20px_rgba(255,186,56,0.3)] transition-all"
                        style={{ fontFamily: 'Manrope, sans-serif' }}>
                        <Plus className="w-3.5 h-3.5" />Add Key
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Info footer */}
      <div className="mt-8 flex items-start gap-3 bg-[#0e0e0e] rounded-lg p-4">
        <Key className="w-4 h-4 text-[#e5e2e1]/30 mt-0.5 shrink-0" />
        <p className="text-xs text-[#e5e2e1]/40 leading-relaxed" style={{ fontFamily: 'Manrope, sans-serif' }}>
          BYOK keys are encrypted with AES-256-GCM before storage and never returned in plaintext.
          When a BYOK key is configured, it takes precedence over the gateway&apos;s shared key for that provider.
          Enterprise-independent tenants must configure their own keys — no gateway fallback is available.
        </p>
      </div>

      {/* Add / Rotate Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1c1b1b] border border-[#4f453f]/20 rounded-lg p-6 w-full max-w-md shadow-2xl mx-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-md bg-[#ffba38]/10 flex items-center justify-center">
                {modal.mode === 'add' ? <Plus className="w-5 h-5 text-[#ffba38]" /> : <RotateCcw className="w-5 h-5 text-[#ffba38]" />}
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#e5e2e1]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  {modal.mode === 'add' ? `Add ${modal.providerName} Key` : `Rotate ${modal.providerName} Key`}
                </h3>
                <p className="text-xs text-[#e5e2e1]/50" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {modal.mode === 'add'
                    ? 'The key will be encrypted before storage.'
                    : 'The existing key will be deactivated immediately.'}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-[#e5e2e1]/60 text-xs uppercase tracking-[0.15em] font-medium mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                API Key
              </label>
              <div className="relative">
                <input
                  type={showInput ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  placeholder={PROVIDERS.find(p => p.id === modal.provider)?.hint ?? 'Paste your API key'}
                  className="w-full bg-[#0e0e0e] text-[#e5e2e1] px-4 py-3 pr-10 rounded-md border-b-2 border-transparent focus:border-[#ffba38] focus:outline-none transition-colors font-mono text-sm"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
                <button
                  type="button"
                  onClick={() => setShowInput(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#e5e2e1]/40 hover:text-[#e5e2e1]/70 transition-colors"
                >
                  {showInput ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {modalError && (
              <div className="mb-4 flex items-center gap-2 text-[#ffb4ab] text-sm bg-[#93000a]/20 border border-[#ffb4ab]/20 px-3 py-2 rounded-md" style={{ fontFamily: 'Manrope, sans-serif' }}>
                <AlertCircle className="w-4 h-4 shrink-0" />
                {modalError}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={closeModal}
                disabled={submitting}
                className="px-4 py-2 text-sm text-[#e5e2e1]/60 hover:text-[#e5e2e1] bg-[#353534] hover:bg-[#393939] rounded-md transition-colors font-medium disabled:opacity-50"
                style={{ fontFamily: 'Manrope, sans-serif' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || apiKeyInput.trim().length < 20}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-gradient-to-br from-[#ffba38] to-[#c78b00] text-[#281900] rounded-md hover:shadow-[0_0_20px_rgba(255,186,56,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontFamily: 'Manrope, sans-serif' }}
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {modal.mode === 'add' ? 'Save Key' : 'Rotate Key'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1c1b1b] border border-[#ffb4ab]/20 rounded-lg p-6 w-full max-w-sm shadow-2xl mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-md bg-[#93000a]/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-[#ffb4ab]" />
              </div>
              <h3 className="text-lg font-bold text-[#e5e2e1]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Remove Key
              </h3>
            </div>
            <p className="text-sm text-[#e5e2e1]/70 mb-6" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Remove the <span className="text-[#e5e2e1] font-medium capitalize">{deleteTarget}</span> BYOK key?
              Requests will fall back to the gateway key (if your tier allows it).
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleteSubmitting}
                className="px-4 py-2 text-sm text-[#e5e2e1]/60 hover:text-[#e5e2e1] bg-[#353534] hover:bg-[#393939] rounded-md transition-colors font-medium disabled:opacity-50"
                style={{ fontFamily: 'Manrope, sans-serif' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteSubmitting}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-[#93000a] text-[#ffb4ab] rounded-md hover:bg-[#93000a]/80 transition-colors disabled:opacity-50"
                style={{ fontFamily: 'Manrope, sans-serif' }}
              >
                {deleteSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
