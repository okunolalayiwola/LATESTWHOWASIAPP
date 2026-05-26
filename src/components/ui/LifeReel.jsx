// src/components/ui/LifeReel.jsx — v4  "Cinematic Engine"
//
// REQUIRES: npm install gsap
//
// What's new vs v3:
//   ✦ Auto-generated opening TITLE card  — name + DOB–DOD + "In loving memory"
//   ✦ Auto-generated closing MEMORIAL card — "Forever remembered" with full dates
//   ✦ Chapter year markers — interleaved between photo runs (e.g. "1972")
//   ✦ Per-photo year/date overlays as cinematic glass pills
//   ✦ Caption typography reveals — character by character on title, fade on subtitle
//   ✦ 12 GSAP Ken Burns recipes — push-ins, pull-outs, pans, diagonals, dolly zooms
//   ✦ Blur-dissolve crossfade + radial vignette + film grain at 24fps
//   ✦ Two play modes: viewport (compact inline) and theater (fullscreen)
//   ✦ Smart progress: clickable chapter markers, year scale at edges
//
// Props:
//   photos        — array { url, takenAt, date, caption, createdAt }
//   memorial      — object { name, years, subtitle, bio, alive, born, died, dob, dod, birthYear, deathYear }
//   musicUrl      — optional ambient audio URL
//   fill          — true = fill parent container (fullscreen overlay mode)
//   onExpand      — optional callback to open the theater (parent-controlled fullscreen)
//   onEnd         — optional callback when last slide completes
//   compact       — true = trimmed UI for small inline viewport
//
// Internal slide model:
//   { kind: 'title' | 'photo' | 'chapter' | 'closing', ...data }

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'

// ─── Config ───────────────────────────────────────────────────────────────────

const MAX_RUNTIME_MS   = 120_000   // 2 min hard cap on total reel duration
const TITLE_HOLD_MS    = 5400      // how long the title overlay sits on first photo
const PHOTO_DURATION   = 5400      // default — recalculated dynamically below
const PHOTO_MIN_DUR    = 2800
const PHOTO_MAX_DUR    = 6200
const CHAPTER_DURATION = 3000
const CLOSING_DURATION = 5400
const FADE_DURATION    = 1300

const GRAIN_FPS     = 24
const GRAIN_OPACITY = 0.045

// 12 GSAP Ken Burns recipes — varied so every slide feels different
const KB_MOVES = [
  { xs:'0%',  ys:'0%',  xe:'-3%', ye:'-3%', ss:1.00, se:1.16 }, // push-in upper-left
  { xs:'0%',  ys:'0%',  xe:'3%',  ye:'-2%', ss:1.00, se:1.13 }, // push-in upper-right
  { xs:'-4%', ys:'0%',  xe:'4%',  ye:'0%',  ss:1.10, se:1.10 }, // pan right
  { xs:'4%',  ys:'0%',  xe:'-4%', ye:'0%',  ss:1.10, se:1.10 }, // pan left
  { xs:'0%',  ys:'4%',  xe:'0%',  ye:'-4%', ss:1.10, se:1.10 }, // tilt up
  { xs:'0%',  ys:'-3%', xe:'0%',  ye:'3%',  ss:1.10, se:1.10 }, // tilt down
  { xs:'-1%', ys:'-1%', xe:'1%',  ye:'1%',  ss:1.18, se:1.00 }, // pull-out
  { xs:'0%',  ys:'0%',  xe:'0%',  ye:'0%',  ss:1.00, se:1.14 }, // push-in center
  { xs:'3%',  ys:'2%',  xe:'-3%', ye:'-2%', ss:1.06, se:1.18 }, // diagonal push
  { xs:'0%',  ys:'2%',  xe:'2%',  ye:'-1%', ss:1.14, se:1.00 }, // dolly + drift
  { xs:'-2%', ys:'-2%', xe:'-4%', ye:'-1%', ss:1.04, se:1.20 }, // crawl-in
  { xs:'2%',  ys:'1%',  xe:'4%',  ye:'-1%', ss:1.04, se:1.20 }, // crawl-in mirror
]

// ─── Utilities ────────────────────────────────────────────────────────────────

function isVideo(url='') { return /\.(mp4|webm|mov|ogg)(\?|$)/i.test(url) }

function pickYear(raw) {
  if (raw == null || raw === '') return null
  const s = String(raw)
  const m = s.match(/\d{4}/)
  return m ? parseInt(m[0], 10) : null
}

function fmtFullDate(raw) {
  if (!raw) return null
  const d = typeof raw === 'number' ? new Date(raw * 1000) : new Date(raw)
  if (isNaN(d)) return null
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtShortDate(raw) {
  if (!raw) return null
  const d = typeof raw === 'number' ? new Date(raw * 1000) : new Date(raw)
  if (isNaN(d)) return null
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

function getDate(p) {
  return p.takenAt || p.date || (p.createdAt ? p.createdAt / 1000 : null)
}

function extractYears(memorial) {
  const m = memorial || {}
  const bornY = pickYear(m.born ?? m.dob ?? m.birthYear ?? m.years)
  const diedY = pickYear(m.died ?? m.dod ?? m.deathYear ?? (m.alive === false ? m.years?.split('-')?.[1] : null))
  return {
    born: bornY,
    died: m.alive === false ? diedY : null,
    alive: m.alive !== false,
  }
}

// ─── Film grain ───────────────────────────────────────────────────────────────

function GrainCanvas({ active }) {
  const canvasRef = useRef(null)
  const timerRef  = useRef(null)
  const rafRef    = useRef(null)

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { willReadFrequently: false })

    function frame() {
      const W = canvas.offsetWidth  || 640
      const H = canvas.offsetHeight || 360
      if (canvas.width  !== W) canvas.width  = W
      if (canvas.height !== H) canvas.height = H
      ctx.clearRect(0, 0, W, H)
      for (let y = 0; y < H; y += 2) {
        for (let x = 0; x < W; x += 2) {
          const v = Math.random()
          if (v > 0.6) {
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
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ mixBlendMode: 'overlay', opacity: active ? 1 : 0, transition: 'opacity 0.5s', zIndex: 25 }}
    />
  )
}

// ─── Character-stagger reveal ─────────────────────────────────────────────────

function AnimatedName({ text='', triggerKey, delay=0.5, size }) {
  const chars = text.split('')
  return (
    <span aria-label={text}>
      {chars.map((ch, i) => (
        <motion.span
          key={`${triggerKey}-${i}`}
          initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0,  filter: 'blur(0px)' }}
          transition={{ delay: delay + i * 0.038, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: 'inline-block', whiteSpace: ch === ' ' ? 'pre' : undefined, fontSize: size }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  )
}

// ─── Opening TITLE card ───────────────────────────────────────────────────────

function TitleCard({ memorial }) {
  const { name = 'In memoriam', subtitle } = memorial || {}
  const { born, died, alive } = extractYears(memorial)

  const dateLine = born && died ? `${born} — ${died}`
                  : born ? `Born ${born}`
                  : died ? `${died}`
                  : null

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center select-none"
      style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 45%, rgba(255,215,0,0.10) 0%, rgba(8,8,15,0) 60%), linear-gradient(180deg, #0a0a14 0%, #050509 100%)' }}>

      {/* Drifting bokeh */}
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            width:  `${10 + (i % 4) * 8}px`,
            height: `${10 + (i % 4) * 8}px`,
            left:   `${8  + (i * 13) % 84}%`,
            top:    `${10 + (i * 19) % 80}%`,
            background: i % 2 === 0 ? 'rgba(255,215,0,0.08)' : 'rgba(56,189,248,0.06)',
            filter:  'blur(9px)',
            animation: `lr-pulse ${3 + i * 0.35}s ease-in-out ${i * 0.3}s infinite`,
          }}
        />
      ))}

      <div className="relative z-10 max-w-3xl">
        {/* Eyebrow */}
        <motion.p
          initial={{ opacity: 0, letterSpacing: '0.1em' }}
          animate={{ opacity: 1, letterSpacing: '0.34em' }}
          transition={{ delay: 0.15, duration: 0.9 }}
          className="text-[0.62rem] uppercase font-semibold mb-5"
          style={{ color: 'rgba(255,215,0,0.7)' }}
        >
          {alive ? '◆ A life in motion' : '✦ In loving memory'}
        </motion.p>

        {/* Name */}
        <h1 className="font-display font-bold text-white leading-none mb-5"
          style={{ fontSize: 'clamp(1.45rem, 4.5vw, 3.25rem)', letterSpacing: '-0.02em' }}>
          <AnimatedName text={name} triggerKey="title" delay={0.45} />
        </h1>

        {/* Date line */}
        {dateLine && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 + (name.length * 0.038), duration: 0.7 }}
            className="flex items-center justify-center gap-3 mb-5"
          >
            <span className="h-px w-12" style={{ background: 'linear-gradient(to right, transparent, rgba(255,215,0,0.5))' }} />
            <span className="font-mono text-sm md:text-base tracking-[0.18em] tabular-nums"
              style={{ color: 'rgba(255,215,0,0.85)' }}>
              {dateLine}
            </span>
            <span className="h-px w-12" style={{ background: 'linear-gradient(to left, transparent, rgba(255,215,0,0.5))' }} />
          </motion.div>
        )}

        {/* Subtitle */}
        {subtitle && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.6, duration: 0.7 }}
            className="text-base md:text-lg max-w-xl mx-auto leading-relaxed italic"
            style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'Georgia, serif' }}
          >
            {subtitle}
          </motion.p>
        )}
      </div>

      {/* Bottom shimmer */}
      <div className="absolute inset-x-0 bottom-0 h-32 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)' }} />
    </div>
  )
}

// ─── Closing MEMORIAL card ────────────────────────────────────────────────────

function ClosingCard({ memorial }) {
  const { name = 'In memoriam' } = memorial || {}
  const { born, died, alive } = extractYears(memorial)

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center select-none"
      style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(252,165,165,0.08) 0%, rgba(8,8,15,0) 65%), linear-gradient(180deg, #08080f 0%, #02020a 100%)' }}>

      {/* Slow expanding circle */}
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1.0, opacity: 1 }}
        transition={{ duration: 2.5, ease: [0.16, 1, 0.3, 1] }}
        className="absolute"
        style={{
          width: '70vmin', height: '70vmin',
          borderRadius: '50%',
          border: '1px solid rgba(255,215,0,0.18)',
          background: 'radial-gradient(circle, rgba(255,215,0,0.06) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 max-w-2xl">
        {/* Heart */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8, ease: 'backOut' }}
          className="mb-6 flex justify-center"
        >
          <svg width="46" height="46" viewBox="0 0 24 24" fill="rgba(255,215,0,0.7)" style={{ filter: 'drop-shadow(0 0 16px rgba(255,215,0,0.4))' }}>
            <path d="M12 21s-7-4.5-9.5-9.5C1 8 3 4 6.5 4c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3C21 4 23 8 21.5 11.5 19 16.5 12 21 12 21z"/>
          </svg>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.8 }}
          className="text-[0.65rem] uppercase font-semibold tracking-[0.34em] mb-4"
          style={{ color: 'rgba(255,215,0,0.7)' }}
        >
          {alive ? '◆ A continuing story' : '✦ Forever remembered'}
        </motion.p>

        <h2 className="font-display font-bold text-white leading-tight mb-4"
          style={{ fontSize: 'clamp(1.2rem, 3.6vw, 2.4rem)', letterSpacing: '-0.02em' }}>
          <AnimatedName text={name} triggerKey="closing" delay={1.3} />
        </h2>

        {(born || died) && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.0, duration: 0.8 }}
            className="font-mono text-base md:text-lg tracking-[0.18em] tabular-nums mb-6"
            style={{ color: 'rgba(255,215,0,0.85)' }}
          >
            {born && died ? `${born} — ${died}` : born ? `b. ${born}` : `d. ${died}`}
          </motion.p>
        )}

        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.6, duration: 1.0 }}
          className="text-sm italic max-w-md mx-auto leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.50)', fontFamily: 'Georgia, serif' }}
        >
          {alive
            ? 'Their story continues — one moment at a time.'
            : 'Held in memory. Carried in love. Never forgotten.'}
        </motion.p>
      </div>
    </div>
  )
}

// ─── Chapter year marker ──────────────────────────────────────────────────────

function ChapterCard({ year, label }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center select-none"
      style={{ background: 'linear-gradient(135deg, #0a0a14 0%, #1a1424 50%, #050509 100%)' }}>

      {/* Concentric rings */}
      {[1, 2, 3].map(i => (
        <motion.div
          key={i}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: [0, 0.3, 0] }}
          transition={{ duration: 2.4, delay: 0.2 + i * 0.4, ease: 'easeOut' }}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: `${30 + i * 20}vmin`,
            height: `${30 + i * 20}vmin`,
            border: '1px solid rgba(255,215,0,0.25)',
          }}
        />
      ))}

      <div className="relative z-10 text-center">
        <motion.p
          initial={{ opacity: 0, letterSpacing: '0.1em' }}
          animate={{ opacity: 1, letterSpacing: '0.32em' }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="text-[0.6rem] uppercase font-semibold mb-3"
          style={{ color: 'rgba(255,215,0,0.6)' }}
        >
          Chapter
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, scale: 1.3, filter: 'blur(8px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ delay: 0.4, duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
          className="font-display font-bold text-white"
          style={{
            fontSize: 'clamp(4rem, 14vw, 9rem)',
            letterSpacing: '-0.04em',
            lineHeight: 0.85,
            textShadow: '0 0 40px rgba(255,215,0,0.25)',
          }}
        >
          {year}
        </motion.h2>
        {label && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.6 }}
            className="text-sm mt-4 italic"
            style={{ color: 'rgba(255,255,255,0.50)', fontFamily: 'Georgia, serif' }}
          >
            {label}
          </motion.p>
        )}
      </div>
    </div>
  )
}

// ─── Photo slide with Ken Burns ───────────────────────────────────────────────

function PhotoSlide({ media, moveIdx, memorial, dateRaw, caption, showText, showOpeningTitle }) {
  const imgRef  = useRef(null)
  const gsapRef = useRef(null)
  const move    = KB_MOVES[(moveIdx || 0) % KB_MOVES.length]
  const displayDate = fmtFullDate(dateRaw)
  const yearOnly    = pickYear(dateRaw)
  const name        = memorial?.name
  const subtitle    = memorial?.subtitle
  const yrs         = extractYears(memorial || {})
  const dateLine    = yrs.born && yrs.died ? `${yrs.born} — ${yrs.died}`
                    : yrs.born ? `Born ${yrs.born}`
                    : yrs.died ? `${yrs.died}`
                    : null

  useEffect(() => {
    const el = imgRef.current
    if (!el || isVideo(media)) return
    gsap.killTweensOf(el)
    gsap.set(el, { scale: move.ss, x: move.xs, y: move.ys, force3D: true })
    gsapRef.current = gsap.to(el, {
      scale: move.se, x: move.xe, y: move.ye,
      duration: (PHOTO_DURATION + FADE_DURATION) / 1000,
      ease: 'power2.inOut',
      force3D: true,
    })
    return () => {
      gsapRef.current?.kill()
      gsap.killTweensOf(el)
    }
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden">
      {isVideo(media) ? (
        <video
          src={media} autoPlay muted loop playsInline
          style={{ position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',willChange:'transform' }}
        />
      ) : (
        <img loading="lazy" decoding="async"
          ref={imgRef}
          src={media}
          alt=""
          crossOrigin="anonymous"
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            willChange: 'transform',
            transformOrigin: 'center center',
          }}
        />
      )}

      {/* Cinematic vignettes */}
      <div style={{ position:'absolute',inset:0,background:'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)',pointerEvents:'none' }} />
      <div style={{ position:'absolute',insetInline:0,top:0,height:'150px',background:'linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)',pointerEvents:'none' }} />
      <div style={{ position:'absolute',insetInline:0,bottom:0,height:'260px',background:'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)',pointerEvents:'none' }} />
      <div style={{ position:'absolute',insetBlock:0,left:0,width:'80px',background:'linear-gradient(to right, rgba(0,0,0,0.35), transparent)',pointerEvents:'none' }} />
      <div style={{ position:'absolute',insetBlock:0,right:0,width:'80px',background:'linear-gradient(to left, rgba(0,0,0,0.35), transparent)',pointerEvents:'none' }} />

      {/* Year badge — top right (giant cinematic year if available) */}
      {showText && yearOnly && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.7 }}
          className="absolute top-4 right-5 z-10 pointer-events-none"
        >
          <div className="font-display font-bold tabular-nums leading-none"
            style={{
              fontSize: 'clamp(2rem, 5vw, 3.6rem)',
              color: 'rgba(255,215,0,0.85)',
              letterSpacing: '-0.04em',
              textShadow: '0 2px 24px rgba(0,0,0,0.7), 0 0 60px rgba(255,215,0,0.2)',
              WebkitTextStroke: '0.5px rgba(255,215,0,0.3)',
            }}>
            {yearOnly}
          </div>
        </motion.div>
      )}

      {/* Date pill — bottom-left small label if we have full date */}
      {showText && displayDate && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="absolute top-4 left-5 z-10"
        >
          <div className="flex items-center gap-2 rounded-full px-3 py-1.5"
            style={{
              background: 'rgba(8,8,15,0.65)',
              border: '1px solid rgba(255,215,0,0.25)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}>
            <svg className="w-3 h-3" style={{ color: 'rgba(255,215,0,0.75)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
            </svg>
            <span className="text-[0.6rem] font-medium tracking-wide" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {displayDate}
            </span>
          </div>
        </motion.div>
      )}

      {/* Caption */}
      {showText && caption && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="absolute bottom-6 right-5 z-10 max-w-[55%]"
        >
          <div className="rounded-xl px-3.5 py-2"
            style={{
              background: 'rgba(8,8,15,0.55)',
              border: '1px solid rgba(255,255,255,0.10)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}>
            <p className="text-[0.7rem] italic leading-snug line-clamp-2"
              style={{ color: 'rgba(255,255,255,0.78)', fontFamily: 'Georgia, serif' }}>
              "{caption}"
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Opening title overlay (only on first photo) ────────────────────
          Photo is already visible behind. Strong full-width text block with
          name + date line + "In loving memory". Stays on screen during the
          TITLE_HOLD portion of the slide. */}
      {showText && showOpeningTitle && name && (
        <>
          {/* Stronger gradient behind title text for legibility */}
          <div className="absolute inset-x-0 bottom-0 z-[9] pointer-events-none"
            style={{
              height: '62%',
              background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.45) 50%, transparent 100%)',
            }} />

          <div className="absolute bottom-0 left-0 right-0 z-10 px-6 pb-12 md:px-12 md:pb-16 text-left">
            <motion.p
              initial={{ opacity: 0, letterSpacing: '0.1em' }}
              animate={{ opacity: 1, letterSpacing: '0.34em' }}
              transition={{ delay: 0.3, duration: 0.9 }}
              className="text-[0.62rem] uppercase font-semibold mb-3"
              style={{ color: 'rgba(255,215,0,0.85)' }}>
              {yrs.alive ? '◆ A life in motion' : '✦ In loving memory'}
            </motion.p>

            <h1 className="font-display font-bold text-white leading-none mb-4"
              style={{ fontSize: 'clamp(1.45rem, 4.2vw, 3.1rem)', letterSpacing: '-0.02em',
                textShadow: '0 4px 30px rgba(0,0,0,0.65)' }}>
              <AnimatedName text={name} triggerKey={`opening-${moveIdx}`} delay={0.55} />
            </h1>

            {dateLine && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 + (name.length * 0.038), duration: 0.6 }}
                className="flex items-center gap-3 mb-3"
              >
                <span className="h-px w-10" style={{ background: 'linear-gradient(to right, transparent, rgba(255,215,0,0.65))' }} />
                <span className="font-mono text-sm md:text-base tracking-[0.18em] tabular-nums"
                  style={{ color: 'rgba(255,215,0,0.92)', textShadow: '0 2px 12px rgba(0,0,0,0.7)' }}>
                  {dateLine}
                </span>
              </motion.div>
            )}

            {subtitle && (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.5, duration: 0.7 }}
                className="text-sm md:text-base max-w-xl leading-relaxed italic"
                style={{ color: 'rgba(255,255,255,0.78)', fontFamily: 'Georgia, serif',
                  textShadow: '0 2px 12px rgba(0,0,0,0.7)' }}>
                {subtitle}
              </motion.p>
            )}
          </div>
        </>
      )}

      {/* ── Compact nameplate on subsequent photos ─────────────────────────── */}
      {showText && !showOpeningTitle && name && (
        <div className="absolute bottom-6 left-5 z-10">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-[0.55rem] uppercase font-semibold tracking-[0.3em] mb-1"
            style={{ color: 'rgba(255,215,0,0.7)' }}>
            ◆ Life reel
          </motion.p>
          <h3 className="font-display font-bold text-white"
            style={{ fontSize: 'clamp(0.75rem, 1.8vw, 1.15rem)', letterSpacing: '-0.015em', textShadow: '0 2px 12px rgba(0,0,0,0.7)' }}>
            <AnimatedName text={name} triggerKey={`${name}-${moveIdx}`} delay={0.55} />
          </h3>
        </div>
      )}
    </div>
  )
}

// ─── Render a slide of any kind ───────────────────────────────────────────────

function RenderSlide({ slide, idx, memorial, showText }) {
  if (slide.kind === 'title-only') return <TitleCard memorial={memorial} />
  if (slide.kind === 'closing')    return <ClosingCard memorial={memorial} />
  if (slide.kind === 'chapter')    return <ChapterCard year={slide.year} label={slide.label} />
  return (
    <PhotoSlide
      media={slide.url}
      moveIdx={idx}
      memorial={memorial}
      dateRaw={slide.date}
      caption={slide.caption}
      showText={showText}
      showOpeningTitle={slide.showTitle === true}
    />
  )
}

// ─── Timeline scrubber ────────────────────────────────────────────────────────

function Scrubber({ slides, current, onGoTo, compact }) {
  if (slides.length < 2) return null
  const photoYears = slides.filter(s => s.kind === 'photo').map(s => pickYear(s.date)).filter(Boolean)
  const minY = photoYears.length ? Math.min(...photoYears) : null
  const maxY = photoYears.length ? Math.max(...photoYears) : null

  return (
    <div className="absolute bottom-2 left-4 right-4 z-30 flex items-center gap-2">
      {!compact && minY && (
        <span className="text-[0.5rem] font-mono tabular-nums flex-shrink-0"
          style={{ color: 'rgba(255,255,255,0.32)' }}>{minY}</span>
      )}
      <div className="flex-1 flex items-center gap-[3px]">
        {slides.map((s, i) => {
          const color = i === current
            ? (s.kind === 'chapter' ? 'linear-gradient(to right, #FFD700, #38BDF8)' : 'linear-gradient(to right, #FFD700, #FB923C)')
            : i < current
              ? 'rgba(255,215,0,0.35)'
              : 'rgba(255,255,255,0.12)'
          return (
            <button
              key={i}
              onClick={() => onGoTo(i)}
              className="flex-1 rounded-full transition-all duration-300"
              style={{
                background: color,
                height: i === current ? 3 : 2,
                maxWidth: 48,
              }}
            />
          )
        })}
      </div>
      {!compact && maxY && maxY !== minY && (
        <span className="text-[0.5rem] font-mono tabular-nums flex-shrink-0"
          style={{ color: 'rgba(255,255,255,0.32)' }}>{maxY}</span>
      )}
    </div>
  )
}

// ─── Music player ─────────────────────────────────────────────────────────────

function useMusicPlayer(src) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  function toggle() {
    if (!src) return
    if (!audioRef.current) {
      const a = new Audio(src)
      a.loop = true
      a.volume = 0.18
      audioRef.current = a
    }
    if (audioRef.current.paused) audioRef.current.play().then(() => setPlaying(true)).catch(() => {})
    else { audioRef.current.pause(); setPlaying(false) }
  }
  useEffect(() => () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null } }, [])
  return { playing, toggle }
}

// ─── Build the storyboard ─────────────────────────────────────────────────────
// When photos exist: first photo gets a `showTitle` flag — the name + dates
//   overlay appears on top of the actual photo (no separate blank title card).
// When no photos: returns a single typographic title-only slide.
//
// Total runtime is capped at MAX_RUNTIME_MS (2 min). Per-photo duration scales
// down as the number of photos grows. Chapter markers count toward the budget.

function buildStoryboard(photos, memorial) {
  const sorted = (photos || [])
    .filter(p => p.url)
    .map(p => ({ ...p, date: getDate(p) }))
    .sort((a, b) => (a.date || 0) - (b.date || 0))

  // No photos → typography-only title slide
  if (sorted.length === 0) {
    return [{ kind: 'title-only', duration: 8000 }]
  }

  const slides = []

  // ── Plan chapter markers ──────────────────────────────────────────────────
  // Identify year transitions (skip first), so we can budget time for them.
  const chapterIndexes = []
  let lastYear = null
  sorted.forEach((p, i) => {
    const year = pickYear(p.date)
    if (year && lastYear !== null && year !== lastYear) chapterIndexes.push(i)
    if (year) lastYear = year
  })

  // ── Compute dynamic per-photo duration so total ≤ MAX_RUNTIME_MS ──────────
  const fixedTime = TITLE_HOLD_MS + CLOSING_DURATION + chapterIndexes.length * CHAPTER_DURATION
  const available = Math.max(MAX_RUNTIME_MS - fixedTime, sorted.length * PHOTO_MIN_DUR)
  let perPhoto    = Math.floor(available / sorted.length)
  perPhoto = Math.max(PHOTO_MIN_DUR, Math.min(PHOTO_MAX_DUR, perPhoto))

  // ── Emit slides ───────────────────────────────────────────────────────────
  lastYear = null
  sorted.forEach((p, i) => {
    const year = pickYear(p.date)
    if (year && lastYear !== null && year !== lastYear) {
      slides.push({ kind: 'chapter', year, duration: CHAPTER_DURATION })
    }
    // First photo carries the opening title overlay + extra hold
    const isFirst = i === 0
    slides.push({
      kind: 'photo',
      url: p.url,
      date: p.date,
      caption: p.caption,
      duration: isFirst ? perPhoto + TITLE_HOLD_MS : perPhoto,
      showTitle: isFirst,
    })
    if (year) lastYear = year
  })

  slides.push({ kind: 'closing', duration: CLOSING_DURATION })
  return slides
}

// ─── Main LifeReel ────────────────────────────────────────────────────────────

export default function LifeReel({
  photos    = [],
  memorial  = {},
  musicUrl  = null,
  onEnd     = null,
  onExpand  = null,
  fill      = false,
  compact   = false,
}) {
  const containerRef = useRef(null)
  const [current,    setCurrent]    = useState(0)
  const [prev,       setPrev]       = useState(null)
  const [isExiting,  setIsExiting]  = useState(false)
  const [letterbox,  setLetterbox]  = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [showGrain,  setShowGrain]  = useState(true)
  const [paused,     setPaused]     = useState(false)
  const timerRef = useRef(null)

  const { playing: musicPlaying, toggle: toggleMusic } = useMusicPlayer(musicUrl)

  // Build storyboard (title + photos + chapters + closing)
  const slides = useMemo(() => buildStoryboard(photos, memorial), [photos, memorial])

  // Auto-advance
  const advance = useCallback(() => {
    if (slides.length === 0) return
    const isLast = current === slides.length - 1
    if (isLast) { onEnd?.(); return }
    const next = current + 1
    setPrev(current)
    setIsExiting(true)
    setTimeout(() => {
      setCurrent(next)
      setIsExiting(false)
      setPrev(null)
    }, FADE_DURATION)
  }, [current, slides.length, onEnd])

  useEffect(() => {
    clearTimeout(timerRef.current)
    if (paused || slides.length < 2) return
    const dur = slides[current]?.duration || PHOTO_DURATION
    timerRef.current = setTimeout(advance, dur)
    return () => clearTimeout(timerRef.current)
  }, [current, advance, slides, paused])

  function goTo(idx) {
    if (idx === current) return
    clearTimeout(timerRef.current)
    setPrev(current)
    setIsExiting(true)
    setTimeout(() => {
      setCurrent(idx)
      setIsExiting(false)
      setPrev(null)
    }, FADE_DURATION)
  }

  function restart() { goTo(0) }

  function toggleFullscreen() {
    if (onExpand) { onExpand(); return }
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
  const hasContent   = slides.length > 0

  return (
    <div
      ref={containerRef}
      onClick={() => setPaused(p => !p)}
      className={fill ? 'select-none' : 'relative w-full overflow-hidden rounded-2xl select-none cursor-pointer'}
      style={fill ? {
        position:   'absolute',
        inset:      0,
        background: '#050509',
        overflow:   'hidden',
      } : {
        aspectRatio: '16/9',
        minHeight:   220,
        maxHeight:   fullscreen ? '100vh' : (compact ? 360 : 560),
        background:  '#050509',
        boxShadow:   compact ? '0 6px 30px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.04) inset' : '0 12px 60px rgba(0,0,0,0.6)',
        border:      compact ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(255,215,0,0.08)',
      }}
    >
      {!hasContent ? (
        <TitleCard memorial={memorial} />
      ) : (
        <>
          {/* Outgoing slide */}
          <AnimatePresence>
            {isExiting && prevSlide && (
              <motion.div
                key={`prev-${prev}`}
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: FADE_DURATION / 1000, ease: 'easeInOut' }}
                className="absolute inset-0 z-[1]"
              >
                <RenderSlide slide={prevSlide} idx={prev} memorial={memorial} showText={false} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Incoming slide — blur dissolve */}
          <motion.div
            key={`curr-${current}`}
            initial={{ opacity: 0, filter: 'blur(12px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            transition={{ duration: FADE_DURATION / 1000, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 z-[2]"
          >
            <RenderSlide slide={currentSlide} idx={current} memorial={memorial} showText={true} />
          </motion.div>

          {/* Film grain */}
          <GrainCanvas active={showGrain} />

          {/* Letterbox bars */}
          <AnimatePresence>
            {letterbox && (
              <>
                <motion.div
                  key="lb-top"
                  initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} exit={{ scaleY: 0 }}
                  transition={{ duration: 0.45 }}
                  className="absolute inset-x-0 top-0 z-40 pointer-events-none"
                  style={{ height: '9%', background: '#000', transformOrigin: 'top' }}
                />
                <motion.div
                  key="lb-bottom"
                  initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} exit={{ scaleY: 0 }}
                  transition={{ duration: 0.45 }}
                  className="absolute inset-x-0 bottom-0 z-40 pointer-events-none"
                  style={{ height: '9%', background: '#000', transformOrigin: 'bottom' }}
                />
              </>
            )}
          </AnimatePresence>

          {/* Pause indicator */}
          <AnimatePresence>
            {paused && (
              <motion.div
                key="pause"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
              >
                <div className="rounded-full p-5"
                  style={{
                    background: 'rgba(8,8,15,0.7)',
                    border: '1px solid rgba(255,215,0,0.35)',
                    backdropFilter: 'blur(20px)',
                  }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="rgba(255,215,0,0.9)">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Controls — top right */}
          <div className="absolute top-3 right-3 z-50 flex gap-1.5"
            onClick={e => e.stopPropagation()}>
            <button
              onClick={toggleFullscreen}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
              style={{
                background: 'rgba(8,8,15,0.65)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.7)',
                backdropFilter: 'blur(10px)',
              }}
              title={onExpand ? 'Open theater' : 'Fullscreen'}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {fullscreen
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4 4m0 0l5 0m-5 0l0 5M15 9l5-5m0 0l-5 0m5 0l0 5M9 15l-5 5m0 0l5 0m-5 0l0-5M15 15l5 5m0 0l-5 0m5 0l0-5" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                }
              </svg>
            </button>

            {!compact && (
              <>
                <button
                  onClick={() => setLetterbox(l => !l)}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all text-[9px] font-bold"
                  style={{
                    background: 'rgba(8,8,15,0.65)',
                    border: `1px solid ${letterbox ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.15)'}`,
                    color: letterbox ? 'rgba(255,215,0,0.9)' : 'rgba(255,255,255,0.6)',
                    backdropFilter: 'blur(10px)',
                  }}
                  title="Letterbox"
                >
                  ▬
                </button>

                <button
                  onClick={() => setShowGrain(g => !g)}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all text-[8px] font-bold"
                  style={{
                    background: 'rgba(8,8,15,0.65)',
                    border: `1px solid ${showGrain ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.15)'}`,
                    color: showGrain ? 'rgba(255,215,0,0.9)' : 'rgba(255,255,255,0.6)',
                    backdropFilter: 'blur(10px)',
                  }}
                  title="Film grain"
                >
                  ⣿
                </button>

                {musicUrl && (
                  <button
                    onClick={toggleMusic}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                    style={{
                      background: 'rgba(8,8,15,0.65)',
                      border: `1px solid ${musicPlaying ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.15)'}`,
                      color: musicPlaying ? 'rgba(255,215,0,0.9)' : 'rgba(255,255,255,0.6)',
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    <svg className="w-3.5 h-3.5" fill={musicPlaying ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
                    </svg>
                  </button>
                )}

                <button
                  onClick={restart}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                  style={{
                    background: 'rgba(8,8,15,0.65)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'rgba(255,255,255,0.7)',
                    backdropFilter: 'blur(10px)',
                  }}
                  title="Restart"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* Slide counter */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <span className="rounded-full px-2.5 py-1 text-[0.55rem] font-mono tracking-widest tabular-nums"
              style={{
                background: 'rgba(8,8,15,0.5)',
                color: 'rgba(255,255,255,0.55)',
                border: '1px solid rgba(255,255,255,0.10)',
                backdropFilter: 'blur(10px)',
              }}>
              {current + 1} / {slides.length}
            </span>
          </div>

          {/* Scrubber */}
          <Scrubber slides={slides} current={current} onGoTo={goTo} compact={compact} />
        </>
      )}

      <style>{`@keyframes lr-pulse { 0%,100% { opacity:.4; transform:scale(1) } 50% { opacity:.85; transform:scale(1.15) } }`}</style>
    </div>
  )
}
