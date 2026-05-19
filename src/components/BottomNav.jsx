// src/components/BottomNav.jsx
// Profile tab now shows the user's actual avatar photo (from profile.photoUrl).
// Tapping it goes to /profile, not /settings.
// Clear visual distinction: YOUR photo in the nav = YOUR account profile.

import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { db } from '../lib/instant'

export default function BottomNav() {
  const location = useLocation()
  const { user } = db.useAuth()

  // Fetch profile for avatar display in the tab
  const { data } = db.useQuery(
    user ? { profiles: { $: { where: { userId: user.id } } } } : null
  )
  const profile = data?.profiles?.[0]

  const HIDE = ['/', '/auth', '/onboarding']
  if (HIDE.includes(location.pathname)) return null

  const active = (to) => location.pathname === to || location.pathname.startsWith(to + '/')

  const iconCls   = (to) => `transition-colors ${active(to) ? 'stroke-gold' : 'stroke-white/35'}`
  const labelCls  = (to) => `text-[0.55rem] font-semibold tracking-wide mt-0.5 ${active(to) ? 'text-gold' : 'text-white/30'}`
  const isProfile = active('/profile') || active('/settings')

  const displayName = profile?.displayName || user?.email?.split('@')[0] || ''
  const initials    = displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30"
      style={{
        background: 'linear-gradient(180deg, rgba(18,18,28,0.97) 0%, rgba(8,8,15,1) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.10)',
        boxShadow: '0 -1px 0 rgba(255,255,255,0.04) inset, 0 -8px 32px rgba(0,0,0,0.5)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
      <div className="flex items-center justify-around px-2 h-16">

        {/* Explore */}
        <Link to="/explore" className="flex flex-col items-center flex-1 py-2">
          <svg className={`w-5 h-5 ${iconCls('/explore')}`} fill="none" viewBox="0 0 24 24" strokeWidth={active('/explore') ? 2 : 1.6}>
            <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35"/>
          </svg>
          <span className={labelCls('/explore')}>Explore</span>
        </Link>

        {/* Dashboard */}
        <Link to="/dashboard" className="flex flex-col items-center flex-1 py-2">
          <svg className={`w-5 h-5 ${iconCls('/dashboard')}`} fill="none" viewBox="0 0 24 24" strokeWidth={active('/dashboard') ? 2 : 1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
          <span className={labelCls('/dashboard')}>Home</span>
        </Link>

        {/* Centre CREATE button */}
        <div className="flex flex-col items-center flex-1">
          <Link to="/create">
            <motion.div whileTap={{ scale: 0.90 }}
              className="w-12 h-12 -mt-5 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(160deg, #FFD700 0%, #D4A800 50%, #38BDF8 100%)',
                boxShadow: '0 0 0 2px rgba(8,8,15,1), 0 4px 16px rgba(255,215,0,0.40), 0 1px 0 rgba(255,255,255,0.35) inset',
              }}>
              <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
              </svg>
            </motion.div>
          </Link>
          <span className="text-[0.55rem] font-semibold text-white/30 mt-1">Create</span>
        </div>

        {/* Family */}
        <Link to="/family-tree" className="flex flex-col items-center flex-1 py-2">
          <svg className={`w-5 h-5 ${iconCls('/family-tree')}`} fill="none" viewBox="0 0 24 24" strokeWidth={active('/family-tree') ? 2 : 1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/>
          </svg>
          <span className={labelCls('/family-tree')}>Family</span>
        </Link>

        {/* Profile — shows the user's ACTUAL profile photo */}
        <Link to="/profile" className="flex flex-col items-center flex-1 py-2">
          <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
            style={{
              border: isProfile ? '2px solid #FFD700' : '2px solid rgba(255,255,255,0.15)',
              boxShadow: isProfile ? '0 0 8px rgba(255,215,0,0.4)' : 'none',
            }}>
            {profile?.photoUrl ? (
              <img src={profile.photoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-display text-[0.5rem] font-bold"
                style={{
                  background: isProfile ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.06)',
                  color: isProfile ? '#FFD700' : 'rgba(255,255,255,0.35)',
                }}>
                {initials || (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                )}
              </div>
            )}
          </div>
          <span className={labelCls('/profile')}>Profile</span>
        </Link>

      </div>
    </nav>
  )
}
