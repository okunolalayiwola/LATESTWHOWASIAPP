// src/pages/ReelsPage.jsx
// TikTok-style vertical reel feed — full-screen memorial discovery.
// Each reel = one memorial's life photos cycling with cinematic overlays.
// CSS scroll-snap handles native swipe-up/down navigation.
// IntersectionObserver activates each reel as it enters the viewport.
// Right sidebar: tribute ♡, view full memorial, share.

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { id as newId } from '@instantdb/react'
import { db } from '../lib/instant'
import { countryFlag } from '../lib/countries'
import { useToast } from '../contexts/ToastContext'

// ─── Config ───────────────────────────────────────────────────────────────────
const PHOTO_DURATION = 4200   // ms each photo shows before advancing
const FADE_MS        = 500    // crossfade between photos

// ─── Photo progress bars (Instagram Stories style) ───────────────────────────
function ProgressBars({ total, current, playing, duration }) {
  if (total <= 1) return null
  return (
    <div className="absolute top-0 left-0 right-0 z-30 flex gap-1 px-3 pt-3">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex-1 h-[2px] bg-white/25 rounded-full overflow-hidden">
          {i < current && (
            <div className="h-full w-full bg-white rounded-full" />
          )}
          {i === current && (
            <motion.div
              key={`bar-${current}-${playing}`}
              className="h-full bg-white rounded-full"
              initial={{ width: '0%' }}
              animate={playing ? { width: '100%' } : { width: '0%' }}
              transition={playing ? { duration: duration / 1000, ease: 'linear' } : { duration: 0 }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Single reel item ─────────────────────────────────────────────────────────
function ReelItem({ memorial, isActive }) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user }  = db.useAuth()

  // Sort photos oldest first
  const photos = useMemo(() =>
    (memorial.photos || [])
      .filter(p => p.url)
      .sort((a, b) => (a.takenAt || 0) - (b.takenAt || 0)),
    [memorial.photos]
  )

  const [photoIdx,  setPhotoIdx]  = useState(0)
  const [playing,   setPlaying]   = useState(false)
  const [prevIdx,   setPrevIdx]   = useState(null)
  const [showPause, setShowPause] = useState(false)
  const [liked,     setLiked]     = useState(false)
  const [liking,    setLiking]    = useState(false)
  const timerRef   = useRef(null)
  const pauseTimer = useRef(null)

  const tributeCount  = memorial.tributes?.length || 0
  const flag          = memorial.countryCode ? countryFlag(memorial.countryCode) : ''
  const currentPhoto  = photos[photoIdx]
  const hasPhotos     = photos.length > 0

  // Activate/deactivate when visibility changes
  useEffect(() => {
    if (isActive && hasPhotos) {
      setPhotoIdx(0)
      setPrevIdx(null)
      setPlaying(true)
    } else {
      setPlaying(false)
      clearTimeout(timerRef.current)
    }
  }, [isActive, hasPhotos])

  // Auto-advance photos while playing
  useEffect(() => {
    if (!playing || photos.length <= 1) return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const next = (photoIdx + 1) % photos.length
      setPrevIdx(photoIdx)
      setPhotoIdx(next)
    }, PHOTO_DURATION)
    return () => clearTimeout(timerRef.current)
  }, [photoIdx, playing, photos.length])

  function handleTap() {
    if (!hasPhotos) return
    const next = !playing
    setPlaying(next)
    // Show pause icon briefly
    if (!next) {
      setShowPause(true)
      clearTimeout(pauseTimer.current)
      pauseTimer.current = setTimeout(() => setShowPause(false), 900)
    }
  }

  async function handleTribute(e) {
    e.stopPropagation()
    if (!user) { navigate('/auth'); return }
    if (liked || liking) return
    setLiking(true)
    try {
      await db.transact(
        db.tx.tributes[newId()].update({
          type:       'tribute',
          emoji:      '♡',
          authorId:   user.id,
          memorialId: memorial.id,
          createdAt:  Date.now(),
        }).link({ memorial: memorial.id })
      )
      setLiked(true)
      toast.success('Tribute left ♡')
    } catch {
      toast.error('Could not leave tribute')
    } finally {
      setLiking(false)
    }
  }

  async function handleShare(e) {
    e.stopPropagation()
    const url = `${window.location.origin}/memorial/${memorial.id}`
    try {
      if (navigator.share) {
        await navigator.share({ title: memorial.name, url })
      } else {
        await navigator.clipboard.writeText(url)
        toast.success('Link copied ✦')
      }
    } catch {
      // user cancelled share
    }
  }

  // ── No-photo fallback ──────────────────────────────────────────────────────
  if (!hasPhotos) {
    return (
      <div className="relative w-full h-full flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #07070f 0%, #12121f 100%)' }}>
        {/* Bokeh blobs */}
        {[...Array(6)].map((_, i) => (
          <div key={i} className="absolute rounded-full pointer-events-none"
            style={{
              width:  `${60 + (i * 30) % 120}px`,
              height: `${60 + (i * 30) % 120}px`,
              left:   `${(i * 17) % 90}%`,
              top:    `${(i * 13) % 80}%`,
              background: i % 2 === 0 ? 'rgba(255,215,0,0.06)' : 'rgba(56,189,248,0.04)',
              filter: 'blur(30px)',
            }}
          />
        ))}
        <div className="relative z-10 text-center px-10">
          <p className="text-[0.58rem] tracking-[0.3em] uppercase text-gold/50 mb-4">In loving memory</p>
          <h2 className="font-display text-4xl font-bold text-white leading-tight mb-2">{memorial.name}</h2>
          {memorial.years    && <p className="text-white/45 text-sm mt-1">{memorial.years}</p>}
          {memorial.subtitle && <p className="text-white/28 text-xs mt-3 leading-relaxed max-w-xs mx-auto">{memorial.subtitle}</p>}
        </div>
        <SideActions
          memorial={memorial}
          flag={flag}
          liked={liked}
          liking={liking}
          tributeCount={tributeCount}
          onTribute={handleTribute}
          onShare={handleShare}
        />
      </div>
    )
  }

  // ── Photo reel ─────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full overflow-hidden bg-black" onClick={handleTap}>

      {/* Photos — crossfade stack */}
      <AnimatePresence initial={false}>
        <motion.img
          key={currentPhoto?.url}
          src={currentPhoto?.url}
          alt=""
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{    opacity: 0 }}
          transition={{ duration: FADE_MS / 1000, ease: 'easeInOut' }}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ willChange: 'opacity' }}
        />
      </AnimatePresence>

      {/* Cinematic vignettes */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.50) 100%)',
      }} />
      <div className="absolute inset-x-0 top-0 h-40 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.65), transparent)' }} />
      <div className="absolute inset-x-0 bottom-0 h-64 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 40%, transparent 100%)' }} />

      {/* Progress bars */}
      <ProgressBars
        total={photos.length}
        current={photoIdx}
        playing={playing}
        duration={PHOTO_DURATION}
      />

      {/* Top label */}
      <div className="absolute top-8 left-4 z-30">
        <span className="text-[0.52rem] font-bold tracking-[0.25em] uppercase text-white/40">
          Who was I
        </span>
      </div>

      {/* Pause overlay */}
      <AnimatePresence>
        {showPause && (
          <motion.div
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{    opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
          >
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}>
              <div className="flex gap-1.5">
                <div className="w-1.5 h-6 bg-white rounded-full" />
                <div className="w-1.5 h-6 bg-white rounded-full" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom info ──────────────────────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-28 pr-20 z-20 pointer-events-none">
        {/* Flag + status dot */}
        <div className="flex items-center gap-2 mb-2">
          {flag && <span className="text-xl leading-none">{flag}</span>}
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
            memorial.alive !== false ? 'bg-emerald-400' : 'bg-gold'
          }`} style={{ boxShadow: memorial.alive !== false ? '0 0 5px #34D399' : '0 0 5px #FFD700' }} />
          {memorial.location && (
            <span className="text-[0.58rem] text-white/38 truncate">{memorial.location}</span>
          )}
        </div>

        <h2 className="font-display text-[clamp(1.6rem,5vw,2.4rem)] font-bold text-white leading-tight mb-1 drop-shadow-lg">
          {memorial.name}
        </h2>
        {memorial.years && (
          <p className="text-white/55 text-xs mb-1">{memorial.years}</p>
        )}
        {memorial.subtitle && (
          <p className="text-white/38 text-xs leading-relaxed line-clamp-2">{memorial.subtitle}</p>
        )}

        {/* Photo count pill */}
        {photos.length > 1 && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 pointer-events-auto"
            style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(6px)' }}>
            <svg className="w-2.5 h-2.5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <span className="text-[0.52rem] text-white/45 tabular-nums">{photoIdx + 1} / {photos.length}</span>
          </div>
        )}
      </div>

      {/* ── Right sidebar ────────────────────────────────────────────────────── */}
      <SideActions
        memorial={memorial}
        flag={flag}
        liked={liked}
        liking={liking}
        tributeCount={tributeCount}
        onTribute={handleTribute}
        onShare={handleShare}
      />
    </div>
  )
}

// ─── Right sidebar actions ────────────────────────────────────────────────────
function SideActions({ memorial, liked, liking, tributeCount, onTribute, onShare }) {
  return (
    <div className="absolute right-3 bottom-32 z-30 flex flex-col items-center gap-5">

      {/* Tribute ♡ */}
      <button onClick={onTribute} className="flex flex-col items-center gap-1.5">
        <motion.div
          whileTap={{ scale: 0.82 }}
          className="w-11 h-11 rounded-full flex items-center justify-center transition-all"
          style={{
            background: liked ? 'rgba(248,113,113,0.22)' : 'rgba(255,255,255,0.10)',
            backdropFilter: 'blur(8px)',
            border: liked ? '1px solid rgba(248,113,113,0.40)' : '1px solid rgba(255,255,255,0.15)',
            boxShadow: liked ? '0 0 12px rgba(248,113,113,0.25)' : 'none',
          }}
        >
          <span className={`text-lg leading-none transition-colors ${liked ? 'text-red-400' : 'text-white/80'}`}>
            {liked ? '♥' : '♡'}
          </span>
        </motion.div>
        <span className="text-[0.52rem] text-white/45 tabular-nums">
          {tributeCount + (liked ? 1 : 0) || ''}
        </span>
      </button>

      {/* View full memorial */}
      <Link
        to={`/memorial/${memorial.id}`}
        onClick={e => e.stopPropagation()}
        className="flex flex-col items-center gap-1.5"
      >
        <motion.div
          whileTap={{ scale: 0.88 }}
          className="w-11 h-11 rounded-full flex items-center justify-center"
          style={{
            background: 'rgba(255,255,255,0.10)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          <svg className="w-4.5 h-4.5 text-white/80" style={{ width: 18, height: 18 }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </motion.div>
        <span className="text-[0.52rem] text-white/45">View</span>
      </Link>

      {/* Share */}
      <button onClick={onShare} className="flex flex-col items-center gap-1.5">
        <motion.div
          whileTap={{ scale: 0.88 }}
          className="w-11 h-11 rounded-full flex items-center justify-center"
          style={{
            background: 'rgba(255,255,255,0.10)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          <svg className="w-4 h-4 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
          </svg>
        </motion.div>
        <span className="text-[0.52rem] text-white/45">Share</span>
      </button>
    </div>
  )
}

// ─── Swipe hint (shown briefly on first open) ─────────────────────────────────
function SwipeHint() {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 2800)
    return () => clearTimeout(t)
  }, [])
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{    opacity: 0, y: -6 }}
          transition={{ duration: 0.4 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
        >
          <div className="flex flex-col items-center gap-1.5"
            style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(10px)',
              borderRadius: 20, padding: '10px 18px', border: '1px solid rgba(255,255,255,0.10)' }}>
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
            >
              <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
              </svg>
            </motion.div>
            <span className="text-[0.58rem] text-white/50 font-medium tracking-wide">Swipe up for next</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function ReelSkeleton() {
  return (
    <div className="fixed inset-0 bg-[#07070f] flex flex-col items-center justify-center gap-4 z-10">
      <div className="w-12 h-12 border-2 border-gold/25 border-t-gold rounded-full animate-spin" />
      <p className="text-white/30 text-xs tracking-widest uppercase">Loading memories…</p>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyReels() {
  return (
    <div className="fixed inset-0 bg-[#07070f] flex flex-col items-center justify-center gap-5 z-10 px-8 text-center">
      <div className="text-5xl opacity-20">◎</div>
      <h2 className="font-display text-2xl font-bold text-white">No reels yet</h2>
      <p className="text-white/35 text-sm leading-relaxed max-w-xs">
        Memorials with life photos will appear here. Create one to be the first.
      </p>
      <Link to="/create"
        className="mt-2 px-6 py-3 rounded-2xl text-sm font-bold text-black metal-btn">
        Create a memorial ✦
      </Link>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ReelsPage() {
  const { isLoading, error, data } = db.useQuery({
    memorials: {
      $: { limit: 50 },
      photos:   {},
      tributes: {},
    }
  })

  // Public memorials only — filter client-side
  const memorials = useMemo(() => {
    const all = data?.memorials || []
    return all
      .filter(m => !m.visibility || m.visibility === 'public')
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }, [data])

  // Track which reel is currently active (in viewport)
  const [activeIdx, setActiveIdx] = useState(0)
  const containerRef = useRef(null)
  const itemRefs     = useRef([])
  const hintShown    = useRef(false)
  const [showHint,   setShowHint] = useState(false)

  // IntersectionObserver — fires when a reel becomes ≥60% visible
  useEffect(() => {
    if (!memorials.length) return

    const observers = []
    itemRefs.current.forEach((el, idx) => {
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveIdx(idx)
          }
        },
        { threshold: 0.6 }
      )
      obs.observe(el)
      observers.push(obs)
    })

    return () => observers.forEach(o => o.disconnect())
  }, [memorials.length])

  // Show swipe hint once, 400ms after first load
  useEffect(() => {
    if (memorials.length > 1 && !hintShown.current) {
      hintShown.current = true
      const t = setTimeout(() => setShowHint(true), 400)
      return () => clearTimeout(t)
    }
  }, [memorials.length])

  if (isLoading) return <ReelSkeleton />
  if (error)     return <ReelSkeleton /> // fail silently, show spinner
  if (!isLoading && memorials.length === 0) return <EmptyReels />

  return (
    <div className="fixed inset-0 bg-black z-10">

      {/* Scroll container — full viewport, snap-mandatory */}
      <div
        ref={containerRef}
        className="w-full h-full overflow-y-scroll"
        style={{
          scrollSnapType:        'y mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth:        'none',   // Firefox
          msOverflowStyle:       'none',   // IE
        }}
      >
        {memorials.map((memorial, idx) => (
          <div
            key={memorial.id}
            ref={el => { itemRefs.current[idx] = el }}
            style={{
              height:          '100dvh',
              minHeight:       '100dvh',
              scrollSnapAlign: 'start',
              scrollSnapStop:  'always',
              flexShrink:      0,
              position:        'relative',
              overflow:        'hidden',
            }}
          >
            <ReelItem
              memorial={memorial}
              isActive={activeIdx === idx}
              index={idx}
            />
          </div>
        ))}
      </div>

      {/* Swipe hint — shown once on first load */}
      {showHint && <SwipeHint />}

      {/* Header label — floating above content */}
      <div className="fixed top-0 left-0 right-0 z-40 pointer-events-none"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="font-display text-base font-bold text-white drop-shadow-lg">Reels</span>
          <div className="flex items-center gap-1">
            <span className="text-[0.52rem] font-bold tracking-[0.2em] uppercase text-white/30">
              {activeIdx + 1} / {memorials.length}
            </span>
          </div>
        </div>
      </div>

    </div>
  )
}
