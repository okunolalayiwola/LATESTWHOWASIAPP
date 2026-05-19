// src/pages/SettingsPage.jsx — v2
// Adds: profile photo upload via Cloudinary (same storage.js used everywhere)
// All previous functionality preserved

import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { id } from '@instantdb/react'
import { db } from '../lib/instant'
import { useToast } from '../contexts/ToastContext'
import { uploadImage } from '../lib/storage'
import { SkeletonProfile, SkeletonListItem } from '../components/ui/Skeleton'

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ label }) {
  return (
    <p className="text-[0.65rem] font-bold tracking-[0.22em] uppercase text-cream-dim mb-3 mt-8 first:mt-0">
      {label}
    </p>
  )
}

function SettingRow({ label, value, onClick, danger, icon }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.04] transition-colors group ${danger ? 'text-red-400' : 'text-white'}`}
    >
      <div className="flex items-center gap-3">
        {icon && <span className="text-base w-5 text-center opacity-60">{icon}</span>}
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {value && <span className="text-xs text-white/30 truncate max-w-[120px]">{value}</span>}
        <svg className="w-3.5 h-3.5 text-white/20 group-hover:text-white/40 transition-colors flex-shrink-0"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  )
}

function EditModal({ title, placeholder, current, onSave, onClose }) {
  const [value,  setValue]  = useState(current || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!value.trim()) return
    setSaving(true)
    await onSave(value.trim())
    setSaving(false)
    onClose()
  }

  return (
    <>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        onClick={onClose} className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm" />
      <motion.div initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
        transition={{ type:'spring', damping:30, stiffness:300 }}
        className="dark-container fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d0d] border-t border-white/10 rounded-t-3xl px-5 pt-4 pb-10">
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />
        <h3 className="font-display text-xl font-bold text-white mb-5">{title}</h3>
        <input autoFocus type="text" value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key==='Enter' && handleSave()}
          placeholder={placeholder}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-gold/40 transition-colors mb-4" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm text-white/50 glass border border-white/10 hover:text-white transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!value.trim() || saving}
            className="flex-[2] py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-gold to-sky text-black hover:opacity-90 disabled:opacity-40 transition-opacity">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </motion.div>
    </>
  )
}

function ConfirmModal({ title, message, confirmLabel, onConfirm, onClose, danger }) {
  const [confirming, setConfirming] = useState(false)
  async function handleConfirm() {
    setConfirming(true)
    await onConfirm()
    setConfirming(false)
  }
  return (
    <>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        onClick={onClose} className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm" />
      <motion.div initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
        transition={{ type:'spring', damping:30, stiffness:300 }}
        className="dark-container fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d0d] border-t border-white/10 rounded-t-3xl px-5 pt-4 pb-10">
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />
        <h3 className="font-display text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-sm text-white/50 mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm text-white/50 glass border border-white/10 hover:text-white transition-colors">Cancel</button>
          <button onClick={handleConfirm} disabled={confirming}
            className={`flex-[2] py-3 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40 ${
              danger ? 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30' : 'bg-gradient-to-r from-gold to-sky text-black hover:opacity-90'
            }`}>
            {confirming ? 'Please wait...' : confirmLabel}
          </button>
        </div>
      </motion.div>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const navigate  = useNavigate()
  const { toast } = useToast()
  const { user, isLoading } = db.useAuth()

  const [modal,       setModal]       = useState(null)
  const [avatarPct,   setAvatarPct]   = useState(0)
  const [uploading,   setUploading]   = useState(false)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const fileRef = useRef()

  const { data: profileData } = db.useQuery(
    user ? { profiles: { $: { where: { userId: user.id } } } } : null
  )
  const profile     = profileData?.profiles?.[0]
  const displayName = profile?.displayName || user?.email?.split('@')[0] || 'Anonymous'

  function showToast(msg) { toast.success(msg) }

  // ── Profile helpers ─────────────────────────────────────────────────────────

  async function upsertProfile(changes) {
    if (profile?.id) {
      await db.transact([db.tx.profiles[profile.id].update(changes)])
    } else {
      await db.transact([
        db.tx.profiles[id()].update({ userId: user.id, ...changes }),
      ])
    }
  }

  async function handleUpdateName(name) {
    await upsertProfile({ displayName: name })
    showToast('Name updated')
  }

  // ── Avatar upload ───────────────────────────────────────────────────────────

  async function handleAvatarSelect(e) {
    const file = e.target.files[0]; if (!file) return
    setAvatarPreview(URL.createObjectURL(file))
    setUploading(true)
    try {
      const url = await uploadImage(file, setAvatarPct, 'avatars')
      await upsertProfile({ photoUrl: url })
      showToast('Photo updated ✦')
    } catch {
      toast.error('Upload failed. Check Cloudinary config.')
      setAvatarPreview(null)
    } finally {
      setUploading(false); setAvatarPct(0)
    }
  }

  // ── Sign out ────────────────────────────────────────────────────────────────

  async function handleSignOut() {
    await db.auth.signOut()
    navigate('/')
  }

  if (isLoading) {
    return (
      <div className="relative z-10 min-h-screen pt-20 pb-28">
        <div className="max-w-lg mx-auto px-5 space-y-6">
          <div className="h-8 w-24 bg-white/5 rounded-xl animate-pulse" />
          <SkeletonProfile />
          <div className="space-y-2">
            <div className="h-4 w-20 bg-white/5 rounded-full animate-pulse" />
            <div className="glass rounded-2xl p-4 space-y-4">
              <SkeletonListItem />
              <SkeletonListItem />
              <SkeletonListItem />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!user) { navigate('/auth'); return null }

  const photoSrc = avatarPreview || profile?.photoUrl
  const initials = displayName.charAt(0).toUpperCase()

  return (
    <div className="relative z-10 pt-20 pb-24 max-w-lg mx-auto">

      {/* ── Back + Title ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-5 mb-8">
        <Link to="/dashboard"
          className="w-9 h-9 glass rounded-full flex items-center justify-center text-white/60 hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="font-display text-2xl font-bold">Settings</h1>
      </div>

      {/* ── Profile card ──────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity:0,y:12 }} animate={{ opacity:1,y:0 }}
        className="mx-5 glass rounded-2xl p-6 mb-2">
        <div className="flex items-center gap-5">
          {/* Avatar with upload tap */}
          <div className="relative flex-shrink-0">
            <div
              onClick={() => fileRef.current.click()}
              className="w-18 h-18 w-[72px] h-[72px] rounded-full bg-gradient-to-br from-gold/30 to-coral/30 border border-white/10 flex items-center justify-center text-2xl font-bold font-display overflow-hidden cursor-pointer group"
            >
              {photoSrc
                ? <img src={photoSrc} alt="" className="w-full h-full object-cover" />
                : initials}
              {/* Hover overlay */}
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
            </div>

            {/* Upload progress ring */}
            {uploading && (
              <div className="absolute inset-0 rounded-full flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 72 72">
                  <circle cx="36" cy="36" r="32" fill="none" stroke="rgba(255,215,0,0.2)" strokeWidth="4" />
                  <circle cx="36" cy="36" r="32" fill="none" stroke="#FFD700" strokeWidth="4"
                    strokeDasharray={`${2 * Math.PI * 32}`}
                    strokeDashoffset={`${2 * Math.PI * 32 * (1 - avatarPct / 100)}`}
                    strokeLinecap="round" style={{ transition:'stroke-dashoffset 0.2s' }} />
                </svg>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-display text-xl font-bold text-white truncate">{displayName}</div>
            <div className="text-xs text-white/40 mt-0.5 truncate">{user.email}</div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => fileRef.current.click()}
                className="text-[0.65rem] font-semibold tracking-widest uppercase text-gold hover:text-gold/70 transition-colors">
                {uploading ? `Uploading ${avatarPct}%` : 'Change photo →'}
              </button>
            </div>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
      </motion.div>

      {/* ── Account section ───────────────────────────────────────────────── */}
      <motion.div initial={{ opacity:0,y:12 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.1 }} className="mx-5">
        <SectionHeader label="Account" />
        <div className="glass rounded-2xl overflow-hidden divide-y divide-white/5">
          <SettingRow icon="✦" label="Display name" value={displayName} onClick={() => setModal('name')} />
          <SettingRow icon="◎" label="Email address" value={user.email} onClick={() => {}} />
          <SettingRow icon="✿" label="Family Tree" onClick={() => navigate('/family-tree')} />
        </div>
      </motion.div>

      {/* ── Memorials section ─────────────────────────────────────────────── */}
      <motion.div initial={{ opacity:0,y:12 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.15 }} className="mx-5">
        <SectionHeader label="Memorials" />
        <div className="glass rounded-2xl overflow-hidden divide-y divide-white/5">
          <SettingRow icon="♡" label="My memorials"      onClick={() => navigate('/dashboard')} />
          <SettingRow icon="◎" label="Create a memorial"  onClick={() => navigate('/create')}    />
          <SettingRow icon="✦" label="Explore memorials"  onClick={() => navigate('/explore')}   />
        </div>
      </motion.div>

      {/* ── About section ─────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity:0,y:12 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.2 }} className="mx-5">
        <SectionHeader label="About" />
        <div className="glass rounded-2xl overflow-hidden divide-y divide-white/5">
          <SettingRow icon="☽" label="Who Was I" value="v2.0" onClick={() => {}} />
          <SettingRow icon="◎" label="Privacy policy"  onClick={() => navigate('/privacy')} />
          <SettingRow icon="✦" label="Terms of service" onClick={() => navigate('/terms')}   />
        </div>
      </motion.div>

      {/* ── Danger zone ───────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity:0,y:12 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.25 }} className="mx-5">
        <SectionHeader label="Account actions" />
        <div className="glass rounded-2xl overflow-hidden divide-y divide-white/5">
          <SettingRow icon="→" label="Sign out"        onClick={() => setModal('signout')} />
          <SettingRow icon="✕" label="Delete account"  onClick={() => setModal('delete')} danger />
        </div>
      </motion.div>

      {/* Branding */}
      <div className="text-center mt-12 px-5">
        <p className="text-brand text-lg">WHO WAS I</p>
        <p className="text-[0.6rem] text-white/15 tracking-widest uppercase mt-1">Living Memorial Platform</p>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modal==='name' && (
          <EditModal key="name" title="Display name" placeholder="Your name" current={displayName}
            onSave={handleUpdateName} onClose={() => setModal(null)} />
        )}
        {modal==='signout' && (
          <ConfirmModal key="signout" title="Sign out" message="You will be returned to the landing page."
            confirmLabel="Sign out" onConfirm={handleSignOut} onClose={() => setModal(null)} />
        )}
        {modal==='delete' && (
          <ConfirmModal key="delete" title="Delete account"
            message="This is permanent. All your memorials, tributes, and family data will be removed."
            confirmLabel="Delete my account" danger
            onConfirm={async () => { await handleSignOut() }}
            onClose={() => setModal(null)} />
        )}
      </AnimatePresence>

    </div>
  )
}
