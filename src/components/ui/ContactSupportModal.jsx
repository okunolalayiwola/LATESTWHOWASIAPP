// src/components/ui/ContactSupportModal.jsx
// Support modal — opens from Profile → Contact support.
//
// Layout:
//   1. FAQ accordion at the top — covers the most common questions so
//      most users find their answer without sending a message.
//   2. "Still need help?" form below — subject + message, sends to
//      admin@whowasi.uk via /api/email contact-support action.
//
// Common entry points (the FAQ list) — vault access after death,
// login issues, abuse reporting, portrait quality, missing emails,
// family relation claims, billing.

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const FAQS = [
  {
    icon: '🔒',
    q:    'A family member has died and their vault access is restricted',
    a: (
      <>
        <p className="mb-2">
          When someone passes away, the family can request the Legacy Vault PIN
          they set up — but only if you can prove your relationship to them.
        </p>
        <p className="mb-2"><strong>To request access:</strong></p>
        <ol className="list-decimal pl-5 space-y-1 text-white/55">
          <li>Open the memorial page and tap the Vault → "Forgot PIN".</li>
          <li>Enter the email on the deceased's account. We send a 6-digit code there.</li>
          <li>If you can't access that email, send us a message below with the memorial
            link, your relationship, and a copy of the death certificate. We'll verify
            and reset access within 1–3 working days.</li>
        </ol>
      </>
    ),
  },
  {
    icon: '🔑',
    q:    "I can't log in / I'm not receiving the magic code",
    a: (
      <>
        <p className="mb-2">A few quick checks:</p>
        <ul className="list-disc pl-5 space-y-1 text-white/55">
          <li>Check your <strong>spam / junk folder</strong> — Gmail and Outlook sometimes filter login codes.</li>
          <li>Make sure you typed your email exactly as you signed up. Codes go to that
            specific address.</li>
          <li>Wait 30–60 seconds — sometimes the code arrives a moment after the request.</li>
          <li>Try requesting another code — old ones expire after 15 minutes.</li>
        </ul>
        <p className="mt-2">Still nothing? Message us below with the email you're using
        and we'll dig into the email logs.</p>
      </>
    ),
  },
  {
    icon: '⚠',
    q:    'I want to report abuse or harmful content',
    a: (
      <>
        <p className="mb-2">
          We take reports seriously. Memorial content is a sacred space and we remove
          anything that violates our community standards (harassment, hate, impersonation,
          stolen identity, spam, threats).
        </p>
        <p className="mb-2"><strong>To report:</strong></p>
        <ul className="list-disc pl-5 space-y-1 text-white/55">
          <li>For a specific <strong>tribute</strong>: open it and tap the three-dot menu → Report.</li>
          <li>For an entire <strong>memorial</strong> or someone's behaviour: message us below
            with the memorial link, what's wrong, and any screenshots.</li>
          <li>Urgent or threatening content: include "URGENT" in the subject and we'll
            triage within hours.</li>
        </ul>
      </>
    ),
  },
  {
    icon: '✦',
    q:    "The talk-with portrait doesn't look like them",
    a: (
      <>
        <p className="mb-2">
          The portrait is drawn from the 5 face photos you uploaded. If it doesn't capture
          them well:
        </p>
        <ol className="list-decimal pl-5 space-y-1 text-white/55">
          <li>Open the memorial → Edit → Talk-with portrait.</li>
          <li>Tap <strong>↻ Regenerate</strong> to try again with the same photos.</li>
          <li>Or upload different face photos — clearer light, different angles, eyes visible,
            face filling the frame. Photos rejected on upload aren't usable references.</li>
        </ol>
      </>
    ),
  },
  {
    icon: '✉',
    q:    "I'm not receiving emails from WHO WAS I",
    a: (
      <>
        <p className="mb-2">Our emails come from <strong>admin@whowasi.uk</strong> and{' '}
          <strong>noreply@whowasi.uk</strong>. To stop them landing in spam:</p>
        <ul className="list-disc pl-5 space-y-1 text-white/55">
          <li>Mark a WHO WAS I email as "Not spam" if you find one in the junk folder.</li>
          <li>Add <strong>admin@whowasi.uk</strong> to your contacts.</li>
          <li>If you're on a work email, your IT may be blocking us — try a personal email.</li>
        </ul>
        <p className="mt-2">Still no luck? Message us below and we'll check our delivery logs.</p>
      </>
    ),
  },
  {
    icon: '👨‍👩‍👧',
    q:    'A family member is claiming to be related — should I approve?',
    a: (
      <>
        <p className="mb-2">
          When someone requests to join your family circle, we send you their name, email,
          and the relationship they claim. Before approving:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-white/55">
          <li>Recognise the email? If yes, approve.</li>
          <li>Not sure? Tap <strong>Review</strong> on the email — you can suggest a different
            relationship label or decline.</li>
          <li>Someone you don't know at all? Decline. They lose nothing — they just can't
            access private family content.</li>
        </ul>
        <p className="mt-2">Approved family members can leave tributes, send messages, and
          view shared vault documents — so only approve people you trust.</p>
      </>
    ),
  },
  {
    icon: '💳',
    q:    'Billing or subscription questions',
    a: (
      <>
        <p className="mb-2">For anything billing-related:</p>
        <ul className="list-disc pl-5 space-y-1 text-white/55">
          <li><strong>Cancel a subscription:</strong> Profile → Premium plans → Manage.</li>
          <li><strong>Refund or unexpected charge:</strong> message us below with the date
            and amount. Refunds within 14 days of payment for unused accounts.</li>
          <li><strong>Change plan:</strong> Profile → Premium plans.</li>
          <li><strong>Update payment method:</strong> Open the link in your last receipt
            email, or message us.</li>
        </ul>
      </>
    ),
  },
]

function FaqItem({ item, isOpen, onToggle }) {
  return (
    <div className="border-b border-white/5 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] transition-colors"
      >
        <span className="text-base flex-shrink-0">{item.icon}</span>
        <span className="text-sm text-white flex-1 leading-snug">{item.q}</span>
        <span className={`text-white/30 text-sm flex-shrink-0 transition-transform ${isOpen ? 'rotate-45' : ''}`}>+</span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 text-xs text-white/65 leading-relaxed">
              {item.a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function ContactSupportModal({ user, profile, onClose }) {
  const [openFaq, setOpenFaq] = useState(null)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')

  const fromEmail = user?.email || ''
  const fromName  = profile?.displayName || ''

  async function handleSend() {
    setError('')
    if (!subject.trim()) { setError('Please add a subject.'); return }
    if (!message.trim()) { setError('Please write your message.'); return }
    setSending(true)
    try {
      const r = await fetch('/api/email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action: 'contact-support',
          fromEmail,
          fromName,
          subject: subject.trim(),
          message: message.trim(),
          userId: user?.id,
        }),
      })
      const data = await r.json()
      if (!r.ok || data.error) {
        setError(data.error || 'Could not send. Try again in a moment.')
      } else {
        setSent(true)
      }
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setSending(false)
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
        transition={{ type: 'spring', damping: 30, stiffness: 280 }}
        className="dark-container fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d0d] border-t border-white/10 rounded-t-3xl flex flex-col"
        style={{ maxHeight: '92vh' }}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />

        {/* Header */}
        <div className="px-5 pt-3 pb-4 flex items-center justify-between flex-shrink-0 border-b border-white/5">
          <div>
            <h3 className="font-display text-xl font-bold text-white">Help & support</h3>
            <p className="text-[0.65rem] text-white/40 mt-0.5">Most answers are in the FAQ below</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full glass border border-white/10 flex items-center justify-center text-white/50 hover:text-white text-sm">✕</button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* FAQ accordion */}
          <div>
            <p className="text-[0.6rem] font-bold tracking-[0.22em] uppercase text-cream-dim mb-3">
              Frequently asked
            </p>
            <div className="glass rounded-2xl overflow-hidden">
              {FAQS.map((f, i) => (
                <FaqItem
                  key={i}
                  item={f}
                  isOpen={openFaq === i}
                  onToggle={() => setOpenFaq(openFaq === i ? null : i)}
                />
              ))}
            </div>
          </div>

          {/* Contact form */}
          <div>
            <p className="text-[0.6rem] font-bold tracking-[0.22em] uppercase text-cream-dim mb-3">
              Still need help? Send us a message
            </p>
            {sent ? (
              <div className="glass rounded-2xl p-6 border border-emerald-500/20 text-center">
                <div className="text-3xl mb-3">✦</div>
                <p className="text-sm text-white font-semibold mb-1">Message received</p>
                <p className="text-xs text-white/50 leading-relaxed">
                  We've sent a confirmation to <strong className="text-white/70">{fromEmail}</strong>.
                  Someone from the team will reply within 1–2 working days.
                </p>
                <button
                  onClick={onClose}
                  className="mt-5 px-5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-gold to-sky text-black hover:opacity-90"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="glass rounded-xl px-4 py-3 flex items-center gap-3">
                  <span className="text-[0.6rem] text-white/40 uppercase tracking-wider">From</span>
                  <span className="text-xs text-white truncate">{fromEmail || 'Sign in to send a message'}</span>
                </div>

                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Subject — what's this about?"
                  maxLength={120}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-gold/40 transition-colors"
                />

                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Describe what's going on. Include memorial links, screenshots, or anything that helps us understand."
                  rows={6}
                  maxLength={5000}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-gold/40 transition-colors resize-none"
                />

                {error && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
                )}

                <button
                  onClick={handleSend}
                  disabled={sending || !fromEmail || !subject.trim() || !message.trim()}
                  className="w-full py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-gold to-sky text-black hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
                >
                  {sending && <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
                  {sending ? 'Sending…' : 'Send message'}
                </button>

                <p className="text-[0.6rem] text-white/30 text-center leading-relaxed">
                  We reply to <strong className="text-white/50">{fromEmail}</strong> within 1–2 working days.
                  Urgent matters (vault, abuse) prioritised.
                </p>
              </div>
            )}
          </div>

        </div>
      </motion.div>
    </>
  )
}
