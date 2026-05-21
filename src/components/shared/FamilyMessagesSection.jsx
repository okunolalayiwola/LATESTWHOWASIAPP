// src/components/shared/FamilyMessagesSection.jsx
// WhatsApp-style group chat for approved family members.
// • Real-time reactive (InstantDB)
// • Per-person colour-coded bubbles (deterministic from userId)
// • Member sidebar (top row on mobile, side panel on desktop)
// • Notifications: in-app toast + native browser Notification when
//   the tab is hidden and the message is from someone else
// • readBy receipts — auto-marks messages as read on view
//
// Props:
//   memorialId  — required. The family chat is scoped to one memorial.
//   user        — current auth user
//   userProfile — { displayName, photoUrl }
//   compact     — boolean; preview mode (last 3 messages, no compose)

import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { id } from '@instantdb/react'
import { db } from '../../lib/instant'
import { uploadImage } from '../../lib/storage'

// ─── design tokens ────────────────────────────────────────────────────────────
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

// ─── Per-person colour palette ────────────────────────────────────────────────
// Each member gets a deterministic colour from their userId so they're easy
// to follow across the chat at a glance. "Me" bubbles use the dark ink shade
// so they stay visually distinct from other members.
const BUBBLE_PALETTE = [
  { bg: '#FFE981', accent: '#B79A0A' },  // butter
  { bg: '#FFC7D0', accent: '#A23B57' },  // rose
  { bg: '#B7DFF0', accent: '#1F6F8E' },  // sky
  { bg: '#C4EED4', accent: '#2E7A4C' },  // mint
  { bg: '#D8CBF6', accent: '#5A3F9E' },  // lavender
  { bg: '#FFD7B3', accent: '#A85B22' },  // peach
  { bg: '#D3E3B9', accent: '#4F6E2E' },  // sage
  { bg: '#F9B27D', accent: '#8E4B14' },  // apricot
]
function colourFor(userId) {
  if (!userId) return BUBBLE_PALETTE[0]
  let h = 0
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) | 0
  return BUBBLE_PALETTE[Math.abs(h) % BUBBLE_PALETTE.length]
}

function timeAgo(ts) {
  if (!ts) return ''
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60)     return 'just now'
  if (s < 3600)   return `${Math.floor(s / 60)}m`
  if (s < 86400)  return `${Math.floor(s / 3600)}h`
  if (s < 604800) return `${Math.floor(s / 86400)}d`
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// Day label for date-divider rows
function dayLabel(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const today = new Date()
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  const same = (a, b) => a.getFullYear() === b.getFullYear()
                       && a.getMonth() === b.getMonth()
                       && a.getDate() === b.getDate()
  if (same(d, today))     return 'Today'
  if (same(d, yesterday)) return 'Yesterday'
  const sameYear = d.getFullYear() === today.getFullYear()
  return d.toLocaleDateString('en-GB', sameYear
    ? { weekday: 'long', day: 'numeric', month: 'long' }
    : { day: 'numeric', month: 'long', year: 'numeric' })
}

function dayKey(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function initials(name = '') {
  return name.trim().split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase() || '??'
}

// ─── Notification helper ──────────────────────────────────────────────────────
// Asks once for browser notification permission. Returns true if granted.
async function ensureNotifyPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied')  return false
  try {
    const result = await Notification.requestPermission()
    return result === 'granted'
  } catch { return false }
}

function showNativeNotification(title, body, icon) {
  try {
    if (Notification.permission !== 'granted') return
    const n = new Notification(title, { body, icon, badge: icon, silent: false })
    setTimeout(() => n.close(), 6000)
    n.onclick = () => { window.focus(); n.close() }
  } catch {}
}

// ─── Member chip ──────────────────────────────────────────────────────────────
function MemberChip({ name, photo, isYou, colour, compact = false }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: compact ? '4px 8px 4px 4px' : '6px 10px 6px 6px',
      background: 'rgba(21,18,14,0.04)',
      border: '1px solid rgba(21,18,14,0.06)',
      borderRadius: 999,
      minWidth: 0,
    }}>
      <div style={{
        width: compact ? 22 : 26, height: compact ? 22 : 26, borderRadius: '50%',
        background: colour.bg,
        border: `1.5px solid ${colour.accent}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: MONO, fontSize: 9.5, fontWeight: 700, color: colour.accent,
        overflow: 'hidden', flexShrink: 0,
      }}>
        {photo
          ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : initials(name)}
      </div>
      <span style={{
        fontFamily: DISP, fontSize: compact ? 11 : 12, fontWeight: 600,
        color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {isYou ? 'You' : name}
      </span>
    </div>
  )
}

// ─── Date divider row ─────────────────────────────────────────────────────────
function DateDivider({ label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      margin: '14px 0 10px',
    }}>
      <span style={{ flex: 1, height: 1, background: 'rgba(21,18,14,0.08)' }} />
      <span style={{
        fontFamily: MONO, fontSize: 9.5, letterSpacing: '.22em', textTransform: 'uppercase',
        color: C.muted2,
        padding: '3px 10px', borderRadius: 999,
        background: 'rgba(21,18,14,0.04)', border: '1px solid rgba(21,18,14,0.06)',
      }}>
        {label}
      </span>
      <span style={{ flex: 1, height: 1, background: 'rgba(21,18,14,0.08)' }} />
    </div>
  )
}

// ─── Single message bubble ────────────────────────────────────────────────────
function MessageBubble({ msg, isMine, showName, totalRecipients }) {
  const c = isMine ? null : colourFor(msg.fromUserId)
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex',
        flexDirection: isMine ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        gap: 8,
        marginBottom: 10,
      }}
    >
      {/* Avatar — only for others */}
      {!isMine && (
        <div style={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
          background: c.bg,
          border: `1.5px solid ${c.accent}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: MONO, fontSize: 10, fontWeight: 800, color: c.accent,
          overflow: 'hidden',
        }}>
          {msg.fromPhoto
            ? <img src={msg.fromPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : initials(msg.fromName)}
        </div>
      )}

      <div style={{ maxWidth: '74%', display: 'flex', flexDirection: 'column',
        alignItems: isMine ? 'flex-end' : 'flex-start', minWidth: 0 }}>
        {/* Sender name — only show on the first message of a run */}
        {!isMine && showName && (
          <span style={{
            fontFamily: DISP, fontSize: 11, fontWeight: 700,
            color: c.accent, marginBottom: 3, marginLeft: 4,
          }}>
            {msg.fromName}
          </span>
        )}

        {/* Bubble */}
        <div style={{
          background: isMine ? C.ink : c.bg,
          color: isMine ? C.cream : C.ink,
          borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          padding: '9px 13px',
          border: isMine ? '1px solid rgba(21,18,14,0.45)' : `1px solid ${c.accent}33`,
          boxShadow: '0 1px 4px rgba(21,18,14,0.06)',
          wordBreak: 'break-word',
        }}>
          {msg.photoUrl && (
            <div style={{
              borderRadius: 8, overflow: 'hidden',
              marginBottom: msg.content ? 6 : 0, maxWidth: 240,
            }}>
              <img src={msg.photoUrl} alt="" style={{ width: '100%', display: 'block', objectFit: 'cover' }} />
            </div>
          )}
          {msg.content && (
            <p style={{
              fontFamily: DISP, fontSize: 14, lineHeight: 1.5, margin: 0,
            }}>
              {msg.content}
            </p>
          )}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginTop: 3,
          marginLeft: isMine ? 0 : 4, marginRight: isMine ? 4 : 0,
        }}>
          <span style={{ fontFamily: MONO, fontSize: 9.5, color: C.muted2 }}>
            {timeAgo(msg.createdAt)}
          </span>
          {/* Read-receipt — only on my messages */}
          {isMine && (() => {
            const readBy = Array.isArray(msg.readBy) ? msg.readBy : []
            const seenByOthers = readBy.filter(uid => uid !== msg.fromUserId).length
            // ticks: single grey = sent, double grey = delivered, double saffron = read
            const everyoneSeen = totalRecipients > 0 && seenByOthers >= totalRecipients
            const someoneSeen  = seenByOthers > 0
            const colour = everyoneSeen ? C.saffron : C.muted2
            return (
              <span title={
                everyoneSeen ? 'Read by everyone'
                : someoneSeen ? `Read by ${seenByOthers}`
                : 'Sent'
              }
                style={{ display: 'inline-flex', alignItems: 'center', gap: 0,
                  color: colour, fontSize: 11, fontWeight: 700 }}>
                <svg width="14" height="10" viewBox="0 0 16 12" fill="none" stroke="currentColor"
                  strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 6l4 4 7-9" />
                  {someoneSeen && <path d="M7 10l7-9" />}
                </svg>
              </span>
            )
          })()}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function FamilyMessagesSection({ memorialId, user, userProfile, compact = false }) {
  const [text,         setText]         = useState('')
  const [photoFile,    setPhotoFile]    = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [uploading,    setUploading]    = useState(false)
  const [sending,      setSending]      = useState(false)
  const [showMembers,  setShowMembers]  = useState(false)
  const bottomRef = useRef(null)
  const photoRef  = useRef(null)
  const inputRef  = useRef(null)
  const lastSeenIdRef = useRef(null)

  // ── Query messages for this memorial ────────────────────────────────────────
  const where = memorialId ? { memorialId } : {}
  const { data } = db.useQuery({
    familyMessages: { $: { where, order: { serverCreatedAt: 'asc' } } },
  })

  // ── Query members (approved family + memorial owner) ────────────────────────
  const memoQ = db.useQuery(memorialId ? {
    memorials: { $: { where: { id: memorialId } } },
    familyConnections: {
      $: { where: { toMemorialId: memorialId, status: 'approved' } },
    },
  } : null)

  const memorial      = memoQ?.data?.memorials?.[0]
  const ownerUserId   = memorial?.createdBy || memorial?.creatorId
  const approvedConns = memoQ?.data?.familyConnections || []

  // Build a "members" list — owner + approved connections, de-duplicated by userId
  const members = useMemo(() => {
    const seen  = new Set()
    const out   = []
    // Owner first — name pulled from memorial if creator is current user
    if (ownerUserId) {
      const isOwnerYou = ownerUserId === user?.id
      const ownerName = isOwnerYou
        ? (userProfile?.displayName || 'You')
        : (memorial?.creatorName || memorial?.ownerName || 'Owner')
      out.push({
        userId: ownerUserId,
        name:   ownerName,
        photo:  isOwnerYou ? userProfile?.photoUrl : null,
        isOwner: true,
      })
      seen.add(ownerUserId)
    }
    approvedConns.forEach(c => {
      if (seen.has(c.fromUserId)) return
      seen.add(c.fromUserId)
      out.push({
        userId: c.fromUserId,
        name:   c.fromName || 'Family',
        photo:  c.fromPhoto || null,
        isOwner: false,
      })
    })
    return out
  }, [ownerUserId, approvedConns.map(c => c.id).join(), memorial?.creatorName, userProfile?.displayName, userProfile?.photoUrl, user?.id])

  const messages = data?.familyMessages || []

  // ── Notifications + read receipts ───────────────────────────────────────────
  // Mark messages as read when component mounts / messages change.
  useEffect(() => {
    if (!user || !messages.length) return
    const unread = messages.filter(m => {
      const readBy = Array.isArray(m.readBy) ? m.readBy : []
      return m.fromUserId !== user.id && !readBy.includes(user.id)
    })
    if (!unread.length) return
    unread.forEach(msg => {
      const readBy = Array.isArray(msg.readBy) ? [...msg.readBy, user.id] : [user.id]
      db.transact([db.tx.familyMessages[msg.id].update({ readBy })]).catch(() => {})
    })
  }, [messages.length, user?.id])

  // Ask once for native notification permission on first mount with messages
  useEffect(() => {
    if (compact) return
    if (!user || !messages.length) return
    ensureNotifyPermission().catch(() => {})
  }, [compact, user?.id, messages.length > 0])

  // Native browser notification when a new message arrives from someone else
  // and the tab is hidden (or window not focused). In-tab arrival just plays
  // a soft scroll-to-bottom animation.
  useEffect(() => {
    if (compact || !messages.length) return
    const latest = messages[messages.length - 1]
    if (!latest || latest.id === lastSeenIdRef.current) return
    const isFirstMount = lastSeenIdRef.current === null
    lastSeenIdRef.current = latest.id
    if (isFirstMount) return
    if (latest.fromUserId === user?.id) return
    // Notify only when tab is hidden
    if (typeof document !== 'undefined' && document.hidden) {
      showNativeNotification(
        `${latest.fromName} — ${memorial?.name?.split(' ')[0] || 'Family'}`,
        latest.content?.slice(0, 120) || (latest.photoUrl ? '📷 Photo' : '...'),
        latest.fromPhoto || '/icons/icon-192.png',
      )
    }
  }, [messages.length, compact, user?.id, memorial?.name])

  // ── Scroll to bottom on new messages ────────────────────────────────────────
  useEffect(() => {
    if (!compact) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, compact])

  // ── Send ────────────────────────────────────────────────────────────────────
  async function handleSend() {
    if ((!text.trim() && !photoFile) || sending) return
    if (!memorialId) return    // safety: don't send without a chat scope
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
          memorialId,
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

  // ── Compact (preview) mode ──────────────────────────────────────────────────
  if (compact) {
    const recent = messages.slice(-3)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recent.length === 0 ? (
          <p style={{ fontFamily: DISP, fontSize: 13, color: C.muted, textAlign: 'center', padding: '16px 0' }}>
            No family messages yet
          </p>
        ) : (
          recent.map((msg, i) => {
            const prev = recent[i - 1]
            const showName = !prev || prev.fromUserId !== msg.fromUserId
            return (
              <MessageBubble key={msg.id} msg={msg} isMine={msg.fromUserId === user?.id} showName={showName} />
            )
          })
        )}
      </div>
    )
  }

  // ── Empty / no-memorial guard ───────────────────────────────────────────────
  if (!memorialId) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px',
        fontFamily: DISP, color: C.muted, fontSize: 14 }}>
        Pick a family chat to start.
      </div>
    )
  }

  // ── Full mode ───────────────────────────────────────────────────────────────
  return (
    <div className="fms-shell" style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', minHeight: 480,
      background: C.paper,
      borderRadius: 18,
      overflow: 'hidden',
    }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderBottom: '1px solid rgba(21,18,14,.08)',
        background: 'rgba(21,18,14,.02)',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          background: `linear-gradient(135deg, ${C.saffron}33, #38bdf833)`,
          border: '1.5px solid rgba(243,178,26,.35)',
          overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: SERIF, fontStyle: 'italic', fontSize: 16, fontWeight: 700, color: C.saffron,
        }}>
          {memorial?.photo
            ? <img src={memorial.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (memorial?.name?.[0] || '?').toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: DISP, fontWeight: 700, fontSize: 15, color: C.ink,
            margin: 0, lineHeight: 1.2 }}>
            {memorial?.name || 'Family'}{memorial?.name && <span style={{ color: C.muted, fontWeight: 500 }}>'s family</span>}
          </p>
          <p style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase',
            color: C.muted, margin: '2px 0 0' }}>
            {members.length} {members.length === 1 ? 'member' : 'members'} · private
          </p>
        </div>
        <button onClick={() => setShowMembers(s => !s)}
          aria-label="Members"
          style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: showMembers ? C.ink : C.cream,
            color: showMembers ? C.cream : C.muted,
            border: '1px solid rgba(21,18,14,.10)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </button>
      </div>

      {/* ── Secure-messaging banner ────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 14px',
        background: 'linear-gradient(90deg, rgba(243,178,26,0.10) 0%, rgba(56,189,248,0.06) 100%)',
        borderBottom: '1px solid rgba(243,178,26,0.18)',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.saffron} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <p style={{
          fontFamily: MONO, fontSize: 10.5, letterSpacing: '.10em',
          color: C.ink, margin: 0, lineHeight: 1.4, fontWeight: 600,
          flex: 1, minWidth: 0,
        }}>
          <span style={{ color: C.saffron, fontWeight: 800 }}>Secure messaging</span>
          <span style={{ color: C.muted, fontWeight: 500 }}>
            {' · Only approved family members can read this chat'}
          </span>
        </p>
      </div>

      {/* ── Members strip (top, collapsible) ───────────────────────────────── */}
      <AnimatePresence>
        {showMembers && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden',
              borderBottom: '1px solid rgba(21,18,14,.08)',
              background: 'rgba(21,18,14,.02)' }}>
            <div style={{ padding: '10px 14px',
              display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {members.map(m => (
                <MemberChip
                  key={m.userId}
                  name={m.name}
                  photo={m.photo}
                  isYou={m.userId === user?.id}
                  colour={colourFor(m.userId)}
                  compact
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Body: messages + member rail ───────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* Messages list */}
        <div className="fms-messages" style={{
          flex: 1, overflowY: 'auto',
          padding: '14px 16px',
          minWidth: 0,
        }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 12, color: 'rgba(21,18,14,.12)' }}>✉</div>
              <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300, fontSize: 18,
                color: C.muted, marginBottom: 6 }}>Start the conversation</p>
              <p style={{ fontFamily: DISP, fontSize: 13, color: C.muted2, maxWidth: '32ch', margin: '0 auto',
                lineHeight: 1.6 }}>
                Only approved family members can see these messages.
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {messages.map((msg, i) => {
                const prev = messages[i - 1]
                const showName = !prev || prev.fromUserId !== msg.fromUserId
                const newDay  = !prev || dayKey(prev.createdAt) !== dayKey(msg.createdAt)
                // Other members in the chat — recipients for read-receipt math
                const recipientCount = Math.max(0, members.length - 1)
                return (
                  <div key={msg.id}>
                    {newDay && <DateDivider label={dayLabel(msg.createdAt)} />}
                    <MessageBubble
                      msg={msg}
                      isMine={msg.fromUserId === user?.id}
                      showName={showName}
                      totalRecipients={recipientCount}
                    />
                  </div>
                )
              })}
            </AnimatePresence>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Member rail — visible on desktop ≥760px */}
        <aside className="fms-rail" style={{
          width: 200, flexShrink: 0,
          borderLeft: '1px solid rgba(21,18,14,.08)',
          background: 'rgba(21,18,14,.02)',
          padding: '14px 12px',
          overflowY: 'auto',
        }}>
          <p style={{
            fontFamily: MONO, fontSize: 9.5, letterSpacing: '.22em', textTransform: 'uppercase',
            color: C.muted, margin: '0 0 10px',
          }}>
            ◆ {members.length} {members.length === 1 ? 'member' : 'members'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {members.map(m => {
              const c = colourFor(m.userId)
              return (
                <div key={m.userId} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 4px',
                }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                    background: c.bg,
                    border: `1.5px solid ${c.accent}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: MONO, fontSize: 9.5, fontWeight: 800, color: c.accent,
                    overflow: 'hidden',
                  }}>
                    {m.photo
                      ? <img src={m.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : initials(m.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontFamily: DISP, fontSize: 12, fontWeight: 600,
                      color: C.ink, margin: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {m.userId === user?.id ? 'You' : m.name}
                    </p>
                    {m.isOwner && (
                      <p style={{
                        fontFamily: MONO, fontSize: 8.5, letterSpacing: '.16em', textTransform: 'uppercase',
                        color: C.muted2, margin: '1px 0 0',
                      }}>
                        Owner
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </aside>
      </div>

      {/* ── Photo preview ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {photoPreview && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ borderTop: '1px solid rgba(21,18,14,.08)', overflow: 'hidden' }}>
            <div style={{ position: 'relative', maxHeight: 140, padding: '10px 16px' }}>
              <img src={photoPreview} alt="" style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 10, display: 'block' }} />
              <button onClick={removePhoto}
                style={{ position: 'absolute', top: 16, right: 22, width: 26, height: 26, borderRadius: '50%',
                  background: 'rgba(21,18,14,.78)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13 }}>✕</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Compose bar ────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 8,
        padding: '10px 12px',
        borderTop: '1px solid rgba(21,18,14,.08)',
        background: 'rgba(21,18,14,.02)',
      }}>
        <button onClick={() => photoRef.current?.click()}
          aria-label="Attach photo"
          style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: C.cream2, border: '1px solid rgba(21,18,14,.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 15, color: C.muted }}>
          📷
        </button>
        <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoSelect} />

        <textarea
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Write a message…"
          rows={1}
          style={{
            flex: 1, background: '#fff', border: '1px solid rgba(21,18,14,.10)',
            borderRadius: 20, padding: '9px 14px', fontFamily: DISP, fontSize: 14,
            color: C.ink, resize: 'none', outline: 'none', lineHeight: 1.5,
            maxHeight: 120, overflowY: 'auto',
          }}
        />

        <button
          onClick={handleSend}
          disabled={(!text.trim() && !photoFile) || sending || uploading}
          aria-label="Send message"
          style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0, border: 'none',
            background: (text.trim() || photoFile) ? C.saffron : C.cream2,
            color: (text.trim() || photoFile) ? C.ink : C.muted2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: (text.trim() || photoFile) ? 'pointer' : 'default',
            transition: 'all .15s',
            boxShadow: (text.trim() || photoFile) ? '0 4px 12px rgba(243,178,26,.30)' : 'none',
          }}
        >
          {sending || uploading ? (
            <div style={{ width: 14, height: 14, borderRadius: '50%',
              border: '2px solid rgba(21,18,14,.2)', borderTopColor: C.ink,
              animation: 'spin 0.6s linear infinite' }} />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          )}
        </button>
      </div>

      {/* Hide the side rail on small viewports */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .fms-shell .fms-rail { display: block; }
        @media (max-width: 760px) {
          .fms-shell .fms-rail { display: none; }
        }
      `}</style>
    </div>
  )
}
