// src/pages/AuthPage.jsx
// Sign-in / create-account page.
//
// After successful sign-in:
//   • Returning user (profile with displayName exists) → /dashboard immediately
//   • New user (no profile yet) → /onboarding
//
// This prevents returning users from being shown the onboarding questions again.

import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '../lib/instant'

export default function AuthPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // Where to land after auth (e.g. resuming a /join?code=… invite). Only allow
  // internal paths.
  const rawNext = searchParams.get('next')
  const next = rawNext && rawNext.startsWith('/') ? rawNext : null
  const [email,   setEmail]   = useState('')
  const [code,    setCode]    = useState('')
  const [step,    setStep]    = useState('email') // 'email' | 'code'
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  // After auth, check if this user has already been onboarded
  async function routeAfterSignIn(userId) {
    try {
      const { data } = await db.queryOnce({
        profiles: { $: { where: { userId } } }
      })
      const profile = data?.profiles?.[0]
      const isOnboarded = profile?.onboarded === true || !!(profile?.firstName || profile?.displayName)
      if (isOnboarded) {
        // Mark as visited so the guard never re-triggers onboarding
        localStorage.setItem('wwi_has_visited', '1')
        // Persist onboarded flag in case it was missing
        if (profile && !profile.onboarded) {
          try {
            await db.transact([db.tx.profiles[profile.id].update({ onboarded: true })])
          } catch {}
        }
        navigate(next || '/dashboard', { replace: true })
      } else {
        // New user must onboard first — carry `next` through so they resume
        // (e.g. finish accepting a family invite) once onboarding completes.
        navigate(next ? `/onboarding?next=${encodeURIComponent(next)}` : '/onboarding', { replace: true })
      }
    } catch {
      // Fallback: honour next, else dashboard
      navigate(next || '/dashboard', { replace: true })
    }
  }

  async function handleSendCode(e) {
    e.preventDefault()
    setError('')
    if (!email.trim()) { setError('Please enter your email address.'); return }
    setLoading(true)
    try {
      const result = await db.auth.sendMagicCode({ email: email.trim() })
      if (result?.error) throw new Error(result.error.message || 'Failed to send code')
      setStep('code')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyCode(e) {
    e.preventDefault()
    setError('')
    if (!code.trim()) { setError('Please enter the code sent to your email.'); return }
    setLoading(true)
    try {
      const result = await db.auth.signInWithMagicCode({ email: email.trim(), code: code.trim() })
      if (result?.error) throw new Error(result.error.message || 'Invalid code')
      // result.user is the signed-in user
      await routeAfterSignIn(result.user?.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleBack() { setStep('email'); setCode(''); setError('') }

  return (
    <div className="dark-container relative z-10 min-h-screen flex items-center justify-center px-6 pt-20 pb-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold to-sky mx-auto mb-4" />
          <h1 className="text-2xl font-display font-bold">
            {step === 'email' ? 'Sign in or create account' : 'Check your email'}
          </h1>
          <p className="text-sm text-white/50 mt-1">
            {step === 'email'
              ? 'Enter your email — we\'ll recognise you automatically.'
              : `We sent a 6-digit code to ${email}`}
          </p>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-400 text-center"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form card */}
        <div className="glass-strong rounded-2xl p-8">
          <AnimatePresence mode="wait">
            {step === 'email' ? (
              <motion.form
                key="email-step"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleSendCode}
              >
                <div className="mb-6">
                  <label className="text-[0.65rem] font-semibold tracking-wider uppercase text-white/40 mb-2 block">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-gold/40 transition-colors"
                    required
                    autoFocus
                    autoComplete="email"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-gold to-sky text-black font-semibold text-sm tracking-wider py-3 rounded-xl hover:scale-[1.02] transition-transform shadow-lg shadow-gold/20 mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading
                    ? <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        Sending code…
                      </span>
                    : 'Send magic code'}
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setLoading(true)
                    setError('')
                    try {
                      const result = await db.auth.signInAsGuest()
                      if (result?.error) throw new Error(result.error.message || 'Guest sign in failed')
                      navigate('/dashboard')
                    } catch (err) {
                      setError(err.message)
                    } finally {
                      setLoading(false)
                    }
                  }}
                  disabled={loading}
                  className="w-full bg-white/5 border border-white/10 text-white/50 hover:text-white/70 font-medium text-sm py-3 rounded-xl hover:bg-white/10 transition-all disabled:opacity-50"
                >
                  Continue as guest
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="code-step"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleVerifyCode}
              >
                <div className="mb-2">
                  <label className="text-[0.65rem] font-semibold tracking-wider uppercase text-white/40 mb-2 block">
                    Magic code
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-gold/40 transition-colors text-center text-2xl tracking-[0.3em] font-mono"
                    required
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                </div>
                <p className="text-[0.6rem] text-white/30 text-center mb-6">
                  Enter the 6-digit code sent to {email}
                </p>

                <button
                  type="submit"
                  disabled={loading || code.length < 6}
                  className="w-full bg-gradient-to-r from-gold to-sky text-black font-semibold text-sm tracking-wider py-3 rounded-xl hover:scale-[1.02] transition-transform shadow-lg shadow-gold/20 mb-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading
                    ? <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        Verifying…
                      </span>
                    : 'Sign in'}
                </button>

                <button
                  type="button"
                  onClick={handleBack}
                  className="w-full text-xs text-white/40 hover:text-white/70 transition-colors py-2"
                >
                  ← Use a different email
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center mt-6 text-[0.55rem] text-white/20">
          By continuing, you agree to our{' '}
          <Link to="/terms" className="underline">Terms</Link> and{' '}
          <Link to="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </motion.div>
    </div>
  )
}
