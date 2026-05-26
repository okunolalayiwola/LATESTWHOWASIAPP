// src/components/ui/EmailChangeModal.jsx
// Two-step modal for changing the account email.
//
// Step 1: user enters new email → POST /api/email change-email-send
//         server stores hashed code on profile + emails the code to NEW address
// Step 2: user enters the 6-digit code → POST /api/email change-email-verify
//         server updates $users.email via admin SDK
//
// Once verified, future logins, vault PIN resets, and notifications all go
// to the new address. The user remains signed in — the token is bound to the
// userId, not the email.

import { useState } from 'react'
import { motion } from 'framer-motion'

export default function EmailChangeModal({ user, currentEmail, onClose, onSuccess }) {
  const [step,     setStep]     = useState(1)         // 1 = enter email, 2 = enter code
  const [newEmail, setNewEmail] = useState('')
  const [code,     setCode]     = useState('')
  const [working,  setWorking]  = useState(false)
  const [error,    setError]    = useState('')

  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail.trim())

  async function handleSendCode() {
    setError('')
    if (!validEmail) { setError('Enter a valid email address.'); return }
    if (newEmail.trim().toLowerCase() === (currentEmail || '').toLowerCase()) {
      setError("That's already your email."); return
    }
    setWorking(true)
    try {
      const r = await fetch('/api/email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action:   'change-email-send',
          userId:   user.id,
          newEmail: newEmail.trim().toLowerCase(),
        }),
      })
      const data = await r.json()
      if (!r.ok || data.error) {
        setError(data.error || 'Could not send the code. Try again.')
      } else {
        setStep(2)
      }
    } catch {
      setError('Network error. Try again.')
    } finally {
      setWorking(false)
    }
  }

  async function handleVerifyCode() {
    setError('')
    if (!/^\d{6}$/.test(code.trim())) { setError('The code is 6 digits.'); return }
    setWorking(true)
    try {
      const r = await fetch('/api/email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action: 'change-email-verify',
          userId: user.id,
          code:   code.trim(),
        }),
      })
      const data = await r.json()
      if (!r.ok || data.error) {
        setError(data.error || 'Could not verify. Check the code and try again.')
      } else {
        if (onSuccess) onSuccess(data.newEmail || newEmail.trim().toLowerCase())
        onClose()
      }
    } catch {
      setError('Network error. Try again.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="dark-container fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d0d] border-t border-white/10 rounded-t-3xl px-5 pt-4 pb-10"
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />

        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-display text-xl font-bold text-white">
              {step === 1 ? 'Change email' : 'Confirm the code'}
            </h3>
            <p className="text-[0.65rem] text-white/40 mt-0.5">
              Step {step} of 2
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full glass border border-white/10 flex items-center justify-center text-white/50 hover:text-white text-sm">✕</button>
        </div>

        {step === 1 ? (
          <>
            <p className="text-xs text-white/55 leading-relaxed mb-4">
              Enter your new email below. We'll send a 6-digit code there to confirm
              you own it. Once verified, this becomes the email used for sign-in,
              vault PIN resets, and all notifications.
            </p>
            <div className="mb-3">
              <p className="text-[0.6rem] font-bold tracking-widest uppercase text-cream-dim mb-1.5">Current</p>
              <div className="glass rounded-xl px-4 py-2.5 text-sm text-white/50">{currentEmail}</div>
            </div>
            <div className="mb-4">
              <p className="text-[0.6rem] font-bold tracking-widest uppercase text-cream-dim mb-1.5">New email</p>
              <input
                autoFocus
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && validEmail && handleSendCode()}
                placeholder="you@example.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-gold/40 transition-colors"
              />
            </div>
            {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">{error}</p>}
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm text-white/50 glass border border-white/10 hover:text-white transition-colors">Cancel</button>
              <button
                onClick={handleSendCode}
                disabled={!validEmail || working}
                className="flex-[2] py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-gold to-sky text-black hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
              >
                {working && <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
                {working ? 'Sending…' : 'Send code'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-white/55 leading-relaxed mb-4">
              We sent a 6-digit code to <strong className="text-white">{newEmail}</strong>.
              Enter it below to confirm the change. The code expires in 15 minutes.
            </p>
            <div className="mb-4">
              <p className="text-[0.6rem] font-bold tracking-widest uppercase text-cream-dim mb-1.5">Verification code</p>
              <input
                autoFocus
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={e => e.key === 'Enter' && code.length === 6 && handleVerifyCode()}
                placeholder="000000"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-2xl font-mono text-white placeholder-white/15 text-center tracking-[0.6em] focus:outline-none focus:border-gold/40 transition-colors"
              />
            </div>
            {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">{error}</p>}
            <div className="flex gap-3 mb-3">
              <button onClick={() => { setStep(1); setCode(''); setError('') }} className="flex-1 py-3 rounded-xl text-sm text-white/50 glass border border-white/10 hover:text-white transition-colors">Back</button>
              <button
                onClick={handleVerifyCode}
                disabled={code.length !== 6 || working}
                className="flex-[2] py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-gold to-sky text-black hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
              >
                {working && <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
                {working ? 'Confirming…' : 'Confirm change'}
              </button>
            </div>
            <button
              onClick={handleSendCode}
              disabled={working}
              className="w-full text-[0.7rem] text-gold/60 hover:text-gold font-semibold py-1 transition-colors disabled:opacity-40"
            >
              Didn't get it? Send a new code
            </button>
          </>
        )}
      </motion.div>
    </>
  )
}
