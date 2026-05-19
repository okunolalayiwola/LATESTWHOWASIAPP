// src/pages/CreateMemorialPage.jsx
// Multi-step memorial creation flow.
// Step 1: Who are they?       — name, photo, relation, born, died, status
// Step 2: Their story         — bio, cover photo, voice recording, theme color
// Step 3: Privacy & publish   — visibility, final review
//
// Writes to InstantDB memorials collection via db.transact().

import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { id } from '@instantdb/react'
import { db } from '../lib/instant'
import { uploadImage, uploadAudio } from '../lib/storage'
import { cloneVoice } from '../lib/elevenlabs'
import { useToast } from '../contexts/ToastContext'
import RelationPicker from '../components/ui/RelationPicker'
import { getRelationLabel } from '../lib/relations'

// ─── Config ───────────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Person',  desc: 'Who are they?'       },
  { label: 'Story',   desc: 'Their life and story' },
  { label: 'Publish', desc: 'Privacy & publish'    },
]

const COLORS = [
  { value: 'from-stone-700 to-stone-900',    hex: '#57534e' },
  { value: 'from-amber-800 to-stone-900',    hex: '#92400e' },
  { value: 'from-blue-900 to-slate-900',     hex: '#1e3a5f' },
  { value: 'from-emerald-900 to-stone-900',  hex: '#064e3b' },
  { value: 'from-purple-900 to-slate-900',   hex: '#3b0764' },
  { value: 'from-rose-900 to-stone-900',     hex: '#881337' },
]

const VISIBILITY_OPTIONS = [
  {
    value: 'public',
    emoji: '◎',
    title: 'Public',
    desc:  'Anyone can find and view this memorial',
  },
  {
    value: 'family',
    emoji: '✿',
    title: 'Family only',
    desc:  'Only people with your invite link can view',
  },
  {
    value: 'private',
    emoji: '☽',
    title: 'Private',
    desc:  'Only you can see this memorial',
  },
]

// ─── Voice Recorder Component ─────────────────────────────────────────────────

function VoiceRecorder({ form, setForm }) {
  const [recording, setRecording] = useState(false)
  const [recorded, setRecorded] = useState(!!form.voiceUrl)
  const [uploading, setUploading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [duration, setDuration] = useState(0)
  const [timer, setTimer] = useState(0)
  const mediaRecorder = useRef(null)
  const chunks = useRef([])
  const timerRef = useRef(null)
  const fileRef = useRef()

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorder.current = recorder
      chunks.current = []

      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunks.current, { type: 'audio/webm' })
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' })
        setUploading(true)
        try {
          const result = await uploadAudio(file, setUploadPct, 'memorials/voice')
          setForm(f => ({ ...f, voiceUrl: result.url, voiceDuration: result.duration }))
          setDuration(result.duration)
          setRecorded(true)
        } catch {
          // silent fail
        } finally {
          setUploading(false)
          setUploadPct(0)
        }
      }

      recorder.start()
      setRecording(true)
      setTimer(0)
      timerRef.current = setInterval(() => {
        setTimer(t => t + 1)
      }, 1000)
    } catch {
      // Microphone access denied
    }
  }

  function stopRecording() {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop()
    }
    setRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    uploadAudio(file, setUploadPct, 'memorials/voice')
      .then(result => {
        setForm(f => ({ ...f, voiceUrl: result.url, voiceDuration: result.duration }))
        setDuration(result.duration)
        setRecorded(true)
      })
      .catch(() => {})
      .finally(() => { setUploading(false); setUploadPct(0) })
  }

  function handleRemove() {
    setForm(f => ({ ...f, voiceUrl: null, voiceDuration: null }))
    setRecorded(false)
    setDuration(0)
  }

  return (
    <div>
      <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">
        Voice recording
      </label>
      <p className="text-[0.6rem] text-white/30 mb-3 leading-relaxed">
        Record a message in their voice, or upload an existing audio clip. Visitors can hear it on the memorial page.
      </p>

      {recorded ? (
        <div className="glass rounded-2xl p-4 border border-gold/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold/30 to-coral/30 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">✦</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white font-medium">Voice recording saved</div>
              <div className="text-xs text-white/40">{duration > 0 ? `${formatTime(duration)}` : 'Ready'}</div>
            </div>
            <button onClick={handleRemove} className="text-xs text-white/30 hover:text-red-400 transition-colors flex-shrink-0">
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {recording ? (
            <div className="glass rounded-2xl p-4 border border-coral/40">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                  className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0"
                >
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                </motion.div>
                <div className="flex-1">
                  <div className="text-sm text-white font-medium">Recording...</div>
                  <div className="text-xs text-red-400/70 font-mono">{formatTime(timer)}</div>
                </div>
                <button onClick={stopRecording} className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 hover:bg-red-600 transition-colors">
                  <div className="w-3 h-3 bg-white" />
                </button>
              </div>
            </div>
          ) : (
            <>
              <button onClick={startRecording} className="w-full flex items-center gap-3 p-4 rounded-2xl glass border border-white/10 hover:border-gold/30 transition-all text-left">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold/30 to-coral/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">◎</span>
                </div>
                <div>
                  <div className="text-sm text-white font-medium">Record voice</div>
                  <div className="text-xs text-white/40">Use your microphone to record</div>
                </div>
              </button>
              <button onClick={() => fileRef.current.click()} className="w-full flex items-center gap-3 p-4 rounded-2xl glass border border-white/10 hover:border-gold/30 transition-all text-left">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold/30 to-coral/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">✿</span>
                </div>
                <div>
                  <div className="text-sm text-white font-medium">Upload audio file</div>
                  <div className="text-xs text-white/40">MP3, WAV, or other audio format</div>
                </div>
              </button>
              <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
            </>
          )}

          {uploading && (
            <div className="mt-2">
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gold transition-all" style={{ width: `${uploadPct}%` }} />
              </div>
              <p className="text-[0.6rem] text-white/30 mt-1 text-right">Uploading {uploadPct}%</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Step components ──────────────────────────────────────────────────────────

function StepPerson({ form, setForm }) {
  const set  = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const setB = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-gold/40 transition-colors'

  // Avatar upload
  const [avatarPreview, setAvatarPreview] = useState(form.photoUrl || null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarRef = useRef()

  // Banner upload
  const bannerRef = useRef(null)
  const [bannerPreview, setBannerPreview] = useState(form.coverPhotoUrl || null)

  // Relation picker
  const [showRelationPicker, setShowRelationPicker] = useState(false)
  const [relationError, setRelationError] = useState('')

  async function handleAvatar(e) {
    const file = e.target.files[0]
    if (!file) return
    setAvatarPreview(URL.createObjectURL(file))
    setAvatarUploading(true)
    try {
      const url = await uploadImage(file, () => {}, 'memorials/avatars')
      setForm(f => ({ ...f, photoUrl: url }))
    } catch {
      // silent
    } finally {
      setAvatarUploading(false)
    }
  }

  async function handleBanner(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBannerPreview(URL.createObjectURL(file))
    try {
      const url = await uploadImage(file, undefined, 'memorials/banners')
      setForm(f => ({ ...f, coverPhotoUrl: url }))
    } catch (err) { console.warn('banner upload failed:', err) }
  }

  return (
    <motion.div
      key="step-person"
      initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="space-y-5"
    >
      {/* Avatar / Photo */}
      <div>
        <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">
          {form.name ? `${form.name}'s portrait` : 'Their portrait photo'}
        </label>
        <div className="flex items-center gap-4">
          <div
            onClick={() => avatarRef.current.click()}
            className="w-20 h-20 rounded-full bg-gradient-to-br from-gold/20 to-coral/20 border-2 border-dashed border-white/15 flex items-center justify-center cursor-pointer hover:border-gold/40 transition-all overflow-hidden flex-shrink-0"
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl opacity-30">✦</span>
            )}
          </div>
          <div className="flex-1">
            <button
              onClick={() => avatarRef.current.click()}
              className="text-xs text-white/60 hover:text-white transition-colors font-semibold"
            >
              {avatarPreview ? 'Change photo' : 'Upload photo'}
            </button>
            <p className="text-[0.55rem] text-white/30 mt-1">
              The portrait of the person this memorial honours — not your own profile photo.
            </p>
          </div>
        </div>
        <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
      </div>

      {/* Banner / Cover photo */}
      <div>
        <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">
          Cover photo (optional)
        </label>
        <div
          onClick={() => bannerRef.current?.click()}
          className={`relative w-full h-28 rounded-2xl border border-dashed border-white/15 flex flex-col items-center justify-center cursor-pointer hover:border-gold/30 transition-all overflow-hidden group`}
        >
          {bannerPreview ? (
            <>
              <img src={bannerPreview} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-xs text-white font-semibold">Change cover</span>
              </div>
            </>
          ) : (
            <>
              <span className="text-xl opacity-20 mb-1">✦</span>
              <span className="text-[0.6rem] text-white/30">Add a cover photo</span>
            </>
          )}
        </div>
        <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={handleBanner} />
      </div>

      <div>
        <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">
          Full name *
        </label>
        <input
          autoFocus
          className={inputCls}
          value={form.name}
          onChange={set('name')}
          placeholder="e.g. Grace Okonkwo"
        />
      </div>

      <div>
        <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">
          Your relation to them
        </label>
        <button
          type="button"
          onClick={() => setShowRelationPicker(true)}
          className={`w-full flex items-center justify-between rounded-2xl px-4 py-3.5 text-sm transition-colors ${
            form.relation
              ? 'bg-white/5 border border-gold/40 text-white'
              : 'bg-white/5 border border-white/10 text-white/40 hover:text-white/60 hover:border-white/20'
          }`}
        >
          <span>{form.relation ? getRelationLabel(form.relation) : 'Select relation...'}</span>
          <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {relationError && (
          <p className="text-[0.6rem] text-red-400 mt-1">{relationError}</p>
        )}
      </div>

      {/* Relation Picker Modal */}
      <AnimatePresence>
        {showRelationPicker && (
          <RelationPicker
            value={form.relation}
            onChange={(val) => {
              setForm(f => ({ ...f, relation: val }))
              setRelationError('')
            }}
            onClose={() => setShowRelationPicker(false)}
            error={relationError}
          />
        )}
      </AnimatePresence>

      <div>
        <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">
          Status
        </label>
        <div className="flex gap-2">
          {[{ v: false, label: 'Passed away', emoji: '☽' }, { v: true, label: 'Still living', emoji: '✿' }].map(opt => (
            <button
              key={String(opt.v)}
              onClick={() => setB('alive', opt.v)}
              className={`flex-1 flex flex-col items-center gap-1.5 py-4 rounded-2xl text-sm font-semibold transition-all ${
                form.alive === opt.v
                  ? 'bg-gradient-to-br from-gold/20 to-coral/20 border border-gold/40 text-white'
                  : 'glass border border-white/10 text-white/40 hover:text-white/70'
              }`}
            >
              <span className="text-xl">{opt.emoji}</span>
              <span className="text-xs">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">
            Birth year
          </label>
          <input className={inputCls} type="number" value={form.birthYear} onChange={set('birthYear')} placeholder="1935" />
        </div>
        {!form.alive && (
          <div>
            <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">
              Year passed
            </label>
            <input className={inputCls} type="number" value={form.deathYear} onChange={set('deathYear')} placeholder="2020" />
          </div>
        )}
      </div>

      {form.birthYear && (
        <div>
          <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">
            One-line description
          </label>
          <input
            className={inputCls}
            value={form.subtitle}
            onChange={set('subtitle')}
            placeholder="e.g. A teacher, mother, and light to all who knew her"
            maxLength={120}
          />
          <p className="text-[0.6rem] text-white/20 mt-1 text-right">{form.subtitle.length}/120</p>
        </div>
      )}
    </motion.div>
  )
}

function StepStory({ form, setForm }) {
  const [uploading,   setUploading]   = useState(false)
  const [uploadPct,   setUploadPct]   = useState(0)
  const [photoPreview, setPhotoPreview] = useState(form.coverPhotoUrl || null)
  const fileRef = useRef()

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handlePhoto(e) {
    const file = e.target.files[0]
    if (!file) return
    setPhotoPreview(URL.createObjectURL(file))
    setUploading(true)
    try {
      const url = await uploadImage(file, setUploadPct, 'memorials')
      setForm(f => ({ ...f, coverPhotoUrl: url }))
    } catch {
      // If upload fails, use preview-only (can be re-uploaded later)
    } finally {
      setUploading(false); setUploadPct(0)
    }
  }

  return (
    <motion.div
      key="step-story"
      initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="space-y-5"
    >
      {/* Cover photo */}
      <div>
        <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">
          Cover photo
        </label>
        <div
          onClick={() => fileRef.current.click()}
          className={`relative w-full h-36 rounded-2xl border border-dashed border-white/15 flex flex-col items-center justify-center cursor-pointer hover:border-gold/30 transition-all overflow-hidden group`}
        >
          {photoPreview ? (
            <>
              <img src={photoPreview} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-xs text-white font-semibold">Change photo</span>
              </div>
            </>
          ) : (
            <>
              <span className="text-2xl opacity-20 mb-2">✦</span>
              <span className="text-xs text-white/30">{uploading ? `Uploading ${uploadPct}%` : 'Upload a cover photo'}</span>
            </>
          )}
          {uploading && (
            <div className="absolute bottom-0 left-0 h-1 bg-gold transition-all" style={{ width: `${uploadPct}%` }} />
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
      </div>

      {/* Theme color (if no photo) */}
      {!photoPreview && (
        <div>
          <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">
            Theme colour
          </label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => setForm(f => ({ ...f, color: c.value }))}
                style={{ background: c.hex }}
                className={`w-9 h-9 rounded-full border-2 transition-all ${
                  form.color === c.value ? 'border-gold scale-110' : 'border-transparent hover:scale-105'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Voice recording */}
      <VoiceRecorder form={form} setForm={setForm} />

      {/* Bio */}
      <div>
        <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">
          Life story
        </label>
        <textarea
          value={form.bio}
          onChange={set('bio')}
          rows={5}
          placeholder={`Write about ${form.name || 'this person'}. Their personality, passions, the memories they left behind...`}
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-gold/40 resize-none transition-colors"
        />
        <p className="text-[0.6rem] text-white/20 mt-1 text-right">{form.bio.length} characters</p>
      </div>

      {/* Location */}
      <div>
        <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">
          Location / hometown
        </label>
        <input
          value={form.location}
          onChange={set('location')}
          placeholder="e.g. Lagos, Nigeria"
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-gold/40 transition-colors"
        />
      </div>
    </motion.div>
  )
}

function StepPublish({ form, setForm }) {
  const years = form.birthYear && form.deathYear
    ? `${form.birthYear} — ${form.deathYear}`
    : form.birthYear
    ? `Born ${form.birthYear}`
    : ''

  return (
    <motion.div
      key="step-publish"
      initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="space-y-5"
    >
      {/* Preview card */}
      <div className={`relative h-36 rounded-2xl overflow-hidden bg-gradient-to-br ${form.color || 'from-stone-800 to-stone-950'}`}>
        {form.coverPhotoUrl && (
          <img src={form.coverPhotoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute bottom-0 left-0 p-4 flex items-center gap-3">
          {form.photoUrl && (
            <div className="w-12 h-12 rounded-full border-2 border-white/20 overflow-hidden flex-shrink-0">
              <img src={form.photoUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div>
            <div className="font-display text-xl font-bold text-white">{form.name || 'Name'}</div>
            {years && <div className="text-xs text-white/50">{years}</div>}
            {form.subtitle && <div className="text-xs text-white/40 mt-0.5 line-clamp-1">{form.subtitle}</div>}
          </div>
        </div>
      </div>

      {/* Voice indicator */}
      {form.voiceUrl && (
        <div className="glass rounded-2xl p-3 flex items-center gap-3 border border-gold/10">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold/30 to-coral/30 flex items-center justify-center flex-shrink-0">
            <span className="text-sm">◎</span>
          </div>
          <div className="flex-1">
            <div className="text-xs text-white font-medium">Voice recording attached</div>
            <div className="text-[0.6rem] text-white/30">Visitors can hear their voice on the memorial page</div>
          </div>
        </div>
      )}

      {/* Visibility */}
      <div>
        <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-3">
          Who can see this memorial?
        </label>
        <div className="space-y-2">
          {VISIBILITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setForm(f => ({ ...f, visibility: opt.value }))}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all ${
                form.visibility === opt.value
                  ? 'bg-gradient-to-r from-gold/15 to-coral/15 border border-gold/40'
                  : 'glass border border-white/10 hover:border-white/20'
              }`}
            >
              <span className="text-xl">{opt.emoji}</span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">{opt.title}</div>
                <div className="text-xs text-white/40 mt-0.5">{opt.desc}</div>
              </div>
              {form.visibility === opt.value && (
                <span className="text-gold flex-shrink-0">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Allow tributes toggle */}
      <div
        className="flex items-center justify-between glass rounded-2xl p-4 cursor-pointer"
        onClick={() => setForm(f => ({ ...f, allowTributes: !f.allowTributes }))}
      >
        <div>
          <div className="text-sm font-semibold text-white">Allow tributes</div>
          <div className="text-xs text-white/40 mt-0.5">Let others leave tributes and memories</div>
        </div>
        <div className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
          form.allowTributes ? 'bg-gold' : 'bg-white/10'
        }`}>
          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
            form.allowTributes ? 'left-6' : 'left-1'
          }`} />
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const initForm = () => ({
  name:          '',
  relation:      '',
  subtitle:      '',
  alive:         false,
  birthYear:     '',
  deathYear:     '',
  bio:           '',
  location:      '',
  color:         COLORS[0].value,
  photoUrl:      null,
  coverPhotoUrl: null,
  voiceUrl:      null,
  voiceDuration: null,
  visibility:    'public',
  allowTributes: true,
})

export default function CreateMemorialPage() {
  const navigate   = useNavigate()
  const { toast }  = useToast()
  const { user }   = db.useAuth()

  const [step,   setStep]   = useState(0)
  const [form,   setForm]   = useState(initForm)
  const [saving, setSaving] = useState(false)

  function validateStep() {
    if (step === 0 && !form.name.trim()) {
      toast.warning('Please enter a name')
      return false
    }
    return true
  }

  function handleBack() {
    if (step === 0) navigate(-1)
    else setStep(s => s - 1)
  }

  async function handleNext() {
    if (!validateStep()) return
    if (step < STEPS.length - 1) { setStep(s => s + 1); return }

    // Publish
    if (!user) { toast.error('Please sign in to create a memorial'); navigate('/auth'); return }
    setSaving(true)
    try {
      const memId     = id()
      const years     = form.birthYear
        ? form.deathYear
          ? `${form.birthYear} — ${form.deathYear}`
          : `Born ${form.birthYear}`
        : ''

      // Clone voice via ElevenLabs if a voice recording was uploaded
      let elevenLabsVoiceId = null
      if (form.voiceUrl) {
        try {
          elevenLabsVoiceId = await cloneVoice(form.voiceUrl, form.name.trim())
          if (elevenLabsVoiceId) {
            toast.success('Voice cloned for AI speech ✦')
          }
        } catch {
          // Non-blocking — fall back to Web Speech API
        }
      }

      await db.transact([
        db.tx.memorials[memId].update({
          name:              form.name.trim(),
          subtitle:          form.subtitle.trim(),
          relation:          form.relation.trim(),
          bio:               form.bio.trim(),
          location:          form.location.trim(),
          alive:             form.alive,
          birthYear:         form.birthYear ? String(form.birthYear) : undefined,
          deathYear:         !form.alive && form.deathYear ? String(form.deathYear) : undefined,
          years,
          color:             form.color,
          photo:             form.photoUrl,
          coverPhoto:        form.coverPhotoUrl,
          visibility:        form.visibility,
          allowTributes:     form.allowTributes,
          voiceUrl:          form.voiceUrl,
          voiceDuration:     form.voiceDuration,
          elevenLabsVoiceId: elevenLabsVoiceId,
          creatorId:         user.id,
          createdBy:         user.id,
          createdAt:         Date.now(),
          updatedAt:         Date.now(),
        }),
      ])

      toast.success(`${form.name}'s memorial has been created ✦`)
      navigate(`/memorial/${memId}`)
    } catch (err) {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const progress = ((step) / STEPS.length) * 100

  return (
    <div className="relative z-10 min-h-screen pb-32">

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 pt-16 pb-4">
        <button
          onClick={handleBack}
          className="w-9 h-9 glass rounded-full flex items-center justify-center text-white/60 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="text-center">
          <p className="text-[0.6rem] font-bold tracking-[0.2em] uppercase text-cream-dim">
            {STEPS[step].desc}
          </p>
          <p className="text-xs text-white/30 mt-0.5">Step {step + 1} of {STEPS.length}</p>
        </div>

        <div className="w-9" />
      </div>

      {/* ── Progress bar ───────────────────────────────────────────────────── */}
      <div className="h-0.5 bg-white/5 mx-5 rounded-full overflow-hidden mb-6">
        <motion.div
          className="h-full bg-gradient-to-r from-gold to-sky rounded-full"
          animate={{ width: `${progress + (100 / STEPS.length)}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>

      {/* ── Step label ─────────────────────────────────────────────────────── */}
      <div className="px-5 mb-6">
        <h1 className="font-display text-[clamp(1.8rem,5vw,2.4rem)] font-bold leading-tight">
          {step === 0 && <>Who are <span className="text-gradient-gold">they?</span></>}
          {step === 1 && <>Their <span className="text-gradient-gold">story</span></>}
          {step === 2 && <>Ready to <span className="text-gradient-gold">publish?</span></>}
        </h1>
        {step === 0 && (
          <p className="text-xs text-white/35 mt-1">
            You're creating a memorial for someone else. Your own account profile is
            managed separately in the Profile tab.
          </p>
        )}
      </div>

      {/* ── Step content ───────────────────────────────────────────────────── */}
      <div className="px-5">
        <AnimatePresence mode="wait">
          {step === 0 && <StepPerson  key="p" form={form} setForm={setForm} />}
          {step === 1 && <StepStory   key="s" form={form} setForm={setForm} />}
          {step === 2 && <StepPublish key="r" form={form} setForm={setForm} />}
        </AnimatePresence>
      </div>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 px-5 pb-safe z-30"
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
      >
        <div className="bg-black/80 backdrop-blur-xl pt-4 -mx-5 px-5">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleNext}
            disabled={saving}
            className="w-full py-4 rounded-2xl text-sm font-bold tracking-wider bg-gradient-to-r from-gold to-sky text-black hover:opacity-90 transition-opacity disabled:opacity-50 mb-3"
          >
            {saving
              ? <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Creating memorial...
                </span>
              : step < STEPS.length - 1
              ? 'Continue →'
              : `Publish ${form.name ? `${form.name}'s memorial` : 'memorial'} ✦`
            }
          </motion.button>

          {step < STEPS.length - 1 && (
            <button
              onClick={() => setStep(s => s + 1)}
              className="w-full py-2 text-xs text-white/25 hover:text-white/40 transition-colors mb-2"
            >
              Skip for now
            </button>
          )}
        </div>
      </div>

    </div>
  )
}
