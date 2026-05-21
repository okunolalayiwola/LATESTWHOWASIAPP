// src/components/shared/InviteCodeBadge.jsx
// Compact, always-visible invite code badge.
// Shows the user's current invite code + QR above the code text.
// Appears on memorial pages (owner only), profile page, and dashboard.

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { id } from '@instantdb/react'
import { db } from '../../lib/instant'

function generateCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase()
}

export default function InviteCodeBadge({ user, compact = false }) {
  const [code,     setCode]     = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [copied,   setCopied]   = useState(false)
  const [expanded, setExpanded] = useState(false)

  // Fetch the user's most recent non-expired invite
  const { data } = db.useQuery(
    user
      ? { invites: { $: { where: { familyOwnerId: user.id, used: false } } } }
      : null
  )

  useEffect(() => {
    if (!data) return
    const now      = Date.now()
    const valid    = (data.invites || [])
      .filter(inv => !inv.expiresAt || inv.expiresAt > now)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

    if (valid.length > 0) {
      setCode(valid[0].code)
    } else {
      setCode(null)
    }
  }, [data])

  const inviteLink = code ? `${window.location.origin}/join?code=${code}` : null
  const qrUrl      = code
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&bgcolor=ffffff&color=000000&margin=10&data=${encodeURIComponent(inviteLink)}`
    : null

  async function handleGenerate() {
    if (!user) return
    setLoading(true)
    try {
      const newCode  = generateCode()
      const inviteId = id()
      await db.transact([
        db.tx.invites[inviteId].update({
          code:          newCode,
          familyOwnerId: user.id,
          createdAt:     Date.now(),
          expiresAt:     Date.now() + 30 * 24 * 60 * 60 * 1000,   // 30 days
          used:          false,
        }),
      ])
      setCode(newCode)
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleShare() {
    if (!inviteLink) return
    if (navigator.share) {
      navigator.share({
        title: 'Join my family on WHO WAS I',
        text:  `Use code ${code} or follow this link to join my family memory archive.`,
        url:   inviteLink,
      }).catch(() => {})
    } else {
      handleCopy()
    }
  }

  if (!user) return null

  // ── Compact mode (inline on memorial sidebar, profile page) ──────────────────
  if (compact) {
    return (
      <div style={{
        background: 'rgba(255,255,255,.04)',
        border:     '1px solid rgba(255,255,255,.08)',
        borderRadius: 20,
        padding:    '16px 18px',
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 12 }}>
          <div>
            <p style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:9, letterSpacing:'.24em', textTransform:'uppercase',
              color:'rgba(255,255,255,.35)', marginBottom:4 }}>Family invite code</p>
            {code ? (
              <p style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:22, fontWeight:700, color:'#fff',
                letterSpacing:'.2em', margin:0 }}>{code}</p>
            ) : (
              <button onClick={handleGenerate} disabled={loading}
                style={{ background:'linear-gradient(90deg,#f3b21a,#60c0dc)', border:'none', cursor:'pointer',
                  borderRadius:10, padding:'6px 14px', fontFamily:"'JetBrains Mono', monospace",
                  fontSize:10, fontWeight:700, letterSpacing:'.16em', color:'#14110d' }}>
                {loading ? 'Generating…' : '+ Generate code'}
              </button>
            )}
          </div>

          {/* Mini QR */}
          {qrUrl && (
            <button onClick={() => setExpanded(e => !e)}
              style={{ background:'#fff', borderRadius:10, padding:4, border:'none', cursor:'pointer', flexShrink:0 }}>
              <img src={qrUrl} alt="QR" style={{ width:52, height:52, display:'block' }} />
            </button>
          )}
        </div>

        {/* Expanded QR + code above it */}
        <AnimatePresence>
          {expanded && qrUrl && (
            <motion.div
              initial={{ height:0, opacity:0 }}
              animate={{ height:'auto', opacity:1 }}
              exit={{ height:0, opacity:0 }}
              style={{ overflow:'hidden' }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, paddingTop:12,
                borderTop:'1px solid rgba(255,255,255,.06)', marginBottom:12 }}>
                {/* Code above QR */}
                <p style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:18, fontWeight:700, color:'#fff',
                  letterSpacing:'.28em' }}>{code}</p>
                {/* QR */}
                <div style={{ background:'#fff', borderRadius:14, padding:8 }}>
                  <img src={qrUrl} alt="Invite QR" style={{ width:160, height:160, display:'block' }} />
                </div>
                <p style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:8, letterSpacing:'.2em',
                  textTransform:'uppercase', color:'rgba(255,255,255,.25)' }}>Scan to join family</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {code && (
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={handleCopy}
              style={{ flex:1, padding:'8px 0', borderRadius:10, border:'1px solid rgba(255,255,255,.12)',
                background:'none', cursor:'pointer', fontFamily:"'JetBrains Mono', monospace",
                fontSize:9, letterSpacing:'.18em', textTransform:'uppercase',
                color: copied ? '#f3b21a' : 'rgba(255,255,255,.4)', transition:'all .15s' }}>
              {copied ? '✓ Copied' : 'Copy link'}
            </button>
            <button onClick={handleShare}
              style={{ flex:1, padding:'8px 0', borderRadius:10, border:'none',
                background:'linear-gradient(90deg,#f3b21a,#60c0dc)', cursor:'pointer',
                fontFamily:"'JetBrains Mono', monospace", fontSize:9, letterSpacing:'.18em',
                textTransform:'uppercase', fontWeight:700, color:'#14110d' }}>
              Share →
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Full size mode ────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(243,178,26,.08), rgba(96,192,220,.06))',
      border:     '1px solid rgba(243,178,26,.20)',
      borderRadius: 24,
      padding:    '20px 22px',
    }}>
      <p style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:9, letterSpacing:'.28em', textTransform:'uppercase',
        color:'rgba(255,255,255,.35)', marginBottom:6 }}>Family invite code</p>

      {code ? (
        <>
          {/* Code above QR */}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, marginBottom:16 }}>
            <p style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:28, fontWeight:700,
              letterSpacing:'.24em', color:'#fff', textAlign:'center' }}>{code}</p>
            {qrUrl && (
              <div style={{ background:'#fff', borderRadius:16, padding:10, boxShadow:'0 8px 24px rgba(0,0,0,.3)' }}>
                <img src={qrUrl} alt="Invite QR" style={{ width:180, height:180, display:'block' }} />
              </div>
            )}
            <p style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:8, letterSpacing:'.22em',
              textTransform:'uppercase', color:'rgba(255,255,255,.25)' }}>Scan or enter code to join family</p>
          </div>

          <div style={{ display:'flex', gap:10 }}>
            <button onClick={handleCopy}
              style={{ flex:1, padding:'12px 0', borderRadius:14, border:'1px solid rgba(255,255,255,.12)',
                background:'none', cursor:'pointer', fontFamily:"'JetBrains Mono', monospace",
                fontSize:10, letterSpacing:'.16em', textTransform:'uppercase',
                color: copied ? '#f3b21a' : 'rgba(255,255,255,.5)', transition:'all .15s' }}>
              {copied ? '✓ Copied' : 'Copy link'}
            </button>
            <button onClick={handleShare}
              style={{ flex:2, padding:'12px 0', borderRadius:14, border:'none',
                background:'linear-gradient(90deg,#f3b21a,#60c0dc)', cursor:'pointer',
                fontFamily:"'JetBrains Mono', monospace", fontSize:10, letterSpacing:'.16em',
                textTransform:'uppercase', fontWeight:700, color:'#14110d' }}>
              Share →
            </button>
          </div>
        </>
      ) : (
        <button onClick={handleGenerate} disabled={loading}
          style={{ width:'100%', padding:'14px 0', borderRadius:14, border:'none', cursor:'pointer',
            background:'linear-gradient(90deg,#f3b21a,#60c0dc)',
            fontFamily:"'JetBrains Mono', monospace", fontSize:11,
            letterSpacing:'.16em', textTransform:'uppercase', fontWeight:700, color:'#14110d' }}>
          {loading ? 'Generating…' : '✦  Generate your invite code'}
        </button>
      )}
    </div>
  )
}
