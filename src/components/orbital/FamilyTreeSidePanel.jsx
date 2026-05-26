// src/components/orbital/FamilyTreeSidePanel.jsx
//
// Persistent right rail (desktop) / collapsible bottom sheet (mobile) that
// sits next to the orbital canvas. Always visible by default so the user
// can see selected-profile details + member counts at a glance.
//
// Props:
//   scope         — 'memorial' | 'user'
//   centerLabel   — display name of the current centre
//   selected      — { id, name, photo, relation } | null → falls back to centre
//   members       — array of orbiters (used for stats)
//   pendingCount  — number (optional, shown only when scope='memorial' + isOwner)
//   isOwner       — boolean
//   onInvite      — () => void
//   onOpenPending — () => void
//   subtitle      — short string under the title (e.g. memorial dates)

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getRelationFilterCategory } from '../../lib/relations'

// Mobile detection via media query — driven by CSS so we avoid re-renders
const PANEL_W   = 276
const PANEL_TOP = 88   // sit below the top bar

const FAMILY_CATS = new Set(['partner','children','siblings','parents','extended','grandparents'])

function StatTile({ label, value, accent = '#FFD700' }) {
  return (
    <div style={{
      flex: 1,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      padding: '9px 11px',
      minWidth: 0,
    }}>
      <p style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 8.5, letterSpacing: '.18em', textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.42)', margin: 0,
      }}>
        {label}
      </p>
      <p style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontWeight: 700, fontSize: 20, lineHeight: 1.05,
        color: accent, margin: '2px 0 0', letterSpacing: '-.02em',
      }}>
        {value}
      </p>
    </div>
  )
}

function RelationBar({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: 'rgba(255,255,255,0.62)', fontWeight: 600 }}>
          {label}
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'rgba(255,255,255,0.4)' }}>
          {count}
        </span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 2,
          background: color, transition: 'width 400ms',
        }} />
      </div>
    </div>
  )
}

export default function FamilyTreeSidePanel({
  scope         = 'memorial',
  centerLabel   = 'Memorial',
  selected      = null,
  members       = [],
  pendingCount  = 0,
  isOwner       = false,
  onInvite,
  onOpenPending,
  subtitle      = '',
}) {
  const [mobileOpen, setMobileOpen] = useState(false)

  // Breakdown by relation type — drives the bars
  const breakdown = useMemo(() => {
    let family = 0, friends = 0, other = 0
    members.forEach(m => {
      const raw = m.rawRelation || m.relation
      const cat = getRelationFilterCategory(raw)
      if (FAMILY_CATS.has(cat))   family++
      else if (cat === 'friends') friends++
      else                         other++
    })
    return { family, friends, other }
  }, [members])

  const display = selected || {
    name:     centerLabel,
    photo:    null,
    relation: scope === 'memorial' ? '✦ Centre of the circle' : 'You',
    isCenter: true,
  }

  // Hide the panel entirely when nothing useful to show
  const total = members.length

  const Body = (
    <>
      {/* Header */}
      <div style={{ marginBottom: 12 }}>
        <p style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 8.5, letterSpacing: '.26em', textTransform: 'uppercase',
          color: 'rgba(255,215,0,0.65)', margin: 0,
        }}>
          ◉ {scope === 'memorial' ? 'Family circle' : 'Your family'}
        </p>
        <h3 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontWeight: 700, fontSize: 17, color: '#fff',
          margin: '3px 0 1px', letterSpacing: '-.01em', lineHeight: 1.15,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {centerLabel}
        </h3>
        {subtitle && (
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 10.5,
            color: 'rgba(255,255,255,0.40)', margin: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Selected profile card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255,215,0,0.06) 0%, rgba(56,189,248,0.04) 100%)',
        border: '1px solid rgba(255,215,0,0.20)',
        borderRadius: 14, padding: '10px 11px 11px',
        marginBottom: 12,
      }}>
        <p style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 8, letterSpacing: '.22em', textTransform: 'uppercase',
          color: 'rgba(255,215,0,0.55)', margin: '0 0 7px',
        }}>
          Selected
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(255,215,0,.22), rgba(56,189,248,.18))',
            border: '1.5px solid rgba(255,215,0,0.35)',
            overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 15, fontWeight: 700, color: '#FFD700',
          }}>
            {display.photo
              ? <img loading="lazy" decoding="async" src={display.photo} alt={display.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (display.name?.[0] || '?').toUpperCase()
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 12.5,
              color: '#fff', margin: 0, lineHeight: 1.2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {display.name}
            </p>
            <p style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 8.5, letterSpacing: '.14em', textTransform: 'uppercase',
              color: '#FFD700', margin: '3px 0 0',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {display.relation || 'family'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats — total + pending */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <StatTile
          label="Total members"
          value={total}
          accent="#FFD700"
        />
        {scope === 'memorial' && isOwner ? (
          <StatTile
            label="Pending"
            value={pendingCount}
            accent={pendingCount > 0 ? '#FFCC4D' : 'rgba(255,255,255,0.55)'}
          />
        ) : (
          <StatTile
            label="Generations"
            value={total > 0 ? Math.min(3, Math.ceil(Math.sqrt(total))) : 0}
            accent="#38BDF8"
          />
        )}
      </div>

      {/* Pending alert */}
      {scope === 'memorial' && isOwner && pendingCount > 0 && (
        <button onClick={onOpenPending}
          style={{
            width: '100%', marginBottom: 12,
            background: 'rgba(255,215,0,0.10)',
            border: '1px solid rgba(255,215,0,0.30)',
            borderRadius: 12, padding: '8px 10px',
            color: '#FFD700', cursor: 'pointer',
            fontFamily: "'Inter', sans-serif",
            fontSize: 11, fontWeight: 700, letterSpacing: '.04em',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
          <span style={{
            display: 'inline-flex', width: 20, height: 20, borderRadius: 10,
            background: 'rgba(255,215,0,0.22)', color: '#FFD700',
            alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 10.5,
          }}>
            {pendingCount}
          </span>
          <span style={{ flex: 1, textAlign: 'left' }}>
            Review {pendingCount === 1 ? 'request' : 'requests'}
          </span>
          <span>→</span>
        </button>
      )}

      {/* Relation breakdown — only when there's actually a meaningful mix */}
      {total >= 2 && (breakdown.family > 0 || breakdown.friends > 0 || breakdown.other > 0) && (
        <div style={{
          marginBottom: 12,
          padding: '10px 11px 4px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 12,
        }}>
          <p style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 8.5, letterSpacing: '.20em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.35)', margin: '0 0 8px',
          }}>
            Breakdown
          </p>
          {breakdown.family > 0 && (
            <RelationBar label="Family" count={breakdown.family} total={total} color="linear-gradient(90deg, #FFD700, #FFB400)" />
          )}
          {breakdown.friends > 0 && (
            <RelationBar label="Friends" count={breakdown.friends} total={total} color="linear-gradient(90deg, #38BDF8, #60c0dc)" />
          )}
          {breakdown.other > 0 && (
            <RelationBar label="Other" count={breakdown.other} total={total} color="rgba(255,255,255,.35)" />
          )}
        </div>
      )}

      {/* Invite CTA */}
      {isOwner && (
        <button onClick={onInvite}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #FFD700 0%, #38BDF8 130%)',
            border: 'none', borderRadius: 12, padding: '10px 0',
            color: '#0a0a12', cursor: 'pointer',
            fontFamily: "'Inter', sans-serif",
            fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase',
            boxShadow: '0 4px 14px rgba(255,215,0,0.22)',
          }}>
          ✦ Invite family
        </button>
      )}
    </>
  )

  return (
    <>
      {/* Desktop right rail — auto-height (no stretch to viewport bottom) */}
      <div
        className="ftsp-desktop"
        style={{
          position: 'fixed',
          top: PANEL_TOP, right: 16,
          width: PANEL_W,
          maxHeight: `calc(100vh - ${PANEL_TOP + 32}px)`,
          zIndex: 22,
          background: 'rgba(10,10,15,0.82)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          padding: '16px 14px',
          overflowY: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.55)',
        }}>
        {Body}
      </div>

      {/* Mobile — compact circular FAB in the corner */}
      <button
        className="ftsp-mobile-pill"
        onClick={() => setMobileOpen(true)}
        aria-label="Family stats"
        style={{
          position: 'fixed',
          bottom: 'calc(82px + env(safe-area-inset-bottom))',
          right: 16,
          zIndex: 22,
          width: 48, height: 48,
          borderRadius: '50%',
          background: 'rgba(10,10,15,0.88)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,215,0,0.30)',
          color: '#FFD700', cursor: 'pointer',
          fontFamily: "'Cormorant Garamond', serif",
          fontWeight: 700, fontSize: 18,
          boxShadow: '0 6px 24px rgba(0,0,0,0.55)',
          padding: 0,
          position: 'fixed',
        }}>
        {/* Number + tiny pending dot */}
        <span style={{ display: 'block', lineHeight: 1, position: 'relative' }}>
          {total}
          {scope === 'memorial' && isOwner && pendingCount > 0 && (
            <span style={{
              position: 'absolute',
              top: -10, right: -12,
              width: 16, height: 16, borderRadius: 8,
              background: '#FFD700', color: '#0a0a12',
              fontFamily: "'Inter',sans-serif", fontWeight: 800, fontSize: 9,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1.5px solid #06060a',
            }}>
              {pendingCount}
            </span>
          )}
        </span>
      </button>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="ftsp-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 30, backdropFilter: 'blur(8px)' }}
            />
            <motion.div
              key="ftsp-sheet"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 31,
                background: '#0a0a14', borderTopLeftRadius: 24, borderTopRightRadius: 24,
                padding: '14px 18px 30px', maxWidth: 560, margin: '0 auto',
                border: '1px solid rgba(255,255,255,0.08)',
                maxHeight: '85vh', overflowY: 'auto',
              }}>
              <div style={{ width: 42, height: 4, background: 'rgba(255,255,255,.18)', borderRadius: 2, margin: '0 auto 16px' }} />
              {Body}
              <button onClick={() => setMobileOpen(false)}
                style={{
                  width: '100%', marginTop: 14, padding: '11px 0',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 12, color: 'rgba(255,255,255,0.55)',
                  cursor: 'pointer', fontFamily: "'Inter',sans-serif",
                  fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase',
                }}>
                Close
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`
        .ftsp-desktop  { display: block; }
        .ftsp-mobile-pill { display: none; }
        @media (max-width: 1023px) {
          .ftsp-desktop  { display: none; }
          .ftsp-mobile-pill { display: inline-flex; align-items: center; justify-content: center; }
        }
      `}</style>
    </>
  )
}
