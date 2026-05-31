// src/pages/OnboardingPage.jsx
//
// Steps:
//   0 — Auth gate  (skipped when already signed in)
//   1 — Your name  (first name + last name — two fields)
//   2 — Who for    (self / other)
//   3 — First action (create / explore)
//
// Returning users (profile with firstName OR displayName already set) are
// detected on mount and immediately redirected to /dashboard without going
// through the steps again.
//
// After step 0 the localStorage flag `wwi_has_visited` is set.

import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { id } from '@instantdb/react'
import { db } from '../lib/instant'
import { COUNTRIES, countryFlag } from '../lib/countries'
import authBg from '../assets/auth-bg.webp'

const LS_KEY = 'wwi_onboarding_draft'

function saveDraft(data)  { try { localStorage.setItem(LS_KEY, JSON.stringify({ ...data, savedAt: Date.now() })) } catch {} }
function loadDraft()      { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null') } catch { return null } }
function clearDraft()     { try { localStorage.removeItem(LS_KEY) } catch {} }

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [obSearchParams] = useSearchParams()
  const obNext = (() => { const n = obSearchParams.get('next'); return n && n.startsWith('/') ? n : null })()
  const { user } = db.useAuth()

  const [step,        setStep]        = useState(null)   // null = determining
  const [firstName,   setFirstName]   = useState('')
  const [lastName,    setLastName]    = useState('')
  const [countryCode, setCountryCode] = useState('')     // ISO 2-letter
  const [countryName, setCountryName] = useState('')
  const [countrySearch, setCountrySearch] = useState('')
  const [intent,      setIntent]      = useState('')     // 'self' | 'other'
  const [action,      setAction]      = useState('create')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [checking,    setChecking]    = useState(false)  // checking existing profile

  // Filtered country list for search
  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase()
    if (!q) return COUNTRIES
    return COUNTRIES.filter(c => c.name.toLowerCase().includes(q))
  }, [countrySearch])

  // Inline auth state (step 0)
  const [authMode,    setAuthMode]    = useState('choice')  // 'choice' | 'email' | 'code'
  const [authEmail,   setAuthEmail]   = useState('')
  const [authCode,    setAuthCode]    = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError,   setAuthError]   = useState('')

  // ── Determine starting step ──────────────────────────────────────────────────
  useEffect(() => {
    if (step !== null) return
    if (!user) {
      // Not logged in — show auth gate
      setStep(0)
      return
    }
    // Logged in — check if they already have a profile
    setChecking(true)
    db.queryOnce({ profiles: { $: { where: { userId: user.id } } } })
      .then(({ data }) => {
        const profile = data?.profiles?.[0]
        const hasName = !!(profile?.firstName || profile?.displayName)
        if (hasName) {
          // Returning user — skip all steps, go straight to dashboard
          localStorage.setItem('wwi_has_visited', '1')
          if (profile && !profile.onboarded) {
            db.transact([db.tx.profiles[profile.id].update({ onboarded: true })]).catch(() => {})
          }
          navigate('/dashboard', { replace: true })
        } else {
          // New user already logged in — start at name step
          const draft = loadDraft()
          if (draft?.firstName) setFirstName(draft.firstName)
          if (draft?.lastName)  setLastName(draft.lastName)
          if (draft?.intent)    setIntent(draft.intent)
          if (draft?.action)    setAction(draft.action)
          setStep(1)
        }
      })
      .catch(() => setStep(1))
      .finally(() => setChecking(false))
  }, [user, step, navigate])

  // When user signs in mid-onboarding (step 0 → 1)
  useEffect(() => {
    if (user && step === 0) {
      localStorage.setItem('wwi_has_visited', '1')
      setStep(null)  // re-run the profile check above
    }
  }, [user, step])

  // Autosave draft
  useEffect(() => {
    if (step && step > 0) saveDraft({ firstName, lastName, step, intent, action })
  }, [firstName, lastName, step, intent, action])

  // ── Save profile to InstantDB ────────────────────────────────────────────────
  async function saveProgressToDB(partial = {}) {
    if (!user) return
    try {
      const { data } = await db.queryOnce({ profiles: { $: { where: { userId: user.id } } } })
      const existing  = data?.profiles?.[0]
      const profileId = existing?.id || id()
      const fullName  = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
      await db.transact([
        db.tx.profiles[profileId].update({
          userId:      user.id,
          firstName:   firstName.trim()  || partial.firstName,
          lastName:    lastName.trim()   || partial.lastName,
          displayName: fullName          || partial.displayName,
          country:     countryName       || partial.country,
          countryCode: countryCode       || partial.countryCode,
          onboarded:   false,
          createdAt:   existing?.createdAt || Date.now(),
          ...partial,
        })
      ])
    } catch {}
  }

  // ── Auth handlers ─────────────────────────────────────────────────────────────
  async function handleGuestSignIn() {
    setAuthLoading(true); setAuthError('')
    try {
      await db.auth.signInAsGuest()
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
      // useEffect above will detect user signed in and check their profile
    } catch (err) {
      setAuthError(err.message || 'Invalid code. Try again.')
    } finally {
      setAuthLoading(false)
    }
  }

  // ── Step navigation ──────────────────────────────────────────────────────────
  // Steps (for logged-in user): 1=Name, 2=Country, 3=Who for, 4=First action
  async function handleNext() {
    setError('')

    if (step === 1) {
      if (!firstName.trim()) { setError('Please enter your first name to continue.'); return }
      setSaving(true)
      await saveProgressToDB()
      setSaving(false)
      setStep(2)
      return
    }

    if (step === 2) {
      if (!countryCode) { setError('Please select your country to continue.'); return }
      setSaving(true)
      await saveProgressToDB()
      setSaving(false)
      setStep(3)
      return
    }

    if (step === 3) {
      if (!intent) { setError('Please choose one to continue.'); return }
      setStep(4)
      return
    }

    if (step === 4) {
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
        const fullName  = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
        await db.transact([
          db.tx.profiles[profileId].update({
            userId:      user.id,
            firstName:   firstName.trim()  || existing?.firstName  || 'Friend',
            lastName:    lastName.trim()   || existing?.lastName   || '',
            displayName: fullName          || existing?.displayName || firstName.trim() || 'Friend',
            country:     countryName       || existing?.country     || '',
            countryCode: countryCode       || existing?.countryCode || '',
            onboarded:   true,
            plan:        existing?.plan || 'free',
            intent:      intent || 'other',
            createdAt:   existing?.createdAt || Date.now(),
          })
        ])
      }

      localStorage.setItem('wwi_has_visited', '1')
      clearDraft()
      setSaving(false)

      // Resume a pending destination first (e.g. accepting a family invite).
      if (obNext) navigate(obNext, { replace: true })
      else if (action === 'create' && intent === 'self') navigate('/create?self=1')
      else if (action === 'create') navigate('/create')
      else navigate('/explore')
    } catch {
      setError('Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  function handleBack() { setStep(s => Math.max(user ? 1 : 0, s - 1)) }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (step === null || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#000' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
          <p className="text-brand text-xl">WHO WAS I</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden" style={{ background: '#000' }}>
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <img loading="lazy" decoding="async" src={authBg} alt="" aria-hidden className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.88) 100%)' }} />
      </div>

      <div className="w-full max-w-sm relative z-10">

        {/* Logo */}
        <div className="text-center mb-8">
          <p className="text-brand text-3xl">WHO WAS I</p>
          <p className="text-xs text-white/60 mt-1 tracking-widest uppercase">Living Memorials</p>
        </div>

        {/* Step dots — 4 steps after auth */}
        {step > 0 && (
          <div className="flex items-center gap-2 mb-8 justify-center">
            {Array.from({ length: 4 }).map((_, i) => {
              const cur = step - 1  // 0-indexed (step 1 → dot 0)
              return (
                <div key={i} className="flex items-center gap-2">
                  <div className={`transition-all rounded-full ${
                    i === cur ? 'w-8 h-2 bg-gold'
                    : i < cur ? 'w-4 h-2 bg-gold/40'
                    : 'w-4 h-2 bg-white/10'
                  }`} />
                  {i < 3 && <div className="w-3 h-px bg-white/10" />}
                </div>
              )
            })}
          </div>
        )}

        <AnimatePresence mode="wait">

          {/* ── STEP 0: Auth gate ──────────────────────────────────────────── */}
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

          {/* ── STEP 1: Name (first + last) ─────────────────────────────── */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity:0, x:24 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-24 }}>
              <h1 className="font-display text-3xl font-bold text-white mb-2">What's your name?</h1>
              <p className="text-sm text-white/60 mb-8 leading-relaxed">
                This is how you'll appear on memorials and tributes. We'll use your first name to greet you.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-[0.65rem] font-semibold tracking-wider uppercase text-white/40 mb-1.5 block">
                    First name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleNext()}
                    placeholder="e.g. Ada"
                    autoFocus
                    autoComplete="given-name"
                    className="w-full bg-zinc-900/90 border border-white/10 rounded-2xl px-5 py-4 text-base text-white placeholder-white/25 focus:outline-none focus:border-gold/40"
                  />
                </div>
                <div>
                  <label className="text-[0.65rem] font-semibold tracking-wider uppercase text-white/40 mb-1.5 block">
                    Last name <span className="text-white/25 normal-case tracking-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleNext()}
                    placeholder="e.g. Lovelace"
                    autoComplete="family-name"
                    className="w-full bg-zinc-900/90 border border-white/10 rounded-2xl px-5 py-4 text-base text-white placeholder-white/25 focus:outline-none focus:border-gold/40"
                  />
                </div>
              </div>
              {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
            </motion.div>
          )}

          {/* ── STEP 2: Country ─────────────────────────────────────────── */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity:0, x:24 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-24 }}>
              <h1 className="font-display text-3xl font-bold text-white mb-2">
                Where are you based{firstName ? `, ${firstName}` : ''}?
              </h1>
              <p className="text-sm text-white/60 mb-6 leading-relaxed">
                Your country appears as a flag on your memorials so visitors know where they're from.
              </p>

              {/* Search */}
              <input
                type="text"
                value={countrySearch}
                onChange={e => setCountrySearch(e.target.value)}
                placeholder="Search countries…"
                autoFocus
                className="w-full bg-zinc-900/90 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-gold/40 mb-3"
              />

              {/* Selected display */}
              {countryCode && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-800 border border-gold/30 mb-3">
                  <span className="text-2xl">{countryFlag(countryCode)}</span>
                  <span className="text-sm font-semibold text-white">{countryName}</span>
                  <button
                    onClick={() => { setCountryCode(''); setCountryName(''); setCountrySearch('') }}
                    className="ml-auto text-xs text-white/40 hover:text-white/70 transition-colors"
                  >✕ Change</button>
                </div>
              )}

              {/* Country list */}
              {!countryCode && (
                <div className="max-h-56 overflow-y-auto rounded-2xl bg-zinc-900/90 border border-white/10 divide-y divide-white/5">
                  {filteredCountries.length === 0 && (
                    <p className="px-5 py-4 text-sm text-white/30 text-center">No countries found</p>
                  )}
                  {filteredCountries.map(c => (
                    <button
                      key={c.code}
                      onClick={() => { setCountryCode(c.code); setCountryName(c.name); setCountrySearch('') }}
                      className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-white/5 transition-colors"
                    >
                      <span className="text-xl flex-shrink-0">{countryFlag(c.code)}</span>
                      <span className="text-sm text-white/80">{c.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
            </motion.div>
          )}

          {/* ── STEP 3: Who for ─────────────────────────────────────────── */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity:0, x:24 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-24 }}>
              <h1 className="font-display text-3xl font-bold text-white mb-2">
                Hi {firstName || 'there'} — who are you here for?
              </h1>
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

          {/* ── STEP 4: First action ─────────────────────────────────────── */}
          {step === 4 && (
            <motion.div key="s3" initial={{ opacity:0, x:24 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-24 }}>
              <h1 className="font-display text-3xl font-bold text-white mb-2">
                Welcome{firstName ? `, ${firstName}` : ''} ✦
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

        {/* CTA — only after auth step */}
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
                : step < 4 ? 'Continue →' : "Let's go ✦"
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
