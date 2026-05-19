// src/components/Navigation.jsx — dark theme restored

import { useState, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '../lib/instant'
import { useNotifications } from '../hooks/useNotifications'

const NAV_LINKS = [
  { to:'/explore',     label:'Explore'   },
  { to:'/dashboard',   label:'Dashboard' },
  { to:'/family-tree', label:'Family'    },
  { to:'/premium',     label:'Premium ✦' },
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

  const active = (to) => location.pathname === to || location.pathname.startsWith(to + '/')

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

            {user && (
              <Link to="/settings"
                className="hidden md:flex items-center gap-1.5 text-white/50 hover:text-white text-xs font-medium px-3 py-2 rounded-full hover:bg-white/5 transition-all">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
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
                <>
                  <Link to="/profile" onClick={() => setMenuOpen(false)}
                    className="block px-4 py-3 rounded-xl text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white transition-all">
                    Profile
                  </Link>
                  <Link to="/settings" onClick={() => setMenuOpen(false)}
                    className="block px-4 py-3 rounded-xl text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white transition-all">
                    Settings
                  </Link>
                </>
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
