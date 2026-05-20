// src/pages/FamilyTreePage.jsx — updated
// Uses HudPanel (floating corner card) instead of MemberDetailPanel (bottom sheet)
// Adds centre label overlay with the user's name
// Canvas is full-viewport so no container padding needed

import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '../lib/instant'
import { redeemInvite } from '../lib/invites'
import FamilyTreeOrb    from '../components/orbital/FamilyTreeOrb'
import HudPanel         from '../components/orbital/HudPanel'
import MemberFormModal  from '../components/members/MemberFormModal'
import SearchModal      from '../components/members/SearchModal'
import InviteModal      from '../components/shared/InviteModal'

const HIDDEN_ON = ['/auth', '/onboarding']

export default function FamilyTreePage() {
  const { user } = db.useAuth()
  const [selected,    setSelected]    = useState(null)
  const [showAdd,     setShowAdd]     = useState(false)
  const [showSearch,  setShowSearch]  = useState(false)
  const [showInvite,  setShowInvite]  = useState(false)
  const [centerId,    setCenterId]    = useState(null)
  const [searchParams] = useSearchParams()

  // ── Redeem invite code from URL ──────────────────────────────────────
  useEffect(() => {
    const code = searchParams.get('invite')
    if (!code || !user) return

    // Only attempt once — clear the param so it doesn't re-fire
    const newUrl = new URL(window.location)
    newUrl.searchParams.delete('invite')
    window.history.replaceState({}, '', newUrl)

    redeemInvite(code, user).then(result => {
      if (result.ok) {
        console.log('✅ Joined family via invite:', result.familyOwnerId)
      } else {
        console.warn('❌ Invite redemption:', result.reason)
      }
    })
  }, [searchParams, user])

  const { isLoading, data } = db.useQuery(
    user ? { familyMembers: { $: { where: { ownerId: user.id } } }, profiles: { $: { where: { userId: user.id } } } } : null
  )

  const members  = data?.familyMembers || []
  const profile  = data?.profiles?.[0]
  const userName = profile?.displayName || user?.email?.split('@')[0] || 'Family'

  if (!user) {
    return (
      <div className="dark-container relative z-10 min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-4xl mb-4 opacity-20">✿</div>
          <p className="text-white/50 text-sm mb-4">Sign in to view your family tree.</p>
          <Link to="/auth" className="text-xs font-bold text-gold border border-gold/30 px-6 py-2.5 rounded-full hover:bg-gold/10 transition-colors">Sign in</Link>
        </div>
      </div>
    )
  }

  function handleSelect(member) {
    if (!member) { setSelected(null); return }
    setSelected(member)
    setCenterId(member.id)
  }

  function handleDeleted() {
    setSelected(null); setCenterId(null)
  }

  // Count stats
  const living   = members.filter(m => m.alive !== false).length
  const deceased = members.filter(m => m.alive === false).length

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10, overflow: 'hidden' }}>

      {/* Full-viewport orbital canvas — sits as the base layer */}
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
        </div>
      ) : (
        <FamilyTreeOrb
          members={members}
          onSelectMember={handleSelect}
          centerMemberId={centerId}
        />
      )}

      {/* ── Centre label — user's name in the middle, always visible when nothing selected ── */}
      {!selected && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center', pointerEvents: 'none', zIndex: 5,
            // Offset so text sits just below where the center node would appear
            marginTop: 60,
          }}
        >
          <p style={{
            fontFamily: "'Inter', -apple-system, sans-serif",
            fontSize: 9, fontWeight: 600, letterSpacing: '0.22em',
            textTransform: 'uppercase', color: 'rgba(255,215,0,0.45)', marginBottom: 4,
          }}>
            Family Archive
          </p>
          <p style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 'clamp(14px,3vw,20px)', fontWeight: 700,
            color: 'rgba(255,255,255,0.88)', lineHeight: 1.2,
          }}>
            {userName}
          </p>

          {/* Empty state hint — shown inline below user's name, not as a conflicting overlay */}
          {!isLoading && members.length === 0 && (
            <div style={{ marginTop: 14 }}>
              <p style={{
                fontFamily: "'Inter', -apple-system, sans-serif",
                fontSize: 11, color: 'rgba(255,255,255,0.28)', marginBottom: 10,
              }}>
                No connections yet
              </p>
              <button
                onClick={() => setShowAdd(true)}
                style={{
                  pointerEvents: 'auto',
                  background: 'rgba(255,215,0,0.10)',
                  border: '1px solid rgba(255,215,0,0.25)',
                  borderRadius: 20, padding: '8px 20px',
                  color: 'rgba(255,215,0,0.75)',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}
              >
                + Add first member
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Top bar — controls ──────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
        paddingTop: 'max(52px, env(safe-area-inset-top))',
        paddingLeft: 16, paddingRight: 16, paddingBottom: 8,
        background: 'linear-gradient(to bottom, rgba(5,5,10,0.70) 0%, transparent 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        pointerEvents: 'none',
      }}>
        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, pointerEvents: 'auto' }}>
          <div style={{
            background: 'rgba(10,10,15,0.75)', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 20, padding: '5px 12px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ display:'flex',alignItems:'center',gap:4,fontSize:10,color:'rgba(255,255,255,0.45)' }}>
              <span style={{ width:5,height:5,borderRadius:'50%',background:'#4aaa4a',display:'inline-block' }} />
              {living}
            </span>
            <span style={{ color:'rgba(255,255,255,0.12)' }}>·</span>
            <span style={{ display:'flex',alignItems:'center',gap:4,fontSize:10,color:'rgba(255,255,255,0.45)' }}>
              <span style={{ width:5,height:5,borderRadius:'50%',background:'#c8a020',display:'inline-block' }} />
              {deceased}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, pointerEvents: 'auto' }}>
          {/* Search */}
          <button onClick={() => setShowSearch(true)}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(10,10,15,0.75)', backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.09)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'rgba(255,255,255,0.55)',
            }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </button>

          {/* Invite */}
          <button onClick={() => setShowInvite(true)}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(10,10,15,0.75)', backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.09)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'rgba(255,255,255,0.55)',
            }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
            </svg>
          </button>

          {/* Add member */}
          <button onClick={() => setShowAdd(true)}
            style={{
              height: 36, borderRadius: 18,
              background: 'linear-gradient(135deg, #FFD700, #38BDF8)',
              border: 'none',
              padding: '0 16px',
              display: 'flex', alignItems: 'center', gap: 5,
              cursor: 'pointer', color: '#000',
              fontFamily: "'Inter', -apple-system, sans-serif",
              fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            }}
          >
            <span style={{ fontSize: 14 }}>+</span>
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* Empty state is now integrated into the centre label above */}

      {/* ── Floating HUD panel ─────────────────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <HudPanel
            key={selected.id}
            member={selected}
            user={user}
            onClose={() => setSelected(null)}
            onEdit={() => { setShowAdd(true) }}
            onDeleted={handleDeleted}
          />
        )}
      </AnimatePresence>

      {/* ── Other modals ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAdd && (
          <MemberFormModal
            user={user}
            existing={selected}
            onClose={() => setShowAdd(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSearch && (
          <SearchModal
            members={members}
            onSelect={m => { setSelected(m); setCenterId(m.id); setShowSearch(false) }}
            onClose={() => setShowSearch(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showInvite && (
          <InviteModal user={user} onClose={() => setShowInvite(false)} />
        )}
      </AnimatePresence>

    </div>
  )
}
