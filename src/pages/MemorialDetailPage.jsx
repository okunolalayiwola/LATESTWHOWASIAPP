// src/pages/MemorialDetailPage.jsx — v3 "Editorial"
// Design: Memorial v2 — cream paper · saffron · Space Grotesk + Fraunces
// Layout: Hero (full-bleed) → 2-col sticky-rail grid → footer

import { useState, useRef, useMemo, useEffect, lazy, Suspense, Component } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { id } from '@instantdb/react'
import { db } from '../lib/instant'
import { uploadImage } from '../lib/storage'
import useSEO from '../hooks/useSEO'

// ─── Safe lazy loaders ────────────────────────────────────────────────────────
function safeLazy(loader) {
  return lazy(() =>
    loader()
      .then(m => ({ default: m.default || (() => null) }))
      .catch(() => ({ default: () => null }))
  )
}
const QRModal  = safeLazy(() => import('../components/ui/QRModal'))
const LifeReel = safeLazy(() => import('../components/ui/LifeReel'))
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

const TRIBUTE_TYPES = [
  { type: 'tribute', emoji: '♡', label: 'Tribute' },
  { type: 'candle',  emoji: '🕯', label: 'Candle'  },
  { type: 'memory',  emoji: '◎', label: 'Memory'  },
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
    return <>{lower}<span style={{ color: C.saffron }}>.</span></>
  }
  return (
    <>
      {lower.slice(0, idx)}
      <em style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300, color: C.saffron2 }}>
        {lower[idx]}
      </em>
      {lower.slice(idx + 1)}
      <span style={{ color: C.saffron }}>.</span>
    </>
  )
}

// ─── Shared UI atoms ──────────────────────────────────────────────────────────

function Label({ children, onInk = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}
      style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.24em', textTransform: 'uppercase', color: onInk ? 'rgba(241,236,225,.6)' : C.muted }}>
      <span style={{ color: onInk ? C.saffron : C.saffronDeep }}>◆</span>
      {children}
    </span>
  )
}

function Card({ variant = 'paper', className = '', style = {}, children, ...rest }) {
  const base = {
    paper:   { background: C.cream,  border: '1px solid rgba(21,18,14,.06)', boxShadow: '0 1px 0 rgba(255,255,255,.6) inset, 0 4px 18px rgba(21,18,14,.04)', color: C.ink },
    ink:     { background: C.ink,    border: '1px solid rgba(241,236,225,.10)', boxShadow: '0 14px 30px rgba(21,18,14,.22)', color: C.cream },
    saffron: { background: C.saffron,border: '1px solid rgba(21,18,14,.10)', boxShadow: '0 8px 22px rgba(243,178,26,.28)', color: C.ink },
  }
  return (
    <div className={`rounded-[26px] overflow-hidden ${className}`} style={{ ...base[variant], ...style }} {...rest}>
      {children}
    </div>
  )
}

// ─── Waveform bars (static decoration) ───────────────────────────────────────
const WAVE_SEEDS = [.4,.7,.55,.85,.6,.9,.5,.75,.45,.65,.85,.55,.35,.7,.95,.65,.4,.55,.85,.6,.5,.4,.75,.55,.32,.6,.8,.45,.7,.5,.4,.62,.5,.7,.85,.4,.55,.7,.5,.32,.55,.7,.4,.65,.85,.5]

function WaveformBars({ playing = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 38, marginTop: 4 }}>
      {WAVE_SEEDS.map((h, i) => (
        <span key={i} style={{
          flex: 1,
          height: `${h * 100}%`,
          background: C.saffron,
          borderRadius: 2,
          opacity: playing ? (i < 12 ? 1 : 0.55) : 0.35,
          transition: 'opacity .3s',
        }} />
      ))}
    </div>
  )
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

// ─── Hero ─────────────────────────────────────────────────────────────────────
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
      {/* Photo */}
      {memorial.photo
        ? <img src={memorial.photo} alt={memorial.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%',
              filter: 'saturate(.9) contrast(1.02)',
              animation: 'slowzoom 1.8s ease-out both',
              position: 'absolute', inset: 0 }} />
        : <div style={{ position: 'absolute', inset: 0,
            background: `linear-gradient(135deg, ${C.ink2} 0%, ${C.ink} 100%)` }} />
      }

      {/* Scrims */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(to bottom, rgba(21,18,14,.05) 0%, transparent 30%, rgba(21,18,14,.55) 80%, rgba(21,18,14,.85) 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(to right, rgba(21,18,14,.6) 0%, transparent 45%)' }} />
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
            color: C.ink, background: alive ? C.moss : C.saffron,
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
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '0 2rem 2rem', zIndex: 2, color: C.cream,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24,
        animation: 'rise 0.8s ease-out 0.25s both' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {relation && (
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.28em', textTransform: 'uppercase',
              color: C.saffron, display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: '.75rem' }}>
              <span style={{ color: C.saffron }}>◆</span>
              {relation} · vol. 01
            </div>
          )}
          <h1 style={{ fontFamily: DISP, fontWeight: 700,
            fontSize: 'clamp(48px, 8.5vw, 120px)', lineHeight: .86,
            letterSpacing: '-.045em', color: '#fff', textTransform: 'lowercase', margin: 0 }}>
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
            {alive ? <>An ongoing <em style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300, color: C.saffronDeep }}>life</em></> :
                     <>A life <em style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300, color: C.saffronDeep }}>remembered</em></>}
          </div>
          <div style={{ marginTop: 10, height: 6, borderRadius: 3, background: C.cream2, overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%',
              width: `${Math.min((calcAge(born, died, memorial.alive) || 62) / 100 * 100, 100)}%`,
              background: C.saffron,
              backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 5px, rgba(21,18,14,.4) 5px 6px)' }} />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slowzoom { from { transform: scale(1.07); } to { transform: scale(1); } }
        @keyframes rise     { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes livepulse{ 0%,100%{ opacity:1; transform:scale(1); } 50%{ opacity:.4; transform:scale(.85); } }
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
          background: 'linear-gradient(95deg, #ff9ec7 0%, #c9a8f0 32%, #a9c4f5 62%, #88e0c4 100%)',
          WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
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
            { label: 'Memories', value: memoryCount,  color: C.saffronDeep },
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
        background: C.saffron, color: C.ink, borderRadius: 26, overflow: 'hidden',
        display: 'grid', gridTemplateColumns: '1fr 96px', alignItems: 'stretch',
        boxShadow: '0 8px 22px rgba(243,178,26,.28), 0 1px 0 rgba(255,255,255,.5) inset',
        transition: 'transform .15s', textAlign: 'left', fontFamily: DISP,
      }}>
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}>
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.22em', textTransform: 'uppercase', opacity: .65 }}>◆ contribute</span>
          <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-.01em', lineHeight: 1 }}>Leave a tribute</h3>
        </div>
        <div style={{ background: C.ink, color: C.saffron, display: 'flex', alignItems: 'center',
          justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 'auto 0 0 0', height: '35%',
            backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 7px, rgba(243,178,26,.7) 7px 8px)' }} />
          <div style={{ position: 'relative', zIndex: 1, width: 44, height: 44, borderRadius: '50%',
            background: C.saffron, color: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
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
          <button key={label} onClick={fn} style={{
            padding: '16px 18px', borderRadius: 20, background: C.paper, color: C.ink,
            border: '1px solid rgba(21,18,14,.10)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            fontFamily: DISP, fontSize: 13, fontWeight: 600, transition: 'background .15s',
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
                ? <em style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300, color: C.saffronDeep }}>{value}</em>
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
      <div style={{
        position: 'relative', background: C.ink, color: C.cream, borderRadius: 26,
        padding: 22, overflow: 'hidden', cursor: 'pointer',
        border: '1px solid rgba(21,18,14,.4)', boxShadow: '0 14px 30px rgba(21,18,14,.22)',
      }}>
        {/* Ambient glows */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(circle at 90% -10%, rgba(243,178,26,.20), transparent 55%), radial-gradient(circle at -10% 110%, rgba(200,83,31,.12), transparent 55%)' }} />
        {/* Stripe accent */}
        <div style={{ position: 'absolute', right: -10, bottom: -10, width: 200, height: 200,
          backgroundImage: STRIPE, opacity: .10, pointerEvents: 'none', transform: 'rotate(8deg)' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, position: 'relative' }}>
          <Label onInk>Legacy Vault</Label>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: C.saffron, color: C.ink,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
        </div>

        <h3 style={{ fontFamily: DISP, fontWeight: 700, fontSize: 22, letterSpacing: '-.02em', lineHeight: 1.1,
          color: C.cream, margin: '0 0 6px', position: 'relative' }}>
          Sealed messages &amp; <em style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300, color: C.saffron2 }}>the will.</em>
        </h3>
        <p style={{ color: 'rgba(241,236,225,.6)', fontSize: 13.5, lineHeight: 1.55,
          marginBottom: 14, maxWidth: '42ch', position: 'relative' }}>
          Biometrically secured letters and final instructions. Open the vault to read or contribute.
        </p>

        <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
          {[
            { value: String(letterCount || 0).padStart(2, '0'), label: `Letters · ${sealedCount} sealed`, gold: false },
            { value: hasWill ? '✓' : '—', label: hasWill ? 'Will sealed' : 'No will yet', gold: hasWill },
          ].map(({ value, label, gold }) => (
            <div key={label} style={{ flex: 1, padding: 12, borderRadius: 14,
              background: 'rgba(241,236,225,.05)', border: '1px solid rgba(241,236,225,.10)',
              display: 'flex', flexDirection: 'column', gap: 6 }}>
              <strong style={{ fontFamily: DISP, fontWeight: 700, fontSize: 22, letterSpacing: '-.02em', lineHeight: 1,
                color: gold ? C.saffron : C.cream }}>{value}</strong>
              <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.18em', textTransform: 'uppercase',
                color: 'rgba(241,236,225,.5)' }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 14,
          borderTop: '1px solid rgba(241,236,225,.08)',
          fontFamily: MONO, fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase',
          color: C.saffron, position: 'relative' }}>
          <span>Open vault</span>
          <div style={{ marginLeft: 'auto', width: 30, height: 30, borderRadius: '50%',
            background: C.saffron, color: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Voice section ────────────────────────────────────────────────────────────
function VoiceSection({ memorial }) {
  const hasVoice = !!memorial.voiceUrl
  const bio      = memorial.bio || memorial.description || memorial.subtitle || ''
  const { state, toggle } = useVoice(hasVoice ? memorial.voiceUrl : null)
  const firstName = memorial.name?.split(' ')[0] || 'them'
  const alive     = memorial.alive !== false

  if (!hasVoice && !bio) return null

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
        gridTemplateColumns: '1fr 200px', gap: 28, padding: '24px 24px 22px',
        alignItems: 'center' }}
        className="voice-grid">
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Label onInk>Voice of {firstName}</Label>
            {memorial.elevenLabsVoiceId && (
              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase',
                color: C.ink, background: C.saffron, padding: '4px 9px', borderRadius: 999 }}>◆ AI cloned voice</span>
            )}
          </div>
          <h3 style={{ fontFamily: DISP, fontWeight: 700, fontSize: 26, letterSpacing: '-.02em', lineHeight: 1.1, margin: 0, color: C.cream }}>
            Hear {firstName} speak —{' '}
            <em style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300, color: C.saffron2 }}>
              {alive ? 'as they still do.' : 'as they were.'}
            </em>
          </h3>
          <p style={{ color: 'rgba(241,236,225,.6)', fontSize: 14, lineHeight: 1.55, margin: 0 }}>
            {hasVoice
              ? 'A reconstructed voice from letters, voicenotes and recordings.'
              : 'Upload voice samples to generate a talking AI avatar.'}
          </p>
          <WaveformBars playing={state === 'playing'} />
        </div>

        {/* Right — saffron play disc */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {hasVoice ? (
            <motion.button
              whileHover={{ translateY: -2, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={toggle}
              aria-label={state === 'playing' ? 'Pause voice' : 'Play voice'}
              style={{
                position: 'relative', width: 160, height: 160, borderRadius: '50%',
                background: state === 'playing'
                  ? 'linear-gradient(155deg, #fff3 0%, rgba(243,178,26,.4) 100%)'
                  : 'linear-gradient(155deg, #ffd166 0%, #f3b21a 45%, #d99206 100%)',
                border: 'none',
                boxShadow: '0 24px 48px -8px rgba(243,178,26,.55), 0 10px 24px -6px rgba(0,0,0,.45)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              <div style={{ position: 'absolute', inset: -22, borderRadius: '50%', zIndex: -1,
                background: 'radial-gradient(circle, rgba(243,178,26,.30) 0%, rgba(243,178,26,.08) 45%, transparent 70%)',
                pointerEvents: 'none' }} />
              {state === 'loading' ? (
                <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,.3)',
                  borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
              ) : state === 'playing' ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <div style={{ width: 6, height: 32, background: '#fff', borderRadius: 3 }} />
                  <div style={{ width: 6, height: 32, background: '#fff', borderRadius: 3 }} />
                </div>
              ) : (
                <div style={{ width: 0, height: 0,
                  borderLeft: '34px solid #ffffff', borderTop: '21px solid transparent',
                  borderBottom: '21px solid transparent', marginLeft: 10,
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.18)) drop-shadow(0 0 18px rgba(255,255,255,.35))' }} />
              )}
            </motion.button>
          ) : (
            <div style={{ width: 160, height: 160, borderRadius: '50%',
              background: 'rgba(241,236,225,.06)', border: '1px solid rgba(241,236,225,.10)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 6, textAlign: 'center', padding: 20 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(241,236,225,.3)" strokeWidth="1.5" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(241,236,225,.3)' }}>No voice yet</span>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 600px) { .voice-grid { grid-template-columns: 1fr !important; }}`}</style>
    </Card>
  )
}

// ─── Story card ───────────────────────────────────────────────────────────────
function StoryCard({ memorial }) {
  const bio = memorial.bio || memorial.description || ''
  if (!bio) return null

  const sentences = bio.split(/(?<=[.!?])\s+/)
  const lead      = sentences[0] || bio.slice(0, 120)
  const body      = sentences.length > 1 ? sentences.slice(1).join(' ') : ''
  const wordCount = bio.split(/\s+/).filter(Boolean).length
  const readMins  = Math.max(1, Math.ceil(wordCount / 200))

  return (
    <Card variant="paper" style={{ padding: 0, background: C.cream2 }}>
      <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(21,18,14,.08)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Label>Life story</Label>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase', color: C.muted }}>
          written · {memorial.relation || 'family'} · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
        </span>
      </div>
      <div style={{ padding: '22px 28px 14px' }}>
        <p style={{ fontFamily: SERIF, fontWeight: 300, fontStyle: 'italic', fontSize: 26,
          lineHeight: 1.22, color: C.ink, marginBottom: 16, letterSpacing: '-.01em',
          backgroundImage: `linear-gradient(135deg, ${C.saffronDeep}, ${C.ink})`,
          WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
        }}>{lead}</p>
        {body && <p style={{ fontFamily: DISP, fontSize: 15, lineHeight: 1.75, color: C.ink2 }}>{body}</p>}
      </div>
      <div style={{ padding: '14px 22px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontFamily: MONO, fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase', color: C.muted }}>
        <span style={{ color: C.ink }}>edition · 01 / 01</span>
        <span>{readMins} min read · {wordCount} words</span>
      </div>
    </Card>
  )
}

// ─── Tribute card ─────────────────────────────────────────────────────────────
function TributeCard({ tribute, variant = 'light', onLike, onDelete, canDelete }) {
  const [liked,   setLiked]   = useState(false)
  const [confirm, setConfirm] = useState(false)
  const likes = (tribute.likes || 0) + (liked ? 1 : 0)

  const styles = {
    featured: { background: C.saffron, border: '1px solid rgba(21,18,14,.15)', color: C.ink, gridColumn: 'span 2' },
    light:    { background: C.paper,   border: '1px solid rgba(21,18,14,.08)', color: C.ink },
    dark:     { background: C.ink,     border: '1px solid rgba(21,18,14,.4)',  color: C.cream },
  }
  const s       = styles[variant] || styles.light
  const isDark  = variant === 'dark'
  const avatarS = variant === 'featured' ? { background: C.ink, color: C.saffron } :
                  isDark                 ? { background: C.saffron, color: C.ink } :
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
            {tribute.type || 'tribute'} · {timeAgo(tribute.createdAt)}
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
    </motion.div>
  )
}

// ─── Tributes section ─────────────────────────────────────────────────────────
function TributesSection({ tributes, onLike, onDelete, isOwner, currentUserId, preview = false }) {
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
              <TributeCard key={t.id} tribute={t} variant={variant} onLike={onLike} onDelete={onDelete} canDelete={canDel} />
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
  const [uploading, setUploading] = useState(false)
  const [pct,       setPct]       = useState(0)
  const fileRef = useRef(null)

  async function handleUpload(e) {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    try {
      const url = await uploadImage(file, setPct, 'memorials')
      await db.transact([db.tx.photos[id()].update({ url, createdAt: Date.now() }).link({ memorial: memorialId })])
    } finally { setUploading(false); setPct(0) }
  }

  const shown   = preview ? photos.slice(0, 5) : photos
  const overflow = photos.length - shown.length

  if (photos.length === 0 && !isOwner) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <div style={{ fontSize: 36, marginBottom: 16, color: 'rgba(21,18,14,.12)' }}>✿</div>
        <p style={{ fontFamily: DISP, color: C.muted, fontSize: 14 }}>No photos added yet.</p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '22px 4px 12px' }}>
        <Label>Gallery</Label>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: C.muted }}>
          {photos.length} photograph{photos.length !== 1 ? 's' : ''}
        </span>
      </div>

      {isOwner && !preview && (
        <div onClick={() => fileRef.current?.click()}
          style={{ width: '100%', padding: '24px 0', borderRadius: 20, marginBottom: 12,
            border: `2px dashed rgba(21,18,14,.15)`, display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 8, cursor: 'pointer', background: C.paper }}>
          <span style={{ fontSize: 24, color: 'rgba(21,18,14,.2)' }}>✿</span>
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: C.muted }}>
            {uploading ? `Uploading ${pct}%` : 'Add photos'}
          </span>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridAutoRows: 140, gap: 10 }}
        className="gallery-grid">
        {shown.map((photo, i) => (
          <motion.div key={photo.id || i} whileHover={{ scale: .98 }}
            onClick={() => setSelected(photo)}
            style={{
              position: 'relative', overflow: 'hidden', borderRadius: 20, cursor: 'pointer',
              background: C.cream2, border: '1px solid rgba(21,18,14,.08)',
              gridColumn: i === 0 ? 'span 2' : undefined,
              gridRow:    i === 0 ? 'span 2' : undefined,
            }}>
            <img src={photo.url} alt={photo.caption || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform .4s' }} />
            {photo.caption && (
              <span style={{ position: 'absolute', left: 10, top: 10, fontFamily: MONO, fontSize: 9.5,
                letterSpacing: '.18em', textTransform: 'uppercase', color: C.cream,
                background: 'rgba(21,18,14,.7)', padding: '3px 7px', borderRadius: 999, backdropFilter: 'blur(4px)' }}>
                {photo.caption}
              </span>
            )}
          </motion.div>
        ))}

        {(overflow > 0 || (preview && photos.length > 5)) && (
          <div style={{ background: C.ink, color: C.cream, borderRadius: 20, padding: 14,
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between',
            cursor: 'pointer' }}>
            <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(241,236,225,.6)' }}>◆ view all</span>
            <span style={{ fontFamily: DISP, fontWeight: 700, fontSize: 38, letterSpacing: '-.03em', lineHeight: 1, color: C.saffron }}>
              +{overflow || (photos.length - 5)}
            </span>
          </div>
        )}
      </div>
      <style>{`@media (max-width: 600px) { .gallery-grid { grid-template-columns: repeat(2, 1fr) !important; } }`}</style>

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
    </div>
  )
}

// ─── Tribute form modal ───────────────────────────────────────────────────────
function TributeFormModal({ onClose, onSubmit, submitting }) {
  const [text, setText] = useState('')
  const [type, setType] = useState('tribute')
  const textRef = useRef(null)

  useEffect(() => { setTimeout(() => textRef.current?.focus(), 80) }, [])

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
            <h3 style={{ fontFamily: DISP, fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', color: C.ink, margin: 0 }}>Leave a tribute</h3>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: C.cream2,
              border: '1px solid rgba(21,18,14,.10)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.muted, fontSize: 14 }}>✕</button>
          </div>

          {/* Type selector */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {TRIBUTE_TYPES.map(t => (
              <button key={t.type} onClick={() => setType(t.type)}
                style={{ flex: 1, padding: '8px 0', borderRadius: 999, cursor: 'pointer',
                  fontFamily: MONO, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase',
                  transition: 'all .15s',
                  background: type === t.type ? C.saffron : C.cream,
                  border: `1px solid ${type === t.type ? 'rgba(21,18,14,.15)' : 'rgba(21,18,14,.10)'}`,
                  color: type === t.type ? C.ink : C.muted }}>
                {t.emoji} {t.label}
              </button>
            ))}
          </div>

          <textarea ref={textRef} value={text} onChange={e => setText(e.target.value)}
            placeholder="Share a memory, light a candle, or leave a tribute…"
            style={{ width: '100%', background: C.cream, border: '1px solid rgba(21,18,14,.12)',
              borderRadius: 16, padding: '14px 16px', fontFamily: DISP, fontSize: 14,
              color: C.ink, resize: 'none', height: 120, outline: 'none', lineHeight: 1.6,
              boxSizing: 'border-box' }} />

          <button onClick={() => onSubmit(text, type)} disabled={!text.trim() || submitting}
            style={{ width: '100%', marginTop: 12, padding: '16px 0', borderRadius: 999, border: 'none',
              cursor: text.trim() ? 'pointer' : 'default', fontFamily: MONO, fontSize: 11,
              letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 700, transition: 'all .2s',
              background: text.trim() ? C.saffron : C.cream2, color: text.trim() ? C.ink : C.muted2,
              boxShadow: text.trim() ? '0 4px 14px rgba(243,178,26,.25)' : 'none' }}>
            {submitting ? 'Submitting…' : `◆ Post ${type}`}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', padding: 6, borderRadius: 18,
      background: C.paper, border: '1px solid rgba(21,18,14,.10)',
      width: 'fit-content', marginBottom: 20, gap: 0 }}>
      {tabs.map(({ key, label, count }) => {
        const isActive = active === key
        return (
          <button key={key} onClick={() => onChange(key)}
            style={{ border: 'none', cursor: 'pointer', fontFamily: DISP, fontWeight: 600,
              fontSize: 13.5, padding: '10px 18px', borderRadius: 12,
              background: isActive ? C.ink : 'transparent',
              color: isActive ? C.saffron : C.ink2, letterSpacing: '.01em', transition: 'all .15s',
              boxShadow: isActive ? '0 4px 14px rgba(21,18,14,.2)' : 'none',
              display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {label}
            <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.06em',
              background: isActive ? C.saffron : 'rgba(21,18,14,.08)',
              color: isActive ? C.ink : C.muted,
              padding: '2px 7px', borderRadius: 999 }}>
              {String(count).padStart(2, '0')}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function LoadingSkeleton() {
  const pulse = { background: C.cream2, animation: 'pulse 1.5s ease-in-out infinite', borderRadius: 26 }
  return (
    <div style={{ background: C.paper, minHeight: '100vh' }}>
      <div style={{ margin: '1rem 1rem 0', borderRadius: 26, height: '64vh', minHeight: 480, ...pulse }} />
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '1.5rem 1rem 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 24 }} className="skeleton-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ height: 320, ...pulse }} />
            <div style={{ height: 120, ...pulse }} />
            <div style={{ height: 200, ...pulse }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ height: 56, width: 380, ...pulse }} />
            <div style={{ height: 220, ...pulse }} />
            <div style={{ height: 300, ...pulse }} />
          </div>
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:.7} 50%{opacity:1} }
        @media (max-width: 1024px) { .skeleton-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
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

  const { user } = db.useAuth()

  const { isLoading, error, data } = db.useQuery(
    memorialId ? { memorials: { $: { where: { id: memorialId } }, tributes: {}, photos: {} } } : null
  )
  const vaultQ = db.useQuery(
    memorialId ? { memorials: { $: { where: { id: memorialId } }, letters: {}, documents: {} } } : null
  )

  const memorial      = data?.memorials?.[0]
  const vaultMemorial = vaultQ?.data?.memorials?.[0]

  const tributes = useMemo(
    () => [...(memorial?.tributes || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [memorial]
  )

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
          <Link to="/explore" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: C.saffronDeep, textDecoration: 'underline' }}>
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
          {!user && <Link to="/auth" style={{ display: 'inline-block', padding: '12px 24px', borderRadius: 999, background: C.saffron, color: C.ink, fontFamily: MONO, fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', textDecoration: 'none', marginBottom: 12 }}>Sign in</Link>}
          <div><Link to="/explore" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: C.saffronDeep, textDecoration: 'underline' }}>Back to explore</Link></div>
        </div>
      </div>
    )
  }

  // ── Derived values (after early returns — NO hooks below this line) ────────
  const photos       = memorial.photos || []
  const tributeCount = tributes.length
  const candleCount  = tributes.filter(t => t.type === 'candle').length
  const memoryCount  = tributes.filter(t => t.type === 'memory').length
  const isOwner      = !!(user && memorial.creatorId === user.id)
  const shareUrl     = `${window.location.origin}/memorial/${memorialId}`
  const letters      = vaultMemorial?.letters || memorial.letters || []
  const documents    = vaultMemorial?.documents || memorial.documents || []
  const sealedCount  = letters.filter(l => l.isLocked).length
  const hasWill      = documents.length > 0

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleSubmitTribute(text, type) {
    if (!text.trim() || submitting) return
    setSubmitting(true)
    try {
      await db.transact([
        db.tx.tributes[id()].update({
          content: text.trim(), text: text.trim(), type,
          author: user?.email?.split('@')[0] || 'Anonymous',
          authorName: user?.email?.split('@')[0] || 'Anonymous',
          authorId: user?.id || null, likes: 0, reactions: {},
          createdAt: Date.now(),
        }).link({ memorial: memorialId }),
      ])
      setShowTributeForm(false)
      setActiveTab('Tributes')
      fetch('/api/tribute-notification', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memorialId, tributeText: text.trim(), tributeType: type, authorName: user?.email?.split('@')[0] || 'Anonymous' }),
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
    { key: 'Reel',     label: 'Reel',     count: photos.length },
  ]

  return (
    <div style={{ background: C.paper, minHeight: '100vh' }}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <Hero memorial={memorial} memorialId={memorialId} isOwner={isOwner} navigate={navigate} />

      {/* ── Body grid ─────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '1.5rem 1rem 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 24, alignItems: 'start' }}
          className="page-grid">

          {/* ── Left rail (sticky) ───────────────────────────────────────── */}
          <aside style={{ position: 'sticky', top: '1rem', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <LifeGaugeCard memorial={memorial} tributeCount={tributeCount} candleCount={candleCount} memoryCount={memoryCount} />
            <ActionsCard onTribute={() => setShowTributeForm(true)} onShare={handleShare} onQR={() => setShowQR(true)} />
            <LifeRecordCard memorial={memorial} />
            <LegacyVaultCard memorialId={memorialId} letterCount={letters.length} sealedCount={sealedCount} hasWill={hasWill} />
          </aside>

          {/* ── Right column ─────────────────────────────────────────────── */}
          <main style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: '4rem' }}>
            <TabBar tabs={tabDefs} active={activeTab} onChange={setActiveTab} />

            <AnimatePresence mode="wait">
              {activeTab === 'Story' && (
                <motion.div key="story" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <VoiceSection memorial={memorial} />
                  <StoryCard memorial={memorial} />
                  {tributes.length > 0 && (
                    <TributesSection tributes={tributes} onLike={handleLikeTribute} onDelete={handleDeleteTribute}
                      isOwner={isOwner} currentUserId={user?.id} preview />
                  )}
                  {photos.length > 0 && (
                    <GallerySection photos={photos} memorialId={memorialId} isOwner={isOwner} preview />
                  )}
                </motion.div>
              )}

              {activeTab === 'Tributes' && (
                <motion.div key="tributes" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <TributesSection tributes={tributes} onLike={handleLikeTribute} onDelete={handleDeleteTribute}
                    isOwner={isOwner} currentUserId={user?.id} />
                  {tributes.length === 0 && (
                    <div style={{ textAlign: 'center', marginTop: 24 }}>
                      <button onClick={() => setShowTributeForm(true)}
                        style={{ padding: '12px 28px', borderRadius: 999, border: `1px solid ${C.saffron}`,
                          background: 'transparent', color: C.saffronDeep, cursor: 'pointer',
                          fontFamily: MONO, fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase' }}>
                        Leave the first tribute
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'Gallery' && (
                <motion.div key="gallery" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <GallerySection photos={photos} memorialId={memorialId} isOwner={isOwner} />
                </motion.div>
              )}

              {activeTab === 'Reel' && (
                <motion.div key="reel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <Suspense fallback={<div style={{ height: 320, borderRadius: 26, background: C.cream2, animation: 'pulse 1.5s infinite' }} />}>
                    <LifeReel photos={photos} memorial={memorial} />
                  </Suspense>
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer style={{ marginTop: '3rem', padding: '18px 8px',
          borderTop: '1px solid rgba(21,18,14,.10)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
          fontFamily: MONO, fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: C.muted }}>
          <span>Who Was I — Family Archive <span style={{ color: C.saffronDeep }}>●</span> whowasi.uk</span>
          <span>memorial · {memorial.name?.toLowerCase()} · est. {
            String(memorial.born || memorial.birthYear || '').match(/\d{4}/)?.[0] || new Date().getFullYear()
          }</span>
          <span>last edit · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
        </footer>
      </div>

      {/* ── Responsive styles ─────────────────────────────────────────────── */}
      <style>{`
        @media (max-width: 1024px) {
          .page-grid { grid-template-columns: 1fr !important; }
          .page-grid aside { position: static !important; }
        }
        @media (max-width: 768px) {
          .page-grid { padding: 0 .75rem; }
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
                style={{ padding: '12px 24px', borderRadius: 999, background: C.saffron, border: 'none',
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
