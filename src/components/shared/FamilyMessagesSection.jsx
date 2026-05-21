// src/components/shared/FamilyMessagesSection.jsx
// Private family message thread — visible only to approved family members.
// Used on:
//   1. MemorialDetailPage (Family tab) — filtered to a specific memorialId
//   2. DashboardPage (all family messages across all memorials)
//
// Props:
//   memorialId  — when set, only shows messages for that memorial
//   user        — current auth user (from db.useAuth)
//   userProfile — { displayName, photoUrl } (pre-fetched by parent)
//   compact     — boolean; dashboard "preview" mode with 3 messages + link

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { id } from '@instantdb/react'
import { db } from '../../lib/instant'
import { uploadImage } from '../../lib/storage'

// ─── design tokens (match MemorialDetailPage) ─────────────────────────────────
const C = {
  paper:   '#f7f3ea',
  cream:   '#f1ece1',
  cream2:  '#e8e1d1',
  ink:     '#15120e',
  ink2:    '#2a241d',
  muted:   '#7a7164',
  muted2:  '#948a7a',
  saffron: '#f3b21a',
}
const DISP = "'Space Grotesk', system-ui, sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"
const SERIF = "'Fraunces', Georgia, serif"

function timeAgo(ts) {
  if (!ts) return ''
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60)     return 'just now'
  if (s < 3600)   return `${Math.floor(s / 60)}m ago`
  if (s < 86400)  return `${Math.floor(s / 3600)}h ago`
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function initials(name = '') {
  return name.trim().split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase() || '??'
}

// ─── Single message bubble ────────────────────────────────────────────────────
function MessageBubble({ msg, isMine }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex',
        flexDirection: isMine ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        gap: 10,
        marginBottom: 12,
      }}
    >
      {/* Avatar */}
      {!isMine && (
        <div style={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          background: `linear-gradient(135deg, ${C.saffron}33, #38bdf833)`,
          border: '1px solid rgba(21,18,14,.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: MONO, fontSize: 11, fontWeight: 700, color: C.muted,
          overflow: 'hidden',
        }}>
          {msg.fromPhoto
            ? <img src={msg.fromPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : initials(msg.fromName)}
        </div>
      )}

      <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', gap: 4,
        alignItems: isMine ? 'flex-end' : 'flex-start' }}>
        {/* Name + time */}
        {!isMine && (
          <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase',
            color: C.muted2 }}>
            {msg.fromName}
          </span>
        )}

        {/* Bubble */}
        <div style={{
          background: isMine ? C.ink : C.cream,
          color: isMine ? C.cream : C.ink,
          borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          padding: '12px 16px',
          border: isMine ? '1px solid rgba(21,18,14,.3)' : '1px solid rgba(21,18,14,.08)',
          boxShadow: '0 2px 8px rgba(21,18,14,.06)',
        }}>
          {/* Photo attachment */}
          {msg.photoUrl && (
            <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: msg.content ? 8 : 0, maxWidth: 240 }}>
              <img src={msg.photoUrl} alt="" style={{ width: '100%', display: 'block', objectFit: 'cover' }} />
            </div>
          )}
          {msg.content && (
            <p style={{ fontFamily: DISP, fontSize: 14, lineHeight: 1.55, margin: 0 }}>{msg.content}</p>
          )}
        </div>

        <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.1em',
          color: C.muted2 }}>{timeAgo(msg.createdAt)}</span>
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function FamilyMessagesSection({ memorialId, user, userProfile, compact = false }) {
  const [text,       setText]       = useState('')
  const [photoFile,  setPhotoFile]  = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [uploading,  setUploading]  = useState(false)
  const [sending,    setSending]    = useState(false)
  const bottomRef = useRef(null)
  const photoRef  = useRef(null)
  const inputRef  = useRef(null)

  // Query messages for this memorial (or all memorials if no memorialId)
  const where = memorialId ? { memorialId } : {}
  const { data } = db.useQuery({
    familyMessages: { $: { where, order: { serverCreatedAt: 'asc' } } },
  })

  const messages = data?.familyMessages || []

  // Mark messages as read when component mounts / messages change
  useEffect(() => {
    if (!user || !messages.length) return
    const unread = messages.filter(m => {
      const readBy = Array.isArray(m.readBy) ? m.readBy : []
      return m.fromUserId !== user.id && !readBy.includes(user.id)
    })
    if (!unread.length) return
    // Mark all unread as read
    unread.forEach(msg => {
      const readBy = Array.isArray(msg.readBy) ? [...msg.readBy, user.id] : [user.id]
      db.transact([db.tx.familyMessages[msg.id].update({ readBy })]).catch(() => {})
    })
  }, [messages.length, user?.id])

  // Scroll to bottom on new messages
  useEffect(() => {
    if (!compact) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, compact])

  async function handleSend() {
    if ((!text.trim() && !photoFile) || sending) return
    setSending(true)
    try {
      let photoUrl = null
      if (photoFile) {
        setUploading(true)
        try { photoUrl = await uploadImage(photoFile, () => {}, 'family-messages') } catch {}
        setUploading(false)
      }
      const displayName = userProfile?.displayName || user.email?.split('@')[0] || 'Family member'
      const fromPhoto   = userProfile?.photoUrl || null
      await db.transact([
        db.tx.familyMessages[id()].update({
          memorialId:  memorialId || 'global',
          fromUserId:  user.id,
          fromName:    displayName,
          fromPhoto,
          content:     text.trim(),
          ...(photoUrl ? { photoUrl } : {}),
          createdAt:   Date.now(),
          readBy:      [user.id],
        }),
      ])
      setText('')
      setPhotoFile(null)
      setPhotoPreview(null)
    } finally { setSending(false) }
  }

  function handlePhotoSelect(e) {
    const file = e.target.files?.[0]; if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }
  function removePhoto() {
    setPhotoFile(null); setPhotoPreview(null)
    if (photoRef.current) photoRef.current.value = ''
  }

  // Compact (preview) mode — show last 3 messages only
  if (compact) {
    const recent = messages.slice(-3)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recent.length === 0 ? (
          <p style={{ fontFamily: DISP, fontSize: 13, color: C.muted, textAlign: 'center', padding: '16px 0' }}>
            No family messages yet
          </p>
        ) : (
          recent.map(msg => (
            <MessageBubble key={msg.id} msg={msg} isMine={msg.fromUserId === user?.id} />
          ))
        )}
      </div>
    )
  }

  // Full mode
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 400 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 4px 16px', borderBottom: '1px solid rgba(21,18,14,.08)', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.22em', textTransform: 'uppercase',
            color: C.saffron }}>◆</span>
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase',
            color: C.muted }}>Family Messages</span>
        </div>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: C.muted }}>
          {messages.length} {messages.length === 1 ? 'message' : 'messages'}
        </span>
      </div>

      {/* Messages list */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, paddingBottom: 8 }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 12, color: 'rgba(21,18,14,.10)' }}>✉</div>
            <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300, fontSize: 18,
              color: C.muted, marginBottom: 6 }}>Start the conversation</p>
            <p style={{ fontFamily: DISP, fontSize: 13, color: C.muted2, maxWidth: '32ch', margin: '0 auto',
              lineHeight: 1.6 }}>
              Only approved family members can see these messages. Share memories, make plans, or simply stay connected.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} isMine={msg.fromUserId === user?.id} />
            ))}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Photo preview */}
      <AnimatePresence>
        {photoPreview && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 8, position: 'relative', maxHeight: 140 }}>
            <img src={photoPreview} alt="" style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
            <button onClick={removePhoto}
              style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: '50%',
                background: 'rgba(21,18,14,.7)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 12 }}>✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compose bar */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 8, paddingTop: 12,
        borderTop: '1px solid rgba(21,18,14,.08)', marginTop: 4,
      }}>
        {/* Photo button */}
        <button onClick={() => photoRef.current?.click()}
          style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
            background: C.cream2, border: '1px solid rgba(21,18,14,.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 16, color: C.muted }}>
          📷
        </button>
        <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoSelect} />

        {/* Text input */}
        <textarea
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Write a private family message…"
          rows={1}
          style={{
            flex: 1, background: C.cream, border: '1px solid rgba(21,18,14,.10)',
            borderRadius: 20, padding: '10px 16px', fontFamily: DISP, fontSize: 14,
            color: C.ink, resize: 'none', outline: 'none', lineHeight: 1.5,
            maxHeight: 120, overflowY: 'auto',
            fieldSizing: 'content',
          }}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={(!text.trim() && !photoFile) || sending || uploading}
          style={{
            width: 38, height: 38, borderRadius: '50%', flexShrink: 0, border: 'none',
            background: (text.trim() || photoFile) ? C.saffron : C.cream2,
            color: (text.trim() || photoFile) ? C.ink : C.muted2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: (text.trim() || photoFile) ? 'pointer' : 'default',
            transition: 'all .15s',
          }}
        >
          {sending || uploading ? (
            <div style={{ width: 16, height: 16, borderRadius: '50%',
              border: '2px solid rgba(21,18,14,.2)', borderTopColor: C.ink,
              animation: 'spin 0.6s linear infinite' }} />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          )}
        </button>
      </div>

      <p style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase',
        color: C.muted2, textAlign: 'center', marginTop: 8 }}>
        Private · Visible to approved family members only
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
