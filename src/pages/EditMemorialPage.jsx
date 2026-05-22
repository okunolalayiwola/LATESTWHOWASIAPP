// src/pages/EditMemorialPage.jsx
// Pre-filled 3-step edit flow for existing memorials.
// Route: /memorial/:id/edit
// Only accessible to the memorial creator — redirects everyone else.
// Shares the same step UI as CreateMemorialPage for design consistency.

import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '../lib/instant'
import { uploadImage } from '../lib/storage'
import { useToast } from '../contexts/ToastContext'
import RelationPicker from '../components/ui/RelationPicker'
import { getRelationLabel } from '../lib/relations'

// ─── Config (shared with CreateMemorialPage) ──────────────────────────────────

const STEPS = [
  { desc: 'Edit basic info'      },
  { desc: 'Edit story & photo'   },
  { desc: 'AI portrait (talk-with)' },
  { desc: 'Privacy & save'       },
]

const FACE_PHOTOS_NEEDED = 5
const MAX_FACE_PHOTOS    = 5

const COLORS = [
  { value: 'from-stone-700 to-stone-900',    hex: '#57534e' },
  { value: 'from-amber-800 to-stone-900',    hex: '#92400e' },
  { value: 'from-blue-900 to-slate-900',     hex: '#1e3a5f' },
  { value: 'from-emerald-900 to-stone-900',  hex: '#064e3b' },
  { value: 'from-purple-900 to-slate-900',   hex: '#3b0764' },
  { value: 'from-rose-900 to-stone-900',     hex: '#881337' },
]

const VISIBILITY_OPTIONS = [
  { value: 'public',  emoji: '◎', title: 'Public',      desc: 'Anyone can find and view this memorial'       },
  { value: 'family',  emoji: '✿', title: 'Family only', desc: 'Only people with your invite link can view'   },
  { value: 'private', emoji: '☽', title: 'Private',     desc: 'Only you can see this memorial'               },
]

const inputCls = 'w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-gold/40 transition-colors'

// ─── Step 1: Person info ──────────────────────────────────────────────────────

function StepPerson({ form, setForm }) {
  const set  = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const setB = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const [showRelationPicker, setShowRelationPicker] = useState(false)
  const [relationError, setRelationError] = useState('')

  return (
    <motion.div key="ep" initial={{ opacity:0,x:30 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-30 }}
      transition={{ duration:0.25 }} className="space-y-5">
      <div>
        <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">Full name</label>
        <input autoFocus className={inputCls} value={form.name} onChange={set('name')} placeholder="e.g. Grace Okonkwo" />
      </div>
      <div>
        <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">Your relation to them</label>
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
        <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">Status</label>
        <div className="flex gap-2">
          {[{ v:false, label:'Passed away', emoji:'☽' },{ v:true, label:'Still living', emoji:'✿' }].map(opt => (
            <button key={String(opt.v)} onClick={() => setB('alive', opt.v)}
              className={`flex-1 flex flex-col items-center gap-1.5 py-4 rounded-2xl text-xs font-semibold transition-all ${
                form.alive===opt.v
                  ? 'bg-gradient-to-br from-gold/20 to-coral/20 border border-gold/40 text-white'
                  : 'glass border border-white/10 text-white/40 hover:text-white/70'
              }`}>
              <span className="text-xl">{opt.emoji}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">Birth year</label>
          <input className={inputCls} type="number" value={form.birthYear} onChange={set('birthYear')} placeholder="1935" />
        </div>
        {!form.alive && (
          <div>
            <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">Year passed</label>
            <input className={inputCls} type="number" value={form.deathYear} onChange={set('deathYear')} placeholder="2020" />
          </div>
        )}
      </div>
      <div>
        <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">One-line description</label>
        <input className={inputCls} value={form.subtitle} onChange={set('subtitle')} placeholder="A short description" maxLength={120} />
        <p className="text-[0.6rem] text-white/20 mt-1 text-right">{(form.subtitle||'').length}/120</p>
      </div>
    </motion.div>
  )
}

// ─── Step 2: Story & photo ────────────────────────────────────────────────────

function StepStory({ form, setForm }) {
  const [uploading,    setUploading]    = useState(false)
  const [uploadPct,    setUploadPct]    = useState(0)
  const [uploadError,  setUploadError]  = useState('')
  const [photoPreview, setPhotoPreview] = useState(form.photoUrl || null)
  const fileRef = useRef()
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handlePhoto(e) {
    const file = e.target.files[0]; if (!file) return
    setUploadError('')
    setPhotoPreview(URL.createObjectURL(file))
    setUploading(true)
    try {
      const url = await uploadImage(file, setUploadPct, 'memorials')
      setForm(f => ({ ...f, photoUrl: url }))
    } catch (err) {
      console.error('[edit memorial photo]', err)
      setUploadError(err?.message || 'Could not upload photo. Try again.')
      setPhotoPreview(form.photoUrl || null)
    } finally { setUploading(false); setUploadPct(0) }
  }

  return (
    <motion.div key="es" initial={{ opacity:0,x:30 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-30 }}
      transition={{ duration:0.25 }} className="space-y-5">
      <div>
        <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">Cover photo</label>
        <div onClick={() => fileRef.current.click()}
          className="relative w-full h-36 rounded-2xl border border-dashed border-white/15 flex flex-col items-center justify-center cursor-pointer hover:border-gold/30 transition-all overflow-hidden group">
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
          {uploading && <div className="absolute bottom-0 left-0 h-1 bg-gold transition-all" style={{ width:`${uploadPct}%` }} />}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
        {uploadError && (
          <p className="text-[0.65rem] text-coral mt-2">{uploadError}</p>
        )}
      </div>

      {!photoPreview && (
        <div>
          <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">Theme colour</label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map(c => (
              <button key={c.value} onClick={() => setForm(f => ({ ...f, color: c.value }))}
                style={{ background: c.hex }}
                className={`w-9 h-9 rounded-full border-2 transition-all ${form.color===c.value ? 'border-gold scale-110' : 'border-transparent hover:scale-105'}`} />
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">Life story</label>
        <textarea value={form.bio} onChange={set('bio')} rows={5}
          placeholder={form.name ? `Tell ${form.name}'s story...` : 'Tell their story...'}
          className={inputCls + ' resize-none'} />
        <p className="text-[0.6rem] text-white/20 mt-1 text-right">{(form.bio||'').length} characters</p>
      </div>

      <div>
        <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">Location / hometown</label>
        <input className={inputCls} value={form.location} onChange={set('location')} placeholder="e.g. Lagos, Nigeria" />
      </div>
    </motion.div>
  )
}

// ─── Step 3: AI Portrait (Nano-Banana talk-with portrait management) ────────
//
// Doubles as both "create from scratch" (if face training was skipped at
// memorial creation) and "regenerate" (if the existing portrait isn't good).
// Lets the owner:
//   • See the current portrait + status badge
//   • Regenerate using the existing 5 face references (1 click — no re-upload)
//   • Replace the references with new face photos (full re-upload flow)
//   • Remove the portrait entirely (falls back to cover photo)

function FacePhotoTile({ photo, onRemove }) {
  return (
    <div className="relative aspect-square rounded-xl overflow-hidden group">
      <img src={photo.preview || photo.url} alt="" className="w-full h-full object-cover" />
      {photo.checking && (
        <div className="absolute inset-0 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}
      {photo.rejected && (
        <div className="absolute inset-0 p-2 flex items-end"
          style={{ background: 'linear-gradient(to top, rgba(200,83,31,0.92), rgba(200,83,31,0.10) 70%)' }}>
          <p className="text-[0.55rem] text-white leading-tight">{photo.rejectReason || 'Not usable'}</p>
        </div>
      )}
      <button
        onClick={() => onRemove(photo.id)}
        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 10 }}
        aria-label="Remove">✕</button>
    </div>
  )
}

function StatusBadge({ status }) {
  if (status === 'pending') {
    return (
      <span className="text-[0.55rem] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-300 mr-1 animate-pulse" />
        Generating
      </span>
    )
  }
  if (status === 'generated') {
    return (
      <span className="text-[0.55rem] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
        ✓ Generated
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="text-[0.55rem] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30">
        ✕ Failed — try different photos
      </span>
    )
  }
  return null
}

function StepPortrait({ memorial, memorialId, toast }) {
  const [facePhotos,  setFacePhotos]  = useState([])
  const [working,     setWorking]     = useState(false)
  const [workMsg,     setWorkMsg]     = useState('')
  const fileRef = useRef()

  const hasPortrait       = !!memorial?.talkPortraitUrl
  const hasSavedFaceUrls  = Array.isArray(memorial?.faceTrainingUrls) && memorial.faceTrainingUrls.length >= FACE_PHOTOS_NEEDED
  const status            = memorial?.talkPortraitStatus
  const validCount        = facePhotos.filter(p => p.url && !p.rejected && !p.uploading && !p.checking).length

  async function handleSelectFiles(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const slotsLeft = MAX_FACE_PHOTOS - facePhotos.length
    const accepted  = files.slice(0, Math.max(0, slotsLeft))

    for (const file of accepted) {
      const photoId = Math.random().toString(36).slice(2)
      const preview = URL.createObjectURL(file)
      setFacePhotos(prev => [...prev, { id: photoId, preview, url: null, uploading: true, checking: false, rejected: false }])

      try {
        const url = await uploadImage(file, () => {}, 'memorials/face-training')
        setFacePhotos(prev => prev.map(p => p.id === photoId ? { ...p, url, uploading: false, checking: true } : p))

        const checkRes  = await fetch('/api/check-face', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ photoUrl: url }),
        })
        const checkData = await checkRes.json().catch(() => ({ ok: true }))

        if (checkData.ok) {
          setFacePhotos(prev => prev.map(p => p.id === photoId ? { ...p, checking: false } : p))
        } else {
          setFacePhotos(prev => prev.map(p => p.id === photoId
            ? { ...p, checking: false, rejected: true, rejectReason: checkData.reason || 'Not a clear face' } : p))
        }
      } catch (err) {
        setFacePhotos(prev => prev.map(p => p.id === photoId
          ? { ...p, uploading: false, checking: false, rejected: true, rejectReason: err?.message || 'Upload failed' } : p))
      }
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  function removePhoto(photoId) {
    setFacePhotos(prev => prev.filter(p => p.id !== photoId))
  }

  // Trigger Nano-Banana generation with whichever URLs we have
  async function triggerGenerate(photoUrls) {
    setWorking(true)
    setWorkMsg('Sending photos to AI…')
    try {
      // Mark pending immediately so the badge updates
      await db.transact([db.tx.memorials[memorialId].update({
        talkPortraitStatus: 'pending',
        ...(photoUrls.length === FACE_PHOTOS_NEEDED ? { faceTrainingUrls: photoUrls } : {}),
      })])

      setWorkMsg('AI is drawing the portrait — this takes 10-20 seconds…')
      const r = await fetch('/api/generate-talk-portrait', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ memorialId, name: memorial.name, photoUrls }),
      })
      const data = await r.json()

      if (data.ok && data.portraitUrl) {
        toast.success('Portrait ready ✦')
        setFacePhotos([])
      } else {
        toast.error(data.error || 'Generation failed — try different photos')
      }
    } catch (err) {
      console.error('[regenerate-portrait]', err)
      toast.error('Generation failed. Check your connection and try again.')
    } finally {
      setWorking(false)
      setWorkMsg('')
    }
  }

  function handleRegenerateExisting() {
    if (!hasSavedFaceUrls) return
    triggerGenerate(memorial.faceTrainingUrls)
  }

  async function handleUploadAndGenerate() {
    const urls = facePhotos.filter(p => p.url && !p.rejected && !p.uploading && !p.checking).map(p => p.url)
    if (urls.length < FACE_PHOTOS_NEEDED) {
      toast.warning(`Need ${FACE_PHOTOS_NEEDED} usable face photos (have ${urls.length})`)
      return
    }
    triggerGenerate(urls)
  }

  async function handleRemovePortrait() {
    if (!confirm('Remove the AI portrait? The talk-with screen will go back to using the cover photo.')) return
    setWorking(true)
    setWorkMsg('Removing portrait…')
    try {
      await db.transact([db.tx.memorials[memorialId].update({
        talkPortraitUrl:    null,
        talkPortraitAt:     null,
        talkPortraitStatus: null,
      })])
      toast.success('Portrait removed')
    } catch {
      toast.error('Could not remove. Try again.')
    } finally {
      setWorking(false)
      setWorkMsg('')
    }
  }

  return (
    <motion.div key="es-portrait" initial={{ opacity:0,x:30 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-30 }}
      transition={{ duration:0.25 }} className="space-y-6">

      {/* Explainer */}
      <div className="glass rounded-2xl p-5 border border-gold/15">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold/30 to-coral/30 flex items-center justify-center flex-shrink-0">
            <span className="text-base">✦</span>
          </div>
          <div className="flex-1">
            <p className="text-sm text-white font-semibold mb-1">AI talk-with portrait</p>
            <p className="text-[0.7rem] text-white/55 leading-relaxed">
              The portrait shown when family taps "Talk with {memorial?.name?.split(' ')[0] || 'them'}".
              Built from 5 face photos by Nano-Banana so the portrait looks like the real person,
              not a generic AI face.
            </p>
          </div>
        </div>
      </div>

      {/* Current state */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim">
            Current portrait
          </label>
          <StatusBadge status={status} />
        </div>

        {hasPortrait ? (
          <div className="flex gap-4">
            <div className="w-28 h-28 rounded-2xl overflow-hidden flex-shrink-0 border border-white/10">
              <img src={memorial.talkPortraitUrl} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              <p className="text-[0.65rem] text-white/45 leading-relaxed">
                {memorial.talkPortraitAt
                  ? `Generated ${new Date(memorial.talkPortraitAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}.`
                  : 'Generated.'}
              </p>
              {hasSavedFaceUrls && (
                <button
                  onClick={handleRegenerateExisting}
                  disabled={working}
                  className="text-[0.7rem] text-gold font-semibold hover:text-gold/80 disabled:opacity-40"
                >↻ Regenerate (same photos, new attempt)</button>
              )}
              <br />
              <button
                onClick={handleRemovePortrait}
                disabled={working}
                className="text-[0.7rem] text-red-400/80 font-semibold hover:text-red-400 disabled:opacity-40"
              >Remove portrait</button>
            </div>
          </div>
        ) : (
          <div className="glass rounded-2xl p-4 border border-white/10 text-center">
            <p className="text-xs text-white/50">
              No AI portrait yet. The talk-with screen is using the cover photo.
            </p>
            {hasSavedFaceUrls && (
              <button
                onClick={handleRegenerateExisting}
                disabled={working}
                className="mt-3 text-[0.7rem] text-gold font-semibold hover:text-gold/80 disabled:opacity-40"
              >↻ Generate from saved face photos</button>
            )}
          </div>
        )}
      </div>

      {/* Upload new face photos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim">
            {hasSavedFaceUrls ? 'Replace face photos' : 'Add face photos'}
          </label>
          <span className={`text-[0.6rem] font-bold tracking-wider uppercase ${
            validCount >= FACE_PHOTOS_NEEDED ? 'text-emerald-400' :
            validCount > 0 ? 'text-amber-400' : 'text-white/30'
          }`}>
            {validCount}/{FACE_PHOTOS_NEEDED}{validCount >= FACE_PHOTOS_NEEDED ? ' ✓' : ''}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {facePhotos.map(photo => (
            <FacePhotoTile key={photo.id} photo={photo} onRemove={removePhoto} />
          ))}
          {facePhotos.length < MAX_FACE_PHOTOS && (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={working}
              className="aspect-square rounded-xl border-2 border-dashed border-white/15 flex flex-col items-center justify-center cursor-pointer hover:border-gold/40 transition-all text-white/25 hover:text-white/50 disabled:opacity-40"
            >
              <span className="text-xl mb-1">+</span>
              <span className="text-[0.55rem] text-center leading-tight">Add<br/>face</span>
            </button>
          )}
        </div>

        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleSelectFiles} />

        <p className="text-[0.6rem] text-white/25 mt-2 leading-relaxed">
          Clear daylight or warm indoor light · face fills the frame · eyes visible (no heavy sunglasses) · one person per photo.
          Photos auto-rejected if blurry or face-less.
        </p>

        {validCount >= FACE_PHOTOS_NEEDED && (
          <button
            onClick={handleUploadAndGenerate}
            disabled={working}
            className="w-full mt-4 py-3 rounded-2xl text-sm font-bold metal-btn text-black disabled:opacity-50"
          >
            {working ? 'Generating…' : '✦ Generate portrait'}
          </button>
        )}
      </div>

      {/* Progress feedback */}
      {working && workMsg && (
        <div className="glass rounded-2xl p-4 border border-gold/20 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-gold/30 border-t-gold rounded-full animate-spin flex-shrink-0" />
          <p className="text-xs text-white/70">{workMsg}</p>
        </div>
      )}
    </motion.div>
  )
}

// ─── Step 4: Privacy ──────────────────────────────────────────────────────────

function StepPrivacy({ form, setForm }) {
  const years = form.birthYear && form.deathYear
    ? `${form.birthYear} — ${form.deathYear}`
    : form.birthYear ? `Born ${form.birthYear}` : ''

  return (
    <motion.div key="er" initial={{ opacity:0,x:30 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-30 }}
      transition={{ duration:0.25 }} className="space-y-5">

      {/* Preview card */}
      <div className={`relative h-32 rounded-2xl overflow-hidden bg-gradient-to-br ${form.color||'from-stone-800 to-stone-950'}`}>
        {form.photoUrl && <img src={form.photoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute bottom-0 left-0 p-4">
          <div className="font-display text-xl font-bold text-white">{form.name || 'Name'}</div>
          {years && <div className="text-xs text-white/50">{years}</div>}
        </div>
      </div>

      {/* Visibility */}
      <div>
        <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-3">Who can see this memorial?</label>
        <div className="space-y-2">
          {VISIBILITY_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setForm(f => ({ ...f, visibility: opt.value }))}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all ${
                form.visibility===opt.value
                  ? 'bg-gradient-to-r from-gold/15 to-coral/15 border border-gold/40'
                  : 'glass border border-white/10 hover:border-white/20'
              }`}>
              <span className="text-xl">{opt.emoji}</span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">{opt.title}</div>
                <div className="text-xs text-white/40 mt-0.5">{opt.desc}</div>
              </div>
              {form.visibility===opt.value && <span className="text-gold flex-shrink-0">✓</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Allow tributes toggle */}
      <div className="flex items-center justify-between glass rounded-2xl p-4 cursor-pointer"
        onClick={() => setForm(f => ({ ...f, allowTributes: !f.allowTributes }))}>
        <div>
          <div className="text-sm font-semibold text-white">Allow tributes</div>
          <div className="text-xs text-white/40 mt-0.5">Let others leave tributes and memories</div>
        </div>
        <div className={`w-11 h-6 rounded-full relative flex-shrink-0 transition-colors ${form.allowTributes ? 'bg-gold' : 'bg-white/10'}`}>
          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${form.allowTributes ? 'left-6' : 'left-1'}`} />
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function EditMemorialPage() {
  const { id: memorialId } = useParams()
  const navigate   = useNavigate()
  const { toast }  = useToast()
  const { user }   = db.useAuth()

  const [step,   setStep]   = useState(0)
  const [form,   setForm]   = useState(null)   // null = loading
  const [saving, setSaving] = useState(false)

  const { isLoading, data } = db.useQuery(
    memorialId ? { memorials: { $: { where: { id: memorialId } } } } : null
  )

  // Pre-fill form once memorial loads
  useEffect(() => {
    const m = data?.memorials?.[0]
    if (!m) return

    // Auth check: must be signed in
    if (!user) {
      toast.error('Please sign in to edit this memorial.')
      navigate('/auth', { replace: true })
      return
    }

    // Access check: only creator can edit
    if (m.creatorId && m.creatorId !== user.id) {
      toast.error('You don\'t have permission to edit this memorial.')
      navigate(`/memorial/${memorialId}`, { replace: true })
      return
    }

    setForm({
      name:          m.name          ?? '',
      relation:      m.relation      ?? '',
      subtitle:      m.subtitle      ?? '',
      alive:         m.alive         ?? false,
      birthYear:     m.birthYear     ?? '',
      deathYear:     m.deathYear     ?? '',
      bio:           m.bio           ?? '',
      location:      m.location      ?? '',
      color:         m.color         ?? COLORS[0].value,
      photoUrl:      m.photo        ?? null,
      visibility:    m.visibility    ?? 'public',
      allowTributes: m.allowTributes ?? true,
    })
  }, [data, user, memorialId, navigate, toast])

  async function handleSave() {
    if (!form?.name?.trim()) { toast.warning('Name is required'); return }
    setSaving(true)
    try {
      const years = form.birthYear
        ? form.deathYear
          ? `${form.birthYear} — ${form.deathYear}`
          : `Born ${form.birthYear}`
        : ''

      await db.transact([
        db.tx.memorials[memorialId].update({
          name:          form.name.trim(),
          subtitle:      form.subtitle.trim(),
          relation:      form.relation.trim(),
          bio:           form.bio.trim(),
          location:      form.location.trim(),
          alive:         form.alive,
          birthYear:     form.birthYear ? Number(form.birthYear) : null,
          deathYear:     !form.alive && form.deathYear ? Number(form.deathYear) : null,
          years,
          color:         form.color,
          photo:         form.photoUrl,
          visibility:    form.visibility,
          allowTributes: form.allowTributes,
          updatedAt:     Date.now(),
        }),
      ])
      toast.success('Memorial updated ✦')
      navigate(`/memorial/${memorialId}`)
    } catch {
      toast.error('Update failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // Loading / access pending
  if (isLoading || !form) {
    return (
      <div className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    )
  }

  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <div className="relative z-10 min-h-screen pb-36 flex flex-col">
      <div className="w-full max-w-xl mx-auto px-5 flex-1">

        {/* Top bar */}
        <div className="flex items-center justify-between pt-16 pb-4">
          <button
            onClick={() => step === 0 ? navigate(`/memorial/${memorialId}`) : setStep(s => s - 1)}
            className="w-9 h-9 glass rounded-full flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center">
            <p className="text-[0.6rem] font-bold tracking-[0.2em] uppercase text-cream-dim">{STEPS[step].desc}</p>
            <p className="text-xs text-white/30 mt-0.5">Step {step + 1} of {STEPS.length}</p>
          </div>
          {/* Cancel link back to memorial */}
          <a href={`/memorial/${memorialId}`} className="text-xs text-white/30 hover:text-white/60 transition-colors">
            Cancel
          </a>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-white/5 rounded-full overflow-hidden mb-7">
          <motion.div
            className="h-full bg-gradient-to-r from-gold to-sky rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        {/* Heading */}
        <div className="mb-7">
          <h1 className="font-display text-[clamp(2rem,5vw,2.8rem)] font-bold leading-tight">
            {step === 0 && <>Edit <span className="text-gradient-gold">details</span></>}
            {step === 1 && <>Edit <span className="text-gradient-gold">story</span></>}
            {step === 2 && <>AI <span className="text-gradient-gold">portrait</span></>}
            {step === 3 && <>Review & <span className="text-gradient-gold">save</span></>}
          </h1>
          <p className="text-xs text-white/35 mt-1">{form.name}</p>
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          {step === 0 && <StepPerson   key="p" form={form} setForm={setForm} />}
          {step === 1 && <StepStory    key="s" form={form} setForm={setForm} />}
          {step === 2 && <StepPortrait key="t" memorial={data?.memorials?.[0]} memorialId={memorialId} toast={toast} />}
          {step === 3 && <StepPrivacy  key="r" form={form} setForm={setForm} />}
        </AnimatePresence>

      </div>

      {/* CTA footer */}
      <div className="fixed bottom-0 left-0 right-0 z-30" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
        <div className="max-w-xl mx-auto px-5">
          <div className="bg-black/85 backdrop-blur-xl pt-4 pb-2 -mx-5 px-5 border-t border-white/5">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={step < STEPS.length - 1 ? () => setStep(s => s + 1) : handleSave}
              disabled={saving}
              className="w-full py-4 rounded-2xl text-sm font-bold tracking-wider bg-gradient-to-r from-gold to-sky text-black hover:opacity-90 disabled:opacity-50 transition-opacity mb-2"
            >
              {saving
                ? <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Saving changes...
                  </span>
                : step < STEPS.length - 1
                ? 'Continue →'
                : 'Save changes ✦'}
            </motion.button>
          </div>
        </div>
      </div>

    </div>
  )
}
