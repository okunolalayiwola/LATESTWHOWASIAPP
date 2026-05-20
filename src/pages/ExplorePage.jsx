// src/pages/ExplorePage.jsx — relation filter fully connected
// CHANGE: CATEGORIES now filter memorials by relation group (not just sort order).
//         The filter useMemo now handles 'parents', 'grandparents', 'siblings',
//         'friends', 'children', 'partner' by checking memorial.relation.
//         Legacy free-text relations are normalized before comparison.

import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '../lib/instant'
import { getRelationFilterCategory, normalizeRelation } from '../lib/relations'
import exploreBg from '../assets/explore-bg.webp'
import { SkeletonGrid } from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'


// ─── Filter categories (tabs) ─────────────────────────────────────────────────
// filterCategory must match what getRelationFilterCategory() returns.
// null means "show all".

const CATEGORIES = [
  { id: 'all',          label: 'All',          emoji: '◎' },
  { id: 'parents',      label: 'Parents',      emoji: '✿' },
  { id: 'grandparents', label: 'Grandparents', emoji: '♡' },
  { id: 'siblings',     label: 'Siblings',     emoji: '✦' },
  { id: 'children',     label: 'Children',     emoji: '🌱' },
  { id: 'partner',      label: 'Partners',     emoji: '💍' },
  { id: 'friends',      label: 'Friends',      emoji: '☽' },
  { id: 'extended',     label: 'Extended',     emoji: '🌿' },
]

const SORT_OPTIONS = ['Recently Added', 'Most Tributes', 'Featured']

// ─── Relation category resolver ───────────────────────────────────────────────
// Works on both canonical values ('mother') and legacy free-text ('mum', 'Mum').

function resolveFilterCategory(relationValue) {
  if (!relationValue) return null
  // Try canonical lookup first
  const cat = getRelationFilterCategory(relationValue)
  if (cat) return cat
  // Try normalizing free text
  const norm = normalizeRelation(relationValue)
  if (norm) return getRelationFilterCategory(norm.value)
  return null
}

// ─── Memorial card ────────────────────────────────────────────────────────────

function MemorialCard({ memorial, index, connected }) {
  const tributeCount = memorial.tributes?.length || memorial.tributeCount || 0

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
          {/* Relation badge — only shown for connected visitors (creator or invite) */}
          {memorial.relation && connected && (
            <div className="absolute top-2.5 right-2.5">
              <span className="text-[0.55rem] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full stat-badge text-white/60">
                {getRelationFilterCategory(memorial.relation) || 'other'}
              </span>
            </div>
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
            {memorial.location && (
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
  const [activeFilter, setActiveFilter] = useState('all')
  const [activeSort,   setActiveSort]   = useState('Recently Added')

  // Auth — used to determine which memorials the viewer is connected to
  const { user } = db.useAuth()

  // Viewer's profile — familyOwnerId tells us who they were invited by
  const { data: profileData } = db.useQuery(
    user ? { profiles: { $: { where: { userId: user.id } } } } : null
  )

  const { isLoading, error, data } = db.useQuery({
    memorials: {
      $: { limit: 100 },   // fetch all (capped at 100); filter visibility in JS below
      tributes: {},
    }
  })

  // Keep only public memorials — includes those explicitly marked 'public'
  // AND those created before the visibility field was added (no value = public intent)
  const memorials = useMemo(() =>
    (data?.memorials || []).filter(m => !m.visibility || m.visibility === 'public'),
    [data]
  )

  // ── Which memorial creators is this viewer connected to? ──────────────────
  // Connection comes from two sources:
  //   1. Viewer created the memorial themselves → always add user.id directly,
  //      regardless of whether their memorial is currently in the explore results.
  //   2. Viewer was invited into a family tree → profile.familyOwnerId === memorial.creatorId
  const connectedCreatorIds = useMemo(() => {
    const ids = new Set()
    if (!user) return ids
    ids.add(user.id)   // always connected to own memorials
    const familyOwnerId = profileData?.profiles?.[0]?.familyOwnerId
    if (familyOwnerId) ids.add(familyOwnerId)
    return ids
  }, [user, profileData])

  // ── Featured pick ──────────────────────────────────────────────────────────
  const featured = useMemo(() =>
    memorials.find(m => (m.tributes?.length || m.tributeCount || 0) > 3 || m.elevenLabsVoiceId),
    [memorials]
  )

  // ── Filtered + sorted list ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...memorials]

    // ── 1. Text search ──────────────────────────────────────────────────────
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

    // ── 2. Relation category filter ─────────────────────────────────────────
    // This is the fix: each CATEGORY tab now actually filters by relation group.
    if (activeFilter !== 'all') {
      list = list.filter(m => {
        if (!m.relation) return false
        const cat = resolveFilterCategory(m.relation)
        return cat === activeFilter
      })
    }

    // ── 3. Sort ─────────────────────────────────────────────────────────────
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
  }, [memorials, search, activeFilter, activeSort])

  // ── Count per category for badge display ──────────────────────────────────
  const categoryCounts = useMemo(() => {
    const counts = {}
    memorials.forEach(m => {
      if (!m.relation) return
      const cat = resolveFilterCategory(m.relation)
      if (cat) counts[cat] = (counts[cat] || 0) + 1
    })
    return counts
  }, [memorials])

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="relative z-10 min-h-screen pt-20 pb-28">
      <div className="max-w-7xl mx-auto px-5 md:px-8 space-y-6">
        <div className="h-4 w-32 bg-white/5 rounded-full animate-pulse" />
        <div className="h-10 w-72 bg-white/5 rounded-xl animate-pulse" />
        <div className="h-4 w-56 bg-white/5 rounded-full animate-pulse" />
        <SkeletonGrid count={8} />
      </div>
    </div>
  )
  // ─── Error ──────────────────────────────────────────────────────────────────
  if (error) return (
    <div className="relative z-10 min-h-screen flex items-center justify-center px-6">
      <div className="text-center">
        <div className="text-5xl mb-6 opacity-20">◎</div>
        <p className="text-white/50 text-sm mb-2">Could not load memorials.</p>
        <p className="text-white/30 text-xs">Please check your connection and try again.</p>
      </div>
    </div>
  )
  // ─── Empty state ────────────────────────────────────────────────────────────
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
  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative z-10 pt-20 pb-28 min-h-screen">

      {/* ── Full-screen background image (no blur, no mask) ──────────────── */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `url(${exploreBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.35,
          }}
        />
      </div>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="px-5 md:px-8 pt-6 pb-5 max-w-7xl mx-auto">
        <p className="text-[0.65rem] font-bold tracking-[0.22em] uppercase text-cream-dim mb-1">
          Living memorials
        </p>
        <h1 className="font-display text-[clamp(2rem,6vw,3.2rem)] font-bold text-white leading-tight mb-2">
          Living Memorials
        </h1>
        <p className="text-sm text-white/40 max-w-md leading-relaxed">
          A growing archive of living memorials — voices, stories, and tributes preserved forever.
        </p>
      </div>

      {/* ── Search ────────────────────────────────────────────────────────── */}
      <div className="px-5 md:px-8 mb-5 max-w-7xl mx-auto">
        <div className="relative max-w-md">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, location, or story…"
            className="w-full inset-field rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Category filter tabs ───────────────────────────────────────────── */}
      <div className="px-5 md:px-8 mb-5 max-w-7xl mx-auto">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map(cat => {
            const count   = cat.id === 'all' ? memorials.length : (categoryCounts[cat.id] || 0)
            const isActive = activeFilter === cat.id
            return (
              <motion.button key={cat.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveFilter(cat.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all ${
                  isActive
                    ? 'metal-btn text-black'
                    : 'rubber-btn text-white/55 hover:text-white'
                }`}>
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
                {count > 0 && !isActive && (
                  <span className="text-[0.5rem] bg-white/10 px-1.5 py-0.5 rounded-full text-white/30">{count}</span>
                )}
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* ── Sort row ──────────────────────────────────────────────────────── */}
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

      {/* ── Featured card (only when no filter + no search) ──────────────── */}
      {!search && activeFilter === 'all' && featured && (
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
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <p className="text-[0.55rem] font-bold tracking-[0.22em] uppercase text-gold/70 mb-1">✦ Featured</p>
                <h2 className="font-display text-2xl md:text-3xl font-bold text-white mb-1">{featured.name}</h2>
                {featured.subtitle && <p className="text-sm text-white/60 line-clamp-2">{featured.subtitle}</p>}
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* ── Grid ──────────────────────────────────────────────────────────── */}
      <div className="px-5 md:px-8 max-w-7xl mx-auto">

        {/* Results count */}
        {(search || activeFilter !== 'all') && (
          <p className="text-xs text-white/30 mb-4">
            {filtered.length === 0
              ? 'No memorials match this filter.'
              : `${filtered.length} memorial${filtered.length !== 1 ? 's' : ''} found`}
          </p>
        )}

        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl opacity-15 mb-5">◎</div>
            <p className="text-white/40 text-sm mb-2">No memorials in this category yet.</p>
            {activeFilter !== 'all' && (
              <button onClick={() => setActiveFilter('all')}
                className="text-xs text-gold/60 hover:text-gold underline mt-2">
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
                  connected={connectedCreatorIds.has(memorial.creatorId)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
