// src/pages/ChatPage.jsx
// Dedicated full-page family chat. Same FamilyChatPanel that used to be on
// the dashboard tab, now its own immersive page with the dark glass shell.

import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../lib/instant'
import FamilyMessagesSection from '../components/shared/FamilyMessagesSection'

// Same per-person colour palette helpers as the chat section ────────────────
const BUBBLE_PALETTE = [
  { bg: '#FFE981', accent: '#B79A0A' },
  { bg: '#FFC7D0', accent: '#A23B57' },
  { bg: '#B7DFF0', accent: '#1F6F8E' },
  { bg: '#C4EED4', accent: '#2E7A4C' },
  { bg: '#D8CBF6', accent: '#5A3F9E' },
  { bg: '#FFD7B3', accent: '#A85B22' },
  { bg: '#D3E3B9', accent: '#4F6E2E' },
  { bg: '#F9B27D', accent: '#8E4B14' },
]

export default function ChatPage() {
  const { user, isLoading } = db.useAuth()
  const [activeId, setActiveId] = useState(null)

  // (a) Memorials the user OWNS
  const ownQ = db.useQuery(
    user ? { memorials: { $: { where: { createdBy: user.id }, limit: 50 } } } : null
  )
  const owned = ownQ?.data?.memorials || []
  const ownedIds = owned.map(m => m.id)

  // (b) Approved family connections — memorials the user has access to
  const connQ = db.useQuery(
    user ? { familyConnections: { $: { where: { fromUserId: user.id, status: 'approved' } } } } : null
  )
  const connectedIds = (connQ?.data?.familyConnections || []).map(c => c.toMemorialId).filter(Boolean)

  // Fetch names/photos of memorials the user is connected to but doesn't own
  const otherQ = db.useQuery(
    connectedIds.length ? {
      memorials: { $: { where: { id: { $in: connectedIds } } } },
    } : null
  )
  const otherMems = otherQ?.data?.memorials || []

  // Build the chat list — owned + connected
  const chats = useMemo(() => {
    const arr = []
    const seen = new Set()
    owned.forEach(m => {
      if (seen.has(m.id)) return
      seen.add(m.id)
      arr.push({ id: m.id, name: m.name, photo: m.photo || m.coverPhoto || null, role: 'owner' })
    })
    otherMems.forEach(m => {
      if (seen.has(m.id)) return
      seen.add(m.id)
      arr.push({ id: m.id, name: m.name, photo: m.photo || m.coverPhoto || null, role: 'family' })
    })
    return arr
  }, [owned.map(m => m.id).join(), otherMems.map(m => m.id).join()])

  // All-message query for unread counts + previews across chats
  const allIds = [...new Set([...ownedIds, ...connectedIds])]
  const msgsQ = db.useQuery(allIds.length ? {
    familyMessages: { $: { where: { memorialId: { $in: allIds } } } },
  } : null)
  const allMsgs = msgsQ?.data?.familyMessages || []

  // Profile (for FamilyMessagesSection sending)
  const profileQ = db.useQuery(user ? { profiles: { $: { where: { userId: user.id } } } } : null)
  const profile  = profileQ?.data?.profiles?.[0]

  // Default-select the chat with unread, else first
  useEffect(() => {
    if (activeId || chats.length === 0) return
    const withUnread = chats.find(c => allMsgs.some(m =>
      m.memorialId === c.id && m.fromUserId !== user?.id &&
      !(Array.isArray(m.readBy) ? m.readBy : []).includes(user?.id)
    ))
    setActiveId((withUnread || chats[0]).id)
  }, [chats.length, activeId])

  const unreadFor = id => allMsgs.filter(m =>
    m.memorialId === id && m.fromUserId !== user?.id &&
    !(Array.isArray(m.readBy) ? m.readBy : []).includes(user?.id)
  ).length

  const lastMessageFor = id => {
    const msgs = allMsgs
      .filter(m => m.memorialId === id)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    return msgs[0]
  }

  if (isLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%',
        border: '2px solid rgba(255,215,0,0.20)', borderTopColor: '#FFD700',
        animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (!user) return (
    <div className="relative z-10 min-h-screen flex flex-col items-center justify-center text-center px-6">
      <div className="text-4xl opacity-20 mb-4">💬</div>
      <p className="text-white/60 mb-6">Sign in to access your family chats.</p>
      <Link to="/auth"
        className="text-sm font-bold rounded-full px-6 py-3"
        style={{
          background: 'linear-gradient(135deg, #FFD700, #38BDF8)',
          color: '#0a0a12',
        }}>
        Sign in →
      </Link>
    </div>
  )

  if (chats.length === 0) return (
    <div className="relative z-10 min-h-screen flex flex-col items-center justify-center text-center px-6"
      style={{
        paddingTop: 'max(80px, env(safe-area-inset-top))',
        paddingBottom: 'max(96px, env(safe-area-inset-bottom) + 80px)',
      }}>
      <div className="text-4xl opacity-15 mb-4">💬</div>
      <h1 className="font-display text-2xl font-bold text-white mb-3">No family chats yet</h1>
      <p className="text-sm text-white/55 max-w-md mb-6 leading-relaxed">
        Your family chats appear here once you create a memorial or get approved into someone else's family circle. Each memorial has its own private group chat.
      </p>
      <Link to="/family-tree"
        className="text-sm font-bold rounded-full px-6 py-3"
        style={{
          background: 'linear-gradient(135deg, #FFD700, #38BDF8)',
          color: '#0a0a12',
        }}>
        View family tree →
      </Link>
    </div>
  )

  return (
    <div className="cp-page" style={{
      minHeight: '100vh',
      paddingTop:    'max(80px, env(safe-area-inset-top) + 16px)',
      paddingBottom: 'max(96px, env(safe-area-inset-bottom) + 80px)',
      paddingLeft:   16, paddingRight: 16,
    }}>
      <div className="cp-shell">
        <header className="cp-head">
          <div>
            <p className="cp-eyebrow">💬 Secure family chat</p>
            <h1 className="cp-title">Family chats</h1>
          </div>
          <span className="cp-count">
            {chats.length} {chats.length === 1 ? 'chat' : 'chats'}
          </span>
        </header>

        <div className="cp-grid">
          {/* Chat list */}
          <aside className="cp-list">
            {chats.map(c => {
              const isActive = c.id === activeId
              const unread   = unreadFor(c.id)
              const last     = lastMessageFor(c.id)
              return (
                <button key={c.id} onClick={() => setActiveId(c.id)}
                  className={`cp-row ${isActive ? 'active' : ''}`}>
                  <div className="cp-avatar">
                    {c.photo
                      ? <img src={c.photo} alt="" />
                      : (c.name?.[0] || '?').toUpperCase()}
                  </div>
                  <div className="cp-row-body">
                    <div className="cp-row-top">
                      <span className="cp-name">{c.name}</span>
                      {unread > 0 && (
                        <span className="cp-unread">{unread > 9 ? '9+' : unread}</span>
                      )}
                    </div>
                    <p className="cp-preview">
                      {last
                        ? <><strong>{last.fromUserId === user?.id ? 'You' : (last.fromName?.split(' ')[0] || 'Family')}:</strong> {last.content?.slice(0, 60) || (last.photoUrl ? '📷 Photo' : '...')}</>
                        : <em>No messages yet</em>}
                    </p>
                  </div>
                </button>
              )
            })}
          </aside>

          {/* Active chat */}
          <div className="cp-chat">
            {activeId ? (
              <FamilyMessagesSection
                key={activeId}
                memorialId={activeId}
                user={user}
                userProfile={profile}
              />
            ) : (
              <div className="cp-pickprompt">Pick a chat to begin</div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .cp-page  { color: rgba(255,255,255,0.85); }
        .cp-shell {
          max-width: 1180px; margin: 0 auto;
          display: flex; flex-direction: column; gap: 18px;
          height: calc(100vh - 200px); min-height: 560px;
        }
        .cp-head {
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: 12px; padding: 0 4px;
        }
        .cp-eyebrow {
          margin: 0 0 6px; font-family: 'JetBrains Mono', monospace;
          font-size: 10px; letter-spacing: .22em; text-transform: uppercase;
          color: rgba(255,215,0,0.65);
        }
        .cp-title {
          margin: 0; font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 30px; font-weight: 700; letter-spacing: -.02em;
          color: #fff;
        }
        .cp-count {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px; letter-spacing: .18em; text-transform: uppercase;
          color: rgba(255,255,255,0.45);
        }

        .cp-grid {
          flex: 1; min-height: 0;
          display: grid; grid-template-columns: 300px 1fr; gap: 16px;
        }
        .cp-list {
          background: rgba(15,15,22,0.85);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 12px;
          display: flex; flex-direction: column; gap: 6px;
          overflow-y: auto;
        }
        .cp-row {
          display: flex; align-items: center; gap: 10px;
          width: 100%; text-align: left;
          padding: 9px 10px; border-radius: 12px;
          background: transparent; border: 1px solid transparent;
          cursor: pointer; transition: all .15s; color: #fff;
          font-family: inherit;
        }
        .cp-row:hover { background: rgba(255,255,255,0.04); }
        .cp-row.active {
          background: rgba(255,215,0,0.08);
          border-color: rgba(255,215,0,0.28);
        }
        .cp-avatar {
          width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, rgba(255,215,0,.20), rgba(56,189,248,.14));
          border: 1.5px solid rgba(255,215,0,0.28);
          overflow: hidden; display: flex; align-items: center; justify-content: center;
          font-family: 'Cormorant Garamond', Georgia, serif; font-size: 15px; font-weight: 700;
          color: #FFD700;
        }
        .cp-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .cp-row-body { flex: 1; min-width: 0; }
        .cp-row-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .cp-name {
          font-weight: 700; font-size: 13.5px; color: #fff;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .cp-unread {
          flex-shrink: 0; background: #dc3232; color: #fff;
          font-size: 10px; font-weight: 800;
          padding: 1px 7px; border-radius: 999px; min-width: 18px; text-align: center;
        }
        .cp-preview {
          margin: 3px 0 0; font-size: 11.5px; line-height: 1.4;
          color: rgba(255,255,255,0.45);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .cp-preview strong { color: rgba(255,255,255,0.85); font-weight: 700; }

        .cp-chat {
          background: rgba(15,15,22,0.85);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px; overflow: hidden;
          display: flex; flex-direction: column; min-height: 0;
        }
        .cp-pickprompt {
          flex: 1; display: flex; align-items: center; justify-content: center;
          color: rgba(255,255,255,0.35); font-size: 13px;
        }

        @media (max-width: 820px) {
          .cp-shell  { height: auto; }
          .cp-grid   { grid-template-columns: 1fr; }
          .cp-list   { max-height: 240px; }
          .cp-chat   { min-height: 560px; }
        }
      `}</style>
    </div>
  )
}
