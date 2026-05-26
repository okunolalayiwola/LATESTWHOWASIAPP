// src/components/members/MemberDetailPanel.jsx
// Slide-up detail sheet for a family tree member.
// Shows profile, bio, life dates. Actions: edit, mark deceased, delete.

import { useState } from 'react'
import { motion }   from 'framer-motion'
import { db }       from '../../lib/instant'

function timeAgo(ts) {
  if (!ts) return ''
  const d = Math.floor((Date.now() - ts) / 86400000)
  if (d < 1) return 'today'
  if (d < 30) return `${d}d ago`
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function DetailRow({ label, value }) {
  if (!value) return null
  return (
    <div>
      <div className="text-[0.6rem] tracking-widest uppercase text-white/30 mb-0.5">{label}</div>
      <div className="text-sm text-white">{value}</div>
    </div>
  )
}

export default function MemberDetailPanel({ member, user, onClose, onEdit, onDeleted }) {
  const [showDecease, setShowDecease] = useState(false)
  const [deceaseYear, setDeceaseYear] = useState('')
  const [deleting,    setDeleting]    = useState(false)
  const [confirming,  setConfirming]  = useState(false)

  const isAlive = member.alive

  async function handleMarkDeceased() {
    if (!deceaseYear) return
    await db.transact([
      db.tx.familyMembers[member.id].update({
        alive: false,
        died:  Number(deceaseYear),
        updatedAt: Date.now(),
      }),
    ])
    setShowDecease(false)
  }

  async function handleDelete() {
    if (!confirming) { setConfirming(true); return }
    setDeleting(true)
    await db.transact([db.tx.familyMembers[member.id].delete()])
    onDeleted?.()
  }

  const sc = isAlive
    ? { badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', dot: 'bg-emerald-400' }
    : { badge: 'bg-amber-500/10  border-amber-500/20  text-amber-400',     dot: 'bg-amber-400'   }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d0d] border-t border-white/10 rounded-t-3xl px-5 pt-4 pb-10 max-h-[88vh] overflow-y-auto"
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />

        {/* Header */}
        <div className="flex gap-4 items-start mb-5">
          <div className={`w-16 h-16 rounded-2xl flex-shrink-0 flex items-center justify-center text-xl font-bold font-display overflow-hidden ${
            isAlive ? 'bg-emerald-900/40 border border-emerald-700/30 text-emerald-300' : 'bg-amber-900/30 border border-amber-700/20 text-amber-300'
          }`}>
            {member.photo
              ? <img loading="lazy" decoding="async" src={member.photo} alt="" className="w-full h-full object-cover" />
              : (member.avatar || member.name?.slice(0, 2).toUpperCase() || '?')}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-2xl font-bold text-white leading-tight truncate">
              {member.name}
            </h2>
            <p className="text-xs text-white/40 mt-0.5">{member.relation}</p>
            <div className={`inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full border text-[0.65rem] font-semibold tracking-wider ${sc.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
              {isAlive ? 'Living' : 'Deceased'}
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors mt-1 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Details grid */}
        <div className="glass rounded-2xl p-4 grid grid-cols-2 gap-4 mb-4">
          <DetailRow label="Born"       value={member.born} />
          <DetailRow label="Passed"     value={!isAlive ? (member.died ?? 'Unknown') : null} />
          <DetailRow label="Generation" value={member.generation != null ? `Gen ${member.generation}` : null} />
          <DetailRow label="Bloodline"  value={member.byMarriage ? 'By marriage' : 'By blood'} />
          <DetailRow label="Added"      value={timeAgo(member.createdAt)} />
        </div>

        {/* Bio */}
        {member.bio ? (
          <div className="glass rounded-2xl p-4 mb-4">
            <div className="text-[0.6rem] tracking-widest uppercase text-white/30 mb-2">Biography</div>
            <p className="text-sm text-white/70 leading-relaxed">{member.bio}</p>
          </div>
        ) : null}

        {/* Mark deceased form */}
        {isAlive && showDecease && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="glass rounded-2xl p-4 mb-4 border border-amber-500/20"
          >
            <p className="text-xs text-amber-400/80 mb-3">Enter year of passing</p>
            <div className="flex gap-2">
              <input
                type="number"
                value={deceaseYear}
                onChange={e => setDeceaseYear(e.target.value)}
                placeholder="e.g. 2023"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-amber-500/40 transition-colors"
              />
              <button
                onClick={handleMarkDeceased}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={() => setShowDecease(false)}
                className="px-4 py-2.5 rounded-xl text-xs text-white/40 glass border border-white/10 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="flex-1 py-3 rounded-xl text-xs font-semibold glass border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-all"
          >
            Edit
          </button>
          {isAlive && !showDecease && (
            <button
              onClick={() => setShowDecease(true)}
              className="flex-1 py-3 rounded-xl text-xs font-semibold glass border border-amber-500/20 text-amber-400/70 hover:text-amber-400 hover:border-amber-500/40 transition-all"
            >
              Mark deceased
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`flex-1 py-3 rounded-xl text-xs font-semibold transition-all ${
              confirming
                ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                : 'glass border border-white/10 text-red-400/50 hover:text-red-400 hover:border-red-500/20'
            }`}
          >
            {deleting ? 'Deleting...' : confirming ? 'Confirm delete' : 'Delete'}
          </button>
        </div>

        {confirming && !deleting && (
          <p className="text-center text-xs text-red-400/60 mt-3">
            Tap delete again to confirm. This cannot be undone.
          </p>
        )}
      </motion.div>
    </>
  )
}
