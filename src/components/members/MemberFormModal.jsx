// src/components/members/MemberFormModal.jsx
// Slide-up modal to add a new family member or edit an existing one.
// Writes to InstantDB familyMembers collection.

import { useState, useRef } from 'react'
import { motion }            from 'framer-motion'
import { id }                from '@instantdb/react'
import { db }                from '../../lib/instant'

const RELATIONS = [
  'Self','Spouse','Partner','Child','Parent','Sibling',
  'Grandparent','Grandchild','Aunt','Uncle','Niece','Nephew',
  'Cousin','Great Grandparent','Great Uncle','Great Aunt',
  'In-Law','Step-Parent','Step-Child','Adopted Child','Other',
]

const RING_OPTIONS = [
  { value: 1, label: 'Ring 1 — Immediate' },
  { value: 2, label: 'Ring 2 — Parents'   },
  { value: 3, label: 'Ring 3 — Extended'  },
]

function autoAvatar(name = '') {
  const parts = name.trim().split(' ')
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

function initForm(existing) {
  return {
    name:       existing?.name       ?? '',
    born:       existing?.born       ?? '',
    died:       existing?.died       ?? '',
    alive:      existing?.alive      ?? true,
    relation:   existing?.relation   ?? 'Other',
    generation: existing?.generation ?? 1,
    ring:       existing?.ring       ?? 1,
    angle:      existing?.angle      ?? Math.floor(Math.random() * 360),
    avatar:     existing?.avatar     ?? '',
    bio:        existing?.bio        ?? '',
    byMarriage: existing?.byMarriage ?? false,
    photo:      existing?.photo      ?? null,
  }
}

export default function MemberFormModal({ user, existing, onClose }) {
  const [form, setForm]         = useState(() => initForm(existing))
  const [error, setError]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [preview, setPreview]   = useState(existing?.photo ?? null)
  const [pendingFile, setPendingFile] = useState(null)
  const fileRef = useRef()

  const set  = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const setB = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function handleNameChange(e) {
    const name = e.target.value
    setForm(f => ({ ...f, name, avatar: autoAvatar(name) }))
  }

  function handlePhotoSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setPendingFile(file)
    setPreview(URL.createObjectURL(file))
  }

  async function uploadPhoto(file, memberId) {
    // Replace with your preferred storage upload (Cloudinary, Supabase storage, etc.)
    // Returns a public URL string
    // Example using a hypothetical upload endpoint:
    const formData = new FormData()
    formData.append('file', file)
    formData.append('memberId', memberId)
    // const res  = await fetch('/api/upload', { method: 'POST', body: formData })
    // const data = await res.json()
    // return data.url
    return null // remove this line once you add your upload logic
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required.'); return }
    if (!form.born)         { setError('Birth year is required.'); return }
    setError(''); setSaving(true)

    try {
      const memberId = existing?.id ?? id()
      let photoUrl   = form.photo

      if (pendingFile) {
        photoUrl = await uploadPhoto(pendingFile, memberId)
      }

      await db.transact([
        db.tx.familyMembers[memberId].update({
          name:       form.name.trim(),
          avatar:     form.avatar || autoAvatar(form.name),
          born:       Number(form.born),
          died:       form.alive ? null : Number(form.died) || null,
          alive:      form.alive,
          relation:   form.relation,
          generation: Number(form.generation),
          ring:       Number(form.ring),
          angle:      Number(form.angle),
          byMarriage: form.byMarriage,
          bio:        form.bio.trim(),
          photo:      photoUrl,
          ownerId:    user.id,
          updatedAt:  Date.now(),
          ...(existing ? {} : { createdAt: Date.now() }),
        }),
      ])
      onClose()
    } catch (err) {
      setError('Save failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-gold/40 transition-colors'
  const selectCls = inputCls + ' appearance-none'

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm"
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d0d] border-t border-white/10 rounded-t-3xl px-5 pt-4 pb-10 max-h-[92vh] overflow-y-auto"
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />

        <h3 className="font-display text-2xl font-bold text-white mb-1">
          {existing ? 'Edit member' : 'Add member'}
        </h3>
        <p className="text-xs text-white/40 mb-6">Family record</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-xs text-red-400 mb-4">
            {error}
          </div>
        )}

        {/* Photo */}
        <div
          onClick={() => fileRef.current.click()}
          className="w-full h-28 rounded-2xl border border-dashed border-white/15 flex flex-col items-center justify-center cursor-pointer hover:border-gold/30 transition-colors mb-5 overflow-hidden relative"
        >
          {preview ? (
            <img src={preview} alt="" className="w-full h-full object-cover" />
          ) : (
            <>
              <span className="text-2xl opacity-20 mb-1">✿</span>
              <span className="text-xs text-white/30">Upload photo</span>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />

        {/* Name */}
        <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">Full name</label>
        <input className={inputCls + ' mb-4'} value={form.name} onChange={handleNameChange} placeholder="First Last" />

        {/* Avatar */}
        <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">Initials</label>
        <input
          className={inputCls + ' mb-4 uppercase tracking-widest w-20'}
          value={form.avatar}
          onChange={set('avatar')}
          maxLength={2}
          placeholder="AB"
        />

        {/* Status */}
        <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">Status</label>
        <div className="flex gap-2 mb-4">
          {[{ v: true, label: 'Living' }, { v: false, label: 'Deceased' }].map(({ v, label }) => (
            <button
              key={label}
              onClick={() => setB('alive', v)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                form.alive === v
                  ? 'bg-gradient-to-r from-gold to-sky text-black'
                  : 'glass border border-white/10 text-white/50 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Born / Died */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">Born</label>
            <input className={inputCls} type="number" value={form.born} onChange={set('born')} placeholder="1942" />
          </div>
          {!form.alive && (
            <div>
              <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">Passed</label>
              <input className={inputCls} type="number" value={form.died} onChange={set('died')} placeholder="2005" />
            </div>
          )}
        </div>

        {/* Relation */}
        <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">Relation to you</label>
        <select className={selectCls + ' mb-4'} value={form.relation} onChange={set('relation')}>
          {RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        {/* Ring */}
        <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">Orbital ring</label>
        <select
          className={selectCls + ' mb-4'}
          value={form.ring}
          onChange={e => setB('ring', Number(e.target.value))}
        >
          {RING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {/* By marriage */}
        <div
          className="flex items-center gap-3 mb-4 cursor-pointer"
          onClick={() => setB('byMarriage', !form.byMarriage)}
        >
          <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
            form.byMarriage ? 'border-gold bg-gold/20' : 'border-white/20'
          }`}>
            {form.byMarriage && <span className="text-gold text-xs">✓</span>}
          </div>
          <span className="text-sm text-white/60">Joined by marriage</span>
        </div>

        {/* Bio */}
        <label className="block text-[0.65rem] font-bold tracking-[0.2em] uppercase text-cream-dim mb-2">Bio / tribute</label>
        <textarea
          className={inputCls + ' resize-none mb-6'}
          rows={3}
          value={form.bio}
          onChange={set('bio')}
          placeholder="A short biography or tribute..."
        />

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm text-white/50 glass border border-white/10 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-[2] py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-gold to-sky text-black hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {saving ? 'Saving...' : existing ? 'Update member' : 'Add to family'}
          </button>
        </div>
      </motion.div>
    </>
  )
}
