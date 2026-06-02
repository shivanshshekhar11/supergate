'use client'

import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/contexts/auth-context'
import { gatewayKeysAPI, GatewayAPIError, type KeyMetadata } from '@/lib/gateway-client'
import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Trash2, Eye, EyeOff, Copy, Check,
  AlertCircle, CheckCircle, ShieldOff, Loader2,
  KeyRound, Clock, Shield,
} from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

// ── Role badge colours ────────────────────────────────────────────────────────
const ROLE_STYLES: Record<string, string> = {
  admin:  'bg-[#ffba38]/15 text-[#ffba38]',
  user:   'bg-[#5a4136]/40 text-[#e2bfb0]',
  viewer: 'bg-[#353534] text-[#e5e2e1]/50',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtRelative(iso: string | null) {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)   return 'Just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Create modal ──────────────────────────────────────────────────────────────
interface CreateModalProps {
  onClose: () => void
  onCreated: (key: KeyMetadata & { key: string }) => void
  token: string
}

function CreateModal({ onClose, onCreated, token }: CreateModalProps) {
  const [name, setName]       = useState('')
  const [role, setRole]       = useState<'admin' | 'user' | 'viewer'>('user')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name is required.'); return }
    try {
      setSaving(true)
      setError(null)
      const res = await gatewayKeysAPI.create(token, { name: name.trim(), role })
      onCreated(res as KeyMetadata & { key: string })
    } catch (err) {
      setError(err instanceof GatewayAPIError ? err.message : 'Failed to create key.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full bg-[#0e0e0e] text-[#e5e2e1] px-4 py-3 rounded-md border-b-2 border-transparent focus:border-[#ffba38] focus:outline-none transition-colors text-sm'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-[#1c1b1b] border border-[#4f453f]/20 rounded-lg p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-md bg-[#ffba38]/10 flex items-center justify-center shrink-0">
            <Plus className="w-5 h-5 text-[#ffba38]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#e5e2e1]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Create API Key
            </h3>
            <p className="text-xs text-[#e5e2e1]/50" style={{ fontFamily: 'Manrope, sans-serif' }}>
              The raw key is shown exactly once — save it immediately.
            </p>
          </div>
        </div>

        <div className="space-y-4 mb-5">
          <div>
            <label className="block text-[#e5e2e1]/60 text-xs uppercase tracking-[0.15em] font-medium mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
              Key Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(null) }}
              placeholder="e.g. prod-service, ci-pipeline"
              className={inputCls}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          <div>
            <label className="block text-[#e5e2e1]/60 text-xs uppercase tracking-[0.15em] font-medium mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
              Role
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['admin', 'user', 'viewer'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`py-2.5 rounded-md text-sm font-medium capitalize transition-all border ${
                    role === r
                      ? 'border-[#ffba38] bg-[#ffba38]/10 text-[#ffba38]'
                      : 'border-[#4f453f]/20 bg-[#0e0e0e] text-[#e5e2e1]/50 hover:text-[#e5e2e1] hover:border-[#4f453f]/40'
                  }`}
                  style={{ fontFamily: 'Manrope, sans-serif' }}
                >
                  {r}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-[#e5e2e1]/30" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {role === 'admin'  && 'Full access — create/revoke keys, manage BYOK, read usage.'}
              {role === 'user'   && 'Chat completions only.'}
              {role === 'viewer' && 'Read-only usage data.'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 text-[#ffb4ab] text-sm bg-[#93000a]/20 border border-[#ffb4ab]/20 px-3 py-2 rounded-md">
            <AlertCircle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 text-sm text-[#e5e2e1]/60 hover:text-[#e5e2e1] bg-[#353534] hover:bg-[#393939] rounded-md transition-colors font-medium disabled:opacity-50"
            style={{ fontFamily: 'Manrope, sans-serif' }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving || !name.trim()}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-gradient-to-br from-[#ffba38] to-[#c78b00] text-[#281900] rounded-md hover:shadow-[0_0_20px_rgba(255,186,56,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontFamily: 'Manrope, sans-serif' }}>
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Create Key
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Reveal modal (shown once after creation) ──────────────────────────────────
interface RevealModalProps {
  rawKey: string
  name: string | null
  onClose: () => void
}

function RevealModal({ rawKey, name, onClose }: RevealModalProps) {
  const [copied, setCopied] = useState(false)
  const [visible, setVisible] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(rawKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-[#1c1b1b] border border-[#ffba38]/30 rounded-lg p-6 w-full max-w-lg shadow-2xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-md bg-[#ffba38]/10 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5 text-[#ffba38]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#e5e2e1]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Key Created
            </h3>
            <p className="text-xs text-[#e5e2e1]/50" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {name ?? 'Unnamed key'}
            </p>
          </div>
        </div>

        <div className="my-5 bg-[#93000a]/10 border border-[#ffb4ab]/20 rounded-md px-4 py-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-[#ffb4ab] shrink-0 mt-0.5" />
          <p className="text-xs text-[#ffb4ab]" style={{ fontFamily: 'Manrope, sans-serif' }}>
            This is the only time the raw key will be shown. Copy it now and store it in a secrets manager.
          </p>
        </div>

        <div className="bg-[#0e0e0e] rounded-md px-4 py-3 flex items-center gap-3 mb-5">
          <code className="flex-1 text-sm font-mono text-[#e5e2e1]/80 break-all select-all">
            {visible ? rawKey : rawKey.slice(0, 6) + '•'.repeat(rawKey.length - 6)}
          </code>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setVisible(v => !v)} className="text-[#e5e2e1]/40 hover:text-[#e5e2e1] transition-colors">
              {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button onClick={handleCopy} className="text-[#e5e2e1]/40 hover:text-[#ffba38] transition-colors">
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button onClick={onClose}
          className="w-full py-2.5 text-sm font-semibold bg-gradient-to-br from-[#ffba38] to-[#c78b00] text-[#281900] rounded-md hover:shadow-[0_0_20px_rgba(255,186,56,0.3)] transition-all"
          style={{ fontFamily: 'Manrope, sans-serif' }}>
          I have saved the key
        </button>
      </div>
    </div>
  )
}

// ── Revoke confirmation modal ─────────────────────────────────────────────────
interface RevokeModalProps {
  keyMeta: KeyMetadata
  onClose: () => void
  onRevoked: (id: string) => void
  token: string
}

function RevokeModal({ keyMeta, onClose, onRevoked, token }: RevokeModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const handleRevoke = async () => {
    try {
      setLoading(true)
      await gatewayKeysAPI.revoke(token, keyMeta.id)
      onRevoked(keyMeta.id)
    } catch (err) {
      setError(err instanceof GatewayAPIError ? err.message : 'Failed to revoke key.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-[#1c1b1b] border border-[#ffb4ab]/20 rounded-lg p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-md bg-[#93000a]/20 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-[#ffb4ab]" />
          </div>
          <h3 className="text-lg font-bold text-[#e5e2e1]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Revoke Key
          </h3>
        </div>
        <p className="text-sm text-[#e5e2e1]/70 mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Revoke <span className="text-[#e5e2e1] font-medium">{keyMeta.name ?? 'Unnamed'}</span>?
        </p>
        <p className="text-xs text-[#e5e2e1]/40 mb-5 font-mono">{keyMeta.keyPrefix}...</p>
        <p className="text-xs text-[#ffb4ab]/80 mb-5" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Any service using this key will immediately lose access. This cannot be undone.
        </p>

        {error && (
          <div className="mb-4 flex items-center gap-2 text-[#ffb4ab] text-xs bg-[#93000a]/20 border border-[#ffb4ab]/20 px-3 py-2 rounded-md">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} disabled={loading}
            className="px-4 py-2 text-sm text-[#e5e2e1]/60 hover:text-[#e5e2e1] bg-[#353534] hover:bg-[#393939] rounded-md transition-colors font-medium disabled:opacity-50"
            style={{ fontFamily: 'Manrope, sans-serif' }}>
            Cancel
          </button>
          <button onClick={handleRevoke} disabled={loading}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-[#93000a] text-[#ffb4ab] rounded-md hover:bg-[#93000a]/80 transition-colors disabled:opacity-50"
            style={{ fontFamily: 'Manrope, sans-serif' }}>
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Revoke
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ApiKeysPage() {
  const { user, token } = useAuth()
  const role    = user?.tenants?.[0]?.role ?? 'guest'
  const isAdmin = role === 'admin'
  const canView = role === 'admin' || role === 'member'

  const [keys,      setKeys]      = useState<KeyMetadata[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  // Modal state
  const [showCreate,  setShowCreate]  = useState(false)
  const [revealKey,   setRevealKey]   = useState<(KeyMetadata & { key: string }) | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<KeyMetadata | null>(null)

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const loadKeys = useCallback(async () => {
    if (!token || !canView) return
    try {
      setLoading(true)
      setError(null)
      const data = await gatewayKeysAPI.list(token)
      setKeys(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load keys')
    } finally {
      setLoading(false)
    }
  }, [token, canView])

  useEffect(() => { loadKeys() }, [loadKeys])

  const handleCreated = (newKey: KeyMetadata & { key: string }) => {
    setShowCreate(false)
    setRevealKey(newKey)
    setKeys(prev => [newKey, ...prev])
  }

  const handleRevoked = (id: string) => {
    setRevokeTarget(null)
    setKeys(prev => prev.map(k => k.id === id ? { ...k, revoked: true } : k))
    showToast('Key revoked successfully.')
  }

  // ── Guest block ──────────────────────────────────────────────────────────────
  if (!canView) {
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
            <p className="text-[#e5e2e1]/60 text-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>
              You need at least member access to view API keys.
            </p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const activeKeys  = keys.filter(k => !k.revoked)
  const revokedKeys = keys.filter(k => k.revoked)

  return (
    <DashboardLayout>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-md shadow-xl border text-sm font-medium ${
          toast.ok
            ? 'bg-[#1c1b1b] border-[#ffba38]/30 text-[#e5e2e1]'
            : 'bg-[#93000a]/20 border-[#ffb4ab]/30 text-[#ffb4ab]'
        }`} style={{ fontFamily: 'Manrope, sans-serif' }}>
          {toast.ok
            ? <CheckCircle className="w-4 h-4 text-[#ffba38]" />
            : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Modals */}
      {showCreate && token && (
        <CreateModal token={token} onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
      {revealKey && (
        <RevealModal rawKey={revealKey.key} name={revealKey.name} onClose={() => setRevealKey(null)} />
      )}
      {revokeTarget && token && (
        <RevokeModal token={token} keyMeta={revokeTarget} onClose={() => setRevokeTarget(null)} onRevoked={handleRevoked} />
      )}

      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold text-[#e5e2e1] tracking-[-0.02em] leading-none mb-2"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            API Keys
          </h1>
          <p className="text-[#e5e2e1]/70 text-base sm:text-lg tracking-[0.01em]"
            style={{ fontFamily: 'Manrope, sans-serif' }}>
            {isAdmin
              ? 'Create and revoke gateway authentication keys for your tenant.'
              : 'Gateway authentication keys for your tenant.'}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-gradient-to-br from-[#ffba38] to-[#c78b00] text-[#281900] px-5 py-2.5 rounded-md text-sm font-semibold hover:shadow-[0_0_20px_rgba(255,186,56,0.3)] transition-all self-start sm:self-auto shrink-0"
            style={{ fontFamily: 'Manrope, sans-serif' }}>
            <Plus className="w-4 h-4" />
            New Key
          </button>
        )}
      </div>

      {/* Role badge */}
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-[#1c1b1b] border border-[#4f453f]/20 px-3 py-1.5 rounded-md">
          <Shield className="w-3.5 h-3.5 text-[#e5e2e1]/40" />
          <span className="text-xs text-[#e5e2e1]/60 uppercase tracking-[0.15em]"
            style={{ fontFamily: 'Inter, sans-serif' }}>
            {isAdmin ? 'Admin — full access' : 'Member — read only'}
          </span>
        </div>
        {!isAdmin && (
          <span className="text-xs text-[#e5e2e1]/40" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Contact an admin to create or revoke keys.
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-center gap-3 bg-[#93000a]/20 border border-[#ffb4ab]/20 text-[#ffb4ab] px-4 py-3 rounded-md text-sm"
          style={{ fontFamily: 'Manrope, sans-serif' }}>
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="space-y-8">

          {/* ── Active keys table ──────────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-sm font-semibold text-[#e5e2e1] uppercase tracking-[0.15em]"
                style={{ fontFamily: 'Inter, sans-serif' }}>
                Active
              </h2>
              <span className="text-xs bg-[#353534] text-[#e5e2e1]/50 px-2 py-0.5 rounded-sm font-mono">
                {activeKeys.length}
              </span>
            </div>

            {activeKeys.length === 0 ? (
              <div className="bg-[#1c1b1b] rounded-lg p-10 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#ffba38]/10 mb-3">
                  <KeyRound className="w-6 h-6 text-[#ffba38]" />
                </div>
                <p className="text-[#e5e2e1]/60 text-sm mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  No active keys yet.
                </p>
                {isAdmin && (
                  <button onClick={() => setShowCreate(true)}
                    className="text-sm text-[#ffba38] hover:text-[#c78b00] font-medium transition-colors"
                    style={{ fontFamily: 'Manrope, sans-serif' }}>
                    Create your first key →
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-[#1c1b1b] rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px]">
                    <thead>
                      <tr className="border-b border-[#4f453f]/15">
                        <th className="text-left py-3 px-4 text-[#e5e2e1]/50 text-[10px] uppercase tracking-[0.2em] font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Name</th>
                        <th className="text-left py-3 px-4 text-[#e5e2e1]/50 text-[10px] uppercase tracking-[0.2em] font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Prefix</th>
                        <th className="text-left py-3 px-4 text-[#e5e2e1]/50 text-[10px] uppercase tracking-[0.2em] font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>Role</th>
                        <th className="text-left py-3 px-4 text-[#e5e2e1]/50 text-[10px] uppercase tracking-[0.2em] font-medium hidden md:table-cell" style={{ fontFamily: 'Inter, sans-serif' }}>Last Used</th>
                        <th className="text-left py-3 px-4 text-[#e5e2e1]/50 text-[10px] uppercase tracking-[0.2em] font-medium hidden lg:table-cell" style={{ fontFamily: 'Inter, sans-serif' }}>Created</th>
                        {isAdmin && <th className="py-3 px-4" />}
                      </tr>
                    </thead>
                    <tbody>
                      {activeKeys.map(k => (
                        <tr key={k.id} className="border-b border-[#4f453f]/10 hover:bg-[#353534]/30 transition-colors">
                          <td className="py-3.5 px-4">
                            <span className="text-sm font-medium text-[#e5e2e1]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                              {k.name ?? <span className="text-[#e5e2e1]/30 italic">Unnamed</span>}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <code className="text-xs font-mono text-[#e5e2e1]/60 bg-[#0e0e0e] px-2 py-1 rounded">
                              {k.keyPrefix}...
                            </code>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-sm font-medium ${ROLE_STYLES[k.role] ?? ROLE_STYLES.viewer}`}
                              style={{ fontFamily: 'Inter, sans-serif' }}>
                              {k.role}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 hidden md:table-cell">
                            <span className="text-xs text-[#e5e2e1]/50 flex items-center gap-1.5" style={{ fontFamily: 'Manrope, sans-serif' }}>
                              <Clock className="w-3 h-3" />
                              {fmtRelative(k.lastUsed)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 hidden lg:table-cell">
                            <span className="text-xs text-[#e5e2e1]/40" style={{ fontFamily: 'Manrope, sans-serif' }}>
                              {fmtDate(k.createdAt)}
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="py-3.5 px-4 text-right">
                              <button
                                onClick={() => setRevokeTarget(k)}
                                className="flex items-center gap-1.5 ml-auto bg-[#93000a]/20 hover:bg-[#93000a]/40 text-[#ffb4ab] px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                                style={{ fontFamily: 'Manrope, sans-serif' }}>
                                <Trash2 className="w-3.5 h-3.5" />
                                Revoke
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* ── Revoked keys (collapsed, read-only) ───────────────────────── */}
          {revokedKeys.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-sm font-semibold text-[#e5e2e1]/40 uppercase tracking-[0.15em]"
                  style={{ fontFamily: 'Inter, sans-serif' }}>
                  Revoked
                </h2>
                <span className="text-xs bg-[#353534] text-[#e5e2e1]/30 px-2 py-0.5 rounded-sm font-mono">
                  {revokedKeys.length}
                </span>
              </div>
              <div className="bg-[#1c1b1b] rounded-lg overflow-hidden opacity-60">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px]">
                    <tbody>
                      {revokedKeys.map(k => (
                        <tr key={k.id} className="border-b border-[#4f453f]/10">
                          <td className="py-3 px-4 w-1/3">
                            <span className="text-sm text-[#e5e2e1]/40 line-through" style={{ fontFamily: 'Manrope, sans-serif' }}>
                              {k.name ?? 'Unnamed'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <code className="text-xs font-mono text-[#e5e2e1]/30">{k.keyPrefix}...</code>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-sm font-medium bg-[#353534] text-[#e5e2e1]/30"
                              style={{ fontFamily: 'Inter, sans-serif' }}>
                              {k.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 hidden md:table-cell">
                            <span className="text-xs text-[#e5e2e1]/30" style={{ fontFamily: 'Manrope, sans-serif' }}>
                              {fmtDate(k.createdAt)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

        </div>
      )}

      {/* Info footer */}
      <div className="mt-8 flex flex-col gap-3">
        <div className="flex items-start gap-3 bg-[#0e0e0e] rounded-lg p-4">
          <KeyRound className="w-4 h-4 text-[#e5e2e1]/30 mt-0.5 shrink-0" />
          <p className="text-xs text-[#e5e2e1]/40 leading-relaxed" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Gateway API keys authenticate programmatic access to the Supergate API. Keys are hashed with bcrypt before storage — the raw value is shown exactly once at creation time. Revoked keys are rejected immediately on the next request.
          </p>
        </div>
        <div className="flex items-start gap-3 bg-[#0e0e0e] rounded-lg p-4 border border-[#ffba38]/20">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-[#ffba38] mt-0.5 shrink-0"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><path d="m3.3 7 8.7 5 8.7-5"></path><path d="M12 22V12"></path></svg>
          <p className="text-xs text-[#e5e2e1]/70 leading-relaxed" style={{ fontFamily: 'Manrope, sans-serif' }}>
            <strong>Pro Tip:</strong> Use the official <a href="https://www.npmjs.com/package/@supergate/sdk" target="_blank" rel="noopener noreferrer" className="text-[#ffba38] hover:underline">@supergate/sdk</a> for fully typed API access, including chat completions, usage tracking, and key management.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}
