// src/components/ui/VoiceOrb.jsx — v3 "Speaking Portrait"
//
// The signature visual element of WHO WAS I.
// Renders a circular portrait that pulses with the rhythm of the person's
// voice — either a pre-recorded audio file or real-time ElevenLabs TTS.
//
// Props:
//   voiceUrl          — pre-recorded audio URL (optional)
//   voiceDuration     — duration in seconds (optional)
//   bio               — full bio text for TTS fallback
//   name              — person's name (for display)
//   elevenLabsVoiceId — ElevenLabs voice ID for TTS (optional)
//   photo             — portrait photo URL (optional — shows gradient fallback)
//   alive             — whether the person is still living (affects visual style)

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { generateSpeech } from '../../lib/elevenlabs'

// ─── Canvas waveform renderer ─────────────────────────────────────────────────

function drawFrame({ canvas, analyser, playing, mode }) {
  if (!canvas) return
  const ctx  = canvas.getContext('2d')
  const W    = canvas.width
  const H    = canvas.height
  const cx   = W / 2
  const cy   = H / 2

  ctx.clearRect(0, 0, W, H)

  const BARS    = 72
  const INNER_R = 66
  const MAX_H   = 44

  const freq = new Uint8Array(analyser.frequencyBinCount)
  analyser.getByteFrequencyData(freq)

  // Average into bands
  const bands = []
  for (let i = 0; i < BARS; i++) {
    const start = Math.floor((i / BARS) * freq.length)
    const end   = Math.floor(((i + 1) / BARS) * freq.length)
    let sum = 0
    for (let j = start; j < end; j++) sum += freq[j]
    bands.push(sum / (end - start))
  }

  const angleStep = (Math.PI * 2) / BARS

  // ── Draw bars ──────────────────────────────────────────────────────────
  for (let i = 0; i < BARS; i++) {
    const angle = -Math.PI / 2 + i * angleStep
    const raw   = bands[i] / 255
    const h     = playing ? raw * MAX_H : 1.5
    const r1    = INNER_R
    const r2    = INNER_R + h

    const x1 = cx + Math.cos(angle) * r1
    const y1 = cy + Math.sin(angle) * r1
    const x2 = cx + Math.cos(angle) * r2
    const y2 = cy + Math.sin(angle) * r2

    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.strokeStyle = playing
      ? `rgba(255, 215, 0, ${0.25 + raw * 0.55})`
      : 'rgba(255, 255, 255, 0.06)'
    ctx.lineWidth = 2.5
    ctx.lineCap  = 'round'
    ctx.stroke()
  }

  // ── Inner glow ring ────────────────────────────────────────────────────
  if (playing) {
    const grad = ctx.createRadialGradient(cx, cy, INNER_R - 6, cx, cy, INNER_R + 4)
    grad.addColorStop(0, 'rgba(255, 215, 0, 0)')
    grad.addColorStop(0.5, 'rgba(255, 215, 0, 0.08)')
    grad.addColorStop(1, 'rgba(255, 215, 0, 0)')
    ctx.beginPath()
    ctx.arc(cx, cy, INNER_R + 4, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()
  }
}

// ─── Audio manager ────────────────────────────────────────────────────────────

function useAudioEngine({ voiceUrl, voiceDuration, bio, elevenLabsVoiceId, onStateChange }) {
  const ctxRef     = useRef(null)
  const srcRef     = useRef(null)
  const analyserRef = useRef(null)
  const gainRef    = useRef(null)
  const animRef    = useRef(null)
  const audioRef   = useRef(null)

  const [state, setState] = useState('idle') // idle | loading | playing | paused
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(voiceDuration || 0)

  const updateState = useCallback(s => { setState(s); onStateChange?.(s) }, [onStateChange])

  // Cleanup
  const stop = useCallback(() => {
    if (animRef.current)  { cancelAnimationFrame(animRef.current); animRef.current = null }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    if (srcRef.current)   { srcRef.current.disconnect(); srcRef.current = null }
    if (ctxRef.current?.state !== 'closed') ctxRef.current?.close()
    ctxRef.current = null
    setProgress(0)
    updateState('idle')
  }, [updateState])

  useEffect(() => () => stop(), [stop])

  // ── Play from URL ──────────────────────────────────────────────────────
  const playUrl = useCallback(async (url) => {
    stop()
    updateState('loading')

    try {
      const audio   = new Audio(url)
      audioRef.current = audio
      const ctx     = new AudioContext()
      ctxRef.current = ctx
      const src     = ctx.createMediaElementSource(audio)
      srcRef.current = src
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser
      const gain    = ctx.createGain()
      gainRef.current = gain
      gain.gain.value = 0.7

      src.connect(analyser)
      analyser.connect(gain)
      gain.connect(ctx.destination)

      audio.onloadedmetadata = () => setDuration(audio.duration || voiceDuration || 0)
      audio.onended = () => { stop(); updateState('idle') }
      audio.onerror = () => { stop(); updateState('idle') }

      await audio.play()
      updateState('playing')

      // Animation loop
      function frame() {
        if (analyserRef.current) drawFrame({
          canvas: document.getElementById('voice-orb-canvas'),
          analyser: analyserRef.current,
          playing: true,
          mode: 'bars',
        })
        animRef.current = requestAnimationFrame(frame)
      }
      frame()

      // Progress tracking
      const progInterval = setInterval(() => {
        if (audioRef.current && !audioRef.current.paused) {
          setProgress(audioRef.current.currentTime / (audioRef.current.duration || 1))
        }
      }, 100)
      audio.addEventListener('ended', () => clearInterval(progInterval))
    } catch {
      updateState('idle')
    }
  }, [stop, voiceDuration, updateState])

  // ── Play TTS ───────────────────────────────────────────────────────────
  const playTts = useCallback(async (text) => {
    stop()
    updateState('loading')

    try {
      const blob = await generateSpeech(elevenLabsVoiceId, text)
      if (!blob) { updateState('idle'); return }

      const url  = URL.createObjectURL(blob)
      await playUrl(url)
    } catch {
      updateState('idle')
    }
  }, [stop, elevenLabsVoiceId, playUrl, updateState])

  // ── Toggle play/pause ──────────────────────────────────────────────────
  const toggle = useCallback(() => {
    if (state === 'playing') {
      audioRef.current?.pause()
      updateState('paused')
      if (animRef.current) cancelAnimationFrame(animRef.current)
    } else if (state === 'paused') {
      audioRef.current?.play()
      updateState('playing')
      // Resume animation
      function frame() {
        if (analyserRef.current) drawFrame({
          canvas: document.getElementById('voice-orb-canvas'),
          analyser: analyserRef.current,
          playing: true,
          mode: 'bars',
        })
        animRef.current = requestAnimationFrame(frame)
      }
      frame()
    } else if (state === 'idle') {
      if (voiceUrl) playUrl(voiceUrl)
      else if (elevenLabsVoiceId && bio) playTts(bio)
    }
  }, [state, voiceUrl, bio, elevenLabsVoiceId, playUrl, playTts, updateState])

  return { state, progress, duration, toggle, stop }
}

// ─── VoiceOrb component ───────────────────────────────────────────────────────

export default function VoiceOrb({ voiceUrl, voiceDuration, bio, name, elevenLabsVoiceId, photo, alive }) {
  const canvasRef = useRef(null)
  const [idleAnim, setIdleAnim] = useState(true)

  const onStateChange = useCallback(s => {
    setIdleAnim(s === 'idle')
  }, [])

  const { state, progress, duration, toggle, stop } = useAudioEngine({
    voiceUrl,
    voiceDuration,
    bio,
    elevenLabsVoiceId,
    onStateChange,
  })

  const isActive = state === 'playing' || state === 'loading'
  const firstName = name?.split(' ')[0] || 'them'

  // ── Idle canvas animation ──────────────────────────────────────────────
  useEffect(() => {
    if (!idleAnim || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    const W      = canvas.width
    const H      = canvas.height
    const cx     = W / 2
    const cy     = H / 2
    let frame

    function draw() {
      ctx.clearRect(0, 0, W, H)
      const BARS    = 72
      const INNER_R = 66
      const MAX_H   = 44
      const angleStep = (Math.PI * 2) / BARS
      const t = Date.now() / 1000

      for (let i = 0; i < BARS; i++) {
        const angle = -Math.PI / 2 + i * angleStep
        const wave  = Math.sin(t * 0.6 + i * 0.25) * 0.3 + 0.5
        const h     = wave * 2.5
        const r1    = INNER_R
        const r2    = INNER_R + h

        const x1 = cx + Math.cos(angle) * r1
        const y1 = cy + Math.sin(angle) * r1
        const x2 = cx + Math.cos(angle) * r2
        const y2 = cy + Math.sin(angle) * r2

        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.strokeStyle = `rgba(255, 215, 0, ${0.04 + wave * 0.06})`
        ctx.lineWidth = 2.5
        ctx.lineCap  = 'round'
        ctx.stroke()
      }

      frame = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [idleAnim])

  // ── Canvas sizing ──────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const size = canvas.parentElement?.offsetWidth || 280
    const dpr  = window.devicePixelRatio || 1
    canvas.width  = size * dpr
    canvas.height = size * dpr
    canvas.style.width  = size + 'px'
    canvas.style.height = size + 'px'
    canvas.getContext('2d').scale(dpr, dpr)
  }, [])

  // ── Format time ────────────────────────────────────────────────────────
  function fmt(s) {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const hasVoice = !!(voiceUrl || (elevenLabsVoiceId && bio))

  return (
    <div className="dark-container flex flex-col items-center gap-4 select-none">

      {/* ── Orb ─────────────────────────────────────────────────────────── */}
      <div className="relative" style={{ width: 280, height: 280 }}>

        {/* Outer glow rings */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0"
            >
              {[1, 2, 3].map(i => (
                <motion.div
                  key={i}
                  animate={{
                    scale: [1, 1.08 + i * 0.04, 1],
                    opacity: [0.3, 0.6 - i * 0.1, 0.3],
                  }}
                  transition={{ duration: 2 + i * 0.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}
                  className="absolute inset-0 rounded-full border border-gold/20"
                  style={{ margin: -(i * 10) }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main circle */}
        <div className="relative w-full h-full rounded-full overflow-hidden bg-gradient-to-br from-stone-900 to-stone-950 border border-white/10 shadow-2xl shadow-black/60">

          {/* Portrait photo */}
          {photo && (
            <img
              src={photo}
              alt={name}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: isActive ? 'brightness(0.7) saturate(1.1)' : 'brightness(0.85) saturate(0.9)' }}
            />
          )}

          {/* Gradient overlay */}
          <div className={`absolute inset-0 transition-opacity duration-700 ${
            photo
              ? 'bg-gradient-to-br from-black/40 via-transparent to-black/60'
              : `bg-gradient-to-br ${alive ? 'from-mint/20 via-transparent to-sky/20' : 'from-gold/15 via-transparent to-coral/15'}`
          }`} />

          {/* Scan lines overlay (only when playing) */}
          <AnimatePresence>
            {isActive && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,215,0,0.03) 2px, rgba(255,215,0,0.03) 4px)',
                  backgroundSize: '100% 4px',
                  animation: 'scanMove 0.8s linear infinite',
                }}
              />
            )}
          </AnimatePresence>

          {/* Canvas (waveform) */}
          <canvas
            id="voice-orb-canvas"
            ref={canvasRef}
            className="absolute inset-0 w-full h-full z-10 pointer-events-none"
          />

          {/* Center content */}
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
            {/* Initial */}
            <span className={`font-display font-bold transition-all duration-500 ${
              photo ? 'text-[clamp(2rem,6vw,3rem)] text-white/80 drop-shadow-lg' : 'text-[clamp(2.5rem,7vw,3.5rem)] text-white/60'
            }`}>
              {name?.charAt(0) || '?'}
            </span>

            {/* Status text */}
            <AnimatePresence mode="wait">
              {state === 'loading' && (
                <motion.span key="loading" initial={{ opacity:0,y:4 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-4 }}
                  className="text-[0.55rem] font-bold tracking-widest uppercase text-gold/60 mt-2">
                  Loading voice...
                </motion.span>
              )}
              {state === 'playing' && (
                <motion.span key="playing" initial={{ opacity:0,y:4 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-4 }}
                  className="text-[0.5rem] font-bold tracking-widest uppercase text-gold/50 mt-2">
                  {fmt(progress * duration)} / {fmt(duration)}
                </motion.span>
              )}
              {state === 'paused' && (
                <motion.span key="paused" initial={{ opacity:0,y:4 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-4 }}
                  className="text-[0.5rem] font-bold tracking-widest uppercase text-white/30 mt-2">
                  Paused
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Progress ring */}
          {state === 'playing' && (
            <svg className="absolute inset-0 w-full h-full -rotate-90 z-30 pointer-events-none" viewBox="0 0 280 280">
              <circle cx="140" cy="140" r="130" fill="none" stroke="rgba(255,215,0,0.15)" strokeWidth="1.5" />
              <motion.circle
                cx="140" cy="140" r="130" fill="none" stroke="url(#goldGrad)" strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={`${progress * 816.8} 816.8`}
              />
              <defs>
                <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#FFD700" />
                  <stop offset="100%" stopColor="#38BDF8" />
                </linearGradient>
              </defs>
            </svg>
          )}
        </div>
      </div>

      {/* ── Play button ─────────────────────────────────────────────────── */}
      {hasVoice && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={toggle}
          className={`relative flex items-center gap-3 px-6 py-3 rounded-full text-sm font-semibold transition-all ${
            isActive
              ? 'bg-gradient-to-r from-gold/20 to-coral/20 border border-gold/30 text-gold'
              : 'glass border border-white/10 text-white/70 hover:text-white hover:border-white/20'
          }`}
        >
          {/* Pulsing dot */}
          {isActive && (
            <motion.span
              animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-gold"
            />
          )}

          <span>
            {state === 'loading' ? 'Loading...' :
             state === 'playing'  ? 'Pause' :
             state === 'paused'   ? 'Resume' :
             voiceUrl             ? `Hear ${firstName}'s voice` :
                                    `Speak to ${firstName}`}
          </span>

          {!isActive && (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4.5L20 12L6 19.5V4.5Z" />
            </svg>
          )}
        </motion.button>
      )}

      {/* ── Voice attribution ───────────────────────────────────────────── */}
      {elevenLabsVoiceId && (
        <p className="text-[0.5rem] text-white/15 tracking-wider uppercase">
          AI-cloned voice · ElevenLabs
        </p>
      )}
    </div>
  )
}
