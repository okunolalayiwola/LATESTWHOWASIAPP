// src/components/shared/InviteModal.jsx
// Generates and shares a family tree invite.
// Stores invite codes in InstantDB `invites` collection.
//
// When invoked WITHOUT a memorial prop (e.g. from /family-tree):
//   → invite is tied to the user's overall family circle.
// When invoked WITH a memorial prop (from MemorialDetailPage):
//   → invite is tied to that specific memorial. Family connections approved
//     via this code will link to memorialId, so the orbital tree displays
//     them on the correct memorial.

import { useState } from 'react'
import { motion }   from 'framer-motion'
import { id }       from '@instantdb/react'
import { db }       from '../../lib/instant'

function generateCode() {
  // 8-char alphanumeric code, URL-safe
  return Math.random().toString(36).slice(2, 10).toUpperCase()
}

export default function InviteModal({ user, memorial, onClose }) {
  const [code,    setCode]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [copied,  setCopied]  = useState(false)
  const [copyType, setCopyType] = useState(null) // 'link' | 'code'
  const [error,   setError]   = useState('')

  const memorialName = memorial?.name || ''
  const memorialId   = memorial?.id   || null

  const inviteLink = code
    ? `${window.location.origin}/join?code=${code}`
    : null

  const qrUrl = code
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&bgcolor=0e0e0e&color=ffffff&margin=12&data=${encodeURIComponent(inviteLink)}`
    : null

  async function handleGenerate() {
    setLoading(true)
    try {
      const newCode = generateCode()
      const inviteId = id()

      await db.transact([
        db.tx.invites[inviteId].update({
          code:          newCode,
          familyOwnerId: user.id,
          memorialId:    memorialId || undefined,
          memorialName:  memorialName || undefined,
          createdAt:     Date.now(),
          expiresAt:     Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
          used:          false,
        }),
      ])

      setCode(newCode)
    } catch (err) {
      // If the DB write fails the code can't be redeemed, so surface it
      // rather than showing a code that will never validate.
      console.warn('Invite generation failed:', err)
      setError('Could not create the invite. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function copy(text, type) {
    await navigator.clipboard.writeText(text)
    setCopied(true); setCopyType(type)
    setTimeout(() => { setCopied(false); setCopyType(null) }, 2500)
  }

  async function handleDownloadQR() {
    if (!qrUrl) return
    const res  = await fetch(qrUrl)
    const blob = await res.blob()
    const href = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = href
    a.download = `family-tree-invite-${code}.png`
    a.click()
    URL.revokeObjectURL(href)
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/75 z-40 backdrop-blur-sm"
      />

      {/* Sheet */}
      <motion.div
        initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
        transition={{ type:'spring', damping:30, stiffness:300 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d0d] border-t border-white/10 rounded-t-3xl px-5 pt-4 pb-10 max-w-lg mx-auto"
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />

        <h3 className="font-display text-2xl font-bold text-white mb-1">
          {memorialName ? `Invite to ${memorialName}'s circle` : 'Invite family'}
        </h3>
        <p className="text-xs text-white/40 mb-6 leading-relaxed">
          {memorialName
            ? `Share this code so family members can be added to ${memorialName}'s family circle. They'll choose their relationship, and you'll confirm or change it. Codes expire after 7 days.`
            : `Share a link so family members can view your family tree and add tributes to memorials. Codes expire after 7 days.`}
        </p>

        {!code ? (
          <>
            {/* Generate button */}
            <motion.button
              whileTap={{ scale:0.97 }}
              onClick={handleGenerate}
              disabled={loading}
              className="w-full py-4 rounded-2xl text-sm font-bold tracking-wider bg-gradient-to-r from-gold to-sky text-black hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading
                ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />Generating...</span>
                : '✦ Generate invite link'}
            </motion.button>
            {error && <p className="text-xs text-rose/80 text-center mt-3">{error}</p>}
          </>
        ) : (
          <>
            {/* Code badge — ABOVE the QR so it's always visible together */}
            <div className="text-center mb-4">
              <p className="text-[0.55rem] text-white/30 tracking-[0.28em] uppercase mb-2">Your invite code</p>
              <div className="inline-flex items-center gap-3 glass border border-gold/20 rounded-2xl px-6 py-3.5 mb-1">
                <span className="font-mono text-3xl font-bold text-white tracking-[0.3em]">{code}</span>
                <button onClick={() => copy(code, 'code')}
                  className={`text-xs transition-colors ${copied && copyType==='code' ? 'text-gold' : 'text-white/30 hover:text-white/60'}`}>
                  {copied && copyType==='code' ? '✓' : '⎘'}
                </button>
              </div>
              <p className="text-[0.6rem] text-white/25 tracking-widest uppercase">Enter this code · or scan below</p>
            </div>

            {/* QR code — code is baked into the scan destination */}
            <div className="flex flex-col items-center mb-5">
              <div className="w-52 h-52 rounded-2xl overflow-hidden bg-white p-2 flex items-center justify-center shadow-lg">
                <img src={qrUrl} alt="Invite QR code" className="w-full h-full object-contain"
                  onError={e => { e.target.style.display = 'none' }} />
              </div>
              <p className="text-[0.55rem] text-white/20 mt-2 tracking-wider uppercase">Scan to join family</p>
            </div>

            {/* Link field */}
            <div className="glass border border-white/10 rounded-xl px-3 py-2.5 mb-4 flex items-center gap-2">
              <p className="text-xs text-white/35 flex-1 truncate">{inviteLink}</p>
              <button onClick={() => copy(inviteLink, 'link')}
                className={`text-xs flex-shrink-0 transition-colors ${copied && copyType==='link' ? 'text-gold' : 'text-white/30 hover:text-white/60'}`}>
                {copied && copyType==='link' ? '✓ Copied' : 'Copy'}
              </button>
            </div>

            {/* Action buttons */}
            <div className="space-y-2">
              <button onClick={() => copy(inviteLink, 'link')}
                className={`w-full py-3.5 rounded-xl text-xs font-bold tracking-wider transition-all ${
                  copied && copyType==='link'
                    ? 'bg-gold/20 border border-gold/40 text-gold'
                    : 'bg-gradient-to-r from-gold to-sky text-black hover:opacity-90'
                }`}>
                {copied && copyType==='link' ? '✓ Link copied!' : 'Copy invite link'}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleDownloadQR}
                  className="py-3 rounded-xl text-xs font-semibold glass border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-all">
                  Download QR
                </button>

                {typeof navigator !== 'undefined' && navigator.share && (
                  <button
                    onClick={() => navigator.share({ title:'Join my family tree on WHO WAS I', url: inviteLink }).catch(()=>{})}
                    className="py-3 rounded-xl text-xs font-semibold glass border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-all">
                    Share via...
                  </button>
                )}
              </div>

              <button onClick={() => { setCode(null); setCopied(false) }}
                className="w-full py-3 rounded-xl text-xs text-white/25 hover:text-white/45 transition-colors">
                Generate new code
              </button>
            </div>
          </>
        )}
      </motion.div>
    </>
  )
}
