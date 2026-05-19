// src/pages/OnboardingPage.jsx
// Autosave at every step — persists to localStorage + InstantDB.
// If user closes the tab or connection drops, progress is fully restored.
// Gate: route guard in App.jsx already blocks access until onboarded=true.

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { id } from '@instantdb/react'
import { db } from '../lib/instant'
import { redeemInvite } from '../lib/invites'
import authBg from '../assets/auth-bg.webp'

const LS_KEY = 'wwi_onboarding_draft'
const STEPS  = ['Your name', 'Create first memorial', 'Invite family']

// ─── Autosave helpers ─────────────────────────────────────────────────────────

function saveDraft(data) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ ...data, savedAt: Date.now() })) } catch {}
}
function loadDraft() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null') } catch { return null }
}
function clearDraft() {
  try { localStorage.removeItem(LS_KEY) } catch {}
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const navigate        = useNavigate()
  const { user }        = db.useAuth()

  const [step,     setStep]     = useState(0)
  const [name,     setName]     = useState('')
  const [action,   setAction]   = useState('create')   // 'create' | 'explore' | 'import'
  const [inviteCode, setInviteCode] = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [restored, setRestored] = useState(false)

  // ── Load draft on mount ────────────────────────────────────────────────────
  useEffect(() => {
    const draft = loadDraft()
    if (draft?.name) {
      setName(draft.name)
      if (draft.step > 0) {
        setStep(Math.min(draft.step, 1))  // don't skip past step 1
        setRestored(true)
      }
      if (draft.action) setAction(draft.action)
    }
  }, [])

  // ── Autosave whenever inputs change ───────────────────────────────────────
  useEffect(() => {
    saveDraft({ name, step, action })
  }, [name, step, action])

  // ── Also save profile to InstantDB at each step ───────────────────────────
  // So if they close the tab after step 1, they resume with their name saved
  async function saveProgressToDB(partial = {}) {
    if (!user) return
    try {
      // Upsert profile with partial data — onboarded stays false until complete
      const { data } = await db.queryOnce({ profiles: { $: { where: { userId: user.id } } } })
      const existing = data?.profiles?.[0]
      const profileId = existing?.id || id()
      await db.transact([
        db.tx.profiles[profileId].update({
          userId:     user.id,
          displayName: name.trim() || partial.displayName,
          onboarded:  false,    // stays false until final step
          createdAt:  existing?.createdAt || Date.now(),
          ...partial,
        })
      ])
    } catch {}  // non-blocking
  }

  // ── Step navigation ────────────────────────────────────────────────────────
  async function handleNext() {
    setError('')

    if (step === 0) {
      if (!name.trim()) { setError('Please enter your name to continue.'); return }
      setSaving(true)
      await saveProgressToDB({ displayName: name.trim() })
      setSaving(false)
      setStep(1)
      return
    }

    if (step === 1) {
      setStep(2)
      return
    }

    // ── Final step — complete onboarding ──────────────────────────────────
    await completeOnboarding()
  }

  async function completeOnboarding() {
    setSaving(true)
    try {
      if (user) {
        const { data } = await db.queryOnce({ profiles: { $: { where: { userId: user.id } } } })
        const existing = data?.profiles?.[0]
        const profileId = existing?.id || id()

        await db.transact([
          db.tx.profiles[profileId].update({
            userId:      user.id,
            displayName: name.trim(),
            onboarded:   true,
            plan:        'free',
            createdAt:   existing?.createdAt || Date.now(),
          })
        ])
      }

      // ── Redeem invite code if provided ──────────────────────────────
      if (inviteCode.trim() && user) {
        const result = await redeemInvite(inviteCode.trim(), user)
        if (!result.ok) {
          // Non-blocking: show a toast but still complete onboarding
          console.warn('Invite redemption:', result.reason)
        }
      }

      clearDraft()
      setSaving(false)

      if (action === 'create') navigate('/create')
      else if (action === 'import') navigate('/explore')
      else navigate('/dashboard')

    } catch (err) {
      setError('Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  function handleBack() { setStep(s => Math.max(0, s - 1)) }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden" style={{ background: '#000' }}>
      {/* Background image with gradient overlay — brighter top, darker bottom */}
      <div className="absolute inset-0 pointer-events-none">
        <img
          src={authBg}
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.88) 100%)' }} />
      </div>
      <div className="w-full max-w-sm relative z-10">

        {/* Restored banner */}
        <AnimatePresence>
          {restored && (
            <motion.div
              initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
              className="glass rounded-xl px-4 py-3 mb-5 flex items-center gap-3 border border-gold/20"
            >
              <span className="text-gold text-sm flex-shrink-0">↩</span>
              <p className="text-xs text-white/70">Welcome back — we saved your progress.</p>
              <button onClick={() => setRestored(false)} className="ml-auto text-white/30 hover:text-white/60 text-xs">✕</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Logo */}
        <div className="text-center mb-8">
          <p className="text-brand text-3xl">WHO WAS I</p>
          <p className="text-xs text-white/60 mt-1 tracking-widest uppercase">Living Memorials</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`transition-all rounded-full ${
                i === step ? 'w-8 h-2 bg-gold' : i < step ? 'w-4 h-2 bg-gold/40' : 'w-4 h-2 bg-white/10'
              }`} />
              {i < STEPS.length - 1 && <div className="w-3 h-px bg-white/10" />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ── STEP 0: Your name ─────────────────────────────────────── */}
          {step === 0 && (
            <motion.div key="s0" initial={{ opacity:0,x:24 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-24 }}>
              <h1 className="font-display text-3xl font-bold text-white mb-2">What's your name?</h1>
              <p className="text-sm text-white/70 mb-8 leading-relaxed">
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
              {error && <p className="text-xs text-rose mt-2">{error}</p>}
            </motion.div>
          )}

          {/* ── STEP 1: First action ──────────────────────────────────── */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity:0,x:24 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-24 }}>
              <h1 className="font-display text-3xl font-bold text-white mb-2">
                Welcome, {name.split(' ')[0]} ✦
              </h1>
              <p className="text-sm text-white/70 mb-7 leading-relaxed">
                What would you like to do first?
              </p>
              <div className="space-y-3">
                {[
                  { id:'create',  emoji:'✦', title:'Create a memorial',    desc:'Honour someone you love — add their story, voice, photos.' },
                  { id:'explore', emoji:'◎', title:'Explore memorials',    desc:'Discover and connect with other living memorials.' },
                  { id:'import',  emoji:'📱', title:'Import from social media', desc:'Bring in photos and memories from Facebook or Instagram.' },
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
            </motion.div>
          )}

          {/* ── STEP 2: Invite (optional) ────────────────────────────── */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity:0,x:24 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-24 }}>
              <h1 className="font-display text-3xl font-bold text-white mb-2">Invite your family</h1>
              <p className="text-sm text-white/70 mb-7 leading-relaxed">
                Have an invite code from a family member? Enter it to connect to their family archive.
                You can also skip this and invite others later.
              </p>
              <input
                type="text"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                placeholder="Enter invite code (optional)"
                className="w-full bg-zinc-900/90 border border-white/10 rounded-2xl px-5 py-4 text-base text-white placeholder-white/25 focus:outline-none focus:border-gold/40 mb-3 tracking-widest font-mono"
                maxLength={8}
              />
              <p className="text-xs text-white/50 text-center">Leave empty to skip — you can always join a family later.</p>
            </motion.div>
          )}

        </AnimatePresence>

        {/* CTA buttons */}
        <div className="mt-8 space-y-3">
          <motion.button
            whileTap={{ scale:0.97 }}
            onClick={handleNext}
            disabled={saving}
            className="w-full py-4 rounded-2xl text-sm font-bold tracking-wide text-black metal-btn disabled:opacity-50"
          >
            {saving
              ? <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-black/20 border-t-black/70 rounded-full animate-spin" />
                  Saving…
                </span>
              : step < STEPS.length - 1 ? 'Continue →' : "Let's go ✦"
            }
          </motion.button>

          {step > 0 && (
            <button onClick={handleBack}
              className="w-full py-3 rounded-2xl text-sm text-white/60 hover:text-white/80 transition-colors">
              ← Back
            </button>
          )}

          {step === 2 && (
            <button onClick={async () => {
              setSaving(true);
              try { await completeOnboarding(); } catch {}
              finally { setSaving(false); }
            }}
              className="w-full py-2 text-xs text-white/50 hover:text-white/70 transition-colors">
              Skip for now
            </button>
          )}
        </div>

        {/* Progress save indicator — glowing animation */}
        <p className="text-center text-[0.55rem] mt-6 tracking-wide animate-pulse" style={{ color: 'rgba(255,255,255,0.4)', textShadow: '0 0 8px rgba(255,255,255,0.15)' }}>
          ↓ Progress saved automatically
        </p>

      </div>
    </div>
  )
}
