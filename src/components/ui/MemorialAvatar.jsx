// src/components/ui/MemorialAvatar.jsx
// World-class memorial avatar component.
//
// Features:
//   • Photo: perfect circle with subtle vignette and shine
//   • Monogram fallback: glass-morphism, oversized Cormorant letter, noise grain
//   • Alive/deceased visual state: green glow vs amber glow on rings
//   • Two animated pulsing halos (different speeds/opacity)
//   • Status dot (bottom-right corner)
//   • Cinematic entrance animation (scale + blur→clear)
//   • Four size variants: sm / md / lg / xl
//
// Usage:
//   <MemorialAvatar photo={memorial.photo} name={memorial.name} alive={memorial.alive} size="lg" />

import { motion } from 'framer-motion'

const SIZES = {
  sm: { wrap: 44,  letter: 'text-xl',   ring1: 48,  ring2: 54  },
  md: { wrap: 72,  letter: 'text-4xl',  ring1: 78,  ring2: 88  },
  lg: { wrap: 96,  letter: 'text-5xl',  ring1: 104, ring2: 118 },
  xl: { wrap: 128, letter: 'text-7xl',  ring1: 140, ring2: 160 },
}

// Alive = green, deceased = warm amber
const COLORS = {
  alive: {
    ring1:  'rgba(74,170,74,0.55)',
    ring2:  'rgba(74,170,74,0.18)',
    glow:   '0 0 32px rgba(74,170,74,0.35), 0 0 64px rgba(74,170,74,0.12)',
    dot:    '#4aaa4a',
    border: 'rgba(74,170,74,0.50)',
    monoBg: 'rgba(20,45,20,0.80)',
    monoLetter: '#90d890',
  },
  dead: {
    ring1:  'rgba(200,160,30,0.55)',
    ring2:  'rgba(200,160,30,0.18)',
    glow:   '0 0 32px rgba(200,160,30,0.30), 0 0 64px rgba(200,160,30,0.10)',
    dot:    '#c8a020',
    border: 'rgba(200,160,30,0.45)',
    monoBg: 'rgba(40,30,4,0.80)',
    monoLetter: '#d4b840',
  },
}

export default function MemorialAvatar({
  photo,
  name     = '',
  alive    = true,
  size     = 'lg',
  animate  = true,
  className = '',
}) {
  const dim   = SIZES[size] || SIZES.lg
  const C     = alive ? COLORS.alive : COLORS.dead
  const w     = dim.wrap
  const first = (name || '?').charAt(0).toUpperCase()

  // Container is sized to fit the outermost ring
  const outerSize = dim.ring2

  const wrapStyle = {
    width:    outerSize,
    height:   outerSize,
    position: 'relative',
    display:  'flex',
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink: 0,
  }

  const circleStyle = {
    width:        w,
    height:       w,
    borderRadius: '50%',
    overflow:     'hidden',
    position:     'relative',
    border:       `1.5px solid ${C.border}`,
    boxShadow:    C.glow,
    flexShrink:   0,
  }

  const motionProps = animate
    ? {
        initial:    { scale: 0.65, opacity: 0, filter: 'blur(8px)' },
        animate:    { scale: 1,    opacity: 1, filter: 'blur(0px)' },
        transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
      }
    : {}

  return (
    <motion.div {...motionProps} style={wrapStyle} className={className}>

      {/* ── Outer halo ring (slow pulse) ─────────────────────────────── */}
      <motion.div
        animate={{ scale: [1, 1.06, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position:     'absolute',
          width:        dim.ring2,
          height:       dim.ring2,
          borderRadius: '50%',
          border:       `1px solid ${C.ring2}`,
          pointerEvents: 'none',
        }}
      />

      {/* ── Inner halo ring (faster pulse, offset phase) ──────────────── */}
      <motion.div
        animate={{ scale: [1, 1.04, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
        style={{
          position:     'absolute',
          width:        dim.ring1,
          height:       dim.ring1,
          borderRadius: '50%',
          border:       `1px solid ${C.ring1}`,
          pointerEvents: 'none',
        }}
      />

      {/* ── Avatar circle ─────────────────────────────────────────────── */}
      <div style={circleStyle}>
        {photo ? (
          <>
            {/* Photo */}
            <img
              src={photo}
              alt={name}
              style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
            />
            {/* Subtle vignette over photo */}
            <div style={{
              position:     'absolute',
              inset:        0,
              borderRadius: '50%',
              background:   'radial-gradient(circle at center, transparent 60%, rgba(0,0,0,0.35) 100%)',
              pointerEvents: 'none',
            }} />
            {/* Shine highlight top-left */}
            <div style={{
              position:     'absolute',
              top:          '8%',
              left:         '10%',
              width:        '32%',
              height:       '18%',
              borderRadius: '50%',
              background:   'radial-gradient(ellipse at center, rgba(255,255,255,0.18) 0%, transparent 100%)',
              transform:    'rotate(-30deg)',
              pointerEvents: 'none',
            }} />
          </>
        ) : (
          <>
            {/* Glass monogram background */}
            <div style={{
              position:   'absolute',
              inset:      0,
              background: C.monoBg,
              backdropFilter: 'blur(12px)',
            }} />

            {/* Subtle grain texture via SVG filter (no image needed) */}
            <svg width="0" height="0" style={{ position:'absolute' }}>
              <filter id="memorial-grain">
                <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch" />
                <feColorMatrix type="saturate" values="0" />
                <feBlend in="SourceGraphic" mode="overlay" result="blend" />
                <feComposite in="blend" in2="SourceGraphic" />
              </filter>
            </svg>
            <div style={{
              position: 'absolute',
              inset:    0,
              opacity:  0.06,
              filter:   'url(#memorial-grain)',
              background: '#fff',
            }} />

            {/* Radial gradient depth */}
            <div style={{
              position:   'absolute',
              inset:      0,
              background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.07) 0%, transparent 65%)',
              pointerEvents: 'none',
            }} />

            {/* The letter */}
            <div style={{
              position:       'absolute',
              inset:          0,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              fontFamily:     "'Cormorant Garamond', Georgia, serif",
              fontWeight:     700,
              color:          C.monoLetter,
              lineHeight:     1,
              userSelect:     'none',
              // Letter is 68% of the circle diameter
              fontSize:       `${Math.round(w * 0.68)}px`,
              // Subtle text shadow for depth
              textShadow:     `0 2px 12px ${C.ring1}`,
            }}>
              {first}
            </div>

            {/* Shine highlight */}
            <div style={{
              position:     'absolute',
              top:          '8%',
              left:         '12%',
              width:        '30%',
              height:       '16%',
              borderRadius: '50%',
              background:   'radial-gradient(ellipse, rgba(255,255,255,0.20) 0%, transparent 100%)',
              transform:    'rotate(-25deg)',
              pointerEvents: 'none',
            }} />
          </>
        )}
      </div>

      {/* ── Status dot (bottom-right corner of the circle) ─────────────── */}
      {size !== 'sm' && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.4, type: 'spring', stiffness: 300 }}
          style={{
            position:     'absolute',
            bottom:       `${Math.round((outerSize - w) / 2) + 2}px`,
            right:        `${Math.round((outerSize - w) / 2) + 2}px`,
            width:        size === 'xl' ? 16 : 12,
            height:       size === 'xl' ? 16 : 12,
            borderRadius: '50%',
            background:   C.dot,
            border:       '2px solid #000',
            boxShadow:    `0 0 8px ${C.dot}`,
            zIndex:       10,
          }}
        />
      )}

    </motion.div>
  )
}
