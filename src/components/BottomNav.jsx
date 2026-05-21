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

  // Exact-match routes to hide (top-level)
  const HIDE_EXACT = ['/', '/auth', '/onboarding', '/reels', '/create']
  // Prefix patterns to hide (focused flows with their own fixed bottom CTAs)
  const HIDE_PREFIX = ['/connect/family/verify', '/connect/facebook']
  // Path patterns for nested editor / focused flows
  const path = location.pathname
  const inFocusedFlow =
    HIDE_EXACT.includes(path) ||
    HIDE_PREFIX.some(p => path.startsWith(p)) ||
    /^\/memorial\/[^/]+\/(edit|conversation|letters|import|persona)$/.test(path)
  if (inFocusedFlow) return null

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

        {/* Reels */}
        <Link to="/reels" className="flex flex-col items-center flex-1 py-2">
          <svg className={`w-5 h-5 ${iconCls('/reels')}`} fill="none" viewBox="0 0 24 24" strokeWidth={active('/reels') ? 2 : 1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125h-1.5m2.625-13.125c0-.621-.504-1.125-1.125-1.125H4.5A1.125 1.125 0 003.375 5.625m18.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c0-.621-.504-1.125-1.125-1.125H18m1.125 2.625v-1.5c0-.621.504-1.125 1.125-1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h1.5m0 0c.621 0 1.125.504 1.125 1.125M13.125 12c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c0-.621.504-1.125 1.125-1.125h1.5m-7.5 0v1.5m0 0c0 .621-.504 1.125-1.125 1.125m1.125-1.125c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125" />
          </svg>
          <span className={labelCls('/reels')}>Reels</span>
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
