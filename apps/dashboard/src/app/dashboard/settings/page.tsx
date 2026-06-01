'use client'

import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/contexts/auth-context'
import { authAPI, GatewayAPIError } from '@/lib/gateway-client'
import { useState } from 'react'
import { AlertTriangle, Check, AlertCircle, Loader2 } from 'lucide-react'

type Toast = { message: string; type: 'success' | 'error' }

// Simple email regex
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[#ffb4ab]" style={{ fontFamily: 'Manrope, sans-serif' }}>
      <AlertCircle className="w-3 h-3 shrink-0" />
      {msg}
    </p>
  )
}

export default function SettingsPage() {
  const { user, token, refreshUser } = useAuth()
  const [activeTab, setActiveTab] = useState<'profile' | 'tenant'>('profile')
  const isAdmin = user?.tenants[0]?.role === 'admin'

  // ── Profile form ────────────────────────────────────────────────────────────
  const [profileForm, setProfileForm] = useState({
    fullName:        user?.user.name  || '',
    email:           user?.user.email || '',
    currentPassword: '',
    newPassword:     '',
    confirmPassword: '',
  })
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({})
  const [profileSaving,  setProfileSaving]  = useState(false)
  const [profileToast,   setProfileToast]   = useState<Toast | null>(null)

  // ── Tenant form ─────────────────────────────────────────────────────────────
  const [tenantName,   setTenantName]   = useState(user?.tenants[0]?.name || '')
  const [tenantErrors, setTenantErrors] = useState<Record<string, string>>({})
  const [tenantSaving, setTenantSaving] = useState(false)
  const [tenantToast,  setTenantToast]  = useState<Toast | null>(null)

  const showToast = (setter: (t: Toast | null) => void, message: string, type: Toast['type']) => {
    setter({ message, type })
    setTimeout(() => setter(null), 4000)
  }

  // ── Profile validation ──────────────────────────────────────────────────────
  const validateProfile = (): boolean => {
    const errs: Record<string, string> = {}

    if (!profileForm.fullName.trim())
      errs.fullName = 'Name cannot be empty.'

    if (!profileForm.email.trim())
      errs.email = 'Email cannot be empty.'
    else if (!EMAIL_RE.test(profileForm.email.trim()))
      errs.email = 'Enter a valid email address.'

    if (profileForm.newPassword || profileForm.currentPassword || profileForm.confirmPassword) {
      if (!profileForm.currentPassword)
        errs.currentPassword = 'Current password is required to change your password.'
      if (!profileForm.newPassword)
        errs.newPassword = 'Enter a new password.'
      else if (profileForm.newPassword.length < 8)
        errs.newPassword = 'Password must be at least 8 characters.'
      if (profileForm.newPassword && profileForm.newPassword !== profileForm.confirmPassword)
        errs.confirmPassword = 'Passwords do not match.'
    }

    setProfileErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Profile save ────────────────────────────────────────────────────────────
  const handleProfileSave = async () => {
    if (!token || !validateProfile()) return

    const payload: Record<string, string> = {}
    if (profileForm.fullName.trim() !== user?.user.name)  payload.name  = profileForm.fullName.trim()
    if (profileForm.email.trim()    !== user?.user.email) payload.email = profileForm.email.trim()
    if (profileForm.newPassword) {
      payload.currentPassword = profileForm.currentPassword
      payload.newPassword     = profileForm.newPassword
    }

    if (Object.keys(payload).length === 0) {
      setProfileErrors({ _form: 'No changes to save.' })
      return
    }

    try {
      setProfileSaving(true)
      await authAPI.updateProfile(token, payload)
      await refreshUser()
      setProfileForm(f => ({ ...f, currentPassword: '', newPassword: '', confirmPassword: '' }))
      setProfileErrors({})
      showToast(setProfileToast, 'Profile updated successfully.', 'success')
    } catch (err) {
      const msg = err instanceof GatewayAPIError ? err.message : 'Failed to update profile.'
      // Map server errors back to field-level where possible
      if (msg.toLowerCase().includes('current password'))
        setProfileErrors({ currentPassword: 'Current password is incorrect.' })
      else if (msg.toLowerCase().includes('email'))
        setProfileErrors({ email: msg })
      else
        setProfileErrors({ _form: msg })
    } finally {
      setProfileSaving(false)
    }
  }

  // ── Tenant validation ───────────────────────────────────────────────────────
  const validateTenant = (): boolean => {
    const errs: Record<string, string> = {}
    if (!tenantName.trim())
      errs.tenantName = 'Tenant name cannot be empty.'
    else if (tenantName.trim() === user?.tenants[0]?.name)
      errs.tenantName = 'No changes to save.'
    setTenantErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Tenant save ─────────────────────────────────────────────────────────────
  const handleTenantSave = async () => {
    if (!token || !validateTenant()) return
    try {
      setTenantSaving(true)
      await authAPI.updateTenant(token, tenantName.trim())
      await refreshUser()
      setTenantErrors({})
      showToast(setTenantToast, 'Tenant name updated successfully.', 'success')
    } catch (err) {
      const msg = err instanceof GatewayAPIError ? err.message : 'Failed to update tenant.'
      setTenantErrors({ tenantName: msg })
    } finally {
      setTenantSaving(false)
    }
  }

  const inputBase = 'w-full bg-[#0e0e0e] text-[#e5e2e1] px-4 py-3 rounded-md border-b-2 border-transparent focus:outline-none transition-colors'
  const inputOk   = `${inputBase} focus:border-[#ffba38]`
  const inputErr  = `${inputBase} border-[#ffb4ab]/60`
  const labelClass = 'block text-[#e5e2e1]/60 text-xs font-medium mb-2 uppercase tracking-wider'

  const fi = (field: string) => profileErrors[field] ? inputErr : inputOk
  const clearPE = (field: string) => setProfileErrors(e => { const n = { ...e }; delete n[field]; return n })

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold text-[#e5e2e1] tracking-[-0.02em] leading-none mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Configuration
        </h1>
        <p className="text-[#e5e2e1]/70 text-base sm:text-lg tracking-[0.01em]" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Manage your personal profile and tenant preferences
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 sm:gap-8 mb-8 border-b border-[#4f453f]/15">
        {(['profile', ...(isAdmin ? ['tenant'] : [])] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab as 'profile' | 'tenant')}
            className={`pb-4 text-base sm:text-lg font-medium transition-colors relative ${activeTab === tab ? 'text-[#ffba38]' : 'text-[#e5e2e1]/60 hover:text-[#e5e2e1]'}`}
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {tab === 'profile' ? 'My Profile' : 'Tenant Settings'}
            {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ffba38]" />}
          </button>
        ))}
      </div>

      {/* ── Profile Tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">

            {/* Success toast */}
            {profileToast?.type === 'success' && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-md text-sm bg-[#5a4136]/30 border border-[#e2bfb0]/20 text-[#e2bfb0]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                <Check className="w-4 h-4 shrink-0" />{profileToast.message}
              </div>
            )}

            {/* Form-level error (no specific field) */}
            {profileErrors._form && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-md text-sm bg-[#93000a]/20 border border-[#ffb4ab]/20 text-[#ffb4ab]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                <AlertCircle className="w-4 h-4 shrink-0" />{profileErrors._form}
              </div>
            )}

            {/* Personal Information */}
            <div className="bg-[#1c1b1b] rounded-lg p-6">
              <h2 className="text-xl font-bold text-[#e5e2e1] mb-6" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Personal Information
              </h2>
              <div className="space-y-5">
                {/* Avatar */}
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-gradient-to-br from-[#ffba38] to-[#c78b00] flex items-center justify-center text-[#281900] text-2xl font-bold shrink-0">
                    {(profileForm.fullName || user?.user.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#e5e2e1]" style={{ fontFamily: 'Manrope, sans-serif' }}>{user?.user.name}</p>
                    <p className="text-xs text-[#e5e2e1]/50 mt-0.5" style={{ fontFamily: 'Manrope, sans-serif' }}>{user?.user.email}</p>
                  </div>
                </div>

                {/* Full Name */}
                <div>
                  <label className={labelClass}>Full Name</label>
                  <input type="text" value={profileForm.fullName}
                    onChange={e => { setProfileForm(f => ({ ...f, fullName: e.target.value })); clearPE('fullName') }}
                    className={fi('fullName')} placeholder="Your name" />
                  <FieldError msg={profileErrors.fullName} />
                </div>

                {/* Email */}
                <div>
                  <label className={labelClass}>Email Address</label>
                  <input type="email" value={profileForm.email}
                    onChange={e => { setProfileForm(f => ({ ...f, email: e.target.value })); clearPE('email') }}
                    className={fi('email')} placeholder="you@example.com" />
                  <FieldError msg={profileErrors.email} />
                </div>
              </div>
            </div>

            {/* Change Password */}
            <div className="bg-[#1c1b1b] rounded-lg p-6">
              <h2 className="text-xl font-bold text-[#e5e2e1] mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Change Password
              </h2>
              <p className="text-xs text-[#e5e2e1]/40 mb-5" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Leave blank to keep your current password.
              </p>
              <div className="space-y-5">
                <div>
                  <label className={labelClass}>Current Password</label>
                  <input type="password" value={profileForm.currentPassword}
                    onChange={e => { setProfileForm(f => ({ ...f, currentPassword: e.target.value })); clearPE('currentPassword') }}
                    className={fi('currentPassword')} placeholder="••••••••" />
                  <FieldError msg={profileErrors.currentPassword} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className={labelClass}>New Password</label>
                    <input type="password" value={profileForm.newPassword}
                      onChange={e => { setProfileForm(f => ({ ...f, newPassword: e.target.value })); clearPE('newPassword') }}
                      className={fi('newPassword')} placeholder="••••••••" />
                    <FieldError msg={profileErrors.newPassword} />
                  </div>
                  <div>
                    <label className={labelClass}>Confirm Password</label>
                    <input type="password" value={profileForm.confirmPassword}
                      onChange={e => { setProfileForm(f => ({ ...f, confirmPassword: e.target.value })); clearPE('confirmPassword') }}
                      className={fi('confirmPassword')} placeholder="••••••••" />
                    <FieldError msg={profileErrors.confirmPassword} />
                  </div>
                </div>
              </div>

              <button onClick={handleProfileSave} disabled={profileSaving}
                className="mt-6 flex items-center gap-2 bg-gradient-to-br from-[#ffba38] to-[#c78b00] text-[#281900] px-6 py-3 rounded-md font-medium hover:shadow-[0_0_20px_rgba(255,186,56,0.3)] transition-all disabled:opacity-50"
                style={{ fontFamily: 'Manrope, sans-serif' }}>
                {profileSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {profileSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            <div className="bg-[#1c1b1b] rounded-lg p-6">
              <h3 className="text-xs font-bold text-[#e5e2e1] mb-4 uppercase tracking-wider" style={{ fontFamily: 'Inter, sans-serif' }}>
                Account Status
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="text-[#e5e2e1]/50 text-xs uppercase tracking-wider mb-1">Role</div>
                  <div className="inline-block bg-[#5a4136]/30 text-[#e2bfb0] px-3 py-1 rounded-sm text-xs font-medium uppercase">
                    {user?.tenants[0]?.role ?? 'member'}
                  </div>
                </div>
                <div>
                  <div className="text-[#e5e2e1]/50 text-xs uppercase tracking-wider mb-1">Tenant</div>
                  <div className="text-[#e5e2e1] text-sm truncate">{user?.tenants[0]?.name}</div>
                </div>
                <div>
                  <div className="text-[#e5e2e1]/50 text-xs uppercase tracking-wider mb-1">Tier</div>
                  <div className="text-[#ffba38] text-sm font-medium uppercase">{user?.tenants[0]?.tier}</div>
                </div>
                <div>
                  <div className="text-[#e5e2e1]/50 text-xs uppercase tracking-wider mb-1">Member since</div>
                  <div className="text-[#e5e2e1] text-sm">
                    {user?.user.createdAt ? new Date(user.user.createdAt).toLocaleDateString() : '—'}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#93000a]/10 border border-[#ffb4ab]/20 rounded-lg p-6">
              <h3 className="text-xs font-bold text-[#ffb4ab] mb-2 uppercase tracking-wider" style={{ fontFamily: 'Inter, sans-serif' }}>
                Danger Zone
              </h3>
              <p className="text-[#e5e2e1]/60 text-xs mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Permanently delete your account. This cannot be undone.
              </p>
              <button
                onClick={() => {
                  if (confirm('Are you sure? This will permanently delete your account.')) {
                    alert('Account deletion is not yet available. Contact support.')
                  }
                }}
                className="w-full bg-[#93000a] text-[#ffb4ab] px-4 py-2.5 rounded-md text-sm font-medium hover:bg-[#93000a]/80 transition-colors flex items-center justify-center gap-2"
                style={{ fontFamily: 'Manrope, sans-serif' }}>
                <AlertTriangle className="w-4 h-4" />Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tenant Tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'tenant' && isAdmin && (
        <div className="max-w-2xl space-y-6">

          {tenantToast?.type === 'success' && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-md text-sm bg-[#5a4136]/30 border border-[#e2bfb0]/20 text-[#e2bfb0]" style={{ fontFamily: 'Manrope, sans-serif' }}>
              <Check className="w-4 h-4 shrink-0" />{tenantToast.message}
            </div>
          )}

          <div className="bg-[#1c1b1b] rounded-lg p-6">
            <h2 className="text-xl font-bold text-[#e5e2e1] mb-6" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Tenant Configuration
            </h2>
            <div className="space-y-6">
              <div>
                <label className={labelClass}>Tenant Name</label>
                <input type="text" value={tenantName}
                  onChange={e => { setTenantName(e.target.value); setTenantErrors({}) }}
                  className={tenantErrors.tenantName ? inputErr : inputOk}
                  placeholder="My Organization" />
                <FieldError msg={tenantErrors.tenantName} />
              </div>

              <div>
                <label className={labelClass}>Subscription Tier</label>
                <div className="flex items-center gap-3 bg-[#0e0e0e]/50 px-4 py-3 rounded-md">
                  <span className="text-[#ffba38] font-medium uppercase text-sm">{user?.tenants[0]?.tier}</span>
                  <span className="text-[#e5e2e1]/40 text-xs" style={{ fontFamily: 'Manrope, sans-serif' }}>— contact support to change tier</span>
                </div>
              </div>

              <div>
                <label className={labelClass}>Tenant ID</label>
                <input type="text" value={user?.tenants[0]?.id || ''} readOnly
                  className="w-full bg-[#0e0e0e]/50 text-[#e5e2e1]/40 px-4 py-3 rounded-md cursor-not-allowed font-mono text-xs" />
              </div>
            </div>

            <button onClick={handleTenantSave} disabled={tenantSaving}
              className="mt-6 flex items-center gap-2 bg-gradient-to-br from-[#ffba38] to-[#c78b00] text-[#281900] px-6 py-3 rounded-md font-medium hover:shadow-[0_0_20px_rgba(255,186,56,0.3)] transition-all disabled:opacity-50"
              style={{ fontFamily: 'Manrope, sans-serif' }}>
              {tenantSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {tenantSaving ? 'Saving...' : 'Save Tenant Settings'}
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
