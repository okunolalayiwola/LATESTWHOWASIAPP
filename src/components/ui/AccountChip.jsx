// src/components/ui/AccountChip.jsx
// A small, persistent "this is YOU (the account)" anchor, top-right.
// It quietly and permanently answers the owner-vs-memorial confusion:
// the chip is always your account; everything else on screen is content.
//
// Mount once near the top of main pages (Dashboard, Explore, FamilyTree,
// MemorialDetail). Hidden on auth/onboarding/landing. Tapping → /profile.

import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { db } from '../../lib/instant'

const HIDDEN_ON = ['/', '/auth', '/onboarding']

export default function AccountChip() {
  const { pathname } = useLocation()
  const { user }     = db.useAuth()

  const { data } = db.useQuery(
    user ? { profiles: { $: { where: { userId: user.id } } } } : null
  )

  if (!user) return null
  if (HIDDEN_ON.includes(pathname)) return null

  const profile     = data?.profiles?.[0]
  const displayName  = profile?.displayName || user.email?.split('@')[0] || 'You'
  const firstName    = displayName.split(' ')[0]
  const initials     = displayName
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const photo        = profile?.photoUrl

  const isOnProfile  = pathname === '/profile' || pathname === '/settings'

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="fixed top-4 right-4 z-40"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <Link
        to="/profile"
        aria-label="Your account"
        className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full transition-all hover:scale-[1.03]"
        style={{
          background: 'rgba(13,13,18,0.72)',
          border: isOnProfile
            ? '1px solid rgba(255,215,0,0.45)'
            : '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          boxShadow: isOnProfile
            ? '0 4px 16px rgba(0,0,0,0.4), 0 0 14px rgba(255,215,0,0.18)'
            : '0 4px 16px rgba(0,0,0,0.4)',
        }}
      >
        <div
          className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
          style={{
            background: photo ? 'transparent' : 'linear-gradient(135deg, rgba(255,215,0,0.25), rgba(56,189,248,0.20))',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          {photo
            ? <img loading="lazy" decoding="async" src={photo} alt="" className="w-full h-full object-cover" />
            : <span className="text-[0.6rem] font-bold text-white font-display">{initials}</span>}
        </div>
        <span className="text-xs font-semibold text-white/80 max-w-[88px] truncate hidden sm:block">
          {firstName}
        </span>
      </Link>
    </motion.div>
  )
}
