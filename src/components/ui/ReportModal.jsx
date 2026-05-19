// src/components/ui/ReportModal.jsx

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const REASONS = [
  'Offensive or hateful content',
  'Spam or irrelevant',
  'Impersonation',
  'Harassment',
  'Other',
]

export default function ReportModal({ tribute, memorialName, onClose }) {
  const [reason,     setReason]     = useState('')
  const [note,       setNote]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done,       setDone]       = useState(false)

  async function submit() {
    if (!reason) return
    setSubmitting(true)
    try {
      await fetch('/api/report-tribute', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ tributeId:tribute.id, tributeText:tribute.text, authorName:tribute.authorName, memorialName, reason, note })
      })
      setDone(true)
    } catch {}
    finally { setSubmitting(false) }
  }

  return (
    <>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        onClick={onClose} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" />
      <motion.div
        initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
        transition={{ type:'spring', damping:30, stiffness:300 }}
        className="dark-container fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d10] border-t border-white/10 rounded-t-3xl px-5 pt-4 pb-10 max-w-lg mx-auto"
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
        {done ? (
          <div className="text-center py-6">
            <p className="text-2xl mb-3">✓</p>
            <p className="font-semibold text-white mb-1">Report submitted</p>
            <p className="text-xs text-white/40 mb-6">We'll review within 24 hours.</p>
            <button onClick={onClose} className="text-xs text-gold hover:text-gold/70">Close</button>
          </div>
        ) : (
          <>
            <h3 className="font-display text-xl font-bold text-white mb-1">Report tribute</h3>
            <p className="text-xs text-white/40 mb-5">Select a reason</p>
            <div className="space-y-2 mb-4">
              {REASONS.map(r => (
                <button key={r} onClick={() => setReason(r)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all ${reason===r ? 'bg-red-500/12 border border-red-500/30 text-white' : 'glass border border-white/8 text-white/55 hover:text-white/80'}`}>
                  {r}
                </button>
              ))}
            </div>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              placeholder="Additional context (optional)"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/20 resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm glass border border-white/10 text-white/50">Cancel</button>
              <button onClick={submit} disabled={!reason || submitting}
                className="flex-[2] py-3 rounded-xl text-sm font-bold bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 disabled:opacity-40 transition-all">
                {submitting ? 'Submitting…' : 'Submit report'}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </>
  )
}
