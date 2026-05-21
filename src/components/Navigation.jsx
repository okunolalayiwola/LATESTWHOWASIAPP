// src/components/Navigation.jsx — dark theme restored

import { useState, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '../lib/instant'
import { useNotifications } from '../hooks/useNotifications'

const NAV_LINKS = [
  { to:'/explore',                 label:'Explore'   },
  { to:'/dashboard',               label:'Dashboard' },
  { to:'/family-tree',             label:'Family'    },
  { to:'/dashboard?tab=messages',  label:'💬 Chat'   },
  { to:'/premium',                 label:'Premium ✦' },
]

export default function Navigation() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const { user, isLoading } = db.useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const { count: unreadCount, notifications, markAllSeen: markAllRead } = useNotifications(user)

  const HIDE = ['/', '/auth', '/onboarding']
  if (HIDE.includes(location.pathname) || isLoading) return null

  const active = (to) => {
    const [path, query] = to.split('?')
    const pathMatches = location.pathname === path || location.pathname.startsWith(path + '/')
    if (!query) return pathMatches && !location.search.includes('tab=messages')
    // Query-tagged links (e.g. /dashboard?tab=messages) only count as active
    // when the corresponding tab param is in the current URL.
    return pathMatches && location.search.includes(query)
  }

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-40"
        style={{ background:'rgba(8,8,15,0.85)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
        <div className="max-w-7xl mx-auto px-5 md:px-8 flex items-center justify-between h-14">

          <Link to="/" className="text-brand text-xl">WHO WAS I</Link>

          {/* Desktop */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ to, label }) => (
              <Link key={to} to={to}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  active(to) ? 'bg-white/8 text-white font-semibold' : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}>
                {label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Bell */}
            {user && (
              <div className="relative">
                <button onClick={() => { setBellOpen(o => !o); if (!bellOpen) markAllRead() }}
                  className="relative w-9 h-9 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/8 transition-all">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose text-white text-[0.55rem] font-bold flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                <AnimatePresence>
                  {bellOpen && (
                    <motion.div initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
                      className="absolute right-0 top-11 w-72 glass rounded-2xl overflow-hidden z-50">
                      <div className="px-4 py-3 border-b border-white/8">
                        <p className="text-xs font-bold tracking-widest uppercase text-cream-dim">Notifications</p>
                      </div>
                      <div className="max-h-72 overflow-y-auto scrollbar-hide">
                        {notifications.length === 0
                          ? <p className="text-xs text-white/30 text-center py-6">All caught up ✦</p>
                          : notifications.map((n, i) => (
                            <div key={i} className="px-4 py-3 hover:bg-white/4 border-b border-white/5 last:border-0">
                              <p className="text-xs text-white/65 leading-relaxed">{n.text}</p>
                              <p className="text-[0.55rem] text-white/25 mt-1">{n.time}</p>
                            </div>
                          ))
                        }
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {user && (
              <Link to="/create"
                className="hidden md:flex items-center gap-1.5 bg-gradient-to-r from-gold to-coral text-black text-xs font-bold tracking-wide px-4 py-2 rounded-full hover:opacity-90 transition-opacity">
                + Create
              </Link>
            )}

            {user && (
              <Link to="/profile"
                className="hidden md:flex items-center justify-center w-9 h-9 rounded-full text-white/50 hover:text-white hover:bg-white/8 transition-all"
                title="Profile">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </Link>
            )}

            <button onClick={() => setMenuOpen(o => !o)}
              className="md:hidden w-9 h-9 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/8 transition-all">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                {menuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />}
              </svg>
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div initial={{ opacity:0,y:-8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
            className="fixed top-14 left-0 right-0 z-39 px-5 py-4 space-y-1"
            style={{ background:'rgba(8,8,15,0.97)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
            {NAV_LINKS.map(({ to, label }) => (
              <Link key={to} to={to} onClick={() => setMenuOpen(false)}
                className={`block px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  active(to) ? 'bg-white/8 text-white font-semibold' : 'text-white/50 hover:bg-white/5 hover:text-white'
                }`}>
                {label}
              </Link>
            ))}
            <div className="pt-2 border-t border-white/6 mt-2 space-y-1">
              {user && (
                <Link to="/profile" onClick={() => setMenuOpen(false)}
                  className="block px-4 py-3 rounded-xl text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white transition-all">
                  Profile
                </Link>
              )}
              {user
                ? <button onClick={async () => { await db.auth.signOut(); navigate('/') }}
                    className="block w-full text-left px-4 py-3 rounded-xl text-sm text-rose/70 hover:bg-rose/5">
                    Sign out
                  </button>
                : <Link to="/auth" onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-semibold text-gold">Sign in</Link>
              }
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
