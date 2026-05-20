// src/pages/OnboardingPage.jsx
// Every new visitor goes through this flow before using the app.
//
// Steps:
//   0 — Get started  (sign in with email  OR  continue as guest)
//       → skipped automatically when the user is already logged in
//   1 — Your name
//   2 — Who for  (self / other)
//   3 — First action  (create / explore)
//
// After step 0 the localStorage flag `wwi_has_visited` is set so the
// OnboardingGuard in App.jsx stops redirecting the visitor here.

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { id } from '@instantdb/react'
import { db } from '../lib/instant'
import authBg from '../assets/auth-bg.webp'

const LS_KEY = 'wwi_onboarding_draft'

function saveDraft(data)  { try { localStorage.setItem(LS_KEY, JSON.stringify({ ...data, savedAt: Date.now() })) } catch {} }
function loadDraft()      { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null') } catch { return null } }
function clearDraft()     { try { localStorage.removeItem(LS_KEY) } catch {} }

export default function OnboardingPage() {
  const navigate      = useNavigate()
  const { user }      = db.useAuth()

  // step 0 = auth gate (skipped when already signed in)
  const [step,        setStep]        = useState(null)   // null = not yet determined
  const [name,        setName]        = useState('')
  const [intent,      setIntent]      = useState('')     // 'self' | 'other'
  const [action,      setAction]      = useState('create')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  // inline auth state (used on step 0)
  const [authMode,    setAuthMode]    = useState('choice')  // 'choice' | 'email' | 'code'
  const [authEmail,   setAuthEmail]   = useState('')
  const [authCode,    setAuthCode]    = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError,   setAuthError]   = useState('')

  // ── Determine starting step on mount ──────────────────────────────────────
  useEffect(() => {
    if (step !== null) return   // already set
    const draft = loadDraft()
    if (user) {
      // Already logged in — skip auth step
      setStep(1)
      if (draft?.name)   setName(draft.name)
      if (draft?.intent) setIntent(draft.intent)
      if (draft?.action) setAction(draft.action)
    } else {
      // Not logged in — start at auth step
      setStep(0)
    }
  }, [user, step])

  // When user signs in mid-onboarding (step 0 → 1)
  useEffect(() => {
    if (user && step === 0) {
      localStorage.setItem('wwi_has_visited', '1')
      setStep(1)
    }
  }, [user, step])

  // Autosave draft
  useEffect(() => {
    if (step && step > 0) saveDraft({ name, step, intent, action })
  }, [name, step, intent, action])

  // ── Save progress to InstantDB ─────────────────────────────────────────────
  async function saveProgressToDB(partial = {}) {
    if (!user) return
    try {
      const { data } = await db.queryOnce({ profiles: { $: { where: { userId: user.id } } } })
      const existing  = data?.profiles?.[0]
      const profileId = existing?.id || id()
      await db.transact([
        db.tx.profiles[profileId].update({
          userId:      user.id,
          displayName: name.trim() || partial.displayName,
          onboarded:   false,
          createdAt:   existing?.createdAt || Date.now(),
          ...partial,
        })
      ])
    } catch {}
  }

  // ── Auth step handlers ─────────────────────────────────────────────────────
  async function handleGuestSignIn() {
    setAuthLoading(true); setAuthError('')
    try {
      await db.auth.signInAsGuest()
      // useEffect above will fire and advance to step 1
    } catch (err) {
      setAuthError(err.message || 'Could not continue as guest. Please try again.')
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleSendCode(e) {
    e.preventDefault()
    if (!authEmail.trim()) { setAuthError('Enter your email address.'); return }
    setAuthLoading(true); setAuthError('')
    try {
      await db.auth.sendMagicCode({ email: authEmail.trim() })
      setAuthMode('code')
    } catch (err) {
      setAuthError(err.message || 'Failed to send code. Try again.')
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleVerifyCode(e) {
    e.preventDefault()
    if (!authCode.trim()) { setAuthError('Enter the 6-digit code.'); return }
    setAuthLoading(true); setAuthError('')
    try {
      await db.auth.signInWithMagicCode({ email: authEmail.trim(), code: authCode.trim() })
      // useEffect above will fire and advance to step 1
    } catch (err) {
      setAuthError(err.message || 'Invalid code. Try again.')
    } finally {
      setAuthLoading(false)
    }
  }

  // ── Step navigation ────────────────────────────────────────────────────────
  async function handleNext() {
    setError('')

    if (step === 1) {
      if (!name.trim()) { setError('Please enter your name to continue.'); return }
      setSaving(true)
      await saveProgressToDB({ displayName: name.trim() })
      setSaving(false)
      setStep(2)
      return
    }

    if (step === 2) {
      if (!intent) { setError('Please choose one to continue.'); return }
      setStep(3)
      return
    }

    if (step === 3) {
      await completeOnboarding()
    }
  }

  async function completeOnboarding() {
    setSaving(true)
    try {
      if (user) {
        const { data } = await db.queryOnce({ profiles: { $: { where: { userId: user.id } } } })
        const existing  = data?.profiles?.[0]
        const profileId = existing?.id || id()
        await db.transact([
          db.tx.profiles[profileId].update({
            userId:      user.id,
            displayName: name.trim() || user.email?.split('@')[0] || 'Friend',
            onboarded:   true,
            plan:        'free',
            intent:      intent || 'other',
            createdAt:   existing?.createdAt || Date.now(),
          })
        ])
      }

      localStorage.setItem('wwi_has_visited', '1')
      clearDraft()
      setSaving(false)

      if (action === 'create' && intent === 'self') navigate('/create?self=1')
      else if (action === 'create') navigate('/create')
      else navigate('/explore')
    } catch {
      setError('Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  function handleBack() { setStep(s => Math.max(user ? 1 : 0, s - 1)) }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (step === null) return null   // still determining start step

  const TOTAL_STEPS = user ? 3 : 4  // 0 is the auth step (hidden for logged-in users)
  const displayStep = user ? step - 1 : step   // 0-indexed for dot indicator

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden" style={{ background: '#000' }}>
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <img src={authBg} alt="" aria-hidden className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.88) 100%)' }} />
      </div>

      <div className="w-full max-w-sm relative z-10">

        {/* Logo */}
        <div className="text-center mb-8">
          <p className="text-brand text-3xl">WHO WAS I</p>
          <p className="text-xs text-white/60 mt-1 tracking-widest uppercase">Living Memorials</p>
        </div>

        {/* Step dots — only shown after auth step */}
        {step > 0 && (
          <div className="flex items-center gap-2 mb-8 justify-center">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`transition-all rounded-full ${
                  i === displayStep - (user ? 1 : 1)
                    ? 'w-8 h-2 bg-gold'
                    : i < displayStep - (user ? 1 : 1)
                      ? 'w-4 h-2 bg-gold/40'
                      : 'w-4 h-2 bg-white/10'
                }`} />
                {i < 2 && <div className="w-3 h-px bg-white/10" />}
              </div>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">

          {/* ── STEP 0: Auth gate ─────────────────────────────────────── */}
          {step === 0 && (
            <motion.div key="s0" initial={{ opacity:0, x:24 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-24 }}>

              {authMode === 'choice' && (
                <>
                  <h1 className="font-display text-3xl font-bold text-white mb-2">Get started</h1>
                  <p className="text-sm text-white/60 mb-8 leading-relaxed">
                    Create an account to save and manage your memorials, or browse as a guest first.
                  </p>

                  {authError && <p className="text-xs text-red-400 mb-4 text-center">{authError}</p>}

                  <div className="space-y-3">
                    <button
                      onClick={() => { setAuthMode('email'); setAuthError('') }}
                      className="w-full py-4 rounded-2xl text-sm font-bold tracking-wide text-black metal-btn"
                    >
                      ✦ Sign in / Create account
                    </button>

                    <button
                      onClick={handleGuestSignIn}
                      disabled={authLoading}
                      className="w-full py-4 rounded-2xl text-sm font-semibold text-white/60 hover:text-white/80 bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-50"
                    >
                      {authLoading ? 'Loading…' : 'Continue as guest →'}
                    </button>
                  </div>

                  <p className="text-center text-[0.6rem] text-white/25 mt-6 leading-relaxed">
                    Guests can browse and explore. You'll be asked to create an account when you start building a memorial.
                  </p>
                </>
              )}

              {authMode === 'email' && (
                <>
                  <h1 className="font-display text-3xl font-bold text-white mb-2">Sign in</h1>
                  <p className="text-sm text-white/60 mb-8 leading-relaxed">
                    Enter your email — we'll send you a magic code. No password needed.
                  </p>
                  {authError && <p className="text-xs text-red-400 mb-3 text-center">{authError}</p>}
                  <form onSubmit={handleSendCode} className="space-y-3">
                    <input
                      type="email"
                      value={authEmail}
                      onChange={e => setAuthEmail(e.target.value)}
                      placeholder="your@email.com"
                      autoFocus
                      className="w-full bg-zinc-900/90 border border-white/10 rounded-2xl px-5 py-4 text-base text-white placeholder-white/25 focus:outline-none focus:border-gold/40"
                    />
                    <button type="submit" disabled={authLoading}
                      className="w-full py-4 rounded-2xl text-sm font-bold tracking-wide text-black metal-btn disabled:opacity-50">
                      {authLoading ? 'Sending…' : 'Send magic code →'}
                    </button>
                    <button type="button" onClick={() => { setAuthMode('choice'); setAuthError('') }}
                      className="w-full py-3 text-xs text-white/40 hover:text-white/60 transition-colors">
                      ← Back
                    </button>
                  </form>
                </>
              )}

              {authMode === 'code' && (
                <>
                  <h1 className="font-display text-3xl font-bold text-white mb-2">Check your email</h1>
                  <p className="text-sm text-white/60 mb-8 leading-relaxed">
                    We sent a 6-digit code to <span className="text-white font-semibold">{authEmail}</span>.
                  </p>
                  {authError && <p className="text-xs text-red-400 mb-3 text-center">{authError}</p>}
                  <form onSubmit={handleVerifyCode} className="space-y-3">
                    <input
                      type="text"
                      value={authCode}
                      onChange={e => setAuthCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                      placeholder="000000"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                      className="w-full bg-zinc-900/90 border border-white/10 rounded-2xl px-5 py-4 text-2xl text-white placeholder-white/25 focus:outline-none focus:border-gold/40 text-center tracking-[0.3em] font-mono"
                    />
                    <button type="submit" disabled={authLoading || authCode.length < 6}
                      className="w-full py-4 rounded-2xl text-sm font-bold tracking-wide text-black metal-btn disabled:opacity-50">
                      {authLoading ? 'Verifying…' : 'Verify & continue →'}
                    </button>
                    <button type="button" onClick={() => { setAuthMode('email'); setAuthCode(''); setAuthError('') }}
                      className="w-full py-3 text-xs text-white/40 hover:text-white/60 transition-colors">
                      ← Use a different email
                    </button>
                  </form>
                </>
              )}
            </motion.div>
          )}

          {/* ── STEP 1: Your name ────────────────────────────────────── */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity:0, x:24 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-24 }}>
              <h1 className="font-display text-3xl font-bold text-white mb-2">What's your name?</h1>
              <p className="text-sm text-white/60 mb-8 leading-relaxed">
                This is how you'll appear on memorials and tributes.
              </p>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleNext()}
                placeholder="Your full name"
                autoFocus
                className="w-full bg-zinc-900/90 border border-white/10 rounded-2xl px-5 py-4 text-base text-white placeholder-white/25 focus:outline-none focus:border-gold/40 mb-2"
              />
              {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
            </motion.div>
          )}

          {/* ── STEP 2: Who for ──────────────────────────────────────── */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity:0, x:24 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-24 }}>
              <h1 className="font-display text-3xl font-bold text-white mb-2">Who are you here for?</h1>
              <p className="text-sm text-white/60 mb-7 leading-relaxed">
                This shapes how your vault and legacy tools work.
              </p>
              <div className="space-y-3">
                {[
                  { id:'self',  emoji:'✦', title:'Myself — a living legacy',
                    desc:'Preserve your own voice, story, letters and will for family to read in time.' },
                  { id:'other', emoji:'♡', title:'Someone else — to honour them',
                    desc:'Build a memorial for someone you love. You manage their vault and archive.' },
                ].map(opt => (
                  <button key={opt.id} onClick={() => { setIntent(opt.id); setError('') }}
                    className={`w-full text-left p-4 rounded-2xl transition-all flex items-start gap-4 ${
                      intent === opt.id
                        ? 'bg-zinc-800 border border-gold/40 shadow-lg'
                        : 'bg-zinc-900/90 border border-white/10 hover:border-white/25 hover:bg-zinc-800'
                    }`}>
                    <span className="text-2xl flex-shrink-0 mt-0.5">{opt.emoji}</span>
                    <div>
                      <div className={`text-sm font-semibold ${intent===opt.id ? 'text-white' : 'text-white/70'}`}>{opt.title}</div>
                      <div className="text-xs text-white/50 mt-0.5 leading-relaxed">{opt.desc}</div>
                    </div>
                    {intent === opt.id && <span className="ml-auto text-gold flex-shrink-0">✓</span>}
                  </button>
                ))}
              </div>
              {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
            </motion.div>
          )}

          {/* ── STEP 3: First action ─────────────────────────────────── */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity:0, x:24 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-24 }}>
              <h1 className="font-display text-3xl font-bold text-white mb-2">
                Welcome{name ? `, ${name.split(' ')[0]}` : ''} ✦
              </h1>
              <p className="text-sm text-white/60 mb-7 leading-relaxed">What would you like to do first?</p>
              <div className="space-y-3">
                {[
                  { id:'create',  emoji:'✦', title:'Create a memorial',  desc:'Honour someone you love — add their story, voice, photos.' },
                  { id:'explore', emoji:'◎', title:'Explore memorials',  desc:'Discover and connect with other living memorials.' },
                ].map(opt => (
                  <button key={opt.id} onClick={() => setAction(opt.id)}
                    className={`w-full text-left p-4 rounded-2xl transition-all flex items-start gap-4 ${
                      action === opt.id
                        ? 'bg-zinc-800 border border-gold/40 shadow-lg'
                        : 'bg-zinc-900/90 border border-white/10 hover:border-white/25 hover:bg-zinc-800'
                    }`}>
                    <span className="text-2xl flex-shrink-0 mt-0.5">{opt.emoji}</span>
                    <div>
                      <div className={`text-sm font-semibold ${action===opt.id ? 'text-white' : 'text-white/70'}`}>{opt.title}</div>
                      <div className="text-xs text-white/50 mt-0.5 leading-relaxed">{opt.desc}</div>
                    </div>
                    {action === opt.id && <span className="ml-auto text-gold flex-shrink-0">✓</span>}
                  </button>
                ))}
              </div>
              {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
            </motion.div>
          )}

        </AnimatePresence>

        {/* CTA buttons — only shown after auth step */}
        {step > 0 && (
          <div className="mt-8 space-y-3">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleNext}
              disabled={saving}
              className="w-full py-4 rounded-2xl text-sm font-bold tracking-wide text-black metal-btn disabled:opacity-50"
            >
              {saving
                ? <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-black/20 border-t-black/70 rounded-full animate-spin" />
                    Saving…
                  </span>
                : step < 3 ? 'Continue →' : "Let's go ✦"
              }
            </motion.button>

            {step > 1 && (
              <button onClick={handleBack}
                className="w-full py-3 rounded-2xl text-sm text-white/60 hover:text-white/80 transition-colors">
                ← Back
              </button>
            )}
          </div>
        )}

        <p className="text-center text-[0.55rem] mt-6 tracking-wide" style={{ color: 'rgba(255,255,255,0.25)' }}>
          {step === 0 ? 'No account required to browse.' : '↓ Progress saved automatically'}
        </p>
      </div>
    </div>
  )
}
