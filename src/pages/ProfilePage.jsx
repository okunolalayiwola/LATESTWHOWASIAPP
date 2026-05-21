// src/pages/ProfilePage.jsx
// The account owner's profile — YOUR identity on WHO WAS I.
// NOT the same as a memorial page. This is about the logged-in user.
//
// Sections: hero avatar · stats · subscription · recent activity · settings nav
//
// FIX: db.useQuery() called BEFORE any early return (Rules of Hooks).
// Letters split into a separate resilient query so a failure only zeroes the stat.
// Settings merged into Profile with notification toggles and real delete account.

import { useState, useRef, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { id } from '@instantdb/react'
import { db } from '../lib/instant'
import { uploadImage } from '../lib/storage'
import { COUNTRIES, countryFlag, findCountry } from '../lib/countries'
import { SkeletonProfile, SkeletonStats, SkeletonListItem } from '../components/ui/Skeleton'
import ToggleRow from '../components/ui/ToggleRow'

// ─── Plan config ──────────────────────────────────────────────────────────────

const PLANS = {
  free: {
    name:     'Free',
    gradient: 'from-white/20 to-white/5',
    badge:    'rgba(255,255,255,0.12)',
    color:    '#fff',
    limit:    '1 memorial',
    features: ['1 living memorial', 'Tributes & candles', 'QR code', 'Family tree (3 members)'],
  },
  family: {
    name:     'Family',
    gradient: 'from-gold/30 to-sky/20',
    badge:    'rgba(255,215,0,0.20)',
    color:    '#FFD700',
    limit:    '5 memorials',
    price:    '£9 / month',
    features: ['5 living memorials', 'Voice cloning', 'Legacy vault', 'AI conversation (20/day)', 'Unlimited family tree'],
  },
  legacy: {
    name:     'Legacy',
    gradient: 'from-lavender/30 to-coral/20',
    badge:    'rgba(192,132,252,0.20)',
    color:    '#C084FC',
    limit:    'Unlimited memorials',
    price:    '£24 / month',
    features: ['Unlimited memorials', 'AI conversation (unlimited)', 'Will & estate builder', 'Priority support', 'Custom domain'],
  },
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ value, label, icon, accent, sublabel }) {
  return (
    <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
      className="metal-card rounded-2xl p-4 flex-1 min-w-0">
      <div className="flex items-start justify-between mb-2">
        <span className="text-lg">{icon}</span>
        <div className="w-1.5 h-1.5 rounded-full mt-1.5" style={{ background: accent, boxShadow: `0 0 5px ${accent}` }} />
      </div>
      <div className="font-display text-3xl font-bold text-white">{value}</div>
      <div className="text-[0.65rem] font-semibold text-white/50 mt-0.5 uppercase tracking-wide">{label}</div>
      {sublabel && <div className="text-[0.55rem] text-white/25 mt-0.5">{sublabel}</div>}
    </motion.div>
  )
}

// ─── Settings row ─────────────────────────────────────────────────────────────

function SettingsRow({ icon, label, value, onClick, badge, danger }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-4 px-5 py-4 border-b border-white/[0.05] last:border-0 hover:bg-white/[0.03] transition-colors ${danger ? 'text-rose/70' : 'text-white'}`}>
      {icon && (
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${danger ? 'bg-rose/10' : 'bg-white/6'}`}>
          {icon}
        </div>
      )}
      <div className="flex-1 text-left min-w-0">
        <span className="text-sm font-medium">{label}</span>
        {value && <p className="text-xs text-white/30 mt-0.5 truncate">{value}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {badge && (
          <span className="text-[0.55rem] font-bold px-2 py-0.5 rounded-full bg-gold/15 border border-gold/25 text-gold/80">
            {badge}
          </span>
        )}
        <svg className={`w-4 h-4 ${danger ? 'text-rose/30' : 'text-white/20'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  )
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

function EditCountryModal({ current, onSave, onClose }) {
  const [search,  setSearch]  = useState('')
  const [saving,  setSaving]  = useState(false)
  const [selected, setSelected] = useState(current || '')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return COUNTRIES
    return COUNTRIES.filter(c => c.name.toLowerCase().includes(q))
  }, [search])

  async function save() {
    if (!selected) return
    const country = findCountry(selected)
    if (!country) return
    setSaving(true)
    await onSave(country.code, country.name)
    setSaving(false)
    onClose()
  }

  return (
    <>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        onClick={onClose} className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm" />
      <motion.div initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
        transition={{ type:'spring', damping:30, stiffness:300 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d10] border-t border-white/10 rounded-t-3xl px-5 pt-4 pb-10"
        style={{ maxHeight: '80vh', display:'flex', flexDirection:'column' }}>
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5 flex-shrink-0" />
        <h3 className="font-display text-xl font-bold text-white mb-1 flex-shrink-0">Your country</h3>
        <p className="text-xs text-white/40 mb-4 leading-relaxed flex-shrink-0">
          Shown as a flag on your memorials so visitors know where you're based.
        </p>

        {/* Search */}
        <input
          autoFocus
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search countries…"
          className="w-full inset-field rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none mb-3 flex-shrink-0"
        />

        {/* Selected */}
        {selected && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 mb-3 flex-shrink-0">
            <span className="text-xl">{countryFlag(selected)}</span>
            <span className="text-sm font-semibold text-white flex-1">{findCountry(selected)?.name}</span>
            <button onClick={() => setSelected('')} className="text-xs text-white/35 hover:text-white/60">✕</button>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto rounded-xl bg-white/[0.03] border border-white/[0.06] divide-y divide-white/[0.04]">
          {filtered.map(c => (
            <button
              key={c.code}
              onClick={() => setSelected(c.code)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5 ${selected === c.code ? 'bg-gold/10' : ''}`}
            >
              <span className="text-lg flex-shrink-0">{countryFlag(c.code)}</span>
              <span className={`text-sm ${selected === c.code ? 'text-gold font-semibold' : 'text-white/70'}`}>{c.name}</span>
              {selected === c.code && <span className="ml-auto text-gold text-xs">✓</span>}
            </button>
          ))}
        </div>

        <div className="flex gap-3 mt-4 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm rubber-btn text-white/50">Cancel</button>
          <button onClick={save} disabled={!selected || saving}
            className="flex-[2] py-3 rounded-xl text-sm font-bold metal-btn text-black disabled:opacity-40">
            {saving ? 'Saving…' : 'Save country'}
          </button>
        </div>
      </motion.div>
    </>
  )
}

function EditNameModal({ profile, onSave, onClose }) {
  const [firstName, setFirstName] = useState(profile?.firstName || profile?.displayName?.split(' ')[0] || '')
  const [lastName,  setLastName]  = useState(profile?.lastName  || profile?.displayName?.split(' ').slice(1).join(' ') || '')
  const [saving,    setSaving]    = useState(false)

  async function save() {
    if (!firstName.trim()) return
    setSaving(true)
    await onSave(firstName.trim(), lastName.trim())
    setSaving(false)
    onClose()
  }

  return (
    <>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        onClick={onClose} className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm" />
      <motion.div initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
        transition={{ type:'spring', damping:30, stiffness:300 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d10] border-t border-white/10 rounded-t-3xl px-5 pt-4 pb-10">
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
        <h3 className="font-display text-xl font-bold text-white mb-1">Your name</h3>
        <p className="text-xs text-white/40 mb-5 leading-relaxed">
          Your first name is used to greet you. Your full name appears when you leave tributes.
        </p>
        <div className="space-y-3 mb-4">
          <div>
            <label className="text-[0.6rem] font-semibold tracking-widest uppercase text-white/35 mb-1.5 block">First name</label>
            <input autoFocus type="text" value={firstName}
              onChange={e => setFirstName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && save()}
              placeholder="e.g. Ada"
              autoComplete="given-name"
              className="w-full inset-field rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none" />
          </div>
          <div>
            <label className="text-[0.6rem] font-semibold tracking-widest uppercase text-white/35 mb-1.5 block">Last name <span className="normal-case tracking-normal text-white/20">(optional)</span></label>
            <input type="text" value={lastName}
              onChange={e => setLastName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && save()}
              placeholder="e.g. Lovelace"
              autoComplete="family-name"
              className="w-full inset-field rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none" />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm rubber-btn text-white/50">Cancel</button>
          <button onClick={save} disabled={!firstName.trim() || saving}
            className="flex-[2] py-3 rounded-xl text-sm font-bold metal-btn text-black disabled:opacity-40">
            {saving ? 'Saving…' : 'Save name'}
          </button>
        </div>
      </motion.div>
    </>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const navigate        = useNavigate()
  const { user, isLoading: authLoading } = db.useAuth()
  const avatarRef       = useRef()
  const [uploading,     setUploading]     = useState(false)
  const [uploadPct,     setUploadPct]     = useState(0)
  const [uploadError,   setUploadError]   = useState('')
  const [showEditName,    setShowEditName]    = useState(false)
  const [showEditCountry, setShowEditCountry] = useState(false)
  const [confirmSignOut,  setConfirmSignOut]  = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting,      setDeleting]      = useState(false)

  // ── HOOKS FIRST (before any early return — Rules of Hooks) ────────────────
  const { data } = db.useQuery(
    user ? {
      profiles:      { $: { where: { userId: user.id } } },
      memorials:     { $: { where: { creatorId: user.id } }, tributes:{} },
      familyMembers: { $: { where: { ownerId: user.id } } },
    } : null
  )

  // Letters in a separate resilient query (failure only zeroes the stat)
  const { data: lettersData } = db.useQuery(
    user ? { letters: { $: { where: { createdBy: user.id } } } } : null
  )

  // ── Derived values (safe to access before returns) ────────────────────────
  const profile       = data?.profiles?.[0]
  const memorials     = data?.memorials     || []
  const familyMembers = data?.familyMembers || []
  const letters       = lettersData?.letters || []

  const totalTributes  = memorials.reduce((s, m) => s + (m.tributes?.length || 0), 0)
  const totalLetters   = letters.length
  const totalViews     = memorials.reduce((s, m) => s + (m.viewCount || 0), 0)

  const plan     = profile?.plan || 'free'
  const planInfo = PLANS[plan] || PLANS.free

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : null

  // firstName is the greeting name; displayName is the full name for tributes
  const firstName   = profile?.firstName || profile?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'You'
  const displayName = profile?.displayName
    || [profile?.firstName, profile?.lastName].filter(Boolean).join(' ')
    || user?.email?.split('@')[0]
    || 'You'
  const initials    = (displayName || '?').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0,2).toUpperCase() || '?'

  // ── Notification toggle state ─────────────────────────────────────────────
  const [notifyAnniversaries, setNotifyAnniversaries] = useState(true)
  const [notifyTributes,      setNotifyTributes]      = useState(true)
  const [notifyFamily,        setNotifyFamily]        = useState(true)

  // Sync notification toggles from profile once loaded
  useEffect(() => {
    if (profile) {
      setNotifyAnniversaries(profile.notifyAnniversaries !== false)
      setNotifyTributes(profile.notifyTributes !== false)
      setNotifyFamily(profile.notifyFamily !== false)
    }
  }, [profile?.id])

  // ── Persist notification toggles ──────────────────────────────────────────
  async function toggleNotify(field, value) {
    if (!profile) return
    await db.transact([db.tx.profiles[profile.id].update({ [field]: value })])
  }

  // Redirect unauthenticated users to auth page
  useEffect(() => {
    if (!authLoading && !user) navigate('/auth', { replace: true })
  }, [user, authLoading, navigate])

  // ── Early returns (after all hooks) ───────────────────────────────────────
  if (authLoading) {
    return (
      <div className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    )
  }

  // ── Profile photo upload ───────────────────────────────────────────────────
  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    setUploading(true)
    setUploadError('')
    try {
      const url = await uploadImage(file, p => setUploadPct(p), 'profiles/avatars')
      await db.transact([db.tx.profiles[profile.id].update({ photoUrl: url })])
    } catch (err) {
      setUploadError(err.message || 'Upload failed. Check your connection and try again.')
    } finally { setUploading(false); setUploadPct(0) }
  }

  // ── Save country ───────────────────────────────────────────────────────────
  async function saveCountry(code, name) {
    if (!profile) return
    await db.transact([db.tx.profiles[profile.id].update({ countryCode: code, country: name })])
  }

  // ── Save name (first, last, and combined displayName) ─────────────────────
  async function saveName(first, last) {
    if (!profile) return
    const fullName = [first, last].filter(Boolean).join(' ')
    await db.transact([
      db.tx.profiles[profile.id].update({
        firstName:   first,
        lastName:    last || '',
        displayName: fullName,
      })
    ])
  }

  // ── Sign out ───────────────────────────────────────────────────────────────
  async function handleSignOut() {
    await db.auth.signOut()
    navigate('/')
  }

  // ── Delete account ─────────────────────────────────────────────────────────
  async function handleDeleteAccount() {
    setDeleting(true)
    try {
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
      if (!res.ok) throw new Error('Delete failed')
      await db.auth.signOut()
      navigate('/')
    } catch (err) {
      alert('Could not delete account. Please contact support.')
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (!data) {
    return (
      <div className="relative z-10 min-h-screen pt-20 pb-28">
        <div className="max-w-2xl mx-auto px-5 space-y-6">
          <div className="flex flex-col items-center pt-12 space-y-4">
            <div className="w-24 h-24 rounded-full bg-white/5 animate-pulse" />
            <div className="h-6 w-40 bg-white/5 rounded-xl animate-pulse" />
            <div className="h-4 w-56 bg-white/5 rounded-full animate-pulse" />
          </div>
          <SkeletonStats />
          <div className="space-y-2">
            <div className="h-4 w-20 bg-white/5 rounded-full animate-pulse" />
            <div className="metal-card rounded-2xl p-4 space-y-3">
              <SkeletonListItem />
              <SkeletonListItem />
              <SkeletonListItem />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="relative z-10 min-h-screen pb-28">
      <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <div className="relative pt-20 pb-6 px-5 text-center overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 opacity-30"
          style={{ background: `linear-gradient(180deg, ${planInfo.color}20 0%, transparent 100%)` }} />

        {/* Avatar */}
        <div className="relative inline-block mb-4 mt-4">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => avatarRef.current?.click()}
            className="relative w-24 h-24 rounded-full overflow-hidden flex-shrink-0"
            style={{
              border: `3px solid ${planInfo.color}`,
              boxShadow: `0 0 0 2px rgba(8,8,15,1), 0 0 24px ${planInfo.color}40`,
            }}>
            {uploading ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-[#0d0d10]">
                <div className="w-7 h-7 border-2 border-gold/30 border-t-gold rounded-full animate-spin mb-1" />
                <span className="text-[0.55rem] text-white/40">{uploadPct}%</span>
              </div>
            ) : profile?.photoUrl ? (
              <img src={profile.photoUrl} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-display text-3xl font-bold text-white/80"
                style={{ background: `linear-gradient(135deg, ${planInfo.color}25, ${planInfo.color}10)` }}>
                {initials}
              </div>
            )}
          </motion.button>

          {/* Camera icon */}
          <button onClick={() => avatarRef.current?.click()}
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full metal-btn flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
            </svg>
          </button>
        </div>

        {/* Upload error */}
        {uploadError && (
          <div className="relative mb-3 mx-auto max-w-xs">
            <div className="text-[0.65rem] text-rose/80 bg-rose/10 border border-rose/20 rounded-lg px-3 py-2">
              {uploadError}
            </div>
          </div>
        )}

        {/* Name + email */}
        <div className="relative">
          <button onClick={() => setShowEditName(true)}
            className="group flex items-center gap-2 mx-auto">
            <h1 className="font-display text-2xl font-bold text-white">{displayName}</h1>
            <svg className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
          </button>
          <p className="text-xs text-white/35 mt-1">{user?.email}</p>

          {/* Plan badge + member since */}
          <div className="flex items-center justify-center gap-3 mt-3">
            <span className="text-[0.6rem] font-bold px-3 py-1 rounded-full"
              style={{ background: planInfo.badge, color: planInfo.color, border: `1px solid ${planInfo.color}30` }}>
              {planInfo.name.toUpperCase()} PLAN
            </span>
            {memberSince && (
              <span className="text-[0.6rem] text-white/25">Member since {memberSince}</span>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 max-w-2xl mx-auto space-y-4">

        {/* ── STATS ────────────────────────────────────────────────────────── */}
        <div>
          <p className="text-[0.6rem] font-bold tracking-[0.22em] uppercase text-cream-dim mb-3">
            Your activity
          </p>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Memorials"  value={memorials.length}     icon="✦" accent="#FFD700" sublabel="created by you" />
            <StatCard label="Tributes"   value={totalTributes}         icon="♡" accent="#38BDF8" sublabel="across all memorials" />
            <StatCard label="Family"     value={familyMembers.length}  icon="✿" accent="#34D399" sublabel="members mapped" />
            <StatCard label="Letters"    value={totalLetters}          icon="✉" accent="#C084FC" sublabel="sealed in vault" />
          </div>
          {totalViews > 0 && (
            <div className="mt-3 metal-card rounded-2xl px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-white/40">Total memorial views</p>
                <p className="font-display text-2xl font-bold text-white">{totalViews.toLocaleString()}</p>
              </div>
              <div className="text-3xl opacity-20">◎</div>
            </div>
          )}
        </div>

        {/* ── SUBSCRIPTION ─────────────────────────────────────────────────── */}
        <div>
          <p className="text-[0.6rem] font-bold tracking-[0.22em] uppercase text-cream-dim mb-3">
            Subscription
          </p>
          <div className="metal-card rounded-2xl overflow-hidden">
            {/* Plan header */}
            <div className={`px-5 py-4 bg-gradient-to-br ${planInfo.gradient}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[0.6rem] font-bold tracking-[0.2em] uppercase mb-0.5"
                    style={{ color: planInfo.color, opacity: 0.75 }}>
                    Current plan
                  </p>
                  <p className="font-display text-2xl font-bold text-white">{planInfo.name}</p>
                  {planInfo.price && <p className="text-xs text-white/50 mt-0.5">{planInfo.price}</p>}
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${planInfo.color}18`, border: `1px solid ${planInfo.color}30` }}>
                  <span className="text-lg" style={{ color: planInfo.color }}>
                    {plan === 'free' ? '◎' : plan === 'family' ? '✿' : '☽'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-white/40 mt-2">{planInfo.limit}</p>
            </div>
            {/* Feature list */}
            <div className="px-5 py-4 space-y-2">
              {planInfo.features.map(f => (
                <div key={f} className="flex items-center gap-2.5 text-xs text-white/65">
                  <span className="text-gold/60">✓</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
            {/* Upgrade CTA */}
            {plan !== 'legacy' && (
              <div className="px-5 pb-5">
                <div className="sharp-divider mb-4" />
                <Link to="/premium"
                  className="flex items-center justify-between px-4 py-3 rounded-xl rubber-btn hover:opacity-90 transition-opacity">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {plan === 'free' ? 'Upgrade to Family' : 'Upgrade to Legacy'}
                    </p>
                    <p className="text-xs text-white/35">
                      {plan === 'free' ? 'Unlock voice cloning, vault & more' : 'Unlimited everything'}
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-gold flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ── RECENT MEMORIALS ──────────────────────────────────────────────── */}
        {memorials.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[0.6rem] font-bold tracking-[0.22em] uppercase text-cream-dim">Your memorials</p>
              <Link to="/dashboard" className="text-[0.65rem] text-gold/60 hover:text-gold transition-colors">
                View all →
              </Link>
            </div>
            <div className="space-y-2">
              {memorials.slice(0, 3).map(m => (
                <Link key={m.id} to={`/memorial/${m.id}`}
                  className="metal-card rounded-2xl p-4 flex items-center gap-3 hover:opacity-90 transition-opacity">
                  <div className="w-10 h-10 rounded-xl flex-shrink-0 overflow-hidden"
                    style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(56,189,248,0.10))' }}>
                    {m.photo
                      ? <img src={m.photo} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center font-display text-sm font-bold text-gold/60">
                          {m.name?.charAt(0)}
                        </div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{m.name}</p>
                    <p className="text-xs text-white/35">{m.tributes?.length || 0} tributes · {m.viewCount || 0} views</p>
                  </div>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${m.alive !== false ? 'bg-mint' : 'bg-gold/60'}`} />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── NOTIFICATIONS ────────────────────────────────────────────────── */}
        <div>
          <p className="text-[0.6rem] font-bold tracking-[0.22em] uppercase text-cream-dim mb-3">
            Notifications
          </p>
          <div className="metal-card rounded-2xl overflow-hidden">
            <ToggleRow
              icon="🎂"
              label="Anniversaries & birthdays"
              description="Get reminded of memorial anniversaries and birthdays"
              value={notifyAnniversaries}
              onChange={v => { setNotifyAnniversaries(v); toggleNotify('notifyAnniversaries', v) }}
            />
            <ToggleRow
              icon="💐"
              label="New tributes"
              description="When someone leaves a tribute on your memorials"
              value={notifyTributes}
              onChange={v => { setNotifyTributes(v); toggleNotify('notifyTributes', v) }}
            />
            <ToggleRow
              icon="👨‍👩‍👧"
              label="Family activity"
              description="When family members join or update profiles"
              value={notifyFamily}
              onChange={v => { setNotifyFamily(v); toggleNotify('notifyFamily', v) }}
            />
          </div>
        </div>

        {/* ── ACCOUNT SETTINGS ─────────────────────────────────────────────── */}
        <div>
          <p className="text-[0.6rem] font-bold tracking-[0.22em] uppercase text-cream-dim mb-3">
            Account
          </p>
          <div className="metal-card rounded-2xl overflow-hidden">
            <SettingsRow icon="👤" label="Your name" value={displayName}          onClick={() => setShowEditName(true)} />
            <SettingsRow
              icon={profile?.countryCode ? countryFlag(profile.countryCode) : '🌍'}
              label="Country"
              value={profile?.country || 'Not set'}
              onClick={() => setShowEditCountry(true)}
            />
            <SettingsRow icon="📧" label="Email address" value={user?.email}      onClick={() => {}} />
            <SettingsRow icon="🔒" label="Privacy settings"                       onClick={() => navigate('/settings')} />
            <SettingsRow icon="🌍" label="Language"         value="English"       onClick={() => {}} />
          </div>
        </div>

        {/* ── QUICK LINKS ───────────────────────────────────────────────────── */}
        <div>
          <p className="text-[0.6rem] font-bold tracking-[0.22em] uppercase text-cream-dim mb-3">
            Quick access
          </p>
          <div className="metal-card rounded-2xl overflow-hidden">
            <SettingsRow icon="✦" label="Create a memorial"            onClick={() => navigate('/create')} />
            <SettingsRow icon="✿" label="Family tree"                  onClick={() => navigate('/family-tree')} />
            <SettingsRow icon="☽" label="Legacy vault"                 onClick={() => navigate('/dashboard')} />
            <SettingsRow icon="◎" label="Explore memorials"            onClick={() => navigate('/explore')} />
            <SettingsRow icon="♕" label="Premium plans"                onClick={() => navigate('/premium')} badge="Upgrade" />
          </div>
        </div>

        {/* ── SUPPORT ───────────────────────────────────────────────────────── */}
        <div>
          <p className="text-[0.6rem] font-bold tracking-[0.22em] uppercase text-cream-dim mb-3">
            Support
          </p>
          <div className="metal-card rounded-2xl overflow-hidden">
            <SettingsRow icon="📄" label="Privacy Policy" onClick={() => navigate('/privacy')} />
            <SettingsRow icon="📋" label="Terms of Service" onClick={() => navigate('/terms')} />
            <SettingsRow icon="✉" label="Contact support" value="admin@whowasi.uk" onClick={() => {}} />
          </div>
        </div>

        {/* ── SIGN OUT + DANGER ZONE ────────────────────────────────────────── */}
        <div>
          <div className="metal-card rounded-2xl overflow-hidden">
            <button onClick={() => { if (confirmSignOut) { handleSignOut() } else { setConfirmSignOut(true); setTimeout(()=>setConfirmSignOut(false), 4000) } }}
              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/[0.03] transition-colors">
              <div className="w-8 h-8 rounded-xl bg-white/6 flex items-center justify-center text-base flex-shrink-0">
                {confirmSignOut ? '⚠' : '→'}
              </div>
              <span className={`text-sm font-medium transition-colors ${confirmSignOut ? 'text-rose' : 'text-white/70'}`}>
                {confirmSignOut ? 'Tap again to sign out' : 'Sign out'}
              </span>
            </button>
          </div>

          {/* Delete account */}
          <div className="metal-card rounded-2xl overflow-hidden mt-3"
            style={{ borderColor: 'rgba(251,113,133,0.15)' }}>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/[0.03] transition-colors text-rose/70">
                <div className="w-8 h-8 rounded-xl bg-rose/10 flex items-center justify-center text-base flex-shrink-0">
                  🗑
                </div>
                <div className="flex-1 text-left min-w-0">
                  <span className="text-sm font-medium">Delete account</span>
                  <p className="text-xs text-rose/40 mt-0.5">Permanently remove all data</p>
                </div>
              </button>
            ) : (
              <div className="px-5 py-4 space-y-3">
                <p className="text-xs text-rose/70 font-medium">
                  Are you sure? This will permanently delete all your memorials, tributes, and family data. This cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-medium rubber-btn text-white/50">
                    Cancel
                  </button>
                  <button onClick={handleDeleteAccount} disabled={deleting}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose/20 text-rose border border-rose/30 disabled:opacity-40">
                    {deleting ? 'Deleting…' : 'Yes, delete everything'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* App version */}
        <p className="text-center text-[0.55rem] text-white/15 pb-4">
          WHO WAS I · v1.0 · whowasi.uk
        </p>

      </div>

      {/* ── Edit name modal ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showEditName && (
          <EditNameModal
            profile={profile}
            onSave={saveName}
            onClose={() => setShowEditName(false)}
          />
        )}
        {showEditCountry && (
          <EditCountryModal
            current={profile?.countryCode}
            onSave={saveCountry}
            onClose={() => setShowEditCountry(false)}
          />
        )}
      </AnimatePresence>

    </div>
  )
}
