// src/components/orbital/HudPanel.jsx — v2  "Clean Modern"
//
// Design changes from v1:
//   • Removed all angular bracket decorations (no military/digital HUD feel)
//   • Replaced monospace data rows with clean Inter two-column grid
//   • Status shown as a small rounded pill (like a tag chip), not raw text
//   • Relation shown as a subtle rounded label above the name
//   • Avatar: clean circle, thin border, subtle box-shadow — no pulsing brackets
//   • Warm top-edge gradient accent line in the member's status color
//   • Card background uses warmer dark (not pure black)
//   • Buttons: clean rounded-lg, not uppercase/monospace
//   • "Mark as passed" expands inline, clean form style

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '../../lib/instant'

const RING_LABELS = ['', 'Immediate family', 'Parents & relatives', 'Extended family']

export default function HudPanel({ member, onClose, onEdit, onDeleted }) {
  const [showPassedForm, setShowPassedForm] = useState(false)
  const [deceaseYear,    setDeceaseYear]    = useState('')
  const [saving,        setSaving]          = useState(false)
  const [confirmDel,    setConfirmDel]      = useState(false)
  const [deleting,      setDeleting]        = useState(false)

  if (!member) return null

  const alive      = member.alive !== false
  const ringLabel  = RING_LABELS[member.ring] || 'Family member'
  const initial    = (member.avatar || member.name?.slice(0, 2) || '?').toUpperCase()

  // Color tokens for this member
  const accent  = alive ? '#4aaa4a' : '#c8a020'
  const accentBg = alive ? 'rgba(74,170,74,0.10)' : 'rgba(200,160,30,0.10)'
  const accentBorder = alive ? 'rgba(74,170,74,0.22)' : 'rgba(200,160,30,0.22)'
  const nodeBg  = alive ? 'rgba(8,22,8,0.96)' : 'rgba(20,14,2,0.96)'
  const nodeText = alive ? '#90d890' : '#d4b840'

  async function handleMarkPassed() {
    if (!deceaseYear) return
    setSaving(true)
    try {
      await db.transact([
        db.tx.familyMembers[member.id].update({
          alive:     false,
          died:      Number(deceaseYear),
          updatedAt: Date.now(),
        }),
      ])
      setShowPassedForm(false)
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!confirmDel) { setConfirmDel(true); return }
    setDeleting(true)
    await db.transact([db.tx.familyMembers[member.id].delete()])
    onDeleted?.()
  }

  // Data rows to display
  const rows = [
    { label: 'Born',     value: member.born ?? '—' },
    { label: alive ? 'Status' : 'Passed', value: alive ? 'Living' : (member.died ?? '—') },
    { label: 'Ring',     value: ringLabel },
    { label: 'Relation', value: member.relation || '—' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={{   opacity: 0, y: 10, scale: 0.97  }}
      transition={{ type: 'spring', damping: 26, stiffness: 260 }}
      style={{
        position:  'fixed',
        bottom:    22,
        left:      18,
        width:     254,
        zIndex:    50,
      }}
    >
      <div style={{
        background:         'rgba(10,10,15,0.88)',
        backdropFilter:     'blur(32px) saturate(160%)',
        WebkitBackdropFilter: 'blur(32px) saturate(160%)',
        border:             '1px solid rgba(255,255,255,0.09)',
        borderRadius:       20,
        overflow:           'hidden',
        boxShadow:          '0 28px 56px rgba(0,0,0,0.60), 0 1px 0 rgba(255,255,255,0.06) inset',
      }}>

        {/* Colored top accent line */}
        <div style={{
          height:     2,
          background: `linear-gradient(90deg, transparent 0%, ${accent} 30%, ${accent} 70%, transparent 100%)`,
          opacity:    0.55,
        }} />

        <div style={{ padding: 16 }}>

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 14, right: 14,
              width: 24, height: 24, borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.35)',
              fontSize: 11, lineHeight: '24px', textAlign: 'center',
              transition: 'all 0.15s',
            }}
          >
            ✕
          </button>

          {/* ── Avatar + name ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 15 }}>

            {/* Avatar */}
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: nodeBg,
              border: `1.5px solid ${accent}`,
              boxShadow: `0 0 18px ${accentBg.replace('0.10', '0.22')}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 19, fontWeight: 700, color: nodeText,
              flexShrink: 0, overflow: 'hidden',
            }}>
              {member.photo
                ? <img loading="lazy" decoding="async" src={member.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initial}
            </div>

            {/* Name block */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Relation chip */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: accentBg,
                border: `1px solid ${accentBorder}`,
                borderRadius: 30,
                padding: '2px 8px',
                marginBottom: 4,
              }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: accent }} />
                <span style={{
                  fontFamily: "'Inter', -apple-system, sans-serif",
                  fontSize: 9, fontWeight: 600, letterSpacing: '0.06em',
                  textTransform: 'uppercase', color: accent, opacity: 0.85,
                }}>
                  {member.relation || 'Family member'}
                </span>
              </div>

              {/* Name */}
              <div style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: 17, fontWeight: 700, color: 'rgba(255,255,255,0.95)',
                lineHeight: 1.2, marginBottom: 2,
              }}>
                {member.name}
              </div>

              {/* Location */}
              {member.bio && (
                <div style={{
                  fontFamily: "'Inter', -apple-system, sans-serif",
                  fontSize: 11, color: 'rgba(255,255,255,0.32)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {member.bio.slice(0, 28)}
                </div>
              )}
            </div>
          </div>

          {/* Status pill */}
          <div style={{ marginBottom: 15 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: accentBg,
              border: `1px solid ${accentBorder}`,
              borderRadius: 30,
              padding: '4px 10px 4px 7px',
            }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: accent, boxShadow: `0 0 5px ${accent}`,
              }} />
              <span style={{
                fontFamily: "'Inter', -apple-system, sans-serif",
                fontSize: 10, fontWeight: 500, color: accent,
              }}>
                {alive ? 'Living' : 'Deceased'}
              </span>
            </span>
          </div>

          {/* Thin divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.065)', marginBottom: 14 }} />

          {/* ── Data grid ─────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px 8px', marginBottom: 14 }}>
            {rows.map(({ label, value }) => (
              <div key={label}>
                <div style={{
                  fontFamily: "'Inter', -apple-system, sans-serif",
                  fontSize: 9, fontWeight: 500, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)',
                  marginBottom: 3,
                }}>
                  {label}
                </div>
                <div style={{
                  fontFamily: "'Inter', -apple-system, sans-serif",
                  fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.72)',
                  lineHeight: 1.3,
                }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* ── Mark as passed — inline form ────────────────────────── */}
          <AnimatePresence>
            {showPassedForm && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: 'hidden', marginBottom: 10 }}
              >
                <div style={{
                  background: 'rgba(200,160,30,0.07)',
                  border: '1px solid rgba(200,160,30,0.18)',
                  borderRadius: 12, padding: '11px 12px',
                }}>
                  <p style={{
                    fontFamily: "'Inter', -apple-system, sans-serif",
                    fontSize: 10, color: 'rgba(200,160,30,0.75)',
                    marginBottom: 8,
                  }}>
                    Year they passed
                  </p>
                  <div style={{ display: 'flex', gap: 7 }}>
                    <input
                      type="number"
                      value={deceaseYear}
                      onChange={e => setDeceaseYear(e.target.value)}
                      placeholder="e.g. 2024"
                      style={{
                        flex: 1,
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 8, padding: '6px 10px',
                        color: '#fff', fontSize: 12, outline: 'none',
                        fontFamily: "'Inter', sans-serif",
                      }}
                    />
                    <button
                      onClick={handleMarkPassed}
                      disabled={saving || !deceaseYear}
                      style={{
                        background: 'rgba(200,160,30,0.18)',
                        border: '1px solid rgba(200,160,30,0.30)',
                        borderRadius: 8, padding: '6px 12px',
                        color: '#c8a020', fontSize: 11, fontWeight: 600,
                        cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                        opacity: saving || !deceaseYear ? 0.5 : 1,
                      }}
                    >
                      {saving ? '…' : 'Save'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Action buttons ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 7 }}>
            <button
              onClick={onEdit}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 10,
                fontFamily: "'Inter', -apple-system, sans-serif",
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'rgba(255,255,255,0.55)',
                transition: 'all 0.15s',
              }}
            >
              Edit
            </button>

            {alive && (
              <button
                onClick={() => setShowPassedForm(f => !f)}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 10,
                  fontFamily: "'Inter', -apple-system, sans-serif",
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  background: showPassedForm ? 'rgba(200,160,30,0.12)' : 'rgba(255,255,255,0.04)',
                  border: showPassedForm
                    ? '1px solid rgba(200,160,30,0.28)'
                    : '1px solid rgba(255,255,255,0.08)',
                  color: showPassedForm ? '#c8a020' : 'rgba(255,255,255,0.40)',
                  transition: 'all 0.15s',
                }}
              >
                {showPassedForm ? 'Cancel' : 'Passed'}
              </button>
            )}

            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 10,
                fontFamily: "'Inter', -apple-system, sans-serif",
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: confirmDel ? 'rgba(220,38,38,0.12)' : 'rgba(255,255,255,0.04)',
                border: confirmDel
                  ? '1px solid rgba(220,38,38,0.28)'
                  : '1px solid rgba(255,255,255,0.08)',
                color: confirmDel ? 'rgba(252,110,110,0.90)' : 'rgba(255,255,255,0.30)',
                transition: 'all 0.15s',
                opacity: deleting ? 0.5 : 1,
              }}
            >
              {deleting ? '…' : confirmDel ? 'Sure?' : 'Remove'}
            </button>
          </div>

        </div>
      </div>
    </motion.div>
  )
}
