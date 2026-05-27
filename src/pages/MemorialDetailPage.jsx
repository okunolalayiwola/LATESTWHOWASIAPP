// src/pages/MemorialDetailPage.jsx — v3 "Editorial"
// Design: Memorial v2 — cream paper · saffron · Space Grotesk + Fraunces
// Layout: Hero (full-bleed) → 2-col sticky-rail grid → footer

import { useState, useRef, useMemo, useEffect, Suspense, Component } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { id } from '@instantdb/react'
import { db } from '../lib/instant'
import { uploadImage } from '../lib/storage'
import useSEO from '../hooks/useSEO'
import { useToast } from '../contexts/ToastContext'
import InviteCodeBadge from '../components/shared/InviteCodeBadge'
import FamilyMessagesSection from '../components/shared/FamilyMessagesSection'

// ─── Safe lazy loaders ────────────────────────────────────────────────────────
// Uses lazyWithRetry: on a chunk-fetch failure (typical after a redeploy where
// the user's cached index.html points at chunks that no longer exist), it
// retries once, then reloads the page to pick up the fresh index.html.
import { lazyWithRetry } from '../lib/lazyWithRetry'

const QRModal             = lazyWithRetry(() => import('../components/ui/QRModal'))
const LifeReel            = lazyWithRetry(() => import('../components/ui/LifeReel'))
const TalkScreen          = lazyWithRetry(() => import('../components/ui/TalkScreen'))
const FamilyTreeOrb       = lazyWithRetry(() => import('../components/orbital/FamilyTreeOrb'))
const FamilyTreeSidePanel = lazyWithRetry(() => import('../components/orbital/FamilyTreeSidePanel'))
const InviteModal         = lazyWithRetry(() => import('../components/shared/InviteModal'))
const Empty = () => null

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  cream:       '#f1ece1',
  cream2:      '#e8e1d1',
  paper:       '#f7f3ea',
  paperWarm:   '#efe7d6',
  ink:         '#15120e',
  ink2:        '#2a241d',
  inkSoft:     '#423a31',
  muted:       '#7a7164',
  muted2:      '#948a7a',
  saffron:     '#f3b21a',
  saffron2:    '#ffce5a',
  saffronDeep: '#d99206',
  rust:        '#c8531f',
  moss:        '#5e7a3e',
}

const MONO  = "'JetBrains Mono', ui-monospace, monospace"
const DISP  = "'Space Grotesk', system-ui, sans-serif"
const SERIF = "'Fraunces', Georgia, serif"
const STRIPE = 'repeating-linear-gradient(135deg, transparent 0 9px, rgba(21,18,14,.85) 9px 10px)'

// Only one tribute type — candles and memories removed
const TRIBUTE_TYPES = [
  { type: 'tribute', emoji: '♡', label: 'Tribute' },
]

// ─── Utilities ────────────────────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return ''
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60)     return 'just now'
  if (s < 3600)   return `${Math.floor(s / 60)}m ago`
  if (s < 86400)  return `${Math.floor(s / 3600)}h ago`
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function initials(name = '') {
  return name.trim().split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase() || '??'
}

function calcAge(born, died, alive) {
  if (!born) return null
  const bYear = parseInt(String(born).match(/\d{4}/)?.[0])
  if (!bYear) return null
  const dYear = (died && alive === false) ? parseInt(String(died).match(/\d{4}/)?.[0]) : new Date().getFullYear()
  return dYear && dYear > bYear ? dYear - bYear : null
}

// Picks the first vowel after index 0 and wraps it in italic serif
function StyledName({ name = '' }) {
  const lower = name.toLowerCase()
  const idx   = lower.split('').findIndex((ch, i) => i > 0 && 'aeiou'.includes(ch))
  if (idx < 1) {
    return <>{lower}<span style={{ color: 'var(--theme, #f3b21a)' }}>.</span></>
  }
  return (
    <>
      {lower.slice(0, idx)}
      <em style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300, color: 'var(--theme, #f3b21a)' }}>
        {lower[idx]}
      </em>
      {lower.slice(idx + 1)}
      <span style={{ color: 'var(--theme, #f3b21a)' }}>.</span>
    </>
  )
}

// ─── Shared UI atoms ──────────────────────────────────────────────────────────

function Label({ children, onInk = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}
      style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.24em', textTransform: 'uppercase', color: onInk ? 'rgba(241,236,225,.6)' : C.muted }}>
      <span style={{ color: 'var(--theme, #f3b21a)' }}>◆</span>
      {children}
    </span>
  )
}

// Card — premium surfaces.
// Each variant uses a subtle top→bottom gradient + a layered shadow stack
// (hairline top highlight, bottom recess, close drop, far ambient) so the
// panels read as objects floating on the page rather than flat rectangles.
// The will-change + contain hints keep the long page scrolling smoothly by
// confining repaints to each card instead of cascading down the column.
function Card({ variant = 'paper', className = '', style = {}, children, ...rest }) {
  const SH_INK = [
    '0 1px 0 rgba(255,255,255,.07) inset',
    '0 -1px 0 rgba(0,0,0,.35) inset',
    '0 8px 16px -4px rgba(0,0,0,.35)',
    '0 24px 40px -16px rgba(0,0,0,.45)',
  ].join(', ')
  const SH_PAPER = [
    '0 1px 0 rgba(255,255,255,.75) inset',
    '0 -1px 0 rgba(21,18,14,.05) inset',
    '0 6px 14px -4px rgba(21,18,14,.08)',
    '0 22px 40px -16px rgba(21,18,14,.10)',
  ].join(', ')
  const SH_SAFFRON = [
    '0 1px 0 rgba(255,255,255,.45) inset',
    '0 -1px 0 rgba(21,18,14,.10) inset',
    '0 10px 22px -6px rgba(243,178,26,.32)',
    '0 22px 44px -16px rgba(243,178,26,.22)',
  ].join(', ')

  // Solid card surfaces — no gradients. Each variant uses one clean tone
  // so the colour reads consistently regardless of card height. The ink
  // tone is lifted a hair above the page background (#0a0805) so the
  // panel still floats; depth now comes from the shadow stack alone.
  const base = {
    paper: {
      background: C.paper,
      border: '1px solid rgba(21,18,14,.08)',
      boxShadow: SH_PAPER,
      color: C.ink,
    },
    ink: {
      background: '#191410',
      border: '1px solid rgba(241,236,225,.10)',
      boxShadow: SH_INK,
      color: C.cream,
    },
    saffron: {
      background: 'var(--theme, #f3b21a)',
      border: '1px solid rgba(21,18,14,.12)',
      boxShadow: SH_SAFFRON,
      color: C.ink,
    },
  }
  return (
    <div
      className={`rounded-[26px] overflow-hidden ${className}`}
      style={{
        ...base[variant],
        // Hardware-friendly hints — keep each card's repaint isolated so
        // scrolling the long right column doesn't trigger global redraws.
        contain: 'layout paint',
        transform: 'translateZ(0)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  )
}

// ─── Waveform bars (static decoration) ───────────────────────────────────────
const WAVE_SEEDS = [.4,.7,.55,.85,.6,.9,.5,.75,.45,.65,.85,.55,.35,.7,.95,.65,.4,.55,.85,.6,.5,.4,.75,.55,.32,.6,.8,.45,.7,.5,.4,.62,.5,.7,.85,.4,.55,.7,.5,.32,.55,.7,.4,.65,.85,.5]

// WaveformBars
// Renders the 46 static seed bars in the user's theme colour. When a
// progress (0..1) is passed, bars to the left of the playhead are fully
// lit and the rest are dimmed — accurate to real audio position.
function WaveformBars({ playing = false, progress = null }) {
  const total = WAVE_SEEDS.length
  // If we have a real progress value, use it; otherwise fall back to the
  // "first 12 lit" decoration so static waveforms still look alive.
  const litCount = progress != null
    ? Math.max(0, Math.min(total, Math.round(progress * total)))
    : (playing ? 12 : 0)

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 38, marginTop: 4 }}>
      {WAVE_SEEDS.map((h, i) => {
        const isLit = i < litCount
        return (
          <span key={i} style={{
            flex: 1,
            height: `${h * 100}%`,
            background: 'var(--theme, #f3b21a)',
            borderRadius: 2,
            opacity: isLit ? 1 : (playing ? 0.32 : 0.28),
            transition: 'opacity .12s linear',
          }} />
        )
      })}
    </div>
  )
}

// Helper — format seconds → m:ss
function fmtMs(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ─── Inline voice player ──────────────────────────────────────────────────────
function useVoice(voiceUrl) {
  const [state, setState] = useState('idle')
  const audioRef = useRef(null)

  function toggle() {
    if (state === 'playing') {
      audioRef.current?.pause()
      setState('paused')
    } else if (state === 'paused') {
      audioRef.current?.play().then(() => setState('playing')).catch(() => setState('idle'))
    } else if (voiceUrl) {
      const a = new Audio(voiceUrl)
      audioRef.current = a
      setState('loading')
      a.oncanplaythrough = () => {
        a.play().then(() => setState('playing')).catch(() => setState('idle'))
      }
      a.onended  = () => { setState('idle'); audioRef.current = null }
      a.onerror  = () => setState('idle')
      a.load()
    }
  }

  useEffect(() => () => { audioRef.current?.pause() }, [])
  return { state, toggle }
}

// ─── Compact profile portrait ─────────────────────────────────────────────────
// Sits at the top of the right column (no longer a full-bleed hero). Portrait
// photo + name + dates + relation + status badge. Smooth bottom dissolve so
// the photo blends into the dark cabinet rather than ending on a hard line.
function ProfilePortrait({ memorial, memorialId, isOwner, navigate }) {
  const alive    = memorial.alive !== false
  const born     = memorial.born || memorial.dob || memorial.birthYear || ''
  const died     = memorial.died || memorial.dod || memorial.deathYear || ''
  const age      = calcAge(born, died, memorial.alive)
  const relation = memorial.relation || memorial.relationship || ''
  const bYear    = String(born).match(/\d{4}/)?.[0] || born
  const dYear    = String(died).match(/\d{4}/)?.[0] || died

  return (
    <Card variant="ink" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
      {/* ── Full-bleed portrait — text sits ON the photo. No meta strip,
            no demarcation line: the name, dates and relation are
            absolutely positioned over the lower third of the image. Taller
            (480px) so there's room for the photo AND the type to breathe. */}
      <div style={{
        position: 'relative',
        height: 480,
        overflow: 'hidden',
        background: '#191410',
      }}>
        {memorial.photo && (
          <img
            fetchpriority="high" decoding="async"
            src={memorial.photo}
            alt={memorial.name}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover',
              // 30% from the top keeps the eye-line in the upper third
              // (the editorial sweet-spot for portraits) without losing
              // the chin.
              objectPosition: 'center 30%',
              filter: 'saturate(.95) contrast(1.03)',
              animation: 'pp-slowzoom 2.4s cubic-bezier(.16,1,.3,1) both',
              willChange: 'transform',
            }}
          />
        )}

        {/* Deeper bottom scrim — text-on-photo demands more legibility,
            so the gradient pulls darker at the bottom but stays subtle
            through the upper half (face area). */}
        <div style={{
          position: 'absolute', inset: 'auto 0 0 0', height: '70%',
          background: `linear-gradient(to bottom,
            transparent 0%,
            rgba(21,18,14,.10) 25%,
            rgba(21,18,14,.40) 50%,
            rgba(21,18,14,.78) 78%,
            rgba(21,18,14,.95) 100%)`,
          pointerEvents: 'none',
        }} />

        {/* Top scrim — keeps the back/edit chips legible */}
        <div style={{
          position: 'absolute', inset: '0 0 auto 0', height: 140,
          background: 'linear-gradient(to bottom, rgba(0,0,0,.55), transparent 80%)',
          pointerEvents: 'none',
        }} />

        {/* Editorial vignette — soft corner darkening for depth */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,.30) 100%)',
        }} />

        {/* Inner hairline border for "film cell" feel */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          boxShadow: 'inset 0 0 0 1px rgba(241,236,225,.16)',
        }} />

        {/* Top controls — back + edit */}
        <div style={{
          position: 'absolute', top: 12, left: 12, right: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          zIndex: 3,
        }}>
          <button onClick={() => navigate(-1)} aria-label="Back"
            style={{
              width: 36, height: 36, borderRadius: 999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(241,236,225,.92)', color: C.ink,
              border: '1px solid rgba(21,18,14,.12)',
              backdropFilter: 'blur(8px)',
              cursor: 'pointer',
            }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 11px', borderRadius: 999,
              fontFamily: MONO, fontSize: 10, letterSpacing: '.20em', textTransform: 'uppercase',
              color: alive ? '#fff' : C.ink,
              background: alive ? 'rgba(94,122,62,.65)' : 'var(--theme, #f3b21a)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(21,18,14,.15)',
              boxShadow: `0 2px 10px ${alive ? 'rgba(94,122,62,.35)' : 'rgba(243,178,26,.30)'}`,
              fontWeight: 700,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: alive ? '#fff' : C.ink,
                animation: 'pp-livepulse 2s infinite',
              }} />
              {alive ? 'Living' : 'In memory'}
            </span>
            {isOwner && (
              <Link to={`/memorial/${memorialId}/edit`} aria-label="Edit"
                style={{
                  width: 36, height: 36, borderRadius: 999,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(241,236,225,.92)', color: C.ink,
                  border: '1px solid rgba(21,18,14,.12)',
                  backdropFilter: 'blur(8px)',
                  textDecoration: 'none',
                }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </Link>
            )}
          </div>
        </div>

        {/* ── Name + dates overlay — sits ON the photo, no separator line.
              Anchored to the bottom of the image and reads against the
              deep scrim above. */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          padding: '0 28px 28px',
          zIndex: 3,
        }}>
          {relation && (
            <div style={{
              fontFamily: MONO, fontSize: 10, letterSpacing: '.28em', textTransform: 'uppercase',
              color: 'var(--theme, #f3b21a)', display: 'inline-flex', alignItems: 'center', gap: 8,
              marginBottom: 12, fontWeight: 700,
              textShadow: '0 2px 8px rgba(0,0,0,.55)',
            }}>
              <span>◆</span>{relation}
            </div>
          )}
          <h1 style={{
            fontFamily: DISP, fontWeight: 700,
            fontSize: 'clamp(32px, 5vw, 52px)', lineHeight: .95,
            letterSpacing: '-.035em',
            color: '#fff', textTransform: 'lowercase',
            margin: 0,
            wordBreak: 'break-word',
            textShadow: '0 4px 24px rgba(0,0,0,.55)',
          }}>
            <StyledName name={memorial.name || ''} />
          </h1>
          <div style={{
            display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 14,
            fontFamily: MONO, fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,.82)',
            textShadow: '0 2px 8px rgba(0,0,0,.55)',
          }}>
            {bYear && (
              <span>
                <strong style={{ fontFamily: DISP, fontWeight: 600, fontSize: 12.5, color: '#fff' }}>
                  {bYear}
                </strong>
                {' — '}{alive ? 'present' : (dYear || '†')}
              </span>
            )}
            {age && (
              <>
                <span style={{ color: 'rgba(255,255,255,.4)' }}>·</span>
                <span>{age} years {alive ? 'young' : 'lived'}</span>
              </>
            )}
            {memorial.location && (
              <>
                <span style={{ color: 'rgba(255,255,255,.4)' }}>·</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {memorial.location}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pp-slowzoom { from { transform: scale(1.06); } to { transform: scale(1); } }
        @keyframes pp-livepulse{ 0%,100%{ opacity:1; transform:scale(1); } 50%{ opacity:.4; transform:scale(.85); } }
      `}</style>
    </Card>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
// (Kept for legacy uses; the main detail page no longer renders this. The
//  compact ProfilePortrait above lives in the right column instead.)
function Hero({ memorial, memorialId, isOwner, navigate }) {
  const alive    = memorial.alive !== false
  const born     = memorial.born || memorial.dob || memorial.birthYear || ''
  const died     = memorial.died || memorial.dod || memorial.deathYear || ''
  const age      = calcAge(born, died, memorial.alive)
  const relation = memorial.relation || memorial.relationship || ''
  const bYear    = String(born).match(/\d{4}/)?.[0] || born
  const dYear    = String(died).match(/\d{4}/)?.[0] || died

  return (
    <section style={{
      position: 'relative',
      margin: '1rem 1rem 0',
      borderRadius: 26,
      overflow: 'hidden',
      background: C.ink,
      height: '64vh',
      minHeight: 480,
      maxHeight: 680,
      border: '1px solid rgba(21,18,14,.12)',
    }}>
      {/* Dark ink base — fills the whole hero (visible on right where photo stops) */}
      <div style={{ position: 'absolute', inset: 0,
        background: `linear-gradient(135deg, ${C.ink2} 0%, ${C.ink} 100%)` }} />

      {/* Photo — confined to the left ~62%, portrait-style */}
      {memorial.photo && (
        <img src={memorial.photo} alt={memorial.name}
          className="hero-photo"
          style={{
            position: 'absolute',
            top: 0, left: 0, bottom: 0,
            width: '62%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 20%',
            filter: 'saturate(.9) contrast(1.04)',
            animation: 'slowzoom 1.8s ease-out both',
          }}
        />
      )}

      {/* Bottom scrim — text readability over the name plate */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(to bottom, rgba(21,18,14,.04) 0%, transparent 25%, rgba(21,18,14,.58) 78%, rgba(21,18,14,.92) 100%)' }} />

      {/* Right-blend — photo dissolves seamlessly into the dark background */}
      {memorial.photo && (
        <div className="hero-blend" style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `linear-gradient(to right, transparent 28%, rgba(21,18,14,.72) 50%, ${C.ink} 66%)` }} />
      )}
      {/* Film-strip inner border */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        boxShadow: 'inset 0 0 0 1px rgba(241,236,225,.16)', borderRadius: 26 }} />

      {/* Top bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1.5rem 1.5rem 0' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <button onClick={() => navigate(-1)} aria-label="Back"
            style={{ width: 42, height: 42, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(241,236,225,.92)', color: C.ink, border: '1px solid rgba(21,18,14,.12)',
              backdropFilter: 'blur(8px)', cursor: 'pointer', fontSize: 14, transition: 'transform .15s' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase',
            color: 'rgba(241,236,225,.7)', display: 'flex', gap: 12, alignItems: 'center' }}>
            <span>Who Was I</span>
            {relation && <><span style={{ color: 'rgba(241,236,225,.4)' }}>/</span><span>{relation}</span></>}
            <span style={{ color: 'rgba(241,236,225,.4)' }}>/</span>
            <span style={{ color: '#fff' }}>{memorial.name?.split(' ')[0]}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Living / Passed badge */}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px',
            borderRadius: 999, fontFamily: MONO, fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase',
            color: C.ink, background: alive ? C.moss : 'var(--theme, #f3b21a)',
            border: '1px solid rgba(21,18,14,.15)', boxShadow: `0 2px 10px ${alive ? 'rgba(94,122,62,.4)' : 'rgba(243,178,26,.32)'}`,
            color: alive ? '#fff' : C.ink }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: alive ? '#fff' : C.ink,
              animation: 'livepulse 2s infinite', display: 'inline-block' }} />
            {alive ? 'Living' : 'In memory'}
          </span>
          {isOwner && (
            <Link to={`/memorial/${memorialId}/edit`} aria-label="Edit"
              style={{ width: 42, height: 42, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(241,236,225,.92)', color: C.ink, border: '1px solid rgba(21,18,14,.12)',
                backdropFilter: 'blur(8px)', textDecoration: 'none', transition: 'transform .15s' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </Link>
          )}
        </div>
      </div>

      {/* Name plate */}
      <div className="hero-nameplate"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0,
          padding: '0 2rem 2rem', zIndex: 2, color: C.cream,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24,
          animation: 'rise 0.8s ease-out 0.25s both' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {relation && (
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.28em', textTransform: 'uppercase',
              color: 'var(--theme, #f3b21a)', display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: '.75rem' }}>
              <span style={{ color: 'var(--theme, #f3b21a)' }}>◆</span>
              {relation} · vol. 01
            </div>
          )}
          <h1 style={{ fontFamily: DISP, fontWeight: 700,
            fontSize: 'clamp(32px, 8.5vw, 120px)', lineHeight: .9,
            letterSpacing: '-.045em', color: '#fff', textTransform: 'lowercase', margin: 0,
            wordBreak: 'break-word', overflowWrap: 'break-word' }}>
            <StyledName name={memorial.name || ''} />
          </h1>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: '1rem',
            fontFamily: MONO, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase',
            color: 'rgba(241,236,225,.75)' }}>
            {bYear && (
              <span>
                <strong style={{ fontFamily: DISP, fontWeight: 600, fontSize: 13, letterSpacing: '.02em', color: '#fff' }}>{bYear}</strong>
                {' — '}{alive ? 'present' : (dYear || '†')}
              </span>
            )}
            {bYear && memorial.location && <span style={{ color: 'rgba(241,236,225,.3)' }}>·</span>}
            {memorial.location && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {memorial.location}
              </span>
            )}
            {age && (
              <><span style={{ color: 'rgba(241,236,225,.3)' }}>·</span>
              <span>{age} years {alive ? 'young' : 'lived'}</span></>
            )}
          </div>
        </div>

        {/* Chapter card — hidden on mobile */}
        <div className="hidden md:block" style={{ background: 'rgba(241,236,225,.95)', color: C.ink,
          borderRadius: 14, padding: '14px 16px 12px', minWidth: 200,
          boxShadow: '0 8px 24px rgba(0,0,0,.18)', flexShrink: 0 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.22em', textTransform: 'uppercase',
            color: C.muted, marginBottom: 6 }}>Chapter</div>
          <div style={{ fontFamily: DISP, fontWeight: 700, fontSize: 20, letterSpacing: '-.01em', lineHeight: 1.1 }}>
            {alive ? <>An ongoing <em style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300, color: 'var(--theme, #f3b21a)' }}>life</em></> :
                     <>A life <em style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300, color: 'var(--theme, #f3b21a)' }}>remembered</em></>}
          </div>
          <div style={{ marginTop: 10, height: 6, borderRadius: 3, background: C.cream2, overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%',
              width: `${Math.min((calcAge(born, died, memorial.alive) || 62) / 100 * 100, 100)}%`,
              background: 'var(--theme, #f3b21a)',
              backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 5px, rgba(21,18,14,.4) 5px 6px)' }} />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slowzoom { from { transform: scale(1.07); } to { transform: scale(1); } }
        @keyframes rise     { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes livepulse{ 0%,100%{ opacity:1; transform:scale(1); } 50%{ opacity:.4; transform:scale(.85); } }
        @media (max-width: 640px) {
          .hero-photo { width: 100% !important; object-position: center 18% !important; }
          .hero-blend { background: linear-gradient(to bottom, transparent 38%, rgba(21,18,14,.55) 65%, #15120e 100%) !important; }
          .hero-nameplate { padding: 0 1.25rem 1.5rem !important; gap: 12px !important; }
        }
      `}</style>
    </section>
  )
}

// ─── Life gauge card ──────────────────────────────────────────────────────────
function LifeGaugeCard({ memorial, tributeCount, candleCount, memoryCount }) {
  const born  = memorial.born || memorial.dob || memorial.birthYear || ''
  const died  = memorial.died || memorial.dod || memorial.deathYear || ''
  const age   = calcAge(born, died, memorial.alive)
  const bYear = String(born).match(/\d{4}/)?.[0] || born

  return (
    <Card variant="paper" style={{ padding: '22px 22px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Label>Life gauge</Label>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.18em', color: C.ink }}>01 / 04</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0 20px', gap: 8 }}>
        {/* Big gradient age */}
        <div style={{
          fontFamily: DISP, fontWeight: 600, fontSize: 'clamp(80px, 18vw, 140px)',
          lineHeight: 1, letterSpacing: '-.04em',
          // Flat theme colour instead of the pastel rainbow gradient —
          // matches the rest of the page's clean solid-colour rhythm.
          color: 'var(--theme, #f3b21a)',
          padding: '.12em .16em', margin: '-.12em -.16em', display: 'inline-block',
        }}>
          {age || '—'}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.32em', textTransform: 'uppercase', color: C.muted }}>
          years lived
        </div>
        {bYear && (
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.14em', color: C.ink, fontWeight: 500 }}>
            b. {bYear}
          </div>
        )}

        {/* Stats 3-col */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, width: '100%', marginTop: 22 }}>
          {[
            { label: 'Tributes', value: tributeCount, color: C.ink },
            { label: 'Candles',  value: candleCount,  color: C.rust },
            { label: 'Memories', value: memoryCount,  color: 'var(--theme, #f3b21a)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ padding: '14px 10px 12px', borderRadius: 14, textAlign: 'center',
              background: C.cream, border: '1px solid rgba(21,18,14,.08)' }}>
              <strong style={{ fontFamily: DISP, fontWeight: 700, fontSize: 28, lineHeight: 1,
                letterSpacing: '-.03em', display: 'block', color }}>{String(value).padStart(2, '0')}</strong>
              <span style={{ marginTop: 6, display: 'block', fontFamily: MONO, fontSize: 9.5,
                letterSpacing: '.22em', textTransform: 'uppercase', color: C.muted }}>{label}</span>
              <div style={{ width: 24, height: 4, borderRadius: 2, margin: '8px auto 0', background: color }} />
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

// ─── Actions card ─────────────────────────────────────────────────────────────
function ActionsCard({ onTribute, onShare, onQR }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {/* Primary tribute button */}
      <button onClick={onTribute} style={{
        width: '100%', padding: 0, border: 'none', cursor: 'pointer',
        background: 'var(--theme, #f3b21a)', color: C.ink, borderRadius: 26, overflow: 'hidden',
        display: 'grid', gridTemplateColumns: '1fr 96px', alignItems: 'stretch',
        boxShadow: '0 8px 22px rgba(243,178,26,.28), 0 1px 0 rgba(255,255,255,.5) inset',
        transition: 'transform .15s', textAlign: 'left', fontFamily: DISP,
      }}>
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}>
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.22em', textTransform: 'uppercase', opacity: .65 }}>◆ contribute</span>
          <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-.01em', lineHeight: 1 }}>Leave a tribute</h3>
        </div>
        <div style={{ background: C.ink, color: 'var(--theme, #f3b21a)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
          {/* Stripe pattern removed — solid ink panel for the clean look. */}
          <div style={{ position: 'relative', zIndex: 1, width: 44, height: 44, borderRadius: '50%',
            background: 'var(--theme, #f3b21a)', color: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>
          </div>
        </div>
      </button>

      {/* Ghost row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          { label: 'Share', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>, fn: onShare },
          { label: 'QR code', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><line x1="14" y1="14" x2="14" y2="18"/><line x1="18" y1="14" x2="21" y2="14"/><line x1="21" y1="18" x2="18" y2="18"/><line x1="14" y1="21" x2="21" y2="21"/></svg>, fn: onQR },
        ].map(({ label, icon, fn }) => (
          <button key={label} type="button"
            onClick={e => { e.preventDefault(); e.stopPropagation(); fn?.() }}
            style={{
              padding: '16px 18px', borderRadius: 20, background: C.paper, color: C.ink,
              border: '1px solid rgba(21,18,14,.10)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              fontFamily: DISP, fontSize: 13, fontWeight: 600, transition: 'background .15s',
              position: 'relative', zIndex: 1,
            }}>
            <span>{label}</span>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: C.cream,
              border: '1px solid rgba(21,18,14,.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {icon}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Life record card ─────────────────────────────────────────────────────────
function LifeRecordCard({ memorial }) {
  const alive    = memorial.alive !== false
  const born     = memorial.born || memorial.dob || memorial.birthYear || '—'
  const died     = memorial.died || memorial.dod || memorial.deathYear || '—'
  const location = memorial.location || '—'
  const relation = memorial.relation || memorial.relationship || '—'

  const cells = [
    { num: '01', key: 'Born',     value: born,     serif: true },
    { num: '02', key: 'Status',   value: alive ? 'Living' : 'Passed', living: alive },
    { num: '03', key: 'Location', value: location,  serif: location !== '—' },
    { num: '04', key: 'Relation', value: relation,  serif: relation !== '—' },
  ]

  return (
    <Card variant="paper" style={{ padding: 0 }}>
      <div style={{ padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid rgba(21,18,14,.06)' }}>
        <Label>Life record</Label>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase', color: C.ink }}>02 / 04</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        {cells.map(({ num, key, value, serif, living }, i) => (
          <div key={key} style={{
            padding: '18px 20px',
            borderTop: i >= 2 ? '1px solid rgba(21,18,14,.05)' : 'none',
            borderLeft: i % 2 === 1 ? '1px solid rgba(21,18,14,.05)' : 'none',
          }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.2em', color: C.muted2, marginBottom: 4 }}>{num}</div>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>{key}</div>
            <div style={{ fontFamily: DISP, fontWeight: 600, fontSize: 18, letterSpacing: '-.02em', color: C.ink, lineHeight: 1.05 }}>
              {living
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.moss, animation: 'livepulse 2s infinite', display: 'inline-block' }} />
                    Living
                  </span>
                : serif && value !== '—'
                ? <em style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300, color: 'var(--theme, #f3b21a)' }}>{value}</em>
                : value}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ─── Legacy vault card ────────────────────────────────────────────────────────
function LegacyVaultCard({ memorialId, letterCount, sealedCount, hasWill }) {
  return (
    <Link to={`/memorial/${memorialId}/letters`} style={{ textDecoration: 'none', display: 'block' }}>
      {/* ── Brushed-silver vault ───────────────────────────────────────────
            Top-to-bottom silver gradient body with a subtle radial sheen,
            inner top-highlight and bottom-recess shadows for a brushed-
            metal feel. Inner text reads in ink for crisp contrast.
            Lock icon sits in an ink chip; "Open vault" arrow is a small
            ink disc with cream glyph. */}
      <div style={{
        position: 'relative',
        background: 'linear-gradient(180deg, #e2dcd0 0%, #c1bbae 55%, #9c968a 100%)',
        color: C.ink, borderRadius: 26,
        padding: 22, overflow: 'hidden', cursor: 'pointer',
        border: '1px solid rgba(21,18,14,.18)',
        boxShadow: [
          '0 1px 0 rgba(255,255,255,.55) inset',     // crown highlight
          '0 -2px 4px rgba(0,0,0,.12) inset',        // base recess
          '0 0 0 1px rgba(0,0,0,.06) inset',         // edge hairline
          '0 8px 18px -4px rgba(21,18,14,.22)',
          '0 22px 40px -16px rgba(21,18,14,.25)',
        ].join(', '),
      }}>
        {/* Sheen — soft top-left bright spot, bottom-right shadow */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
          background:
            'radial-gradient(circle at 28% 18%, rgba(255,255,255,.40), transparent 55%),'
            + 'radial-gradient(circle at 80% 95%, rgba(21,18,14,.18), transparent 55%)' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, position: 'relative' }}>
          <Label>Legacy Vault</Label>
          <div style={{
            width: 38, height: 38, borderRadius: 11,
            background: C.ink, color: '#e6e1d6',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
            boxShadow: '0 1px 0 rgba(255,255,255,.10) inset, 0 4px 10px -2px rgba(0,0,0,.35)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
        </div>

        <h3 style={{ fontFamily: DISP, fontWeight: 700, fontSize: 22, letterSpacing: '-.02em', lineHeight: 1.1,
          color: C.ink, margin: '0 0 6px', position: 'relative' }}>
          Sealed messages &amp; <em style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300, color: C.ink2 }}>the will.</em>
        </h3>
        <p style={{ color: 'rgba(21,18,14,.62)', fontSize: 13.5, lineHeight: 1.55,
          marginBottom: 14, maxWidth: '42ch', position: 'relative' }}>
          Biometrically secured letters and final instructions. Open the vault to read or contribute.
        </p>

        <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
          {[
            { value: String(letterCount || 0).padStart(2, '0'), label: `Letters · ${sealedCount} sealed`, gold: false },
            { value: hasWill ? '✓' : '—', label: hasWill ? 'Will sealed' : 'No will yet', gold: hasWill },
          ].map(({ value, label, gold }) => (
            <div key={label} style={{ flex: 1, padding: 12, borderRadius: 14,
              background: 'rgba(255,255,255,.45)', border: '1px solid rgba(21,18,14,.10)',
              display: 'flex', flexDirection: 'column', gap: 6 }}>
              <strong style={{ fontFamily: DISP, fontWeight: 700, fontSize: 22, letterSpacing: '-.02em', lineHeight: 1,
                color: gold ? C.ink : C.ink }}>{value}</strong>
              <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.18em', textTransform: 'uppercase',
                color: 'rgba(21,18,14,.55)' }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 14,
          borderTop: '1px solid rgba(21,18,14,.18)',
          fontFamily: MONO, fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase',
          color: C.ink, position: 'relative', fontWeight: 700 }}>
          <span>Open vault</span>
          <div style={{ marginLeft: 'auto', width: 30, height: 30, borderRadius: '50%',
            background: C.ink, color: '#e6e1d6',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
            boxShadow: '0 1px 0 rgba(255,255,255,.10) inset, 0 3px 8px -2px rgba(0,0,0,.35)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Voice section ────────────────────────────────────────────────────────────
// Play disc now opens TalkScreen — the cinematic AI conversation overlay.
function VoiceSection({ memorial, onOpenTalk }) {
  const [recordingPlaying, setRecordingPlaying] = useState(false)
  const [currentTime,     setCurrentTime]      = useState(0)
  const [duration,        setDuration]         = useState(0)
  const voiceRef = useRef(null)

  const hasVoice    = !!(memorial.voiceUrl || memorial.elevenLabsVoiceId)
  const hasClip     = !!memorial.voiceUrl
  const bio         = memorial.bio || memorial.description || memorial.subtitle || ''
  const firstName   = memorial.name?.split(' ')[0] || 'them'
  const alive       = memorial.alive !== false

  // Real progress through the audio (0..1). Drives the waveform fill and
  // the timestamp labels — both reflect actual playback position rather
  // than a decorative "12 bars lit" hint.
  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0

  if (!hasVoice && !bio && !memorial.name) return null

  // Construct (or reuse) the Audio element. Hooks must be unconditional —
  // we wire onloadedmetadata / ontimeupdate / onended once and reuse.
  function ensureAudio() {
    if (voiceRef.current) return voiceRef.current
    const a = new Audio(memorial.voiceUrl)
    a.preload = 'metadata'
    a.onloadedmetadata = () => {
      // Some browsers report Infinity for streamed/webm files; clamp to 0.
      setDuration(Number.isFinite(a.duration) ? a.duration : 0)
    }
    a.ontimeupdate = () => setCurrentTime(a.currentTime)
    a.onended  = () => { setRecordingPlaying(false); setCurrentTime(0) }
    a.onerror  = () => setRecordingPlaying(false)
    voiceRef.current = a
    return a
  }

  // Toggle the original recording (separate from the AI talk screen).
  function toggleRecording() {
    if (!hasClip) return
    const a = ensureAudio()
    if (!a.paused) {
      a.pause()
      setRecordingPlaying(false)
      return
    }
    a.play()
      .then(() => setRecordingPlaying(true))
      .catch(() => setRecordingPlaying(false))
  }

  // Eager-load metadata when the card mounts so the duration label is
  // ready before the user clicks play — no "0:00 / 0:00" flash.
  useEffect(() => {
    if (!hasClip) return
    ensureAudio()
    return () => { voiceRef.current?.pause() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasClip])

  return (
    <Card variant="ink" style={{ padding: 0, position: 'relative', overflow: 'hidden' }}>
      {/* Ambient glow */}
      <div style={{ position: 'absolute', top: '-30%', right: '30%', left: 'auto',
        width: 340, height: 340, borderRadius: '50%',
        background: `radial-gradient(circle at 35% 35%, rgba(243,178,26,.35), transparent 60%)`,
        filter: 'blur(8px)', pointerEvents: 'none' }} />
      {/* Stripe */}
      <div style={{ position: 'absolute', inset: 'auto 0 0 0', height: '60%',
        backgroundImage: STRIPE, opacity: .06, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', display: 'grid',
        gridTemplateColumns: '1fr 220px', gap: 24, padding: '28px 28px 26px',
        alignItems: 'center' }}
        className="voice-grid">
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Label onInk>Voice of {firstName}</Label>
            {memorial.elevenLabsVoiceId && (
              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase',
                color: C.ink, background: 'var(--theme, #f3b21a)', padding: '4px 9px', borderRadius: 999 }}>◆ Voice captured</span>
            )}
          </div>
          <h3 style={{ fontFamily: DISP, fontWeight: 700, fontSize: 26, letterSpacing: '-.02em', lineHeight: 1.1, margin: 0, color: C.cream }}>
            Hear {firstName} speak —{' '}
            <em style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300, color: 'var(--theme, #f3b21a)' }}>
              {alive ? 'as they still do.' : 'as they were.'}
            </em>
          </h3>
          <p style={{ color: 'rgba(241,236,225,.6)', fontSize: 14, lineHeight: 1.55, margin: 0 }}>
            {hasVoice
              ? `A living voice experience drawing on ${firstName}'s life, recorded voice and memories.`
              : `A living memory experience drawing on ${firstName}'s life story and tributes.`}
          </p>

          {/* ── Embedded mini audio player ─────────────────────────────────
                Solid theme-coloured slab with a circular play button on
                the left and a real-progress waveform + duration label on
                the right. Everything reads in the user's chosen accent
                colour via var(--theme), so the page recolours cleanly when
                they pick a different brand colour. No gradients. */}
          {hasClip ? (
            <div style={{
              marginTop: 6,
              padding: '12px 14px',
              borderRadius: 16,
              background: 'rgba(241,236,225,.04)',
              border: '1px solid var(--theme, #f3b21a)',
              boxShadow: '0 1px 0 rgba(255,255,255,.04) inset, 0 6px 14px -6px rgba(0,0,0,.45)',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <button
                onClick={toggleRecording}
                aria-label={recordingPlaying ? 'Pause recording' : 'Play original recording'}
                style={{
                  width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
                  background: recordingPlaying
                    ? 'var(--theme, #f3b21a)'
                    : 'transparent',
                  border: '1.5px solid var(--theme, #f3b21a)',
                  color: recordingPlaying ? C.ink : 'var(--theme, #f3b21a)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: recordingPlaying
                    ? '0 8px 18px -4px var(--theme-md, rgba(243,178,26,.55))'
                    : '0 4px 12px -4px rgba(0,0,0,.45)',
                  transition: 'background .15s, color .15s, box-shadow .15s',
                }}>
                {recordingPlaying ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 2 }}><path d="M8 5v14l11-7z"/></svg>
                )}
              </button>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{
                  fontFamily: MONO, fontSize: 9.5, fontWeight: 700,
                  letterSpacing: '.22em', textTransform: 'uppercase',
                  color: 'var(--theme, #f3b21a)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: 'var(--theme, #f3b21a)',
                      boxShadow: recordingPlaying ? '0 0 8px var(--theme, #f3b21a)' : 'none',
                      animation: recordingPlaying ? 'vs-livedot 1.4s ease-in-out infinite' : 'none',
                      opacity: recordingPlaying ? 1 : 0.6,
                    }} />
                    {recordingPlaying ? 'Playing' : 'Original recording'}
                  </span>
                  {/* Real-time / total-time readout — accurate to the audio
                      element's duration + currentTime. tabular-nums keeps
                      the digits from jumping width as they tick. */}
                  <span style={{
                    color: 'rgba(241,236,225,.55)',
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '.12em',
                  }}>
                    {fmtMs(currentTime)} / {fmtMs(duration)}
                  </span>
                </div>
                <WaveformBars playing={recordingPlaying} progress={progress} />
              </div>
            </div>
          ) : (
            // No recording yet — show the waveform as a static decoration so
            // the layout doesn't lose its rhythm.
            <WaveformBars playing={false} />
          )}
        </div>

        {/* Right — saffron play disc + caption → opens AI TalkScreen.
            This is the "Speak to {name}" action. The Play recording button
            on the left handles the original audio clip. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <motion.button
            whileHover={{ translateY: -2, scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onOpenTalk?.()}
            aria-label={`Speak to ${firstName}`}
            style={{
              position: 'relative', width: 144, height: 144, borderRadius: '50%',
              // Solid theme colour — no gradient. The brand colour reads
              // crisper against the black canvas and stays consistent if
              // the user picks a different accent (e.g. red).
              background: 'var(--theme, #f3b21a)',
              border: 'none',
              boxShadow: [
                '0 24px 48px -8px var(--theme-md, rgba(243,178,26,.55))',
                '0 10px 24px -6px rgba(0,0,0,.45)',
                '0 2px 6px rgba(0,0,0,.25)',
              ].join(', '),
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            {/* Soft outer halo — tinted with the theme colour */}
            <span aria-hidden="true" style={{
              position: 'absolute', inset: -22, borderRadius: '50%', zIndex: -1,
              background: 'radial-gradient(circle, var(--theme-md, rgba(243,178,26,.30)) 0%, var(--theme-lt, rgba(243,178,26,.08)) 45%, transparent 70%)',
              pointerEvents: 'none',
            }} />
            {/* White play triangle — pure CSS borders, no SVG */}
            <span aria-hidden="true" style={{
              width: 0, height: 0,
              borderLeft:   '28px solid #ffffff',
              borderTop:    '18px solid transparent',
              borderBottom: '18px solid transparent',
              marginLeft: 9,
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.18)) drop-shadow(0 0 16px rgba(255,255,255,.30))',
            }} />
          </motion.button>
          <span style={{
            fontFamily: MONO, fontSize: 9.5, letterSpacing: '.24em',
            textTransform: 'uppercase', color: 'var(--theme, #f3b21a)', fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', gap: 7,
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Speak to {firstName}
          </span>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }
        @keyframes vs-pulse { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(.35); } }
        @keyframes vs-livedot { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
        @media (max-width: 600px) { .voice-grid { grid-template-columns: 1fr !important; }}`}</style>
    </Card>
  )
}

// ─── Reel viewport ────────────────────────────────────────────────────────────
// Cinematic Life Reel rendered as a small inline viewport directly under the
// "Hear them speak" voice section. Includes an Expand button that opens the
// full theater overlay (showReelFull state in the parent).
function ReelViewport({ memorial, photos, tributes, onExpand }) {
  const firstName = memorial?.name?.split(' ')[0] || 'them'
  const frameCount = photos?.length || 0

  return (
    <Card variant="ink" style={{ padding: 0, position: 'relative', overflow: 'hidden' }}>
      {/* Header — mirrors VoiceSection styling */}
      <div style={{
        padding: '18px 24px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12,
        borderBottom: '1px solid rgba(241,236,225,.06)',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Label onInk>Life Reel of {firstName}</Label>
          {/* Cream pill — matches the design screenshot the user shared.
              Solid cream face, dark ink text + ◆, soft drop shadow. */}
          <span style={{
            fontFamily: MONO, fontSize: 9.5, fontWeight: 700,
            letterSpacing: '.20em', textTransform: 'uppercase',
            color: C.ink,
            background: '#e6e1d6',
            border: '1px solid rgba(21,18,14,.18)',
            padding: '4px 11px', borderRadius: 999,
            boxShadow: '0 1px 0 rgba(255,255,255,.5) inset, 0 2px 6px -2px rgba(0,0,0,.35)',
          }}>
            ◆ Cinematic
          </span>
        </div>

        {/* Open theater — neutral outline pill */}
        <button
          onClick={onExpand}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'transparent',
            color: 'rgba(241,236,225,.85)',
            border: '1px solid rgba(241,236,225,.25)',
            borderRadius: 999,
            padding: '8px 16px',
            cursor: 'pointer',
            fontFamily: MONO, fontSize: 10.5, letterSpacing: '.20em', textTransform: 'uppercase',
            fontWeight: 700,
            transition: 'background .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(241,236,225,.06)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"/>
          </svg>
          Open theater
        </button>
      </div>

      {/* Sub-headline */}
      <div style={{ padding: '12px 24px 0' }}>
        <h3 style={{
          fontFamily: DISP, fontWeight: 700, fontSize: 22, letterSpacing: '-.02em',
          lineHeight: 1.15, margin: 0, color: C.cream,
        }}>
          A cinematic story —{' '}
          <em style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300, color: 'var(--theme, #f3b21a)' }}>
            in moments.
          </em>
        </h3>
        <p style={{ color: 'rgba(241,236,225,.55)', fontSize: 13, lineHeight: 1.55, margin: '6px 0 14px' }}>
          {frameCount > 0
            ? `${frameCount} frame${frameCount === 1 ? '' : 's'} woven into a living film — Ken Burns zooms, dated chapters, immersive transitions.`
            : `An opening title plays automatically. Add photos in the Gallery and they'll appear here as cinematic frames.`}
        </p>
      </div>

      {/* The viewport — compact LifeReel */}
      <div style={{ padding: '0 16px 16px' }}>
        <Suspense fallback={<div style={{ aspectRatio: '16/9', background: '#080808', borderRadius: 16 }} />}>
          <LifeReel
            photos={photos}
            memorial={memorial}
            tributes={tributes}
            compact
            onExpand={onExpand}
          />
        </Suspense>
      </div>
    </Card>
  )
}

// ─── Story card ───────────────────────────────────────────────────────────────
// Shows the lead sentence + a short teaser, with a "Read full bio" pill
// that opens a scrollable modal with the complete text. The original voice
// recording lives on the VoiceSection card now, not here.
function StoryCard({ memorial }) {
  const [showFull, setShowFull] = useState(false)

  const bio = memorial.bio || memorial.description || ''
  if (!bio) return null

  const sentences = bio.split(/(?<=[.!?])\s+/)
  const lead      = sentences[0] || bio.slice(0, 120)
  const wordCount = bio.split(/\s+/).filter(Boolean).length
  const readMins  = Math.max(1, Math.ceil(wordCount / 200))

  // Short teaser — second + third sentence (if present), otherwise none.
  // Keeps the card to a single screenful and pushes the rest into the modal.
  const teaser = sentences.length > 1
    ? sentences.slice(1, 3).join(' ').slice(0, 180) + (
        sentences.slice(1, 3).join(' ').length > 180 ? '…' : ''
      )
    : ''

  return (
    <>
    <Card variant="paper" style={{ padding: 0, background: C.cream2 }}>
      <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(21,18,14,.08)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Label>Life story</Label>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase', color: C.muted }}>
          written · {memorial.relation || 'family'} · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
        </span>
      </div>
      <div style={{ padding: '22px 28px 14px' }}>
        {/* Lead paragraph per design handoff: Fraunces 300 italic, 28px,
            ink colour, with a saffron-deep first-letter drop-cap. The
            ::first-letter rule lives in the page-level <style> tag below. */}
        <p className="story-lead" style={{
          fontFamily: SERIF, fontWeight: 300, fontStyle: 'italic',
          fontSize: 28, lineHeight: 1.22,
          color: C.ink, margin: '0 0 14px',
          letterSpacing: '-.01em',
        }}>{lead}</p>
        {teaser && (
          <p style={{ fontFamily: DISP, fontSize: 15, lineHeight: 1.7, color: C.ink2, margin: 0 }}>
            {teaser}
          </p>
        )}
      </div>
      <style>{`.story-lead::first-letter { color: ${'var(--theme, #f3b21a)'}; font-size: 1.1em; }`}</style>

      {/* ── Action row: Read full bio ───────────────────────────────────── */}
      <div style={{ padding: '4px 22px 18px',
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => setShowFull(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 999,
            background: C.ink, color: C.cream,
            border: 'none', cursor: 'pointer',
            fontFamily: MONO, fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 600,
            boxShadow: '0 6px 16px rgba(21,18,14,.18)',
            transition: 'transform .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = '' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
          Read full bio
        </button>

        <span style={{
          marginLeft: 'auto',
          fontFamily: MONO, fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase', color: C.muted,
        }}>
          {readMins} min read · {wordCount} words
        </span>
      </div>
    </Card>

    {/* ── Full-bio modal ─────────────────────────────────────────────── */}
    <AnimatePresence>
      {showFull && (
        <FullBioModal
          memorial={memorial}
          bio={bio}
          wordCount={wordCount}
          readMins={readMins}
          onClose={() => setShowFull(false)}
        />
      )}
    </AnimatePresence>
    </>
  )
}

// ─── Full-bio modal ───────────────────────────────────────────────────────────
// Scrollable popup for the entire bio. Closes on backdrop click, the X
// button, or Escape. Body scroll is locked while the modal is open.
function FullBioModal({ memorial, bio, wordCount, readMins, onClose }) {
  // Lock background scroll while modal is up
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // Split into paragraphs on double-newlines for readable formatting.
  // Falls back to one paragraph for bios written as a single block.
  const paragraphs = bio.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(21,18,14,.78)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        onClick={e => e.stopPropagation()}
        style={{
          background: C.cream2,
          borderRadius: 24,
          maxWidth: 720,
          width: '100%',
          maxHeight: 'calc(100vh - 40px)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 30px 80px rgba(21,18,14,.45)',
          border: '1px solid rgba(21,18,14,.10)',
        }}
      >
        {/* Sticky header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid rgba(21,18,14,.10)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
          background: C.cream2,
          flexShrink: 0,
        }}>
          <div>
            <div style={{
              fontFamily: MONO, fontSize: 10.5, fontWeight: 600,
              letterSpacing: '.22em', textTransform: 'uppercase',
              color: C.muted, marginBottom: 4,
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ color: 'var(--theme, #f3b21a)' }}>◆</span> Life story · {memorial.name?.split(' ')[0] || 'memorial'}
            </div>
            <div style={{
              fontFamily: MONO, fontSize: 10, letterSpacing: '.18em',
              textTransform: 'uppercase', color: C.muted2,
            }}>
              {readMins} min read · {wordCount} words
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 36, height: 36, borderRadius: 999, flexShrink: 0,
              background: C.ink, color: C.cream,
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'transform .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.06)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = '' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{
          padding: '28px 32px 32px',
          overflowY: 'auto',
          flex: 1,
          // Soft cream gradient at the top and bottom to hint at more content
          background: `linear-gradient(${C.cream2}, ${C.cream2}) padding-box`,
        }}>
          {paragraphs.map((p, i) => (
            <p
              key={i}
              className={i === 0 ? 'modal-bio-lead' : ''}
              style={
                i === 0 ? {
                  fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300,
                  fontSize: 22, lineHeight: 1.4, color: C.ink,
                  margin: '0 0 18px',
                  letterSpacing: '-.005em',
                } : {
                  fontFamily: DISP, fontSize: 15.5, lineHeight: 1.75,
                  color: C.ink2,
                  margin: '0 0 14px',
                }
              }
            >
              {p}
            </p>
          ))}
        </div>
        <style>{`.modal-bio-lead::first-letter { color: ${'var(--theme, #f3b21a)'}; font-size: 1.15em; }`}</style>
      </motion.div>
    </motion.div>
  )
}

// ─── Tribute card ─────────────────────────────────────────────────────────────
function TributeCard({ tribute, variant = 'light', onLike, onDelete, canDelete, memorialId, user, userProfile, isFamilyMember }) {
  const [liked,   setLiked]   = useState(false)
  const [confirm, setConfirm] = useState(false)
  const likes = (tribute.likes || 0) + (liked ? 1 : 0)

  const styles = {
    featured: { background: 'var(--theme, #f3b21a)', border: '1px solid rgba(21,18,14,.15)', color: C.ink, gridColumn: 'span 2' },
    light:    { background: C.paper,   border: '1px solid rgba(21,18,14,.08)', color: C.ink },
    dark:     { background: C.ink,     border: '1px solid rgba(21,18,14,.4)',  color: C.cream },
  }
  const s       = styles[variant] || styles.light
  const isDark  = variant === 'dark'
  const avatarS = variant === 'featured' ? { background: C.ink, color: 'var(--theme, #f3b21a)' } :
                  isDark                 ? { background: 'var(--theme, #f3b21a)', color: C.ink } :
                                           { background: C.cream2, color: C.ink }

  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: .97 }}
      style={{ padding: 18, borderRadius: 26, display: 'flex', flexDirection: 'column', gap: 12, ...s }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: MONO, fontWeight: 700, fontSize: 12,
          border: '1px solid rgba(21,18,14,.12)', ...avatarS }}>
          {tribute.authorPhoto
            ? <img src={tribute.authorPhoto} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            : initials(tribute.authorName || 'Anon')}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: DISP, fontWeight: 600, fontSize: 15, letterSpacing: '-.01em', lineHeight: 1.1,
            color: isDark ? C.cream : C.ink }}>{tribute.authorName || 'Anonymous'}</div>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.18em', textTransform: 'uppercase',
            color: isDark ? 'rgba(241,236,225,.4)' : C.muted }}>
            Tribute · {timeAgo(tribute.createdAt)}
          </div>
        </div>
        {canDelete && (
          <button onClick={() => confirm ? onDelete(tribute.id) : (setConfirm(true), setTimeout(() => setConfirm(false), 3000))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
              color: confirm ? C.rust : isDark ? 'rgba(241,236,225,.3)' : 'rgba(21,18,14,.25)' }}>
            {confirm ? 'Confirm?' : '✕'}
          </button>
        )}
      </div>

      <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300,
        fontSize: variant === 'featured' ? 20 : 16, lineHeight: 1.55, letterSpacing: '-.005em',
        color: isDark ? 'rgba(241,236,225,.85)' : C.ink, margin: 0 }}>
        "{tribute.text || tribute.content}"
      </p>

      {/* Attached photo */}
      {tribute.photoUrl && (
        <div style={{ borderRadius: 16, overflow: 'hidden', marginTop: 4 }}>
          <img src={tribute.photoUrl} alt="Tribute photo"
            style={{ width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block' }} />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => { if (liked) return; setLiked(true); onLike(tribute.id, tribute.likes || 0) }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px',
            borderRadius: 999, cursor: liked ? 'default' : 'pointer', border: 'none', fontFamily: MONO,
            fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase',
            background: variant === 'featured' ? 'rgba(21,18,14,.1)' : isDark ? 'rgba(241,236,225,.08)' : 'rgba(21,18,14,.04)',
            borderWidth: 1, borderStyle: 'solid',
            borderColor: variant === 'featured' ? 'rgba(21,18,14,.15)' : isDark ? 'rgba(241,236,225,.12)' : 'rgba(21,18,14,.08)',
            color: liked ? C.rust : isDark ? 'rgba(241,236,225,.6)' : C.ink }}>
          <span style={{ color: C.rust }}>{liked ? '♥' : '♡'}</span>
          {likes > 0 ? `${likes} ${likes === 1 ? 'heart' : 'hearts'}` : 'Like'}
        </button>
        {variant === 'featured' && (
          <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.18em', color: 'rgba(21,18,14,.55)', textTransform: 'uppercase' }}>featured</span>
        )}
      </div>

      {/* Comments — shown to family members and owner */}
      {(isFamilyMember || canDelete) && memorialId && (
        <TributeComments
          tributeId={tribute.id}
          memorialId={memorialId}
          user={user}
          userProfile={userProfile}
          isFamilyMember={!!(isFamilyMember || canDelete)}
        />
      )}
    </motion.div>
  )
}

// ─── Tributes section ─────────────────────────────────────────────────────────
function TributesSection({ tributes, onLike, onDelete, isOwner, currentUserId, memorialId, user, userProfile, isFamilyMember, preview = false }) {
  const shown = preview ? tributes.slice(0, 3) : tributes

  if (tributes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <div style={{ fontSize: 36, marginBottom: 16, color: 'rgba(21,18,14,.12)' }}>♡</div>
        <p style={{ fontFamily: DISP, color: C.muted, fontSize: 14 }}>No tributes yet. Be the first.</p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 12, padding: '0 4px' }}>
        <Label>Tributes</Label>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: C.muted }}>
          {tributes.length} in total{preview ? ' · 3 shown' : ''}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="tribs-grid">
        <AnimatePresence mode="popLayout">
          {shown.map((t, i) => {
            const variant = i === 0 ? 'featured' : i % 2 === 0 ? 'light' : 'dark'
            const canDel  = isOwner || (currentUserId && t.authorId === currentUserId)
            return (
              <TributeCard key={t.id} tribute={t} variant={variant} onLike={onLike} onDelete={onDelete} canDelete={canDel}
                memorialId={memorialId} user={user} userProfile={userProfile} isFamilyMember={isFamilyMember || isOwner} />
            )
          })}
        </AnimatePresence>
      </div>
      <style>{`@media (max-width: 600px) { .tribs-grid { grid-template-columns: 1fr !important; } .tribs-grid [style*="span 2"] { grid-column: span 1 !important; } }`}</style>
    </div>
  )
}

// ─── Gallery section ──────────────────────────────────────────────────────────
function GallerySection({ photos, memorialId, isOwner, preview = false }) {
  const [selected,  setSelected]  = useState(null)
  const [showAll,   setShowAll]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pct,       setPct]       = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [failedCount, setFailedCount] = useState(0)
  const fileRef = useRef(null)

  // Lock body scroll while the "view all" overlay is open
  useEffect(() => {
    if (!showAll) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = e => { if (e.key === 'Escape') setShowAll(false) }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [showAll])

  // Photos added here (after the memorial exists) are NOT used to shape the
  // AI persona. The flag is silent to the user — they're just told to upload.
  async function handleUpload(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)
    setUploadError('')
    setFailedCount(0)
    let firstErr = ''
    let failures = 0
    for (const file of files) {
      try {
        const url = await uploadImage(file, setPct, 'memorials')
        await db.transact([
          db.tx.photos[id()].update({
            url,
            createdAt:          Date.now(),
            source:             'upload',
            usedForTraining:    false,
            addedAfterCreation: true,
          }).link({ memorial: memorialId })
        ])
      } catch (err) {
        console.error('[gallery upload]', file.name, err)
        failures += 1
        if (!firstErr) firstErr = err?.message || 'Upload failed'
      }
    }
    setUploading(false)
    setPct(0)
    if (failures > 0) {
      setFailedCount(failures)
      setUploadError(firstErr)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  // Always preview-mode now (the page has no Gallery tab anymore) — show 3
  // tiles + a "View all" overlay when there are more.
  const PREVIEW_COUNT = 3
  const shown    = photos.slice(0, PREVIEW_COUNT)
  const overflow = photos.length - shown.length

  // ── Borderless header used by every state ────────────────────────────
  // Gallery now sits directly on the page background (black) — no card
  // wrapper, no tile borders. Text uses the ink (cream-on-black) tones.
  const Header = () => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, flexWrap: 'wrap',
      padding: '0 4px 14px',
    }}>
      <Label onInk>Gallery</Label>
      <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.22em', textTransform: 'uppercase',
        color: 'rgba(241,236,225,.5)' }}>
        {photos.length} photo{photos.length !== 1 ? 's' : ''}
      </span>
    </div>
  )

  // Empty + guest → small inline tease so the section doesn't vanish
  if (photos.length === 0 && !isOwner) {
    return (
      <section style={{ padding: '12px 2px 4px' }}>
        <Header />
        <div style={{ padding: '32px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 10, color: 'rgba(241,236,225,.18)' }}>✿</div>
          <p style={{ fontFamily: DISP, color: 'rgba(241,236,225,.5)', fontSize: 13, margin: 0 }}>
            No photos in the gallery yet.
          </p>
        </div>
      </section>
    )
  }

  // Owner with no photos — friendly upload prompt, borderless
  if (photos.length === 0 && isOwner) {
    return (
      <section style={{ padding: '12px 2px 4px' }}>
        <Header />
        <div onClick={() => fileRef.current?.click()}
          style={{
            padding: '36px 0', borderRadius: 18, cursor: 'pointer',
            border: '2px dashed rgba(243,178,26,.35)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            background: 'rgba(243,178,26,.06)',
          }}>
          <span style={{ fontSize: 28, color: 'rgba(243,178,26,.75)' }}>✿</span>
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.18em',
            textTransform: 'uppercase', color: 'var(--theme, #f3b21a)', fontWeight: 700 }}>
            {uploading ? `Uploading ${pct}%` : 'Add photos to the gallery'}
          </span>
          <span style={{ fontSize: 11, color: 'rgba(241,236,225,.5)', textAlign: 'center', padding: '0 20px' }}>
            Add more memories any time. These appear here and don't change the reel.
          </span>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
      </section>
    )
  }

  return (
    <section style={{ padding: '12px 2px 4px' }}>
      <Header />

      {/* Owner upload chip — borderless dashed dropzone on the page bg */}
      {isOwner && (
        <div onClick={() => fileRef.current?.click()}
          style={{
            padding: '14px 0', borderRadius: 16, marginBottom: 12,
            border: '2px dashed rgba(243,178,26,.35)',
            background: 'rgba(243,178,26,.06)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer',
          }}>
          <span style={{ fontSize: 20, color: 'rgba(243,178,26,.75)' }}>✿</span>
          <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.18em',
            textTransform: 'uppercase', color: 'var(--theme, #f3b21a)', fontWeight: 700 }}>
            {uploading ? `Uploading ${pct}%` : 'Add photos'}
          </span>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />

      {uploadError && (
        <div style={{
          padding: 12, marginBottom: 12, borderRadius: 12,
          background: 'rgba(255,107,107,0.10)', border: '1px solid rgba(255,107,107,0.30)',
        }}>
          <p style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: C.rust, margin: 0 }}>
            {failedCount === 1 ? '1 photo failed to upload' : `${failedCount} photos failed`}
          </p>
          <p style={{ fontSize: 10.5, color: 'rgba(255,107,107,0.80)', marginTop: 4, lineHeight: 1.5 }}>{uploadError}</p>
        </div>
      )}

      {/* Photos sit directly on the page bg — no individual borders,
          slightly more space between tiles so they read as discrete
          objects, not a panel. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}
        className="gallery-grid">
        {shown.map((photo, i) => (
          <motion.div key={photo.id || i} whileHover={{ scale: .98 }}
            onClick={() => setSelected(photo)}
            style={{
              position: 'relative', overflow: 'hidden', borderRadius: 16, cursor: 'pointer',
              aspectRatio: '1 / 1',
              background: 'transparent',
              boxShadow: '0 4px 14px -4px rgba(21,18,14,.18)',
            }}>
            <img src={photo.url} alt={photo.caption || ''}
              style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform .4s' }} />
            {photo.caption && (
              <span style={{ position: 'absolute', left: 8, top: 8, fontFamily: MONO, fontSize: 9,
                letterSpacing: '.14em', textTransform: 'uppercase', color: C.cream,
                background: 'rgba(21,18,14,.7)', padding: '2px 6px', borderRadius: 999, backdropFilter: 'blur(4px)' }}>
                {photo.caption}
              </span>
            )}
          </motion.div>
        ))}
      </div>

        {/* View-all CTA — opens an overlay with the whole gallery */}
        {overflow > 0 && (
          <button
            onClick={() => setShowAll(true)}
            style={{
              width: '100%', marginTop: 12,
              padding: '11px 0', borderRadius: 14,
              background: 'rgba(243,178,26,.10)',
              border: '1px solid rgba(243,178,26,.25)',
              color: 'var(--theme, #f3b21a)', cursor: 'pointer',
              fontFamily: MONO, fontSize: 10.5, letterSpacing: '.18em',
              textTransform: 'uppercase', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            View all {photos.length} photos
          </button>
        )}
      {/* keep 3-col preview on mobile so the 3-photo preview never orphans */}

      {/* ── View-all overlay — scrollable grid of every photo ─────────── */}
      <AnimatePresence>
        {showAll && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setShowAll(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 70,
              background: 'rgba(21,18,14,.92)',
              backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
              padding: 20, overflow: 'auto',
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 14 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: 1100,
                background: C.ink,
                borderRadius: 24,
                border: '1px solid rgba(241,236,225,.10)',
                boxShadow: '0 30px 80px rgba(0,0,0,.55)',
                overflow: 'hidden',
                margin: 'auto',
              }}
            >
              <div style={{
                padding: '18px 24px',
                borderBottom: '1px solid rgba(241,236,225,.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                position: 'sticky', top: 0, zIndex: 2, background: C.ink,
              }}>
                <div>
                  <Label onInk>Gallery · all photos</Label>
                  <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.22em',
                    textTransform: 'uppercase', color: 'rgba(241,236,225,.5)', marginTop: 4 }}>
                    {photos.length} photo{photos.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <button onClick={() => setShowAll(false)} aria-label="Close"
                  style={{
                    width: 36, height: 36, borderRadius: 999,
                    background: 'rgba(241,236,225,.10)', color: C.cream,
                    border: '1px solid rgba(241,236,225,.15)',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div style={{
                padding: 20,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 10,
              }}>
                {photos.map((photo, i) => (
                  <div key={photo.id || i}
                    onClick={() => setSelected(photo)}
                    style={{
                      position: 'relative', overflow: 'hidden',
                      borderRadius: 14, cursor: 'pointer', aspectRatio: '1 / 1',
                      background: 'rgba(241,236,225,.04)',
                      border: '1px solid rgba(241,236,225,.08)',
                    }}>
                    <img loading="lazy" decoding="async" src={photo.url} alt={photo.caption || ''}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {photo.caption && (
                      <span style={{ position: 'absolute', left: 8, top: 8, fontFamily: MONO, fontSize: 9,
                        letterSpacing: '.14em', textTransform: 'uppercase', color: C.cream,
                        background: 'rgba(21,18,14,.7)', padding: '2px 6px', borderRadius: 999, backdropFilter: 'blur(4px)' }}>
                        {photo.caption}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(21,18,14,.95)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <motion.img initial={{ scale: .9 }} animate={{ scale: 1 }} exit={{ scale: .9 }}
              src={selected.url} alt="" onClick={e => e.stopPropagation()}
              style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 20, objectFit: 'contain' }} />
            <button onClick={() => setSelected(null)}
              style={{ position: 'absolute', top: 24, right: 24, width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(241,236,225,.1)', border: '1px solid rgba(241,236,225,.15)',
                color: C.cream, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>✕</button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

// ─── Tribute form modal ───────────────────────────────────────────────────────
function TributeFormModal({ onClose, onSubmit, submitting }) {
  const [text,       setText]       = useState('')
  const [photoFile,  setPhotoFile]  = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [uploading,  setUploading]  = useState(false)
  const [photoError, setPhotoError] = useState('')
  const textRef  = useRef(null)
  const photoRef = useRef(null)

  useEffect(() => { setTimeout(() => textRef.current?.focus(), 80) }, [])

  async function handlePhotoSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setPhotoError('')
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  function removePhoto() {
    setPhotoFile(null)
    setPhotoPreview(null)
    setPhotoError('')
    if (photoRef.current) photoRef.current.value = ''
  }

  async function handleSubmit() {
    if (!text.trim() || submitting) return
    let photoUrl = null
    if (photoFile) {
      setUploading(true)
      setPhotoError('')
      try {
        photoUrl = await uploadImage(photoFile, () => {}, 'tributes')
      } catch (err) {
        console.error('[tribute photo]', err)
        setPhotoError(err?.message || 'Could not upload photo. Post without it?')
        setUploading(false)
        return  // don't post the tribute if photo failed — let user decide
      }
      setUploading(false)
    }
    onSubmit(text, 'tribute', photoUrl)
  }

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(21,18,14,.6)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
          style={{ width: '100%', maxWidth: 520, background: C.paper, borderRadius: '26px 26px 0 0',
            padding: '24px 24px 36px', border: '1px solid rgba(21,18,14,.10)' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontFamily: DISP, fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', color: C.ink, margin: 0 }}>Leave a tribute</h3>
              <p style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: C.muted2, marginTop: 4 }}>Share a memory or kind words</p>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: C.cream2,
              border: '1px solid rgba(21,18,14,.10)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.muted, fontSize: 14 }}>✕</button>
          </div>

          <textarea ref={textRef} value={text} onChange={e => setText(e.target.value)}
            placeholder="Write your tribute — a favourite memory, a few words of love, something that captures who they were…"
            style={{ width: '100%', background: C.cream, border: '1px solid rgba(21,18,14,.12)',
              borderRadius: 16, padding: '14px 16px', fontFamily: DISP, fontSize: 14,
              color: C.ink, resize: 'none', height: 120, outline: 'none', lineHeight: 1.6,
              boxSizing: 'border-box' }} />

          {/* Photo attachment */}
          {photoPreview ? (
            <div style={{ marginTop: 12, position: 'relative', borderRadius: 14, overflow: 'hidden', maxHeight: 180 }}>
              <img src={photoPreview} alt="" style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
              <button onClick={removePhoto}
                style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%',
                  background: 'rgba(21,18,14,.7)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13 }}>✕</button>
            </div>
          ) : (
            <button onClick={() => photoRef.current?.click()}
              style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none',
                cursor: 'pointer', fontFamily: MONO, fontSize: 10, letterSpacing: '.16em',
                textTransform: 'uppercase', color: C.muted, padding: '4px 0' }}>
              <span style={{ fontSize: 16 }}>📷</span> Add a photo
            </button>
          )}
          <input ref={photoRef} type="file" accept="image/*" className="hidden" style={{ display: 'none' }} onChange={handlePhotoSelect} />

          {photoError && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 12,
              background: 'rgba(255,107,107,0.10)', border: '1px solid rgba(255,107,107,0.30)' }}>
              <p style={{ fontSize: 11.5, color: C.rust, margin: 0, fontWeight: 600 }}>{photoError}</p>
              <button
                onClick={() => { setPhotoFile(null); setPhotoPreview(null); setPhotoError(''); if (photoRef.current) photoRef.current.value = '' }}
                style={{ marginTop: 6, background: 'none', border: 'none', color: C.rust,
                  fontFamily: MONO, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase',
                  fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                Post without photo
              </button>
            </div>
          )}

          <button onClick={handleSubmit} disabled={!text.trim() || submitting || uploading}
            style={{ width: '100%', marginTop: 16, padding: '16px 0', borderRadius: 999, border: 'none',
              cursor: text.trim() && !submitting && !uploading ? 'pointer' : 'default', fontFamily: MONO, fontSize: 11,
              letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 700, transition: 'all .2s',
              background: text.trim() ? 'var(--theme, #f3b21a)' : C.cream2, color: text.trim() ? C.ink : C.muted2,
              boxShadow: text.trim() ? '0 4px 14px rgba(243,178,26,.25)' : 'none' }}>
            {uploading ? 'Uploading photo…' : submitting ? 'Submitting…' : '♡  Post Tribute'}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Tribute comments (family members only) ───────────────────────────────────
function TributeComments({ tributeId, memorialId, user, userProfile, isFamilyMember }) {
  const [text,    setText]    = useState('')
  const [sending, setSending] = useState(false)
  const [open,    setOpen]    = useState(false)

  const { data } = db.useQuery({
    tributeComments: { $: { where: { tributeId }, order: { serverCreatedAt: 'asc' } } },
  })
  const comments = data?.tributeComments || []

  async function handleComment() {
    if (!text.trim() || sending || !user) return
    setSending(true)
    try {
      const displayName = userProfile?.displayName || user.email?.split('@')[0] || 'Family member'
      await db.transact([
        db.tx.tributeComments[id()].update({
          tributeId,
          memorialId,
          authorId:    user.id,
          authorName:  displayName,
          authorPhoto: userProfile?.photoUrl || null,
          content:     text.trim(),
          createdAt:   Date.now(),
        }),
      ])
      setText('')
    } finally { setSending(false) }
  }

  if (comments.length === 0 && !isFamilyMember) return null

  return (
    <div style={{ borderTop: '1px solid rgba(21,18,14,.07)', paddingTop: 10, marginTop: 4 }}>
      {/* Toggle comments */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          fontFamily: MONO, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase',
          color: C.muted2, display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <span style={{ fontSize: 13 }}>💬</span>
        {comments.length > 0 ? `${comments.length} comment${comments.length !== 1 ? 's' : ''}` : 'Add a comment'}
        {comments.length > 0 && <span>{open ? ' ▲' : ' ▼'}</span>}
      </button>

      <AnimatePresence>
        {(open || comments.length === 0) && isFamilyMember && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden' }}>
            {/* Existing comments */}
            {comments.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  background: `linear-gradient(135deg, ${'var(--theme, #f3b21a)'}25, #38bdf820)`,
                  border: '1px solid rgba(21,18,14,.08)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontFamily: MONO, fontSize: 9, fontWeight: 700, color: C.muted,
                  overflow: 'hidden' }}>
                  {c.authorPhoto
                    ? <img src={c.authorPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (c.authorName?.[0] || '?').toUpperCase()}
                </div>
                <div style={{ flex: 1, background: C.cream, borderRadius: '12px 12px 12px 4px',
                  padding: '8px 12px', border: '1px solid rgba(21,18,14,.07)' }}>
                  <span style={{ fontFamily: DISP, fontSize: 12, fontWeight: 600, color: C.ink }}>{c.authorName} </span>
                  <span style={{ fontFamily: DISP, fontSize: 12, color: C.ink2, lineHeight: 1.5 }}>{c.content}</span>
                  <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.1em', color: C.muted2, marginTop: 3 }}>
                    {timeAgo(c.createdAt)}
                  </div>
                </div>
              </div>
            ))}

            {/* Compose */}
            {user && isFamilyMember && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  background: `linear-gradient(135deg, ${'var(--theme, #f3b21a)'}25, #38bdf820)`,
                  border: '1px solid rgba(21,18,14,.08)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontFamily: MONO, fontSize: 9, fontWeight: 700, color: C.muted,
                  overflow: 'hidden' }}>
                  {userProfile?.photoUrl
                    ? <img src={userProfile.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (userProfile?.displayName?.[0] || user.email?.[0] || '?').toUpperCase()}
                </div>
                <input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleComment() }}
                  placeholder="Write a comment…"
                  style={{ flex: 1, background: C.cream, border: '1px solid rgba(21,18,14,.10)',
                    borderRadius: 999, padding: '7px 14px', fontFamily: DISP, fontSize: 12,
                    color: C.ink, outline: 'none' }}
                />
                <button onClick={handleComment} disabled={!text.trim() || sending}
                  style={{ width: 28, height: 28, borderRadius: '50%', border: 'none',
                    background: text.trim() ? 'var(--theme, #f3b21a)' : C.cream2, cursor: text.trim() ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2.5" strokeLinecap="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function TabBar({ tabs, active, onChange }) {
  return (
    <div className="memorial-tabbar"
      style={{
        display: 'flex', padding: 6, borderRadius: 18,
        background: C.paper, border: '1px solid rgba(21,18,14,.10)',
        marginBottom: 20, gap: 0,
        maxWidth: '100%', overflowX: 'auto',
        scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
      }}>
      {tabs.map(({ key, label, count }) => {
        const isActive = active === key
        return (
          <button key={key} onClick={() => onChange(key)}
            style={{
              flexShrink: 0,
              border: 'none', cursor: 'pointer', fontFamily: DISP, fontWeight: 600,
              fontSize: 13.5, padding: '10px 16px', borderRadius: 12,
              background: isActive ? C.ink : 'transparent',
              color: isActive ? 'var(--theme, #f3b21a)' : C.ink2, letterSpacing: '.01em', transition: 'all .15s',
              boxShadow: isActive ? '0 4px 14px rgba(21,18,14,.2)' : 'none',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              whiteSpace: 'nowrap',
            }}>
            {label}
            <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.06em',
              background: isActive ? 'var(--theme, #f3b21a)' : 'rgba(21,18,14,.08)',
              color: isActive ? C.ink : C.muted,
              padding: '2px 7px', borderRadius: 999 }}>
              {String(count).padStart(2, '0')}
            </span>
          </button>
        )
      })}
      <style>{`.memorial-tabbar::-webkit-scrollbar { display: none; }`}</style>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function LoadingSkeleton() {
  const pulse = { background: 'rgba(241,236,225,.06)', animation: 'pulse 1.5s ease-in-out infinite', borderRadius: 26 }
  return (
    <div style={{ background: '#0a0805', minHeight: '100vh' }}>
      <div style={{ margin: '1rem 1rem 0', borderRadius: 26, height: '64vh', minHeight: 480, ...pulse }} />
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '1.5rem 1rem 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 24 }} className="skeleton-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ height: 320, ...pulse }} />
            <div style={{ height: 120, ...pulse }} />
            <div style={{ height: 200, ...pulse }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ height: 480, ...pulse }} />
            <div style={{ height: 320, ...pulse }} />
            <div style={{ height: 300, ...pulse }} />
          </div>
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:.7} 50%{opacity:1} }
        @media (max-width: 1024px) { .skeleton-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}

// ─── Memorial Family Circle ─────────────────────────────────────────────────
// Full-viewport orbital canvas centred on this memorial.
// Approved family connections orbit around. Click any orbiter → re-centres.
// Memorial owners can:
//   • View invite code + QR
//   • Approve/reject pending connection requests (vetting the relation)
//   • Remove approved members
// Family members can view the circle.
function MemorialFamilyCircle({ memorial, memorialId, user, isOwner, onClose }) {
  const { toast } = useToast()
  const [centeredId,   setCenteredId]   = useState(null)   // null → memorial is centre
  const [selected,     setSelected]     = useState(null)
  const [recenterTick, setRecenterTick] = useState(0)
  const [showInvite,   setShowInvite]   = useState(false)
  const [showPending,  setShowPending]  = useState(false)

  // All connections for this memorial — approved + pending
  const { data } = db.useQuery(memorialId ? {
    familyConnections: { $: { where: { toMemorialId: memorialId } } },
  } : null)

  const allConns      = data?.familyConnections || []
  const approvedConns = allConns.filter(c => c.status === 'approved')
  const pendingConns  = allConns.filter(c => c.status === 'pending')

  // Memorial-as-centre object
  const memorialCenter = useMemo(() => ({
    id:        'MEMORIAL',
    name:      memorial?.name || 'Memorial',
    photo:     memorial?.photo || memorial?.coverPhoto || null,
    alive:     memorial?.alive,
    isMemorial: true,
  }), [memorial])

  // Convert approved connections → orbiter format
  const memberOrbiters = useMemo(() => approvedConns.map(c => ({
    id:       c.id,
    name:     c.fromName || 'Family',
    photo:    c.fromPhoto || null,
    relation: getRelationLabel(c.relation) || c.relation,
    alive:    true,
    ring:     1,
    fromUserId: c.fromUserId,
    fromEmail:  c.fromEmail,
    rawRelation: c.relation,
  })), [approvedConns])

  // Centre + orbiters depending on selection
  const centered = centeredId
    ? memberOrbiters.find(m => m.id === centeredId) || memorialCenter
    : memorialCenter

  const orbiters = centeredId
    ? [
        { ...memorialCenter, id: 'MEMORIAL', relation: '✦ Memorial', ring: 1 },
        ...memberOrbiters.filter(m => m.id !== centeredId),
      ]
    : memberOrbiters

  function handleSelect(member) {
    if (member.id === 'MEMORIAL') { setCenteredId(null); setSelected(null); setRecenterTick(t => t + 1); return }
    setSelected(member)
    setCenteredId(member.id)
    setRecenterTick(t => t + 1)
  }

  async function handleRemove(connId) {
    if (!confirm('Remove this family member from the circle?')) return
    try {
      await db.transact([db.tx.familyConnections[connId].update({ status: 'rejected' })])
      setSelected(null)
    } catch { toast.error('Could not remove. Try again.') }
  }

  async function handleApprovePending(conn) {
    try {
      await db.transact([db.tx.familyConnections[conn.id].update({
        status: 'approved',
        approvedAt: Date.now(),
      })])
    } catch { toast.error('Could not approve. Try again.') }
  }

  async function handleRejectPending(conn) {
    try {
      await db.transact([db.tx.familyConnections[conn.id].update({
        status: 'rejected',
      })])
    } catch { toast.error('Could not reject. Try again.') }
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:80, background:'#06060a' }}>
      {/* Orbital canvas */}
      <Suspense fallback={null}>
        <FamilyTreeOrb
          center={centered}
          members={orbiters}
          onSelectMember={handleSelect}
          onCenterClick={() => {
            if (centeredId) {
              const m = memberOrbiters.find(x => x.id === centeredId)
              if (m) setSelected(m)
            }
          }}
          panResetSignal={recenterTick}
        />
      </Suspense>

      {/* Right-rail side panel (mobile → bottom pill) */}
      <Suspense fallback={null}>
        <FamilyTreeSidePanel
          scope="memorial"
          centerLabel={centered?.name || memorial?.name || 'Memorial'}
          subtitle={memorial?.years || (memorial?.birthYear ? `Born ${memorial.birthYear}` : '')}
          selected={selected}
          members={memberOrbiters}
          pendingCount={pendingConns.length}
          isOwner={isOwner}
          onInvite={() => setShowInvite(true)}
          onOpenPending={() => setShowPending(true)}
        />
      </Suspense>

      {/* Top bar */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, zIndex:20,
        paddingTop:'max(20px, env(safe-area-inset-top))',
        paddingLeft:16, paddingRight:16, paddingBottom:8,
        background:'linear-gradient(to bottom, rgba(5,5,10,0.70) 0%, transparent 100%)',
        display:'flex', alignItems:'center', justifyContent:'space-between', gap:8,
        pointerEvents:'none',
      }}>
        <button onClick={onClose}
          style={{
            pointerEvents:'auto',
            background:'rgba(10,10,15,0.85)', backdropFilter:'blur(20px)',
            border:'1px solid rgba(255,255,255,0.10)',
            borderRadius:999, padding:'8px 14px',
            color:'rgba(255,255,255,0.7)', cursor:'pointer',
            fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:600,
            display:'flex', alignItems:'center', gap:6,
          }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          Back
        </button>

        <div style={{ pointerEvents:'auto', display:'flex', gap:8 }}>
          {/* Pending requests pill (owner only) */}
          {isOwner && pendingConns.length > 0 && (
            <button onClick={() => setShowPending(true)}
              style={{
                background:'rgba(243,178,26,0.18)', backdropFilter:'blur(20px)',
                border:'1px solid rgba(243,178,26,0.40)',
                borderRadius:999, padding:'8px 14px',
                color:'#FFD700', cursor:'pointer',
                fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:700,
                display:'flex', alignItems:'center', gap:6,
              }}>
              <span style={{ display:'inline-flex', width:18, height:18, borderRadius:999,
                background:'rgba(243,178,26,0.30)', alignItems:'center', justifyContent:'center', fontSize:10 }}>
                {pendingConns.length}
              </span>
              {pendingConns.length === 1 ? 'request' : 'requests'}
            </button>
          )}

          {isOwner && (
            <button onClick={() => setShowInvite(true)}
              style={{
                background:'linear-gradient(135deg,#FFD700,#38BDF8)',
                border:'none', borderRadius:999, padding:'9px 18px',
                color:'#0a0a12', cursor:'pointer',
                fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:700, letterSpacing:'.06em',
              }}>
              + Invite
            </button>
          )}
        </div>
      </div>

      {/* Bottom info — stats + memorial title */}
      <div style={{
        position:'absolute', bottom:24, left:'50%', transform:'translateX(-50%)',
        zIndex:10, pointerEvents:'none', textAlign:'center', maxWidth:'92vw',
      }}>
        <p style={{
          fontFamily:MONO, fontSize:9.5, letterSpacing:'.30em', textTransform:'uppercase',
          color:'rgba(255,215,0,0.60)', margin:0,
        }}>
          ◉ Family Circle of {memorial?.name?.split(' ')[0]}
        </p>
        <p style={{
          fontFamily:"'Inter',sans-serif", fontSize:10,
          color:'rgba(255,255,255,0.40)', margin:'4px 0 0',
        }}>
          {memberOrbiters.length === 0
            ? 'No family members yet — share the invite code to grow the circle.'
            : `${memberOrbiters.length} approved · drag to pan · tap any node to re-centre`}
        </p>
      </div>

      {/* Selected member HUD */}
      <AnimatePresence>
        {selected && (
          <motion.div
            key={selected.id}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            style={{
              position:'absolute', left:'50%', transform:'translateX(-50%)',
              bottom: 'calc(76px + env(safe-area-inset-bottom))',
              zIndex: 30,
              background:'rgba(10,10,15,0.92)', backdropFilter:'blur(24px)',
              border:'1px solid rgba(255,215,0,0.25)',
              borderRadius: 22, padding:'14px 18px',
              minWidth: 260, maxWidth:'92vw',
              boxShadow:'0 12px 40px rgba(0,0,0,0.5)',
            }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{
                width:48, height:48, borderRadius:'50%', flexShrink:0,
                background:'linear-gradient(135deg,rgba(255,215,0,.20),rgba(56,189,248,.16))',
                border:'1.5px solid rgba(255,215,0,0.35)',
                overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:"'Cormorant Garamond',serif", fontWeight:700, fontSize:18, color:'#FFD700',
              }}>
                {selected.photo
                  ? <img src={selected.photo} alt={selected.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : (selected.name?.[0] || '?').toUpperCase()
                }
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontFamily:DISP, fontWeight:700, fontSize:15, color:'#fff', margin:0, lineHeight:1.2 }}>
                  {selected.name}
                </p>
                <p style={{ fontFamily:MONO, fontSize:9.5, letterSpacing:'.12em', textTransform:'uppercase',
                  color:'rgba(255,215,0,.75)', margin:'4px 0 0' }}>
                  {selected.relation || 'family'}
                </p>
              </div>
              <button onClick={() => setSelected(null)}
                style={{ background:'none', border:'none', color:'rgba(255,255,255,.4)',
                  cursor:'pointer', fontSize:18, padding:4 }}>✕</button>
            </div>
            {isOwner && selected.id !== 'MEMORIAL' && (
              <button onClick={() => handleRemove(selected.id)}
                style={{
                  marginTop: 12, width:'100%', padding:'8px 0',
                  background:'rgba(200,83,31,.10)', border:'1px solid rgba(200,83,31,.30)',
                  color:'#e07b5a', borderRadius:12, cursor:'pointer',
                  fontFamily:MONO, fontSize:10, letterSpacing:'.16em', textTransform:'uppercase',
                }}>
                Remove from circle
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending requests modal */}
      <AnimatePresence>
        {showPending && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowPending(false)}
              style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:90, backdropFilter:'blur(8px)' }}
            />
            <motion.div
              initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
              transition={{ type:'spring', damping:30, stiffness:300 }}
              style={{
                position:'fixed', bottom:0, left:0, right:0, zIndex:100,
                background:'#0d0d12', borderTopLeftRadius:24, borderTopRightRadius:24,
                padding:'16px 18px 30px', maxWidth:560, margin:'0 auto',
                borderTop:'1px solid rgba(255,215,0,0.20)',
                maxHeight:'80vh', overflowY:'auto',
              }}>
              <div style={{ width:40, height:4, background:'rgba(255,255,255,.18)', borderRadius:2, margin:'0 auto 14px' }} />
              <h3 style={{ fontFamily:DISP, fontWeight:700, fontSize:18, color:'#fff', margin:'0 0 4px' }}>
                Pending connection requests
              </h3>
              <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:'rgba(255,255,255,.5)', margin:'0 0 18px', lineHeight:1.5 }}>
                Review who claims to be related to {memorial?.name?.split(' ')[0]}. Approve to add them to the circle, or change the relation if it's wrong.
              </p>

              {pendingConns.length === 0 ? (
                <p style={{ textAlign:'center', padding:30, color:'rgba(255,255,255,.4)', fontSize:13 }}>
                  No pending requests.
                </p>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {pendingConns.map(c => (
                    <div key={c.id}
                      style={{
                        background:'rgba(255,255,255,.04)',
                        border:'1px solid rgba(255,255,255,.08)',
                        borderRadius:16, padding:'14px 16px',
                      }}>
                      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                        <div style={{
                          width:44, height:44, borderRadius:'50%', flexShrink:0,
                          background:'linear-gradient(135deg,rgba(255,215,0,.15),rgba(56,189,248,.10))',
                          border:'1px solid rgba(255,255,255,.10)',
                          overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center',
                          fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:15, color:'rgba(255,255,255,.5)',
                        }}>
                          {c.fromPhoto
                            ? <img src={c.fromPhoto} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                            : (c.fromName?.[0] || '?').toUpperCase()
                          }
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ fontFamily:DISP, fontWeight:600, fontSize:14, color:'#fff', margin:0 }}>
                            {c.fromName || 'Anonymous'}
                          </p>
                          {c.fromEmail && (
                            <p style={{ fontSize:11, color:'rgba(255,255,255,.4)', margin:'2px 0 0' }}>
                              {c.fromEmail}
                            </p>
                          )}
                          <p style={{ fontFamily:MONO, fontSize:9.5, letterSpacing:'.16em', textTransform:'uppercase',
                            color:'#FFD700', margin:'4px 0 0' }}>
                            claims: {getRelationLabel(c.relation) || c.relation}
                          </p>
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:8 }}>
                        <button onClick={() => handleRejectPending(c)}
                          style={{ flex:1, padding:'10px 0', borderRadius:12,
                            border:'1px solid rgba(200,83,31,.30)', background:'rgba(200,83,31,.10)',
                            color:'#e07b5a', cursor:'pointer',
                            fontFamily:MONO, fontSize:10, letterSpacing:'.14em', textTransform:'uppercase' }}>
                          Reject
                        </button>
                        <button onClick={() => handleApprovePending(c)}
                          style={{ flex:2, padding:'10px 0', borderRadius:12,
                            border:'none', background:'linear-gradient(90deg,#FFD700,#38BDF8)',
                            color:'#0a0a12', cursor:'pointer',
                            fontFamily:MONO, fontSize:10, letterSpacing:'.14em', textTransform:'uppercase', fontWeight:700 }}>
                          ✓ Approve to circle
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Invite modal (memorial-scoped) */}
      <AnimatePresence>
        {showInvite && (
          <Suspense fallback={null}>
            <InviteModal user={user} memorial={memorial} onClose={() => setShowInvite(false)} />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  )
}

// Helper for memorial family circle — locally imported here
function getRelationLabel(value) {
  if (!value) return ''
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ─── Persona profile callout ──────────────────────────────────────────────────
// Shown to owners only, just below the Voice section. Surfaces the memory
// profile flow — the questionnaire that trains the AI conversation.
function PersonaProfileCallout({ memorial, memorialId }) {
  const { data } = db.useQuery(memorialId ? {
    personaProfiles: { $: { where: { memorialId } } },
  } : null)
  const profile  = data?.personaProfiles?.[0]
  const chapters = Array.isArray(profile?.completedChapters) ? profile.completedChapters.length : 0
  const total    = 6
  const pct      = Math.round((chapters / total) * 100)
  const firstName = memorial?.name?.split(' ')[0] || 'them'
  const isSelf   = memorial?.isSelf === true

  return (
    <Link to={`/memorial/${memorialId}/persona`}
      style={{
        display: 'block', textDecoration: 'none',
        background: 'linear-gradient(135deg, rgba(243,178,26,0.10), rgba(56,189,248,0.06))',
        border: '1px solid rgba(243,178,26,0.28)',
        borderRadius: 22,
        padding: '18px 22px',
        position: 'relative',
        overflow: 'hidden',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14, flexShrink: 0,
          background: 'linear-gradient(135deg, #FFD700, #38BDF8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, color: '#0a0a12', fontWeight: 800,
          boxShadow: '0 6px 18px rgba(243,178,26,.30)',
        }}>
          ◆
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <p style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.22em', textTransform: 'uppercase',
            color: 'var(--theme, #f3b21a)', margin: 0 }}>
            Memory profile · {chapters}/{total} chapters
          </p>
          <h3 style={{ fontFamily: DISP, fontWeight: 700, fontSize: 18, color: C.cream,
            margin: '4px 0 4px', letterSpacing: '-.01em' }}>
            {chapters === 0
              ? (isSelf ? 'Build the memory that will speak as you' : `Build the memory that speaks as ${firstName}`)
              : pct === 100
                ? `${firstName}'s memory is ready`
                : `${pct}% — keep going`}
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(241,236,225,.55)', lineHeight: 1.5 }}>
            {chapters === 0
              ? `Answer a guided interview about ${isSelf ? 'yourself' : firstName} — life chapters, personality, stories, beliefs. Everything you write shapes "Hear ${isSelf ? 'you' : 'them'} speak".`
              : `Add more detail or revisit any chapter — every paragraph makes the conversation richer.`}
          </p>
        </div>
        <div style={{
          padding: '9px 16px', borderRadius: 999,
          background: 'var(--theme, #f3b21a)', color: C.ink,
          fontFamily: MONO, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase',
          fontWeight: 800, flexShrink: 0,
          boxShadow: '0 4px 14px rgba(243,178,26,.30)',
        }}>
          {chapters === 0 ? 'Start' : 'Continue'} →
        </div>
      </div>
      {/* Progress bar */}
      {chapters > 0 && (
        <div style={{ marginTop: 14, height: 3, borderRadius: 2,
          background: 'rgba(243,178,26,.10)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%',
            background: 'linear-gradient(90deg, #FFD700, #38BDF8)',
            transition: 'width 0.4s ease' }} />
        </div>
      )}
    </Link>
  )
}

// ─── Main inner component ─────────────────────────────────────────────────────
function MemorialDetailPageInner() {
  const { id: memorialId } = useParams()
  const navigate = useNavigate()

  // ── All hooks before any early return ──────────────────────────────────────
  const [activeTab,       setActiveTab]       = useState('Story')
  const [showTributeForm, setShowTributeForm] = useState(false)
  const [submitting,      setSubmitting]      = useState(false)
  const [shareToast,      setShareToast]      = useState(false)
  const [showQR,          setShowQR]          = useState(false)
  const [showTalkScreen,  setShowTalkScreen]  = useState(false)
  const [showReelFull,    setShowReelFull]    = useState(false)
  const [showFamilyCircle, setShowFamilyCircle] = useState(false)

  const { user }  = db.useAuth()
  const { toast } = useToast()

  const { isLoading, error, data } = db.useQuery(
    memorialId ? { memorials: { $: { where: { id: memorialId } }, tributes: {}, photos: {} } } : null
  )
  const vaultQ = db.useQuery(
    memorialId ? { memorials: { $: { where: { id: memorialId } }, letters: {}, documents: {} } } : null
  )

  // Check if current user is an approved family member for this memorial
  const familyConnQ = db.useQuery(
    (user && memorialId) ? {
      familyConnections: {
        $: { where: { fromUserId: user.id, toMemorialId: memorialId, status: 'approved' } },
      },
    } : null
  )
  const isFamilyMember = !!(familyConnQ?.data?.familyConnections?.length)

  // All approved family connections for this memorial — preview row faces + count
  const allFamilyQ = db.useQuery(
    memorialId ? {
      familyConnections: {
        $: { where: { toMemorialId: memorialId, status: 'approved' } },
      },
    } : null
  )
  const approvedFamilyForMemorial = allFamilyQ?.data?.familyConnections || []

  // Pending requests for this memorial — for owner's attention badge
  const pendingFamilyQ = db.useQuery(
    (user && memorialId) ? {
      familyConnections: {
        $: { where: { toMemorialId: memorialId, status: 'pending' } },
      },
    } : null
  )
  const pendingFamilyCount = pendingFamilyQ?.data?.familyConnections?.length || 0

  // Load current user profile for messages + comments (display name, photo)
  const profileQ = db.useQuery(
    user ? { profiles: { $: { where: { userId: user.id } } } } : null
  )
  const userProfile = profileQ?.data?.profiles?.[0] || null

  const memorial      = data?.memorials?.[0]
  const vaultMemorial = vaultQ?.data?.memorials?.[0]

  const tributes = useMemo(
    () => [...(memorial?.tributes || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [memorial]
  )

  // ── Auto-reanalyse photos for the AI persona ──────────────────────────────
  // Fires when either:
  //   • 10+ photos have been added since the last vision analysis, OR
  //   • 30+ days have passed since the last vision analysis (and there are photos)
  // Only owners can trigger (avoids every visitor pinging the API). The ref
  // guards against re-firing within the same session.
  const reanalyseFiredRef = useRef(false)
  useEffect(() => {
    if (!memorial || !user) return
    if (memorial.creatorId !== user.id) return                   // owner only
    if (reanalyseFiredRef.current) return                        // once per session
    const photos = memorial.photos || []
    if (photos.length === 0) return

    const lastCount  = memorial.photoContextPhotoCount || 0
    const lastAt     = memorial.photoContextAt || 0
    const newPhotos  = photos.length - lastCount
    const ageMs      = Date.now() - lastAt
    const MONTH_MS   = 30 * 24 * 60 * 60 * 1000
    const everRan    = lastAt > 0
    const hitCount   = newPhotos >= 10
    const hitTime    = everRan && ageMs > MONTH_MS

    if (!hitCount && !hitTime) return
    reanalyseFiredRef.current = true

    // Send the most-recent (or most-representative) photos. Cap to 8 server-side.
    const sorted    = [...photos].sort((a, b) => (b.takenAt || b.createdAt || 0) - (a.takenAt || a.createdAt || 0))
    const photoUrls = sorted.map(p => p.url).filter(Boolean).slice(0, 8)
    if (photoUrls.length === 0) return

    fetch('/api/analyze-photos', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        memorialId,
        name:            memorial.name,
        bio:             memorial.bio || '',
        isSelf:          !!memorial.isSelf,
        alive:           memorial.alive !== false,
        birthYear:       memorial.birthYear,
        deathYear:       memorial.deathYear,
        photoUrls,
        totalPhotoCount: photos.length,
      }),
    }).catch(err => console.warn('[reanalyse-photos] failed', err))
  }, [memorial, user, memorialId])

  // ── Reel image preloader ──────────────────────────────────────────────────
  // The Life Reel cycles through photos at a 3-second beat. If a photo isn't
  // in the browser cache when its slide starts, the user sees a flash of dark
  // background while the image decodes — turbulent and breaks the cinematic
  // feel. We warm the cache for every reel photo as soon as we have them,
  // before the user has even scrolled to the reel. Costs a few extra requests
  // on memorial load (which is acceptable per the team's "load longer so the
  // reel flows smoothly" preference) and earns a frame-perfect loop.
  const preloadedRef = useRef(new Set())
  useEffect(() => {
    const list = memorial?.photos || []
    if (list.length === 0) return
    // Limit to the first 12 photos (the reel caps somewhere around there
    // for budget reasons). Skip anything already warmed in this session.
    list.slice(0, 12).forEach(p => {
      if (!p?.url || preloadedRef.current.has(p.url)) return
      preloadedRef.current.add(p.url)
      const img = new Image()
      img.decoding = 'async'
      img.src = p.url
    })
  }, [memorial?.photos])

  // ── Background-task feedback: surface the talk-portrait status transitions ─
  // The user just created the memorial → navigation lands them here while
  // /api/generate-talk-portrait is still running. Without this, they'd see
  // nothing happening until the portrait silently appears (or doesn't). Toast
  // notifications close that loop so they always know what's in progress.
  // Owner-only — visitors don't need to see backend churn.
  const prevPortraitStatusRef = useRef(null)
  useEffect(() => {
    if (!memorial || !user) return
    if (memorial.creatorId !== user.id) return        // owner only
    const status = memorial.talkPortraitStatus
    const prev   = prevPortraitStatusRef.current

    // First render: just remember current state, don't toast retroactively
    if (prev === null) {
      prevPortraitStatusRef.current = status || 'none'
      // ...but if we land on the page with pending status, do let the user know
      if (status === 'pending') {
        toast.info('Building their portrait — takes ~15 seconds')
      }
      return
    }

    if (prev === status) return                       // no change

    if (status === 'generated') {
      toast.success('Portrait ready ✦')
    } else if (status === 'failed') {
      toast.error('Couldn\'t build the portrait. Try different face photos in Edit → Portrait.')
    } else if (status === 'pending' && prev !== 'pending') {
      toast.info('Building portrait…')
    }

    prevPortraitStatusRef.current = status || 'none'
  }, [memorial?.talkPortraitStatus, user, memorial?.creatorId, toast])

  // SEO — must be before early returns
  useSEO({
    title:       memorial ? `${memorial.name} — WHO WAS I` : 'WHO WAS I — Living Memorials',
    description: memorial?.subtitle || memorial?.bio?.slice(0, 155) || 'A living memorial on WHO WAS I.',
    image:       memorial ? `${window.location.origin}/memorial/${memorialId}/og` : 'https://whowasi.uk/logo.png',
    url:         memorial ? `${window.location.origin}/memorial/${memorialId}` : 'https://whowasi.uk',
  })

  // ── Early returns (after ALL hooks) ───────────────────────────────────────
  if (isLoading) return <LoadingSkeleton />

  if (error || !memorial) {
    return (
      <div style={{ minHeight: '100vh', background: C.paper, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 24, color: 'rgba(21,18,14,.12)' }}>✦</div>
          <p style={{ fontFamily: DISP, fontSize: 14, color: C.muted, marginBottom: 16 }}>This memorial could not be found.</p>
          <Link to="/explore" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--theme, #f3b21a)', textDecoration: 'underline' }}>
            Explore memorials
          </Link>
        </div>
      </div>
    )
  }

  // Privacy gate
  const visibility = memorial.visibility || 'public'
  const isCreator  = !!(user && memorial.creatorId === user.id)
  if ((visibility === 'private' || visibility === 'family') && !isCreator) {
    return (
      <div style={{ minHeight: '100vh', background: C.paper, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 340 }}>
          <div style={{ fontSize: 48, marginBottom: 24, color: 'rgba(21,18,14,.18)' }}>☽</div>
          <h1 style={{ fontFamily: DISP, fontSize: 26, fontWeight: 700, color: C.ink, marginBottom: 12 }}>This memorial is private</h1>
          <p style={{ fontFamily: DISP, fontSize: 14, color: C.muted, lineHeight: 1.6, marginBottom: 24 }}>
            {visibility === 'family' ? 'It is shared with family and people who have the invite link.' : 'It is visible only to the person who created it.'}
          </p>
          {!user && <Link to="/auth" style={{ display: 'inline-block', padding: '12px 24px', borderRadius: 999, background: 'var(--theme, #f3b21a)', color: C.ink, fontFamily: MONO, fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', textDecoration: 'none', marginBottom: 12 }}>Sign in</Link>}
          <div><Link to="/explore" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--theme, #f3b21a)', textDecoration: 'underline' }}>Back to explore</Link></div>
        </div>
      </div>
    )
  }

  // ── Derived values (after early returns — NO hooks below this line) ────────
  const photos       = memorial.photos || []
  const tributeCount = tributes.length
  const candleCount  = 0   // removed — kept as 0 for any legacy gauge/stats usage
  const memoryCount  = 0   // removed — kept as 0 for any legacy gauge/stats usage
  const isOwner      = !!(user && memorial.creatorId === user.id)
  const shareUrl     = `${window.location.origin}/memorial/${memorialId}`
  const letters      = vaultMemorial?.letters || memorial.letters || []
  const documents    = vaultMemorial?.documents || memorial.documents || []
  const sealedCount  = letters.filter(l => l.isLocked).length
  const hasWill      = documents.length > 0

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleSubmitTribute(text, type = 'tribute', photoUrl = null) {
    if (!text.trim() || submitting) return
    setSubmitting(true)
    try {
      await db.transact([
        db.tx.tributes[id()].update({
          content: text.trim(), text: text.trim(), type: 'tribute',
          author: user?.email?.split('@')[0] || 'Anonymous',
          authorName: user?.email?.split('@')[0] || 'Anonymous',
          authorId: user?.id || null, likes: 0, reactions: {},
          createdAt: Date.now(),
          ...(photoUrl ? { photoUrl } : {}),
        }).link({ memorial: memorialId }),
      ])
      setShowTributeForm(false)
      setActiveTab('Tributes')
      fetch('/api/tribute-notification', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memorialId, tributeText: text.trim(), tributeType: 'tribute', authorName: user?.email?.split('@')[0] || 'Anonymous' }),
      }).catch(() => {})
    } finally { setSubmitting(false) }
  }

  async function handleLikeTribute(tributeId, currentLikes) {
    try { await db.transact([db.tx.tributes[tributeId].update({ likes: (currentLikes || 0) + 1 })]) } catch {}
  }

  async function handleDeleteTribute(tributeId) {
    try { await db.transact([db.tx.tributes[tributeId].delete()]) } catch {}
  }

  function handleShare() {
    if (navigator.share) {
      navigator.share({ title: memorial.name, text: `${memorial.name} — A living memorial on WHO WAS I`, url: shareUrl }).catch(() => {})
    } else {
      navigator.clipboard.writeText(shareUrl).catch(() => {})
      setShareToast(true)
      setTimeout(() => setShareToast(false), 2500)
    }
  }

  const tabDefs = [
    { key: 'Story',    label: 'Story',    count: 1 },
    { key: 'Tributes', label: 'Tributes', count: tributeCount },
    { key: 'Gallery',  label: 'Gallery',  count: photos.length },
    // Family tab — only shown to owner or approved family members
    ...((isOwner || isFamilyMember) ? [{ key: 'Family', label: '✦ Family', count: 0 }] : []),
  ]

  // Theme color from memorial — drive CSS custom properties
  const themeHex     = memorial.themeHex || '#f3b21a'   // fallback to saffron
  const themeLight   = themeHex + '22'                  // ~13% opacity
  const themeMedium  = themeHex + '55'                  // ~33% opacity

  return (
    <div style={{
      // Deep warm-black canvas — slightly darker than C.ink (#15120e) so the
      // ink-variant cards on top still read as floating panels rather than
      // dissolving into the background. Cream rail cards on the left pop
      // like printed pages against this surface.
      background:   '#0a0805',
      minHeight:    '100vh',
      paddingTop:   'max(56px, calc(env(safe-area-inset-top) + 12px))',
      paddingBottom:'max(96px, calc(env(safe-area-inset-bottom) + 80px))',
      color:        C.cream,
      // Hardware-accelerated rendering hint so the long right column
      // doesn't repaint half the page on every scroll tick.
      transform: 'translateZ(0)',
      // GPU-friendly hint without overpromising browser optimisation budget.
      WebkitOverflowScrolling: 'touch',
      '--theme':    themeHex,
      '--theme-lt': themeLight,
      '--theme-md': themeMedium,
    }}>

      {/* ── Body grid (no more full-width hero — the profile portrait now
            lives at the top of the right column, with the static rail on
            the left holding everything else) ─────────────────────────── */}
      <div style={{
        maxWidth: 1400, margin: '0 auto', padding: '1.5rem 1rem 0',
        // Honour reduced-motion users + smoother default scrolling
        scrollBehavior: 'smooth',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '400px 1fr',
          gap: 24, alignItems: 'start',
          // Promote the whole grid to its own layer so the sticky rail
          // doesn't repaint the right column on each scroll tick.
          contain: 'layout',
        }}
          className="page-grid">

          {/* ── Left rail (sticky · static): age, tribute/share/QR, life
                record, vault, join family ──────────────────────────────── */}
          <aside style={{ position: 'sticky', top: '1rem', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <LifeGaugeCard memorial={memorial} tributeCount={tributeCount} candleCount={candleCount} memoryCount={memoryCount} />
            <ActionsCard onTribute={() => setShowTributeForm(true)} onShare={handleShare} onQR={() => setShowQR(true)} />
            <LifeRecordCard memorial={memorial} />
            <LegacyVaultCard memorialId={memorialId} letterCount={letters.length} sealedCount={sealedCount} hasWill={hasWill} />
            {/* Invite code badge — shown to owner so they can share it */}
            {isOwner && user && (
              <div style={{ background: C.ink, borderRadius: 20, padding: 16 }}>
                <InviteCodeBadge user={user} compact />
              </div>
            )}
            {/* "Join family circle" prompt — for non-owner logged-in users */}
            {!isOwner && user && (
              <Link to={`/join`}
                style={{
                  display:'flex', alignItems:'center', gap:12, padding:'14px 16px',
                  background: C.ink, borderRadius:20, textDecoration:'none',
                  border:`1px solid rgba(241,236,225,.06)`,
                }}>
                <span style={{ fontFamily:'serif', fontSize:20, color:'rgba(243,178,26,.7)' }}>✦</span>
                <div>
                  <p style={{ fontFamily:DISP, fontSize:13, fontWeight:600, color:C.cream, margin:0 }}>
                    Join the family circle
                  </p>
                  <p style={{ fontFamily:MONO, fontSize:10, letterSpacing:'.14em', textTransform:'uppercase',
                    color:'rgba(241,236,225,.35)', marginTop:3 }}>
                    Use an invite code
                  </p>
                </div>
              </Link>
            )}
          </aside>

          {/* ── Right column — single scroll feed, no tabs ────────────────
                Order: portrait → cinematic story → bio → voice+speak → photos
                Then tributes + family follow as continuation sections. */}
          <main style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: '4rem' }}>

            {/* 1. Compact profile portrait (replaces the old full-width hero) */}
            <ProfilePortrait memorial={memorial} memorialId={memorialId} isOwner={isOwner} navigate={navigate} />

            {/* 2. Cinematic story — the Life Reel */}
            <ReelViewport memorial={memorial} photos={photos} tributes={tributes} onExpand={() => setShowReelFull(true)} />

            {/* 3. Bio — story card with "Read full bio" modal */}
            <StoryCard memorial={memorial} />

            {/* 4. Voice + Speak to {name} — combined card */}
            <VoiceSection memorial={memorial} onOpenTalk={() => setShowTalkScreen(true)} />
            {isOwner && (
              <PersonaProfileCallout memorial={memorial} memorialId={memorialId} />
            )}

            {/* 5. Photos — full gallery */}
            {(photos.length > 0 || isOwner) && (
              <GallerySection photos={photos} memorialId={memorialId} isOwner={isOwner} />
            )}

            {/* Tributes follow photos as a continuation feed */}
            <TributesSection tributes={tributes} onLike={handleLikeTribute} onDelete={handleDeleteTribute}
              isOwner={isOwner} currentUserId={user?.id} memorialId={memorialId}
              user={user} userProfile={userProfile} isFamilyMember={isFamilyMember} />
            {tributes.length === 0 && (
              <div style={{ textAlign: 'center', marginTop: 4 }}>
                <button onClick={() => setShowTributeForm(true)}
                  style={{ padding: '12px 28px', borderRadius: 999, border: `1px solid ${'var(--theme, #f3b21a)'}`,
                    background: 'transparent', color: 'var(--theme, #f3b21a)', cursor: 'pointer',
                    fontFamily: MONO, fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase' }}>
                  Leave the first tribute
                </button>
              </div>
            )}

            {/* Family circle + private messages — owner / approved family only */}
            {(isOwner || isFamilyMember) && (
              <motion.div key="family" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                  {/* ── Family Circle preview ──────────────────────────────── */}
                  <Card variant="ink" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{
                      padding: '18px 24px 14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: 12, flexWrap: 'wrap',
                      borderBottom: '1px solid rgba(241,236,225,.06)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Label onInk>Family circle</Label>
                        <span style={{
                          fontFamily: MONO, fontSize: 9.5, letterSpacing: '.18em', textTransform: 'uppercase',
                          color: 'rgba(243,178,26,.85)',
                          background: 'rgba(243,178,26,.10)',
                          border: '1px solid rgba(243,178,26,.25)',
                          padding: '3px 8px', borderRadius: 999,
                        }}>
                          ◉ Infinite web
                        </span>
                      </div>

                      <button onClick={() => setShowFamilyCircle(true)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          background: 'rgba(243,178,26,.12)',
                          color: 'var(--theme, #f3b21a)',
                          border: '1px solid rgba(243,178,26,.30)',
                          borderRadius: 999, padding: '7px 14px',
                          cursor: 'pointer',
                          fontFamily: MONO, fontSize: 10, letterSpacing: '.18em',
                          textTransform: 'uppercase', fontWeight: 600,
                        }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                          <path d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"/>
                        </svg>
                        Open circle
                      </button>
                    </div>

                    <div style={{ padding: '14px 24px 20px' }}>
                      <h3 style={{
                        fontFamily: DISP, fontWeight: 700, fontSize: 22, letterSpacing: '-.02em',
                        lineHeight: 1.15, margin: 0, color: C.cream,
                      }}>
                        {approvedFamilyForMemorial.length === 0
                          ? <>An infinite web — <em style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300, color: 'var(--theme, #f3b21a)' }}>waiting for the first connection.</em></>
                          : <>An infinite web — <em style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300, color: 'var(--theme, #f3b21a)' }}>{approvedFamilyForMemorial.length} approved.</em></>
                        }
                      </h3>
                      <p style={{ color: 'rgba(241,236,225,.55)', fontSize: 13, lineHeight: 1.55, margin: '8px 0 14px' }}>
                        {memorial.name?.split(' ')[0]} sits at the centre. Family members orbit around them.
                        Tap any face to re-centre on that person — the web reorders to their world. Drag to pan freely.
                        Only approved family appear here; pending requests must be vetted before joining.
                      </p>

                      {/* Member face row preview */}
                      {approvedFamilyForMemorial.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                          {approvedFamilyForMemorial.slice(0, 8).map(c => (
                            <div key={c.id} style={{
                              width: 36, height: 36, borderRadius: '50%', overflow: 'hidden',
                              background: 'linear-gradient(135deg,rgba(255,215,0,.18),rgba(56,189,248,.12))',
                              border: '1.5px solid rgba(255,215,0,0.30)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 700, color: 'var(--theme, #f3b21a)',
                            }} title={`${c.fromName} · ${getRelationLabel(c.relation) || c.relation}`}>
                              {c.fromPhoto
                                ? <img src={c.fromPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : (c.fromName?.[0] || '?').toUpperCase()
                              }
                            </div>
                          ))}
                          {approvedFamilyForMemorial.length > 8 && (
                            <span style={{ fontSize: 11, color: 'rgba(241,236,225,.5)', marginLeft: 4 }}>
                              +{approvedFamilyForMemorial.length - 8} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Pending requests alert (owner only) */}
                      {isOwner && pendingFamilyCount > 0 && (
                        <button onClick={() => setShowFamilyCircle(true)}
                          style={{
                            width: '100%', marginBottom: 10,
                            background: 'rgba(243,178,26,.10)',
                            border: '1px solid rgba(243,178,26,.30)',
                            borderRadius: 14, padding: '10px 14px',
                            display: 'flex', alignItems: 'center', gap: 10,
                            cursor: 'pointer',
                          }}>
                          <span style={{
                            display: 'inline-flex', width: 24, height: 24, borderRadius: 12,
                            background: 'rgba(243,178,26,.25)', color: '#FFD700',
                            alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11,
                          }}>
                            {pendingFamilyCount}
                          </span>
                          <span style={{ flex: 1, textAlign: 'left',
                            fontFamily: DISP, fontSize: 13, fontWeight: 600, color: 'var(--theme, #f3b21a)' }}>
                            {pendingFamilyCount === 1 ? '1 person is awaiting your approval' : `${pendingFamilyCount} people awaiting approval`}
                          </span>
                          <span style={{ color: 'var(--theme, #f3b21a)', fontSize: 14 }}>→</span>
                        </button>
                      )}
                    </div>
                  </Card>

                  {/* ── Invite code (owner only) ────────────────────────────── */}
                  {isOwner && (
                    <InviteCodeBadge user={user} memorial={memorial} compact />
                  )}

                  {/* Alive / Deceased toggle for family members */}
                  {(isOwner || isFamilyMember) && (
                    <div style={{ background: C.ink, borderRadius: 26, padding: '22px 24px', position: 'relative',
                      border: '1px solid rgba(241,236,225,.08)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div>
                          <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.22em', textTransform: 'uppercase',
                            color: 'var(--theme, #f3b21a)' }}>◆ Family update</span>
                          <h3 style={{ fontFamily: DISP, fontWeight: 700, fontSize: 18, color: C.cream, margin: '6px 0 4px' }}>
                            Status & Date of Passing
                          </h3>
                          <p style={{ fontFamily: DISP, fontSize: 13, color: 'rgba(241,236,225,.5)', margin: 0, lineHeight: 1.5 }}>
                            Approved family members can update {memorial.name?.split(' ')[0]}'s status.
                          </p>
                        </div>
                        {/* Living / Passed badge */}
                        <div style={{ flexShrink: 0, fontFamily: MONO, fontSize: 11, letterSpacing: '.18em',
                          textTransform: 'uppercase', padding: '8px 14px', borderRadius: 999,
                          background: memorial.alive !== false ? 'rgba(94,122,62,.25)' : 'rgba(243,178,26,.15)',
                          color: memorial.alive !== false ? '#88c069' : 'var(--theme, #f3b21a)',
                          border: `1px solid ${memorial.alive !== false ? 'rgba(94,122,62,.35)' : 'rgba(243,178,26,.25)'}` }}>
                          {memorial.alive !== false ? '● Living' : '◎ Passed'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {/* Mark as Passed */}
                        {memorial.alive !== false && (
                          <button
                            onClick={async () => {
                              const dodYear = prompt(`Enter ${memorial.name?.split(' ')[0]}'s year of passing (e.g. 2024):`)
                              if (!dodYear || !/^\d{4}$/.test(dodYear.trim())) return
                              try {
                                await db.transact([
                                  db.tx.memorials[memorialId].update({
                                    alive: false,
                                    dodYear: dodYear.trim(),
                                    died: dodYear.trim(),
                                    deathYear: dodYear.trim(),
                                  }),
                                ])
                              } catch { toast.error('Could not update. Please try again.') }
                            }}
                            style={{ padding: '10px 18px', borderRadius: 999, border: '1px solid rgba(200,83,31,.35)',
                              background: 'rgba(200,83,31,.10)', color: '#e07b5a', cursor: 'pointer',
                              fontFamily: MONO, fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase' }}
                          >
                            Mark as Passed ◎
                          </button>
                        )}

                        {/* Mark as Living (reverse) */}
                        {memorial.alive === false && (
                          <button
                            onClick={async () => {
                              if (!confirm(`Mark ${memorial.name?.split(' ')[0]} as living?`)) return
                              try {
                                await db.transact([
                                  db.tx.memorials[memorialId].update({
                                    alive: true,
                                    dodYear: null,
                                    died: null,
                                    deathYear: null,
                                  }),
                                ])
                              } catch { toast.error('Could not update. Please try again.') }
                            }}
                            style={{ padding: '10px 18px', borderRadius: 999, border: '1px solid rgba(94,122,62,.35)',
                              background: 'rgba(94,122,62,.12)', color: '#88c069', cursor: 'pointer',
                              fontFamily: MONO, fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase' }}
                          >
                            Mark as Living ●
                          </button>
                        )}

                        {/* Update year of passing */}
                        {memorial.alive === false && (
                          <button
                            onClick={async () => {
                              const dodYear = prompt(`Update year of passing (currently: ${memorial.dodYear || memorial.deathYear || '?'}):`)
                              if (!dodYear || !/^\d{4}$/.test(dodYear.trim())) return
                              try {
                                await db.transact([
                                  db.tx.memorials[memorialId].update({
                                    dodYear: dodYear.trim(),
                                    died: dodYear.trim(),
                                    deathYear: dodYear.trim(),
                                  }),
                                ])
                              } catch { toast.error('Could not update. Please try again.') }
                            }}
                            style={{ padding: '10px 18px', borderRadius: 999, border: '1px solid rgba(241,236,225,.12)',
                              background: 'rgba(241,236,225,.06)', color: 'rgba(241,236,225,.6)', cursor: 'pointer',
                              fontFamily: MONO, fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase' }}
                          >
                            Edit year of passing
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Private family messages */}
                  <div style={{ background: C.paper, borderRadius: 26, padding: '22px 24px',
                    border: '1px solid rgba(21,18,14,.08)', minHeight: 480,
                    display: 'flex', flexDirection: 'column' }}>
                    <FamilyMessagesSection
                      memorialId={memorialId}
                      user={user}
                      userProfile={userProfile}
                    />
                  </div>
              </motion.div>
            )}
          </main>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer style={{ marginTop: '3rem', padding: '18px 8px',
          borderTop: '1px solid rgba(241,236,225,.10)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
          fontFamily: MONO, fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(241,236,225,.5)' }}>
          <span>Who Was I — Family Archive <span style={{ color: 'var(--theme, #f3b21a)' }}>●</span> whowasi.uk</span>
          <span>memorial · {memorial.name?.toLowerCase()} · est. {
            String(memorial.born || memorial.birthYear || '').match(/\d{4}/)?.[0] || new Date().getFullYear()
          }</span>
          <span>last edit · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
        </footer>
      </div>

      {/* ── Responsive + motion styles ────────────────────────────────────
            Premium scroll: hide rough scroll edges, isolate sticky rail
            from the long right feed, soften every entrance animation, and
            honour users who request reduced motion. */}
      <style>{`
        @media (max-width: 1024px) {
          .page-grid { grid-template-columns: 1fr !important; }
          .page-grid aside { position: static !important; }
        }
        @media (max-width: 768px) {
          .page-grid { padding: 0 .75rem; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Stop motion.div whileInView from cascading repaints down the
           column when scrolling fast — every direct child of the right
           main column gets a layout-isolated paint surface. */
        .page-grid > main > * {
          contain: layout style;
        }

        /* Respect users who prefer no motion */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: .01ms !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>

      {/* ── Tribute form ──────────────────────────────────────────────────── */}
      {showTributeForm && (
        <TributeFormModal
          onClose={() => setShowTributeForm(false)}
          onSubmit={handleSubmitTribute}
          submitting={submitting}
        />
      )}

      {/* ── Share toast ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {shareToast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 50,
              padding: '12px 20px', borderRadius: 999, background: C.ink, color: C.cream,
              fontFamily: MONO, fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase',
              boxShadow: '0 8px 24px rgba(21,18,14,.25)', whiteSpace: 'nowrap' }}>
            Link copied to clipboard
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── QR modal ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showQR && (
          <Suspense fallback={null}>
            <QRModal onClose={() => setShowQR(false)} url={shareUrl} name={memorial.name} />
          </Suspense>
        )}
      </AnimatePresence>

      {/* ── Mobile fullscreen reel overlay ───────────────────────────────── */}
      <AnimatePresence>
        {showReelFull && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ position:'fixed', inset:0, zIndex:150, background:'#000' }}>

            {/* Back button — top left */}
            <button
              onClick={() => setShowReelFull(false)}
              style={{ position:'absolute', top:20, left:16, zIndex:160, display:'flex', alignItems:'center', gap:8,
                background:'rgba(241,236,225,.12)', border:'1px solid rgba(241,236,225,.15)',
                backdropFilter:'blur(8px)', borderRadius:999, padding:'8px 14px',
                fontFamily:MONO, fontSize:10.5, letterSpacing:'.18em', textTransform:'uppercase',
                color:'rgba(241,236,225,.8)', cursor:'pointer' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
              Back
            </button>

            {/* Full-viewport reel player — fill=true makes it cover the entire overlay */}
            <div style={{ position:'relative', width:'100%', height:'100%' }}>
              <Suspense fallback={<div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:40, height:40, borderRadius:'50%', border:'2px solid rgba(255,215,0,.3)', borderTopColor:'#FFD700', animation:'spin 0.8s linear infinite' }} />}>
                <LifeReel
                  photos={photos}
                  memorial={memorial}
                  tributes={tributes}
                  fill
                  onEnd={() => setShowReelFull(false)}
                />
              </Suspense>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TalkScreen — living voice memory overlay ──────────────────────────
           position:fixed; inset:8px — tiny gap around every edge
           X button and "End session" both call onClose → setShowTalkScreen(false) */}
      <AnimatePresence>
        {showTalkScreen && (
          <Suspense fallback={null}>
            <TalkScreen
              memorial={memorial}
              memorialId={memorialId}
              onClose={() => setShowTalkScreen(false)}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* ── Memorial Family Circle — full-viewport orbital ──────────────────── */}
      <AnimatePresence>
        {showFamilyCircle && (
          <MemorialFamilyCircle
            memorial={memorial}
            memorialId={memorialId}
            user={user}
            isOwner={isOwner}
            onClose={() => setShowFamilyCircle(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Error boundary ───────────────────────────────────────────────────────────
class MemorialBoundary extends Component {
  constructor(p) { super(p); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  componentDidCatch(err) { try { console.error('MemorialDetailPage:', err) } catch {} }
  render() {
    if (this.state.err) {
      return (
        <div style={{ minHeight: '100vh', background: C.paper, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ textAlign: 'center', maxWidth: 340 }}>
            <div style={{ fontSize: 40, marginBottom: 16, color: 'rgba(21,18,14,.15)' }}>✦</div>
            <h1 style={{ fontFamily: DISP, fontSize: 22, fontWeight: 700, color: C.ink, marginBottom: 8 }}>This memorial</h1>
            <p style={{ fontFamily: DISP, fontSize: 14, color: C.muted, lineHeight: 1.6, marginBottom: 24 }}>
              Part of this memorial couldn't load right now, but the data is safe.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
              <button onClick={() => window.location.reload()}
                style={{ padding: '12px 24px', borderRadius: 999, background: 'var(--theme, #f3b21a)', border: 'none',
                  color: C.ink, fontFamily: MONO, fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase',
                  cursor: 'pointer', fontWeight: 700 }}>
                Reload
              </button>
              <a href="/explore" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.18em',
                textTransform: 'uppercase', color: C.muted, textDecoration: 'none', marginTop: 4 }}>
                Back to explore
              </a>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────
export default function MemorialDetailPage() {
  return (
    <MemorialBoundary>
      <MemorialDetailPageInner />
    </MemorialBoundary>
  )
}
