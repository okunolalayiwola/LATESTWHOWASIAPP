// src/pages/CreateMemorialPage.jsx
// Multi-step memorial creation flow.
// Two paths, distinct copy throughout:
//   • SELF (?self=1)   — second-person ("Your portrait", "When were you born?")
//                        Name pre-fills from profile.displayName.
//                        relation = 'self', isSelf = true.
//   • OTHER (default)  — pronoun-aware third-person built from `pronouns`
//                        ("His portrait", "When was she born?", "Their story").
//                        Pronoun picker appears in Step 1.
//
// Step 1: Person   — name, photo, pronouns (other only), relation, born, died, country
// Step 2: Story    — bio, photos, voice recording, theme color
// Step 3: Publish  — visibility, final review
//
// Writes to InstantDB memorials collection via db.transact().

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { id } from '@instantdb/react'
import ExifReader from 'exifreader'
import { db } from '../lib/instant'
import { uploadImage, uploadAudio } from '../lib/storage'
import { cloneVoice } from '../lib/elevenlabs'
import { useToast } from '../contexts/ToastContext'
import RelationPicker from '../components/ui/RelationPicker'
import { getRelationLabel } from '../lib/relations'
import { COUNTRIES, countryFlag, findCountry } from '../lib/countries'

// ─── EXIF date helper ─────────────────────────────────────────────────────────
async function readExifDate(file) {
  try {
    const buf  = await file.arrayBuffer()
    const tags = ExifReader.load(buf, { expanded: true })
    const raw  = tags?.exif?.DateTimeOriginal?.description
               || tags?.exif?.DateTime?.description
    if (!raw) return null
    // EXIF format: "2018:07:14 10:30:00"
    const [datePart, timePart] = raw.split(' ')
    if (!datePart) return null
    const iso = datePart.replace(/:/g, '-') + 'T' + (timePart || '00:00:00')
    const d   = new Date(iso)
    return isNaN(d.getTime()) ? null : Math.floor(d.getTime() / 1000)  // Unix seconds
  } catch { return null }
}

// ─── Config ───────────────────────────────────────────────────────────────────

// Pronoun options for "creating for someone else" mode
const PRONOUN_OPTIONS = [
  { id: 'she',  label: 'She / her',   sub: 'Feminine'   },
  { id: 'he',   label: 'He / him',    sub: 'Masculine'  },
  { id: 'they', label: 'They / them', sub: 'Neutral'    },
]

/**
 * getCopy(isSelf, pronouns)
 * Single source of truth for every label, placeholder, and helper line in the
 * Create flow. Pass `isSelf` from the URL and `pronouns` from the form.
 * Returns an object the steps and main page consume directly.
 */
function getCopy(isSelf, pronouns) {
  if (isSelf) {
    return {
      mode:              'self',
      stepDescs: {
        person:          'About you',
        story:           'Your life and story',
        publish:         'Privacy & publish',
      },
      stepTitles: {
        person:          (<>Who are <span className="text-gradient-gold">you?</span></>),
        story:           (<>Your <span className="text-gradient-gold">story</span></>),
        publish:         (<>Ready to <span className="text-gradient-gold">publish?</span></>),
      },
      heroIntro:         "You're creating your own living legacy — your story, your voice, preserved for those who'll read it in time.",
      portraitLabel:     'Your portrait',
      portraitHelp:      'This is your portrait — the face of your living legacy.',
      portraitChange:    'Change photo',
      portraitUpload:    'Upload your photo',
      nameLabel:         'Your full name',
      namePlaceholder:   'e.g. Your full name',
      pronounsLabel:     null,                    // no pronoun picker in self mode
      relationLabel:     null,
      statusLabel:       'Status',
      statusPassedLabel: 'I have passed',
      statusLivingLabel: "I'm still living",
      birthLabel:        'Your birth year',
      birthPlaceholder:  '1935',
      deathLabel:        'Year of passing',
      deathPlaceholder:  '',
      countryLabel:      'Your country',
      countryHelp:       'Shown as a flag on your memorial card.',
      countryPlaceholder:'Select your country…',
      subtitleLabel:     'One-line description of yourself',
      subtitlePlaceholder: 'e.g. A teacher, mother, light to all who know me',
      bioLabel:          'Your life story',
      bioPlaceholder:    'Write about yourself. Your personality, your passions, the memories you want preserved…',
      locationLabel:     'Your hometown',
      locationPlaceholder:'e.g. Lagos, Nigeria',
      voiceLabel:        'Record your voice',
      voiceHelp:         'Visitors will hear you speak on your memorial page.',
      visibilityLabel:   'Who can see your memorial?',
      tributesLabel:     'Allow tributes from others',
      tributesHelp:      'Let people who visit your memorial leave messages and tributes.',
      previewVerb:       'You',
      ctaPublish:        'Publish your legacy ✦',
      successText:       'Your living legacy has been created ✦',
    }
  }

  // ── Pronoun-aware "other" path ─────────────────────────────────────────────
  const p     = pronouns === 'she' ? 'she' : pronouns === 'he' ? 'he' : 'they'
  const obj   = p === 'she' ? 'her'  : p === 'he' ? 'him' : 'them'
  const poss  = p === 'she' ? 'her'  : p === 'he' ? 'his' : 'their'
  const wasWere = p === 'they' ? 'were' : 'was'
  const isAre   = p === 'they' ? 'are' : 'is'
  const haveHas = p === 'they' ? 'have' : 'has'
  const Cap = s => s.charAt(0).toUpperCase() + s.slice(1)

  return {
    mode:              'other',
    pronouns:          p,
    stepDescs: {
      person:          `About ${obj}`,
      story:           `${Cap(poss)} life and story`,
      publish:         'Privacy & publish',
    },
    stepTitles: {
      person:          (<>Who {wasWere} <span className="text-gradient-gold">{p}?</span></>),
      story:           (<>{Cap(poss)} <span className="text-gradient-gold">story</span></>),
      publish:         (<>Ready to <span className="text-gradient-gold">publish?</span></>),
    },
    heroIntro:         `You're creating a memorial for someone else. Your own account profile stays separate — this memorial honours ${obj}.`,
    portraitLabel:     `${Cap(poss)} portrait`,
    portraitHelp:      `The portrait of the person this memorial honours — not your own profile photo.`,
    portraitChange:    'Change photo',
    portraitUpload:    `Upload ${poss} photo`,
    nameLabel:         `${Cap(poss)} full name`,
    namePlaceholder:   'e.g. Grace Okonkwo',
    pronounsLabel:     `${Cap(poss)} pronouns`,
    pronounsHelp:      `How the memorial refers to ${obj} throughout the app.`,
    relationLabel:     `Your relation to ${obj}`,
    statusLabel:       'Status',
    statusPassedLabel: `${Cap(p)} ${haveHas} passed`,
    statusLivingLabel: `${Cap(p)} ${isAre} still living`,
    birthLabel:        'Birth year',
    birthPlaceholder:  '1935',
    deathLabel:        'Year of passing',
    deathPlaceholder:  '2020',
    countryLabel:      `${Cap(poss)} country`,
    countryHelp:       `Where ${p} ${isAre} based — shown as a country flag on ${poss} card.`,
    countryPlaceholder:'Select country…',
    subtitleLabel:     `One-line description of ${obj}`,
    subtitlePlaceholder: `e.g. A teacher, mother, and light to all who knew ${obj}`,
    bioLabel:          `${Cap(poss)} life story`,
    bioPlaceholder:    (name) => `Write about ${name || obj}. ${Cap(poss)} personality, ${poss} passions, the memories ${p} left behind…`,
    locationLabel:     `${Cap(poss)} hometown`,
    locationPlaceholder:'e.g. Lagos, Nigeria',
    voiceLabel:        `Record ${poss} voice`,
    voiceHelp:         `Visitors will hear ${obj} speak on the memorial page.`,
    visibilityLabel:   `Who can see this memorial?`,
    tributesLabel:     'Allow tributes',
    tributesHelp:      `Let others leave tributes and memories for ${obj}.`,
    previewVerb:       Cap(p),
    ctaPublish:        'Publish memorial ✦',
    successText:       'memorial has been created ✦',
  }
}

const STEPS = [
  { key: 'person',  label: 'Person'  },
  { key: 'story',   label: 'Story'   },
  { key: 'publish', label: 'Publish' },
]

// Theme colours — stored as hex in memorial.themeHex
const COLORS = [
  { hex: '#57534e', label: 'Stone'   },
  { hex: '#92400e', label: 'Amber'   },
  { hex: '#1e3a5f', label: 'Ocean'   },
  { hex: '#064e3b', label: 'Forest'  },
  { hex: '#3b0764', label: 'Violet'  },
  { hex: '#881337', label: 'Crimson' },
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

// Country picker modal — reused in StepPerson
function CountryPickerModal({ current, onSave, onClose }) {
  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState(current || '')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return COUNTRIES
    return COUNTRIES.filter(c => c.name.toLowerCase().includes(q))
  }, [search])

  function handleConfirm() {
    if (!selected) return
    const country = findCountry(selected)
    if (!country) return
    onSave(country.code, country.name)
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="w-full max-w-md glass-strong rounded-t-3xl border border-white/10 flex flex-col"
        style={{ maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex-shrink-0">
          <div className="w-8 h-1 bg-white/20 rounded-full mx-auto mb-4" />
          <h3 className="font-display text-lg font-bold text-white text-center mb-3">Select country</h3>
          <input
            autoFocus
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search countries…"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-gold/40"
          />
        </div>

        {/* Selected preview */}
        {selected && (
          <div className="px-5 py-3 border-b border-white/5 flex-shrink-0 flex items-center gap-3 bg-gold/5">
            <span className="text-2xl leading-none">{countryFlag(selected)}</span>
            <span className="text-sm text-white font-medium flex-1">{findCountry(selected)?.name}</span>
            <button onClick={() => setSelected('')} className="text-xs text-white/35 hover:text-white/60">Change</button>
          </div>
        )}

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {filtered.map(c => (
            <button
              key={c.code}
              onClick={() => setSelected(c.code)}
              className={`w-full flex items-center gap-3 px-5 py-3 text-sm transition-colors text-left ${
                selected === c.code
                  ? 'bg-gold/15 text-white'
                  : 'text-white/65 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="text-lg w-8 flex-shrink-0 leading-none">{countryFlag(c.code)}</span>
              <span className="truncate">{c.name}</span>
              {selected === c.code && <span className="ml-auto text-gold text-xs">✓</span>}
            </button>
          ))}
        </div>

        {/* Confirm */}
        <div className="p-5 flex-shrink-0 border-t border-white/10">
          <button
            onClick={handleConfirm}
            disabled={!selected}
            className="w-full py-3.5 rounded-2xl text-sm font-bold text-black metal-btn disabled:opacity-40"
          >
            Confirm country ✦
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function StepPerson({ form, setForm, isSelf, copy }) {
  const set  = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const setB = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-gold/40 transition-colors'

  // Avatar upload
  const [avatarPreview, setAvatarPreview] = useState(form.photoUrl || null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarRef = useRef()

  // Relation picker
  const [showRelationPicker, setShowRelationPicker] = useState(false)
  const [relationError, setRelationError] = useState('')

  // Country picker
  const [showCountryPicker, setShowCountryPicker] = useState(false)

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

  return (
    <motion.div
      key="step-person"
      initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="space-y-5"
    >
      {/* ── Mode banner ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl p-3.5 flex items-center gap-3"
        style={{
          background: isSelf
            ? 'linear-gradient(135deg, rgba(255,215,0,0.10) 0%, rgba(56,189,248,0.08) 100%)'
            : 'rgba(255,255,255,0.04)',
          border: `1px solid ${isSelf ? 'rgba(255,215,0,0.30)' : 'rgba(255,255,255,0.10)'}`,
        }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            background: isSelf ? 'rgba(255,215,0,0.18)' : 'rgba(255,255,255,0.06)',
            color: isSelf ? '#FFD700' : 'rgba(255,255,255,0.5)',
            fontSize: 16,
          }}>
          {isSelf ? '✦' : '♡'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em]"
            style={{ color: isSelf ? '#FFD700' : 'rgba(255,255,255,0.65)' }}>
            {isSelf ? 'Myself — living legacy' : 'Someone else — to honour them'}
          </p>
          <p className="text-[0.6rem] mt-0.5" style={{ color: 'rgba(255,255,255,0.40)' }}>
            {isSelf
              ? 'This memorial IS you.'
              : "You're the creator. This memorial honours a different person."}
          </p>
        </div>
      </div>

      {/* ── Avatar / Photo ──────────────────────────────────────────────────── */}
      <div>
        <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">
          {copy.portraitLabel}
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
              {avatarPreview ? copy.portraitChange : copy.portraitUpload}
            </button>
            <p className="text-[0.55rem] text-white/30 mt-1">{copy.portraitHelp}</p>
          </div>
        </div>
        <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
      </div>


      {/* ── Name ────────────────────────────────────────────────────────────── */}
      <div>
        <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">
          {copy.nameLabel} *
        </label>
        <input
          autoFocus
          className={inputCls}
          value={form.name}
          onChange={set('name')}
          placeholder={copy.namePlaceholder}
        />
        {isSelf && form.name && (
          <p className="text-[0.55rem] text-white/30 mt-1.5 flex items-center gap-1">
            <span style={{ color: '#FFD700' }}>✦</span>
            Matched to your profile — your name will sync across your account.
          </p>
        )}
      </div>

      {/* ── Pronouns (other mode only) ──────────────────────────────────────── */}
      {!isSelf && (
        <div>
          <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">
            {copy.pronounsLabel}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {PRONOUN_OPTIONS.map(opt => {
              const active = form.pronouns === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setB('pronouns', opt.id)}
                  className={`flex flex-col items-center justify-center py-3 rounded-2xl text-sm transition-all ${
                    active
                      ? 'bg-gradient-to-br from-gold/20 to-coral/20 border border-gold/40 text-white'
                      : 'bg-white/5 border border-white/10 text-white/55 hover:text-white/85 hover:border-white/20'
                  }`}
                >
                  <span className="font-semibold text-xs">{opt.label}</span>
                  <span className="text-[0.55rem] text-white/35 mt-0.5">{opt.sub}</span>
                </button>
              )
            })}
          </div>
          {copy.pronounsHelp && (
            <p className="text-[0.55rem] text-white/30 mt-1.5">{copy.pronounsHelp}</p>
          )}
        </div>
      )}

      {/* ── Relation (other mode only) ──────────────────────────────────────── */}
      {!isSelf && (
        <div>
          <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">
            {copy.relationLabel}
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
      )}

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

      {/* ── Status ──────────────────────────────────────────────────────────── */}
      <div>
        <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">
          {copy.statusLabel}
        </label>
        <div className="flex gap-2">
          {[
            { v: false, label: copy.statusPassedLabel, emoji: '☽' },
            { v: true,  label: copy.statusLivingLabel, emoji: '✿' },
          ].map(opt => (
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

      {/* ── Birth / Death year ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">
            {copy.birthLabel}
          </label>
          <input className={inputCls} type="number" value={form.birthYear} onChange={set('birthYear')} placeholder={copy.birthPlaceholder} />
        </div>
        {!form.alive && (
          <div>
            <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">
              {copy.deathLabel}
            </label>
            <input className={inputCls} type="number" value={form.deathYear} onChange={set('deathYear')} placeholder={copy.deathPlaceholder} />
          </div>
        )}
      </div>

      {/* ── Country ─────────────────────────────────────────────────────────── */}
      <div>
        <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-1">
          {copy.countryLabel}
        </label>
        <p className="text-[0.55rem] text-white/28 mb-2 leading-relaxed">
          {copy.countryHelp}
        </p>
        <button
          type="button"
          onClick={() => setShowCountryPicker(true)}
          className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm transition-colors ${
            form.countryCode
              ? 'bg-white/5 border border-gold/40 text-white'
              : 'bg-white/5 border border-white/10 text-white/40 hover:text-white/60 hover:border-white/20'
          }`}
        >
          {form.countryCode ? (
            <>
              <span className="text-xl leading-none">{countryFlag(form.countryCode)}</span>
              <span className="flex-1 text-left">{form.countryName}</span>
            </>
          ) : (
            <span className="flex-1 text-left">{copy.countryPlaceholder}</span>
          )}
          <svg className="w-4 h-4 text-white/30 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <AnimatePresence>
        {showCountryPicker && (
          <CountryPickerModal
            current={form.countryCode}
            onSave={(code, name) => setForm(f => ({ ...f, countryCode: code, countryName: name }))}
            onClose={() => setShowCountryPicker(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Subtitle ────────────────────────────────────────────────────────── */}
      {form.birthYear && (
        <div>
          <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">
            {copy.subtitleLabel}
          </label>
          <input
            className={inputCls}
            value={form.subtitle}
            onChange={set('subtitle')}
            placeholder={copy.subtitlePlaceholder}
            maxLength={120}
          />
          <p className="text-[0.6rem] text-white/20 mt-1 text-right">{form.subtitle.length}/120</p>
        </div>
      )}
    </motion.div>
  )
}

// ─── Life Photo item component ───────────────────────────────────────────────
function LifePhotoItem({ photo, onRemove, onDateChange }) {
  return (
    <div className="relative group rounded-xl overflow-hidden" style={{ aspectRatio:'1' }}>
      <img src={photo.preview} alt="" className="w-full h-full object-cover" />
      {/* Date badge */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
        {photo.takenAt ? (
          <p className="text-[0.55rem] text-white/70 text-center truncate">
            {new Date(photo.takenAt * 1000).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
          </p>
        ) : (
          <input
            type="date"
            onChange={e => onDateChange(photo.id, e.target.value)}
            className="w-full text-[0.55rem] text-white bg-transparent border-none outline-none text-center"
            placeholder="Add date"
          />
        )}
      </div>
      {/* Uploading overlay */}
      {photo.uploading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
        </div>
      )}
      {/* Remove */}
      <button
        onClick={() => onRemove(photo.id)}
        className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
      >✕</button>
    </div>
  )
}

function StepStory({ form, setForm, lifePhotos, setLifePhotos, copy }) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const MIN_PHOTOS = 5
  const photoCount = lifePhotos.length
  const remaining  = Math.max(0, MIN_PHOTOS - photoCount)

  async function handlePhotos(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)

    for (const file of files) {
      const photoId  = Math.random().toString(36).slice(2)
      const preview  = URL.createObjectURL(file)
      const takenAt  = await readExifDate(file)

      // Add as pending
      setLifePhotos(prev => [...prev, { id: photoId, preview, takenAt, uploading: true, url: null }])

      try {
        const url = await uploadImage(file, () => {}, 'memorials')
        setLifePhotos(prev => prev.map(p => p.id === photoId ? { ...p, url, uploading: false } : p))
      } catch {
        setLifePhotos(prev => prev.filter(p => p.id !== photoId))
      }
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function removePhoto(photoId) {
    setLifePhotos(prev => prev.filter(p => p.id !== photoId))
  }

  function updatePhotoDate(photoId, dateStr) {
    const ts = dateStr ? Math.floor(new Date(dateStr).getTime() / 1000) : null
    setLifePhotos(prev => prev.map(p => p.id === photoId ? { ...p, takenAt: ts } : p))
  }

  return (
    <motion.div
      key="step-story"
      initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="space-y-6"
    >

      {/* ── Life Photos — required min 5 ────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim">
            Life photos
          </label>
          <span className={`text-[0.6rem] font-bold tracking-wider uppercase ${photoCount >= MIN_PHOTOS ? 'text-emerald-400' : 'text-amber-400'}`}>
            {photoCount}/{MIN_PHOTOS} {photoCount < MIN_PHOTOS ? `— add ${remaining} more` : '✓ Ready'}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-white/10 rounded-full overflow-hidden mb-3">
          <div
            className="h-full transition-all rounded-full"
            style={{
              width: `${Math.min(100, (photoCount / MIN_PHOTOS) * 100)}%`,
              background: photoCount >= MIN_PHOTOS ? '#34d399' : '#f59e0b',
            }}
          />
        </div>

        {/* Grid + upload slot */}
        <div className="grid grid-cols-3 gap-2">
          {lifePhotos.map(photo => (
            <LifePhotoItem
              key={photo.id}
              photo={photo}
              onRemove={removePhoto}
              onDateChange={updatePhotoDate}
            />
          ))}
          {/* Upload slot */}
          <button
            onClick={() => fileRef.current?.click()}
            className="aspect-square rounded-xl border-2 border-dashed border-white/15 flex flex-col items-center justify-center cursor-pointer hover:border-gold/40 transition-all text-white/25 hover:text-white/50"
          >
            <span className="text-xl mb-1">+</span>
            <span className="text-[0.55rem] text-center leading-tight">Add<br/>photos</span>
          </button>
        </div>

        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotos} />

        <p className="text-[0.6rem] text-white/25 mt-2 leading-relaxed">
          Dates are read automatically from photo metadata. If no date is found, tap the photo to add one. The Life Reel arranges photos in chronological order.
        </p>
      </div>

      {/* ── Theme colour ─────────────────────────────────────────────────── */}
      <div>
        <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">
          Memorial theme colour
        </label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c => (
            <button
              key={c.hex}
              onClick={() => setForm(f => ({ ...f, themeHex: c.hex }))}
              style={{ background: c.hex }}
              title={c.label}
              className={`w-10 h-10 rounded-full border-2 transition-all ${
                form.themeHex === c.hex ? 'border-gold scale-110 shadow-lg shadow-gold/30' : 'border-transparent hover:scale-105'
              }`}
            />
          ))}
        </div>
        <p className="text-[0.6rem] text-white/25 mt-1">This colour sets the accent theme throughout the memorial page.</p>
      </div>

      {/* ── Voice recording ──────────────────────────────────────────────── */}
      <VoiceRecorder form={form} setForm={setForm} />

      {/* ── Bio ──────────────────────────────────────────────────────────── */}
      <div>
        <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">
          {copy.bioLabel}
        </label>
        <textarea
          value={form.bio}
          onChange={set('bio')}
          rows={5}
          placeholder={typeof copy.bioPlaceholder === 'function' ? copy.bioPlaceholder(form.name) : copy.bioPlaceholder}
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-gold/40 resize-none transition-colors"
        />
        <p className="text-[0.6rem] text-white/20 mt-1 text-right">{form.bio.length} characters</p>
      </div>

      {/* ── Location ─────────────────────────────────────────────────────── */}
      <div>
        <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">
          {copy.locationLabel}
        </label>
        <input
          value={form.location}
          onChange={set('location')}
          placeholder={copy.locationPlaceholder}
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-gold/40 transition-colors"
        />
      </div>
    </motion.div>
  )
}

function StepPublish({ form, setForm, isSelf, copy }) {
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
      <div className="relative h-36 rounded-2xl overflow-hidden"
        style={{ background: form.themeHex ? `linear-gradient(135deg, ${form.themeHex}cc, ${form.themeHex}66)` : 'linear-gradient(135deg, #57534ecc, #292524cc)' }}>
        {form.photoUrl && (
          <img src={form.photoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
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
          {copy.visibilityLabel}
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
          <div className="text-sm font-semibold text-white">{copy.tributesLabel}</div>
          <div className="text-xs text-white/40 mt-0.5">{copy.tributesHelp}</div>
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
  pronouns:      'they',   // 'he' | 'she' | 'they' — only meaningful when !isSelf
  relation:      '',
  subtitle:      '',
  alive:         false,
  birthYear:     '',
  deathYear:     '',
  bio:           '',
  location:      '',
  countryCode:   '',
  countryName:   '',
  themeHex:      COLORS[0].hex,
  photoUrl:      null,
  voiceUrl:      null,
  voiceDuration: null,
  visibility:    'public',
  allowTributes: true,
})

export default function CreateMemorialPage() {
  const navigate   = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast }  = useToast()
  const { user }   = db.useAuth()

  // Load creator's profile — used to:
  //   • pre-fill country as a smart default for both modes
  //   • pre-fill name + photo from profile in SELF mode (so the memorial syncs
  //     with the user's account identity)
  const { data: profileData } = db.useQuery(
    user ? { profiles: { $: { where: { userId: user.id } } } } : null
  )
  const profile             = profileData?.profiles?.[0]
  const creatorCountryCode  = profile?.countryCode || ''
  const creatorDisplayName  = profile?.displayName || ''
  const creatorPhoto        = profile?.photoUrl || ''

  // Guest users (signed in with signInAsGuest — no email) must create a real
  // account before they can publish a memorial.
  const isGuest = !!(user && !user.email)

  const isSelf = searchParams.get('self') === '1'

  const [step,       setStep]       = useState(0)
  const [form,       setForm]       = useState(initForm)
  const [lifePhotos, setLifePhotos] = useState([])   // { id, preview, url, takenAt, uploading }
  const [saving,     setSaving]     = useState(false)
  const [showGuestGate, setShowGuestGate] = useState(false)

  // Adaptive copy — single source of truth for every label/placeholder/helper.
  const copy = useMemo(() => getCopy(isSelf, form.pronouns), [isSelf, form.pronouns])

  // ── Pre-fill country from profile (both modes) ──────────────────────────────
  useEffect(() => {
    if (!creatorCountryCode) return
    setForm(f => {
      if (f.countryCode) return f          // user already picked — don't overwrite
      const country = findCountry(creatorCountryCode)
      if (!country) return f
      return { ...f, countryCode: country.code, countryName: country.name }
    })
  }, [creatorCountryCode])

  // ── Pre-fill name + photo from profile (SELF mode only) ─────────────────────
  // The memorial in self mode IS the user's living legacy — the name on it
  // should match the user's account name. Pre-fill once on load; don't
  // overwrite if the user has already edited the field.
  useEffect(() => {
    if (!isSelf) return
    setForm(f => {
      const next = { ...f }
      let changed = false
      if (!f.name && creatorDisplayName) { next.name = creatorDisplayName; changed = true }
      if (!f.photoUrl && creatorPhoto)   { next.photoUrl = creatorPhoto;    changed = true }
      return changed ? next : f
    })
  }, [isSelf, creatorDisplayName, creatorPhoto])

  const MIN_PHOTOS = 5

  function validateStep() {
    if (step === 0) {
      if (!form.name.trim()) {
        toast.warning(isSelf ? 'Please enter your name' : 'Please enter their name')
        return false
      }
      if (!isSelf && !form.pronouns) {
        toast.warning('Please select pronouns')
        return false
      }
    }
    if (step === 1) {
      // Hard block — must have at least 5 uploaded (not just previewed) photos
      const uploaded = lifePhotos.filter(p => p.url && !p.uploading)
      if (uploaded.length < MIN_PHOTOS) {
        toast.warning(`Please upload at least ${MIN_PHOTOS} life photos (${uploaded.length}/${MIN_PHOTOS} done)`)
        return false
      }
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

    // Publish — guests must upgrade to a real account first
    if (!user) { toast.error('Please sign in to create a memorial'); navigate('/auth'); return }
    if (isGuest) { setShowGuestGate(true); return }
    setSaving(true)
    try {
      const memId = id()
      const years = form.birthYear
        ? form.deathYear
          ? `${form.birthYear} — ${form.deathYear}`
          : `Born ${form.birthYear}`
        : ''

      // Capture voice via ElevenLabs if a voice recording was uploaded
      let elevenLabsVoiceId = null
      if (form.voiceUrl) {
        try {
          elevenLabsVoiceId = await cloneVoice(form.voiceUrl, form.name.trim())
          if (elevenLabsVoiceId) {
            toast.success('Voice memory captured ✦')
          }
        } catch {
          // Non-blocking — fall back to Web Speech API
        }
      }

      // Build photo transactions — each uploaded photo links to the memorial
      const photoTxs = lifePhotos
        .filter(p => p.url)
        .map(p => {
          const photoId = id()
          return db.tx.photos[photoId]
            .update({
              url:       p.url,
              takenAt:   p.takenAt || null,
              createdAt: Date.now(),
              source:    'upload',
            })
            .link({ memorial: memId })
        })

      await db.transact([
        db.tx.memorials[memId].update({
          name:              form.name.trim(),
          subtitle:          form.subtitle.trim(),
          relation:          isSelf ? 'self' : form.relation.trim(),
          bio:               form.bio.trim(),
          location:          form.location.trim(),
          alive:             form.alive,
          birthYear:         form.birthYear ? String(form.birthYear) : undefined,
          deathYear:         !form.alive && form.deathYear ? String(form.deathYear) : undefined,
          years,
          themeHex:          form.themeHex || COLORS[0].hex,
          photo:             form.photoUrl,
          visibility:        form.visibility,
          allowTributes:     form.allowTributes,
          voiceUrl:          form.voiceUrl,
          voiceDuration:     form.voiceDuration,
          elevenLabsVoiceId: elevenLabsVoiceId,
          creatorId:         user.id,
          createdBy:         user.id,
          createdAt:         Date.now(),
          updatedAt:         Date.now(),
          isSelf:            isSelf || undefined,
          countryCode:       form.countryCode || undefined,
          // pronouns is only meaningful for "other" memorials — self uses
          // the creator's own profile data and addresses them in 2nd person.
          pronouns:          isSelf ? undefined : (form.pronouns || 'they'),
        }),
        ...photoTxs,
      ])

      toast.success(isSelf
        ? copy.successText
        : `${form.name}'s ${copy.successText}`
      )
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

      {/* ── Guest gate modal ──────────────────────────────────────────────── */}
      {showGuestGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-sm glass-strong rounded-3xl p-8 text-center border border-gold/20">
            <div className="text-4xl mb-4">✦</div>
            <h2 className="font-display text-2xl font-bold text-white mb-2">Create an account</h2>
            <p className="text-sm text-white/55 leading-relaxed mb-6">
              You're browsing as a guest. Create a free account to save this memorial, manage your vault, and access everything you build.
            </p>
            <button
              onClick={() => navigate('/auth')}
              className="w-full py-4 rounded-2xl text-sm font-bold text-black metal-btn mb-3"
            >
              Create account / Sign in →
            </button>
            <button
              onClick={() => setShowGuestGate(false)}
              className="w-full py-3 text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              Continue browsing as guest
            </button>
          </div>
        </div>
      )}

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
            {copy.stepDescs[STEPS[step].key]}
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
          {copy.stepTitles[STEPS[step].key]}
        </h1>
        {step === 0 && (
          <p className="text-xs text-white/35 mt-1">{copy.heroIntro}</p>
        )}
      </div>

      {/* ── Step content ───────────────────────────────────────────────────── */}
      <div className="px-5">
        <AnimatePresence mode="wait">
          {step === 0 && <StepPerson  key="p" form={form} setForm={setForm} isSelf={isSelf} copy={copy} />}
          {step === 1 && <StepStory   key="s" form={form} setForm={setForm} lifePhotos={lifePhotos} setLifePhotos={setLifePhotos} copy={copy} />}
          {step === 2 && <StepPublish key="c" form={form} setForm={setForm} isSelf={isSelf} copy={copy} />}
        </AnimatePresence>
      </div>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 p-5 z-20" style={{ background: 'linear-gradient(to top, #000 60%, transparent)' }}>
        <div className="max-w-sm mx-auto">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleNext}
            disabled={saving}
            className="w-full py-4 rounded-2xl text-sm font-bold tracking-wide text-black metal-btn disabled:opacity-50"
          >
            {saving
              ? <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-black/20 border-t-black/70 rounded-full animate-spin" />
                  {isSelf ? 'Creating your legacy…' : 'Creating memorial…'}
                </span>
              : step < STEPS.length - 1 ? 'Continue →' : copy.ctaPublish
            }
          </motion.button>
        </div>
      </div>

    </div>
  )
}
