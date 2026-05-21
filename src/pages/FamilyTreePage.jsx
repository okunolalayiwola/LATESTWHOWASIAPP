// src/pages/FamilyTreePage.jsx — v3
// Family tree driven by approved familyConnections only.
// "Add first member" removed — connections form by invite + email approval.
// Includes orbital canvas + searchable list view below.

import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '../lib/instant'
import FamilyTreeOrb    from '../components/orbital/FamilyTreeOrb'
import HudPanel         from '../components/orbital/HudPanel'
import SearchModal      from '../components/members/SearchModal'
import InviteModal      from '../components/shared/InviteModal'
import { getRelationLabel } from '../lib/relations'

export default function FamilyTreePage() {
  const { user } = db.useAuth()
  const navigate  = useNavigate()

  const [selected,   setSelected]   = useState(null)
  const [showSearch, setShowSearch]  = useState(false)
  const [showInvite, setShowInvite]  = useState(false)
  const [centerId,   setCenterId]    = useState(null)
  const [viewMode,   setViewMode]    = useState('tree')   // 'tree' | 'list'
  const [listQuery,  setListQuery]   = useState('')
  const [searchParams] = useSearchParams()

  // Query approved family connections where this user is the owner
  // Also query their profile + any connections they made (as fromUser)
  const { isLoading, data } = db.useQuery(
    user ? {
      familyConnections: {
        $: { where: { toUserId: user.id, status: 'approved' } },
      },
      profiles: { $: { where: { userId: user.id } } },
    } : null
  )

  const connections = data?.familyConnections || []
  const profile     = data?.profiles?.[0]
  const userName    = profile?.displayName || user?.email?.split('@')[0] || 'Family'

  // Convert approved connections to the FamilyTreeOrb members format
  const members = useMemo(() => connections.map(conn => ({
    id:        conn.id,
    name:      conn.fromName || 'Family Member',
    photo:     conn.fromPhoto || null,
    relation:  conn.relation,
    alive:     true,   // we don't track this from connections yet
    ring:      1,      // all in ring 1 until we have deeper tree data
    generation: 1,
    connId:    conn.id,
    fromUserId: conn.fromUserId,
  })), [connections])

  if (!user) {
    return (
      <div className="relative z-10 min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-4xl mb-4 opacity-20">✿</div>
          <p className="text-white/50 text-sm mb-4">Sign in to view your family circle.</p>
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

  // Filtered list for the list view
  const filteredMembers = useMemo(() => {
    if (!listQuery.trim()) return members
    const q = listQuery.toLowerCase()
    return members.filter(m =>
      m.name?.toLowerCase().includes(q) ||
      getRelationLabel(m.relation)?.toLowerCase().includes(q)
    )
  }, [members, listQuery])

  // Stats
  const totalMembers = members.length

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10, overflow: 'hidden' }}>

      {/* ── Full-viewport canvas ─────────────────────────────────────────── */}
      {viewMode === 'tree' && (
        <>
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

          {/* Centre label */}
          {!selected && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center', pointerEvents: 'none', zIndex: 5,
                marginTop: 60,
              }}
            >
              <p style={{ fontFamily:"'Inter',sans-serif", fontSize:9, fontWeight:600,
                letterSpacing:'0.22em', textTransform:'uppercase', color:'rgba(255,215,0,0.45)', marginBottom:4 }}>
                Family Archive
              </p>
              <p style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'clamp(14px,3vw,20px)',
                fontWeight:700, color:'rgba(255,255,255,0.88)', lineHeight:1.2 }}>
                {userName}
              </p>

              {/* Empty state — invite link instead of "Add member" */}
              {!isLoading && members.length === 0 && (
                <div style={{ marginTop: 14 }}>
                  <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11,
                    color:'rgba(255,255,255,0.28)', marginBottom:10 }}>
                    No family connections yet
                  </p>
                  <button
                    onClick={() => setShowInvite(true)}
                    style={{
                      pointerEvents:'auto',
                      background:'rgba(255,215,0,0.10)',
                      border:'1px solid rgba(255,215,0,0.25)',
                      borderRadius:20, padding:'8px 20px',
                      color:'rgba(255,215,0,0.75)',
                      fontFamily:"'Inter',sans-serif",
                      fontSize:11, fontWeight:600, cursor:'pointer',
                    }}
                  >
                    Share invite code →
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </>
      )}

      {/* ── List view ────────────────────────────────────────────────────── */}
      {viewMode === 'list' && (
        <div style={{
          position:'absolute', inset:0, zIndex:6,
          background:'rgba(5,5,10,0.97)', backdropFilter:'blur(16px)',
          overflowY:'auto', paddingTop:'max(80px,env(safe-area-inset-top))',
          paddingBottom:120, paddingLeft:16, paddingRight:16,
        }}>
          <h2 style={{ fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:700,
            letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(255,255,255,.5)',
            marginBottom:12 }}>
            Family Members ({totalMembers})
          </h2>

          {/* Search bar */}
          <div style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)',
            borderRadius:14, display:'flex', alignItems:'center', gap:10,
            padding:'10px 14px', marginBottom:16 }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,.3)" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              value={listQuery}
              onChange={e => setListQuery(e.target.value)}
              placeholder="Search by name or relation…"
              style={{ background:'none', border:'none', outline:'none', flex:1,
                fontFamily:"'Inter',sans-serif", fontSize:13, color:'rgba(255,255,255,.8)',
                placeholder: 'rgba(255,255,255,.3)' }}
            />
          </div>

          {/* Members list */}
          {filteredMembers.length === 0 ? (
            <div style={{ textAlign:'center', padding:'48px 0' }}>
              <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:'rgba(255,255,255,.3)' }}>
                {members.length === 0
                  ? 'No family connections yet. Share your invite code to get started.'
                  : 'No results for "' + listQuery + '"'}
              </p>
              {members.length === 0 && (
                <button
                  onClick={() => setShowInvite(true)}
                  style={{ marginTop:16, pointerEvents:'auto',
                    background:'linear-gradient(90deg,#FFD700,#38BDF8)',
                    border:'none', borderRadius:20, padding:'10px 24px',
                    color:'#000', fontFamily:"'Inter',sans-serif",
                    fontSize:11, fontWeight:700, cursor:'pointer' }}>
                  Share invite code →
                </button>
              )}
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {filteredMembers.map(m => (
                <motion.div
                  key={m.id}
                  initial={{ opacity:0, y:8 }}
                  animate={{ opacity:1, y:0 }}
                  style={{
                    background:'rgba(255,255,255,.04)',
                    border:'1px solid rgba(255,255,255,.07)',
                    borderRadius:18, padding:'12px 16px',
                    display:'flex', alignItems:'center', gap:14,
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width:46, height:46, borderRadius:'50%', flexShrink:0,
                    background:'linear-gradient(135deg,rgba(255,215,0,.15),rgba(56,189,248,.15))',
                    border:'1px solid rgba(255,255,255,.10)',
                    overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:16, color:'rgba(255,255,255,.5)',
                  }}>
                    {m.photo
                      ? <img src={m.photo} alt={m.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      : (m.name?.[0] || '?').toUpperCase()
                    }
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontFamily:"'Inter',sans-serif", fontWeight:600, fontSize:14,
                      color:'rgba(255,255,255,.85)', margin:0, lineHeight:1.2 }}>
                      {m.name}
                    </p>
                    <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11,
                      color:'rgba(255,215,0,.55)', margin:'3px 0 0', letterSpacing:'.04em' }}>
                      {getRelationLabel(m.relation) || m.relation}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, zIndex:20,
        paddingTop:'max(52px, env(safe-area-inset-top))',
        paddingLeft:16, paddingRight:16, paddingBottom:8,
        background:'linear-gradient(to bottom, rgba(5,5,10,0.70) 0%, transparent 100%)',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        pointerEvents:'none',
      }}>
        {/* Stats pill */}
        <div style={{ pointerEvents:'auto', display:'flex', gap:10 }}>
          <div style={{
            background:'rgba(10,10,15,0.75)', backdropFilter:'blur(16px)',
            border:'1px solid rgba(255,255,255,0.09)',
            borderRadius:20, padding:'5px 12px',
            fontFamily:"'Inter',sans-serif", fontSize:10, color:'rgba(255,255,255,.45)',
            display:'flex', alignItems:'center', gap:6,
          }}>
            <span style={{ color:'rgba(255,215,0,.6)' }}>✦</span>
            {totalMembers} {totalMembers === 1 ? 'connection' : 'connections'}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display:'flex', gap:8, pointerEvents:'auto' }}>
          {/* Toggle tree/list */}
          <button
            onClick={() => setViewMode(v => v === 'tree' ? 'list' : 'tree')}
            style={{
              height:36, borderRadius:18, padding:'0 14px',
              background:'rgba(10,10,15,0.75)', backdropFilter:'blur(16px)',
              border:'1px solid rgba(255,255,255,0.09)',
              display:'flex', alignItems:'center', gap:6,
              cursor:'pointer', color:'rgba(255,255,255,.55)',
              fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:600,
            }}
          >
            {viewMode === 'tree' ? '☰ List' : '◉ Tree'}
          </button>

          {/* Search */}
          <button onClick={() => { setShowSearch(true) }}
            style={{
              width:36, height:36, borderRadius:'50%',
              background:'rgba(10,10,15,0.75)', backdropFilter:'blur(16px)',
              border:'1px solid rgba(255,255,255,0.09)',
              display:'flex', alignItems:'center', justifyContent:'center',
              cursor:'pointer', color:'rgba(255,255,255,.55)',
            }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </button>

          {/* Invite */}
          <button onClick={() => setShowInvite(true)}
            style={{
              height:36, borderRadius:18, padding:'0 16px',
              background:'linear-gradient(135deg,#FFD700,#38BDF8)',
              border:'none',
              display:'flex', alignItems:'center', gap:5,
              cursor:'pointer', color:'#000',
              fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:700, letterSpacing:'.06em',
            }}
          >
            <span style={{ fontSize:14 }}>+</span>
            <span>Invite</span>
          </button>
        </div>
      </div>

      {/* ── HUD panel when member selected ─────────────────────────────── */}
      <AnimatePresence>
        {selected && viewMode === 'tree' && (
          <HudPanel
            key={selected.id}
            member={selected}
            user={user}
            onClose={() => setSelected(null)}
            onEdit={() => {}}
            onDeleted={() => { setSelected(null); setCenterId(null) }}
          />
        )}
      </AnimatePresence>

      {/* ── Search modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSearch && (
          <SearchModal
            members={members}
            onSelect={m => { setSelected(m); setCenterId(m.id); setShowSearch(false); setViewMode('tree') }}
            onClose={() => setShowSearch(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Invite modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showInvite && (
          <InviteModal user={user} onClose={() => setShowInvite(false)} />
        )}
      </AnimatePresence>

    </div>
  )
}
