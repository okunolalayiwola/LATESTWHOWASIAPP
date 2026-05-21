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
  { desc: 'Edit basic info'    },
  { desc: 'Edit story & photo' },
  { desc: 'Privacy & save'     },
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

// ─── Step 3: Privacy ──────────────────────────────────────────────────────────

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
            {step === 2 && <>Review & <span className="text-gradient-gold">save</span></>}
          </h1>
          <p className="text-xs text-white/35 mt-1">{form.name}</p>
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          {step === 0 && <StepPerson  key="p" form={form} setForm={setForm} />}
          {step === 1 && <StepStory   key="s" form={form} setForm={setForm} />}
          {step === 2 && <StepPrivacy key="r" form={form} setForm={setForm} />}
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
