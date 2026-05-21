// src/pages/JoinPage.jsx
// Handles /join?code=ABC123
// If a code is present: shows relationship claim flow + auto-redeems invite
// If no code: shows generic invite code entry

import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { id } from '@instantdb/react'
import { db } from '../lib/instant'
import RelationPicker from '../components/ui/RelationPicker'

export default function JoinPage() {
  const [searchParams] = useSearchParams()
  const navigate        = useNavigate()
  const { user, isLoading: authLoading } = db.useAuth()

  const codeFromUrl = searchParams.get('code')?.toUpperCase() || ''
  const [code,     setCode]     = useState(codeFromUrl)
  const [step,     setStep]     = useState(codeFromUrl ? 'relation' : 'code-entry')
  // step: 'code-entry' | 'relation' | 'submitting' | 'pending' | 'error'

  const [relation,    setRelation]    = useState('')
  const [claimerName, setClaimerName] = useState('')
  const [error,       setError]       = useState('')
  const [inviteData,  setInviteData]  = useState(null)   // { code, familyOwnerId, memorialId, ownerName }

  // Look up the invite code to find the memorial/owner
  useEffect(() => {
    if (!code || code.length < 6) return
    db.queryOnce({ invites: { $: { where: { code } } } }).then(({ data }) => {
      const inv = data?.invites?.[0]
      if (!inv) { setError('Invite code not found or expired.'); return }
      if (inv.used) { setError('This invite code has already been used.'); return }
      setInviteData(inv)
    }).catch(() => setError('Could not look up this code. Please try again.'))
  }, [code])

  // Pre-fill claimant name from profile if logged in
  useEffect(() => {
    if (!user) return
    db.queryOnce({ profiles: { $: { where: { userId: user.id } } } }).then(({ data }) => {
      const name = data?.profiles?.[0]?.displayName || ''
      if (name) setClaimerName(name)
    }).catch(() => {})
  }, [user])

  async function handleSubmitClaim() {
    if (!relation) { setError('Please choose how you are related.'); return }
    if (!user) {
      // Save intent and redirect to auth
      sessionStorage.setItem('wwi_pending_claim', JSON.stringify({ code, relation, claimerName }))
      navigate('/auth?next=/join?code=' + code)
      return
    }

    setStep('submitting')
    setError('')

    try {
      // Generate unique token for email verification link
      const token  = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
      const connId = id()

      await db.transact([
        db.tx.familyConnections[connId].update({
          fromUserId:   user.id,
          fromName:     claimerName || user.email?.split('@')[0] || 'Anonymous',
          fromEmail:    user.email  || '',
          toMemorialId: inviteData?.memorialId || '',
          toUserId:     inviteData?.familyOwnerId || '',
          relation,
          status:       'pending',
          verifyToken:  token,
          requestedAt:  Date.now(),
        }),
      ])

      // Notify memorial owner via email — consolidated endpoint
      fetch('/api/email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action:        'family-connection-request',
          token,
          claimerName:   claimerName || user.email?.split('@')[0] || 'A family member',
          claimerEmail:  user.email || '',
          relation,
          ownerUserId:   inviteData?.familyOwnerId || '',
          memorialId:    inviteData?.memorialId    || '',
          memorialName:  inviteData?.memorialName  || '',
        }),
      }).catch(() => {})

      setStep('pending')
    } catch {
      setError('Something went wrong. Please try again.')
      setStep('relation')
    }
  }

  if (authLoading) {
    return (
      <div className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-20">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >

        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="text-brand text-2xl font-display font-bold block mb-1">WHO WAS I</Link>
          <p className="text-[0.6rem] tracking-[0.28em] uppercase text-white/30">Family Circle</p>
        </div>

        <AnimatePresence mode="wait">

          {/* ── Step: Enter code manually ──────────────────────────────────── */}
          {step === 'code-entry' && (
            <motion.div key="code-entry" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              className="space-y-5">
              <div className="text-center">
                <h1 className="font-display text-2xl font-bold text-white mb-2">Join a family</h1>
                <p className="text-sm text-white/50">Enter the invite code you received</p>
              </div>
              <input
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="e.g.  ABC12345"
                maxLength={10}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-2xl font-mono font-bold text-white tracking-[0.2em] text-center focus:outline-none focus:border-gold/40"
              />
              {error && <p className="text-xs text-rose-400 text-center">{error}</p>}
              <button
                onClick={() => { if (code.length >= 6) setStep('relation') }}
                disabled={code.length < 6}
                className="w-full py-4 rounded-2xl text-sm font-bold text-black metal-btn disabled:opacity-40"
              >
                Continue →
              </button>
            </motion.div>
          )}

          {/* ── Step: Choose relationship ──────────────────────────────────── */}
          {step === 'relation' && (
            <motion.div key="relation" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              className="space-y-5">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gold/20 to-sky/20 border border-gold/20 flex items-center justify-center text-2xl mx-auto mb-4">✦</div>
                <h1 className="font-display text-xl font-bold text-white mb-2">
                  {inviteData?.memorialName
                    ? <>Joining <span className="text-gold">{inviteData.memorialName}</span>'s circle</>
                    : 'How are you related?'}
                </h1>
                <p className="text-sm text-white/50 leading-relaxed">
                  {inviteData?.memorialName
                    ? `Choose your relationship to ${inviteData.memorialName}. The family will confirm or correct it before adding you.`
                    : inviteData
                      ? 'Choose your relationship to the person who invited you.'
                      : 'Choose your relationship to the family you\'re joining.'}
                </p>
              </div>

              {/* Your name */}
              <div>
                <label className="block text-[0.6rem] font-bold tracking-[0.2em] uppercase text-white/40 mb-2">Your name</label>
                <input
                  value={claimerName}
                  onChange={e => setClaimerName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-gold/40"
                />
              </div>

              {/* Relation picker */}
              <div>
                <label className="block text-[0.6rem] font-bold tracking-[0.2em] uppercase text-white/40 mb-2">Relationship</label>
                <RelationPicker value={relation} onChange={setRelation} />
              </div>

              {error && <p className="text-xs text-rose-400 text-center">{error}</p>}

              {!user && (
                <div className="glass border border-white/10 rounded-2xl p-4 text-center">
                  <p className="text-xs text-white/50 mb-3">You'll need an account to connect with this family. Your connection request will be saved.</p>
                  <Link to={'/auth?next=/join?code=' + code}
                    className="text-xs font-bold text-gold hover:text-gold/70 transition-colors">
                    Sign in or create account →
                  </Link>
                </div>
              )}

              <button
                onClick={handleSubmitClaim}
                disabled={!relation}
                className="w-full py-4 rounded-2xl text-sm font-bold text-black metal-btn disabled:opacity-40"
              >
                Send connection request →
              </button>

              <button onClick={() => setStep('code-entry')}
                className="w-full py-3 text-xs text-white/30 hover:text-white/50 transition-colors">
                ← Back
              </button>
            </motion.div>
          )}

          {/* ── Step: Submitting ───────────────────────────────────────────── */}
          {step === 'submitting' && (
            <motion.div key="submitting" initial={{ opacity:0 }} animate={{ opacity:1 }}
              className="text-center py-12">
              <div className="w-10 h-10 border-2 border-gold/30 border-t-gold rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-white/50">Sending your request…</p>
            </motion.div>
          )}

          {/* ── Step: Pending approval ─────────────────────────────────────── */}
          {step === 'pending' && (
            <motion.div key="pending" initial={{ opacity:0, scale:.96 }} animate={{ opacity:1, scale:1 }}
              className="text-center space-y-5">
              <div className="text-5xl">✦</div>
              <h1 className="font-display text-2xl font-bold text-white">Request sent!</h1>
              <p className="text-sm text-white/55 leading-relaxed">
                Your connection request has been sent. The family member will receive an email to approve your request. Once approved, you'll be added to the family circle.
              </p>
              <div className="glass border border-white/10 rounded-2xl p-4">
                <p className="text-xs text-white/40">
                  ⏳ Family connections are verified by email. This protects everyone's privacy and ensures only genuine family members are added.
                </p>
              </div>
              <Link to="/explore"
                className="block w-full py-4 rounded-2xl text-sm font-bold text-black metal-btn text-center">
                Browse memorials →
              </Link>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  )
}
