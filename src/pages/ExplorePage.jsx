// src/pages/ExplorePage.jsx
// Filter tabs: All | My Profile | Created | Family | Friends
//   • All        — global public memorials (anyone can browse)
//   • My Profile — the user's OWN living legacy (isSelf: true)
//   • Created    — memorials the user created for OTHERS (createdBy = me, !isSelf)
//   • Family     — subset of Created where relation is family
//   • Friends    — subset of Created where relation is 'friends'

import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '../lib/instant'
import { getRelationFilterCategory } from '../lib/relations'
import { countryFlag } from '../lib/countries'
import exploreBg from '../assets/explore-bg.webp'
import { SkeletonGrid } from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'

// ─── Filter definitions ───────────────────────────────────────────────────────

const MAIN_FILTERS = [
  { id: 'all',     label: 'All',        icon: '◉', desc: 'Global public memorials' },
  { id: 'self',    label: 'My Profile', icon: '✦', desc: 'Your own living legacy' },
  { id: 'created', label: 'Created',    icon: '★', desc: 'Memorials you built for others' },
  { id: 'family',  label: 'Family',     icon: '♡', desc: 'Your family memorials' },
  { id: 'friends', label: 'Friends',    icon: '☺', desc: 'Your friend memorials' },
]

const FAMILY_CATS = new Set(['partner','children','siblings','parents','extended','grandparents'])

const SORT_OPTIONS = [
  { id: 'recent',   label: 'Recently Added' },
  { id: 'tributes', label: 'Most Tributes'  },
  { id: 'featured', label: 'Featured'       },
]

// ─── Memorial card ────────────────────────────────────────────────────────────

function MemorialCard({ memorial, index }) {
  const tributeCount = memorial.tributes?.length || memorial.tributeCount || 0
  const flag         = memorial.countryCode ? countryFlag(memorial.countryCode) : ''
  const isLiving     = memorial.alive !== false
  const photo        = memorial.photo || memorial.coverPhoto

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.25) }}
    >
      <Link to={`/memorial/${memorial.id}`} className="group block rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, rgba(22,22,36,0.98) 0%, rgba(14,14,24,0.98) 100%)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.05) inset',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,215,0,0.15), 0 1px 0 rgba(255,255,255,0.08) inset'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.05) inset'
        }}
      >
        {/* Photo section */}
        <div className="relative h-44 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.08) 0%, rgba(56,189,248,0.05) 100%)' }}>
          {photo ? (
            <img src={photo} alt={memorial.name}
              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="font-display text-6xl font-bold"
                style={{ color: 'rgba(255,215,0,0.12)' }}>
                {memorial.name?.charAt(0)}
              </span>
            </div>
          )}

          {/* Strong gradient scrim */}
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(14,14,24,1) 0%, rgba(14,14,24,0.4) 45%, rgba(0,0,0,0.1) 100%)' }} />

          {/* Top badges */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isLiving ? 'bg-emerald-400' : 'bg-amber-400'}`}
                style={{ boxShadow: `0 0 6px ${isLiving ? 'rgba(52,211,153,0.8)' : 'rgba(255,215,0,0.8)'}` }} />
              <span className="text-[0.6rem] font-semibold tracking-wide uppercase"
                style={{ color: isLiving ? 'rgba(52,211,153,0.85)' : 'rgba(255,215,0,0.75)' }}>
                {isLiving ? 'Living' : 'In memory'}
              </span>
            </div>
            {flag && <span className="text-lg leading-none">{flag}</span>}
          </div>

          {/* Voice badge */}
          {memorial.elevenLabsVoiceId && (
            <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full px-2 py-0.5"
              style={{ background: 'rgba(251,146,60,0.2)', border: '1px solid rgba(251,146,60,0.35)' }}>
              <span className="text-orange-400 text-[0.55rem]">◉</span>
              <span className="text-orange-400 text-[0.55rem] font-semibold">Voice</span>
            </div>
          )}
        </div>

        {/* Info section */}
        <div className="p-4">
          <h3 className="font-display text-base font-bold text-white leading-tight truncate mb-0.5">
            {memorial.name}
          </h3>

          {(memorial.years || memorial.born || memorial.died) && (
            <p className="text-[0.65rem] font-medium mb-2"
              style={{ color: 'rgba(255,215,0,0.55)' }}>
              {memorial.years || `${memorial.born || ''}${memorial.died ? ` – ${memorial.died}` : ''}`}
            </p>
          )}

          {memorial.subtitle && (
            <p className="text-xs leading-relaxed line-clamp-2 mb-3"
              style={{ color: 'rgba(255,255,255,0.45)' }}>
              {memorial.subtitle}
            </p>
          )}

          {/* Footer row */}
          <div className="flex items-center justify-between pt-3"
            style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            {tributeCount > 0 ? (
              <span className="text-[0.6rem] font-semibold flex items-center gap-1"
                style={{ color: 'rgba(255,255,255,0.35)' }}>
                <span style={{ color: 'rgba(255,100,100,0.7)' }}>♡</span>
                {tributeCount} tribute{tributeCount !== 1 ? 's' : ''}
              </span>
            ) : (
              <span className="text-[0.6rem]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                No tributes yet
              </span>
            )}
            <span className="text-[0.6rem] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.3)',
              }}>
              View →
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Featured card ────────────────────────────────────────────────────────────

function FeaturedCard({ memorial }) {
  const flag  = memorial.countryCode ? countryFlag(memorial.countryCode) : ''
  const photo = memorial.photo || memorial.coverPhoto
  const trib  = memorial.tributes?.length || memorial.tributeCount || 0

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Link to={`/memorial/${memorial.id}`} className="block rounded-3xl overflow-hidden"
        style={{
          boxShadow: '0 12px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,215,0,0.12)',
        }}>
        <div className="relative h-64 md:h-80">
          {photo
            ? <img src={photo} alt={memorial.name} className="w-full h-full object-cover object-center" />
            : <div className="w-full h-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.12) 0%, rgba(56,189,248,0.08) 100%)' }}>
                <span className="font-display text-9xl font-bold"
                  style={{ color: 'rgba(255,215,0,0.10)' }}>{memorial.name?.charAt(0)}</span>
              </div>
          }
          {/* Strong cinematic overlay */}
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.1) 100%)' }} />

          {/* Top right: flag */}
          {flag && (
            <div className="absolute top-4 right-4 text-2xl">{flag}</div>
          )}

          {/* Bottom content */}
          <div className="absolute bottom-0 left-0 right-0 p-6">
            {/* Featured badge */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.30)' }}>
                <span className="text-amber-400 text-[0.6rem]">✦</span>
                <span className="text-[0.6rem] font-bold tracking-[0.15em] uppercase text-amber-400">Featured</span>
              </div>
              {trib > 0 && (
                <span className="text-[0.6rem] text-white/45">
                  ♡ {trib} tribute{trib !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            <h2 className="font-display text-2xl md:text-3xl font-bold text-white mb-1.5 leading-tight">
              {memorial.name}
            </h2>
            {memorial.subtitle && (
              <p className="text-sm leading-relaxed line-clamp-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {memorial.subtitle}
              </p>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const [search,       setSearch]       = useState('')
  const [activeSort,   setActiveSort]   = useState('recent')
  const [activeFilter, setActiveFilter] = useState('all')

  const { user } = db.useAuth()

  const { isLoading, error, data } = db.useQuery({
    memorials: { $: { limit: 100 }, tributes: {} }
  })

  const memorials = useMemo(() =>
    (data?.memorials || []).filter(m => !m.visibility || m.visibility === 'public'),
    [data]
  )

  const featured = useMemo(() =>
    memorials.find(m => (m.tributes?.length || m.tributeCount || 0) > 3 || m.elevenLabsVoiceId),
    [memorials]
  )

  const filtered = useMemo(() => {
    let list = [...memorials]

    // Helper — is this memorial owned by the current user?
    const ownedByMe = (m) => user && (m.createdBy === user.id || m.creatorId === user.id)

    // ── Filter by tab ─────────────────────────────────────────────────────
    if (activeFilter === 'self') {
      if (!user) return []
      // The user's own living legacy — isSelf === true
      list = list.filter(m => ownedByMe(m) && m.isSelf === true)
    } else if (activeFilter === 'created') {
      if (!user) return []
      // Memorials the user built for OTHERS — exclude the self-memorial
      list = list.filter(m => ownedByMe(m) && m.isSelf !== true)
    } else if (activeFilter === 'family') {
      if (!user) return []
      list = list.filter(m => {
        if (!ownedByMe(m) || m.isSelf === true) return false
        return FAMILY_CATS.has(getRelationFilterCategory(m.relation))
      })
    } else if (activeFilter === 'friends') {
      if (!user) return []
      list = list.filter(m => {
        if (!ownedByMe(m) || m.isSelf === true) return false
        return getRelationFilterCategory(m.relation) === 'friends'
      })
    }
    // 'all' → no additional filtering

    // ── Search ────────────────────────────────────────────────────────────
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(m =>
        m.name?.toLowerCase().includes(q)     ||
        m.subtitle?.toLowerCase().includes(q) ||
        m.location?.toLowerCase().includes(q) ||
        m.bio?.toLowerCase().includes(q)      ||
        m.relation?.toLowerCase().includes(q)
      )
    }

    // ── Sort ──────────────────────────────────────────────────────────────
    if (activeSort === 'recent') {
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    } else if (activeSort === 'tributes') {
      list.sort((a, b) =>
        (b.tributes?.length || b.tributeCount || 0) - (a.tributes?.length || a.tributeCount || 0)
      )
    } else if (activeSort === 'featured') {
      list = list.filter(m => m.elevenLabsVoiceId || (m.tributes?.length || m.tributeCount || 0) > 2)
    }

    return list
  }, [memorials, activeFilter, search, activeSort, user])

  // ─── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="relative z-10 min-h-screen pt-20 pb-28">
      <div className="max-w-7xl mx-auto px-5 md:px-8 space-y-6 pt-10">
        <div className="h-12 w-full bg-white/5 rounded-2xl animate-pulse" />
        <div className="h-11 w-full bg-white/5 rounded-2xl animate-pulse" />
        <SkeletonGrid count={8} />
      </div>
    </div>
  )

  if (error) return (
    <div className="relative z-10 min-h-screen flex items-center justify-center px-6">
      <div className="text-center">
        <div className="text-5xl mb-6 opacity-20">◎</div>
        <p className="text-white/50 text-sm mb-2">Could not load memorials.</p>
        <p className="text-white/30 text-xs">Check your connection and try again.</p>
      </div>
    </div>
  )

  const showFeatured = activeFilter === 'all' && !search.trim() && featured
  const needsLogin   = activeFilter !== 'all' && !user

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="relative z-10 pt-20 pb-28 min-h-screen">

      {/* Background — fully bright, no overlay */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="w-full h-full"
          style={{
            backgroundImage: `url(${exploreBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-5 md:px-8">

        {/* ── Search bar ─────────────────────────────────────────────────────── */}
        <div className="pt-6 pb-4">
          <div className="relative">
            {/* Search icon */}
            <svg className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none"
              style={{ color: 'rgba(255,215,0,0.5)' }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>

            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, location, or story…"
              className="w-full rounded-2xl text-white placeholder-white/30 focus:outline-none"
              style={{
                background: 'rgba(18,18,30,0.90)',
                border: '1.5px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                padding: '16px 48px 16px 52px',
                fontSize: '15px',
                boxShadow: '0 2px 20px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              onFocus={e => {
                e.target.style.borderColor = 'rgba(255,215,0,0.50)'
                e.target.style.boxShadow = '0 2px 20px rgba(0,0,0,0.5), 0 0 0 3px rgba(255,215,0,0.10)'
              }}
              onBlur={e => {
                e.target.style.borderColor = 'rgba(255,255,255,0.12)'
                e.target.style.boxShadow = '0 2px 20px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset'
              }}
            />

            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full transition-all"
                style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.06)' }}>
                ✕
              </button>
            )}
          </div>

          {search && (
            <p className="text-xs mt-2 ml-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {filtered.length === 0
                ? 'No memorials match your search.'
                : `${filtered.length} memorial${filtered.length !== 1 ? 's' : ''} found`}
            </p>
          )}
        </div>

        {/* ── Filter tabs ─────────────────────────────────────────────────────── */}
        <div className="mb-5">
          <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {MAIN_FILTERS.map(f => {
              const isActive = activeFilter === f.id
              return (
                <motion.button
                  key={f.id}
                  onClick={() => { setActiveFilter(f.id); setSearch('') }}
                  whileTap={{ scale: 0.96 }}
                  className="flex-shrink-0 flex items-center gap-2 font-semibold rounded-xl transition-all"
                  style={isActive ? {
                    background: 'linear-gradient(135deg, #FFD700 0%, #E6C200 50%, #38BDF8 140%)',
                    color: '#0a0a12',
                    padding: '10px 18px',
                    fontSize: '13px',
                    boxShadow: '0 4px 20px rgba(255,215,0,0.30), 0 1px 0 rgba(255,255,255,0.35) inset',
                    border: '1.5px solid transparent',
                  } : {
                    background: 'rgba(20,20,34,0.90)',
                    color: 'rgba(255,255,255,0.60)',
                    padding: '10px 18px',
                    fontSize: '13px',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
                    border: '1.5px solid rgba(255,255,255,0.12)',
                  }}
                >
                  <span style={{ fontSize: '14px', opacity: isActive ? 1 : 0.7 }}>{f.icon}</span>
                  {f.label}
                </motion.button>
              )
            })}
          </div>

          {/* Context hint */}
          {activeFilter !== 'all' && (
            <p className="text-[0.6rem] mt-2 ml-1" style={{ color: 'rgba(255,255,255,0.28)' }}>
              {user
                ? MAIN_FILTERS.find(f => f.id === activeFilter)?.desc
                : 'Sign in to filter by your memorials'}
            </p>
          )}
        </div>

        {/* ── Sort strip — only on All tab ─────────────────────────────────────── */}
        {activeFilter === 'all' && !search && (
          <div className="flex items-center gap-1.5 mb-6">
            <span className="text-[0.58rem] font-semibold tracking-widest uppercase mr-1"
              style={{ color: 'rgba(255,255,255,0.22)' }}>Sort</span>
            {SORT_OPTIONS.map(s => {
              const isActive = activeSort === s.id
              return (
                <button key={s.id} onClick={() => setActiveSort(s.id)}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                  style={isActive ? {
                    background: 'rgba(255,215,0,0.12)',
                    color: 'rgba(255,215,0,0.9)',
                    border: '1px solid rgba(255,215,0,0.25)',
                  } : {
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.35)',
                    border: '1px solid transparent',
                  }}>
                  {s.label}
                </button>
              )
            })}
          </div>
        )}
        {activeFilter !== 'all' && <div className="mb-6" />}

        {/* ── Featured card ────────────────────────────────────────────────────── */}
        {showFeatured && (
          <div className="mb-8">
            <FeaturedCard memorial={featured} />
          </div>
        )}

        {/* ── Login prompt ─────────────────────────────────────────────────────── */}
        {needsLogin ? (
          <div className="py-20 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl mb-6 flex items-center justify-center"
              style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.15)' }}>
              <span className="text-2xl" style={{ color: 'rgba(255,215,0,0.5)' }}>
                {MAIN_FILTERS.find(f => f.id === activeFilter)?.icon}
              </span>
            </div>
            <p className="font-display text-lg font-bold text-white mb-2">
              Sign in to see your {MAIN_FILTERS.find(f => f.id === activeFilter)?.label}
            </p>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.40)' }}>
              {MAIN_FILTERS.find(f => f.id === activeFilter)?.desc} will appear here.
            </p>
            <Link to="/auth"
              className="inline-flex items-center gap-2 font-bold rounded-xl px-6 py-3"
              style={{
                background: 'linear-gradient(135deg, #FFD700 0%, #D4A800 100%)',
                color: '#0a0a12',
                boxShadow: '0 4px 20px rgba(255,215,0,0.30)',
                fontSize: '14px',
              }}>
              Sign in →
            </Link>
          </div>

        ) : filtered.length === 0 ? (
          <div className="py-20 flex flex-col items-center text-center">
            <div className="text-5xl mb-5 opacity-15">
              {MAIN_FILTERS.find(f => f.id === activeFilter)?.icon || '◎'}
            </div>
            <p className="text-white/40 text-sm mb-3">
              {search
                ? 'No memorials match your search.'
                : activeFilter === 'self'
                  ? `You haven't created your own legacy yet.`
                : activeFilter === 'created'
                  ? `You haven't created any memorials for others yet.`
                : activeFilter !== 'all'
                  ? `No ${MAIN_FILTERS.find(f => f.id === activeFilter)?.label.toLowerCase()} memorials yet.`
                  : 'No memorials found.'
              }
            </p>
            <div className="flex items-center gap-3">
              {search && (
                <button onClick={() => setSearch('')}
                  className="text-xs underline transition-colors"
                  style={{ color: 'rgba(255,215,0,0.60)' }}>
                  Clear search
                </button>
              )}
              {activeFilter !== 'all' && (
                <button onClick={() => setActiveFilter('all')}
                  className="text-xs underline transition-colors"
                  style={{ color: 'rgba(255,215,0,0.60)' }}>
                  View all memorials
                </button>
              )}
              {/* CTA — adapts to which tab is empty */}
              {activeFilter === 'self' && (
                <Link to="/create?self=1"
                  className="text-xs font-semibold px-4 py-2 rounded-lg"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,215,0,0.18) 0%, rgba(56,189,248,0.14) 100%)',
                    color: '#FFD700',
                    border: '1px solid rgba(255,215,0,0.35)',
                  }}>
                  ✦ Build your living legacy
                </Link>
              )}
              {(activeFilter === 'created' || activeFilter === 'family' || activeFilter === 'friends') && (
                <Link to="/create"
                  className="text-xs font-semibold px-4 py-2 rounded-lg"
                  style={{
                    background: 'rgba(255,215,0,0.10)',
                    color: 'rgba(255,215,0,0.80)',
                    border: '1px solid rgba(255,215,0,0.20)',
                  }}>
                  + Create memorial
                </Link>
              )}
            </div>
          </div>

        ) : (
          <>
            {/* Count label */}
            {!search && activeFilter === 'all' && (
              <p className="text-[0.65rem] font-semibold tracking-wide uppercase mb-4"
                style={{ color: 'rgba(255,255,255,0.22)' }}>
                {filtered.length} memorial{filtered.length !== 1 ? 's' : ''}
              </p>
            )}

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <AnimatePresence mode="popLayout">
                {filtered.map((memorial, i) => (
                  <MemorialCard key={memorial.id} memorial={memorial} index={i} />
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
