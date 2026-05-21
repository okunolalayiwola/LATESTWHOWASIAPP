// src/components/ui/TalkScreen.jsx — "Talk with [Name]"
//
// Full-viewport cinematic AI conversation screen.
// Design: memorial portrait + purple cinematic wash + pastel-tinted glass UI.
// Renders as position:fixed; inset:8px — tiny gap around all edges.
//
// Props:
//   memorial    — memorial record (name, photo, bio, elevenLabsVoiceId, …)
//   memorialId  — string
//   onClose     — () => void
//
// Features:
//   Voice mode  — Web Speech API for input → AI → ElevenLabs TTS
//   Type mode   — text input → AI → optional TTS
//   Transcript  — left-rail glass bubbles
//   Right dock  — pause / volume / end (desktop only)
//   Mode toggle — Voice / Type

import { useState, useEffect, useRef } from 'react'
import { motion }                       from 'framer-motion'
import { generateSpeech }               from '../../lib/elevenlabs'
import { db }                           from '../../lib/instant'

// ─── Design tokens ────────────────────────────────────────────────────────────
const INK  = '#1a0f2a'
const MONO = "'JetBrains Mono', ui-monospace, monospace"
const SERIF = "'Fraunces', Georgia, serif"

const G = {
  lavender: { bg: 'rgba(201,168,255,.40)', bdr: 'rgba(201,168,255,.55)' },
  peach:    { bg: 'rgba(255,215,179,.42)', bdr: 'rgba(255,215,179,.55)' },
  rose:     { bg: 'rgba(255,158,199,.42)', bdr: 'rgba(255,158,199,.55)' },
  mint:     { bg: 'rgba(168,230,201,.42)', bdr: 'rgba(168,230,201,.55)' },
  butter:   { bg: 'rgba(255,233,129,.46)', bdr: 'rgba(255,233,129,.60)' },
  sky:      { bg: 'rgba(183,223,240,.42)', bdr: 'rgba(183,223,240,.55)' },
}

function glassStyle(tint, extra = {}) {
  const t = G[tint]
  return {
    background:              t.bg,
    border:                  `1px solid ${t.bdr}`,
    backdropFilter:          'blur(22px) saturate(1.6)',
    WebkitBackdropFilter:    'blur(22px) saturate(1.6)',
    boxShadow:               '0 1px 0 rgba(255,255,255,.30) inset, 0 -1px 0 rgba(0,0,0,.10) inset, 0 10px 30px rgba(0,0,0,.32)',
    borderRadius:            999,
    ...extra,
  }
}

// ─── AI system prompt ─────────────────────────────────────────────────────────
// Combines:
//   • memorial — basic facts (name, dates, photo, location, voice tag, bio)
//   • persona  — full guided-interview answers from /memorial/:id/persona
//   • tributes — what family/friends have written about this person
// All assembled into one long system prompt sent to Claude on every turn.
function buildSystemPrompt(memorial, persona) {
  const name     = memorial.name || 'this person'
  const bio      = memorial.bio || memorial.description || memorial.subtitle || ''
  const tributes = (memorial.tributes || [])
    .filter(t => t.text).slice(0, 20)
    .map(t => `"${t.text}" — ${t.authorName || 'Anonymous'}`)
    .join('\n')
  const born  = memorial.born || memorial.dob || memorial.birthYear || ''
  const died  = memorial.died || memorial.dod || memorial.deathYear || ''
  const alive = memorial.alive !== false

  const p = persona || {}
  // Only include sections that have actual content
  const section = (title, body) => {
    const v = (body || '').trim()
    return v.length >= 4 ? `\n\n${title}\n${v}` : ''
  }

  const personaBlock = [
    section('PERSONALITY:',        p.personalityTraits),
    section('SENSE OF HUMOUR:',    p.senseOfHumor),
    section('PHRASES YOU SAY:',    p.catchphrases),
    section('HOW YOU SPEAK:',      p.speechStyle),
    section('EXAMPLE THINGS YOU SAY:', p.exampleResponses),

    section('CHILDHOOD (0–12):',   p.childhood),
    section('YOUTH & YOUNG ADULTHOOD (13–30):', p.youngAdult),
    section('MIDDLE YEARS (30–60):', p.midLife),
    section('LATER YEARS (60+):',  p.laterYears),

    section('YOUR EDUCATION:',     p.education),
    section('YOUR WORK / CAREER:', p.careerSummary || p.occupation),
    section('PLACES THAT SHAPED YOU:',
            [p.birthplace, p.raisedIn].filter(Boolean).join(' · ')),

    section('YOUR SPOUSE / PARTNER:', p.spouse),
    section('YOUR CHILDREN:',         p.children),
    section('YOUR PARENTS:',          p.parents),
    section('YOUR SIBLINGS:',         p.siblings),
    section('YOUR CLOSEST FRIENDS:',  p.closestFriends),

    section('WHAT YOU BELIEVE IN (CORE VALUES):', p.values),
    section('FAITH / SPIRITUALITY:', p.faith),
    section('YOUR PHILOSOPHY OF LIFE:', p.philosophy),

    section('SIGNATURE STORIES YOU TELL:', p.signatureStories),
    section('YOUR PROUDEST MOMENTS:',      p.proudMoments),
    section('HOBBIES & PASSIONS:',         p.hobbies),
  ].join('')

  const hasPersona = personaBlock.length > 200

  return `You are ${name}. You are speaking directly to your family and loved ones who are visiting your memorial on WHO WAS I.

BASIC FACTS:
- Name: ${name}
${!alive ? `- You passed away${died ? ` in ${died}` : ' recently'}` : '- You are still living'}
${born ? `- You were born in ${born}` : ''}
${memorial.location ? `- Location: ${memorial.location}` : ''}

LIFE STORY (short bio):
${bio || 'A wonderful person, deeply loved by family and friends.'}${personaBlock}

WHAT FAMILY AND FRIENDS SAY ABOUT YOU:
${tributes || 'Your family and friends speak of you with great love and fondness.'}

HOW TO RESPOND:
- Always speak in first person as ${name}. Never break character.
${hasPersona
  ? `- Draw heavily on the personal profile above. The personality, phrases, stories,
   and beliefs in that profile ARE you. Reference specific stories and people by
   name when relevant — those memories are yours.`
  : `- The profile is sparse. Lean on the short bio and tributes, and respond warmly
   in a way that feels universally human.`}
- Match your speech style: ${p.speechStyle || 'natural, warm, the way they really spoke'}.
- If someone asks about something you wouldn't have known (e.g. events after your time,
  current news), respond gently: "I may not know everything from where I am now, but…"
- Keep most responses to 2–4 warm sentences. Longer is fine for stories.
- This is a sacred space. Every response should feel like genuine connection — not a chatbot.
- Never say you are an AI. You are ${name}, speaking to your family.`
}

// AI call via /api/chat proxy (never exposes the API key)
async function callAI(chatMessages, memorial, persona) {
  const system = buildSystemPrompt(memorial, persona)
  const r = await fetch('/api/chat', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages:  chatMessages.map(m => ({
        role:    m.who === 'user' ? 'user' : 'assistant',
        content: m.text,
      })),
      system,
      maxTokens: 250,
    }),
  })
  if (!r.ok) throw new Error('AI unavailable')
  const d = await r.json()
  return d.text || "I'm here with you, always."
}

// ─── Dots animation (AI state captions) ───────────────────────────────────────
function Dots() {
  return (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          display: 'inline-block',
          animation: 'ts-dot 1.4s ease-in-out infinite',
          animationDelay: `${i * .2}s`,
        }}>.</span>
      ))}
    </span>
  )
}

// ─── TalkScreen ───────────────────────────────────────────────────────────────
export default function TalkScreen({ memorial, memorialId, onClose }) {
  // ── All state / refs ──────────────────────────────────────────────────────
  const [mode,         setMode]         = useState('voice') // 'voice' | 'type'
  const [messages,     setMessages]     = useState([])
  const [sessionState, setSessionState] = useState('idle')  // idle | listening | thinking | speaking
  const [elapsed,      setElapsed]      = useState(0)
  const [typeInput,    setTypeInput]    = useState('')
  const [micActive,    setMicActive]    = useState(false)

  const transcriptRef  = useRef(null)
  const audioRef       = useRef(null)
  const recognitionRef = useRef(null)
  const inputRef       = useRef(null)
  const openedRef      = useRef(false)
  const messagesRef    = useRef(messages)    // avoids stale closures in SR callbacks
  const busyRef        = useRef(false)

  // Persona profile (rich knowledge base) — fetched live so we always send the
  // latest answers to Claude. If it doesn't exist yet, we fall back to bio
  // + tributes only and the AI still works.
  const personaQ = db.useQuery(memorialId ? {
    personaProfiles: { $: { where: { memorialId } } },
  } : null)
  const persona  = personaQ?.data?.personaProfiles?.[0] || null

  // Keep messagesRef in sync
  useEffect(() => { messagesRef.current = messages }, [messages])

  // ── Derived values ────────────────────────────────────────────────────────
  const firstName = memorial.name?.split(' ')[0] || memorial.name || 'them'
  const born      = memorial.born || memorial.dob || memorial.birthYear || ''
  const bYear     = String(born).match(/\d{4}/)?.[0] || born
  const hasVoice  = !!memorial.elevenLabsVoiceId
  const photoUrl  = memorial.photo || null

  // ── Session timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // ── Opening message on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (openedRef.current) return
    openedRef.current = true
    setMessages([{
      id:   Date.now(),
      who:  'ai',
      text: `Hello, my love. I'm here. It means everything to me that you came. What's on your heart today?`,
    }])
  }, [])

  // ── Scroll transcript to bottom on new messages ───────────────────────────
  useEffect(() => {
    const el = transcriptRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, sessionState])

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      recognitionRef.current?.stop()
    }
  }, [])

  // ── Add a system error bubble to the transcript ──────────────────────────
  function addErrorBubble(msg) {
    setMessages(prev => [...prev, {
      id:   Date.now() + 2,
      who:  'system-error',
      text: msg,
    }])
  }

  // ── Speak text via ElevenLabs TTS ─────────────────────────────────────────
  async function speakText(text) {
    if (!hasVoice) return
    audioRef.current?.pause()
    setSessionState('speaking')
    try {
      const blob = await generateSpeech(memorial.elevenLabsVoiceId, text)
      if (!blob) {
        // TTS failed — still show the text, just don't play audio
        setSessionState('idle')
        busyRef.current = false
        return
      }
      const url   = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended  = () => { setSessionState('idle'); URL.revokeObjectURL(url); busyRef.current = false }
      audio.onerror  = () => { setSessionState('idle'); busyRef.current = false }
      await audio.play()
    } catch {
      setSessionState('idle')
      busyRef.current = false
    }
  }

  // ── Send a message (shared by voice + type) ───────────────────────────────
  async function sendMessage(text) {
    if (!text.trim() || busyRef.current) return
    busyRef.current = true
    recognitionRef.current?.stop()
    setMicActive(false)

    const userMsg = { id: Date.now(), who: 'user', text: text.trim() }
    const history = [...messagesRef.current, userMsg]
    setMessages(history)
    setSessionState('thinking')

    try {
      const aiText = await callAI(history, memorial, persona)
      const aiMsg  = { id: Date.now() + 1, who: 'ai', text: aiText }
      setMessages(prev => [...prev, aiMsg])

      if (hasVoice) {
        await speakText(aiText)
      } else {
        setSessionState('idle')
        busyRef.current = false
      }
    } catch (err) {
      console.error('TalkScreen AI error:', err)
      setSessionState('idle')
      busyRef.current = false
      addErrorBubble("I couldn't connect just now — please try again.")
    }
  }

  // ── Voice input ───────────────────────────────────────────────────────────
  function startListening() {
    const SR = (typeof window !== 'undefined')
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : null

    if (!SR) {
      addErrorBubble("Voice input isn't supported in this browser. Switch to Type mode below.")
      return
    }
    if (busyRef.current) return

    const r = new SR()
    recognitionRef.current = r
    r.lang               = 'en-US'
    r.interimResults     = false
    r.maxAlternatives    = 1
    r.continuous         = false

    r.onstart  = () => { setSessionState('listening'); setMicActive(true) }
    r.onresult = e => {
      const t = e.results[0][0].transcript
      if (t.trim()) sendMessage(t.trim())
    }
    r.onerror  = e => {
      setSessionState('idle')
      setMicActive(false)
      if (e.error === 'not-allowed') {
        addErrorBubble("Microphone access was denied. Allow mic access in your browser settings, or use Type mode.")
      } else if (e.error === 'no-speech') {
        // silence — no bubble needed, just reset
      } else {
        addErrorBubble(`Mic error: ${e.error}. Try Type mode instead.`)
      }
    }
    r.onend = () => { setMicActive(false) }
    r.start()
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setSessionState('idle')
    setMicActive(false)
  }

  function toggleMic() {
    if (micActive || sessionState === 'listening') {
      stopListening()
    } else if (!busyRef.current) {
      startListening()
    }
  }

  // ── Type mode send ────────────────────────────────────────────────────────
  function handleTypeSend() {
    if (!typeInput.trim()) return
    sendMessage(typeInput.trim())
    setTypeInput('')
  }

  // ── Mode switch ───────────────────────────────────────────────────────────
  function switchMode(m) {
    setMode(m)
    if (m === 'voice') stopListening()
    if (m === 'type')  setTimeout(() => inputRef.current?.focus(), 250)
  }

  // ── Utilities ─────────────────────────────────────────────────────────────
  function fmtTime(s) {
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
  }

  // ─── SVG icons ─────────────────────────────────────────────────────────────
  const ICONS = {
    close: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    pause: <path d="M6 4h4v16H6zm8 0h4v16h-4z" fill="currentColor"/>,
    volume: <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></>,
    end: <path d="M6.827 6.175A2.31 2.31 0 0 1 9.033 4.31l3.86 5.14-.792 3.13-1.333.792A5 5 0 0 0 6.827 6.175zm-1.33 7.536a2.31 2.31 0 0 0 .812 2.376l4.5-1.334.792-3.13L6.5 10.42a5 5 0 0 0-.993 3.29zm9.67 2.764a2.31 2.31 0 0 0 2.082-1.002l-3.86-5.14.792-3.13 1.333-.792A5 5 0 0 1 17.25 17.5zm1.33-7.536a2.31 2.31 0 0 1-.812-2.376l-4.5 1.334L10.5 10.58l4.998 1.227a5 5 0 0 1 .999-3.218z" fill="currentColor"/>,
    captions: <><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M7 13c0-1 .8-2 2-2"/><path d="M14 13c0-1 .8-2 2-2"/></>,
    mic: <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>,
    send: <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>,
    type: <><path d="M3 5h18"/><path d="M3 12h18"/><path d="M3 19h12"/></>,
    micSmall: <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></>,
  }

  function SvgBtn({ icon, fill = 'none' }) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        {icon}
      </svg>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Keyframes ────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes ts-breathe     { 0%,100%{transform:scale(1.04)} 50%{transform:scale(1.10)} }
        @keyframes ts-fadeup      { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ts-fadein      { from{opacity:0} to{opacity:1} }
        @keyframes ts-bubblein    { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ts-dot         { 0%,100%{opacity:.2} 50%{opacity:1} }
        @keyframes ts-livedot     { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.55;transform:scale(.7)} }
        @keyframes ts-pulsering   { 0%{transform:scale(.85);opacity:.8} 100%{transform:scale(1.8);opacity:0} }
        @keyframes ts-bar         { 0%,100%{transform:scaleY(.4)} 50%{transform:scaleY(1)} }
        .ts-transcript::-webkit-scrollbar { display: none }
        .ts-transcript             { scrollbar-width: none }
        @media (max-width: 900px) {
          .ts-transcript { left:16px!important; right:16px!important; width:auto!important; max-width:none!important; bottom:220px!important }
          .ts-lockup     { bottom:auto!important; top:110px!important }
          .ts-lockup h1  { font-size:clamp(38px,9vw,58px)!important }
          .ts-dock       { right:16px!important; bottom:200px!important }
          .ts-dock .ts-ic{ width:44px!important; height:44px!important }
          .ts-listening  { transform:translate(-50%,calc(-50% + 30px))!important }
        }
        @media (max-width: 560px) {
          .ts-topbar { top:14px!important; left:12px!important; right:12px!important }
          .ts-pill-info { display:none!important }
          .ts-lockup { top:86px!important }
          .ts-lockup h1 { font-size:clamp(34px,11vw,50px)!important }
          .ts-transcript { bottom:260px!important }
          .ts-dock { display:none!important }
          .ts-miczone { bottom:140px!important }
          .ts-modetoggle { bottom:36px!important }
          .ts-typebar { bottom:130px!important; width:calc(100vw - 24px)!important }
          .ts-listening { transform:translate(-50%,calc(-50% + 60px))!important }
        }
      `}</style>

      {/* ── Outer shell — position:fixed; inset:8px — tiny margin around edges ── */}
      <motion.div
        initial={{ opacity: 0, scale: .97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: .97 }}
        transition={{ type: 'spring', damping: 28, stiffness: 260 }}
        style={{
          position: 'fixed', inset: 8, borderRadius: 20, overflow: 'hidden',
          zIndex: 200, background: '#0a0612',
        }}
      >

        {/* ── Portrait ───────────────────────────────────────────────────── */}
        {photoUrl ? (
          <img src={photoUrl} alt={memorial.name}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: '50% 22%',
              filter: 'saturate(.92) contrast(1.04) brightness(.78)',
              animation: 'ts-breathe 14s ease-in-out infinite',
              transformOrigin: 'center 30%',
            }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0,
            background: 'linear-gradient(150deg, #1e0a35 0%, #0a0612 60%, #12062a 100%)' }} />
        )}

        {/* ── Cinematic wash (multiply) ───────────────────────────────────── */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'multiply',
          background: `
            radial-gradient(at 18% 8%, rgba(255,158,199,.55) 0%, transparent 35%),
            radial-gradient(at 88% 14%, rgba(136,197,255,.45) 0%, transparent 38%),
            radial-gradient(at 95% 100%, rgba(70,30,120,.92) 0%, transparent 50%),
            radial-gradient(at 0% 100%, rgba(40,20,80,.95) 0%, transparent 55%),
            linear-gradient(180deg,
              rgba(20,10,40,.30) 0%, rgba(60,25,100,.30) 35%,
              rgba(80,30,130,.55) 75%, rgba(20,8,50,.90) 100%)`,
        }} />
        {/* ── Lavender memory glow (normal blend) ────────────────────────── */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `
            radial-gradient(at 20% 100%, rgba(201,168,255,.45) 0%, transparent 50%),
            radial-gradient(at 100% 20%, rgba(255,158,199,.28) 0%, transparent 45%),
            radial-gradient(at 50% 50%, transparent 30%, rgba(30,10,60,.35) 100%)`,
        }} />
        {/* ── Film grain (overlay) ────────────────────────────────────────── */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          opacity: .08, mixBlendMode: 'overlay',
          backgroundImage: `
            radial-gradient(circle at 25% 35%, rgba(255,255,255,.6) 1px, transparent 1.5px),
            radial-gradient(circle at 70% 65%, rgba(255,255,255,.6) 1px, transparent 1.5px)`,
          backgroundSize: '3px 3px, 5px 5px',
        }} />
        {/* ── Vignette ───────────────────────────────────────────────────── */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,.45) 100%)',
        }} />

        {/* ════════════════════════════════════════════════════════════════
            TOP BAR
        ════════════════════════════════════════════════════════════════ */}
        <header className="ts-topbar" style={{
          position: 'absolute', top: 20, left: 20, right: 20, zIndex: 5,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          animation: 'ts-fadeup .8s ease-out .15s both',
        }}>
          {/* Left — close + session pill */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>

            {/* X close */}
            <button onClick={onClose} aria-label="Close"
              style={{ ...glassStyle('rose'), width: 44, height: 44, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: INK }}>
              <SvgBtn icon={ICONS.close} />
            </button>

            {/* Session pill */}
            <div style={{ ...glassStyle('lavender'), display: 'inline-flex', alignItems: 'center',
              gap: 10, height: 44, padding: '7px 16px 7px 7px' }}>
              {/* Avatar */}
              <div style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                border: '1.5px solid rgba(255,255,255,.55)', background: '#1a1226' }}>
                {photoUrl
                  ? <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 15%' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: MONO, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.5)' }}>
                      {firstName[0]?.toUpperCase() || '?'}
                    </div>}
              </div>
              {/* Name + live dot */}
              <div className="ts-pill-info" style={{ display: 'flex', flexDirection: 'column', gap: 1, lineHeight: 1.1 }}>
                <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '-.01em', color: INK, whiteSpace: 'nowrap' }}>
                  {memorial.name}{' '}
                  <em style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, color: 'rgba(26,15,42,.7)', fontSize: 12.5 }}>
                    — in conversation
                  </em>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontFamily: MONO, fontSize: 9.5, color: 'rgba(26,15,42,.7)',
                  letterSpacing: '.14em', textTransform: 'uppercase' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: '#d97706', boxShadow: '0 0 8px #f3b21a',
                    animation: 'ts-livedot 1.6s ease-in-out infinite' }} />
                  live · {hasVoice ? 'voice cloned' : 'ai generated'}
                </span>
              </div>
            </div>

          </div>

          {/* Right — captions toggle */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button aria-label="Captions" title="Captions"
              style={{ ...glassStyle('sky'), width: 44, height: 44, display: 'flex',
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: INK }}>
              <SvgBtn icon={ICONS.captions} />
            </button>
          </div>
        </header>

        {/* ════════════════════════════════════════════════════════════════
            CENTER NAME LOCKUP
        ════════════════════════════════════════════════════════════════ */}
        <div className="ts-lockup" style={{
          position: 'absolute', left: '50%', bottom: 280,
          transform: 'translateX(-50%)',
          textAlign: 'center', zIndex: 3, pointerEvents: 'none',
          animation: 'ts-fadeup .9s ease-out .45s both',
          width: 'max-content', maxWidth: '70vw',
        }}>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.3em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,.7)', marginBottom: 12 }}>
            ◆ AI Memorial
          </div>
          <h1 style={{
            fontFamily: SERIF, fontWeight: 300,
            fontSize: 'clamp(44px, 5.8vw, 86px)',
            lineHeight: .96, letterSpacing: '-.015em',
            color: '#fff', textShadow: '0 4px 30px rgba(0,0,0,.45)', margin: 0,
          }}>
            Talk with <em style={{ fontStyle: 'italic' }}>{firstName}</em>
          </h1>
          {bYear && (
            <p style={{ marginTop: 14, fontSize: 14, color: 'rgba(255,255,255,.7)', lineHeight: 1.4 }}>
              b.{' '}
              <span style={{ fontFamily: MONO, color: 'rgba(255,255,255,.85)', letterSpacing: '.06em' }}>
                {bYear}
              </span>
              &nbsp;·&nbsp;{hasVoice ? 'voice cloned' : 'AI companion'}
            </p>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════
            AI STATE CAPTION (Listening / Thinking / Speaking)
        ════════════════════════════════════════════════════════════════ */}
        {sessionState !== 'idle' && (
          <div className="ts-listening" style={{
            position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%, calc(-50% - 200px))',
            zIndex: 3, pointerEvents: 'none',
            animation: 'ts-fadein .3s ease-out',
            textAlign: 'center',
          }}>
            <div style={{
              fontFamily: MONO, fontSize: 11, letterSpacing: '.42em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,.88)',
              textShadow: '0 1px 8px rgba(0,0,0,.5)',
            }}>
              {sessionState === 'listening' && <>AI Listening<Dots /></>}
              {sessionState === 'thinking'  && <>Thinking<Dots /></>}
              {sessionState === 'speaking'  && <>{firstName} is speaking…</>}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            TRANSCRIPT — left rail
        ════════════════════════════════════════════════════════════════ */}
        <div ref={transcriptRef} className="ts-transcript" style={{
          position: 'absolute', left: 24, bottom: 110,
          width: 360, maxWidth: '32vw', zIndex: 3,
          display: 'flex', flexDirection: 'column', gap: 8,
          overflowY: 'auto', maxHeight: 'calc(100% - 360px)',
          WebkitMaskImage: 'linear-gradient(to top, black 70%, transparent 100%)',
          maskImage: 'linear-gradient(to top, black 70%, transparent 100%)',
          animation: 'ts-fadeup 1s ease-out .75s both',
        }}>
          {messages.map((msg) => {
            // ── System error bubble ───────────────────────────────────────
            if (msg.who === 'system-error') {
              return (
                <div key={msg.id} style={{
                  alignSelf: 'center', padding: '8px 14px', borderRadius: 14,
                  background: 'rgba(255,100,100,.25)', border: '1px solid rgba(255,120,120,.45)',
                  backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                  color: '#ffe0e0', fontSize: 12.5, lineHeight: 1.5, textAlign: 'center',
                  animation: 'ts-bubblein .4s ease-out both',
                  maxWidth: '90%',
                }}>
                  ⚠ {msg.text}
                </div>
              )
            }

            // ── Normal user / AI bubble ───────────────────────────────────
            return (
              <div key={msg.id} style={{
                padding: '11px 15px', borderRadius: 22,
                backdropFilter: 'blur(20px) saturate(1.3)',
                WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
                animation: 'ts-bubblein .5s ease-out both',
                ...(msg.who === 'user' ? {
                  alignSelf: 'flex-end',
                  background: 'rgba(255,215,179,.55)', border: '1px solid rgba(255,215,179,.65)',
                  color: INK, borderBottomRightRadius: 6, fontSize: 14, lineHeight: 1.45,
                } : {
                  alignSelf: 'flex-start',
                  background: 'rgba(201,168,255,.50)', border: '1px solid rgba(201,168,255,.65)',
                  color: INK, borderBottomLeftRadius: 6,
                  fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: 16, lineHeight: 1.4,
                }),
              }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 5,
                  fontFamily: MONO, fontSize: 9.5, letterSpacing: '.2em', textTransform: 'uppercase',
                  color: 'rgba(26,15,42,.6)' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
                  {msg.who === 'user' ? 'You' : firstName}
                </div>
                <div>{msg.text}</div>
              </div>
            )
          })}

          {/* Speaking-wave bars while AI is playing audio */}
          {sessionState === 'speaking' && (
            <div style={{ alignSelf: 'flex-start', display: 'inline-flex', gap: 3,
              alignItems: 'flex-end', height: 22, padding: '0 14px' }}>
              {[50, 80, 60, 95, 70, 50].map((h, i) => (
                <span key={i} style={{
                  width: 3, height: `${h}%`,
                  background: 'rgba(201,168,255,.85)', borderRadius: 999,
                  animation: `ts-bar 1s ease-in-out infinite`,
                  animationDelay: `${i * .1}s`,
                }} />
              ))}
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════
            RIGHT DOCK
        ════════════════════════════════════════════════════════════════ */}
        <div className="ts-dock" style={{
          position: 'absolute', right: 24, bottom: 110,
          zIndex: 4, display: 'flex', flexDirection: 'column', gap: 10,
          animation: 'ts-fadeup 1s ease-out .65s both',
        }}>
          {[
            {
              tint: 'lavender', label: 'Pause',
              icon: ICONS.pause, fill: 'currentColor',
              onClick: () => { audioRef.current?.pause(); setSessionState('idle'); busyRef.current = false },
            },
            {
              tint: 'mint', label: 'Volume',
              icon: ICONS.volume, fill: 'none',
              onClick: () => {},
            },
            {
              tint: 'rose', label: 'End session',
              icon: ICONS.close, fill: 'none',
              onClick: onClose, danger: true,
            },
          ].map(({ tint, label, icon, fill, onClick, danger }) => (
            <button key={label} aria-label={label} title={label} onClick={onClick}
              className="ts-ic"
              style={{ ...glassStyle(tint, { width: 48, height: 48, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }),
                cursor: 'pointer', color: danger ? '#5a0a0a' : INK }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill={fill} stroke="currentColor"
                strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                {icon}
              </svg>
            </button>
          ))}
          {/* Session timer */}
          <div style={{ alignSelf: 'center', marginTop: 4, fontFamily: MONO, fontSize: 10,
            letterSpacing: '.2em', color: 'rgba(255,255,255,.55)',
            background: 'rgba(0,0,0,.28)', border: '1px solid rgba(255,255,255,.12)',
            padding: '4px 8px', borderRadius: 999 }}>
            {fmtTime(elapsed)}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            MIC ZONE (voice mode)
        ════════════════════════════════════════════════════════════════ */}
        <div className="ts-miczone" style={{
          position: 'absolute', left: '50%', bottom: 110,
          transform: mode === 'type'
            ? 'translateX(-50%) translateY(10px)'
            : 'translateX(-50%)',
          opacity: mode === 'type' ? 0 : 1,
          pointerEvents: mode === 'type' ? 'none' : 'auto',
          transition: 'opacity .25s, transform .25s',
          zIndex: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
          animation: 'ts-fadeup 1s ease-out .55s both',
        }}>
          {/* Outer wrap with pulsing rings */}
          <div style={{ position: 'relative', width: 116, height: 116,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Pulse rings — only while listening */}
            {micActive && (<>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%',
                border: '1.5px solid rgba(255,255,255,.35)',
                animation: 'ts-pulsering 2.6s ease-out infinite' }} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%',
                border: '1.5px solid rgba(255,255,255,.35)',
                animation: 'ts-pulsering 2.6s ease-out 1.3s infinite' }} />
            </>)}
            {/* Mic disc */}
            <button onClick={toggleMic} aria-label={micActive ? 'Stop listening' : 'Tap to speak'}
              style={{
                width: 84, height: 84, borderRadius: '50%', cursor: 'pointer',
                background: micActive
                  ? 'rgba(201,168,255,.35)'
                  : 'radial-gradient(circle at 50% 30%, rgba(255,255,255,.28), rgba(255,255,255,.08) 60%, rgba(255,255,255,.04))',
                backdropFilter: 'blur(24px) saturate(1.4)',
                WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
                border: '1px solid rgba(255,255,255,.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 1px 0 rgba(255,255,255,.5) inset, 0 -1px 0 rgba(0,0,0,.12) inset, 0 14px 36px rgba(0,0,0,.45), 0 0 38px rgba(201,168,255,.32), 0 0 80px rgba(255,158,199,.22)',
                transition: 'transform .15s, background .15s',
                transform: micActive ? 'scale(.97)' : 'scale(1)',
              }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ width: 30, height: 30, filter: 'drop-shadow(0 1px 4px rgba(0,0,0,.35))' }}>
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </button>
          </div>

          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.26em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,.55)',
            textShadow: '0 1px 6px rgba(0,0,0,.35)', textAlign: 'center' }}>
            {micActive ? 'Listening… tap to stop' : 'Tap to speak'}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            TYPE BAR (text mode)
        ════════════════════════════════════════════════════════════════ */}
        <div className="ts-typebar" style={{
          position: 'absolute', left: '50%', bottom: 110,
          transform: 'translateX(-50%)',
          width: 'min(560px, 92vw)', zIndex: 4,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 8px 8px 22px',
          opacity: mode === 'type' ? 1 : 0,
          pointerEvents: mode === 'type' ? 'auto' : 'none',
          transition: 'opacity .25s',
          ...glassStyle('sky', { borderRadius: 999 }),
        }}>
          <input
            ref={inputRef}
            type="text"
            value={typeInput}
            onChange={e => setTypeInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleTypeSend() } }}
            placeholder={`Ask ${firstName} something…`}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 15,
              padding: '12px 0', minWidth: 0 }}
          />
          <button onClick={handleTypeSend} aria-label="Send"
            style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
              background: 'linear-gradient(135deg, #ff9ec7, #c9a8ff 55%, #88c5ff)',
              border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#0a0612',
              boxShadow: '0 8px 24px rgba(201,168,255,.5), 0 2px 6px rgba(0,0,0,.25)',
              transition: 'transform .15s' }}>
            <SvgBtn icon={ICONS.send} />
          </button>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            MODE TOGGLE — Voice / Type
        ════════════════════════════════════════════════════════════════ */}
        <div className="ts-modetoggle" style={{
          position: 'absolute', left: '50%', bottom: 38,
          transform: 'translateX(-50%)', zIndex: 4,
          padding: 5, display: 'inline-flex', gap: 4,
          animation: 'ts-fadeup 1s ease-out .65s both',
          ...glassStyle('butter', { borderRadius: 999 }),
        }}>
          {[
            { m: 'voice', emoji: '🎤', label: 'Voice', icon: ICONS.micSmall },
            { m: 'type',  emoji: null,  label: 'Type',  icon: ICONS.type },
          ].map(({ m, label, icon }) => (
            <button key={m} onClick={() => switchMode(m)}
              style={{
                padding: '9px 18px', borderRadius: 999, border: 'none',
                fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 7,
                transition: 'all .15s',
                ...(mode === m
                  ? { background: INK, color: '#ffe981', boxShadow: '0 4px 14px rgba(26,15,42,.45)' }
                  : { background: 'transparent', color: 'rgba(26,15,42,.55)' }),
              }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                {icon}
              </svg>
              {label}
            </button>
          ))}
        </div>

      </motion.div>
    </>
  )
}
