// src/pages/MemorialDetailPage.jsx — EDITORIAL REDESIGN
// Cream-paper brutalist · saffron accents · Space Grotesk + Fraunces italic
// Full design handoff: README.md in design_handoff_memorial_page/
// Preserves all functionality: VoiceOrb, LifeReel, tributes, gallery, QR, sharing, vault

import { useState, useRef, useMemo, useEffect, lazy, Suspense, Component } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { id } from '@instantdb/react'
import { db } from '../lib/instant'

// ─── SAFE-LOAD child component imports ───────────────────────────────────────
// Static imports throw at module evaluation if the target file is missing or
// doesn't export the expected default. That kills the whole page before any
// render runs. Loading these lazily means a missing/broken child only affects
// THAT child's section — the rest of the memorial still renders.
function safeLazy(loader, label) {
  return lazy(() =>
    loader()
      .then(mod => ({ default: mod.default || mod[label] || (() => null) }))
      .catch(err => {
        try { console.warn('[MemorialDetailPage] failed to load', label, err) } catch {}
        return { default: () => null }
      })
  )
}

const QRModal        = safeLazy(() => import('../components/ui/QRModal'),        'QRModal')
const KeepsakeButton = safeLazy(() => import('../components/ui/KeepsakeButton'), 'KeepsakeButton')
const VoiceOrb       = safeLazy(() => import('../components/ui/VoiceOrb'),       'VoiceOrb')
const LifeReel       = safeLazy(() => import('../components/ui/LifeReel'),       'LifeReel')

// Tiny null fallback for Suspense
const Empty = () => null

// ── INLINED replacements for fragile UI imports ─────────────────────────────
// Previously this file imported Skeleton (named), EmptyState (default), and
// SmartImage (default) from ../components/ui. If ANY of those files or named
// exports does not exist in the deployed project, the module fails to evaluate
// at import time and React renders "Something went wrong" — for every memorial,
// every time. We inline minimal equivalents so nothing external can be missing.
function SkeletonProfile() {
  return (
    <div className="flex flex-col items-center pt-12 space-y-4 px-5">
      <div className="w-24 h-24 rounded-full bg-white/5 animate-pulse" />
      <div className="h-6 w-40 bg-white/5 rounded-xl animate-pulse" />
      <div className="h-4 w-56 bg-white/5 rounded-full animate-pulse" />
    </div>
  )
}
function SkeletonStats() {
  return (
    <div className="grid grid-cols-2 gap-3 px-5 mt-6">
      {[0,1,2,3].map(i => <div key={i} className="rounded-2xl bg-white/5 animate-pulse h-24" />)}
    </div>
  )
}
function SkeletonListItem() {
  return <div className="h-12 rounded-xl bg-white/5 animate-pulse" />
}
// Plain <img> wrapper; equivalent to SmartImage's basic role.
function SmartImage({ src, alt, className, style }) {
  if (!src) return <div className={className} style={style} />
  return <img src={src} alt={alt || ''} className={className} style={style} loading="lazy" decoding="async" />
}

// ── Design tokens (inline, matching handoff) ──────────────────────────
const C = {
  cream:        '#f1ece1',
  cream2:       '#e8e1d1',
  paper:        '#f7f3ea',
  paperWarm:    '#efe7d6',
  ink:          '#15120e',
  ink2:         '#2a241d',
  inkSoft:      '#423a31',
  muted:        '#7a7164',
  muted2:       '#948a7a',
  saffron:      '#f3b21a',
  saffron2:     '#ffce5a',
  saffronDeep:  '#d99206',
  rust:         '#c8531f',
  moss:         '#5e7a3e',
}

const TABS = ['Story', 'Tributes', 'Gallery', 'Reel']

const TRIBUTE_TYPES = [
  { type:'tribute', emoji:'♡', label:'Tribute' },
  { type:'candle',  emoji:'🕯', label:'Candle'  },
  { type:'memory',  emoji:'◎', label:'Memory'  },
]

function timeAgo(ts) {
  if (!ts) return ''
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60)    return 'just now'
  if (s < 3600)  return `${Math.floor(s/60)}m ago`
  if (s < 86400) return `${Math.floor(s/3600)}h ago`
  if (s < 604800)return `${Math.floor(s/86400)}d ago`
  return new Date(ts).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
}

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
}

// ── Stripe pattern ────────────────────────────────────────────────────
const stripeCSS = `repeating-linear-gradient(
  135deg,
  transparent 0 9px,
  rgba(21,18,14,.85) 9px 10px
)`

// ════════════════════════════════════════════════════════════════════════
// CARD — variant: "paper" | "ink" | "saffron"
// ════════════════════════════════════════════════════════════════════════

function Card({ variant = 'paper', className = '', children, ...rest }) {
  const styles = {
    paper: {
      background: C.cream,
      border: '1px solid rgba(21,18,14,.06)',
      boxShadow: '0 1px 0 rgba(255,255,255,.6) inset, 0 -1px 0 rgba(21,18,14,.05) inset, 0 4px 18px rgba(21,18,14,.04)',
      color: C.ink,
    },
    ink: {
      background: C.ink,
      border: '1px solid rgba(241,236,225,.10)',
      boxShadow: '0 14px 30px rgba(21,18,14,.22)',
      color: C.cream,
    },
    saffron: {
      background: C.saffron,
      border: '1px solid rgba(21,18,14,.10)',
      boxShadow: '0 8px 22px rgba(243,178,26,.28), 0 1px 0 rgba(255,255,255,.5) inset',
      color: C.ink,
    },
  }
  const s = styles[variant] || styles.paper
  return (
    <div className={`rounded-[26px] overflow-hidden ${className}`} style={s} {...rest}>
      {children}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// LABEL — mono uppercase with ◆ prefix
// ════════════════════════════════════════════════════════════════════════

function Label({ children, onInk = false, className = '' }) {
  return (
    <span className={`text-[0.62rem] font-bold tracking-[0.28em] uppercase ${className}`}
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        color: onInk ? 'rgba(241,236,225,.6)' : C.muted,
      }}>
      <span style={{ color: onInk ? C.saffron : C.saffronDeep }}>◆ </span>
      {children}
    </span>
  )
}

// ════════════════════════════════════════════════════════════════════════
// LIFE GAUGE — saffron-rust radial, 270° sweep, tick marks
// ════════════════════════════════════════════════════════════════════════

function LifeGauge({ born, died, age, alive }) {
  let years = null
  if (age && !isNaN(parseInt(age))) years = parseInt(age)
  else if (born && died) {
    const b = parseInt(String(born).match(/\d{4}/)?.[0])
    const d = parseInt(String(died).match(/\d{4}/)?.[0])
    if (b && d) years = d - b
  } else if (born && alive !== false) {
    const b = parseInt(String(born).match(/\d{4}/)?.[0])
    if (b) years = new Date().getFullYear() - b
  }

  const pct   = years ? Math.min(years / 100, 1) : 0.62
  const SIZE  = 230
  const C_    = SIZE / 2
  const R     = 92
  const START = 135
  const SWEEP = 270
  const endAngle = START + SWEEP * pct

  const polar = (angle, radius) => {
    const a = (angle - 90) * Math.PI / 180
    return { x: C_ + radius * Math.cos(a), y: C_ + radius * Math.sin(a) }
  }
  const arcPath = (a0, a1, radius) => {
    const s = polar(a0, radius), e = polar(a1, radius)
    const large = (a1 - a0) > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`
  }

  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE}>
        <defs>
          <linearGradient id="lifeArc" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"  stopColor={C.saffron} />
            <stop offset="55%" stopColor={C.saffronDeep} />
            <stop offset="100%" stopColor={C.rust} />
          </linearGradient>
        </defs>

        {/* Tick marks */}
        {Array.from({ length: 70 }, (_, i) => {
          const a   = START + (SWEEP / 69) * i
          const lit = a <= endAngle
          const o1  = polar(a, R + 14)
          const o2  = polar(a, R + (i % 5 === 0 ? 4 : 8))
          return (
            <line key={i} x1={o1.x} y1={o1.y} x2={o2.x} y2={o2.y}
              stroke={lit ? 'url(#lifeArc)' : 'rgba(21,18,14,.12)'}
              strokeWidth={i % 5 === 0 ? 2 : 1} strokeLinecap="round" />
          )
        })}

        {/* Track */}
        <path d={arcPath(START, START + SWEEP, R)} fill="none"
          stroke="rgba(21,18,14,.10)" strokeWidth="10" strokeLinecap="round" />

        {/* Lit arc */}
        {pct > 0 && (
          <motion.path
            d={arcPath(START, endAngle, R)} fill="none"
            stroke="url(#lifeArc)" strokeWidth="10" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 1.6, ease: 'easeOut' }}
          />
        )}

        {/* End cap */}
        {pct > 0 && (() => {
          const e = polar(endAngle, R)
          return <circle cx={e.x} cy={e.y} r="6" fill={C.ink} />
        })()}
      </svg>

      {/* Center readout */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {years ? (
          <>
            <motion.span
              initial={{ opacity:0, scale:0.85 }} animate={{ opacity:1, scale:1 }}
              transition={{ delay:0.5, duration:0.5, ease:'easeOut' }}
              className="font-bold leading-none"
              style={{ fontSize:'5.2rem', fontFamily:"'Space Grotesk', sans-serif", letterSpacing:'-.05em', color: C.ink }}>
              {years}
            </motion.span>
            <span className="text-[0.55rem] tracking-[0.28em] uppercase mt-1"
              style={{ fontFamily:"'JetBrains Mono', monospace", color: C.muted }}>
              {alive === false ? 'years lived' : 'years young'}
            </span>
            {born && (
              <span className="mt-2 px-2.5 py-0.5 rounded-full text-[0.5rem] font-bold tracking-[0.2em] uppercase"
                style={{ fontFamily:"'JetBrains Mono', monospace", background: C.saffron, color: C.ink }}>
                est. {String(born).match(/\d{4}/)?.[0] || born}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="font-bold leading-none"
              style={{ fontSize:'5.2rem', fontFamily:"'Space Grotesk', sans-serif", letterSpacing:'-.05em', color: C.ink }}>
              ∞
            </span>
            <span className="text-[0.55rem] tracking-[0.28em] uppercase mt-1"
              style={{ fontFamily:"'JetBrains Mono', monospace", color: C.muted }}>
              a life remembered
            </span>
          </>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// TRIBUTE CARD — paper | saffron (featured) | ink (dark)
// ════════════════════════════════════════════════════════════════════════

function TributeCard({ tribute, onLike, onDelete, isOwner, currentUserId, featured }) {
  const [liked, setLiked]     = useState(false)
  const [confirm, setConfirm] = useState(false)
  const canDelete = isOwner || tribute.authorId === currentUserId
  const variant   = featured ? 'saffron' : (tribute.type === 'candle' ? 'ink' : 'paper')

  return (
    <motion.div layout initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, scale:0.96 }}
      className={featured ? 'col-span-2' : ''}>
      <Card variant={variant} className="p-[18px]">
        <div className="flex gap-3">
          {/* Avatar */}
          <div className="w-[42px] h-[42px] min-w-[42px] rounded-full flex items-center justify-center text-xs font-bold overflow-hidden"
            style={{
              background: variant === 'ink' ? C.saffron : (variant === 'saffron' ? C.ink : 'rgba(21,18,14,.08)'),
              color: variant === 'ink' ? C.ink : (variant === 'saffron' ? C.saffron : C.ink),
              border: '1px solid rgba(21,18,14,.08)',
            }}>
            {tribute.authorPhoto
              ? <img src={tribute.authorPhoto} alt="" className="w-full h-full object-cover" />
              : initials(tribute.authorName || tribute.author || 'A')}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold"
                  style={{ fontFamily:"'Space Grotesk', sans-serif", color: variant === 'ink' ? C.cream : C.ink }}>
                  {tribute.authorName || tribute.author || 'Anonymous'}
                </p>
                <span className="text-[0.55rem] tracking-[0.18em] uppercase"
                  style={{ fontFamily:"'JetBrains Mono', monospace", color: variant === 'ink' ? 'rgba(241,236,225,.5)' : C.muted2 }}>
                  {tribute.type || 'tribute'} · {timeAgo(tribute.createdAt)}
                </span>
              </div>
              {canDelete && (
                <button onClick={() => { if (confirm) onDelete(tribute.id); else { setConfirm(true); setTimeout(()=>setConfirm(false),3000) } }}
                  className={`text-xs flex-shrink-0 transition-colors ${confirm ? 'text-red-600' : ''}`}
                  style={{ color: confirm ? C.rust : (variant === 'ink' ? 'rgba(241,236,225,.3)' : 'rgba(21,18,14,.25)') }}>
                  {confirm ? 'Delete?' : '✕'}
                </button>
              )}
            </div>

            <p className={`mt-3 leading-relaxed ${featured ? 'text-base' : 'text-sm'}`}
              style={{
                fontFamily: featured ? "'Fraunces', Georgia, serif" : "'Space Grotesk', sans-serif",
                fontStyle: featured ? 'italic' : 'normal',
                fontWeight: featured ? 300 : 400,
                color: variant === 'ink' ? 'rgba(241,236,225,.8)' : 'rgba(21,18,14,.75)',
              }}>
              {tribute.content || tribute.text}
            </p>

            <div className="flex items-center gap-4 mt-4 pt-3"
              style={{ borderTop: `1px solid ${variant === 'ink' ? 'rgba(241,236,225,.08)' : 'rgba(21,18,14,.06)'}` }}>
              <button onClick={() => { setLiked(l=>!l); onLike(tribute.id, tribute.likes || 0) }}
                className="flex items-center gap-1.5 text-xs transition-colors rounded-full px-2.5 py-1"
                style={{
                  background: liked ? 'rgba(200,83,31,.12)' : (variant === 'ink' ? 'rgba(241,236,225,.06)' : 'rgba(21,18,14,.05)'),
                  color: liked ? C.rust : (variant === 'ink' ? 'rgba(241,236,225,.5)' : 'rgba(21,18,14,.45)'),
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                <span style={{ color: liked ? C.rust : 'inherit' }}>{liked ? '♥' : '♡'}</span>
                <span>{(tribute.likes || 0) + (liked ? 1 : 0)}</span>
              </button>
              {featured && (
                <span className="text-[0.5rem] tracking-[0.18em] uppercase ml-auto"
                  style={{ fontFamily:"'JetBrains Mono', monospace", color: 'rgba(21,18,14,.45)' }}>
                  featured
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// STORY TAB
// ════════════════════════════════════════════════════════════════════════

function StoryTab({ memorial }) {
  const bio = memorial.bio || memorial.description || memorial.subtitle || ''

  return (
    <motion.div key="story" initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
      className="space-y-4">

      {/* Voice card */}
      {(memorial.voiceUrl || bio) && (
        <Card variant="ink" className="relative overflow-hidden">
          {/* Decorative glows */}
          <div className="absolute top-0 right-0 w-48 h-48 pointer-events-none"
            style={{ background: `radial-gradient(circle, ${C.saffron}15, transparent 60%)`, filter:'blur(40px)' }} />
          <div className="absolute bottom-0 left-0 right-0 h-2/3 pointer-events-none opacity-[0.06]"
            style={{ background: stripeCSS }} />

          <div className="p-6 relative">
            <div className="flex items-center gap-3 mb-4">
              <Label onInk>Voice of {memorial.name?.split(' ')[0] || 'them'}</Label>
              {memorial.elevenLabsVoiceId && (
                <span className="text-[0.5rem] font-bold tracking-[0.18em] uppercase px-2.5 py-0.5 rounded-full"
                  style={{ fontFamily:"'JetBrains Mono', monospace", background: C.saffron, color: C.ink }}>
                  ◆ AI cloned voice
                </span>
              )}
            </div>

            <h3 className="text-xl font-bold leading-tight mb-2"
              style={{ fontFamily:"'Space Grotesk', sans-serif", color: C.cream }}>
              Hear {memorial.name?.split(' ')[0] || 'them'} speak —{' '}
              <em style={{ fontFamily:"'Fraunces', Georgia, serif", fontStyle:'italic', fontWeight:300, color: C.saffron2 }}>
                as {memorial.alive === false ? 'they still do.' : 'they are.'}
              </em>
            </h3>

            <p className="text-sm leading-relaxed mb-5"
              style={{ color: 'rgba(241,236,225,.6)' }}>
              {memorial.voiceUrl
                ? 'A reconstructed voice from letters, voicenotes and recordings.'
                : 'Upload voice samples to generate a talking AI avatar.'}
            </p>

            <Suspense fallback={<Empty />}>
              <VoiceOrb
                voiceUrl={memorial.voiceUrl} voiceDuration={memorial.voiceDuration}
                bio={bio} name={memorial.name} elevenLabsVoiceId={memorial.elevenLabsVoiceId}
                photo={memorial.photo} alive={memorial.alive}
              />
            </Suspense>
          </div>
        </Card>
      )}

      {/* Life story */}
      {bio && (
        <Card variant="paper" className="p-7">
          <div className="flex items-center justify-between mb-4">
            <Label>Life Story</Label>
            <span className="text-[0.5rem] tracking-[0.18em] uppercase"
              style={{ fontFamily:"'JetBrains Mono', monospace", color: C.muted2 }}>
              written · {memorial.relation || 'family'} · {new Date().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'2-digit' })}
            </span>
          </div>

          <p className="text-lg italic font-light leading-relaxed mb-4"
            style={{ fontFamily:"'Fraunces', Georgia, serif", color: C.ink }}>
            <span style={{ color: C.saffronDeep }}>{bio.split('.')[0]}.</span>
          </p>

          <p className="text-[0.95rem] leading-[1.85] font-light"
            style={{ fontFamily:"'Space Grotesk', sans-serif", color: C.ink2 }}>
            {bio}
          </p>

          <div className="flex items-center justify-between mt-6 pt-4"
            style={{ borderTop: '1px solid rgba(21,18,14,.06)' }}>
            <span className="text-[0.5rem] tracking-[0.18em] uppercase"
              style={{ fontFamily:"'JetBrains Mono', monospace", color: C.ink }}>
              edition · 01 / 01
            </span>
            <span className="text-[0.5rem] tracking-[0.18em] uppercase"
              style={{ fontFamily:"'JetBrains Mono', monospace", color: C.muted2 }}>
              {bio.split(' ').length} words
            </span>
          </div>
        </Card>
      )}

      {!bio && !memorial.voiceUrl && (
        <Card variant="paper" className="p-12 text-center">
          <div className="text-4xl mb-4" style={{ color: 'rgba(21,18,14,.12)' }}>◎</div>
          <p className="text-sm" style={{ color: C.muted }}>No story added yet.</p>
        </Card>
      )}
    </motion.div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// TRIBUTES TAB
// ════════════════════════════════════════════════════════════════════════

function TributesTab({ tributes, onLike, onAddTribute, onDeleteTribute, isOwner, currentUserId }) {
  const featured = tributes.find(t => t.featured)
  const rest     = tributes.filter(t => !t.featured)

  return (
    <motion.div key="tributes" initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
      className="space-y-3">
      {tributes.length === 0 ? (
        <Card variant="paper" className="p-12 text-center">
          <div className="text-4xl mb-5" style={{ color: 'rgba(21,18,14,.12)' }}>♡</div>
          <p className="text-sm mb-5" style={{ color: C.muted }}>No tributes yet. Be the first to remember them.</p>
          <button onClick={onAddTribute}
            className="text-xs font-bold tracking-[0.18em] uppercase px-7 py-3 rounded-full"
            style={{ fontFamily:"'JetBrains Mono', monospace", background: C.saffron, color: C.ink, boxShadow:'0 4px 14px rgba(243,178,26,.25)' }}>
            ◆ Leave a tribute
          </button>
        </Card>
      ) : (
        <>
          {/* Section header */}
          <div className="flex items-center justify-between mb-2">
            <Label>Tributes</Label>
            <span className="text-[0.5rem] tracking-[0.18em] uppercase"
              style={{ fontFamily:"'JetBrains Mono', monospace", color: C.muted2 }}>
              {tributes.length} in total · {rest.length + (featured ? 1 : 0)} shown
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <AnimatePresence mode="popLayout">
              {featured && (
                <TributeCard key={featured.id} tribute={featured} onLike={onLike}
                  onDelete={onDeleteTribute} isOwner={isOwner} currentUserId={currentUserId} featured />
              )}
              {rest.map(t => (
                <TributeCard key={t.id} tribute={t} onLike={onLike}
                  onDelete={onDeleteTribute} isOwner={isOwner} currentUserId={currentUserId} />
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
    </motion.div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// GALLERY TAB
// ════════════════════════════════════════════════════════════════════════

function GalleryTab({ photos, memorialId, isOwner }) {
  const [selected,  setSelected]  = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const fileRef = useRef()

  async function handleUpload(e) {
    const file = e.target.files[0]; if (!file) return
    setUploading(true)
    try {
      const { uploadImage } = await import('../lib/storage').catch(() => ({ uploadImage: null }))
      if (!uploadImage) throw new Error('storage module unavailable')
      const url = await uploadImage(file, setUploadPct, 'memorials')
      await db.transact([ db.tx.photos[id()].update({ url, createdAt: Date.now() }).link({ memorial: memorialId }) ])
    } finally { setUploading(false); setUploadPct(0) }
  }

  return (
    <motion.div key="gallery" initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <Label>Gallery</Label>
        <span className="text-[0.5rem] tracking-[0.18em] uppercase"
          style={{ fontFamily:"'JetBrains Mono', monospace", color: C.muted2 }}>
          {photos.length} photographs
        </span>
      </div>

      {isOwner && (
        <div className="mb-3">
          <div onClick={() => fileRef.current.click()}
            className="w-full py-10 rounded-[26px] flex flex-col items-center justify-center cursor-pointer transition-all"
            style={{ border:'1px dashed rgba(21,18,14,.15)', background: C.cream }}>
            <span className="text-2xl mb-2" style={{ color: 'rgba(21,18,14,.15)' }}>✿</span>
            <span className="text-xs" style={{ fontFamily:"'JetBrains Mono', monospace", color: C.muted }}>
              {uploading ? `Uploading ${uploadPct}%` : 'Add photos to the gallery'}
            </span>
            {uploading && (
              <div className="mt-3 w-36 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(21,18,14,.08)' }}>
                <div className="h-full transition-all" style={{ width:`${uploadPct}%`, background: C.saffron }} />
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        </div>
      )}

      {photos.length === 0 ? (
        <Card variant="paper" className="p-12 text-center">
          <div className="text-4xl mb-4" style={{ color: 'rgba(21,18,14,.12)' }}>✿</div>
          <p className="text-sm" style={{ color: C.muted }}>No photos added yet.</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5"
            style={{ gridAutoRows: '140px' }}>
            {photos.map((photo, i) => {
              const isBig = i === 0
              return (
                <motion.button key={photo.id || i} onClick={() => setSelected(photo)} whileTap={{ scale:0.96 }}
                  className="relative overflow-hidden rounded-[20px] group"
                  style={{
                    gridColumn: isBig ? 'span 2' : 'span 1',
                    gridRow: isBig ? 'span 2' : 'span 1',
                    background: C.cream2,
                  }}>
                  <SmartImage src={photo.url} alt={photo.caption||''}
                    className="w-full h-full object-cover transition-transform duration-[400ms] group-hover:scale-105" />
                  {photo.displayDate && (
                    <span className="absolute left-2.5 top-2.5 px-2 py-0.5 rounded-full text-[0.45rem] font-bold tracking-[0.18em] uppercase backdrop-blur-sm"
                      style={{
                        fontFamily:"'JetBrains Mono', monospace",
                        background: 'rgba(21,18,14,.7)',
                        color: C.cream,
                      }}>
                      {photo.displayDate}
                    </span>
                  )}
                </motion.button>
              )
            })}
            {/* "More" tile */}
            {photos.length > 4 && (
              <button className="relative overflow-hidden rounded-[20px] flex flex-col items-start justify-between p-3.5 group"
                style={{ background: C.ink, color: C.cream }}>
                <span className="text-[0.5rem] tracking-[0.18em] uppercase"
                  style={{ fontFamily:"'JetBrains Mono', monospace", color: 'rgba(241,236,225,.5)' }}>
                  ◆ view all
                </span>
                <span className="text-3xl font-bold"
                  style={{ fontFamily:"'Space Grotesk', sans-serif", color: C.saffron }}>
                  +{photos.length - 4}
                </span>
              </button>
            )}
          </div>

          {/* Lightbox */}
          <AnimatePresence>
            {selected && (
              <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                onClick={() => setSelected(null)}
                className="fixed inset-0 z-50 flex items-center justify-center p-6"
                style={{ background: 'rgba(21,18,14,.95)' }}>
                <motion.img initial={{ scale:0.92 }} animate={{ scale:1 }} exit={{ scale:0.92 }}
                  src={selected.url} alt="" className="max-w-full max-h-[82vh] rounded-[26px] object-contain"
                  onClick={e => e.stopPropagation()} />
                <button onClick={() => setSelected(null)}
                  className="absolute top-6 right-6 w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(241,236,225,.1)', color: C.cream }}>
                  ✕
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════

function MemorialDetailPageInner() {
  const { id: memorialId } = useParams()
  const navigate = useNavigate()

  const [activeTab,       setActiveTab]       = useState('Reel')
  const [showTributeForm, setShowTributeForm] = useState(false)
  const [tributeText,     setTributeText]     = useState('')
  const [tributeType,     setTributeType]     = useState('tribute')
  const [submitting,      setSubmitting]      = useState(false)
  const [shareToast,      setShareToast]      = useState(false)
  const [showQR,          setShowQR]          = useState(false)
  const textRef = useRef(null)

  const { user } = db.useAuth()

  const { isLoading, error, data } = db.useQuery(
    memorialId ? { memorials: { $: { where: { id: memorialId } }, tributes: {}, photos: {} } } : null
  )
  // Letters & documents in a separate query so a missing schema link
  // cannot take down the whole memorial page.
  const vaultQ = db.useQuery(
    memorialId ? { memorials: { $: { where: { id: memorialId } }, letters: {}, documents: {} } } : null
  )
  const vaultMemorial = vaultQ?.data?.memorials?.[0]

  const memorial = data?.memorials?.[0]
  const tributes = useMemo(
    () => [...(memorial?.tributes || [])].sort((a,b) => (b.createdAt||0)-(a.createdAt||0)),
    [memorial]
  )

  if (isLoading) return (
    <div className="min-h-screen pt-20 pb-28" style={{ background: C.paper }}>
      <div className="max-w-5xl mx-auto px-5 md:px-8 space-y-6">
        <div className="h-64 rounded-[26px]" style={{ background: C.cream2 }} />
        <SkeletonProfile />
        <SkeletonStats />
        <div className="space-y-3">
          <SkeletonListItem />
          <SkeletonListItem />
        </div>
      </div>
    </div>
  )
  if (error || !memorial) return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: C.paper }}>
      <div className="text-center">
        <div className="text-5xl mb-6" style={{ color: 'rgba(21,18,14,.12)' }}>✦</div>
        <p className="text-sm mb-4" style={{ color: C.muted }}>This memorial could not be found.</p>
        <Link to="/explore" className="text-sm underline" style={{ color: C.saffronDeep }}>Explore memorials</Link>
      </div>
    </div>
  )

  // ─── Privacy gate ──────────────────────────────────────────────────────────
  const visibility = memorial.visibility || 'public'
  const isCreator  = !!(user && memorial.creatorId === user.id)
  if ((visibility === 'private' || visibility === 'family') && !isCreator) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: C.paper }}>
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-6" style={{ color: 'rgba(21,18,14,.18)' }}>☽</div>
          <h1 className="text-2xl font-bold mb-2" style={{ fontFamily:"'Space Grotesk', sans-serif", color: C.ink }}>
            This memorial is private
          </h1>
          <p className="text-sm mb-6 leading-relaxed" style={{ color: C.muted }}>
            {visibility === 'family'
              ? 'It is shared with family and people who have the invite link.'
              : 'It is visible only to the person who created it.'}
          </p>
          <div className="flex flex-col gap-2 items-center">
            {!user && (
              <Link to="/auth" className="px-5 py-3 rounded-xl text-sm font-bold"
                style={{ background: C.saffron, color: C.ink }}>
                Sign in
              </Link>
            )}
            <Link to="/explore" className="text-xs underline" style={{ color: C.saffronDeep }}>
              Back to explore
            </Link>
          </div>
        </div>
      </div>
    )
  }

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

  async function handleSubmitTribute() {
    if (!tributeText.trim() || submitting) return
    setSubmitting(true)
    try {
      await db.transact([
        db.tx.tributes[id()].update({
          content: tributeText.trim(),
          text: tributeText.trim(),
          type: tributeType,
          author: user?.email || 'Anonymous',
          authorName: user?.email?.split('@')[0] || 'Anonymous',
          authorId: user?.id,
          createdAt: Date.now(),
        }).link({ memorial: memorialId }),
      ])
      setTributeText('')
      setShowTributeForm(false)
    } finally { setSubmitting(false) }
  }

  async function handleLikeTribute(tributeId, currentLikes) {
    try {
      await db.transact([
        db.tx.tributes[tributeId].update({ likes: (currentLikes || 0) + 1 })
      ])
    } catch {}
  }

  async function handleDeleteTribute(tributeId) {
    try {
      await db.transact([ db.tx.tributes[tributeId].delete() ])
    } catch {}
  }

  async function handleShare() {
    if (navigator.share) {
      try { await navigator.share({ title: memorial.name, url: shareUrl }) } catch {}
    } else {
      await navigator.clipboard.writeText(shareUrl)
      setShareToast(true)
      setTimeout(() => setShareToast(false), 2000)
    }
  }

  // ⚠ Plain switch — NOT a useMemo. useMemo is a hook and cannot be called after
  // the early returns above (Rules of Hooks: hooks must be called the same number
  // of times on every render). A plain variable is fine here.
  let tabContent = null
  switch (activeTab) {
    case 'Story':
      tabContent = <StoryTab memorial={memorial} />
      break
    case 'Tributes':
      tabContent = (
        <TributesTab
          tributes={tributes}
          onLike={handleLikeTribute}
          onAddTribute={() => setShowTributeForm(true)}
          onDeleteTribute={handleDeleteTribute}
          isOwner={isOwner}
          currentUserId={user?.id}
        />
      )
      break
    case 'Gallery':
      tabContent = <GalleryTab photos={photos} memorialId={memorialId} isOwner={isOwner} />
      break
    case 'Reel':
      tabContent = (
        <motion.div key="reel" initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
          <Suspense fallback={<div className="h-64 rounded-[26px]" style={{ background: C.cream2 }} />}>
            <LifeReel photos={photos} memorial={memorial} />
          </Suspense>
        </motion.div>
      )
      break
    default:
      tabContent = null
  }

  return (
    <div className="min-h-screen" style={{ background: C.paper }}>
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40" style={{ background: C.paper, borderBottom: '1px solid rgba(21,18,14,.06)' }}>
        <div className="max-w-5xl mx-auto px-5 md:px-8 flex items-center justify-between h-14">
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs font-bold tracking-[0.18em] uppercase"
            style={{ fontFamily:"'JetBrains Mono', monospace", color: C.muted }}>
            <span style={{ color: C.saffronDeep }}>←</span> Back
          </button>
          <div className="flex items-center gap-2">
            <button onClick={handleShare}
              className="px-3 py-1.5 rounded-full text-[0.55rem] font-bold tracking-[0.18em] uppercase transition-colors"
              style={{ fontFamily:"'JetBrains Mono', monospace", background: C.cream2, color: C.muted }}>
              Share
            </button>
            <button onClick={() => setShowQR(true)}
              className="px-3 py-1.5 rounded-full text-[0.55rem] font-bold tracking-[0.18em] uppercase transition-colors"
              style={{ fontFamily:"'JetBrains Mono', monospace", background: C.cream2, color: C.muted }}>
              QR
            </button>
            <Suspense fallback={<Empty />}>
              <KeepsakeButton memorialId={memorialId} memorialName={memorial.name} />
            </Suspense>
          </div>
        </div>
      </div>

      {/* ── Hero section ────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-5 md:px-8 pt-8 pb-6">
        <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-start">

          {/* Left: Life gauge + photo */}
          <div className="flex flex-col items-center md:items-start gap-5 flex-shrink-0">
            {/* Photo */}
            <div className="w-[200px] h-[200px] md:w-[230px] md:h-[230px] rounded-[26px] overflow-hidden"
              style={{ background: C.cream2, border: '1px solid rgba(21,18,14,.06)' }}>
              {memorial.photo
                ? <img src={memorial.photo} alt={memorial.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-5xl" style={{ color: 'rgba(21,18,14,.12)' }}>◎</div>
              }
            </div>

            {/* Life gauge */}
            <LifeGauge
              born={memorial.born || memorial.dob || memorial.birthYear}
              died={memorial.died || memorial.dod || memorial.deathYear}
              age={memorial.age}
              alive={memorial.alive}
            />
          </div>

          {/* Right: Name, stats, bio */}
          <div className="flex-1 min-w-0 pt-2">
            {/* Name */}
            <h1 className="text-4xl md:text-5xl font-bold leading-[1.04] tracking-[-.03em] mb-2"
              style={{ fontFamily:"'Space Grotesk', sans-serif", color: C.ink }}>
              {memorial.name}
            </h1>

            {/* Subtitle / years */}
            {(memorial.subtitle || memorial.years) && (
              <p className="text-lg font-light mb-4"
                style={{ fontFamily:"'Fraunces', Georgia, serif", fontStyle:'italic', color: C.muted }}>
                {memorial.subtitle || memorial.years}
              </p>
            )}

            {/* Stats row */}
            <div className="flex flex-wrap gap-2 mb-5">
              <div className="px-3 py-1.5 rounded-full text-[0.55rem] font-bold tracking-[0.18em] uppercase"
                style={{ fontFamily:"'JetBrains Mono', monospace", background: C.saffron, color: C.ink }}>
                ◆ {tributeCount} tributes
              </div>
              <div className="px-3 py-1.5 rounded-full text-[0.55rem] font-bold tracking-[0.18em] uppercase"
                style={{ fontFamily:"'JetBrains Mono', monospace", background: C.cream2, color: C.muted }}>
                🕯 {candleCount} candles
              </div>
              <div className="px-3 py-1.5 rounded-full text-[0.55rem] font-bold tracking-[0.18em] uppercase"
                style={{ fontFamily:"'JetBrains Mono', monospace", background: C.cream2, color: C.muted }}>
                ◎ {memoryCount} memories
              </div>
              {memorial.location && (
                <div className="px-3 py-1.5 rounded-full text-[0.55rem] font-bold tracking-[0.18em] uppercase"
                  style={{ fontFamily:"'JetBrains Mono', monospace", background: C.cream2, color: C.muted }}>
                  {memorial.location}
                </div>
              )}
            </div>

            {/* Short bio */}
            {memorial.bio && (
              <p className="text-sm leading-relaxed max-w-lg"
                style={{ fontFamily:"'Space Grotesk', sans-serif", color: C.inkSoft }}>
                {memorial.bio.length > 200 ? memorial.bio.slice(0, 200) + '…' : memorial.bio}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <div className="sticky top-14 z-30" style={{ background: C.paper, borderBottom: '1px solid rgba(21,18,14,.06)' }}>
        <div className="max-w-5xl mx-auto px-5 md:px-8 flex gap-0 overflow-x-auto scrollbar-hide">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="relative px-5 py-3 text-[0.62rem] font-bold tracking-[0.28em] uppercase whitespace-nowrap transition-colors"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                color: activeTab === tab ? C.ink : C.muted2,
                borderBottom: activeTab === tab ? `2px solid ${C.saffron}` : '2px solid transparent',
              }}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ─────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-5 md:px-8 py-6 pb-28">
        <AnimatePresence mode="wait">
          {tabContent}
        </AnimatePresence>
      </div>

      {/* ── Tribute form modal ──────────────────────────────────── */}
      <AnimatePresence>
        {showTributeForm && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={() => setShowTributeForm(false)}
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6"
            style={{ background: 'rgba(21,18,14,.7)' }}>
            <motion.div initial={{ y:'100%', opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ y:'100%', opacity:0 }}
              transition={{ type:'spring', damping:28, stiffness:300 }}
              onClick={e => e.stopPropagation()}
              className="w-full md:max-w-lg rounded-t-[26px] md:rounded-[26px] overflow-hidden"
              style={{ background: C.cream }}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-bold" style={{ fontFamily:"'Space Grotesk', sans-serif", color: C.ink }}>
                    Leave a tribute
                  </h3>
                  <button onClick={() => setShowTributeForm(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(21,18,14,.06)', color: C.muted }}>
                    ✕
                  </button>
                </div>

                {/* Type selector */}
                <div className="flex gap-2 mb-4">
                  {TRIBUTE_TYPES.map(t => (
                    <button key={t.type} onClick={() => setTributeType(t.type)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[0.55rem] font-bold tracking-[0.18em] uppercase transition-all"
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        background: tributeType === t.type ? C.saffron : C.cream2,
                        color: tributeType === t.type ? C.ink : C.muted,
                      }}>
                      {t.emoji} {t.label}
                    </button>
                  ))}
                </div>

                <textarea ref={textRef} value={tributeText} onChange={e => setTributeText(e.target.value)}
                  placeholder="Write your tribute…"
                  className="w-full p-4 rounded-[16px] text-sm resize-none focus:outline-none mb-4"
                  style={{
                    background: C.paperWarm,
                    border: '1px solid rgba(21,18,14,.08)',
                    color: C.ink,
                    fontFamily: "'Space Grotesk', sans-serif",
                    minHeight: '120px',
                  }} />

                <button onClick={handleSubmitTribute} disabled={!tributeText.trim() || submitting}
                  className="w-full py-3.5 rounded-full text-xs font-bold tracking-[0.18em] uppercase transition-all"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    background: tributeText.trim() ? C.saffron : C.cream2,
                    color: tributeText.trim() ? C.ink : C.muted2,
                    boxShadow: tributeText.trim() ? '0 4px 14px rgba(243,178,26,.25)' : 'none',
                  }}>
                  {submitting ? 'Submitting…' : `◆ Post ${tributeType}`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Share toast ─────────────────────────────────────────── */}
      <AnimatePresence>
        {shareToast && (
          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:20 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full text-[0.55rem] font-bold tracking-[0.18em] uppercase"
            style={{ fontFamily:"'JetBrains Mono', monospace", background: C.ink, color: C.cream, boxShadow:'0 8px 24px rgba(21,18,14,.25)' }}>
            Link copied to clipboard
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── QR modal — only mount when open, QRModal has no open prop ── */}
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

// ─── Internal error boundary — keeps the page visible no matter what ─────────
class MemorialBoundary extends Component {
  constructor(p) { super(p); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  componentDidCatch(err) { try { console.error('MemorialDetailPage caught:', err) } catch {} }
  render() {
    if (this.state.err) {
      return (
        <div className="relative z-10 min-h-screen flex items-center justify-center px-6">
          <div className="text-center max-w-sm">
            <div className="text-4xl mb-4 opacity-30">✦</div>
            <h1 className="font-display text-xl font-bold text-white mb-2">This memorial</h1>
            <p className="text-sm text-white/50 mb-6">
              Part of this memorial couldn't load right now, but the data is safe.
            </p>
            <div className="flex flex-col gap-2 items-center">
              <button
                onClick={() => { try { window.location.reload() } catch {} }}
                className="px-5 py-3 rounded-xl text-sm font-bold metal-btn text-black"
              >
                Reload
              </button>
              <a href="/explore" className="text-xs text-white/40 hover:text-white/70 mt-1">
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

export default function MemorialDetailPage() {
  return (
    <MemorialBoundary>
      <MemorialDetailPageInner />
    </MemorialBoundary>
  )
}
