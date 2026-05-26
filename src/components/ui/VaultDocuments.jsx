// src/components/ui/VaultDocuments.jsx
// Official document storage for the Legacy Vault.
// Supports PDF, Word (.doc/.docx), images, and any file type.
// Each document gets an inline preview (PDF page 1, image thumbnail) or a
// typed icon + "Open" for formats with no inline preview (Word, etc.).
//
// Used inside LegacyLettersPage VaultContent (view === 'documents').

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { id } from '@instantdb/react'
import { db } from '../../lib/instant'
import { uploadDocument, documentPreviewUrl } from '../../lib/storage'

const DOC_CATEGORIES = [
  { value:'will',       label:'Will / Testament',  icon:'📜', accent:'#FFD700' },
  { value:'deed',       label:'Property Deed',     icon:'🏠', accent:'#34D399' },
  { value:'insurance',  label:'Insurance Policy',  icon:'🛡', accent:'#38BDF8' },
  { value:'medical',    label:'Medical Directive', icon:'🏥', accent:'#FB7185' },
  { value:'financial',  label:'Financial Record',  icon:'💰', accent:'#FFB347' },
  { value:'legal',      label:'Legal Document',    icon:'⚖️', accent:'#C084FC' },
  { value:'identity',   label:'Identity / Cert.',  icon:'🪪', accent:'#4ECDC4' },
  { value:'other',      label:'Other',             icon:'📎', accent:'#9CA3AF' },
]

const ACCEPTED =
  '.pdf,.doc,.docx,.txt,.rtf,.odt,.jpg,.jpeg,.png,.webp,.gif,.heic,.xls,.xlsx,.csv,.ppt,.pptx'

function catOf(value) {
  return DOC_CATEGORIES.find(c => c.value === value) || DOC_CATEGORIES.at(-1)
}
function fmtSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes/1024).toFixed(0)} KB`
  return `${(bytes/1048576).toFixed(1)} MB`
}
function extBadge(ext) {
  return (ext || '').toUpperCase().slice(0, 4)
}

// ─── Single document card (hooks at top — safe in a map via component) ─────────

function DocCard({ doc, onDelete }) {  // onDelete=null means view-only (family member)
  const [confirm, setConfirm] = useState(false)
  const [open,    setOpen]    = useState(false)
  const cat     = catOf(doc.category)
  const preview = documentPreviewUrl(doc.fileUrl, doc.ext)

  return (
    <motion.div layout initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, scale:0.97 }}
      className="metal-card rounded-2xl overflow-hidden">

      {/* Preview strip */}
      <div className="relative h-40 bg-black/40 flex items-center justify-center cursor-pointer"
        onClick={() => preview ? setOpen(true) : window.open(doc.fileUrl, '_blank')}>
        {preview ? (
          <img loading="lazy" decoding="async" src={preview} alt={doc.title} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="text-4xl">{cat.icon}</span>
            <span className="text-[0.6rem] font-bold tracking-widest px-2 py-1 rounded"
              style={{ background:`${cat.accent}18`, color:cat.accent, border:`1px solid ${cat.accent}30` }}>
              {extBadge(doc.ext) || 'FILE'}
            </span>
          </div>
        )}
        {/* Category tag */}
        <span className="absolute top-2.5 left-2.5 text-[0.55rem] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full"
          style={{ background:'rgba(0,0,0,0.55)', color:cat.accent, border:`1px solid ${cat.accent}35`, backdropFilter:'blur(8px)' }}>
          {cat.label}
        </span>
      </div>

      {/* Meta */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{doc.title || doc.fileName}</p>
            <p className="text-[0.62rem] text-white/35 mt-0.5">
              {extBadge(doc.ext)} · {fmtSize(doc.fileSize)} · {new Date(doc.createdAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
            </p>
          </div>
          {onDelete && (
            <button
              onClick={() => { if (confirm) onDelete(doc.id); else { setConfirm(true); setTimeout(()=>setConfirm(false),3000) } }}
              className={`text-xs flex-shrink-0 transition-colors ${confirm ? 'text-rose' : 'text-white/15 hover:text-white/40'}`}>
              {confirm ? 'Delete?' : '✕'}
            </button>
          )}
        </div>

        {doc.note && <p className="text-xs text-white/45 leading-relaxed mt-2">{doc.note}</p>}

        <div className="flex gap-2 mt-3">
          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
            className="flex-1 text-center py-2.5 rounded-xl text-xs font-bold metal-btn text-black">
            Open
          </a>
          <a href={doc.fileUrl} download={doc.fileName}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold rubber-btn text-white/60 hover:text-white">
            ↓
          </a>
        </div>
      </div>

      {/* Lightbox preview */}
      <AnimatePresence>
        {open && preview && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-5">
            <motion.img initial={{ scale:0.92 }} animate={{ scale:1 }} exit={{ scale:0.92 }}
              src={preview} alt="" className="max-w-full max-h-[85vh] rounded-2xl object-contain"
              onClick={e => e.stopPropagation()} />
            <button onClick={() => setOpen(false)}
              className="absolute top-6 right-6 w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white"
              style={{ background:'rgba(255,255,255,0.10)', backdropFilter:'blur(10px)' }}>✕</button>
            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
              className="absolute bottom-6 left-1/2 -translate-x-1/2 metal-btn text-black text-xs font-bold px-6 py-3 rounded-full"
              onClick={e => e.stopPropagation()}>
              Open full document ↗
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Upload form ──────────────────────────────────────────────────────────────

function UploadForm({ memorialId, onDone, onCancel }) {
  const [file,     setFile]     = useState(null)
  const [title,    setTitle]    = useState('')
  const [category, setCategory] = useState('will')
  const [note,     setNote]     = useState('')
  const [progress, setProgress] = useState(0)
  const [busy,     setBusy]     = useState(false)
  const [error,    setError]    = useState('')
  const fileRef = useRef()

  function pick(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 20 * 1048576) { setError('File too large (max 20 MB).'); return }
    setError('')
    setFile(f)
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''))
  }

  async function submit() {
    if (!file || !title.trim()) return
    setBusy(true); setError('')
    try {
      const up = await uploadDocument(file, setProgress, 'whowasi/vault-documents')
      await db.transact([
        db.tx.documents[id()].update({
          title:     title.trim(),
          category,
          note:      note.trim(),
          fileUrl:   up.url,
          fileName:  up.fileName,
          fileType:  up.fileType,
          fileSize:  up.fileSize,
          ext:       up.ext,
          createdAt: Date.now(),
        }).link({ memorial: memorialId }),
      ])
      onDone()
    } catch (err) {
      setError(err.message || 'Upload failed. Check your connection and try again.')
      setBusy(false)
    }
  }

  const inputCls = 'w-full inset-field rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none'

  return (
    <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}
      className="metal-card rounded-3xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-display text-lg font-bold text-white">Add a document</p>
        <button onClick={onCancel} className="text-white/30 hover:text-white/60 text-sm">✕</button>
      </div>

      {/* Dropzone */}
      <div onClick={() => fileRef.current?.click()}
        className="rounded-2xl border-2 border-dashed border-white/15 hover:border-gold/40 transition-colors p-6 text-center cursor-pointer">
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <span className="text-2xl">{catOf(category).icon}</span>
            <div className="text-left">
              <p className="text-sm text-white font-medium truncate max-w-[200px]">{file.name}</p>
              <p className="text-[0.6rem] text-white/40">{fmtSize(file.size)}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="text-3xl opacity-30 mb-2">⬆</div>
            <p className="text-sm text-white/55">Tap to choose a file</p>
            <p className="text-[0.6rem] text-white/30 mt-1">PDF, Word, images, spreadsheets — max 20 MB</p>
          </>
        )}
      </div>
      <input ref={fileRef} type="file" accept={ACCEPTED} className="hidden" onChange={pick} />

      <div>
        <label className="block text-[0.6rem] font-bold tracking-[0.18em] uppercase text-cream-dim mb-1.5">Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Last Will and Testament" className={inputCls} />
      </div>

      <div>
        <label className="block text-[0.6rem] font-bold tracking-[0.18em] uppercase text-cream-dim mb-2">Category</label>
        <div className="grid grid-cols-4 gap-2">
          {DOC_CATEGORIES.map(c => (
            <button key={c.value} onClick={() => setCategory(c.value)}
              className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-center transition-all ${
                category === c.value ? 'text-white' : 'text-white/40 hover:text-white/70'
              }`}
              style={category === c.value
                ? { background:`${c.accent}1f`, border:`1px solid ${c.accent}45` }
                : { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-base">{c.icon}</span>
              <span className="text-[0.5rem] leading-tight">{c.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[0.6rem] font-bold tracking-[0.18em] uppercase text-cream-dim mb-1.5">Note (optional)</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
          placeholder="Where the original is kept, instructions, etc."
          className={inputCls + ' resize-none'} />
      </div>

      {error && <p className="text-xs text-rose bg-rose/10 border border-rose/20 rounded-xl px-3 py-2">{error}</p>}

      {busy && (
        <div className="space-y-1.5">
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-gold to-coral transition-all" style={{ width:`${progress}%` }} />
          </div>
          <p className="text-[0.6rem] text-white/40 text-center">Uploading… {progress}%</p>
        </div>
      )}

      <button onClick={submit} disabled={!file || !title.trim() || busy}
        className="w-full py-3.5 rounded-2xl text-sm font-bold metal-btn text-black disabled:opacity-40">
        {busy ? 'Securing in vault…' : 'Add to vault 🔒'}
      </button>
    </motion.div>
  )
}

// ─── Documents view (drop into VaultContent) ──────────────────────────────────
// isOwner=true → full upload + delete access
// isOwner=false → view and download only (family members, external access)

export default function VaultDocuments({ memorialId, documents = [], onBack, isOwner = true }) {
  const [adding, setAdding] = useState(false)
  const sorted = [...documents].sort((a,b) => (b.createdAt||0)-(a.createdAt||0))

  async function deleteDoc(docId) {
    if (!isOwner) return
    await db.transact([db.tx.documents[docId].delete()])
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="metal-surface px-5 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} className="w-8 h-8 rubber-btn rounded-full flex items-center justify-center text-white/50 text-sm flex-shrink-0">←</button>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Official Documents</p>
          <p className="text-[0.6rem] text-white/35">{sorted.length} secured{!isOwner && ' · view & download only'}</p>
        </div>
        {isOwner && !adding && (
          <button onClick={() => setAdding(true)} className="metal-btn text-black text-xs font-bold px-4 py-2 rounded-full">+ Add</button>
        )}
      </div>

      <div className="px-5 pt-5 space-y-4">
        <AnimatePresence>
          {isOwner && adding && (
            <UploadForm memorialId={memorialId}
              onDone={() => setAdding(false)} onCancel={() => setAdding(false)} />
          )}
        </AnimatePresence>

        {sorted.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl opacity-15 mb-4">📂</div>
            {isOwner ? (
              <>
                <p className="text-white/35 text-sm mb-2">No documents yet.</p>
                <p className="text-white/25 text-xs mb-6 max-w-xs mx-auto leading-relaxed">
                  Store wills, deeds, insurance policies, medical directives — anything
                  your family will need. PDF, Word, and images all supported.
                </p>
                <button onClick={() => setAdding(true)} className="metal-btn text-black text-sm font-bold px-6 py-3 rounded-full">
                  Add the first document
                </button>
              </>
            ) : (
              <p className="text-white/35 text-sm">No documents have been shared yet.</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AnimatePresence mode="popLayout">
              {sorted.map(d => <DocCard key={d.id} doc={d} onDelete={isOwner ? deleteDoc : null} />)}
            </AnimatePresence>
          </div>
        )}

        {!isOwner && sorted.length > 0 && (
          <p className="text-center text-xs text-white/30 py-2">
            You can view and download these documents. Only the account owner can add or remove files.
          </p>
        )}
      </div>
    </div>
  )
}
