// src/pages/ExplorePage.jsx
// Global memorial discovery page.
// "All" tab = all public memorials worldwide (guests + logged-in).
// Relation tabs (Parents, Siblings…) = logged-in user's OWN public memorials filtered by that relation.
// Country flags rendered from memorial.countryCode.

import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '../lib/instant'
import { getRelationFilterCategory } from '../lib/relations'
import { countryFlag } from '../lib/countries'
import exploreBg from '../assets/explore-bg.webp'
import { SkeletonGrid } from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'

const SORT_OPTIONS = ['Recently Added', 'Most Tributes', 'Featured']

const REL_FILTERS = [
  { id: 'all',          label: 'All',          emoji: '◎' },
  { id: 'partner',      label: 'Partners',     emoji: '💍' },
  { id: 'children',     label: 'Children',     emoji: '🌱' },
  { id: 'siblings',     label: 'Siblings',     emoji: '🤝' },
  { id: 'parents',      label: 'Parents',      emoji: '✿' },
  { id: 'grandparents', label: 'Grandparents', emoji: '♡' },
  { id: 'friends',      label: 'Friends',      emoji: '☽' },
  { id: 'extended',     label: 'Extended',     emoji: '🌿' },
]

// ─── Memorial card ────────────────────────────────────────────────────────────

function MemorialCard({ memorial, index }) {
  const tributeCount = memorial.tributes?.length || memorial.tributeCount || 0
  const flag         = memorial.countryCode ? countryFlag(memorial.countryCode) : ''
  const relCat       = memorial.relation ? getRelationFilterCategory(memorial.relation) : null

  return (
    <motion.div
      initial={{ opacity:0, y:16 }}
      animate={{ opacity:1, y:0 }}
      transition={{ duration:0.4, delay: Math.min(index * 0.06, 0.3) }}
    >
      <Link to={`/memorial/${memorial.id}`}
        className="block metal-card rounded-2xl overflow-hidden hover:opacity-90 transition-opacity">

        {/* Photo */}
        <div className="relative h-44 bg-gradient-to-br from-gold/10 to-coral/10">
          {memorial.photo || memorial.coverPhoto ? (
            <img src={memorial.photo || memorial.coverPhoto} alt={memorial.name}
              className="w-full h-full object-cover object-center" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="font-display text-5xl font-bold text-white/10">
                {memorial.name?.charAt(0)}
              </span>
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

          {/* Country flag */}
          {flag && (
            <div className="absolute top-2.5 right-2.5 text-xl leading-none"
              title={memorial.countryCode}>{flag}</div>
          )}

          {/* Status dot */}
          <div className="absolute top-2.5 left-2.5">
            <div className={`w-2 h-2 rounded-full ${memorial.alive !== false ? 'bg-mint' : 'bg-gold'}`}
              style={{ boxShadow: `0 0 6px ${memorial.alive !== false ? '#34D399' : '#FFD700'}` }} />
          </div>
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="font-display text-lg font-bold text-white leading-tight mb-0.5 truncate">
            {memorial.name}
          </h3>
          {(memorial.years || memorial.born || memorial.died) && (
            <p className="text-xs text-white/35 mb-2">
              {memorial.years || `${memorial.born || ''}${memorial.died ? ` — ${memorial.died}` : ''}`}
            </p>
          )}
          {memorial.subtitle && (
            <p className="text-xs text-white/50 leading-relaxed line-clamp-2 mb-3">
              {memorial.subtitle}
            </p>
          )}

          {/* Stats row */}
          <div className="flex items-center gap-3 text-[0.6rem]">
            {tributeCount > 0 && (
              <span className="text-white/35">♡ {tributeCount} tribute{tributeCount !== 1 ? 's' : ''}</span>
            )}
            {memorial.elevenLabsVoiceId && (
              <span className="text-coral/60">◉ Voice</span>
            )}
            {relCat && (
              <span className="text-white/25 capitalize">{relCat}</span>
            )}
            {memorial.location && !relCat && (
              <span className="text-white/25 truncate">{memorial.location}</span>
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
  const [activeSort,   setActiveSort]   = useState('Recently Added')
  const [activeFilter, setActiveFilter] = useState('all')

  const { user } = db.useAuth()

  const { isLoading, error, data } = db.useQuery({
    memorials: {
      $: { limit: 100 },
      tributes: {},
    }
  })

  // Public memorials only
  const memorials = useMemo(() =>
    (data?.memorials || []).filter(m => !m.visibility || m.visibility === 'public'),
    [data]
  )

  // Featured pick (most active / has voice)
  const featured = useMemo(() =>
    memorials.find(m => (m.tributes?.length || m.tributeCount || 0) > 3 || m.elevenLabsVoiceId),
    [memorials]
  )

  // Filtered + sorted list
  // • activeFilter === 'all'  → all public memorials (global, anyone)
  // • activeFilter !== 'all'  → logged-in user's own memorials in that relation category
  const filtered = useMemo(() => {
    let list = [...memorials]

    if (activeFilter !== 'all') {
      // Relation filter only makes sense for the logged-in user's own memorials
      if (!user) return []   // guest — no relationships to show
      list = list.filter(m => {
        const isOwn = m.createdBy === user.id || m.creatorId === user.id
        if (!isOwn) return false
        const cat = getRelationFilterCategory(m.relation)
        return cat === activeFilter
      })
    }

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

    if (activeSort === 'Recently Added') {
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    } else if (activeSort === 'Most Tributes') {
      list.sort((a, b) =>
        (b.tributes?.length || b.tributeCount || 0) - (a.tributes?.length || a.tributeCount || 0)
      )
    } else if (activeSort === 'Featured') {
      list = list.filter(m => m.elevenLabsVoiceId || (m.tributes?.length || m.tributeCount || 0) > 2)
    }

    return list
  }, [memorials, activeFilter, search, activeSort, user])

  // ─── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="relative z-10 min-h-screen pt-20 pb-28">
      <div className="max-w-7xl mx-auto px-5 md:px-8 space-y-6">
        <div className="h-4 w-32 bg-white/5 rounded-full animate-pulse" />
        <div className="h-10 w-72 bg-white/5 rounded-xl animate-pulse" />
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

  if (!isLoading && memorials.length === 0) return (
    <div className="relative z-10 min-h-screen pt-20 pb-28">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <EmptyState
          icon="◎"
          title="No memorials yet"
          description="Be the first to create a living memorial and preserve a story forever."
          action={{ label: 'Create a memorial', to: '/create' }}
        />
      </div>
    </div>
  )

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="relative z-10 pt-20 pb-28 min-h-screen">

      {/* Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="w-full h-full"
          style={{
            backgroundImage: `url(${exploreBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.35,
          }}
        />
      </div>

      {/* ── Search — full-width hero ─────────────────────────────────────────── */}
      <div className="px-5 md:px-8 pt-8 pb-2 max-w-7xl mx-auto">
        <div className="relative">
          <svg className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            autoFocus={false}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search memorials by name, location, or story…"
            className="w-full rounded-2xl pl-14 pr-12 text-base text-white placeholder-white/30 focus:outline-none"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.14)',
              backdropFilter: 'blur(12px)',
              padding: '18px 48px 18px 52px',
              boxShadow: '0 4px 32px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.06) inset',
              fontSize: '15px',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            onFocus={e => {
              e.target.style.borderColor = 'rgba(255,215,0,0.45)'
              e.target.style.boxShadow = '0 4px 32px rgba(0,0,0,0.35), 0 0 0 3px rgba(255,215,0,0.10), 0 1px 0 rgba(255,255,255,0.06) inset'
            }}
            onBlur={e => {
              e.target.style.borderColor = 'rgba(255,255,255,0.14)'
              e.target.style.boxShadow = '0 4px 32px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.06) inset'
            }}
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full text-white/40 hover:text-white/70 hover:bg-white/10 transition-all">
              ✕
            </button>
          )}
        </div>
        {search && (
          <p className="text-xs text-white/30 mt-2 ml-1">
            {filtered.length === 0
              ? 'No memorials match your search.'
              : `${filtered.length} memorial${filtered.length !== 1 ? 's' : ''} found`}
          </p>
        )}
      </div>

      {/* ── Relation filter chips ───────────────────────────────────────────── */}
      <div className="px-5 md:px-8 mb-4 max-w-7xl mx-auto">
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {REL_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => { setActiveFilter(f.id); setSearch('') }}
              className={`flex-shrink-0 flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-full font-semibold transition-all ${
                activeFilter === f.id
                  ? 'stat-badge text-white/90'
                  : 'text-white/35 hover:text-white/60 border border-white/10 hover:border-white/20'
              }`}
            >
              <span>{f.emoji}</span> {f.label}
            </button>
          ))}
        </div>
        {/* Subtle context label */}
        {activeFilter !== 'all' && (
          <p className="text-[0.58rem] text-white/25 mt-2 ml-1">
            {user
              ? `Showing your ${REL_FILTERS.find(f => f.id === activeFilter)?.label.toLowerCase()} memorials`
              : 'Sign in to filter by your relationships'}
          </p>
        )}
      </div>

      {/* ── Sort ────────────────────────────────────────────────────────────── */}
      {activeFilter === 'all' && (
        <div className="px-5 md:px-8 mb-6 max-w-7xl mx-auto flex items-center gap-2">
          <span className="text-[0.6rem] text-white/25 uppercase tracking-wide">Sort:</span>
          {SORT_OPTIONS.map(s => (
            <button key={s} onClick={() => setActiveSort(s)}
              className={`text-xs px-3 py-1.5 rounded-full transition-all ${
                activeSort === s ? 'stat-badge text-white/80 font-semibold' : 'text-white/30 hover:text-white/55'
              }`}>
              {s}
            </button>
          ))}
        </div>
      )}
      {activeFilter !== 'all' && <div className="mb-6" />}

      {/* ── Featured card (All tab, no search active) ────────────────────────── */}
      {activeFilter === 'all' && !search && featured && (
        <div className="px-5 md:px-8 mb-8 max-w-7xl mx-auto">
          <Link to={`/memorial/${featured.id}`}
            className="block metal-card rounded-3xl overflow-hidden hover:opacity-90 transition-opacity">
            <div className="relative h-64 md:h-80">
              {(featured.photo || featured.coverPhoto)
                ? <img src={featured.photo || featured.coverPhoto} alt={featured.name}
                    className="w-full h-full object-cover object-center" />
                : <div className="w-full h-full bg-gradient-to-br from-gold/15 to-coral/10 flex items-center justify-center">
                    <span className="font-display text-8xl font-bold text-white/10">{featured.name?.charAt(0)}</span>
                  </div>
              }
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              {featured.countryCode && (
                <div className="absolute top-4 right-4 text-2xl">{countryFlag(featured.countryCode)}</div>
              )}
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <p className="text-[0.55rem] font-bold tracking-[0.22em] uppercase text-gold/70 mb-1">✦ Featured</p>
                <h2 className="font-display text-2xl md:text-3xl font-bold text-white mb-1">{featured.name}</h2>
                {featured.subtitle && <p className="text-sm text-white/60 line-clamp-2">{featured.subtitle}</p>}
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* ── Grid ────────────────────────────────────────────────────────────── */}
      <div className="px-5 md:px-8 max-w-7xl mx-auto">

        {/* Guest prompt when a relation filter is selected */}
        {activeFilter !== 'all' && !user ? (
          <div className="text-center py-20">
            <div className="text-5xl opacity-15 mb-5">✦</div>
            <p className="text-white/50 text-sm mb-2">Sign in to see your {REL_FILTERS.find(f => f.id === activeFilter)?.label.toLowerCase()} memorials</p>
            <Link to="/auth" className="text-xs text-gold/70 hover:text-gold underline mt-2 inline-block">
              Sign in →
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl opacity-15 mb-5">◎</div>
            <p className="text-white/40 text-sm mb-2">
              {activeFilter !== 'all'
                ? `No ${REL_FILTERS.find(f => f.id === activeFilter)?.label.toLowerCase()} memorials yet.`
                : 'No memorials found.'}
            </p>
            {search && (
              <button onClick={() => setSearch('')}
                className="text-xs text-gold/60 hover:text-gold underline mt-2">
                Clear search
              </button>
            )}
            {activeFilter !== 'all' && !search && (
              <button onClick={() => setActiveFilter('all')}
                className="text-xs text-gold/60 hover:text-gold underline mt-2 block mx-auto">
                View all memorials
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence mode="popLayout">
              {filtered.map((memorial, i) => (
                <MemorialCard
                  key={memorial.id}
                  memorial={memorial}
                  index={i}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
