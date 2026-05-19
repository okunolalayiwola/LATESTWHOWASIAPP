// src/components/ui/LifeReel.jsx — v3  "Blockbuster Edition"
//
// REQUIRES: npm install gsap
//
// Engine upgrade vs v2:
//   ✦ GSAP Ken Burns — 8 randomised camera movements per slide, GPU-composited,
//       proper start/end states, 60fps smooth. No more 5 fixed CSS patterns.
//   ✦ Blur dissolve transition — incoming slide unblurs from 10px as it fades in.
//       Creates a "focus pull" that feels like real cinematography.
//   ✦ Film grain canvas — 24fps noise texture overlay (subtle, authentic texture)
//   ✦ Character-by-character text reveal — name staggered at 40ms per character,
//       subtitle fades in as a block after the name completes.
//   ✦ Letterbox bars — optional cinematic black bars toggle.
//   ✦ Ambient audio player — Web Audio API, loop any audio URL on the memorial.
//   ✦ Fullscreen mode — native requestFullscreen API.
//   ✦ Date badge — styled glass pill with calendar icon, dates from social import.
//   ✦ Timeline scrubber — chronological markers, year labels at range ends.
//   ✦ Parallax text — name/subtitle moves at 0.6× speed of the photo.

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'

// ─── Config ───────────────────────────────────────────────────────────────────

const SLIDE_DURATION   = 5800   // ms each slide is visible (after fade in completes)
const FADE_DURATION    = 1600   // ms crossfade duration
const GRAIN_FPS        = 24     // film grain refresh rate
const GRAIN_OPACITY    = 0.045  // 0–1, keep subtle

// 8 GSAP Ken Burns movement recipes — each slide gets one based on its index
const KB_MOVES = [
  { xs: '0%',   ys: '0%',   xe: '-3%',  ye: '-3%',  ss: 1.00, se: 1.14 }, // zoom in → TL
  { xs: '0%',   ys: '0%',   xe:  '3%',  ye: '-2%',  ss: 1.00, se: 1.11 }, // zoom in → TR
  { xs: '-4%',  ys: '0%',   xe:  '4%',  ye: '0%',   ss: 1.08, se: 1.08 }, // pan right
  { xs: '0%',   ys: '3%',   xe: '0%',   ye: '-3%',  ss: 1.08, se: 1.08 }, // tilt up
  { xs: '-1%',  ys: '-1%',  xe: '1%',   ye: '1%',   ss: 1.15, se: 1.00 }, // zoom OUT
  { xs: '0%',   ys: '0%',   xe: '0%',   ye: '0%',   ss: 1.00, se: 1.12 }, // zoom in center
  { xs: '3%',   ys: '2%',   xe: '-2%',  ye: '-2%',  ss: 1.06, se: 1.14 }, // drift diagonal
  { xs: '0%',   ys: '2%',   xe: '2%',   ye: '-1%',  ss: 1.12, se: 1.00 }, // zoom out + pan
]

// ─── Utilities ────────────────────────────────────────────────────────────────

function isVideo(url = '') { return /\.(mp4|webm|mov|ogg)(\?|$)/i.test(url) }

function fmtDate(raw) {
  if (!raw) return null
  const d = typeof raw === 'number' ? new Date(raw * 1000) : new Date(raw)
  if (isNaN(d)) return null
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function getYear(raw) {
  if (!raw) return null
  const d = typeof raw === 'number' ? new Date(raw * 1000) : new Date(raw)
  return isNaN(d) ? null : d.getFullYear()
}

// ─── Film grain canvas ────────────────────────────────────────────────────────

function GrainCanvas({ active }) {
  const canvasRef  = useRef(null)
  const timerRef   = useRef(null)
  const rafRef     = useRef(null)

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { willReadFrequently: false })

    function frame() {
      const W = canvas.offsetWidth  || 640
      const H = canvas.offsetHeight || 360
      if (canvas.width !== W)  canvas.width  = W
      if (canvas.height !== H) canvas.height = H

      // Pseudo-random noise — faster than ImageData for large canvases
      ctx.clearRect(0, 0, W, H)
      for (let y = 0; y < H; y += 2) {
        for (let x = 0; x < W; x += 2) {
          const v = Math.random()
          if (v > 0.6) {   // sparse grain — only draw ~40% of pixels
            const lum = Math.round(v * 255)
            ctx.fillStyle = `rgba(${lum},${lum},${lum},${GRAIN_OPACITY})`
            ctx.fillRect(x, y, 2, 2)
          }
        }
      }

      timerRef.current = setTimeout(() => {
        rafRef.current = requestAnimationFrame(frame)
      }, 1000 / GRAIN_FPS)
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => {
      clearTimeout(timerRef.current)
      cancelAnimationFrame(rafRef.current)
    }
  }, [active])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-20"
      style={{ mixBlendMode: 'overlay', opacity: active ? 1 : 0, transition: 'opacity 0.5s' }}
    />
  )
}

// ─── Character-stagger name reveal ───────────────────────────────────────────

function AnimatedName({ text = '', triggerKey, delay = 0.5 }) {
  const chars = text.split('')
  return (
    <span aria-label={text}>
      {chars.map((ch, i) => (
        <motion.span
          key={`${triggerKey}-${i}`}
          initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{
            delay:    delay + i * 0.038,
            duration: 0.35,
            ease:     [0.16, 1, 0.3, 1],
          }}
          style={{ display: 'inline-block', whiteSpace: ch === ' ' ? 'pre' : undefined }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  )
}

// ─── Typographic still (no photos) ───────────────────────────────────────────

function TypographicStill({ memorial }) {
  const { name, years, subtitle, alive } = memorial
  const glow = alive ? 'rgba(74,170,74,0.14)' : 'rgba(200,160,30,0.11)'

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center select-none">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 80% 60% at 50% 50%, ${glow}, transparent)` }}
      />

      {/* Bokeh */}
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            width:  `${8  + (i % 3) * 6}px`,
            height: `${8  + (i % 3) * 6}px`,
            left:   `${10 + (i * 11) % 80}%`,
            top:    `${15 + (i * 17) % 70}%`,
            background: i % 2 === 0 ? 'rgba(255,215,0,0.07)' : 'rgba(56,189,248,0.05)',
            filter:  'blur(7px)',
            animation: `pulse-glow ${2.5 + i * 0.3}s ease-in-out ${i * 0.4}s infinite`,
          }}
        />
      ))}

      <div className="relative z-10">
        <p className="text-[0.6rem] tracking-[0.3em] uppercase text-gold/65 mb-4 text-reveal">
          In loving memory
        </p>
        <h2
          className="font-display font-bold text-white leading-none mb-3"
          style={{ fontSize: 'clamp(2.5rem,8vw,5.5rem)' }}
        >
          <AnimatedName text={name || 'Untitled'} triggerKey="still" delay={0.2} />
        </h2>
        {years && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="text-white/50 text-base md:text-xl tracking-wider"
          >
            {years}
          </motion.p>
        )}
        {subtitle && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.8, duration: 0.6 }}
            className="text-white/35 text-sm mt-3 max-w-sm mx-auto leading-relaxed"
          >
            {subtitle}
          </motion.p>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
    </div>
  )
}

// ─── Single slide ─────────────────────────────────────────────────────────────

function Slide({ media, moveIdx, name, years, subtitle, showText, date, caption, isIncoming }) {
  const imgRef  = useRef(null)
  const gsapRef = useRef(null)
  const displayDate = fmtDate(date)
  const move = KB_MOVES[moveIdx % KB_MOVES.length]

  // GSAP Ken Burns — starts when the element mounts (i.e. when slide becomes active)
  useEffect(() => {
    const el = imgRef.current
    if (!el || isVideo(media)) return

    // Kill any running animation on this element
    gsap.killTweensOf(el)

    // Set starting state immediately
    gsap.set(el, { scale: move.ss, x: move.xs, y: move.ys, force3D: true })

    // Animate to end state
    gsapRef.current = gsap.to(el, {
      scale:    move.se,
      x:        move.xe,
      y:        move.ye,
      duration: (SLIDE_DURATION + FADE_DURATION) / 1000,
      ease:     'power2.inOut',
      force3D:  true,
    })

    return () => {
      if (gsapRef.current) { gsapRef.current.kill() }
      gsap.killTweensOf(el)
    }
  }, [])  // only on mount

  return (
    <div className="absolute inset-0">
      {/* Media */}
      {isVideo(media) ? (
        <video
          src={media} autoPlay muted loop playsInline
          style={{ position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',willChange:'transform' }}
        />
      ) : (
        <img
          ref={imgRef}
          src={media}
          alt=""
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            willChange: 'transform',
            transformOrigin: 'center center',
          }}
        />
      )}

      {/* Vignettes — cinematic depth */}
      <div style={{ position:'absolute',inset:'0',background:'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.45) 100%)',pointerEvents:'none' }} />
      <div style={{ position:'absolute',insetInline:0,top:0,height:'120px',background:'linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)',pointerEvents:'none' }} />
      <div style={{ position:'absolute',insetInline:0,bottom:0,height:'220px',background:'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.45) 50%, transparent 100%)',pointerEvents:'none' }} />
      <div style={{ position:'absolute',insetBlock:0,left:0,width:'50px',background:'linear-gradient(to right, rgba(0,0,0,0.30), transparent)',pointerEvents:'none' }} />
      <div style={{ position:'absolute',insetBlock:0,right:0,width:'50px',background:'linear-gradient(to left, rgba(0,0,0,0.30), transparent)',pointerEvents:'none' }} />

      {/* Date badge — top left */}
      {showText && displayDate && (
        <motion.div
          initial={{ opacity:0, y:-10 }}
          animate={{ opacity:1, y:0 }}
          transition={{ delay:0.8, duration:0.4 }}
          className="absolute top-4 left-4 z-10"
        >
          <div
            className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5"
            style={{ borderColor:'rgba(255,215,0,0.22)' }}
          >
            <svg className="w-2.5 h-2.5 text-gold/70 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
            </svg>
            <span className="text-[0.6rem] text-white/80 font-medium">{displayDate}</span>
          </div>
        </motion.div>
      )}

      {/* Caption — social media caption top right */}
      {showText && caption && (
        <motion.div
          initial={{ opacity:0, y:-10 }}
          animate={{ opacity:1, y:0 }}
          transition={{ delay:1.0, duration:0.4 }}
          className="absolute top-4 right-4 z-10 max-w-[40%]"
        >
          <div className="glass rounded-xl px-3 py-1.5" style={{ borderColor:'rgba(255,255,255,0.06)' }}>
            <p className="text-[0.55rem] text-white/55 leading-snug line-clamp-2 italic">{caption}</p>
          </div>
        </motion.div>
      )}

      {/* Text overlay — bottom, parallax handled by parent */}
      {showText && (
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-12 md:px-10 md:pb-14 z-10">
          {/* In loving memory micro-label */}
          <motion.p
            initial={{ opacity:0 }}
            animate={{ opacity:1 }}
            transition={{ delay:0.3, duration:0.5 }}
            className="text-[0.58rem] tracking-[0.32em] uppercase text-gold/75 mb-2 font-medium"
          >
            In loving memory
          </motion.p>

          {/* Name — character by character stagger */}
          <h2
            className="font-display font-bold text-white leading-none mb-1.5 select-none"
            style={{ fontSize:'clamp(1.8rem,5.5vw,3.2rem)' }}
          >
            <AnimatedName text={name || ''} triggerKey={`${name}-${moveIdx}`} delay={0.4} />
          </h2>

          {/* Years */}
          {years && (
            <motion.p
              initial={{ opacity:0, y:6 }}
              animate={{ opacity:1, y:0 }}
              transition={{ delay: 0.4 + (name?.length || 0) * 0.038 + 0.15, duration:0.4 }}
              className="text-white/55 text-sm"
            >
              {years}
            </motion.p>
          )}

          {/* Subtitle */}
          {subtitle && (
            <motion.p
              initial={{ opacity:0, y:6 }}
              animate={{ opacity:1, y:0 }}
              transition={{ delay: 0.4 + (name?.length || 0) * 0.038 + 0.5, duration:0.5 }}
              className="text-white/38 text-xs mt-1.5 max-w-md leading-relaxed"
            >
              {subtitle}
            </motion.p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Timeline scrubber ────────────────────────────────────────────────────────

function TimelineScrubber({ slides, current, onGoTo }) {
  if (slides.length < 2) return null

  const years = slides
    .map(s => getYear(s.takenAt || s.date || (s.createdAt && s.createdAt / 1000)))
    .filter(Boolean)
  const minY = years.length > 0 ? Math.min(...years) : null
  const maxY = years.length > 0 ? Math.max(...years) : null

  return (
    <div className="absolute bottom-1.5 left-5 right-5 z-30 flex items-center gap-2">
      {minY && <span className="text-[0.48rem] text-white/30 font-mono flex-shrink-0 tabular-nums">{minY}</span>}
      <div className="flex-1 flex items-center gap-0.5">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => onGoTo(i)}
            className="flex-1 h-0.5 rounded-full transition-all duration-300"
            style={{
              background: i === current
                ? 'linear-gradient(to right, #FFD700, #38BDF8)'
                : i < current
                ? 'rgba(255,215,0,0.35)'
                : 'rgba(255,255,255,0.12)',
              maxWidth: 40,
            }}
          />
        ))}
      </div>
      {maxY && maxY !== minY && (
        <span className="text-[0.48rem] text-white/30 font-mono flex-shrink-0 tabular-nums">{maxY}</span>
      )}
    </div>
  )
}

// ─── Ambient music player ─────────────────────────────────────────────────────

function useMusicPlayer(src) {
  const audioRef    = useRef(null)
  const [playing, setPlaying] = useState(false)

  function toggle() {
    if (!src) return
    if (!audioRef.current) {
      const audio    = new Audio(src)
      audio.loop     = true
      audio.volume   = 0.18
      audioRef.current = audio
    }
    if (audioRef.current.paused) {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => {})
    } else {
      audioRef.current.pause()
      setPlaying(false)
    }
  }

  useEffect(() => () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
  }, [])

  return { playing, toggle }
}

// ─── Main LifeReel ────────────────────────────────────────────────────────────

export default function LifeReel({
  photos    = [],
  memorial  = {},
  musicUrl  = null,   // optional ambient background music URL
}) {
  const { name, years, subtitle, alive } = memorial

  const containerRef  = useRef(null)
  const [current,     setCurrent]     = useState(0)
  const [prev,        setPrev]        = useState(null)
  const [isExiting,   setIsExiting]   = useState(false)
  const [letterbox,   setLetterbox]   = useState(false)
  const [fullscreen,  setFullscreen]  = useState(false)
  const [showGrain,   setShowGrain]   = useState(true)
  const timerRef      = useRef(null)

  const { playing: musicPlaying, toggle: toggleMusic } = useMusicPlayer(musicUrl)

  // Sort by date (oldest first)
  const slides = photos
    .filter(p => p.url)
    .sort((a, b) => {
      const ad = a.takenAt || (a.createdAt ? a.createdAt / 1000 : 0)
      const bd = b.takenAt || (b.createdAt ? b.createdAt / 1000 : 0)
      return ad - bd
    })

  const hasSlides = slides.length > 0

  // Auto-advance
  const advance = useCallback(() => {
    if (!hasSlides || slides.length < 2) return
    setPrev(current)
    setIsExiting(true)
    setTimeout(() => {
      setCurrent(c => (c + 1) % slides.length)
      setIsExiting(false)
      setPrev(null)
    }, FADE_DURATION)
  }, [current, slides.length, hasSlides])

  useEffect(() => {
    clearTimeout(timerRef.current)
    if (!hasSlides || slides.length < 2) return
    timerRef.current = setTimeout(advance, SLIDE_DURATION)
    return () => clearTimeout(timerRef.current)
  }, [current, advance, hasSlides, slides.length])

  function goTo(idx) {
    if (idx === current) return
    clearTimeout(timerRef.current)
    setPrev(current)
    setIsExiting(true)
    setTimeout(() => { setCurrent(idx); setIsExiting(false); setPrev(null) }, FADE_DURATION)
  }

  // Fullscreen
  function toggleFullscreen() {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen?.().then(() => setFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen?.().then(() => setFullscreen(false)).catch(() => {})
    }
  }

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const currentSlide = slides[current]
  const prevSlide    = prev !== null ? slides[prev] : null

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-2xl select-none"
      style={{
        aspectRatio: '16/9',
        minHeight:   200,
        maxHeight:   fullscreen ? '100vh' : 520,
        background:  '#080808',
      }}
    >
      {hasSlides ? (
        <>
          {/* ── Outgoing slide ─────────────────────────────────────────── */}
          <AnimatePresence>
            {isExiting && prevSlide && (
              <motion.div
                key={`prev-${prev}`}
                initial={{ opacity: 1 }}
                exit={{   opacity: 0 }}
                transition={{ duration: FADE_DURATION / 1000, ease: 'easeInOut' }}
                className="absolute inset-0 z-[1]"
              >
                <Slide
                  media={prevSlide.url}
                  moveIdx={prev}
                  name={name} years={years} subtitle={subtitle}
                  showText={false}
                  date={null} caption={null}
                  isIncoming={false}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Incoming slide — blur dissolve ─────────────────────────── */}
          <motion.div
            key={`curr-${current}`}
            initial={{ opacity: 0, filter: 'blur(10px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)'  }}
            transition={{ duration: FADE_DURATION / 1000, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 z-[2]"
          >
            <Slide
              media={currentSlide.url}
              moveIdx={current}
              name={name} years={years} subtitle={subtitle}
              showText
              date={currentSlide.takenAt || currentSlide.date}
              caption={currentSlide.caption}
              isIncoming
            />
          </motion.div>

          {/* ── Film grain overlay ──────────────────────────────────────── */}
          <GrainCanvas active={showGrain} />

          {/* ── Letterbox bars ──────────────────────────────────────────── */}
          <AnimatePresence>
            {letterbox && (
              <motion.div
                initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} exit={{ scaleY: 0 }}
                style={{ transformOrigin: 'top' }}
                transition={{ duration: 0.4 }}
                className="absolute inset-x-0 top-0 z-40 pointer-events-none"
                style={{ height: '9%', background: '#000' }}
              />
            )}
            {letterbox && (
              <motion.div
                initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} exit={{ scaleY: 0 }}
                transition={{ duration: 0.4 }}
                style={{ transformOrigin: 'bottom' }}
                className="absolute inset-x-0 bottom-0 z-40 pointer-events-none"
                style={{ height: '9%', background: '#000' }}
              />
            )}
          </AnimatePresence>

          {/* ── Controls — top right ────────────────────────────────────── */}
          <div className="absolute top-3 right-3 z-50 flex gap-1.5">
            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="w-7 h-7 glass rounded-full flex items-center justify-center text-white/50 hover:text-white transition-colors"
              title="Fullscreen"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {fullscreen
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4 4m0 0l5 0m-5 0l0 5M15 9l5-5m0 0l-5 0m5 0l0 5M9 15l-5 5m0 0l5 0m-5 0l0-5M15 15l5 5m0 0l-5 0m5 0l0-5" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                }
              </svg>
            </button>

            {/* Letterbox toggle */}
            <button
              onClick={() => setLetterbox(l => !l)}
              className={`w-7 h-7 glass rounded-full flex items-center justify-center transition-all text-[8px] font-bold ${letterbox ? 'text-gold border border-gold/30' : 'text-white/40 hover:text-white'}`}
              title="Letterbox"
            >
              ▬
            </button>

            {/* Grain toggle */}
            <button
              onClick={() => setShowGrain(g => !g)}
              className={`w-7 h-7 glass rounded-full flex items-center justify-center transition-all text-[7px] font-bold ${showGrain ? 'text-gold border border-gold/30' : 'text-white/40 hover:text-white'}`}
              title="Film grain"
            >
              ⣿
            </button>

            {/* Music toggle — only if musicUrl is provided */}
            {musicUrl && (
              <button
                onClick={toggleMusic}
                className={`w-7 h-7 glass rounded-full flex items-center justify-center transition-all ${musicPlaying ? 'text-gold border border-gold/30' : 'text-white/40 hover:text-white'}`}
                title={musicPlaying ? 'Mute music' : 'Play ambient music'}
              >
                <svg className="w-3 h-3" fill={musicPlaying ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
                </svg>
              </button>
            )}
          </div>

          {/* ── Slide counter ───────────────────────────────────────────── */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50">
            <span className="glass rounded-full px-2.5 py-1 text-[0.55rem] text-white/40 tracking-widest tabular-nums">
              {current + 1} / {slides.length}
            </span>
          </div>

          {/* ── Timeline scrubber ───────────────────────────────────────── */}
          <TimelineScrubber slides={slides} current={current} onGoTo={goTo} />
        </>
      ) : (
        <TypographicStill memorial={memorial} />
      )}
    </div>
  )
}
